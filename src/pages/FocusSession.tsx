import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, RotateCcw, Coffee, Zap, Timer } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PERSONALITIES } from '../lib/personalities';
import { usePostureDetection } from '../hooks/usePostureDetection';
import { useVoice, speakAlert } from '../hooks/useVoice';
import { addSession, addOrUpdateSnapshot, todayString } from '../lib/database';
import { buildAndCheckAchievements } from '../lib/achievements';
import { ScoreRing } from '../components/ScoreRing';
import type { PostureResult } from '../lib/posture-analyzer';

type SessionType = 'pomodoro' | 'deep_work' | 'custom';
type Phase = 'idle' | 'working' | 'break' | 'complete';

const WORK_DURATIONS: Record<SessionType, number> = {
  pomodoro: 25 * 60,
  deep_work: 50 * 60,
  custom: 30 * 60,
};

const BREAK_DURATIONS: Record<SessionType, number> = {
  pomodoro: 5 * 60,
  deep_work: 10 * 60,
  custom: 5 * 60,
};

const SESSION_LABELS: Record<SessionType, string> = {
  pomodoro: 'Pomodoro',
  deep_work: 'Deep Work',
  custom: 'Custom',
};

function TimerRing({
  secondsLeft,
  totalSeconds,
  phase,
}: {
  secondsLeft: number;
  totalSeconds: number;
  phase: Phase;
}) {
  const size = 200;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const offset = circumference - progress * circumference;
  const color = phase === 'break' ? '#10b981' : '#7c3aed';
  const center = size / 2;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} className="absolute">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
        <circle
          cx={center} cy={center} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s ease' }}
        />
      </svg>
      <div className="relative flex flex-col items-center gap-1">
        <span className="font-bold tabular-nums" style={{ fontSize: 40, color: phase === 'break' ? '#34d399' : '#e4e4f0' }}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
        <span className="text-xs uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {phase === 'break' ? 'Break' : phase === 'working' ? 'Focus' : ''}
        </span>
      </div>
    </div>
  );
}

