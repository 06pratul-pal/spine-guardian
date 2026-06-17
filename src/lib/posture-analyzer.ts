import type { CalibrationData } from './calibration';

export type PostureIssue =
  | 'forward_head'
  | 'slouching'
  | 'rounded_back'
  | 'uneven_shoulders'
  | 'forward_lean'
  | 'neck_tilt'
  | 'lying_back';          // NEW — catches severe recline

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

const VIS_THRESHOLD = 0.50;

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
  const nose          = landmarks[IDX.nose];
  const leftEar       = landmarks[IDX.leftEar];
  const rightEar      = landmarks[IDX.rightEar];
  const leftShoulder  = landmarks[IDX.leftShoulder];
  const rightShoulder = landmarks[IDX.rightShoulder];
  const leftHip       = landmarks[IDX.leftHip];
  const rightHip      = landmarks[IDX.rightHip];

  // Shoulders must be visible — if not, we cannot assess posture at all
  if (!vis(leftShoulder) || !vis(rightShoulder)) {
    // Return a neutral "unknown" rather than perfect score
    return { score: 50, issues: [], label: 'average' };
  }

  const shoulderMid   = mid(leftShoulder, rightShoulder);
  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);

  // Too close / side-on — can't measure reliably, but don't reward it
  if (shoulderWidth < 0.08) {
    return { score: 50, issues: [], label: 'average' };
  }

  const cal = calibration;

  let score = 100;
  const issues: PostureIssue[] = [];
  const debug: Record<string, number> = {};

  // ── 0. LYING BACK / SEVERE RECLINE DETECTION ─────────────────────────────
  // The challenge: when the camera is ABOVE eye level (laptop lid, monitor top)
  // the nose naturally appears at or below shoulder Y even when sitting upright.
  // We must use multiple signals together — not just one Y comparison.
  //
  // A true lying-back has ALL of these:
  //   a) Nose Y is significantly below shoulder Y (large margin, not just a little)
  //   b) Hips are NOT visible (body is reclined away from camera)
  //   c) The Z depth of nose vs shoulders confirms recline (nose closer to cam)
  //
  // A high camera angle has:
  //   a) Nose Y slightly below or near shoulder Y — but HIPS ARE STILL VISIBLE
  //   b) Torso looks normal height
  //
  // So: only flag lying_back if nose is well below shoulders AND hips are not visible.

  const hasEars = vis(leftEar) && vis(rightEar);
  const earMid  = hasEars ? mid(leftEar!, rightEar!) : null;

  // We need hips to determine if this is a camera angle issue or real recline
  const hasHipsEarly = vis(leftHip) && vis(rightHip);

  if (vis(nose)) {
    const headBelowShoulder = nose!.y - shoulderMid.y;
    debug['headBelowShoulder'] = headBelowShoulder;

    // Only flag lying_back if:
    // 1. Head is significantly below shoulder level (not just slightly)
    // 2. Hips are NOT visible — if hips are visible, it's just a high camera angle
    const lyingBackThreshold = 0.08; // raised from 0.02 — requires much more extreme recline
    if (headBelowShoulder > lyingBackThreshold && !hasHipsEarly) {
      const penalty = Math.min(50, headBelowShoulder * 200 * sensitivity);
      score -= penalty;
      issues.push('lying_back');
      debug['lyingBack_triggered'] = 1;
    }
  }

  if (earMid) {
    const earBelowShoulder = earMid.y - shoulderMid.y;
    debug['earBelowShoulder'] = earBelowShoulder;

    // Ears below shoulder + no hips visible = genuine recline
    // Raised threshold from 0.0 to 0.06 — small amounts are normal with high camera
    if (earBelowShoulder > 0.06 && !hasHipsEarly && !issues.includes('lying_back')) {
      const penalty = Math.min(40, earBelowShoulder * 200 * sensitivity);
      score -= penalty;
      issues.push('lying_back');
      debug['lyingBack_ear_triggered'] = 1;
    }
  }

  // ── THRESHOLDS ────────────────────────────────────────────────────────────
  // Tightened vs previous — the over-loosening was causing missed detections
  const SLOUCH_THRESHOLD =
    cal ? cal.torsoRatio * (0.85 - 0.05 * (sensitivity - 1))
        : 0.60 / sensitivity;   // was 0.50 — tightened

  const EAR_THRESHOLD =
    cal ? cal.earRatio * (0.80 - 0.05 * (sensitivity - 1))
        : 0.12 / sensitivity;   // was 0.08 — tightened

  const ASYM_THRESHOLD =
    cal ? Math.max(cal.shoulderAsymmetry + 0.04, 0.08) * sensitivity
        : 0.12 * sensitivity;   // was 0.15 — tightened

  const LEAN_THRESHOLD = 0.18 * sensitivity;  // was 0.22 — tightened

  // ─────────────────────────────────────────────────────────────────────────

  const hasHips = hasHipsEarly;
  const hipMid  = hasHips ? mid(leftHip!, rightHip!) : null;

  // ── 1. Slouching ──────────────────────────────────────────────────────────
  if (hasHips && hipMid) {
    const torsoHeight = hipMid.y - shoulderMid.y;
    const bodyRatio   = torsoHeight / shoulderWidth;
    debug['torsoRatio'] = bodyRatio;

    if (bodyRatio < SLOUCH_THRESHOLD) {
      const deficit = SLOUCH_THRESHOLD - bodyRatio;
      const penalty = Math.min(40, deficit * 120 * sensitivity);  // was max 35
      score -= penalty;
      issues.push('slouching');
    }

    // ── 2. Forward lean (left/right) ─────────────────────────────────────
    const spineXDrift = Math.abs(shoulderMid.x - hipMid.x) / shoulderWidth;
    debug['spineXDrift'] = spineXDrift;

    if (spineXDrift > LEAN_THRESHOLD) {
      const excess  = spineXDrift - LEAN_THRESHOLD;
      const penalty = Math.min(20, excess * 60 * sensitivity);
      score -= penalty;
      if (!issues.includes('slouching')) issues.push('forward_lean');
    }

    // ── 3. Rounded back ────────────────────────────────────────────────────
    if (issues.includes('slouching') && earMid) {
      const earRatioForRounded = (shoulderMid.y - earMid.y) / shoulderWidth;
      if (earRatioForRounded < 0.06 / sensitivity) {
        issues.splice(issues.indexOf('slouching'), 1);
        issues.push('rounded_back');
      }
    }
  } else if (!hasHips) {
    // ── NO HIPS VISIBLE ───────────────────────────────────────────────────
    // Hips not in frame — common with laptops where camera only sees upper body.
    // Apply a small penalty only if lying_back was already confirmed above.
    // Don't penalize just for hips being out of frame — that's normal.
    if (issues.includes('lying_back')) {
      score -= 10;
      debug['noHipsPenalty'] = 10;
    }
  }

  // ── 4. Forward head ───────────────────────────────────────────────────────
  // Only run this check when we're NOT in lying_back mode —
  // in lying_back the ear-to-shoulder Y relationship is already inverted
  // and this check would produce nonsense values.
  if (!issues.includes('lying_back')) {
    if (earMid) {
      const earToShoulderY = shoulderMid.y - earMid.y;
      const earRatio       = earToShoulderY / shoulderWidth;
      debug['earRatio'] = earRatio;

      if (earRatio < EAR_THRESHOLD) {
        const deficit = EAR_THRESHOLD - earRatio;
        const penalty = Math.min(35, deficit * 200 * sensitivity);  // was max 30
        score -= penalty;
        issues.push('forward_head');
      }
    } else if (vis(nose)) {
      const headToShoulderY = shoulderMid.y - nose!.y;
      const noseRatio = headToShoulderY / shoulderWidth;
      const threshold = 0.08 / sensitivity;  // was 0.05 — tightened
      debug['noseRatio'] = noseRatio;

      if (noseRatio < threshold) {
        const deficit = threshold - noseRatio;
        const penalty = Math.min(28, deficit * 220 * sensitivity);
        score -= penalty;
        issues.push('forward_head');
      }
    }
  }

  // ── 5. Neck tilt ─────────────────────────────────────────────────────────
  if (vis(nose) && !issues.includes('lying_back')) {
    const noseCenterOffset = Math.abs(nose!.x - shoulderMid.x);
    const centerRatio      = noseCenterOffset / shoulderWidth;
    debug['neckTilt'] = centerRatio;

    const NECK_THRESHOLD = 0.20 * sensitivity;  // was 0.25 — tightened
    if (centerRatio > NECK_THRESHOLD) {
      const excess  = centerRatio - NECK_THRESHOLD;
      const penalty = Math.min(15, excess * 50 * sensitivity);
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
    const penalty = Math.min(15, excess * 60 * sensitivity);  // was max 10
    score -= penalty;
    issues.push('uneven_shoulders');
  }

  // ── 7. Camera angle / face tilt check ────────────────────────────────────
  // NOTE: We no longer use nose-ear Y diff to detect lying_back here.
  // That check was too sensitive for cameras above eye level (laptops).
  // lying_back is now only detected in check 0 using the hips-visible guard.
  // This section is kept for future use but does NOT add lying_back.
  if (vis(nose) && earMid) {
    const noseEarYDiff = nose!.y - earMid.y;
    debug['noseEarYDiff'] = noseEarYDiff;
    // Reserved — no action taken here to avoid false positives
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
// Reduced window: 8 frames (was 12) — react faster to bad posture
// Issue fraction: 0.50 (was 0.65) — show issue if present in half of recent frames
const SMOOTH_WINDOW           = 8;
const ISSUE_REQUIRED_FRACTION = 0.50;

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

    // Weighted average — recent frames count more
    const weights = state.scores.map((_, i) => i + 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const weightedScore = state.scores.reduce((sum, s, i) => sum + s * weights[i]!, 0);
    const avgScore = Math.round(weightedScore / totalWeight);

    const allIssues: PostureIssue[] = [
      'lying_back', 'forward_head', 'slouching', 'rounded_back',
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
  lying_back:       'Leaning/lying back severely',
};
