import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell, Notification, net, dialog, session as electronSession } from 'electron';
import path from 'path';

// Safe imports — wrapped to prevent startup crashes if packages missing
let Sentry: any = null;
let autoUpdater: any = null;

try {
  Sentry = require('@sentry/electron/main');
} catch { /* Sentry not available */ }

try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch { /* electron-updater not available */ }

// ── Sentry crash reporting ────────────────────────────────────────────────────
const SENTRY_DSN = process.env.SENTRY_DSN || '';
if (SENTRY_DSN && Sentry) {
  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: app.isPackaged ? 'production' : 'development',
      release: app.getVersion(),
    });
  } catch { /* ignore */ }
}

// ── Auto-updater config ───────────────────────────────────────────────────────
if (autoUpdater) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
}

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createAppIcon(size: number): Electron.NativeImage {
  const buffer = Buffer.alloc(size * size * 4);
  const cx = size / 2 - 0.5;
  const cy = size / 2 - 0.5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const r = size / 2;

      if (dist <= r) {
        // Purple gradient circle
        const t = dist / r;
        const innerR = Math.round(124 + (167 - 124) * t);
        const innerG = Math.round(58 + (139 - 58) * t);
        const innerB = Math.round(237 + (250 - 237) * t);
        buffer[idx] = innerR;
        buffer[idx + 1] = innerG;
        buffer[idx + 2] = innerB;
        buffer[idx + 3] = 255;

        // Draw a simple spine shape (vertical bar in center)
        const spineW = Math.max(2, size * 0.12);
        const spineH = size * 0.55;
        const spineX = Math.abs(x - cx);
        const spineY = Math.abs(y - cy);

        if (spineX <= spineW && spineY <= spineH / 2) {
          buffer[idx] = 255;
          buffer[idx + 1] = 255;
          buffer[idx + 2] = 255;
          buffer[idx + 3] = 255;
        }

        // Draw two horizontal "vertebrae" marks
        const verts = [0.18, -0.18];
        for (const vy of verts) {
          const vertY = cy + vy * size;
          const vertW = spineW * 2.5;
          if (Math.abs(x - cx) <= vertW && Math.abs(y - vertY) <= Math.max(1, size * 0.04)) {
            buffer[idx] = 255;
            buffer[idx + 1] = 255;
            buffer[idx + 2] = 255;
            buffer[idx + 3] = 255;
          }
        }
      } else {
        buffer[idx + 3] = 0;
      }
    }
  }
  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

function createWindow(): void {
  const icon = createAppIcon(64);

  // Set up camera permissions BEFORE creating the window
  electronSession.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'camera', 'microphone', 'mediaKeySystem', 'geolocation', 'notifications'];
    callback(allowed.includes(permission));
  });
  electronSession.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowed = ['media', 'camera', 'microphone'];
    return allowed.includes(permission);
  });

  // Also set for partitioned session
  const partSession = electronSession.fromPartition('persist:spineguardian');
  partSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'camera', 'microphone', 'mediaKeySystem', 'geolocation', 'notifications'];
    callback(allowed.includes(permission));
  });
  partSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowed = ['media', 'camera', 'microphone'];
    return allowed.includes(permission);
  });

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 920,
    minHeight: 600,
    backgroundColor: '#0a0a0f',
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
    title: 'Spine Guardian AI',
    show: false,
    frame: true,
    autoHideMenuBar: true,
  });

  if (isDev) {
    void mainWindow.loadURL('http://localhost:5173');
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    // Ensure audio is never muted in background
    mainWindow?.webContents.setAudioMuted(false);
    if (isDev) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // Keep audio unmuted whenever window visibility changes
  mainWindow.on('hide', () => {
    mainWindow?.webContents.setAudioMuted(false);
  });
  mainWindow.on('show', () => {
    mainWindow?.webContents.setAudioMuted(false);
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      showTrayBalloon('Minimized to tray', 'Spine Guardian is still watching your posture in the background.');
    }
  });

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' file: blob: data:; " +
          "connect-src 'self' file: blob: data: http://localhost:* https://localhost:* https://*.railway.app https://*.up.railway.app https://api.elevenlabs.io https://api.openai.com https://*.supabase.co; " +
          "media-src 'self' file: blob: data: mediastream:; " +
          "worker-src blob: 'self' file:;"
        ],
      },
    });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
}

function showTrayBalloon(title: string, content: string): void {
  if (tray) {
    tray.displayBalloon({ iconType: 'info', title, content });
  } else if (Notification.isSupported()) {
    new Notification({ title, body: content }).show();
  }
}

