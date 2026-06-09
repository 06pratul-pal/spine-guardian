import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Volume2, Sliders, Clock, BellOff, MonitorCheck,
  CheckCircle, XCircle, Sparkles, Key, type LucideIcon,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PERSONALITY_LIST, PERSONALITIES } from '../lib/personalities';
import { useVoice, speakAlert } from '../hooks/useVoice';

// Edge TTS voices — free, natural, no API key
const EDGE_TTS_VOICES = [
  { id: 'en-US-JennyNeural',   name: 'Jenny — warm US female' },
  { id: 'en-US-GuyNeural',     name: 'Guy — confident US male' },
  { id: 'en-US-AriaNeural',    name: 'Aria — friendly US female' },
  { id: 'en-US-DavisNeural',   name: 'Davis — casual US male' },
  { id: 'en-GB-SoniaNeural',   name: 'Sonia — British female' },
  { id: 'en-GB-RyanNeural',    name: 'Ryan — British male' },
  { id: 'en-AU-NatashaNeural', name: 'Natasha — Australian female' },
  { id: 'en-IN-NeerjaNeural',  name: 'Neerja — Indian English female' },
];

// ── Range slider ─────────────────────────────────────────────────────────────
function RangeSlider({
  label, value, min, max, step, onChange, formatValue, icon: Icon,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; formatValue: (v: number) => string; icon: LucideIcon;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={13} style={{ color: 'rgba(255,255,255,0.4)' }} />
          <span className="text-sm font-medium" style={{ color: '#e4e4f0' }}>{label}</span>
        </div>
        <span className="text-sm font-bold tabular-nums px-2 py-0.5 rounded-lg"
          style={{ color: '#a78bfa', background: 'rgba(124,58,237,0.12)' }}>
          {formatValue(value)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="sg-slider"
        style={{ '--pct': `${pct}%` } as React.CSSProperties}
      />
    </div>
  );
}

type TTSStatus = { voices: number } | null;

export function Settings() {
  const { settings, updateSettings, totalXP, level, streakDays } = useAppStore();
  const [testingVoice,    setTestingVoice]    = useState(false);
  const [launchOnStartup, setLaunchOnStartup] = useState(false);
  const [ttsStatus,       setTtsStatus]       = useState<TTSStatus>(null);
  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (window.electronAPI?.getLaunchOnStartup) {
      void window.electronAPI.getLaunchOnStartup().then(setLaunchOnStartup);
    }
  }, []);

  // Check browser TTS voices
  useEffect(() => {
    function check() {
      const v = window.speechSynthesis?.getVoices() ?? [];
      setTtsStatus({ voices: v.length });
    }
    check();
    window.speechSynthesis?.addEventListener('voiceschanged', check);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', check);
  }, []);

  async function handleToggleStartup() {
    if (!window.electronAPI?.setLaunchOnStartup) return;
    const next = !launchOnStartup;
    setLaunchOnStartup(next);
    await window.electronAPI.setLaunchOnStartup(next);
  }

  const voiceConfig = {
    volume: settings.volume,
    mode: settings.voiceMode,
    elevenLabsApiKey: settings.elevenLabsApiKey,
    elevenLabsVoiceId: settings.elevenLabsVoiceId,
    edgeTtsVoice: settings.edgeTtsVoice,
    openAiApiKey: settings.openAiApiKey,
    useAiMessages: settings.useAiMessages,
  };
  const { audioRef: voiceAudioRef, configRef: voiceConfigRef } = useVoice(voiceConfig);

  function handleTestVoice() {
    if (testingVoice) return;
    setTestingVoice(true);
    const p = PERSONALITIES[settings.personalityId];
    // Use full speakAlert pipeline — generates AI roast + ElevenLabs voice
    void speakAlert({
      text: p.badPostureMessages[Math.floor(Math.random() * p.badPostureMessages.length)]!,
      personality: p,
      config: voiceConfigRef.current,
      audioRef: voiceAudioRef,
      score: 72,
      issues: ['forward_head'],
      badSeconds: 8,
      isViolation: false,
    });
    setTimeout(() => setTestingVoice(false), 5000);
  }

  return (
    <div className="h-full overflow-y-auto p-5 flex flex-col gap-4 sg-fade-up">

      {/* Header */}
      <div>
        <h2 className="text-base font-bold sg-gradient-text">Settings</h2>
        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
          Customize your posture guardian experience
        </p>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-2 gap-4">

        {/* Detection & Alerts */}
        <div className="sg-card p-5 flex flex-col gap-5">
          <h3 className="text-sm font-bold" style={{ color: '#e4e4f0' }}>Detection & Alerts</h3>
          <RangeSlider
            label="Sensitivity" value={settings.sensitivity} min={0.5} max={2.0} step={0.1}
            onChange={(v) => updateSettings({ sensitivity: v })}
            formatValue={(v) => `${v.toFixed(1)}x`} icon={Sliders}
          />
          <RangeSlider
            label="Voice Volume" value={settings.volume} min={0} max={1} step={0.05}
            onChange={(v) => updateSettings({ volume: v })}
            formatValue={(v) => `${Math.round(v * 100)}%`} icon={Volume2}
          />
          <RangeSlider
            label="Alert Delay" value={settings.alertDelaySeconds} min={5} max={60} step={5}
            onChange={(v) => updateSettings({ alertDelaySeconds: v })}
            formatValue={(v) => `${v}s`} icon={Clock}
          />
          <RangeSlider
            label="Alert Cooldown" value={settings.cooldownMinutes} min={0.5} max={10} step={0.5}
            onChange={(v) => updateSettings({ cooldownMinutes: v })}
            formatValue={(v) => v < 1 ? `${Math.round(v * 60)}s` : `${v}m`} icon={BellOff}
          />
        </div>

        {/* Voice Engine */}
        <div className="flex flex-col gap-3">
          <div className="sg-card p-5 flex flex-col gap-4">
            <h3 className="text-sm font-bold" style={{ color: '#e4e4f0' }}>Voice Engine</h3>

            {/* Mode selector */}
            <div className="flex flex-col gap-2">
              {([
                { value: 'elevenlabs' as const, label: 'AI Voice',       desc: 'Natural human voice via server ✨', badge: 'BEST' },
                { value: 'edge'       as const, label: 'Edge TTS',       desc: 'Natural Microsoft voices · Free' },
                { value: 'browser'   as const, label: 'Browser TTS',    desc: 'Basic · Offline · Robotic' },
              ]).map((opt) => (
                <motion.button
                  key={opt.value}
                  onClick={() => updateSettings({ voiceMode: opt.value })}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left"
                  style={{
                    background: settings.voiceMode === opt.value ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                    border: settings.voiceMode === opt.value ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0"
                    style={{
                      borderColor: settings.voiceMode === opt.value ? '#7c3aed' : 'rgba(255,255,255,0.3)',
                      background:  settings.voiceMode === opt.value ? '#7c3aed' : 'transparent',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold"
                        style={{ color: settings.voiceMode === opt.value ? '#a78bfa' : '#e4e4f0' }}>
                        {opt.label}
                      </p>
                      {opt.badge && (
                        <span className="text-xs font-black px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(124,58,237,0.25)', color: '#a78bfa', fontSize: 9 }}>
                          {opt.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.32)' }}>{opt.desc}</p>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Edge TTS voice picker */}
            {settings.voiceMode === 'edge' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Voice</label>
                <select
                  value={settings.edgeTtsVoice}
                  onChange={(e) => updateSettings({ edgeTtsVoice: e.target.value })}
                  className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#e4e4f0' }}
                >
                  {EDGE_TTS_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* AI Voice info (ElevenLabs via server) */}
            {settings.voiceMode === 'elevenlabs' && (
              <div className="rounded-xl p-3 flex items-start gap-2.5"
                style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }}>
                <CheckCircle size={14} style={{ color: '#34d399', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: '#34d399' }}>Connected via Spine Guardian server</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    No API key needed — natural voice is handled on our end
                  </p>
                </div>
              </div>
            )}

            {/* Browser TTS status */}
            {settings.voiceMode === 'browser' && ttsStatus !== null && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {ttsStatus.voices > 0 ? (
                  <>
                    <CheckCircle size={13} style={{ color: '#34d399', flexShrink: 0 }} />
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      <span style={{ color: '#34d399', fontWeight: 600 }}>Ready</span>
                      {' '}— {ttsStatus.voices} voice{ttsStatus.voices !== 1 ? 's' : ''} available
                    </p>
                  </>
                ) : (
                  <>
                    <XCircle size={13} style={{ color: '#f87171', flexShrink: 0 }} />
                    <p className="text-xs" style={{ color: '#fca5a5' }}>No voices found</p>
                  </>
                )}
              </div>
            )}

            {/* AI Messages toggle */}
            <div className="rounded-xl p-4 flex flex-col gap-3"
              style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={13} style={{ color: '#a78bfa' }} />
                  <p className="text-sm font-semibold" style={{ color: '#a78bfa' }}>AI Roasts</p>
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-black"
                    style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', fontSize: 9 }}>
                    PRO
                  </span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => updateSettings({ useAiMessages: !settings.useAiMessages })}
                  className="relative flex-shrink-0"
                  style={{ width: 44, height: 24 }}
                >
                  <div className="absolute inset-0 rounded-full transition-colors duration-200"
                    style={{ background: settings.useAiMessages ? '#7c3aed' : 'rgba(255,255,255,0.1)' }} />
                  <motion.div
                    animate={{ x: settings.useAiMessages ? 22 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute top-1 w-4 h-4 rounded-full bg-white"
                    style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
                  />
                </motion.button>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
                {settings.useAiMessages
                  ? 'GPT-4o-mini generates a fresh, unique roast every single alert. Never the same message twice.'
                  : 'Turn on for unique AI-generated roasts every alert. Way better than fixed messages.'}
              </p>
              {settings.useAiMessages && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)' }}>
                  <CheckCircle size={12} style={{ color: '#34d399', flexShrink: 0 }} />
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    AI roasts handled via server — no key needed
                  </p>
                </div>
              )}
            </div>

            {/* Test Voice */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleTestVoice}
              disabled={testingVoice}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
              style={{
                background: testingVoice ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(109,40,217,0.15))',
                color:      testingVoice ? 'rgba(255,255,255,0.3)' : '#c4b5fd',
                border: '1px solid rgba(124,58,237,0.3)',
                boxShadow: testingVoice ? 'none' : '0 0 20px rgba(124,58,237,0.12)',
              }}
            >
              {testingVoice ? '🔊 Playing...' : '🔊 Test Voice'}
            </motion.button>
          </div>

          {/* Stats */}
          <div className="sg-card p-4 flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Your Stats
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Level',    value: level,      color: '#a78bfa' },
                { label: 'Total XP', value: totalXP,    color: '#60a5fa' },
                { label: 'Streak',   value: streakDays, color: '#f97316' },
              ].map((s) => (
                <div key={s.label} className="flex flex-col gap-0.5">
                  <span className="text-xl font-black" style={{ color: s.color }}>{s.value}</span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Personality grid */}
      <div className="sg-card p-5 flex flex-col gap-4">
        <h3 className="text-sm font-bold" style={{ color: '#e4e4f0' }}>
          Personality
          <span className="ml-2 text-xs font-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>
            — choose who scolds you
          </span>
        </h3>
        <div className="grid grid-cols-5 gap-2.5">
          {PERSONALITY_LIST.map((p) => {
            const isActive = settings.personalityId === p.id;
            return (
              <motion.button
                key={p.id}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => updateSettings({ personalityId: p.id })}
                className="flex flex-col gap-2 p-3 rounded-2xl text-left"
                style={{
                  background: isActive ? `${p.color}12` : 'rgba(255,255,255,0.02)',
                  border: isActive ? `1px solid ${p.color}35` : '1px solid rgba(255,255,255,0.05)',
                  boxShadow: isActive ? `0 0 20px ${p.color}15` : 'none',
                }}
              >
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 20 }}>{p.emoji}</span>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
                  )}
                </div>
                <p className="text-xs font-bold leading-tight"
                  style={{ color: isActive ? p.color : '#e4e4f0' }}>
                  {p.name}
                </p>
                <p className="text-xs leading-snug" style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10 }}>
                  {p.tagline}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* System */}
      <div className="sg-card p-5 flex flex-col gap-4">
        <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: '#e4e4f0' }}>
          <MonitorCheck size={14} style={{ color: '#a78bfa' }} />
          System
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: '#e4e4f0' }}>Launch at Windows startup</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {isElectron ? 'Auto-start with Windows login' : 'Only works in packaged app'}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => void handleToggleStartup()}
            disabled={!isElectron}
            className="relative flex-shrink-0"
            style={{ width: 44, height: 24, opacity: isElectron ? 1 : 0.4 }}
          >
            <div className="absolute inset-0 rounded-full transition-colors duration-200"
              style={{ background: launchOnStartup ? '#7c3aed' : 'rgba(255,255,255,0.1)' }} />
            <motion.div
              animate={{ x: launchOnStartup ? 22 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="absolute top-1 w-4 h-4 rounded-full bg-white"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
            />
          </motion.button>
        </div>

        <div className="flex items-center justify-between pt-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: '#e4e4f0' }}>Show onboarding again</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Restart the welcome walkthrough</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => { localStorage.removeItem('sg-onboarded'); window.location.reload(); }}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}
          >
            Reset
          </motion.button>
        </div>
      </div>

      {/* Privacy */}
      <div className="rounded-2xl p-4"
        style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.12)' }}>
        <p className="text-xs font-bold mb-1" style={{ color: '#a78bfa' }}>🔒 Privacy</p>
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
          All webcam and posture processing is 100% local via MediaPipe AI — nothing leaves your device.
          Voice and AI roasts go through Spine Guardian's server — no personal data is stored.
        </p>
      </div>
    </div>
  );
}
