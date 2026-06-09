import { getAllSessions } from './database';

const STORAGE_KEY = 'sg-achievements';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  check: (stats: AchievementStats) => boolean;
}

export interface AchievementStats {
  totalSessions: number;
  totalFocusSessions: number;
  totalMonitoringSeconds: number;
  streakDays: number;
  totalXP: number;
  level: number;
  lastSessionSlouchCount: number;
  lastSessionAvgScore: number;
  lastSessionType: 'monitoring' | 'pomodoro' | 'deep_work' | 'custom';
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_session',
    name: 'First Steps',
    description: 'Complete your first monitoring session',
    emoji: '🎯',
    color: '#60a5fa',
    check: (s) => s.totalSessions >= 1,
  },
  {
    id: 'no_slouch',
    name: 'No Slouch',
    description: 'Complete a session with zero violations',
    emoji: '🌟',
    color: '#10b981',
    check: (s) => s.totalSessions >= 1 && s.lastSessionSlouchCount === 0,
  },
  {
    id: 'week_warrior',
    name: 'Week Warrior',
    description: '7-day monitoring streak',
    emoji: '🔥',
    color: '#f97316',
    check: (s) => s.streakDays >= 7,
  },
  {
    id: 'xp_hunter',
    name: 'XP Hunter',
    description: 'Earn 1,000 total XP',
    emoji: '⚡',
    color: '#a78bfa',
    check: (s) => s.totalXP >= 1000,
  },
  {
    id: 'spine_master',
    name: 'Spine Master',
    description: 'Reach level 5',
    emoji: '💎',
    color: '#34d399',
    check: (s) => s.level >= 5,
  },
  {
    id: 'focus_champion',
    name: 'Focus Champion',
    description: 'Complete 5 focus sessions',
    emoji: '🍅',
    color: '#f472b6',
    check: (s) => s.totalFocusSessions >= 5,
  },
  {
    id: 'zen_master',
    name: 'Zen Master',
    description: 'Average 90+ posture score in a focus session',
    emoji: '🧘',
    color: '#fbbf24',
    check: (s) => s.lastSessionType !== 'monitoring' && s.lastSessionAvgScore >= 90,
  },
  {
    id: 'century_club',
    name: 'Century Club',
    description: 'Accumulate 10 hours of monitoring',
    emoji: '🏆',
    color: '#f59e0b',
    check: (s) => s.totalMonitoringSeconds >= 36_000,
  },
];

export function getUnlockedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function saveUnlockedIds(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function checkNewAchievements(stats: AchievementStats): Achievement[] {
  const unlockedSet = new Set(getUnlockedIds());
  const newlyUnlocked: Achievement[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (!unlockedSet.has(achievement.id) && achievement.check(stats)) {
      newlyUnlocked.push(achievement);
      unlockedSet.add(achievement.id);
    }
  }

  if (newlyUnlocked.length > 0) {
    saveUnlockedIds([...unlockedSet]);
  }

  return newlyUnlocked;
}

export async function buildAndCheckAchievements(params: {
  streakDays: number;
  totalXP: number;
  level: number;
  lastSessionSlouchCount: number;
  lastSessionAvgScore: number;
  lastSessionType: AchievementStats['lastSessionType'];
}): Promise<Achievement[]> {
  const sessions = await getAllSessions();
  const monitoringSessions = sessions.filter((s) => s.type === 'monitoring');
  const focusSessions = sessions.filter((s) => s.type !== 'monitoring');
  const totalMonitoringSeconds = monitoringSessions.reduce(
    (acc, s) => acc + s.durationSeconds,
    0
  );

  const stats: AchievementStats = {
    totalSessions: monitoringSessions.length,
    totalFocusSessions: focusSessions.length,
    totalMonitoringSeconds,
    ...params,
  };

  return checkNewAchievements(stats);
}
