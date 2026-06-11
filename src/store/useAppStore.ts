import { create } from 'zustand';
import type { PersonalityId } from '../lib/personalities';
import type { PostureResult } from '../lib/posture-analyzer';
import type { Achievement } from '../lib/achievements';
import { loadCalibration, type CalibrationData } from '../lib/calibration';
import {
  loadXPData,
  saveXPData,
  updateStreak,
  calculateLevel,
  getLevelName,
  getLevelProgress,
  calculateXPGain,
} from '../lib/xp-system';
import { pushCloudSync, pullCloudSync, supabaseConfigured } from '../lib/supabase';

export type Page = 'dashboard' | 'monitor' | 'analytics' | 'focus' | 'settings';

export type VoiceMode = 'browser' | 'edge' | 'elevenlabs';

export interface AppSettings {
  personalityId: PersonalityId;
  sensitivity: number;
  volume: number;
  cooldownMinutes: number;
  alertDelaySeconds: number;
  voiceMode: VoiceMode;
  elevenLabsApiKey: string;
  elevenLabsVoiceId: string;
  openAiApiKey: string;
  useAiMessages: boolean;
  edgeTtsVoice: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  personalityId: 'bestfriend',
  sensitivity: 1.0,
  volume: 0.8,
  cooldownMinutes: 0.5,
  alertDelaySeconds: 5,
  voiceMode: 'edge',
  elevenLabsApiKey: '',
  elevenLabsVoiceId: 'cgSgspJ2msm6clMCkdW9',
  openAiApiKey: '',
  useAiMessages: false,
  edgeTtsVoice: 'en-US-JennyNeural',
};

function loadSettings(): AppSettings {
  const saved = localStorage.getItem('sg-settings');
  if (saved) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // fall through
    }
  }
  return DEFAULT_SETTINGS;
}

const xpData = loadXPData();

interface AppState {
  page: Page;
  settings: AppSettings;
  postureResult: PostureResult | null;
  isMonitoring: boolean;
  isViolationVisible: boolean;
  violationMessage: string;
  totalXP: number;
  level: number;
  levelName: string;
  xpProgress: { current: number; required: number; percentage: number };
  streakDays: number;
  sessionGoodSeconds: number;
  sessionBadSeconds: number;
  sessionActive: boolean;
  achievementQueue: Achievement[];
  calibration: CalibrationData | null;
  userPlan: 'free' | 'pro';          // ← pro gating
  isPro: boolean;                     // ← convenience getter

  setPage: (page: Page) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  setPostureResult: (result: PostureResult) => void;
  setIsMonitoring: (v: boolean) => void;
  showViolation: (message: string) => void;
  hideViolation: () => void;
  addXP: (amount: number) => void;
  startSession: () => void;
  endSession: () => void;
  tickGoodSecond: (score: number) => void;
  tickBadSecond: () => void;
  enqueueAchievement: (a: Achievement) => void;
  dequeueAchievement: () => void;
  setCalibration: (data: CalibrationData | null) => void;
  setUserPlan: (plan: 'free' | 'pro') => void;
  syncFromCloud: () => Promise<void>;  // pull from Supabase on login
  syncToCloud: () => Promise<void>;    // push to Supabase after changes
}

