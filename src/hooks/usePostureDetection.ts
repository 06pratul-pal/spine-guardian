import { useEffect, useRef, useState, useCallback } from 'react';
import {
  analyzePosture,
  createSmoother,
  POSTURE_COLORS,
  type PostureResult,
  type Landmark,
} from '../lib/posture-analyzer';
import type { CalibrationData } from '../lib/calibration';

type PoseLandmarker = any;

let PoseLandmarkerClass: any = null;
let FilesetResolverClass: any = null;
let mediapipeLoaded = false;

async function ensureMediaPipe() {
  if (mediapipeLoaded) return;
  const vision = await import('@mediapipe/tasks-vision');
  PoseLandmarkerClass = vision.PoseLandmarker;
  FilesetResolverClass = vision.FilesetResolver;
  mediapipeLoaded = true;
}

const DRAW_LANDMARKS = [0, 7, 8, 11, 12, 13, 14, 23, 24];

const POSE_CONNECTIONS: [number, number][] = [
  [7, 0], [8, 0],
  [11, 12],
  [11, 13], [12, 14],
  [11, 23], [12, 24],
  [23, 24],
];

export interface UsePostureDetectionReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  startCalibration: (durationMs: number) => Promise<Landmark[][]>;
}

export function usePostureDetection(
  sensitivity: number,
  onResult: (result: PostureResult) => void,
  calibration: CalibrationData | null = null
): UsePostureDetectionReturn {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [isReady,   setIsReady]   = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const landmarkerRef   = useRef<PoseLandmarker | null>(null);
  const animFrameRef    = useRef<number | null>(null);
  const intervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const lastVideoTime   = useRef(-1);
  const sensitivityRef  = useRef(sensitivity);
  const calibrationRef  = useRef(calibration);
  const onResultRef     = useRef(onResult);
  const smootherRef     = useRef(createSmoother());

  // Calibration collection
  const calibCollect = useRef<{
    active: boolean;
    samples: Landmark[][];
    resolve: ((s: Landmark[][]) => void) | null;
  }>({ active: false, samples: [], resolve: null });

  useEffect(() => { sensitivityRef.current  = sensitivity;   }, [sensitivity]);
  useEffect(() => { calibrationRef.current  = calibration;   }, [calibration]);
  useEffect(() => { onResultRef.current     = onResult;      }, [onResult]);

  const drawOverlay = useCallback(
    (landmarks: Landmark[], canvas: HTMLCanvasElement, video: HTMLVideoElement, score: number) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const colour =
        score >= 90 ? POSTURE_COLORS.excellent
        : score >= 75 ? POSTURE_COLORS.good
        : score >= 60 ? POSTURE_COLORS.average
        : POSTURE_COLORS.poor;

      const alphaHex = Math.round((score >= 75 ? 0.55 : 0.80) * 255)
        .toString(16).padStart(2, '0');

      ctx.strokeStyle = colour + alphaHex;
      ctx.lineWidth   = 2.5;
      ctx.lineCap     = 'round';

      for (const [s, e] of POSE_CONNECTIONS) {
        const start = landmarks[s];
        const end   = landmarks[e];
        if (!start || !end) continue;
        if ((start.visibility ?? 1) < 0.3 || (end.visibility ?? 1) < 0.3) continue;
        ctx.beginPath();
        ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
        ctx.lineTo(end.x   * canvas.width, end.y   * canvas.height);
        ctx.stroke();
      }

      for (const idx of DRAW_LANDMARKS) {
        const lm = landmarks[idx];
        if (!lm || (lm.visibility ?? 1) < 0.3) continue;
        const cx = lm.x * canvas.width;
        const cy = lm.y * canvas.height;
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = colour + '33';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = colour;
        ctx.fill();
      }

      const label  = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 60 ? 'Average' : 'Poor';
      const badge  = `${score} · ${label}`;
      ctx.font     = 'bold 13px system-ui, sans-serif';
      const tw     = ctx.measureText(badge).width;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.roundRect(4, canvas.height - 28, tw + 12, 20, 6);
      ctx.fill();
      ctx.fillStyle = colour;
      ctx.fillText(badge, 10, canvas.height - 14);
    },
    []
  );

  const detect = useCallback(() => {
    const video      = videoRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !landmarker || video.readyState < 2) return;

    if (video.currentTime !== lastVideoTime.current) {
      lastVideoTime.current = video.currentTime;
      try {
        const detection = landmarker.detectForVideo(video, performance.now());
        if (detection.landmarks?.length > 0) {
          const raw = detection.landmarks[0] as Landmark[];

          // Collect calibration samples if active
          if (calibCollect.current.active) {
            calibCollect.current.samples.push(raw);
          }

          const rawResult = analyzePosture(raw, sensitivityRef.current, calibrationRef.current);
          const smoothed  = smootherRef.current(rawResult);
          onResultRef.current(smoothed);

          const canvas = canvasRef.current;
          if (canvas) drawOverlay(raw, canvas, video, smoothed.score);
        }
      } catch { /* skip bad frames */ }
    }
  }, [drawOverlay]);

  // Use rAF when visible, fall back to setInterval when window is hidden
  // This keeps detection running even when minimized to tray
  const detectLoopRef = useRef(detect);
  useEffect(() => { detectLoopRef.current = detect; }, [detect]);

  const startDetectLoop = useCallback(() => {
    // rAF loop for smooth rendering when visible
    const rafLoop = () => {
      detectLoopRef.current();
      animFrameRef.current = requestAnimationFrame(rafLoop);
    };
    animFrameRef.current = requestAnimationFrame(rafLoop);

    // Interval loop as background fallback (15fps) — keeps running when hidden
    intervalRef.current = setInterval(() => {
      // Only run interval when rAF is throttled (document hidden)
      if (document.hidden) {
        detectLoopRef.current();
      }
    }, 67); // ~15fps
  }, []);

  const stopDetectLoop = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startCalibration = useCallback((durationMs: number): Promise<Landmark[][]> => {
    return new Promise((resolve) => {
      calibCollect.current = { active: true, samples: [], resolve };
      setTimeout(() => {
        calibCollect.current.active  = false;
        calibCollect.current.resolve = null;
        resolve(calibCollect.current.samples);
      }, durationMs);
    });
  }, []);

  const startCamera = useCallback(async () => {
    if (isLoading || isReady) return;
    setIsLoading(true);
    setError(null);
    smootherRef.current = createSmoother();

    try {
      await ensureMediaPipe();

      // Use local bundled files — no internet required after install.
      // In Electron (file:// protocol) window.location.origin is "null" for
      // security reasons — we must use a relative path instead.
      // In dev (http://localhost:5173) relative paths also work fine.
      const wasmBase   = './mediapipe/wasm';
      const modelPath  = './mediapipe/pose_landmarker_full.task';

      const filesetResolver = await FilesetResolverClass.forVisionTasks(wasmBase);

      try {
        landmarkerRef.current = await PoseLandmarkerClass.createFromOptions(
          filesetResolver,
          {
            baseOptions: { modelAssetPath: modelPath, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.60,
            minPosePresenceConfidence: 0.60,
            minTrackingConfidence: 0.60,
          }
        );
      } catch {
        // GPU failed — fall back to CPU
        landmarkerRef.current = await PoseLandmarkerClass.createFromOptions(
          filesetResolver,
          {
            baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.60,
            minPosePresenceConfidence: 0.60,
            minTrackingConfidence: 0.60,
          }
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 480 } },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsReady(true);
      setIsLoading(false);
      startDetectLoop();
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.error('[Camera]', msg, err);
      // Log to file so we can read it without DevTools
      const api = (window as any).electronAPI;
      if (api?.logError) {
        api.logError(`[Camera Error] ${msg}`).then((logPath: string) => {
          console.log('Error logged to:', logPath);
        });
      }
      setError(msg);
      setIsLoading(false);
    }
  }, [isLoading, isReady, startDetectLoop]);

  const stopCamera = useCallback(() => {
    stopDetectLoop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (landmarkerRef.current) {
      try { landmarkerRef.current.close(); } catch { /* ignore */ }
      landmarkerRef.current = null;
    }
    lastVideoTime.current = -1;
    setIsReady(false);
    setIsLoading(false);
  }, [stopDetectLoop]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return {
    videoRef:  videoRef  as React.RefObject<HTMLVideoElement>,
    canvasRef: canvasRef as React.RefObject<HTMLCanvasElement>,
    isReady,
    isLoading,
    error,
    startCamera,
    stopCamera,
    startCalibration,
  };
}
