import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  showWindow: () => ipcRenderer.invoke('show-window'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  platform: process.platform,
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: (): Promise<{ status: string }> => ipcRenderer.invoke('check-for-updates'),
  showTrayNotification: (title: string, content: string) =>
    ipcRenderer.invoke('show-tray-notification', title, content),
  getLaunchOnStartup: (): Promise<boolean> =>
    ipcRenderer.invoke('get-launch-on-startup'),
  setLaunchOnStartup: (enable: boolean): Promise<void> =>
    ipcRenderer.invoke('set-launch-on-startup', enable),

  // ElevenLabs proxy — fetch runs in main process, no CSP/network blocks
  elevenLabsSpeak: (
    text: string,
    voiceId: string,
    apiKey: string
  ): Promise<{ ok: true; base64: string } | { ok: false; error: string }> =>
    ipcRenderer.invoke('elevenlabs-speak', text, voiceId, apiKey),

  // ElevenLabs API key validation proxy
  elevenLabsPing: (
    apiKey: string
  ): Promise<{ ok: boolean; status: number; body: string }> =>
    ipcRenderer.invoke('elevenlabs-ping', apiKey),

  // Edge TTS — free natural Microsoft voices
  edgeTtsSpeak: (
    text: string,
    voice: string,
    rate: string,
    pitch: string
  ): Promise<{ ok: true; base64: string } | { ok: false; error: string }> =>
    ipcRenderer.invoke('edge-tts-speak', text, voice, rate, pitch),

  // OpenAI dynamic message generation
  openAiGenerateMessage: (
    apiKey: string,
    personalityName: string,
    personalityDescription: string,
    score: number,
    issues: string[],
    badSeconds: number,
    isViolation: boolean
  ): Promise<{ ok: true; message: string } | { ok: false; error: string }> =>
    ipcRenderer.invoke(
      'openai-generate-message',
      apiKey, personalityName, personalityDescription,
      score, issues, badSeconds, isViolation
    ),
});
