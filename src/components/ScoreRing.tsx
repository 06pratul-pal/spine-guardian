import { POSTURE_COLORS, POSTURE_LABEL_TEXT, type PostureLabel } from '../lib/posture-analyzer';

interface ScoreRingProps {
  score: number;
  label: PostureLabel;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export function ScoreRing({
  score,
  label,
  size = 160,
  strokeWidth = 10,
  showLabel = true,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = POSTURE_COLORS[label];
  const center = size / 2;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
        className="absolute"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        />
      </svg>
      <div className="relative flex flex-col items-center gap-0.5">
        <span
          className="font-bold tabular-nums leading-none"
          style={{
            fontSize: size * 0.22,
            color,
            transition: 'color 0.4s ease',
          }}
        >
          {score}
        </span>
        {showLabel && (
          <span
            className="text-xs font-medium uppercase tracking-widest"
            style={{ color: 'rgba(255,255,255,0.4)', fontSize: size * 0.075 }}
          >
            {POSTURE_LABEL_TEXT[label]}
          </span>
        )}
      </div>
    </div>
  );
}
