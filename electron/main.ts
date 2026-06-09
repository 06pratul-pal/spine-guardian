import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell, Notification, net, dialog } from 'electron';
import path from 'path';
import * as Sentry from '@sentry/electron/main';
import { autoUpdater } from 'electron-updater';

// ── Sentry crash reporting ────────────────────────────────────────────────────
// Replace SENTRY_DSN with your actual DSN from sentry.io
// Get it free at: https://sentry.io → New Project → Electron
const SENTRY_DSN = process.env.SENTRY_DSN || '';
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: app.isPackaged ? 'production' : 'development',
    release: app.getVersion(),
  });
}

// ── Auto-updater config ───────────────────────────────────────────────────────
autoUpdater.autoDownload    = true;   // download silently in background
autoUpdater.autoInstallOnAppQuit = true; // install when user quits

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
      webSecurity: false,
      backgroundThrottling: false,   // keep JS timers running when window is hidden
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
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data:; " +
          "connect-src 'self' http://localhost:3001 https://localhost:3001 https://*.railway.app https://*.up.railway.app https://api.elevenlabs.io https://api.openai.com blob: data:; " +
          "media-src 'self' blob: data:; " +
          "worker-src blob: 'self';"
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
  createWindow();
  createTray();

  // ── Auto-update ─────────────────────────────────────────────────────────
  if (app.isPackaged) {
    // Check for updates 3 seconds after launch (don't block startup)
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn('[updater] check failed:', (err as Error)?.message);
      });
    }, 3000);

    autoUpdater.on('update-available', (info) => {
      showTrayBalloon(
        'Update available',
        `Spine Guardian ${info.version} is downloading in the background…`
      );
    });

    autoUpdater.on('update-downloaded', (info) => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update ready',
        message: `Spine Guardian ${info.version} is ready to install.`,
        detail: 'Restart now to apply the update, or it will install on next quit.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) {
          isQuitting = true;
          autoUpdater.quitAndInstall();
        }
      });
    });

    autoUpdater.on('error', (err) => {
      console.error('[updater] error:', (err as Error)?.message);
      if (SENTRY_DSN) Sentry.captureException(err);
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
  if (!app.isPackaged) return { status: 'dev' };
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  return { status: 'checking' };
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
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { EdgeTTS } = require('edge-tts') as { EdgeTTS: new () => any };
      const tts = new EdgeTTS();
      const chunks: Buffer[] = [];

      await tts.ttsPromise(text, voice || 'en-US-JennyNeural', {
        rate:  rate  || '+0%',
        pitch: pitch || '+0Hz',
      });

      for await (const chunk of tts.toStream()) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const base64 = Buffer.concat(chunks).toString('base64');
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
