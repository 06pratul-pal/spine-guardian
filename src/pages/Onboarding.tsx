import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Check } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PERSONALITY_LIST } from '../lib/personalities';

const STEPS = [
  {
    id: 'welcome',
    emoji: '🦴',
    title: 'Welcome to Spine Guardian AI',
    subtitle: 'Your AI posture coach that actually talks back.',
  },
  {
    id: 'how',
    emoji: '📷',
    title: 'How it works',
    subtitle: 'Three simple things happen every session.',
  },
  {
    id: 'personality',
    emoji: '🎭',
    title: 'Choose your personality',
    subtitle: 'Pick who scolds you when you slouch.',
  },
  {
    id: 'ready',
    emoji: '🚀',
    title: "You're all set!",
    subtitle: 'Head to Live Monitor to start your first session.',
  },
];

const HOW_ITEMS = [
  {
    icon: '📷',
    title: 'Webcam watches you',
    desc: 'MediaPipe AI analyzes your posture in real time, 100% on your device.',
  },
  {
    icon: '🔊',
    title: 'Voice alerts when you slouch',
    desc: "Your chosen personality speaks up after you've been slouching too long.",
  },
  {
    icon: '⚡',
    title: 'Earn XP for good posture',
    desc: 'Every second of upright sitting earns XP. Level up and unlock achievements.',
  },
];

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const { settings, updateSettings, setPage } = useAppStore();

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      localStorage.setItem('sg-onboarded', '1');
      onComplete();
      setPage('monitor');
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: '#0a0a0f' }}
    >
      {/* Progress dots */}
      <div className="absolute top-8 flex gap-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === step ? 24 : 8,
              height: 8,
              background: i <= step ? '#7c3aed' : 'rgba(255,255,255,0.1)',
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="flex flex-col items-center gap-6 px-8 w-full max-w-lg"
        >
          {/* Emoji */}
          <div
            className="flex items-center justify-center rounded-3xl text-5xl"
            style={{
              width: 96,
              height: 96,
              background: 'rgba(124,58,237,0.12)',
              border: '1px solid rgba(124,58,237,0.25)',
            }}
          >
            {current.emoji}
          </div>

          {/* Title + subtitle */}
          <div className="text-center">
            <h1 className="text-2xl font-bold" style={{ color: '#e4e4f0' }}>
              {current.title}
            </h1>
            <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {current.subtitle}
            </p>
          </div>

          {/* Step content */}
          {current.id === 'welcome' && (
            <div className="grid grid-cols-1 gap-3 w-full">
              {[
                { icon: '🧠', text: 'AI posture detection via your webcam — no cloud, no uploads' },
                { icon: '🔊', text: '8 unique personalities that actually scold you with personality' },
                { icon: '📊', text: 'Analytics, focus sessions, streaks, achievements — all built in' },
              ].map((item) => (
                <div
                  key={item.text}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: '#111118', border: '1px solid #1e1e2e' }}
                >
                  <span className="text-xl">{item.icon}</span>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>{item.text}</p>
                </div>
              ))}
            </div>
          )}

          {current.id === 'how' && (
            <div className="flex flex-col gap-3 w-full">
              {HOW_ITEMS.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 px-4 py-4 rounded-xl"
                  style={{ background: '#111118', border: '1px solid #1e1e2e' }}
                >
                  <span className="text-2xl mt-0.5">{item.icon}</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#e4e4f0' }}>{item.title}</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {current.id === 'personality' && (
            <div className="grid grid-cols-2 gap-2 w-full">
              {PERSONALITY_LIST.map((p) => {
                const isActive = settings.personalityId === p.id;
                return (
                  <motion.button
                    key={p.id}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => updateSettings({ personalityId: p.id })}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-left"
                    style={{
                      background: isActive ? `${p.color}15` : '#111118',
                      border: isActive ? `1px solid ${p.color}40` : '1px solid #1e1e2e',
                    }}
                  >
                    <span className="text-xl">{p.emoji}</span>
                    <div>
                      <p
                        className="text-xs font-semibold"
                        style={{ color: isActive ? p.color : '#e4e4f0' }}
                      >
                        {p.name}
                      </p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
                        {p.tagline}
                      </p>
                    </div>
                    {isActive && (
                      <div className="ml-auto">
                        <Check size={14} style={{ color: p.color }} />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}

          {current.id === 'ready' && (
            <div className="flex flex-col gap-3 w-full">
              {[
                '🔒 100% local — nothing leaves your computer',
                '🔇 Works fully offline after first AI model download',
                '⚙️ All settings adjustable anytime in Settings',
              ].map((tip) => (
                <div
                  key={tip}
                  className="px-4 py-3 rounded-xl text-sm"
                  style={{
                    background: 'rgba(124,58,237,0.08)',
                    border: '1px solid rgba(124,58,237,0.18)',
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  {tip}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Next button */}
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleNext}
        className="absolute bottom-10 flex items-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold"
        style={{
          background: 'rgba(124,58,237,0.22)',
          border: '1px solid rgba(124,58,237,0.45)',
          color: '#a78bfa',
        }}
      >
        {isLast ? '🚀 Start Monitoring' : 'Continue'}
        {!isLast && <ChevronRight size={16} />}
      </motion.button>
    </div>
  );
}
