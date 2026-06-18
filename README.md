# 🦴 Spine Guardian AI

> **Your AI posture companion that actually talks back.**

Sits silently in your system tray, watches your posture through your webcam using on-device AI, and calls you out — in character — when you slouch. All processing happens **100% locally** — no data ever leaves your machine.

---

## ✨ Features

- **Real-time posture detection** — MediaPipe Pose (33 landmarks, GPU-accelerated WASM)
- **0–100 posture score** — updates live with smoothed temporal averaging
- **7 posture issues detected** — forward head, slouching, rounded back, uneven shoulders, forward lean, neck tilt, lying back
- **Personal calibration** — sit upright for 15s to set your personal baseline
- **9 AI personalities** — each with unique voice, tone, and escalating messages
- **3 voice modes** — Edge TTS (free, natural), ElevenLabs (premium), Browser TTS (fallback)
- **AI-generated roasts** — Pro users get GPT-4o-mini generated, never-repeat alerts
- **XP + levels + streaks** — gamified posture improvement
- **Achievement system** — unlock badges for consistent good posture
- **Analytics dashboard** — daily/weekly posture history and trends
- **Focus sessions** — timed work blocks with posture tracking
- **System tray** — runs silently in background, always watching
- **Auto-update** — gets new versions automatically via GitHub Releases
- **Supabase sync** — XP, streaks, and settings sync across reinstalls

---

## 🎭 Personalities

| Personality | Vibe |
|---|---|
| 👩 Mom Mode | Loving but relentless Hindi-English nagging |
| 🫠 Gen Z Roast | Unfiltered, unhinged, devastatingly accurate |
| 💪 Gym Bro | Peak performance motivation only |
| 🤝 Best Friend | Honest, casual, actually cares |
| ⛩️ Anime Sensei | Ancient wisdom, deep disappointment |
| 🎖️ Drill Sergeant | Military precision, zero excuses |
| 🌹 Romantic | Heartbroken every time you slouch |
| 📐 Strict Teacher | Formal, educational, detention incoming |
| 🇮🇳 Desi Yaar | Pure Hinglish roasts that hit different |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **Webcam** — built-in or external
- **Windows 10/11** — Mac support coming soon

### Development
```bash
# Install dependencies
npm install

# Run in development mode (Vite + Electron together)
npm run dev
```

The app opens immediately. Click **Start Monitoring** to activate the webcam and AI.

### Build Windows Installer
```bash
npm run build:win
```
Output: `release/Spine Guardian AI Setup 1.0.0-mvp.exe`

---

## 📸 How to Get the Best Score

- Camera at **eye level** — not above or below
- **Hips visible** in frame — don't sit too close
- **Ears directly above shoulders** — no chin jutting forward
- **Shoulders level** — not hunched or uneven
- **Face the camera straight** — no head tilt

Run **Calibrate** once with good posture — the app adjusts all thresholds to your body and camera angle.

---

## 🏗️ Architecture

```
spine-guardian/
├── electron/              # Main process (Node.js / Electron)
│   ├── main.ts            # Window, tray, IPC handlers, Edge TTS, ElevenLabs proxy
│   └── preload.ts         # Secure contextBridge to renderer
├── src/                   # Renderer (React + TypeScript)
│   ├── lib/
│   │   ├── posture-analyzer.ts   # MediaPipe landmark → score + issues
│   │   ├── calibration.ts        # Personal baseline capture + storage
│   │   ├── personalities.ts      # All 9 personalities + message pools
│   │   ├── xp-system.ts          # XP, levels, streaks
│   │   ├── achievements.ts       # Achievement definitions + unlock logic
│   │   ├── database.ts           # IndexedDB via idb (sessions, snapshots)
│   │   ├── analytics.ts          # Supabase event tracking
│   │   └── supabase.ts           # Auth + cloud sync
│   ├── hooks/
│   │   ├── usePostureDetection.ts  # MediaPipe camera loop + overlay drawing
│   │   └── useVoice.ts             # Voice pipeline (server → ElevenLabs → Edge → browser)
│   ├── store/
│   │   └── useAppStore.ts          # Zustand global state
│   ├── components/
│   │   ├── Layout.tsx              # Sidebar navigation
│   │   ├── ScoreRing.tsx           # Animated posture score circle
│   │   ├── ViolationOverlay.tsx    # Fullscreen bad posture alert
│   │   ├── AchievementToast.tsx    # Achievement unlock notification
│   │   └── CalibrationModal.tsx    # Personal baseline capture UI
│   └── pages/
│       ├── Dashboard.tsx      # Home — score, stats, quick start
│       ├── LiveMonitor.tsx    # Camera feed + real-time detection
│       ├── Analytics.tsx      # History charts
│       ├── FocusSession.tsx   # Timed work sessions
│       ├── Settings.tsx       # All configuration
│       ├── Onboarding.tsx     # First-run flow
│       ├── Auth.tsx           # Supabase auth
│       └── Upgrade.tsx        # Pro subscription / Stripe checkout
├── server/                # Express backend (Railway)
│   └── index.js           # OpenAI roast generation + ElevenLabs TTS proxy + Stripe
├── public/mediapipe/      # Bundled WASM + pose model (fully offline)
├── electron-builder.config.cjs
├── vite.config.ts
└── .github/workflows/
    ├── ci.yml             # Build check on every push to main
    └── release.yml        # Auto-build Windows + Mac on version tag
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root:

```env
VITE_SERVER_URL=https://your-railway-server.up.railway.app
VITE_SERVER_SECRET=your_secret_here
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Create a `server/.env` file:

```env
OPENAI_API_KEY=your_openai_key
ELEVENLABS_API_KEY=your_elevenlabs_key
API_SECRET=your_secret_here
STRIPE_SECRET_KEY=your_stripe_key
PORT=3001
```

---

## 🚢 Releasing a New Version

```bash
# Tag the version — GitHub Actions builds Windows + Mac automatically
git tag v1.0.1
git push origin v1.0.1
```

GitHub Actions will:
1. Build `Spine Guardian AI Setup v1.0.1.exe` on Windows runner
2. Build `Spine Guardian AI v1.0.1.dmg` on Mac runner
3. Publish both to GitHub Releases automatically

---

## ⚙️ Settings

| Setting | Description |
|---|---|
| Sensitivity | How strict detection is (0.5x = lenient, 2x = strict) |
| Voice Volume | Volume of alerts (0–100%) |
| Alert Delay | Bad posture duration before alert fires (5–60s) |
| Cooldown | Minimum time between alerts (30s–10min) |
| Voice Mode | Edge TTS / ElevenLabs / Browser TTS |
| Personality | Which character calls you out |

---

## 🔒 Privacy

**100% local processing.** No webcam images, video frames, posture data, or biometric information is ever transmitted to any server. MediaPipe runs entirely in WASM on your machine. The only network calls are voice generation (Edge TTS via Microsoft, ElevenLabs if configured) and optional Supabase sync for your XP/streaks.

---

## 📄 License

MIT — see [LICENSE](LICENSE)