function createTray(): void {
  const icon = createAppIcon(32);
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: '🦴 Spine Guardian AI', enabled: false },
    { type: 'separator' },
    {
      label: 'Open App',
      click: () => { mainWindow?.show(); mainWindow?.focus(); },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { isQuitting = true; app.quit(); },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('Spine Guardian AI — Watching your posture');

  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

app.whenReady().then(() => {
  // Register deep link protocol — handles spine-guardian://auth/... URLs
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('spine-guardian', process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient('spine-guardian');
  }

  createWindow();
  createTray();

  // ── Auto-update ─────────────────────────────────────────────────────────
  if (app.isPackaged && autoUpdater) {
    setTimeout(() => {
      try { autoUpdater.checkForUpdatesAndNotify().catch(() => {}); } catch {}
    }, 3000);

    autoUpdater.on('update-available', (info: any) => {
      showTrayBalloon('Update available', `Spine Guardian ${info.version} is downloading…`);
    });

    autoUpdater.on('update-downloaded', (info: any) => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update ready',
        message: `Spine Guardian ${info.version} is ready to install.`,
        detail: 'Restart now to apply the update, or it will install on next quit.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) { isQuitting = true; autoUpdater.quitAndInstall(); }
      });
    });

    autoUpdater.on('error', (err: Error) => {
      console.error('[updater] error:', err?.message);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

// Handle deep link on Windows — app is opened via spine-guardian:// URL
app.on('second-instance', (_event, commandLine) => {
  // Someone opened the app with a deep link while it was already running
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  // Extract the deep link URL and send to renderer
  const url = commandLine.find((arg) => arg.startsWith('spine-guardian://'));
  if (url) {
    mainWindow?.webContents.send('deep-link', url);
  }
});

// Handle deep link on Mac
app.on('open-url', (_event, url) => {
  mainWindow?.webContents.send('deep-link', url);
});

// --- IPC Handlers ---

ipcMain.handle('minimize-to-tray', () => {
  mainWindow?.hide();
  showTrayBalloon(
    'Running in background',
    'Spine Guardian is watching your posture. Double-click the tray icon to reopen.'
  );
});

ipcMain.handle('show-window', () => {
  mainWindow?.show();
  mainWindow?.focus();
});

ipcMain.handle('get-platform', () => process.platform);

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('check-for-updates', () => {
  if (!app.isPackaged || !autoUpdater) return { status: 'dev' };
  try { autoUpdater.checkForUpdatesAndNotify().catch(() => {}); } catch {}
  return { status: 'checking' };
});

// Debug logger — writes errors to a log file you can read
ipcMain.handle('log-error', (_event, message: string) => {
  const logPath = path.join(app.getPath('userData'), 'debug.log');
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    require('fs').appendFileSync(logPath, line);
    console.error('[renderer]', message);
  } catch { /* ignore */ }
  return logPath;
});

ipcMain.handle('show-tray-notification', (_event, title: string, content: string) => {
  showTrayBalloon(title, content);
});

ipcMain.handle('get-launch-on-startup', () => {
  if (!app.isPackaged) return false;
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('set-launch-on-startup', (_event, enable: boolean) => {
  if (!app.isPackaged) return;
  app.setLoginItemSettings({
    openAtLogin: enable,
    openAsHidden: true,
  });
});

// ElevenLabs TTS proxy — runs in main process so there are zero network/CSP restrictions
ipcMain.handle(
  'elevenlabs-speak',
  async (
    _event,
    text: string,
    voiceId: string,
    apiKey: string
  ): Promise<{ ok: true; base64: string } | { ok: false; error: string }> => {
    try {
      const response = await net.fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2_5',
            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.80,
              style: 0.3,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return { ok: false, error: `ElevenLabs ${response.status}: ${errText.slice(0, 200)}` };
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return { ok: true, base64 };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
);

// ElevenLabs API key validation proxy
ipcMain.handle(
  'elevenlabs-ping',
  async (_event, apiKey: string): Promise<{ ok: boolean; status: number; body: string }> => {
    try {
      const response = await net.fetch('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': apiKey },
      });
      const body = await response.text().catch(() => '');
      return { ok: response.ok, status: response.status, body };
    } catch (err) {
      return { ok: false, status: 0, body: err instanceof Error ? err.message : 'Network error' };
    }
  }
);

// ── Edge TTS — free, natural Microsoft voices, no API key needed ──────────────
// edge-tts v1 exports a plain `tts(text, options)` function that returns a Buffer.
// It is an ES module, so we must use a dynamic import() — NOT require().
ipcMain.handle(
  'edge-tts-speak',
  async (
    _event,
    text: string,
    voice: string,
    rate: string,
    pitch: string
  ): Promise<{ ok: true; base64: string } | { ok: false; error: string }> => {
    try {
      // Dynamic import works for both CJS host and ESM package
      const edgeTts = await import('edge-tts');
      // The package exports a `tts` function directly
      const ttsFunc = (edgeTts as any).tts as (
        text: string,
        options?: { voice?: string; rate?: string; pitch?: string }
      ) => Promise<Buffer>;

      const audioBuffer = await ttsFunc(text, {
        voice: voice || 'en-US-JennyNeural',
        rate:  rate  || '+0%',
        pitch: pitch || '+0Hz',
      });

      const base64 = audioBuffer.toString('base64');
      return { ok: true, base64 };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Edge TTS error',
      };
    }
  }
);

// ── OpenAI dynamic message generation ─────────────────────────────────────────
ipcMain.handle(
  'openai-generate-message',
  async (
    _event,
    apiKey: string,
    personalityName: string,
    personalityDescription: string,
    score: number,
    issues: string[],
    badSeconds: number,
    isViolation: boolean
  ): Promise<{ ok: true; message: string } | { ok: false; error: string }> => {
    try {
      const issueText = issues.length > 0
        ? `Detected posture issues: ${issues.join(', ')}.`
        : 'General poor posture detected.';

      const urgency = isViolation
        ? `Give ONE extremely urgent, direct intervention (max 20 words). The user has been slouching for ${badSeconds} seconds at score ${score}/100.`
        : `Give ONE short, fresh, unique posture reminder (max 15 words). The user has been slouching for ${badSeconds} seconds at score ${score}/100.`;

      const prompt = `You are "${personalityName}": ${personalityDescription}. ${issueText} ${urgency} Stay completely in character. No hashtags, no emojis, just authentic speech. Never repeat a message you have said before.`;

      const response = await net.fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 60,
          temperature: 0.95,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return { ok: false, error: `OpenAI ${response.status}: ${errText.slice(0, 100)}` };
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
      };
      const message = data.choices[0]?.message?.content?.trim() ?? '';
      if (!message) return { ok: false, error: 'Empty response from OpenAI' };
      return { ok: true, message };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'OpenAI error',
      };
    }
  }
);
