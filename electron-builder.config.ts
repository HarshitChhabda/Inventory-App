import type { Configuration } from 'electron-builder';

const config: Configuration = {
  appId: 'com.mahaveerji.inventory',
  productName: 'Mahaveerji Inventory',
  directories: {
    output: 'dist',
    buildResources: 'build',
  },
  files: [
    'dist/**/*',
    'dist-electron/**/*',
    'node_modules/.prisma/**/*',
    'node_modules/@prisma/client/**/*',
  ],
  asarUnpack: [
    '**/*.node',
  ],
  extraResources: [
    {
      from: 'node_modules/.prisma',
      to: 'node_modules/.prisma',
      filter: ['**/*'],
    },
    {
      from: 'node_modules/@prisma/client',
      to: 'node_modules/@prisma/client',
      filter: ['**/*'],
    },
    {
      from: 'prisma/dev.db',
      to: 'prisma/dev.db',
    },
  ],
  publish: [
    {
      provider: 'github',
      owner: 'HarshitChhabda',
      repo: 'Inventory-App',
      releaseType: 'release',
    },
  ],
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    icon: 'build/icon.ico',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Mahaveerji Inventory',
  },
  mac: {
    target: 'dmg',
    icon: 'build/icon.icns',
  },
  linux: {
    target: 'AppImage',
    icon: 'build/icon.png',
  },
};

export default config;
