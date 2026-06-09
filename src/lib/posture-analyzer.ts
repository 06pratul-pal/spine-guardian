import type { CalibrationData } from './calibration';

export type PostureIssue =
  | 'forward_head'
  | 'slouching'
  | 'rounded_back'
  | 'uneven_shoulders'
  | 'forward_lean'
  | 'neck_tilt';

export type PostureLabel = 'excellent' | 'good' | 'average' | 'poor';

export interface PostureResult {
  score: number;
  issues: PostureIssue[];
  label: PostureLabel;
  debug?: Record<string, number>;
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

// ─── MediaPipe landmark indices ───────────────────────────────────────────────
const IDX = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
} as const;

const VIS_THRESHOLD = 0.45;

function vis(lm: Landmark | undefined): lm is Landmark {
  return !!lm && (lm.visibility === undefined || lm.visibility >= VIS_THRESHOLD);
}

function mid(a: Landmark, b: Landmark) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

// ─── Main analyser ────────────────────────────────────────────────────────────
export function analyzePosture(
  landmarks: Landmark[],
  sensitivity: number = 1.0,
  calibration: CalibrationData | null = null
): PostureResult {
  const nose         = landmarks[IDX.nose];
  const leftEar      = landmarks[IDX.leftEar];
  const rightEar     = landmarks[IDX.rightEar];
  const leftShoulder = landmarks[IDX.leftShoulder];
  const rightShoulder= landmarks[IDX.rightShoulder];
  const leftHip      = landmarks[IDX.leftHip];
  const rightHip     = landmarks[IDX.rightHip];

  if (!vis(leftShoulder) || !vis(rightShoulder)) {
    return { score: 100, issues: [], label: 'excellent' };
  }

  const shoulderMid  = mid(leftShoulder, rightShoulder);
  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);

  if (shoulderWidth < 0.06) {
    return { score: 100, issues: [], label: 'excellent' };
  }

  // ── Thresholds — personal when calibrated, universal defaults otherwise ────
  // When calibrated: alert fires when a ratio falls below (baseline × factor).
  // The factor encodes "how much worse than your own good posture triggers a warning".
  const cal = calibration;

  const SLOUCH_THRESHOLD =
    cal ? cal.torsoRatio * (0.80 - 0.06 * (sensitivity - 1))
        : 0.55 / sensitivity;

  const EAR_THRESHOLD =
    cal ? cal.earRatio * (0.72 - 0.06 * (sensitivity - 1))
        : 0.10 / sensitivity;

  const Z_SHOULDER_THRESHOLD =
    cal ? cal.shoulderZVsHip - 0.13 * sensitivity
        : -0.18 * sensitivity;

  const HEAD_Z_THRESHOLD =
    cal ? cal.headZVsShoulder + 0.09 * sensitivity
        : 0.12 * sensitivity;

  const ASYM_THRESHOLD =
    cal ? Math.max(cal.shoulderAsymmetry + 0.04, 0.06) * sensitivity
        : 0.10 * sensitivity;

  // ─────────────────────────────────────────────────────────────────────────────

  let score = 100;
  const issues: PostureIssue[] = [];
  const debug: Record<string, number> = {};

  const hasHips = vis(leftHip) && vis(rightHip);
  const hipMid  = hasHips ? mid(leftHip!, rightHip!) : null;

  // ── 1. Slouching ──────────────────────────────────────────────────────────
  if (hasHips && hipMid) {
    const torsoHeight = hipMid.y - shoulderMid.y;
    const bodyRatio   = torsoHeight / shoulderWidth;
    debug['torsoRatio'] = bodyRatio;

    if (bodyRatio < SLOUCH_THRESHOLD) {
      const deficit = SLOUCH_THRESHOLD - bodyRatio;
      const penalty = Math.min(32, deficit * 90 * sensitivity);
      score -= penalty;
      issues.push('slouching');
    }

    // ── 2. Forward lean ──────────────────────────────────────────────────
    const spineXDrift = Math.abs(shoulderMid.x - hipMid.x) / shoulderWidth;
    debug['spineXDrift'] = spineXDrift;

    if (spineXDrift > 0.20 * sensitivity) {
      const excess  = spineXDrift - 0.20 * sensitivity;
      const penalty = Math.min(18, excess * 55 * sensitivity);
      score -= penalty;
      issues.push('forward_lean');
    }

    // ── 3. Rounded back (Z depth) ────────────────────────────────────────
    const shoulderZVsHip = shoulderMid.z - hipMid.z;
    debug['shoulderZVsHip'] = shoulderZVsHip;

    if (shoulderZVsHip < Z_SHOULDER_THRESHOLD) {
      const excess  = Math.abs(shoulderZVsHip) - Math.abs(Z_SHOULDER_THRESHOLD);
      const penalty = Math.min(22, excess * 70 * sensitivity);
      score -= penalty;
      if (!issues.includes('slouching')) issues.push('rounded_back');
    }
  }

  // ── 4. Forward head ───────────────────────────────────────────────────────
  const hasEars = vis(leftEar) && vis(rightEar);
  const earMid  = hasEars ? mid(leftEar!, rightEar!) : null;

  if (earMid) {
    const earToShoulderY = shoulderMid.y - earMid.y;
    const earRatio       = earToShoulderY / shoulderWidth;
    debug['earRatio'] = earRatio;

    if (earRatio < EAR_THRESHOLD) {
      const deficit = EAR_THRESHOLD - earRatio;
      const penalty = Math.min(28, deficit * 160 * sensitivity);
      score -= penalty;
      issues.push('forward_head');
    }

    // Z-depth head forward check
    const headZVsShoulder = shoulderMid.z - earMid.z;
    debug['headZVsShoulder'] = headZVsShoulder;

    if (headZVsShoulder > HEAD_Z_THRESHOLD) {
      const excess  = headZVsShoulder - HEAD_Z_THRESHOLD;
      const penalty = Math.min(20, excess * 90 * sensitivity);
      score -= penalty;
      if (!issues.includes('forward_head')) issues.push('forward_head');
    }
  } else if (vis(nose)) {
    const headToShoulderY = shoulderMid.y - nose!.y;
    const threshold       = 0.07 / sensitivity;
    debug['noseToShoulder'] = headToShoulderY / shoulderWidth;

    if (headToShoulderY < threshold) {
      const deficit = threshold - headToShoulderY;
      const penalty = Math.min(25, deficit * 220 * sensitivity);
      score -= penalty;
      issues.push('forward_head');
    }
  }

  // ── 5. Neck tilt ─────────────────────────────────────────────────────────
  if (vis(nose)) {
    const noseCenterOffset = Math.abs(nose!.x - shoulderMid.x);
    const centerRatio      = noseCenterOffset / shoulderWidth;
    debug['neckTilt'] = centerRatio;

    if (centerRatio > 0.20 * sensitivity) {
      const excess  = centerRatio - 0.20 * sensitivity;
      const penalty = Math.min(14, excess * 55 * sensitivity);
      score -= penalty;
      issues.push('neck_tilt');
    }
  }

  // ── 6. Uneven shoulders ───────────────────────────────────────────────────
  const shoulderHeightDiff = Math.abs(leftShoulder.y - rightShoulder.y);
  const shoulderDiffRatio  = shoulderHeightDiff / shoulderWidth;
  debug['shoulderAsymmetry'] = shoulderDiffRatio;

  if (shoulderDiffRatio > ASYM_THRESHOLD) {
    const excess  = shoulderDiffRatio - ASYM_THRESHOLD;
    const penalty = Math.min(16, excess * 75 * sensitivity);
    score -= penalty;
    issues.push('uneven_shoulders');
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score: finalScore,
    issues,
    label: getPostureLabel(finalScore),
    debug,
  };
}

