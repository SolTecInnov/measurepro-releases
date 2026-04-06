const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { SerialPort } = require('serialport');

const isDev = process.env.IS_DEV === 'true';

// ── Auto-Updater ────────────────────────────────────────────────────────────
let autoUpdater = null;
try {
  const { autoUpdater: au } = require('electron-updater');
  autoUpdater = au;
  autoUpdater.autoDownload = false; // User chooses when to download
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = { info: (m) => writeLog('UPDATER', m), warn: (m) => writeLog('UPDATER', m), error: (m) => writeLog('UPDATER', m) };
} catch(e) {
  // electron-updater not available in dev
}

// Update preference: 'auto' | 'notify' | 'manual' (saved in userData)
function getUpdatePref() {
  try {
    const p = path.join(app.getPath('userData'), 'update-pref.json');
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')).pref : 'notify';
  } catch { return 'notify'; }
}
function setUpdatePref(pref) {
  const p = path.join(app.getPath('userData'), 'update-pref.json');
  fs.writeFileSync(p, JSON.stringify({ pref }));
}

// Log file for headless debugging
const logFile = path.join(app.getPath('userData'), 'renderer.log');
function writeLog(level, msg) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
}
writeLog('MAIN', `App starting. Log: ${logFile}`);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'MeasurePRO',
    icon: process.platform === 'win32' ? path.join(__dirname, '../build-resources/icon.ico') : path.join(__dirname, '../build-resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  // Capture renderer console output to log file
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levels = ['verbose', 'info', 'warning', 'error'];
    writeLog(levels[level] || 'info', `${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    writeLog('error', `did-fail-load: ${code} ${desc} ${url}`);
  });

  mainWindow.webContents.on('crashed', () => writeLog('error', 'Renderer CRASHED'));

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    // DevTools removed from production — use View > Toggle DevTools if needed
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (tray && !app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
      tray.displayBalloon && tray.displayBalloon({
        iconType: 'info',
        title: 'MeasurePRO',
        content: 'MeasurePRO is still running. Click the tray icon to reopen.'
      });
    }
  });

  createMenu();
  setupAutoUpdater();
}

function setupAutoUpdater() {
  if (!autoUpdater || isDev) return;

  autoUpdater.on('update-available', (info) => {
    writeLog('UPDATER', `Update available: ${info.version}`);
    const pref = getUpdatePref();

    if (pref === 'auto') {
      autoUpdater.downloadUpdate();
      mainWindow.webContents.send('update-status', { status: 'downloading', version: info.version });
    } else if (pref === 'notify') {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Mise à jour disponible',
        message: `MeasurePRO ${info.version} est disponible`,
        detail: `Vous avez la version ${app.getVersion()}. Voulez-vous télécharger la mise à jour?`,
        buttons: ['Télécharger', 'Plus tard', 'Ignorer cette version'],
        defaultId: 0,
        cancelId: 1
      }).then(({ response }) => {
        if (response === 0) {
          autoUpdater.downloadUpdate();
          mainWindow.webContents.send('update-status', { status: 'downloading', version: info.version });
        }
      });
    }
    // 'manual' = do nothing until user clicks "Check for updates"
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('update-status', {
      status: 'progress',
      percent: Math.round(progress.percent),
      speed: Math.round(progress.bytesPerSecond / 1024)
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    writeLog('UPDATER', `Update downloaded: ${info.version}`);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Mise à jour prête',
      message: `MeasurePRO ${info.version} est prêt à installer`,
      detail: 'La mise à jour sera installée à la fermeture de l\'application.',
      buttons: ['Redémarrer maintenant', 'Plus tard'],
      defaultId: 0
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    writeLog('UPDATER', `Error: ${err.message}`);
  });

  autoUpdater.on('update-not-available', () => {
    writeLog('UPDATER', 'No update available');
  });

  // Check on launch (after 3s delay to let app load)
  setTimeout(() => autoUpdater.checkForUpdates().catch(e => writeLog('UPDATER', e.message)), 3000);
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Settings',
      submenu: [
        // Hardware
        { label: '📡 Laser & GPS',        click: () => mainWindow.webContents.send('menu-navigate-tab', 'laser-gps') },
        { label: '⇄ Lateral / Rear Laser', click: () => mainWindow.webContents.send('menu-navigate-tab', 'lateral-rear') },
        { label: '🛰 GNSS / Duro',        click: () => mainWindow.webContents.send('menu-navigate-tab', 'gnss') },
        { label: '📷 Camera',             click: () => mainWindow.webContents.send('menu-navigate-tab', 'camera') },
        { label: '🎯 Calibration',        click: () => mainWindow.webContents.send('menu-navigate-tab', 'calibration') },
        { type: 'separator' },
        // Detection
        { label: '📶 Detection',          click: () => mainWindow.webContents.send('menu-navigate-tab', 'detection') },
        { label: '🧠 AI+',                click: () => mainWindow.webContents.send('menu-navigate-tab', 'ai') },
        { type: 'separator' },
        // Display
        { label: '🖼️ Logo',               click: () => mainWindow.webContents.send('menu-navigate-tab', 'logo') },
        { label: '🗺️ Map',                click: () => mainWindow.webContents.send('menu-navigate-tab', 'map') },
        { label: '🖥️ Display',            click: () => mainWindow.webContents.send('menu-navigate-tab', 'display') },
        { type: 'separator' },
        // Data
        { label: '📄 Logging',            click: () => mainWindow.webContents.send('menu-navigate-tab', 'logging') },
        { label: '🔔 Alerts',             click: () => mainWindow.webContents.send('menu-navigate-tab', 'alerts') },
        { label: '📧 Email',              click: () => mainWindow.webContents.send('menu-navigate-tab', 'email') },
        { label: '💾 Backup',             click: () => mainWindow.webContents.send('menu-navigate-tab', 'backup') },
        { type: 'separator' },
        // System
        { label: '🎤 Voice',              click: () => mainWindow.webContents.send('menu-navigate-tab', 'voice') },
        { label: '⌨️ Keyboard',           click: () => mainWindow.webContents.send('menu-navigate-tab', 'keyboard') },
        { label: '🔧 Developer',          click: () => mainWindow.webContents.send('menu-navigate-tab', 'developer') },
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: '📖 User Manual',
          click: () => {
            const manualWin = new BrowserWindow({
              width: 1100,
              height: 800,
              title: 'MeasurePRO — User Manual',
              icon: process.platform === 'win32'
                ? path.join(__dirname, '../build-resources/icon.ico')
                : path.join(__dirname, '../build-resources/icon.png'),
              webPreferences: { contextIsolation: true, nodeIntegration: false },
            });
            const manualPath = isDev
              ? 'http://localhost:5173/manual.html'
              : path.join(__dirname, '../dist/manual.html');
            if (isDev) {
              manualWin.loadURL(manualPath);
            } else {
              manualWin.loadFile(path.join(__dirname, '../dist/manual.html'));
            }
          }
        },
        {
          label: '❓ Help & FAQ',
          click: () => mainWindow.webContents.send('menu-navigate', '/help')
        },
        {
          label: '🚀 Quick Start Guide',
          click: () => mainWindow.webContents.send('menu-navigate', '/welcome')
        },
        { type: 'separator' },
        {
          label: '🎫 Submit a Support Ticket',
          click: () => shell.openExternal('mailto:support@soltecinnovation.com?subject=MeasurePRO%20Support%20Request')
        },
        {
          label: '🌐 Visit soltecinnovation.com',
          click: () => shell.openExternal('https://soltecinnovation.com')
        },
        { type: 'separator' },
        {
          label: '🔄 Vérifier les mises à jour',
          click: () => {
            if (!autoUpdater || isDev) {
              dialog.showMessageBox(mainWindow, {
                type: 'info', title: 'Mises à jour',
                message: 'Vérification non disponible en mode développement.'
              });
              return;
            }
            autoUpdater.checkForUpdates()
              .then(result => {
                if (!result || !result.updateInfo) {
                  dialog.showMessageBox(mainWindow, {
                    type: 'info', title: 'MeasurePRO est à jour',
                    message: `Vous avez la dernière version (${app.getVersion()}).`
                  });
                }
              })
              .catch(e => {
                dialog.showMessageBox(mainWindow, {
                  type: 'error', title: 'Erreur',
                  message: 'Impossible de vérifier les mises à jour.', detail: e.message
                });
              });
          }
        },
        {
          label: '⚙️ Préférences de mise à jour',
          submenu: [
            {
              label: '🔄 Automatique (recommandé)',
              type: 'radio',
              checked: getUpdatePref() === 'auto',
              click: () => setUpdatePref('auto')
            },
            {
              label: '🔔 Notifier seulement',
              type: 'radio',
              checked: getUpdatePref() === 'notify',
              click: () => setUpdatePref('notify')
            },
            {
              label: '🔒 Manuel',
              type: 'radio',
              checked: getUpdatePref() === 'manual',
              click: () => setUpdatePref('manual')
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'ℹ️ About MeasurePRO',
          click: () => mainWindow.webContents.send('menu-about')
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ── Auto-updater IPC handlers ──────────────────────────────────────────────────
ipcMain.handle('updater:check', async () => {
  if (!autoUpdater || isDev) return { status: 'dev-mode' };
  try { await autoUpdater.checkForUpdates(); return { status: 'checking' }; }
  catch(e) { return { status: 'error', message: e.message }; }
});

ipcMain.handle('updater:download', async () => {
  if (!autoUpdater) return;
  autoUpdater.downloadUpdate();
});

ipcMain.handle('updater:install', async () => {
  if (!autoUpdater) return;
  autoUpdater.quitAndInstall();
});

ipcMain.handle('updater:get-pref', async () => getUpdatePref());
ipcMain.handle('updater:set-pref', async (_e, pref) => { setUpdatePref(pref); return pref; });
ipcMain.handle('updater:get-version', async () => app.getVersion());

// ── Serial Port IPC handlers ─────────────────────────────────────────────────

// Track open serial port instances: portPath → SerialPort
const openPorts = new Map();

ipcMain.handle('serial:list', async () => {
  const ports = await SerialPort.list();
  return ports.map(p => ({
    path: p.path,
    manufacturer: p.manufacturer || '',
    serialNumber: p.serialNumber || '',
    pnpId: p.pnpId || '',
    vendorId: p.vendorId || '',
    productId: p.productId || '',
  }));
});

ipcMain.handle('serial:requestPort', async (_event, filters) => {
  const allPorts = await SerialPort.list();

  // Apply USB vendor/product filters if provided
  let filtered = allPorts;
  if (filters && Array.isArray(filters) && filters.length > 0) {
    filtered = allPorts.filter(p => {
      return filters.some(f => {
        const vidMatch = !f.usbVendorId || parseInt(p.vendorId, 16) === f.usbVendorId;
        const pidMatch = !f.usbProductId || parseInt(p.productId, 16) === f.usbProductId;
        return vidMatch && pidMatch;
      });
    });
    // If no matches after filtering, show all ports
    if (filtered.length === 0) filtered = allPorts;
  }

  if (filtered.length === 0) {
    throw new Error('No serial ports found');
  }

  // Show picker dialog
  const labels = filtered.map((p, i) => `${i + 1}. ${p.path}${p.manufacturer ? ' — ' + p.manufacturer : ''}`);
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Select Serial Port',
    message: 'Choose a serial port to connect:',
    detail: labels.join('\n'),
    buttons: [...filtered.map(p => p.path), 'Cancel'],
    cancelId: filtered.length,
  });

  if (result.response >= filtered.length) {
    throw new Error('User cancelled port selection');
  }

  const chosen = filtered[result.response];
  return {
    path: chosen.path,
    vendorId: chosen.vendorId || '',
    productId: chosen.productId || '',
  };
});

ipcMain.handle('serial:open', async (_event, portPath, options) => {
  if (openPorts.has(portPath)) {
    // Already open, just return success
    return { success: true };
  }

  const port = new SerialPort({
    path: portPath,
    baudRate: options.baudRate || 9600,
    dataBits: options.dataBits || 8,
    stopBits: options.stopBits || 1,
    parity: options.parity || 'none',
    autoOpen: false,
  });

  return new Promise((resolve, reject) => {
    port.open(err => {
      if (err) {
        reject(new Error(`Failed to open ${portPath}: ${err.message}`));
        return;
      }
      openPorts.set(portPath, port);

      // Forward incoming data to renderer
      port.on('data', (chunk) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('serial:data', portPath, Array.from(chunk));
        }
      });

      port.on('error', (err) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('serial:error', portPath, err.message);
        }
      });

      port.on('close', () => {
        openPorts.delete(portPath);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('serial:close', portPath);
        }
      });

      resolve({ success: true });
    });
  });
});

ipcMain.handle('serial:write', async (_event, portPath, data) => {
  const port = openPorts.get(portPath);
  if (!port || !port.isOpen) {
    throw new Error(`Port ${portPath} is not open`);
  }
  return new Promise((resolve, reject) => {
    port.write(Buffer.from(data), (err) => {
      if (err) reject(new Error(err.message));
      else port.drain(() => resolve({ success: true }));
    });
  });
});

ipcMain.handle('serial:close', async (_event, portPath) => {
  const port = openPorts.get(portPath);
  if (!port) return { success: true };
  return new Promise((resolve) => {
    port.close(() => {
      openPorts.delete(portPath);
      resolve({ success: true });
    });
  });
});

ipcMain.handle('serial:getInfo', async (_event, portPath) => {
  const ports = await SerialPort.list();
  const info = ports.find(p => p.path === portPath);
  if (!info) return { usbVendorId: 0, usbProductId: 0 };
  return {
    usbVendorId: info.vendorId ? parseInt(info.vendorId, 16) : 0,
    usbProductId: info.productId ? parseInt(info.productId, 16) : 0,
  };
});

// ── File I/O IPC handler ─────────────────────────────────────────────────────

ipcMain.handle('file:write', async (_event, filePath, data) => {
  fs.writeFileSync(filePath, Buffer.from(data));
  return { success: true };
});

// ── App IPC handlers ─────────────────────────────────────────────────────────

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:platform', () => process.platform);
ipcMain.handle('show-save-dialog', async (_event, options) => {
  return dialog.showSaveDialog(mainWindow, options);
});
ipcMain.handle('show-open-dialog', async (_event, options) => {
  return dialog.showOpenDialog(mainWindow, options);
});

// ── Splash Screen ────────────────────────────────────────────────────────────
function createSplash() {
  const splash = new BrowserWindow({
    width: 480, height: 320,
    frame: false, transparent: true, alwaysOnTop: true,
    skipTaskbar: true, resizable: false,
    icon: process.platform === 'win32'
      ? path.join(__dirname, '../build-resources/icon.ico')
      : path.join(__dirname, '../build-resources/icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  const splashHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:480px; height:320px;
  background: linear-gradient(135deg, #001a3a 0%, #002B5C 60%, #003f80 100%);
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  font-family: -apple-system, 'Segoe UI', sans-serif;
  border-radius: 16px;
  overflow: hidden;
}
.logo { font-size: 72px; margin-bottom: 8px; filter: drop-shadow(0 4px 16px rgba(59,158,255,0.6)); }
.title { font-size: 32px; font-weight: 800; color: white; letter-spacing: 1px; }
.subtitle { font-size: 13px; color: rgba(255,255,255,0.5); margin-top: 4px; letter-spacing: 3px; text-transform: uppercase; }
.version { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 24px; }
.bar { width: 200px; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 16px; overflow: hidden; }
.bar-fill { height: 100%; width: 0%; background: linear-gradient(90deg, #3B9EFF, #60c4ff); border-radius: 2px; animation: load 1.8s ease forwards; }
@keyframes load { to { width: 100%; } }
</style></head>
<body>
  <div class="logo">⚡</div>
  <div class="title">MeasurePRO</div>
  <div class="subtitle">by Soltec Innovation</div>
  <div class="bar"><div class="bar-fill"></div></div>
  <div class="version">v${app.getVersion()}</div>
</body></html>`;

  splash.loadURL('data:text/html,' + encodeURIComponent(splashHtml));
  return splash;
}

// ── System Tray ────────────────────────────────────────────────────────────
let tray = null;
function createTray() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '../build-resources/icon.ico')
    : path.join(__dirname, '../build-resources/icon.png');

  tray = new Tray(iconPath);
  tray.setToolTip('MeasurePRO v' + app.getVersion());

  const trayMenu = Menu.buildFromTemplate([
    { label: 'MeasurePRO v' + app.getVersion(), enabled: false },
    { type: 'separator' },
    { label: '💻 Open MeasurePRO', click: () => {
      if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    }},
    { type: 'separator' },
    { label: '🔄 Check for Updates', click: () => {
      if (autoUpdater && !isDev) autoUpdater.checkForUpdates().catch(() => {});
    }},
    { type: 'separator' },
    { label: '❌ Quit MeasurePRO', click: () => app.quit() },
  ]);

  tray.setContextMenu(trayMenu);

  // Click on tray icon → show/focus window
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) { mainWindow.focus(); }
      else { mainWindow.show(); }
    }
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Show splash first
  const splash = createSplash();

  // Create main window hidden
  createWindow();
  mainWindow.hide();

  // When main window is ready, hide splash and show main
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      splash.close();
      mainWindow.show();
      mainWindow.focus();
      createTray();
    }, 1800); // Show splash for at least 1.8s
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Set quiting flag so close handler knows it's a real quit
app.on('before-quit', () => {
  app.isQuiting = true;
  if (tray) tray.destroy();
});
