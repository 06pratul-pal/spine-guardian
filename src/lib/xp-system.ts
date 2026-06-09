export interface XPData {
  totalXP: number;
  streakDays: number;
  lastActiveDate: string;
  totalSessions: number;
}

const LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 5800, 8000];

export const LEVEL_NAMES = [
  'Beginner',
  'Aware',
  'Mindful',
  'Disciplined',
  'Focused',
  'Balanced',
  'Strong',
  'Elite',
  'Spine Warrior',
  'Posture Master',
  'Legendary Spine',
];

export function calculateLevel(totalXP: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_THRESHOLDS[i]) return i;
  }
  return 0;
}

export function getLevelName(level: number): string {
  return LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length - 1)];
}

export function getLevelProgress(totalXP: number): {
  current: number;
  required: number;
  percentage: number;
} {
  const level = calculateLevel(totalXP);
  const currentThreshold = LEVEL_THRESHOLDS[level] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[level + 1] ?? currentThreshold + 1000;
  const current = totalXP - currentThreshold;
  const required = nextThreshold - currentThreshold;
  return {
    current,
    required,
    percentage: Math.min(100, Math.round((current / required) * 100)),
  };
}

export function calculateXPGain(score: number, durationSeconds: number): number {
  if (score >= 90) return Math.round(durationSeconds * 0.5);
  if (score >= 75) return Math.round(durationSeconds * 0.3);
  if (score >= 60) return Math.round(durationSeconds * 0.1);
  return 0;
}

export function loadXPData(): XPData {
  const saved = localStorage.getItem('sg-xp-data');
  if (saved) {
    try {
      return JSON.parse(saved) as XPData;
    } catch {
      // fall through
    }
  }
  return { totalXP: 0, streakDays: 0, lastActiveDate: '', totalSessions: 0 };
}

export function saveXPData(data: XPData): void {
  localStorage.setItem('sg-xp-data', JSON.stringify(data));
}

export function updateStreak(data: XPData): XPData {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (data.lastActiveDate === today) return data;
  if (data.lastActiveDate === yesterday) {
    return { ...data, streakDays: data.streakDays + 1, lastActiveDate: today };
  }
  return { ...data, streakDays: 1, lastActiveDate: today };
}
