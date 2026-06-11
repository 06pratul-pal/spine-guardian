import { useCallback, useRef, useEffect } from 'react';
import type { Personality } from '../lib/personalities';

export type VoiceMode = 'browser' | 'edge' | 'elevenlabs';

export interface VoiceConfig {
  volume: number;
  mode: VoiceMode;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  edgeTtsVoice?: string;
  openAiApiKey?: string;
  useAiMessages?: boolean;
  serverUrl?: string;
  serverSecret?: string;
  isPro?: boolean;          // controls AI roast generation — Pro users only
}

// Server URL — points to your deployed Railway backend
// Secret is NOT hardcoded here — it must be set via environment variable
// at build time: VITE_SERVER_URL and VITE_SERVER_SECRET in .env
export const DEFAULT_SERVER_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SERVER_URL as string) ||
  'https://spine-guardian-production.up.railway.app';

// Secret is read from build-time env — never hardcoded in source
const _envSecret =
  typeof import.meta !== 'undefined'
    ? ((import.meta as any).env?.VITE_SERVER_SECRET as string | undefined)
    : undefined;
export const DEFAULT_SERVER_SECRET = _envSecret || '';

// ---------------------------------------------------------------------------
// Audio context unlock
// ---------------------------------------------------------------------------
let _audioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!_audioCtx) _audioCtx = new AudioContext();
  return _audioCtx;
}
function unlockAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(ctx.destination); src.start(0);
  } catch { /* ignore */ }
}
if (typeof window !== 'undefined') {
  window.addEventListener('click',       unlockAudio, { once: true });
  window.addEventListener('keydown',     unlockAudio, { once: true });
  window.addEventListener('pointerdown', unlockAudio, { once: true });
}

// Pre-warm browser TTS
if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (window.speechSynthesis) {
      const v = window.speechSynthesis.getVoices();
      if (v.length === 0)
        window.speechSynthesis.addEventListener('voiceschanged', () => window.speechSynthesis.getVoices());
    }
  }, 0);
}

// ---------------------------------------------------------------------------
// No-repeat fallback message picker
// Shuffles the pool and cycles through all messages before repeating any
// ---------------------------------------------------------------------------
const _usedFallbacks = new Map<string, number[]>(); // key -> used indices

function pickNoRepeat(pool: string[], key: string): string {
  if (pool.length === 0) return '';
  if (pool.length === 1) return pool[0]!;

  let used = _usedFallbacks.get(key) ?? [];
  // If we've used all, reset
  if (used.length >= pool.length) used = [];

  const available = pool.map((_, i) => i).filter(i => !used.includes(i));
  const idx = available[Math.floor(Math.random() * available.length)]!;
  used.push(idx);
  _usedFallbacks.set(key, used);
  return pool[idx]!;
}


async function playBlob(
  blob: Blob,
  volume: number,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>
): Promise<void> {
  if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  const url  = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.volume = Math.min(1.0, volume);
  audioRef.current = audio;
  audio.onended = () => { URL.revokeObjectURL(url); if (audioRef.current === audio) audioRef.current = null; };
  try { const ctx = getAudioContext(); if (ctx.state === 'suspended') await ctx.resume(); } catch { /* ignore */ }
  await audio.play();
}

// ---------------------------------------------------------------------------
// Browser TTS fallback
// ---------------------------------------------------------------------------
function browserSpeak(text: string, personality: Personality, volume: number): void {
  if (!window.speechSynthesis) return;
  try { const ctx = getAudioContext(); if (ctx.state === 'suspended') void ctx.resume(); } catch { /* ignore */ }
  window.speechSynthesis.cancel();
  const utter  = new SpeechSynthesisUtterance(text);
  utter.pitch  = personality.voice.pitch;
  utter.rate   = personality.voice.rate;
  utter.volume = Math.min(1.0, personality.voice.volume * volume);
  let spoken = false;
  function doSpeak() {
    if (spoken) return; spoken = true;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find(v => v.lang === 'en-US' && v.name.toLowerCase().includes('natural')) ||
      voices.find(v => v.lang === 'en-US') ||
      voices.find(v => v.lang.startsWith('en')) || voices[0];
    if (preferred) utter.voice = preferred;
    window.speechSynthesis.speak(utter);
  }
  if (window.speechSynthesis.getVoices().length > 0) doSpeak();
  else { window.speechSynthesis.addEventListener('voiceschanged', doSpeak, { once: true }); setTimeout(doSpeak, 400); }
}

