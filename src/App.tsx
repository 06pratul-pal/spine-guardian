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
import { getSession, supabaseConfigured, supabase } from './lib/supabase';
import { track, flushNow } from './lib/analytics';

// ── Sentry renderer — safe lazy init (won't crash if not in Electron) ─────────
const SENTRY_DSN = (import.meta as any).env?.VITE_SENTRY_DSN as string | undefined;
if (SENTRY_DSN && typeof window !== 'undefined' && (window as any).electronAPI) {
  // Only load Sentry in packaged Electron, not in browser/dev
  setTimeout(() => {
    import('@sentry/electron/renderer').then((Sentry) => {
      Sentry.init({ dsn: SENTRY_DSN });
    }).catch(() => { /* ignore */ });
  }, 2000);
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
  const [authChecked,  setAuthChecked]  = useState(!supabaseConfigured); // skip check if no supabase
  const [showUpgrade,  setShowUpgrade]  = useState(false);
  const [userEmail,    setUserEmail]    = useState('');

  // Revalidate session on mount — in case token expired
  useEffect(() => {
    if (!supabaseConfigured) {
      setAuthChecked(true);
      return;
    }
    getSession().then(async (session) => {
      if (session) {
        setAuthed(true);
        setUserEmail(session.user?.email ?? '');
        localStorage.setItem('sg-authed', '1');

        // Fetch user plan and set in store
        const { getCurrentUser } = await import('./lib/supabase');
        const user = await getCurrentUser();
        if (user) {
          useAppStore.getState().setUserPlan(user.plan);
        }

        // Pull cloud sync data — restores XP/streaks on reinstall
        useAppStore.getState().syncFromCloud();
      } else {
        setAuthed(false);
        localStorage.removeItem('sg-authed');
      }
      setAuthChecked(true);
    }).catch(() => {
      setAuthChecked(true);
    });
  }, []);

  // Handle deep link — email confirmation via spine-guardian:// URL
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.onDeepLink) return;
    api.onDeepLink(async (url: string) => {
      // spine-guardian://auth#access_token=xxx&type=signup
      if (url.includes('access_token') || url.includes('type=signup')) {
        // Extract tokens from URL and set session
        const hash = url.split('#')[1] ?? url.split('?')[1] ?? '';
        const params = new URLSearchParams(hash);
        const accessToken  = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken && supabase) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          handleAuth();
        }
      }
    });
  }, []);

  // Track page views
  useEffect(() => {
    void track('page_viewed', { page });
  }, [page]);

  // Flush analytics before app closes
  useEffect(() => {
    window.addEventListener('beforeunload', flushNow);
    return () => window.removeEventListener('beforeunload', flushNow);
  }, []);

  function handleAuth() {
    localStorage.setItem('sg-authed', '1');
    setAuthed(true);
    void track('app_opened', { source: 'sign_in' });
  }

  function handleSkipAuth() {
    localStorage.setItem('sg-authed', '1');
    setAuthed(true);
    void track('app_opened', { source: 'skip_auth' });
  }

  // Don't render anything until auth check is complete
  if (!authChecked) return null;
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
      <Layout onUpgrade={() => { setShowUpgrade(true); void track('upgrade_modal_opened'); }}>
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
