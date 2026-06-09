import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';

export function ViolationOverlay() {
  const { isViolationVisible, violationMessage, hideViolation } = useAppStore();
  const [showBorder, setShowBorder] = useState(false);

  useEffect(() => {
    if (!isViolationVisible) return;
    setShowBorder(true);
    const borderTimer = setTimeout(() => setShowBorder(false), 1500);
    const dismissTimer = setTimeout(() => hideViolation(), 7000);
    return () => { clearTimeout(borderTimer); clearTimeout(dismissTimer); };
  }, [isViolationVisible, hideViolation]);

  return (
    <>
      {/* Screen border flash */}
      <AnimatePresence>
        {showBorder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0, 1, 0, 1, 0] }}
            transition={{ duration: 1.4, times: [0, 0.1, 0.25, 0.4, 0.55, 0.7, 1] }}
            className="fixed inset-0 z-40 pointer-events-none"
            style={{ boxShadow: 'inset 0 0 0 4px rgba(239,68,68,0.8)' }}
          />
        )}
      </AnimatePresence>

      {/* Main overlay */}
      <AnimatePresence>
        {isViolationVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)' }}
            onClick={hideViolation}
          >
            {/* Radial red glow background */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(239,68,68,0.12) 0%, transparent 70%)' }}
            />

            <motion.div
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="relative flex flex-col items-center gap-7 px-14 py-12 rounded-3xl text-center"
              style={{
                background: 'linear-gradient(135deg,rgba(239,68,68,0.1),rgba(220,38,38,0.06))',
                border: '1px solid rgba(239,68,68,0.35)',
                boxShadow: '0 0 60px rgba(239,68,68,0.15), 0 24px 64px rgba(0,0,0,0.6)',
                maxWidth: 540,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Icon */}
              <motion.div
                animate={{ scale: [1, 1.12, 1], rotate: [0, -3, 3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{ fontSize: 64, lineHeight: 1 }}
              >
                🚨
              </motion.div>

              {/* Label */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-px flex-1" style={{ background: 'rgba(239,68,68,0.3)' }} />
                  <p className="text-xs font-bold uppercase tracking-[0.35em]" style={{ color: '#ef4444' }}>
                    Posture Violation
                  </p>
                  <div className="h-px flex-1" style={{ background: 'rgba(239,68,68,0.3)' }} />
                </div>
                <motion.h2
                  className="text-2xl font-bold leading-snug"
                  style={{ color: '#fef2f2', textShadow: '0 0 30px rgba(239,68,68,0.3)' }}
                >
                  {violationMessage}
                </motion.h2>
              </div>

              {/* Dismiss button */}
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(239,68,68,0.3)' }}
                whileTap={{ scale: 0.96 }}
                onClick={hideViolation}
                className="px-8 py-3 rounded-2xl text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg,rgba(239,68,68,0.2),rgba(220,38,38,0.15))',
                  color: '#fca5a5',
                  border: '1px solid rgba(239,68,68,0.3)',
                }}
              >
                Sitting up now — dismiss
              </motion.button>

              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Tap anywhere or wait 7 seconds to dismiss
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
