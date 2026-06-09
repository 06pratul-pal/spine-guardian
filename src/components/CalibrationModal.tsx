import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, X, AlertTriangle } from 'lucide-react';
import { computeCalibration, saveCalibration, type CalibrationData } from '../lib/calibration';
import type { Landmark } from '../lib/posture-analyzer';

type Step = 'intro' | 'countdown' | 'sampling' | 'done' | 'error';

interface CalibrationModalProps {
  onClose: () => void;
  onCalibrated: (data: CalibrationData) => void;
  startCalibration: (durationMs: number) => Promise<Landmark[][]>;
  isMonitoring: boolean;
}

const SAMPLE_DURATION = 5000; // ms
const COUNTDOWN_FROM  = 3;

export function CalibrationModal({
  onClose,
  onCalibrated,
  startCalibration,
  isMonitoring,
}: CalibrationModalProps) {
  const [step, setStep]         = useState<Step>('intro');
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult]     = useState<CalibrationData | null>(null);
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTick() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }

  async function handleStart() {
    if (!isMonitoring) return;

    // ── Countdown ────────────────────────────────────────────────────────────
    setStep('countdown');
    setCountdown(COUNTDOWN_FROM);

    await new Promise<void>((resolve) => {
      let c = COUNTDOWN_FROM;
      intervalRef.current = setInterval(() => {
        c--;
        setCountdown(c);
        if (c <= 0) { clearTick(); resolve(); }
      }, 1000);
    });

    // ── Sampling ─────────────────────────────────────────────────────────────
    setStep('sampling');
    setProgress(0);

    const start = Date.now();
    intervalRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / SAMPLE_DURATION) * 100);
      setProgress(pct);
    }, 80);

    let samples: Landmark[][] = [];
    try {
      samples = await startCalibration(SAMPLE_DURATION);
    } catch {
      clearTick();
      setErrorMsg('Camera is not running. Start monitoring first.');
      setStep('error');
      return;
    }
    clearTick();
    setProgress(100);

    // ── Compute ───────────────────────────────────────────────────────────────
    try {
      const data = computeCalibration(samples);
      saveCalibration(data);
      setResult(data);
      onCalibrated(data);
      setStep('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Calibration failed.');
      setStep('error');
    }
  }

  useEffect(() => () => clearTick(), []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.93, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative flex flex-col gap-5 p-7 rounded-3xl w-full max-w-md mx-4"
        style={{ background: '#111118', border: '1px solid #1e1e2e' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl"
          style={{ color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.05)' }}
        >
          <X size={14} />
        </button>

        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-5"
            >
              <div>
                <div className="text-2xl mb-2">🧘</div>
                <h2 className="text-base font-bold" style={{ color: '#e4e4f0' }}>Personal Posture Calibration</h2>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  The app will learn YOUR good posture — your body shape, camera angle, and sitting
                  position — so alerts are tuned specifically to you, not generic defaults.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {[
                  { n: '1', text: 'Sit exactly how you WANT to sit when working' },
                  { n: '2', text: 'Back straight, shoulders relaxed, head level' },
                  { n: '3', text: 'Hold still for 5 seconds while we measure' },
                ].map((s) => (
                  <div key={s.n} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.15)' }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: 'rgba(124,58,237,0.25)', color: '#a78bfa' }}>
                      {s.n}
                    </span>
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{s.text}</p>
                  </div>
                ))}
              </div>

              {!isMonitoring && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <AlertTriangle size={13} style={{ color: '#fbbf24', flexShrink: 0 }} />
                  <p className="text-xs" style={{ color: '#fde68a' }}>
                    Start monitoring first so the camera is active.
                  </p>
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleStart}
                disabled={!isMonitoring}
                className="py-3 rounded-2xl text-sm font-bold"
                style={{
                  background: isMonitoring ? 'rgba(124,58,237,0.22)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isMonitoring ? 'rgba(124,58,237,0.45)' : 'rgba(255,255,255,0.08)'}`,
                  color: isMonitoring ? '#a78bfa' : 'rgba(255,255,255,0.25)',
                }}
              >
                {isMonitoring ? '🚀 Start Calibration' : 'Start monitoring first'}
              </motion.button>
            </motion.div>
          )}

          {step === 'countdown' && (
            <motion.div key="cd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-6"
            >
              <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Sit up straight and hold still…
              </p>
              <motion.div
                key={countdown}
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-7xl font-black"
                style={{ color: '#a78bfa', lineHeight: 1 }}
              >
                {countdown > 0 ? countdown : '🚀'}
              </motion.div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Starting measurement…
              </p>
            </motion.div>
          )}

          {step === 'sampling' && (
            <motion.div key="sampling" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5 py-4"
            >
              <div className="text-3xl">📐</div>
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: '#e4e4f0' }}>Measuring your posture…</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Keep holding still</p>
              </div>
              {/* Progress bar */}
              <div className="w-full rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.07)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.1, ease: 'linear' }}
                />
              </div>
              <p className="text-xs tabular-nums" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {Math.round(progress)}%
              </p>
            </motion.div>
          )}

          {step === 'done' && result && (
            <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-5"
            >
              <div className="flex flex-col items-center gap-2 py-2">
                <CheckCircle size={36} style={{ color: '#10b981' }} />
                <h2 className="text-base font-bold" style={{ color: '#e4e4f0' }}>Calibration Complete!</h2>
                <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Your personal posture baseline has been saved. Detection is now tuned to you.
                </p>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Frames sampled', value: result.sampleCount },
                  { label: 'Torso ratio', value: result.torsoRatio.toFixed(2) },
                  { label: 'Ear-shoulder gap', value: result.earRatio.toFixed(2) },
                  { label: 'Shoulder width', value: `${(result.shoulderWidth * 100).toFixed(0)}%` },
                ].map((m) => (
                  <div key={m.label} className="px-3 py-2.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{m.label}</p>
                    <p className="text-sm font-bold mt-0.5" style={{ color: '#a78bfa' }}>{m.value}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Repeat calibration any time from Settings if your seating changes.
              </p>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="py-3 rounded-2xl text-sm font-bold"
                style={{
                  background: 'rgba(16,185,129,0.12)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  color: '#34d399',
                }}
              >
                ✓ Done
              </motion.button>
            </motion.div>
          )}

          {step === 'error' && (
            <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-4"
            >
              <AlertTriangle size={32} style={{ color: '#f59e0b' }} />
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: '#e4e4f0' }}>Calibration failed</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{errorMsg}</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setStep('intro')}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.6)',
                }}
              >
                Try Again
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
