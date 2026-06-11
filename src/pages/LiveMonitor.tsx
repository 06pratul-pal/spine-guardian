import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, Pause, AlertTriangle, CheckCircle, Loader, Volume2, Crosshair, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PERSONALITIES } from '../lib/personalities';
import { ISSUE_DESCRIPTIONS } from '../lib/posture-analyzer';
import { ScoreRing } from '../components/ScoreRing';
import { usePostureDetection } from '../hooks/usePostureDetection';
import { useVoice, speakAlert, pickNoRepeat } from '../hooks/useVoice';
import { addSession, addOrUpdateSnapshot, todayString } from '../lib/database';
import { buildAndCheckAchievements } from '../lib/achievements';
import { CalibrationModal } from '../components/CalibrationModal';
import { clearCalibration, type CalibrationData } from '../lib/calibration';
import { track } from '../lib/analytics';
import type { PostureResult } from '../lib/posture-analyzer';

type AlertStatus =
  | { kind: 'idle' }
  | { kind: 'countdown'; secsLeft: number }
  | { kind: 'fired'; msg: string }
  | { kind: 'cooldown'; secsLeft: number };

export function LiveMonitor() {
  const {
    settings,
    postureResult,
    isMonitoring,
    setPostureResult,
    setIsMonitoring,
    showViolation,
    startSession,
    endSession,
    tickGoodSecond,
    tickBadSecond,
    sessionGoodSeconds,
    sessionBadSeconds,
    totalXP,
    level,
    streakDays,
    enqueueAchievement,
    calibration,
    setCalibration,
    isPro,
  } = useAppStore();

  const personality = PERSONALITIES[settings.personalityId];

  const voiceConfig = {
    volume: settings.volume,
    mode: settings.voiceMode,
    elevenLabsApiKey: settings.elevenLabsApiKey,
    elevenLabsVoiceId: settings.elevenLabsVoiceId,
    edgeTtsVoice: settings.edgeTtsVoice,
    openAiApiKey: settings.openAiApiKey,
    useAiMessages: settings.useAiMessages,
    isPro,
  };
  const { speakWithCooldown, speakTest, cancel, audioRef: voiceAudioRef, configRef: voiceConfigRef } = useVoice(voiceConfig);

  const badPostureStartRef    = useRef<number | null>(null);
  const lastAlertTimeRef      = useRef<number>(0);
  const violationShownRef     = useRef(false);
  const tickIntervalRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const snapshotIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertStatusIntervalRef= useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef       = useRef<number>(0);
  const scoresRef             = useRef<number[]>([]);
  const slouchCountRef        = useRef(0);

  const [alertStatus,     setAlertStatus]     = useState<AlertStatus>({ kind: 'idle' });
  const [testingVoice,    setTestingVoice]     = useState(false);
  const [showCalibModal,  setShowCalibModal]   = useState(false);
  const [isPaused,        setIsPaused]         = useState(false);

  async function writeSnapshot() {
    if (scoresRef.current.length === 0) return;
    const avg = scoresRef.current.reduce((a, b) => a + b, 0) / scoresRef.current.length;
    await addOrUpdateSnapshot({
      date: todayString(),
      hour: new Date().getHours(),
      avgScore: Math.round(avg),
      sampleCount: scoresRef.current.length,
      slouchCount: 0,
    });
    scoresRef.current = [];
  }

  const handlePostureResult = useCallback(
    (result: PostureResult) => {
      if (isPaused) return;  // skip all processing when paused
      setPostureResult(result);
      scoresRef.current.push(result.score);
      if (result.score < 85) slouchCountRef.current++;

      const now = Date.now();
      const cooldownMs  = settings.cooldownMinutes * 60 * 1000;
      const alertDelayMs = settings.alertDelaySeconds * 1000;

      if (result.score < 85) {
        if (!badPostureStartRef.current) {
          badPostureStartRef.current = now;
          violationShownRef.current = false;
        }
        const badDuration    = now - badPostureStartRef.current;
        const cooldownPassed = now - lastAlertTimeRef.current > cooldownMs;

        if (badDuration >= alertDelayMs && cooldownPassed) {
          // Mark cooldown immediately to prevent double-firing
          lastAlertTimeRef.current = now;

          const isLyingBack = result.issues.includes('lying_back');
          const msgPool = isLyingBack
            ? personality.violationMessages
            : personality.badPostureMessages;
          const fallbackMsg = pickNoRepeat(msgPool, `${personality.id}-bad`);

          void speakAlert({
            text: fallbackMsg,
            personality,
            config: voiceConfigRef.current,
            audioRef: voiceAudioRef,
            score: result.score,
            issues: result.issues,
            badSeconds: Math.round(badDuration / 1000),
            isViolation: false,
            onMessageReady: (msg) => {
              setAlertStatus({ kind: 'fired', msg });
              setTimeout(() => setAlertStatus({ kind: 'idle' }), 5000);
              void track('alert_fired', {
                personality: settings.personalityId,
                score: result.score,
                bad_seconds: Math.round(badDuration / 1000),
                is_lying_back: isLyingBack,
              });
            },
          });
        }

        if ((result.score < 55 || isLyingBack) && badDuration >= 20_000 && !violationShownRef.current) {
          violationShownRef.current = true;
          const fallbackViol = pickNoRepeat(personality.violationMessages, `${personality.id}-viol`);

          void speakAlert({
            text: fallbackViol,
            personality,
            config: voiceConfigRef.current,
            audioRef: voiceAudioRef,
            score: result.score,
            issues: result.issues,
            badSeconds: Math.round(badDuration / 1000),
            isViolation: true,
            onMessageReady: (msg) => {
              showViolation(msg);
              void track('violation_shown', {
                personality: settings.personalityId,
                score: result.score,
              });
            },
          });
        }
      } else {
        badPostureStartRef.current = null;
        violationShownRef.current  = false;
      }
    },
    [settings, personality, showViolation, setPostureResult, voiceAudioRef, voiceConfigRef, isPaused]);

  const { videoRef, canvasRef, isReady, isLoading, error, startCamera, stopCamera, startCalibration } =
    usePostureDetection(settings.sensitivity, handlePostureResult, calibration);

  // Alert status countdown ticker
  useEffect(() => {
    if (!isMonitoring || !isReady) {
      setAlertStatus({ kind: 'idle' });
      if (alertStatusIntervalRef.current) {
        clearInterval(alertStatusIntervalRef.current);
        alertStatusIntervalRef.current = null;
      }
      return;
    }

    alertStatusIntervalRef.current = setInterval(() => {
      const now         = Date.now();
      const alertDelayMs = settings.alertDelaySeconds * 1000;
      const cooldownMs  = settings.cooldownMinutes * 60 * 1000;
      const badStart    = badPostureStartRef.current;
      const lastAlert   = lastAlertTimeRef.current;
      const cooldownPassed = now - lastAlert > cooldownMs;

      if (!badStart) {
        setAlertStatus((prev) => (prev.kind === 'fired' ? prev : { kind: 'idle' }));
        return;
      }

      const badDuration = now - badStart;

      if (!cooldownPassed) {
        const secsLeft = Math.ceil((cooldownMs - (now - lastAlert)) / 1000);
        setAlertStatus({ kind: 'cooldown', secsLeft });
        return;
      }

      if (badDuration < alertDelayMs) {
        const secsLeft = Math.ceil((alertDelayMs - badDuration) / 1000);
        setAlertStatus({ kind: 'countdown', secsLeft });
        return;
      }
    }, 500);

    return () => {
      if (alertStatusIntervalRef.current) clearInterval(alertStatusIntervalRef.current);
    };
  }, [isMonitoring, isReady, settings.alertDelaySeconds, settings.cooldownMinutes]);

  // XP tick interval
  useEffect(() => {
    if (!isMonitoring || !isReady) {
      if (tickIntervalRef.current) { clearInterval(tickIntervalRef.current); tickIntervalRef.current = null; }
      return;
    }
    tickIntervalRef.current = setInterval(() => {
      const result = postureResult;
      if (!result) return;
      if (result.score >= 80) tickGoodSecond(result.score);
      else tickBadSecond();
    }, 1000);
    return () => { if (tickIntervalRef.current) clearInterval(tickIntervalRef.current); };
  }, [isMonitoring, isReady, postureResult, tickGoodSecond, tickBadSecond]);

  // Snapshot interval
  useEffect(() => {
    if (!isMonitoring || !isReady) {
      if (snapshotIntervalRef.current) { clearInterval(snapshotIntervalRef.current); snapshotIntervalRef.current = null; }
      return;
    }
    snapshotIntervalRef.current = setInterval(writeSnapshot, 60_000);
    return () => { if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current); };
  }, [isMonitoring, isReady]);

  const handleStart = async () => {
    sessionStartRef.current   = Date.now();
    slouchCountRef.current    = 0;
    scoresRef.current         = [];
    setIsMonitoring(true);
    startSession();
    await startCamera();
    void track('session_started', { personality: settings.personalityId });
  };

  const handleStop = async () => {
    setIsMonitoring(false);
    setIsPaused(false);
    endSession();
    stopCamera();
    cancel();
    badPostureStartRef.current   = null;
    lastAlertTimeRef.current     = 0;
    violationShownRef.current    = false;
    setAlertStatus({ kind: 'idle' });

    await writeSnapshot();

    const now             = Date.now();
    const durationSeconds = Math.round((now - sessionStartRef.current) / 1000);
    if (durationSeconds > 5) {
      // Compute real avg score from collected scores
      const allScores = [...scoresRef.current];
      const avgScore = allScores.length > 0
        ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
        : 0;

      await addSession({
        date: todayString(),
        startedAt: sessionStartRef.current,
        endedAt: now,
        type: 'monitoring',
        durationSeconds,
        goodSeconds: sessionGoodSeconds,
        badSeconds: sessionBadSeconds,
        avgScore,
        slouchCount: slouchCountRef.current,
      });

      const newAchievements = await buildAndCheckAchievements({
        streakDays,
        totalXP,
        level,
        lastSessionSlouchCount: slouchCountRef.current,
        lastSessionAvgScore: avgScore,
        lastSessionType: 'monitoring',
      });
      for (const a of newAchievements) enqueueAchievement(a);

      // Sync to cloud after session ends
      void useAppStore.getState().syncToCloud();

      void track('session_ended', {
        duration_seconds: durationSeconds,
        avg_score: avgScore,
        slouch_count: slouchCountRef.current,
        personality: settings.personalityId,
      });
    }
  };

  function handleTestVoice() {
    if (testingVoice) return;
    setTestingVoice(true);
    const msg = personality.badPostureMessages[0]!;
    speakTest(msg, personality);
    setTimeout(() => setTestingVoice(false), 3500);
  }

  function handleCalibrated(data: CalibrationData) {
    setCalibration(data);
  }

  function handleClearCalibration() {
    clearCalibration();
    setCalibration(null);
  }

  const score  = postureResult?.score ?? 0;
  const label  = postureResult?.label ?? 'poor';
  const issues = postureResult?.issues ?? [];

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#e4e4f0' }}>Live Monitor</h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Webcam + AI posture analysis in real time
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Pause button — only visible while monitoring */}
          {isMonitoring && (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setIsPaused((p) => !p);
                badPostureStartRef.current = null;
                setAlertStatus({ kind: 'idle' });
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
              style={{
                background: isPaused ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.06)',
                color: isPaused ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                border: `1px solid ${isPaused ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.08)'}`,
              }}
              title={isPaused ? 'Resume monitoring' : 'Pause alerts temporarily'}
            >
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </motion.button>
          )}

          {/* Test Voice button */}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleTestVoice}
            disabled={testingVoice}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{
              background: testingVoice ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
              color: testingVoice ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.5)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
            title="Test voice — plays a sample alert right now"
          >
            <Volume2 size={13} />
            {testingVoice ? 'Playing…' : 'Test Voice'}
          </motion.button>

          {/* Calibrate button */}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setShowCalibModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{
              background: calibration ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.06)',
              color: calibration ? '#34d399' : 'rgba(255,255,255,0.5)',
              border: `1px solid ${calibration ? 'rgba(16,185,129,0.22)' : 'rgba(255,255,255,0.08)'}`,
            }}
            title={calibration
              ? `Calibrated on ${new Date(calibration.capturedAt).toLocaleDateString()} — click to recalibrate`
              : 'Calibrate posture baseline to your body & camera'
            }
          >
            <Crosshair size={13} />
            {calibration ? 'Calibrated ✓' : 'Calibrate'}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={isMonitoring ? handleStop : handleStart}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              background: isMonitoring ? 'rgba(239,68,68,0.15)' : 'rgba(124,58,237,0.2)',
              color: isMonitoring ? '#fca5a5' : '#a78bfa',
              border: `1px solid ${isMonitoring ? 'rgba(239,68,68,0.3)' : 'rgba(124,58,237,0.3)'}`,
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? (
              <><Loader size={15} className="animate-spin" /> Loading AI…</>
            ) : isMonitoring ? (
              <><Square size={15} /> Stop</>
            ) : (
              <><Play size={15} /> Start Monitoring</>
            )}
          </motion.button>
        </div>
      </div>

      {/* Alert status bar */}
      <AnimatePresence>
        {isMonitoring && isReady && alertStatus.kind !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium"
            style={{
              background:
                alertStatus.kind === 'fired'
                  ? 'rgba(239,68,68,0.12)'
                  : alertStatus.kind === 'cooldown'
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(251,191,36,0.1)',
              border: `1px solid ${
                alertStatus.kind === 'fired'
                  ? 'rgba(239,68,68,0.25)'
                  : alertStatus.kind === 'cooldown'
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(251,191,36,0.2)'
              }`,
              color:
                alertStatus.kind === 'fired'
                  ? '#fca5a5'
                  : alertStatus.kind === 'cooldown'
                  ? 'rgba(255,255,255,0.35)'
                  : '#fbbf24',
            }}
          >
            {alertStatus.kind === 'fired' && (
              <>
                <span>🔊</span>
                <span>
                  {personality.name} just spoke — &ldquo;{alertStatus.msg}&rdquo;
                </span>
              </>
            )}
            {alertStatus.kind === 'countdown' && (
              <>
                <span>⚠️</span>
                <span>
                  Poor posture detected — alert fires in{' '}
                  <strong>{alertStatus.secsLeft}s</strong>
                </span>
              </>
            )}
            {alertStatus.kind === 'cooldown' && (
              <>
                <span>⏳</span>
                <span>
                  Alert cooldown — next alert in <strong>{alertStatus.secsLeft}s</strong>
                </span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-5 gap-4 flex-1">
        <div className="col-span-3 flex flex-col gap-3">
          <div
            className="relative rounded-2xl overflow-hidden flex-1 flex items-center justify-center"
            style={{ background: '#0d0d14', border: '1px solid #1e1e2e', minHeight: 320 }}
          >
            {!isMonitoring && !isLoading && (
              <div className="flex flex-col items-center gap-3 text-center px-8">
                <span className="text-4xl">📷</span>
                <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Camera is off</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>Click "Start Monitoring" to begin</p>
              </div>
            )}
            {isLoading && (
              <div className="flex flex-col items-center gap-3">
                <Loader size={28} className="animate-spin" style={{ color: '#7c3aed' }} />
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Loading AI model…</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>Initializing pose detection</p>
              </div>
            )}
            {error && (
              <div className="flex flex-col items-center gap-3 text-center px-8">
                <AlertTriangle size={28} style={{ color: '#f59e0b' }} />
                <p className="text-sm font-medium" style={{ color: '#fbbf24' }}>Camera Error</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{error}</p>
              </div>
            )}
            <video ref={videoRef} autoPlay muted playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ display: isReady ? 'block' : 'none', transform: 'scaleX(-1)' }}
            />
            <canvas ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ display: isReady ? 'block' : 'none', transform: 'scaleX(-1)' }}
            />
            {isReady && (
              <>
                <div
                  className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', color: '#34d399' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </div>
                <div
                  className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', color: personality.color }}
                >
                  {personality.emoji} {personality.name}
                </div>
                {/* Calibrated badge on video */}
                {calibration && (
                  <div
                    className="absolute bottom-10 left-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', color: '#34d399' }}
                  >
                    <Crosshair size={10} />
                    Calibrated
                  </div>
                )}
                {/* Voice mode badge */}
                <div
                  className="absolute bottom-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                  style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', color: 'rgba(255,255,255,0.45)' }}
                >
                  <Volume2 size={10} />
                  {settings.voiceMode === 'elevenlabs' ? 'ElevenLabs AI' : 'Browser TTS'}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="col-span-2 flex flex-col gap-3">
          <div
            className="rounded-2xl p-5 flex flex-col items-center gap-3"
            style={{ background: '#111118', border: '1px solid #1e1e2e' }}
          >
            <ScoreRing score={isMonitoring ? score : 0} label={isMonitoring ? label : 'poor'} size={120} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Posture Score</p>
          </div>

          <div
            className="rounded-2xl p-4 flex flex-col gap-3 flex-1"
            style={{ background: '#111118', border: '1px solid #1e1e2e' }}
          >
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Detected Issues
            </p>
            {!isMonitoring || issues.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <CheckCircle size={22} style={{ color: '#10b981' }} />
                <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {isMonitoring ? 'No issues detected!' : 'Start monitoring to see issues'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {issues.map((issue) => (
                  <div key={issue} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
                  >
                    <AlertTriangle size={12} style={{ color: '#f87171', flexShrink: 0 }} />
                    <span className="text-xs" style={{ color: '#fca5a5' }}>{ISSUE_DESCRIPTIONS[issue]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Calibration panel */}
          {calibration ? (
            <div
              className="rounded-2xl p-4 flex flex-col gap-2"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Crosshair size={11} style={{ color: '#34d399' }} />
                  <p className="text-xs font-medium" style={{ color: '#34d399' }}>Personal Baseline Active</p>
                </div>
                <button
                  onClick={handleClearCalibration}
                  className="p-0.5 rounded"
                  title="Clear calibration"
                  style={{ color: 'rgba(255,255,255,0.2)' }}
                >
                  <X size={12} />
                </button>
              </div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Tuned to your body on {new Date(calibration.capturedAt).toLocaleDateString()}
                {' '}({calibration.sampleCount} frames)
              </p>
            </div>
          ) : (
            <div
              className="rounded-2xl p-4"
              style={{ background: `${personality.color}0d`, border: `1px solid ${personality.color}22` }}
            >
              <p className="text-xs font-medium mb-1" style={{ color: personality.color }}>
                {personality.emoji} {personality.name}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                {isMonitoring && postureResult && postureResult.score >= 75
                  ? personality.goodPostureMessages[0]
                  : personality.badPostureMessages[0]}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Calibration modal */}
      <AnimatePresence>
        {showCalibModal && (
          <CalibrationModal
            onClose={() => setShowCalibModal(false)}
            onCalibrated={handleCalibrated}
            startCalibration={startCalibration}
            isMonitoring={isMonitoring && isReady}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
