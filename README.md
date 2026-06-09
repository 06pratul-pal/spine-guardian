# 🦴 Spine Guardian AI

**Your AI posture companion that actually talks back.**

Sits silently in your system tray, watches your posture through the webcam using on-device AI, and calls you out with personality when you slouch. All processing happens 100% locally — no data ever leaves your machine.

---

## MVP Personalities

| Mode | Vibe |
|---|---|
| 👩 Mom Mode | Loving but relentless Hindi-English nagging |
| 🫠 Gen Z Roast | Unfiltered, unhinged, devastatingly accurate |
| 💪 Gym Bro | Peak performance motivation only |
| 🤝 Best Friend | Honest, casual, actually cares |

---

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Webcam** — built-in or external
- **Internet on first run** — to download the MediaPipe pose model (~3MB, cached after)
- **Windows 10/11** (or macOS)

---

## Quick Start (Development)

```bash
# 1. Install dependencies
npm install

# 2. Run in development mode
npm run dev
```

This opens the app window immediately. The webcam and AI activate when you click **Start Monitoring**.

---

## Build for Windows

```bash
# Build the app + create Windows installer
npm run build:win
```

Output: `release/Spine Guardian AI Setup.exe`

---

## How It Works

1. **MediaPipe Pose** — runs in the renderer (Chromium) context, fully offline after first model download
2. **Posture Analysis** — checks shoulder symmetry, head position, neck forward lean, screen distance
3. **Scoring** — 0–100 score, updates in real time
4. **Alerts** — bad posture for 10+ seconds triggers voice alert
5. **Violation Overlay** — very bad posture (< 40 score) for 30+ seconds triggers dramatic fullscreen alert
6. **System Tray** — close the window to minimize to tray; double-click icon to restore

---

## Architecture Notes

```
spine-guardian/
├── electron/          # Main process (Node.js / Electron)
│   ├── main.ts        # Window, tray, IPC
│   └── preload.ts     # Secure bridge to renderer
├── src/               # Renderer (React + TypeScript)
│   ├── lib/           # Personalities, posture analysis, XP
│   ├── hooks/         # MediaPipe integration, Web Speech API
│   ├── store/         # Zustand global state
│   ├── components/    # Layout, ScoreRing, ViolationOverlay
│   └── pages/         # Dashboard, LiveMonitor, Settings
├── vite.config.ts     # Renderer bundler
└── tsconfig.*.json    # Renderer + electron separate configs
```

**State persistence:** `localStorage` (no external DB for MVP)  
**Voice:** Web Speech API (built-in browser TTS, free, offline)  
**Pose detection:** MediaPipe Tasks Vision (WASM, GPU-accelerated)

---

## ElevenLabs Voice (Future)

The voice system is designed for easy upgrade. When you're ready:

1. Set up a backend server with your ElevenLabs API key
2. Replace `useVoice.ts` to call your server instead of Web Speech API
3. Add subscription validation as middleware on the backend
4. Your API key never touches the user's machine

---

## Settings

| Setting | Description |
|---|---|
| Sensitivity | How strict posture detection is (0.5x = lenient, 2x = strict) |
| Voice Volume | Volume of voice alerts (0–100%) |
| Alert Delay | How long bad posture lasts before an alert fires (5–60s) |
| Cooldown | Minimum time between consecutive alerts (1–10 min) |

---

## Privacy

> **100% Local Processing.** No webcam images, video frames, posture data, or any user information is ever transmitted to any server. Everything runs on your machine.
