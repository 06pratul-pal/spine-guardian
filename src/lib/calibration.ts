import type { Landmark } from './posture-analyzer';

export interface CalibrationData {
  torsoRatio: number;
  earRatio: number;
  shoulderZVsHip: number;
  headZVsShoulder: number;
  shoulderAsymmetry: number;
  shoulderWidth: number;
  sampleCount: number;
  capturedAt: number;
  earsFallback?: boolean;   // true when ears were not visible — lower quality baseline
}

const STORAGE_KEY = 'sg-calibration';

function mid(a: Landmark, b: Landmark) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

/**
 * Compute a personal baseline from a collection of landmark frames captured
 * while the user was sitting with good posture.
 */
export function computeCalibration(samples: Landmark[][]): CalibrationData {
  // Only keep frames where key landmarks are reliably visible
  const valid = samples.filter((s) => {
    const ls = s[11], rs = s[12], lh = s[23], rh = s[24];
    return (
      ls && rs && lh && rh &&
      (ls.visibility ?? 1) >= 0.5 &&
      (rs.visibility ?? 1) >= 0.5 &&
      (lh.visibility ?? 1) >= 0.4 &&
      (rh.visibility ?? 1) >= 0.4
    );
  });

  if (valid.length < 8) {
    throw new Error(
      `Not enough valid frames (got ${valid.length}, need at least 8). ` +
      'Make sure your full upper body is visible in the camera.'
    );
  }

  const metrics = valid.map((lms) => {
    const ls = lms[11]!;
    const rs = lms[12]!;
    const lh = lms[23]!;
    const rh = lms[24]!;
    const le = lms[7];
    const re = lms[8];

    const shoulderMid = mid(ls, rs);
    const hipMid = mid(lh, rh);
    const shoulderWidth = Math.abs(ls.x - rs.x);

    const torsoRatio = (hipMid.y - shoulderMid.y) / shoulderWidth;

    const earsVisible = le && re && (le.visibility ?? 1) >= 0.4 && (re.visibility ?? 1) >= 0.4;
    const earRatio = earsVisible
      ? (shoulderMid.y - (le!.y + re!.y) / 2) / shoulderWidth
      : null; // null = ears not visible in this frame

    const shoulderZVsHip = shoulderMid.z - hipMid.z;

    const headZVsShoulder =
      le && re && (le.visibility ?? 1) >= 0.4 && (re.visibility ?? 1) >= 0.4
        ? shoulderMid.z - (le.z + re.z) / 2
        : 0;

    const shoulderAsymmetry = Math.abs(ls.y - rs.y) / shoulderWidth;

    return {
      torsoRatio,
      earRatio,
      shoulderZVsHip,
      headZVsShoulder,
      shoulderAsymmetry,
      shoulderWidth,
    };
  });

  function avg(key: keyof typeof metrics[0]): number {
    return metrics.reduce((s, m) => s + (m[key] as number), 0) / metrics.length;
  }

  // Compute earRatio only from frames where ears were visible
  const earFrames = metrics.filter((m) => m.earRatio !== null);
  const earRatioAvg = earFrames.length >= 3
    ? earFrames.reduce((s, m) => s + m.earRatio!, 0) / earFrames.length
    : 0.18; // fallback default — ears not reliably visible
  const earsFallback = earFrames.length < 3;

  return {
    torsoRatio: avg('torsoRatio'),
    earRatio: earRatioAvg,
    shoulderZVsHip: avg('shoulderZVsHip'),
    headZVsShoulder: avg('headZVsShoulder'),
    shoulderAsymmetry: avg('shoulderAsymmetry'),
    shoulderWidth: avg('shoulderWidth'),
    sampleCount: valid.length,
    capturedAt: Date.now(),
    earsFallback,
  };
}

export function saveCalibration(data: CalibrationData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadCalibration(): CalibrationData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CalibrationData) : null;
  } catch {
    return null;
  }
}

export function clearCalibration(): void {
  localStorage.removeItem(STORAGE_KEY);
}
