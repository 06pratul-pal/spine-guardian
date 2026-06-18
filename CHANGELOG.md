# Changelog

All notable changes to Spine Guardian AI are documented here.

---

## [1.0.0-mvp] — 2026-06-18

### Added
- Initial MVP release
- Real-time posture detection via MediaPipe Pose (33 landmarks, WASM + GPU)
- 0–100 posture score with temporal smoothing
- 7 posture issue types: forward head, slouching, rounded back, uneven shoulders, forward lean, neck tilt, lying back
- 9 personalities: Mom Mode, Gen Z Roast, Gym Bro, Best Friend, Anime Sensei, Drill Sergeant, Romantic, Strict Teacher, Desi Yaar
- 3 voice modes: Edge TTS (free), ElevenLabs (premium), Browser TTS (fallback)
- AI-generated roasts via GPT-4o-mini (Pro users)
- Personal posture calibration — 15s baseline capture
- XP system with levels, streaks, and achievements
- Analytics dashboard with posture history
- Focus session mode
- System tray — minimizes to background, keeps monitoring
- Supabase auth + cloud sync for XP/streaks/settings
- Stripe subscription for Pro tier
- Auto-update via electron-updater + GitHub Releases
- Sentry crash reporting
- GitHub Actions CI/CD — auto-builds Windows + Mac on version tag

### Fixed
- Camera error showing `[object Event]` — MediaPipe WASM path was wrong in packaged Electron
- `lying_back` false positive on laptop cameras above eye level
- Edge TTS crashing — wrong API (class-based) replaced with correct function-based import
- CSP blocking WASM fetch in packaged app — added `file:` to all relevant directives
- Stale `sessionGoodSeconds`/`sessionBadSeconds` in session save closure
- Violation overlay never dismissing — now auto-dismisses after 15s
- Camera error and "Camera is off" showing simultaneously — made mutually exclusive
- MediaPipe singleton stuck on failed load — added retry and deduplication
- Server fetch hanging 30s before fallback — added 3s AbortController timeout
- Streak conflict on cloud sync — now keeps highest streak independently from XP

### Security
- Removed committed API keys from `server/.env`
- Untracked `.env` files from git
- Enabled `webSecurity: true` in BrowserWindow
- Enabled `asar: true` with mediapipe unpack in electron-builder