export const useAppStore = create<AppState>((set, get) => ({
  page: 'dashboard',
  settings: loadSettings(),
  postureResult: null,
  isMonitoring: false,
  isViolationVisible: false,
  violationMessage: '',
  totalXP: xpData.totalXP,
  level: calculateLevel(xpData.totalXP),
  levelName: getLevelName(calculateLevel(xpData.totalXP)),
  xpProgress: getLevelProgress(xpData.totalXP),
  streakDays: xpData.streakDays,
  sessionGoodSeconds: 0,
  sessionBadSeconds: 0,
  sessionActive: false,
  achievementQueue: [],
  calibration: loadCalibration(),
  userPlan: 'free',
  isPro: false,

  setPage: (page) => set({ page }),

  updateSettings: (partial) => {
    const newSettings = { ...get().settings, ...partial };
    localStorage.setItem('sg-settings', JSON.stringify(newSettings));
    set({ settings: newSettings });
    // Track personality changes
    if (partial.personalityId && partial.personalityId !== get().settings.personalityId) {
      import('../lib/analytics').then(({ track }) => {
        void track('personality_changed', { from: get().settings.personalityId, to: partial.personalityId });
      });
    }
  },

  setPostureResult: (result) => set({ postureResult: result }),
  setIsMonitoring: (v) => set({ isMonitoring: v }),
  showViolation: (message) => set({ isViolationVisible: true, violationMessage: message }),
  hideViolation: () => set({ isViolationVisible: false, violationMessage: '' }),

  setUserPlan: (plan) => set({ userPlan: plan, isPro: plan === 'pro' }),

  addXP: (amount) => {
    if (amount <= 0) return;
    const current = get();
    const totalXP = current.totalXP + amount;
    const level = calculateLevel(totalXP);
    const levelName = getLevelName(level);
    const xpProgress = getLevelProgress(totalXP);
    const data = loadXPData();
    const updated = updateStreak({ ...data, totalXP });
    saveXPData(updated);
    set({ totalXP, level, levelName, xpProgress, streakDays: updated.streakDays });
  },

  startSession: () =>
    set({ sessionActive: true, sessionGoodSeconds: 0, sessionBadSeconds: 0 }),

  endSession: () => set({ sessionActive: false }),

  tickGoodSecond: (score: number) => {
    const xpGain = calculateXPGain(score, 1);
    get().addXP(xpGain);
    set((s) => ({ sessionGoodSeconds: s.sessionGoodSeconds + 1 }));
  },

  tickBadSecond: () => set((s) => ({ sessionBadSeconds: s.sessionBadSeconds + 1 })),

  enqueueAchievement: (a) => {
    set((s) => ({ achievementQueue: [...s.achievementQueue, a] }));
    import('../lib/analytics').then(({ track }) => {
      void track('achievement_unlocked', { achievement_id: a.id, achievement_name: a.name });
    });
  },

  dequeueAchievement: () =>
    set((s) => ({ achievementQueue: s.achievementQueue.slice(1) })),

  setCalibration: (data) => set({ calibration: data }),

  // ── Cloud sync ──────────────────────────────────────────────────────────────

  syncFromCloud: async () => {
    if (!supabaseConfigured) return;
    try {
      const cloud = await pullCloudSync();
      if (!cloud) return;

      // Use cloud data if it has more XP than local (cloud wins on reinstall)
      const localXP = get().totalXP;
      const cloudXP = cloud.total_xp;

      if (cloudXP > localXP) {
        const level    = calculateLevel(cloudXP);
        const levelName = getLevelName(level);
        const xpProgress = getLevelProgress(cloudXP);
        const xpData = {
          totalXP: cloudXP,
          streakDays: cloud.streak_days,
          lastActiveDate: cloud.last_active_date,
          totalSessions: 0,
        };
        saveXPData(xpData);
        set({ totalXP: cloudXP, level, levelName, xpProgress, streakDays: cloud.streak_days });
      }

      // Restore settings from cloud if local is default
      if (cloud.settings_json && cloud.settings_json !== '{}') {
        try {
          const cloudSettings = JSON.parse(cloud.settings_json);
          const merged = { ...get().settings, ...cloudSettings };
          localStorage.setItem('sg-settings', JSON.stringify(merged));
          set({ settings: merged });
        } catch { /* ignore parse errors */ }
      }

      // Restore achievements
      if (cloud.unlocked_achievements && cloud.unlocked_achievements !== '[]') {
        try {
          localStorage.setItem('sg-achievements', cloud.unlocked_achievements);
        } catch { /* ignore */ }
      }
    } catch { /* network error — silently ignore, local data is fine */ }
  },

  syncToCloud: async () => {
    if (!supabaseConfigured) return;
    try {
      const state = get();
      const xpData = loadXPData();
      await pushCloudSync({
        total_xp:              state.totalXP,
        streak_days:           state.streakDays,
        last_active_date:      xpData.lastActiveDate,
        settings_json:         JSON.stringify(state.settings),
        unlocked_achievements: localStorage.getItem('sg-achievements') ?? '[]',
      });
    } catch { /* silently ignore — local save already happened */ }
  },
}));
