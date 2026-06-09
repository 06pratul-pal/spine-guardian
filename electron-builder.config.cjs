/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.spineguardian.app',
  productName: 'Spine Guardian AI',
  copyright: `Copyright © ${new Date().getFullYear()} Spine Guardian AI`,

  directories: {
    output: 'release',
  },

  files: [
    'dist/**',
    'dist-electron/**',
    'node_modules/**',
    'package.json',
  ],

  extraResources: [
    {
      from: 'dist/renderer/mediapipe',
      to:   'mediapipe',
      filter: ['**/*'],
    },
  ],

  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    // Icon is generated programmatically in main.ts — no .ico file needed.
    // To use a custom icon later, place icon.ico in build-resources/ and set:
    // icon: 'build-resources/icon.ico',
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

  // Publish config left empty — fill in when you set up auto-updates
  publish: null,
};
