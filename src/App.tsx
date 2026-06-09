import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from './store/useAppStore';
import { Layout } from './components/Layout';
import { ViolationOverlay } from './components/ViolationOverlay';
import { AchievementToast } from './components/AchievementToast';
import { Onboarding } from './pages/Onboarding';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { LiveMonitor } from './pages/LiveMonitor';
import { Analytics } from './pages/Analytics';
import { FocusSession } from './pages/FocusSession';
import { Settings } from './pages/Settings';
import { Upgrade } from './pages/Upgrade';
import { getSession, supabaseConfigured } from './lib/supabase';

// ── Sentry renderer — safe lazy init (won't crash if not in Electron) ─────────
const SENTRY_DSN = (import.meta as any).env?.VITE_SENTRY_DSN as string | undefined;
if (SENTRY_DSN && typeof window !== 'undefined') {
  // Dynamically import so it doesn't break Vite dev server
  import('@sentry/electron/renderer').then((Sentry) => {
    Sentry.init({ dsn: SENTRY_DSN });
  }).catch(() => { /* not in Electron, ignore */ });
}

const PAGE_VARIANTS = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -4 },
};

function hasOnboarded(): boolean {
  return localStorage.getItem('sg-onboarded') === '1';
}
function hasAuthed(): boolean {
  return localStorage.getItem('sg-authed') === '1';
}

export default function App() {
  const { page } = useAppStore();
  const [onboarded,    setOnboarded]    = useState(hasOnboarded);
  const [authed,       setAuthed]       = useState(hasAuthed);
  const [showUpgrade,  setShowUpgrade]  = useState(false);
  const [userEmail,    setUserEmail]    = useState('');

  // Revalidate session on mount — in case token expired
  useEffect(() => {
    if (!supabaseConfigured) return;
    getSession().then((session) => {
      if (session) {
        setAuthed(true);
        setUserEmail(session.user?.email ?? '');
        localStorage.setItem('sg-authed', '1');
      } else {
        setAuthed(false);
        localStorage.removeItem('sg-authed');
      }
    });
  }, []);

  function handleAuth() {
    localStorage.setItem('sg-authed', '1');
    setAuthed(true);
  }

  function handleSkipAuth() {
    // Allow using the app without an account (free tier, local only)
    localStorage.setItem('sg-authed', '1');
    setAuthed(true);
  }

  // Step 1: Onboarding
  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />;
  }

  // Step 2: Auth (only shown once — skip goes straight through)
  if (!authed) {
    return <Auth onAuth={handleAuth} onSkip={handleSkipAuth} />;
  }

  // Step 3: Main app
  return (
    <>
      <Layout onUpgrade={() => setShowUpgrade(true)}>
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            variants={PAGE_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="h-full"
          >
            {page === 'dashboard' && <Dashboard onUpgrade={() => setShowUpgrade(true)} />}
            {page === 'monitor'   && <LiveMonitor />}
            {page === 'analytics' && <Analytics />}
            {page === 'focus'     && <FocusSession />}
            {page === 'settings'  && <Settings onUpgrade={() => setShowUpgrade(true)} />}
          </motion.div>
        </AnimatePresence>
      </Layout>

      <ViolationOverlay />
      <AchievementToast />

      {/* Upgrade modal */}
      <AnimatePresence>
        {showUpgrade && (
          <Upgrade onClose={() => setShowUpgrade(false)} userEmail={userEmail} />
        )}
      </AnimatePresence>
    </>
  );
}
