import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';

export function AchievementToast() {
  const { achievementQueue, dequeueAchievement } = useAppStore();
  const [visible, setVisible] = useState(false);
  const current = achievementQueue[0];

  useEffect(() => {
    if (!current) { setVisible(false); return; }
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(dequeueAchievement, 400);
    }, 4500);
    return () => clearTimeout(t);
  }, [current, dequeueAchievement]);

  return (
    <AnimatePresence>
      {visible && current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 50, scale: 0.88, x: 10 }}
          animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
          exit={{ opacity: 0, y: 20, scale: 0.93 }}
          transition={{ type: 'spring', damping: 20, stiffness: 320 }}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-4 px-5 py-4 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg,#13131f,#0f0f1a)',
            border: `1px solid ${current.color}35`,
            boxShadow: `0 0 40px ${current.color}18, 0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)`,
            minWidth: 270,
            maxWidth: 340,
          }}
        >
          {/* Top shimmer line */}
          <div className="absolute top-0 left-6 right-6 h-px rounded-full"
            style={{ background: `linear-gradient(90deg, transparent, ${current.color}50, transparent)` }}
          />

          {/* Pulse dot */}
          <div className="absolute top-3 right-3 w-2 h-2 rounded-full animate-pulse"
            style={{ background: current.color, boxShadow: `0 0 8px ${current.color}` }}
          />

          {/* Badge */}
          <motion.div
            animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-center justify-center rounded-2xl text-2xl flex-shrink-0"
            style={{
              width: 50, height: 50,
              background: `${current.color}15`,
              border: `1px solid ${current.color}30`,
              boxShadow: `0 0 20px ${current.color}20`,
            }}
          >
            {current.emoji}
          </motion.div>

          {/* Text */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.25em]" style={{ color: current.color }}>
              Achievement Unlocked
            </p>
            <p className="text-sm font-bold truncate" style={{ color: '#f0f0fa' }}>
              {current.name}
            </p>
            <p className="text-xs leading-snug" style={{ color: 'rgba(255,255,255,0.38)' }}>
              {current.description}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
