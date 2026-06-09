import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { BarChart2, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import {
  getSnapshotsByDate,
  getSnapshotsInRange,
  getSessionsInRange,
  getLast7Days,
  todayString,
  formatDayLabel,
  type SnapshotRecord,
  type SessionRecord,
} from '../lib/database';

type Tab = 'daily' | 'weekly';

interface DailyPoint {
  hour: string;
  score: number;
  slouchCount: number;
}

interface WeeklyPoint {
  day: string;
  score: number;
  sessions: number;
}

const TOOLTIP_STYLE = {
  backgroundColor: '#1a1a24',
  border: '1px solid #2a2a3a',
  borderRadius: 10,
  color: '#e4e4f0',
  fontSize: 12,
};

export function Analytics() {
  const [tab, setTab] = useState<Tab>('daily');
  const [dailyPoints, setDailyPoints] = useState<DailyPoint[]>([]);
  const [weeklyPoints, setWeeklyPoints] = useState<WeeklyPoint[]>([]);
  const [dailySessions, setDailySessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const today = todayString();
      const days = getLast7Days();
      const weekStart = days[0]!;

      const [snapshots, weekSnapshots, weekSessions] = await Promise.all([
        getSnapshotsByDate(today),
        getSnapshotsInRange(weekStart, today),
        getSessionsInRange(weekStart, today),
      ]);

      // Build daily chart (0-23 hours)
      const hourMap = new Map<number, SnapshotRecord>(snapshots.map((s) => [s.hour, s]));
      const daily: DailyPoint[] = Array.from({ length: 24 }, (_, h) => {
        const snap = hourMap.get(h);
        return {
          hour: `${String(h).padStart(2, '0')}:00`,
          score: snap ? Math.round(snap.avgScore) : 0,
          slouchCount: snap?.slouchCount ?? 0,
        };
      });
      setDailyPoints(daily);

      // Build weekly chart
      const weekly: WeeklyPoint[] = days.map((d) => {
        const daySnaps = weekSnapshots.filter((s) => s.date === d);
        const daySessions = weekSessions.filter((s) => s.date === d);
        const avgScore =
          daySnaps.length > 0
            ? Math.round(daySnaps.reduce((acc, s) => acc + s.avgScore, 0) / daySnaps.length)
            : 0;
        return {
          day: formatDayLabel(d),
          score: avgScore,
          sessions: daySessions.length,
        };
      });
      setWeeklyPoints(weekly);

      // Today's sessions for stats
      const todaySessions = weekSessions.filter((s) => s.date === today);
      setDailySessions(todaySessions);
    } finally {
      setLoading(false);
    }
  }

  const todayAvgScore =
    dailyPoints.filter((p) => p.score > 0).reduce((acc, p) => acc + p.score, 0) /
      (dailyPoints.filter((p) => p.score > 0).length || 1) || 0;

  const todayTotalMinutes =
    dailySessions.reduce((acc, s) => acc + s.durationSeconds, 0) / 60;

  const todaySlouchCount = dailyPoints.reduce((acc, p) => acc + p.slouchCount, 0);

  const todayFocusMin = dailySessions
    .filter((s) => s.type !== 'monitoring')
    .reduce((acc, s) => acc + s.durationSeconds, 0) / 60;

  const weekBestDay = weeklyPoints.reduce(
    (best, p) => (p.score > best.score ? p : best),
    { day: '—', score: 0 }
  );
  const weekWorstDay = weeklyPoints
    .filter((p) => p.score > 0)
    .reduce((worst, p) => (p.score < worst.score ? p : worst), {
      day: '—',
      score: 100,
    });

  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#e4e4f0' }}>
            Analytics
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Your posture trends over time
          </p>
        </div>

        {/* Tab switcher */}
        <div
          className="flex rounded-xl p-1 gap-1"
          style={{ background: '#111118', border: '1px solid #1e1e2e' }}
        >
          {(['daily', 'weekly'] as Tab[]).map((t) => (
            <motion.button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold capitalize"
              style={{
                background: tab === t ? 'rgba(124,58,237,0.25)' : 'transparent',
                color: tab === t ? '#a78bfa' : 'rgba(255,255,255,0.4)',
              }}
            >
              {t}
            </motion.button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Loading analytics...
          </p>
        </div>
      ) : (
        <>
          {tab === 'daily' && (
            <div className="flex flex-col gap-4">
              {/* Stats row */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  {
                    icon: BarChart2,
                    label: 'Avg Score',
                    value: todayAvgScore > 0 ? Math.round(todayAvgScore) : '—',
                    color: '#a78bfa',
                  },
                  {
                    icon: Clock,
                    label: 'Monitoring',
                    value: todayTotalMinutes > 0 ? `${Math.round(todayTotalMinutes)}m` : '—',
                    color: '#60a5fa',
                  },
                  {
                    icon: TrendingUp,
                    label: 'Focus Time',
                    value: todayFocusMin > 0 ? `${Math.round(todayFocusMin)}m` : '—',
                    color: '#34d399',
                  },
                  {
                    icon: AlertTriangle,
                    label: 'Slouches',
                    value: todaySlouchCount || '—',
                    color: '#f59e0b',
                  },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div
                    key={label}
                    className="rounded-2xl p-4 flex flex-col gap-2"
                    style={{ background: '#111118', border: '1px solid #1e1e2e' }}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={13} style={{ color: 'rgba(255,255,255,0.3)' }} />
                      <span
                        className="text-xs uppercase tracking-wider font-medium"
                        style={{ color: 'rgba(255,255,255,0.35)' }}
                      >
                        {label}
                      </span>
                    </div>
                    <span className="text-2xl font-bold" style={{ color }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Daily chart */}
              <div
                className="rounded-2xl p-5 flex flex-col gap-3"
                style={{ background: '#111118', border: '1px solid #1e1e2e' }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  Hourly Posture Score — Today
                </p>

                {dailyPoints.every((p) => p.score === 0) ? (
                  <div className="flex flex-col items-center gap-2 py-12">
                    <BarChart2 size={28} style={{ color: 'rgba(255,255,255,0.15)' }} />
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      No data yet — start monitoring to see your chart
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart
                      data={dailyPoints}
                      margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.04)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="hour"
                        tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        interval={3}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(v: unknown) => [`${v}`, 'Score']}
                        labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#7c3aed"
                        strokeWidth={2}
                        fill="url(#scoreGrad)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#a78bfa' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {tab === 'weekly' && (
            <div className="flex flex-col gap-4">
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: '7-Day Avg',
                    value:
                      weeklyPoints.filter((p) => p.score > 0).length > 0
                        ? `${Math.round(
                            weeklyPoints
                              .filter((p) => p.score > 0)
                              .reduce((a, p) => a + p.score, 0) /
                              weeklyPoints.filter((p) => p.score > 0).length
                          )}`
                        : '—',
                    color: '#a78bfa',
                  },
                  {
                    label: 'Best Day',
                    value: weekBestDay.score > 0 ? `${weekBestDay.day} (${weekBestDay.score})` : '—',
                    color: '#10b981',
                  },
                  {
                    label: 'Worst Day',
                    value: weekWorstDay.score < 100 ? `${weekWorstDay.day} (${weekWorstDay.score})` : '—',
                    color: '#f59e0b',
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-2xl p-4 flex flex-col gap-2"
                    style={{ background: '#111118', border: '1px solid #1e1e2e' }}
                  >
                    <span
                      className="text-xs uppercase tracking-wider"
                      style={{ color: 'rgba(255,255,255,0.35)' }}
                    >
                      {s.label}
                    </span>
                    <span className="text-xl font-bold" style={{ color: s.color }}>
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Weekly chart */}
              <div
                className="rounded-2xl p-5 flex flex-col gap-3"
                style={{ background: '#111118', border: '1px solid #1e1e2e' }}
              >
                <p
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  Daily Average Score — Last 7 Days
                </p>

                {weeklyPoints.every((p) => p.score === 0) ? (
                  <div className="flex flex-col items-center gap-2 py-12">
                    <TrendingUp size={28} style={{ color: 'rgba(255,255,255,0.15)' }} />
                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      No data yet — start monitoring daily to build your trends
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={weeklyPoints}
                      margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.04)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(v: unknown) => [`${v}`, 'Avg Score']}
                        labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                        cursor={{ fill: 'rgba(124,58,237,0.08)' }}
                      />
                      <Bar
                        dataKey="score"
                        fill="#7c3aed"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={48}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