export function FocusSession() {
  const { settings, showViolation, totalXP, level, streakDays, enqueueAchievement } = useAppStore();
  const personality = PERSONALITIES[settings.personalityId];

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

  const [sessionType, setSessionType] = useState<SessionType>('pomodoro');
  const [customMinutes, setCustomMinutes] = useState(30);
  const [phase, setPhase] = useState<Phase>('idle');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [postureResult, setPostureResult] = useState<PostureResult | null>(null);

  const sessionStartRef = useRef<number>(0);
  const goodSecondsRef = useRef(0);
  const badSecondsRef = useRef(0);
  const slouchCountRef = useRef(0);
  const scoresRef = useRef<number[]>([]);
  const snapshotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const badPostureStartRef = useRef<number | null>(null);
  const lastAlertRef = useRef<number>(0);
  const sessionTypeRef = useRef<SessionType>('pomodoro');

  const handlePostureResult = useCallback(
    (result: PostureResult) => {
      setPostureResult(result);
      scoresRef.current.push(result.score);
      if (result.score < 85) slouchCountRef.current++;

      const now = Date.now();
      const cooldownMs = settings.cooldownMinutes * 60 * 1000;
      const alertDelayMs = settings.alertDelaySeconds * 1000;

      if (result.score < 85) {
        if (!badPostureStartRef.current) badPostureStartRef.current = now;
        const badDuration = now - badPostureStartRef.current;
        if (badDuration >= alertDelayMs && now - lastAlertRef.current > cooldownMs) {
          lastAlertRef.current = now;
          const fallback = personality.badPostureMessages[
            Math.floor(Math.random() * personality.badPostureMessages.length)
          ]!;
          void speakAlert({
            text: fallback,
            personality,
            config: voiceConfigRef.current,
            audioRef: voiceAudioRef,
            score: result.score,
            issues: result.issues,
            badSeconds: Math.round(badDuration / 1000),
            isViolation: false,
          });
        }
        if (result.score < 55 && badDuration >= 20_000) {
          badPostureStartRef.current = now;
          const fallbackViol = personality.violationMessages[
            Math.floor(Math.random() * personality.violationMessages.length)
          ]!;
          void speakAlert({
            text: fallbackViol,
            personality,
            config: voiceConfigRef.current,
            audioRef: voiceAudioRef,
            score: result.score,
            issues: result.issues,
            badSeconds: Math.round(badDuration / 1000),
            isViolation: true,
            onMessageReady: (msg) => showViolation(msg),
          });
        }
      } else {
        badPostureStartRef.current = null;
      }
    },
    [settings, personality, showViolation, voiceAudioRef, voiceConfigRef]
  );

  const { videoRef, canvasRef, isReady, isLoading, error, startCamera, stopCamera } =
    usePostureDetection(settings.sensitivity, handlePostureResult);

  async function writeSnapshot() {
    if (scoresRef.current.length === 0) return;
    const avgScore = scoresRef.current.reduce((a, b) => a + b, 0) / scoresRef.current.length;
    await addOrUpdateSnapshot({
      date: todayString(),
      hour: new Date().getHours(),
      avgScore: Math.round(avgScore),
      sampleCount: scoresRef.current.length,
      slouchCount: 0,
    });
    scoresRef.current = [];
  }

  async function handleStart() {
    const workDuration = sessionType === 'custom' ? customMinutes * 60 : WORK_DURATIONS[sessionType];
    sessionStartRef.current = Date.now();
    goodSecondsRef.current = 0;
    badSecondsRef.current = 0;
    slouchCountRef.current = 0;
    scoresRef.current = [];
    badPostureStartRef.current = null;
    lastAlertRef.current = 0;
    sessionTypeRef.current = sessionType;

    setTotalSeconds(workDuration);
    setSecondsLeft(workDuration);
    setPhase('working');
    await startCamera();
    snapshotTimerRef.current = setInterval(writeSnapshot, 60_000);
  }

  function handleStop() {
    setPhase('idle');
    stopCamera();
    setPostureResult(null);
    if (snapshotTimerRef.current) { clearInterval(snapshotTimerRef.current); snapshotTimerRef.current = null; }
    void writeSnapshot();
    badPostureStartRef.current = null;
  }

  async function handleComplete() {
    stopCamera();
    if (snapshotTimerRef.current) { clearInterval(snapshotTimerRef.current); snapshotTimerRef.current = null; }
    await writeSnapshot();

    const durationSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000);
    const allScores = [...scoresRef.current];
    const avgScore = allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0;

    await addSession({
      date: todayString(),
      startedAt: sessionStartRef.current,
      endedAt: Date.now(),
      type: sessionTypeRef.current,
      durationSeconds,
      goodSeconds: goodSecondsRef.current,
      badSeconds: badSecondsRef.current,
      avgScore,
      slouchCount: slouchCountRef.current,
    });

    const newAchievements = await buildAndCheckAchievements({
      streakDays,
      totalXP,
      level,
      lastSessionSlouchCount: slouchCountRef.current,
      lastSessionAvgScore: avgScore,
      lastSessionType: sessionTypeRef.current,
    });
    for (const a of newAchievements) enqueueAchievement(a);

    setPhase('complete');
  }

  useEffect(() => {
    if (phase !== 'working' && phase !== 'break') return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (phase === 'working') {
            const breakDur = BREAK_DURATIONS[sessionTypeRef.current];
            setTotalSeconds(breakDur);
            setPhase('break');
            return breakDur;
          } else {
            void handleComplete();
            return 0;
          }
        }
        if (postureResult) {
          if (postureResult.score >= 75) goodSecondsRef.current++;
          else badSecondsRef.current++;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, postureResult]);

  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  const goodMin = Math.round(goodSecondsRef.current / 60);
  const badMin = Math.round(badSecondsRef.current / 60);
  const avgFinalScore =
    scoresRef.current.length > 0
      ? Math.round(scoresRef.current.reduce((a, b) => a + b, 0) / scoresRef.current.length)
      : 0;

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: '#e4e4f0' }}>Focus Session</h2>
        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Timed deep work with posture tracking
        </p>
      </div>

      {/* Idle: setup */}
      {phase === 'idle' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            {(['pomodoro', 'deep_work', 'custom'] as SessionType[]).map((t) => (
              <motion.button
                key={t}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSessionType(t)}
                className="rounded-2xl p-5 flex flex-col gap-2 text-left"
                style={{
                  background: sessionType === t ? 'rgba(124,58,237,0.15)' : '#111118',
                  border: sessionType === t ? '1px solid rgba(124,58,237,0.4)' : '1px solid #1e1e2e',
                }}
              >
                <span className="text-2xl">{t === 'pomodoro' ? '🍅' : t === 'deep_work' ? '🧠' : '⏱️'}</span>
                <p className="font-semibold text-sm" style={{ color: '#e4e4f0' }}>{SESSION_LABELS[t]}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {t === 'pomodoro' ? '25 min work + 5 min break' : t === 'deep_work' ? '50 min work + 10 min break' : 'Custom duration'}
                </p>
              </motion.button>
            ))}
          </div>

          {sessionType === 'custom' && (
            <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: '#111118', border: '1px solid #1e1e2e' }}>
              <Timer size={16} style={{ color: '#a78bfa' }} />
              <span className="text-sm" style={{ color: '#e4e4f0' }}>Work duration</span>
              <input
                type="number" min={5} max={180} value={customMinutes}
                onChange={(e) => setCustomMinutes(Math.max(5, Math.min(180, Number(e.target.value))))}
                className="w-20 px-3 py-1.5 rounded-lg text-sm font-bold text-right outline-none"
                style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', color: '#a78bfa' }}
              />
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>minutes</span>
            </div>
          )}

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleStart}
            disabled={isLoading}
            className="flex items-center justify-center gap-3 py-4 rounded-2xl text-base font-bold"
            style={{
              background: 'rgba(124,58,237,0.2)',
              border: '1px solid rgba(124,58,237,0.4)',
              color: '#a78bfa',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            <Play size={18} />
            {isLoading ? 'Loading AI...' : `Start ${SESSION_LABELS[sessionType]}`}
          </motion.button>
        </motion.div>
      )}

      {/* Active session */}
      {(phase === 'working' || phase === 'break') && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-6">
          <div className="flex flex-col items-center gap-5 flex-1">
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: phase === 'break' ? 'rgba(16,185,129,0.12)' : 'rgba(124,58,237,0.12)',
                color: phase === 'break' ? '#34d399' : '#a78bfa',
                border: `1px solid ${phase === 'break' ? 'rgba(16,185,129,0.25)' : 'rgba(124,58,237,0.25)'}`,
              }}
            >
              {phase === 'break' ? <Coffee size={12} /> : <Zap size={12} />}
              {phase === 'break' ? 'Break Time — Relax!' : SESSION_LABELS[sessionType]}
            </div>

            <TimerRing secondsLeft={secondsLeft} totalSeconds={totalSeconds} phase={phase} />

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleStop}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' }}
              >
                <Square size={14} /> Stop Session
              </motion.button>
            </div>

            {phase === 'working' && postureResult && (
              <div className="flex items-center gap-3 px-4 py-2 rounded-xl" style={{ background: '#111118', border: '1px solid #1e1e2e' }}>
                <ScoreRing score={postureResult.score} label={postureResult.label} size={60} showLabel={false} />
                <div>
                  <p className="text-xs font-medium" style={{ color: '#e4e4f0' }}>Posture Score</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {postureResult.issues.length === 0 ? 'Looking good!' : postureResult.issues[0]!.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div
            className="relative rounded-2xl overflow-hidden"
            style={{ width: 280, background: '#0d0d14', border: '1px solid #1e1e2e', flexShrink: 0 }}
          >
            {!isReady && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {error ?? 'Loading camera...'}
                </p>
              </div>
            )}
            <video ref={videoRef} autoPlay muted playsInline
              className="w-full h-full object-cover"
              style={{ display: isReady ? 'block' : 'none', transform: 'scaleX(-1)', minHeight: 200 }}
            />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover"
              style={{ display: isReady ? 'block' : 'none', transform: 'scaleX(-1)' }}
            />
            {isReady && (
              <div
                className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs"
                style={{ background: 'rgba(0,0,0,0.6)', color: '#34d399' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Complete: summary */}
      <AnimatePresence>
        {phase === 'complete' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-5"
          >
            <div className="text-5xl">🎉</div>
            <div className="text-center">
              <h3 className="text-xl font-bold" style={{ color: '#e4e4f0' }}>Session Complete!</h3>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{SESSION_LABELS[sessionType]} finished</p>
            </div>

            <div className="grid grid-cols-3 gap-4 w-full max-w-md">
              {[
                { label: 'Avg Posture', value: avgFinalScore || '—', color: '#a78bfa' },
                { label: 'Good Posture', value: `${goodMin}m`, color: '#10b981' },
                { label: 'Slouching', value: `${badMin}m`, color: '#f59e0b' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: '#111118', border: '1px solid #1e1e2e' }}>
                  <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</p>
                </div>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => { setPhase('idle'); setPostureResult(null); }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(124,58,237,0.18)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}
            >
              <RotateCcw size={14} /> New Session
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
