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

  setPage: (page) => set({ page }),

  updateSettings: (partial) => {
    const newSettings = { ...get().settings, ...partial };
    localStorage.setItem('sg-settings', JSON.stringify(newSettings));
    set({ settings: newSettings });
  },

  setPostureResult: (result) => set({ postureResult: result }),

  setIsMonitoring: (v) => set({ isMonitoring: v }),

  showViolation: (message) => set({ isViolationVisible: true, violationMessage: message }),

  hideViolation: () => set({ isViolationVisible: false, violationMessage: '' }),

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

  enqueueAchievement: (a) =>
    set((s) => ({ achievementQueue: [...s.achievementQueue, a] })),

  dequeueAchievement: () =>
    set((s) => ({ achievementQueue: s.achievementQueue.slice(1) })),

  setCalibration: (data) => set({ calibration: data }),
}));
