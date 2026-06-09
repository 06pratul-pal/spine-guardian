import { motion } from 'framer-motion';
import {
  LayoutDashboard, Camera, BarChart2,
  Timer, Settings, Minimize2, type LucideIcon,
} from 'lucide-react';
import { useAppStore, type Page } from '../store/useAppStore';

declare global {
  interface Window {
    electronAPI?: {
      minimizeToTray: () => void;
      showWindow: () => void;
      platform: string;
      showTrayNotification: (title: string, content: string) => Promise<void>;
      getLaunchOnStartup: () => Promise<boolean>;
      setLaunchOnStartup: (enable: boolean) => Promise<void>;
      elevenLabsSpeak: (text: string, voiceId: string, apiKey: string) => Promise<{ ok: true; base64: string } | { ok: false; error: string }>;
      elevenLabsPing: (apiKey: string) => Promise<{ ok: boolean; status: number; body: string }>;
      edgeTtsSpeak: (text: string, voice: string, rate: string, pitch: string) => Promise<{ ok: true; base64: string } | { ok: false; error: string }>;
      openAiGenerateMessage: (apiKey: string, personalityName: string, personalityDescription: string, score: number, issues: string[], badSeconds: number, isViolation: boolean) => Promise<{ ok: true; message: string } | { ok: false; error: string }>;
    };
  }
}

interface NavItem { id: Page; icon: LucideIcon; label: string; }

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'monitor',   icon: Camera,          label: 'Live Monitor' },
  { id: 'analytics', icon: BarChart2,       label: 'Analytics' },
  { id: 'focus',     icon: Timer,           label: 'Focus Session' },
  { id: 'settings',  icon: Settings,        label: 'Settings' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { page, setPage, isMonitoring, postureResult } = useAppStore();
  const score = postureResult?.score ?? 0;

  // Score colour for sidebar monitoring dot
  const dotColor =
    !isMonitoring         ? '#6b7280'
    : score >= 85         ? '#10b981'
    : score >= 70         ? '#f59e0b'
    :                       '#ef4444';

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: '#07070d' }}>

      {/* Sidebar */}
      <aside
        className="sg-sidebar flex flex-col items-center py-4 gap-1.5 flex-shrink-0"
        style={{ width: 64 }}
      >
        {/* Logo */}
        <div className="mb-3 flex items-center justify-center w-10 h-10 rounded-2xl"
          style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.3),rgba(109,40,217,0.15))', border: '1px solid rgba(124,58,237,0.3)' }}
        >
          <span className="text-lg">🦴</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 flex-1 w-full px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = page === item.id;
            return (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.93 }}
                onClick={() => setPage(item.id)}
                className="relative flex items-center justify-center rounded-xl"
                style={{
                  width: '100%', height: 44,
                  background: isActive
                    ? 'linear-gradient(135deg,rgba(124,58,237,0.22),rgba(109,40,217,0.14))'
                    : 'transparent',
                  color: isActive ? '#c4b5fd' : 'rgba(255,255,255,0.25)',
                  border: isActive ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
                  boxShadow: isActive ? '0 0 16px rgba(124,58,237,0.12)' : 'none',
                }}
                title={item.label}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                    style={{ width: 3, height: 20, background: 'linear-gradient(180deg,#a78bfa,#7c3aed)' }}
                    transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                  />
                )}
                <Icon size={17} />

                {/* Live monitoring dot on Camera icon */}
                {item.id === 'monitor' && (
                  <span
                    className="absolute top-2 right-2 w-2 h-2 rounded-full"
                    style={{
                      background: dotColor,
                      boxShadow: isMonitoring ? `0 0 6px ${dotColor}` : 'none',
                    }}
                  />
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Monitoring status pill */}
        {isMonitoring && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-0.5 mb-1"
          >
            <div
              className="sg-monitoring-dot w-2 h-2 rounded-full"
              style={{ background: dotColor }}
            />
            <span className="text-center leading-none" style={{ fontSize: 8, color: dotColor, fontWeight: 700 }}>
              {score}
            </span>
          </motion.div>
        )}

        {/* Minimize to tray */}
        {window.electronAPI && (
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => window.electronAPI?.minimizeToTray()}
            className="flex items-center justify-center rounded-xl mb-1"
            style={{ width: 40, height: 40, color: 'rgba(255,255,255,0.15)' }}
            title="Minimize to tray"
          >
            <Minimize2 size={15} />
          </motion.button>
        )}
      </aside>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
