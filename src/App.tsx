import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from './store/useAppStore';
import { Layout } from './components/Layout';
import { ViolationOverlay } from './components/ViolationOverlay';
import { AchievementToast } from './components/AchievementToast';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { LiveMonitor } from './pages/LiveMonitor';
import { Analytics } from './pages/Analytics';
import { FocusSession } from './pages/FocusSession';
import { Settings } from './pages/Settings';

const PAGE_VARIANTS = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

function hasOnboarded(): boolean {
  return localStorage.getItem('sg-onboarded') === '1';
}

export default function App() {
  const { page } = useAppStore();
  const [onboarded, setOnboarded] = useState(hasOnboarded);

  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />;
  }

  return (
    <>
      <Layout>
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
            {page === 'dashboard' && <Dashboard />}
            {page === 'monitor' && <LiveMonitor />}
            {page === 'analytics' && <Analytics />}
            {page === 'focus' && <FocusSession />}
            {page === 'settings' && <Settings />}
          </motion.div>
        </AnimatePresence>
      </Layout>

      <ViolationOverlay />
      <AchievementToast />
    </>
  );
}