// ─── Temporal smoother ────────────────────────────────────────────────────────
const SMOOTH_WINDOW         = 8;
const ISSUE_REQUIRED_FRACTION = 0.55;

interface SmoothState {
  scores: number[];
  issueHistory: PostureIssue[][];
}

export function createSmoother(): (raw: PostureResult) => PostureResult {
  const state: SmoothState = { scores: [], issueHistory: [] };

  return function smooth(raw: PostureResult): PostureResult {
    state.scores.push(raw.score);
    state.issueHistory.push(raw.issues);
    if (state.scores.length > SMOOTH_WINDOW) state.scores.shift();
    if (state.issueHistory.length > SMOOTH_WINDOW) state.issueHistory.shift();

    const avgScore = Math.round(
      state.scores.reduce((a, b) => a + b, 0) / state.scores.length
    );

    const allIssues: PostureIssue[] = [
      'forward_head', 'slouching', 'rounded_back',
      'uneven_shoulders', 'forward_lean', 'neck_tilt',
    ];
    const windowLen = state.issueHistory.length;
    const issueSet  = new Set<PostureIssue>();

    for (const issue of allIssues) {
      const count = state.issueHistory.filter((f) => f.includes(issue)).length;
      if (count / windowLen >= ISSUE_REQUIRED_FRACTION) issueSet.add(issue);
    }

    return {
      score:  avgScore,
      issues: Array.from(issueSet),
      label:  getPostureLabel(avgScore),
      debug:  raw.debug,
    };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getPostureLabel(score: number): PostureLabel {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'average';
  return 'poor';
}

export const POSTURE_COLORS: Record<PostureLabel, string> = {
  excellent: '#10b981',
  good:      '#34d399',
  average:   '#f59e0b',
  poor:      '#ef4444',
};

export const POSTURE_LABEL_TEXT: Record<PostureLabel, string> = {
  excellent: 'Excellent',
  good:      'Good',
  average:   'Average',
  poor:      'Poor',
};

export const ISSUE_DESCRIPTIONS: Record<PostureIssue, string> = {
  forward_head:     'Head too far forward',
  slouching:        'Spine compressed / slouching',
  rounded_back:     'Rounded upper back / hunching',
  uneven_shoulders: 'Uneven shoulders',
  forward_lean:     'Leaning to one side',
  neck_tilt:        'Head tilted sideways',
};