// ---------------------------------------------------------------------------
// SERVER-BASED alert — one call does both OpenAI roast + ElevenLabs voice
// ---------------------------------------------------------------------------
async function serverAlert(opts: {
  text: string;
  personality: Personality;
  config: VoiceConfig;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  score?: number;
  issues?: string[];
  badSeconds?: number;
  isViolation?: boolean;
  onMessageReady?: (msg: string) => void;
}): Promise<void> {
  const { text, personality, config, audioRef, score, issues, badSeconds, isViolation, onMessageReady } = opts;
  const serverUrl    = (config.serverUrl    || DEFAULT_SERVER_URL).replace(/\/$/, '');
  const serverSecret = config.serverSecret  || DEFAULT_SERVER_SECRET;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (serverSecret) headers['x-api-secret'] = serverSecret;

  const res = await fetch(`${serverUrl}/api/alert`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      personalityName:        personality.name,
      personalityDescription: personality.description,
      voiceId:  config.elevenLabsVoiceId || personality.elevenLabsVoiceId,
      score:    score ?? 70,
      issues:   issues ?? [],
      badSeconds: badSeconds ?? 5,
      isViolation: isViolation ?? false,
      fallbackText: text,
      // isPro controls whether server generates AI roast or just speaks fallback text
      isPro: config.isPro ?? false,
      // Do NOT send voiceSettings — let the server pick the right emotional
      // settings per personality and severity via getVoiceSettings()
    }),
  });

  if (!res.ok) {
    throw new Error(`Server error ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('audio/mpeg')) {
    // Server returned audio stream — play it
    const rawMsg = res.headers.get('x-alert-message');
    const msg    = rawMsg ? decodeURIComponent(rawMsg) : text;
    onMessageReady?.(msg);

    const blob = await res.blob();
    await playBlob(blob, config.volume, audioRef);
  } else {
    // Server returned JSON (no ElevenLabs configured on server) — use browser TTS
    const data = await res.json() as { message?: string; audio: null };
    const msg  = data.message || text;
    onMessageReady?.(msg);
    browserSpeak(msg, personality, config.volume);
  }
}

// ---------------------------------------------------------------------------
// DIRECT ElevenLabs (for users with own key, via Electron IPC)
// ---------------------------------------------------------------------------
async function directElevenLabsAlert(opts: {
  text: string;
  personality: Personality;
  config: VoiceConfig;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  score?: number;
  issues?: string[];
  badSeconds?: number;
  isViolation?: boolean;
  onMessageReady?: (msg: string) => void;
}): Promise<void> {
  const { personality, config, audioRef, score, issues, badSeconds, isViolation, onMessageReady } = opts;
  let { text } = opts;

  // Generate message via OpenAI if enabled
  if (config.openAiApiKey?.trim()) {
    const api = (window as any).electronAPI;
    if (api?.openAiGenerateMessage) {
      try {
        const result = await api.openAiGenerateMessage(
          config.openAiApiKey.trim(),
          personality.name,
          personality.description,
          score ?? 70,
          issues ?? [],
          badSeconds ?? 5,
          isViolation ?? false
        ) as { ok: true; message: string } | { ok: false; error: string };
        if (result.ok && result.message) text = result.message;
      } catch { /* use fallback */ }
    }
  }

  onMessageReady?.(text);

  // Speak via ElevenLabs IPC
  const api = (window as any).electronAPI;
  const voiceId = config.elevenLabsVoiceId?.trim() || personality.elevenLabsVoiceId;

  if (api?.elevenLabsSpeak && config.elevenLabsApiKey?.trim()) {
    const result = await api.elevenLabsSpeak(text, voiceId, config.elevenLabsApiKey.trim()) as
      | { ok: true; base64: string }
      | { ok: false; error: string };

    if (result.ok) {
      const bytes = atob(result.base64);
      const buf   = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      await playBlob(new Blob([buf], { type: 'audio/mpeg' }), config.volume, audioRef);
      return;
    }
    throw new Error(result.error);
  }

  throw new Error('ElevenLabs IPC not available');
}

// ---------------------------------------------------------------------------
// Master speakAlert — decides which path to take
// ---------------------------------------------------------------------------
export async function speakAlert(opts: {
  text: string;
  personality: Personality;
  config: VoiceConfig;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  score?: number;
  issues?: string[];
  badSeconds?: number;
  isViolation?: boolean;
  onMessageReady?: (msg: string) => void;
}): Promise<void> {
  const { config, personality } = opts;

  // Priority 1: Server (handles OpenAI roast + TTS in one call)
  // Always try the server first — it gives the best AI-generated roasts
  // and is aware of the actual issues (including lying_back).
  try {
    await serverAlert(opts);
    return;
  } catch (err) {
    console.warn('[Server] failed, trying next fallback:', (err as Error).message);
  }

  // Priority 2: Direct ElevenLabs with user's own key (Electron IPC path)
  if (config.mode === 'elevenlabs' && config.elevenLabsApiKey?.trim()) {
    try {
      await directElevenLabsAlert(opts);
      return;
    } catch (err) {
      console.warn('[ElevenLabs direct] failed, falling back to Edge TTS:', (err as Error).message);
    }
  }

  // Priority 3: Edge TTS (free natural Microsoft voice, via Electron IPC)
  if (config.mode === 'edge') {
    const api = (window as any).electronAPI;
    if (api?.edgeTtsSpeak) {
      try {
        const voice = config.edgeTtsVoice || 'en-US-JennyNeural';
        const result = await api.edgeTtsSpeak(opts.text, voice, '+0%', '+0Hz') as
          | { ok: true; base64: string }
          | { ok: false; error: string };
        if (result.ok) {
          opts.onMessageReady?.(opts.text);
          const bytes = atob(result.base64);
          const buf   = new Uint8Array(bytes.length);
          for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
          const audioRef = opts.audioRef;
          await playBlob(new Blob([buf], { type: 'audio/mpeg' }), config.volume, audioRef);
          return;
        }
      } catch (err) {
        console.warn('[Edge TTS] failed, falling back to browser TTS:', (err as Error).message);
      }
    }
  }

  // Priority 4: Browser TTS (always works, robotic but reliable)
  opts.onMessageReady?.(opts.text);
  browserSpeak(opts.text, personality, config.volume);
}

// ---------------------------------------------------------------------------
// Export for message-only generation (used for UI preview)
// ---------------------------------------------------------------------------
export async function generateAiMessage(
  apiKey: string,
  personality: Personality,
  score: number,
  issues: string[],
  badSeconds: number,
  isViolation: boolean
): Promise<string | null> {
  const api = (window as any).electronAPI;
  if (!api?.openAiGenerateMessage || !apiKey.trim()) return null;
  try {
    const result = await api.openAiGenerateMessage(
      apiKey.trim(), personality.name, personality.description,
      score, issues, badSeconds, isViolation
    ) as { ok: true; message: string } | { ok: false; error: string };
    return result.ok ? result.message : null;
  } catch { return null; }
}

export { pickNoRepeat };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useVoice(config: VoiceConfig | number) {
  const resolved: VoiceConfig =
    typeof config === 'number'
      ? { volume: config, mode: 'browser', elevenLabsApiKey: '', elevenLabsVoiceId: '' }
      : config;

  const configRef = useRef(resolved);
  const audioRef  = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { configRef.current = resolved; });

  const speak = useCallback((text: string, personality: Personality): void => {
    void speakAlert({ text, personality, config: configRef.current, audioRef });
  }, []);

  const debounceRef = useRef(false);
  const speakWithCooldown = useCallback(
    (text: string, personality: Personality, _cooldownMs: number): void => {
      if (debounceRef.current) return;
      speak(text, personality);
      debounceRef.current = true;
      setTimeout(() => { debounceRef.current = false; }, 500);
    },
    [speak]
  );

  const speakTest = useCallback((text: string, personality: Personality) => speak(text, personality), [speak]);

  const cancel = useCallback((): void => {
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  }, []);

  return { speak, speakWithCooldown, speakTest, cancel, isCoolingDown: () => debounceRef.current, audioRef, configRef };
}
