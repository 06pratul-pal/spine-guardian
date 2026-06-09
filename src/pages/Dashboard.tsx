import { motion } from 'framer-motion';
import { Zap, Flame, Camera, TrendingUp, Activity } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { PERSONALITIES, PERSONALITY_LIST } from '../lib/personalities';
import { ScoreRing } from '../components/ScoreRing';
import { getLevelName } from '../lib/xp-system';
import { ACHIEVEMENTS, getUnlockedIds } from '../lib/achievements';

const SCORE_LABEL: Record<string, { text: string; color: string }> = {
  excellent: { text: 'Perfect posture! Keep it up',      color: '#10b981' },
  good:      { text: 'Good posture — stay aware',        color: '#34d399' },
  average:   { text: 'Posture needs attention',          color: '#f59e0b' },
  poor:      { text: 'Slouching detected — sit up!',     color: '#ef4444' },
};

export function Dashboard() {
  const {
    postureResult, totalXP, level, xpProgress,
    streakDays, settings, updateSettings, setPage,
    sessionGoodSeconds, sessionBadSeconds, isMonitoring,
  } = useAppStore();

  const personality   = PERSONALITIES[settings.personalityId];
  const score         = postureResult?.score ?? 0;
  const label         = postureResult?.label ?? 'poor';
  const displayScore  = isMonitoring ? score  : 0;
  const displayLabel  = isMonitoring ? label  : 'poor';
  const scoreInfo     = SCORE_LABEL[displayLabel] ?? SCORE_LABEL.poor!;
  const goodMin       = Math.floor(sessionGoodSeconds / 60);
  const badMin        = Math.floor(sessionBadSeconds  / 60);
  const unlockedIds   = new Set(getUnlockedIds());

  return (
    <div className="h-full overflow-y-auto p-5 flex flex-col gap-4 sg-fade-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold sg-gradient-text">Spine Guardian AI</h1>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
            100% local · your data never leaves this device
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isMonitoring ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 sg-monitoring-dot" />
              Monitoring Active
            </motion.div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.25)' }} />
              Idle
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left — Score + CTA */}
        <div className="col-span-2 flex flex-col gap-3">

          {/* Main score card */}
          <motion.div
            className="sg-card-glow p-5 flex items-center gap-7"
            style={{ minHeight: 170 }}
          >
            {/* Subtle glow behind ring */}
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-full blur-2xl opacity-30"
                style={{ background: scoreInfo.color, transform: 'scale(0.8)' }}
              />
              <ScoreRing score={displayScore} label={displayLabel} size={148} />
            </div>

            <div className="flex flex-col gap-3 flex-1 min-w-0">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1"
                  style={{ color: 'rgba(255,255,255,0.28)' }}>
                  Posture Score
                </p>
                {isMonitoring && postureResult ? (
                  <>
                    <motion.h2
                      key={score}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xl font-bold leading-tight"
                      style={{ color: scoreInfo.color }}
                    >
                      {scoreInfo.text}
                    </motion.h2>
                    {postureResult.issues.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {postureResult.issues.map((issue) => (
                          <span key={issue} className="sg-tag" style={{ color: '#fbbf24', borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.08)' }}>
                            {issue.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <h2 className="text-xl font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Not monitoring
                  </h2>
                )}
              </div>

              {!isMonitoring && (
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setPage('monitor')}
                  className="sg-btn-primary flex items-center gap-2 px-4 py-2.5 text-sm self-start"
                >
                  <Camera size={14} />
                  Start Monitoring
                </motion.button>
              )}

              {isMonitoring && (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <Activity size={11} style={{ color: '#a78bfa' }} />
                  {personality.emoji} {personality.name} is watching
                </div>
              )}
            </div>
          </motion.div>

          {/* Session stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Good posture',    value: `${goodMin}m`,    color: '#10b981', icon: '✅' },
              { label: 'Needs work',      value: `${badMin}m`,     color: '#f59e0b', icon: '⚠️' },
              { label: 'Total XP earned', value: `${totalXP}`,     color: '#a78bfa', icon: '⚡' },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                whileHover={{ scale: 1.02 }}
                className="sg-card p-4 flex flex-col gap-1.5"
              >
                <span style={{ fontSize: 18 }}>{stat.icon}</span>
                <span className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{stat.label}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3">

          {/* Level + XP */}
          <div className="sg-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap size={13} style={{ color: '#a78bfa' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Level {level}
                </span>
              </div>
              <span className="sg-tag">{totalXP} XP</span>
            </div>
            <p className="font-bold text-sm sg-gradient-text">{getLevelName(level)}</p>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                <span>{xpProgress.current} XP</span>
                <span>{xpProgress.required} XP</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg,#7c3aed,#a78bfa,#818cf8)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress.percentage}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>

          {/* Streak */}
          <div className="sg-card p-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
              style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.2)' }}>
              <Flame size={18} style={{ color: '#f97316' }} />
            </div>
            <div>
              <p className="text-2xl font-black" style={{ color: '#f97316' }}>{streakDays}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>
                day{streakDays !== 1 ? 's' : ''} streak 🔥
              </p>
            </div>
          </div>

          {/* Personality quick-switch */}
          <div className="sg-card p-4 flex flex-col gap-3 flex-1">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Voice Mode
              </span>
            </div>
            <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: 200 }}>
              {PERSONALITY_LIST.map((p) => {
                const isActive = settings.personalityId === p.id;
                return (
                  <motion.button
                    key={p.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => updateSettings({ personalityId: p.id })}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left transition-all"
                    style={{
                      background: isActive ? `${p.color}15` : 'rgba(255,255,255,0.02)',
                      border: isActive ? `1px solid ${p.color}35` : '1px solid transparent',
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{p.emoji}</span>
                    <span className="text-xs font-medium truncate"
                      style={{ color: isActive ? p.color : 'rgba(255,255,255,0.45)' }}>
                      {p.name}
                    </span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: p.color }} />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="sg-card p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold" style={{ color: '#e4e4f0' }}>Achievements</p>
          <span className="sg-tag">
            {unlockedIds.size} / {ACHIEVEMENTS.length}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = unlockedIds.has(a.id);
            return (
              <motion.div
                key={a.id}
                whileHover={{ scale: 1.05 }}
                className="rounded-2xl p-3 flex flex-col items-center gap-2 text-center"
                style={{
                  background: unlocked ? `${a.color}0d` : 'rgba(255,255,255,0.02)',
                  border: unlocked ? `1px solid ${a.color}25` : '1px solid rgba(255,255,255,0.05)',
                  filter: unlocked ? 'none' : 'grayscale(1) opacity(0.35)',
                }}
                title={a.description}
              >
                <span style={{ fontSize: 22 }}>{a.emoji}</span>
                <div>
                  <p className="text-xs font-bold leading-tight" style={{ color: unlocked ? a.color : 'rgba(255,255,255,0.4)' }}>
                    {a.name}
                  </p>
                  <p className="mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>
                    {a.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
