import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BrowserWindow, dialog, ipcMain } from 'electron';

let mainWindow: BrowserWindow | null = null;
let latestInfo: UpdateInfo | null = null;

export function initUpdater(window: BrowserWindow) {
  mainWindow = window;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;

  autoUpdater.on('checking-for-update', () => {
    sendToRenderer('update:status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    latestInfo = info;
    sendToRenderer('update:status', { status: 'available', version: info.version, releaseDate: info.releaseDate });
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available. Do you want to download it?`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    latestInfo = null;
    sendToRenderer('update:status', { status: 'up-to-date' });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update:progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendToRenderer('update:status', { status: 'downloaded', version: info.version });
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded. Restart to apply the update.`,
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err);
    sendToRenderer('update:status', { status: 'error', message: err.message });
  });

  ipcMain.handle('app:checkForUpdates', () => checkForUpdates());
  ipcMain.handle('app:downloadUpdate', () => {
    autoUpdater.downloadUpdate();
  });
  ipcMain.handle('app:installUpdate', () => {
    autoUpdater.quitAndInstall();
  });
  ipcMain.handle('app:getUpdateInfo', () => {
    if (latestInfo) {
      return { version: latestInfo.version, releaseDate: latestInfo.releaseDate };
    }
    return null;
  });
}

export function checkForUpdates() {
  try {
    autoUpdater.checkForUpdates().catch(() => {
      sendToRenderer('update:status', { status: 'error', message: 'No internet connection' });
    });
  } catch (err: any) {
    sendToRenderer('update:status', { status: 'error', message: err.message });
  }
}

function sendToRenderer(channel: string, data: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}
