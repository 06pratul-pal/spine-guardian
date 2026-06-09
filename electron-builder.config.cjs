/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.spineguardian.app',
  productName: 'Spine Guardian AI',
  copyright: `Copyright © ${new Date().getFullYear()} Spine Guardian AI`,

  directories: {
    output: 'release',
    buildResources: 'build-resources',
  },

  files: [
    'dist-electron/**',
    'dist/renderer/**',
    'package.json',
  ],

  asar: true,

  // ── Auto-update: publish to GitHub Releases ────────────────────────────────
  // Set GH_TOKEN env var when building to push releases automatically.
  // Get a token at: GitHub → Settings → Developer settings → Personal access tokens
  publish: {
    provider: 'github',
    owner: '06pratul-pal',
    repo: 'spine-guardian',
    releaseType: 'release',
  },

  // ── Windows ───────────────────────────────────────────────────────────────
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    allowElevation: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Spine Guardian AI',
    runAfterFinish: true,
    deleteAppDataOnUninstall: false,
  },

  // ── Mac ───────────────────────────────────────────────────────────────────
  // Requires Apple Developer account ($99/yr) for notarization in production.
  // For testing: build works unsigned, just can't distribute via App Store.
  mac: {
    target: [{ target: 'dmg', arch: ['x64', 'arm64'] }],
    category: 'public.app-category.healthcare-fitness',
    // For signed builds set: CSC_LINK, CSC_KEY_PASSWORD, APPLE_ID, APPLE_ID_PASS env vars
  },

  dmg: {
    title: 'Spine Guardian AI',
    background: null,
    window: { width: 540, height: 380 },
  },
};
