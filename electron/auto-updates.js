const path = require('path');
const { BrowserWindow, app, dialog } = require('electron');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

let initialized = false;
let updateReady = false;

const resolvePromptWindow = (preferredWindow) => {
  if (preferredWindow && !preferredWindow.isDestroyed()) return preferredWindow;
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows().find((window) => !window.isDestroyed()) || null;
};

const configureLogger = () => {
  log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'updater.log');
  autoUpdater.logger = log;
};

const disableUnsignedUpdateVerificationForInternalBuilds = () => {
  if (process.platform !== 'win32') return;
  if (process.env.OPENFMV_VERIFY_UPDATE_SIGNATURE === '1') return;
  if (!('verifyUpdateCodeSignature' in autoUpdater)) return;
  autoUpdater.verifyUpdateCodeSignature = async () => null;
};

const configureFeedOverride = () => {
  const updateUrl = process.env.OPENFMV_UPDATE_URL;
  if (!updateUrl) return;
  autoUpdater.setFeedURL({ provider: 'generic', url: updateUrl });
};

const promptToInstall = async (preferredWindow, updateInfo) => {
  if (updateReady) return;
  updateReady = true;
  const targetWindow = resolvePromptWindow(preferredWindow);
  const options = {
    type: 'info',
    buttons: ['Restart and install', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'OpenFMV update ready',
    message: `OpenFMV ${updateInfo.version} has been downloaded.`,
    detail: 'Restart OpenFMV now to install the update, or keep working and install it later.',
    noLink: true,
  };
  const result = targetWindow
    ? await dialog.showMessageBox(targetWindow, options)
    : await dialog.showMessageBox(options);

  if (result.response === 0) {
    autoUpdater.quitAndInstall(false, true);
  }
};

const initializeAutoUpdates = (mainWindow) => {
  if (initialized || !app.isPackaged || process.env.OPENFMV_DISABLE_AUTO_UPDATE === '1') return;
  initialized = true;

  configureLogger();
  configureFeedOverride();
  disableUnsignedUpdateVerificationForInternalBuilds();

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for OpenFMV updates.');
  });

  autoUpdater.on('update-available', (info) => {
    log.info(`OpenFMV update available: ${info.version}`);
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info(`OpenFMV is up to date: ${info.version}`);
  });

  autoUpdater.on('download-progress', (progress) => {
    log.info(`OpenFMV update download progress: ${Math.round(progress.percent || 0)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info(`OpenFMV update downloaded: ${info.version}`);
    void promptToInstall(mainWindow, info);
  });

  autoUpdater.on('error', (error) => {
    log.warn('OpenFMV update check failed:', error);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      log.warn('OpenFMV update check failed:', error);
    });
  }, 5000);
};

module.exports = {
  initializeAutoUpdates,
};
