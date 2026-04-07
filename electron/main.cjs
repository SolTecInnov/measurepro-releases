const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray, nativeImage } = require('electron');
const net = require('net');
const path = require('path');
const fs = require('fs');
const { SerialPort } = require('serialport');

const isDev = process.env.IS_DEV === 'true';

// Enable Web Speech API (requires internet - uses Google Speech servers)
// Enable Web Speech API (Google Speech servers — requires internet)
app.commandLine.appendSwitch('enable-features', 'WebSpeechAPI');
// Allow camera/microphone access without browser permission dialog
app.commandLine.appendSwitch('enable-usermedia-screen-capturing');
app.commandLine.appendSwitch('allow-http-screen-capture');

// ── Icon resolver ───────────────────────────────────────────────────────────
function getIconPath() {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const candidates = [
    path.join(__dirname, iconName),                          // electron/icon.ico (in asar)
    path.join(__dirname, '..', '..', iconName),              // resources/icon.ico (extraResources)
    path.join(process.resourcesPath || '', iconName),        // Electron resourcesPath
    path.join(__dirname, '..', 'build-resources', iconName), // legacy dev path
  ];
  return candidates.find(p => fs.existsSync(p)) || candidates[0];
}

// Prevent ugly Electron error dialogs for non-fatal errors
// Log them instead and keep the app running
process.on('uncaughtException', (err) => {
  const msg = err?.message || String(err);
  // Skip known non-fatal errors
  if (msg.includes('icon') || msg.includes('tray') || msg.includes('Tray')) {
    console.warn('[WARN] Non-fatal error suppressed:', msg);
    return;
  }
  console.error('[UNCAUGHT]', msg);
  // Only show dialog for truly unexpected errors in production
  if (!isDev) {
    try {
      const { dialog } = require('electron');
      dialog.showErrorBox('MeasurePRO — Unexpected Error', msg);
    } catch(e) {}
  }
});

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
    icon: getIconPath(),
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

  // Allow all hardware permissions — Electron manages these natively, no browser prompt needed
  const ALLOWED_PERMISSIONS = [
    'geolocation',   // GPS failsafe
    'media',         // Camera + microphone (getUserMedia)
    'camera',        // Explicit camera access
    'microphone',    // Voice recognition
    'mediaKeySystem',
    'notifications',
    'midiSysex',
    'serial',        // Web Serial API (backup)
    'usb',           // WebUSB (backup)
  ];
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.includes(permission));
  });
  mainWindow.webContents.session.setPermissionCheckHandler((_webContents, permission) => {
    return ALLOWED_PERMISSIONS.includes(permission);
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
      title: 'Update Ready — v' + info.version,
      message: `MeasurePRO v${info.version} is ready to install`,
      detail:
        'The update will be installed when you restart.\n\n' +
        'If you experience any issues after updating, you can roll back:\n' +
        'Help menu → All Releases & Previous Versions',
      buttons: ['Restart Now', 'Later'],
      defaultId: 1  // Default to 'Later' for safety
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
        {
          label: 'Hardware',
          submenu: [
            { label: 'Laser & GPS',       click: () => mainWindow.webContents.send('menu-navigate-tab', 'laser-gps') },
            { label: 'Lateral / Rear',    click: () => mainWindow.webContents.send('menu-navigate-tab', 'lateral-rear') },
            { label: 'GNSS / Duro',       click: () => mainWindow.webContents.send('menu-navigate-tab', 'gnss') },
            { label: 'Camera',            click: () => mainWindow.webContents.send('menu-navigate-tab', 'camera') },
            { label: 'Calibration',       click: () => mainWindow.webContents.send('menu-navigate-tab', 'calibration') },
          ]
        },
        {
          label: 'Detection',
          submenu: [
            { label: 'Detection Settings', click: () => mainWindow.webContents.send('menu-navigate-tab', 'detection') },
            { label: 'AI+',                click: () => mainWindow.webContents.send('menu-navigate-tab', 'ai') },
            { label: 'AI Assistant',       click: () => mainWindow.webContents.send('menu-navigate-tab', 'ai-assistant') },
          ]
        },
        {
          label: 'Display',
          submenu: [
            { label: 'Logo',     click: () => mainWindow.webContents.send('menu-navigate-tab', 'logo') },
            { label: 'Map',      click: () => mainWindow.webContents.send('menu-navigate-tab', 'map') },
            { label: 'Display',  click: () => mainWindow.webContents.send('menu-navigate-tab', 'display') },
            { label: 'Layout',   click: () => mainWindow.webContents.send('menu-navigate-tab', 'layout') },
          ]
        },
        {
          label: 'Data & Alerts',
          submenu: [
            { label: 'Logging',      click: () => mainWindow.webContents.send('menu-navigate-tab', 'logging') },
            { label: 'Alerts',       click: () => mainWindow.webContents.send('menu-navigate-tab', 'alerts') },
            { label: 'Email',        click: () => mainWindow.webContents.send('menu-navigate-tab', 'email') },
            { label: 'Backup',       click: () => mainWindow.webContents.send('menu-navigate-tab', 'backup') },
            { label: 'POI Actions',  click: () => mainWindow.webContents.send('menu-navigate-tab', 'poi-actions') },
          ]
        },
        {
          label: 'System',
          submenu: [
            { label: 'Voice',      click: () => mainWindow.webContents.send('menu-navigate-tab', 'voice') },
            { label: 'Keyboard',   click: () => mainWindow.webContents.send('menu-navigate-tab', 'keyboard') },
            { label: 'Developer',  click: () => mainWindow.webContents.send('menu-navigate-tab', 'developer') },
            { label: 'About',      click: () => mainWindow.webContents.send('menu-navigate-tab', 'about') },
          ]
        },
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'User Manual',
          click: () => {
            const manualWin = new BrowserWindow({
              width: 1100,
              height: 800,
              title: 'MeasurePRO — User Manual',
              icon: getIconPath(),
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
          label: 'Help & FAQ',
          click: () => mainWindow.webContents.send('menu-navigate', '/help')
        },
        {
          label: 'Quick Start Guide',
          click: () => mainWindow.webContents.send('menu-navigate', '/welcome')
        },
        { type: 'separator' },
        {
          label: 'Submit Support Ticket',
          click: () => mainWindow.webContents.send('menu-open-support-ticket')
        },
        {
          label: 'Email Support Directly',
          click: () => shell.openExternal('mailto:support@soltecinnovation.com?subject=MeasurePRO%20Support%20Request')
        },
        {
          label: 'Visit soltecinnovation.com',
          click: () => shell.openExternal('https://soltecinnovation.com')
        },
        {
          label: 'All Releases & Previous Versions',
          click: () => shell.openExternal('https://github.com/SolTecInnov/measurepro-releases/releases')
        },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: () => {
            if (!autoUpdater || isDev) {
              dialog.showMessageBox(mainWindow, {
                type: 'info', title: 'Mises à jour',
                message: 'Vérification non disponible en mode développement.'
              });
              return;
            }
            // Show checking dialog
            const checkingMsg = dialog.showMessageBox(mainWindow, {
              type: 'info', title: 'Checking for updates...',
              message: 'Checking for a newer version of MeasurePRO...',
              buttons: [], noLink: true
            });

            autoUpdater.checkForUpdates()
              .then(result => {
                // If updateInfo version === current version, no update
                const latest = result?.updateInfo?.version;
                const current = app.getVersion();
                if (!latest || latest === current) {
                  dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: 'MeasurePRO is up to date',
                    message: `You have the latest version (${current}).`
                  });
                }
                // If newer version available, update-available event handles it
              })
              .catch(e => {
                dialog.showMessageBox(mainWindow, {
                  type: 'error',
                  title: 'Update check failed',
                  message: 'Could not check for updates. Check your internet connection.',
                  detail: e.message
                });
              });
          }
        },
        {
          label: 'Update Preferences',
          submenu: [
            {
              label: 'Automatic (recommended)',
              type: 'radio',
              checked: getUpdatePref() === 'auto',
              click: () => setUpdatePref('auto')
            },
            {
              label: 'Notify only',
              type: 'radio',
              checked: getUpdatePref() === 'notify',
              click: () => setUpdatePref('notify')
            },
            {
              label: 'Manual',
              type: 'radio',
              checked: getUpdatePref() === 'manual',
              click: () => setUpdatePref('manual')
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'About MeasurePRO',
          click: () => mainWindow.webContents.send('menu-about')
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ── File system IPC handlers ─────────────────────────────────────────────────
// Browse for custom sound file
ipcMain.handle('fs:pickSoundFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a sound file',
    filters: [{ name: 'Audio Files', extensions: ['wav', 'mp3', 'ogg', 'aac', 'm4a'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0]; // Returns the full Windows path
});

ipcMain.handle('fs:getAutoSavePath', async (_event, filename) => {
  try {
    const docsPath = app.getPath('documents');
    const saveDir = path.join(docsPath, 'MeasurePRO', 'surveys');
    // Create directory if it doesn't exist
    if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
    return path.join(saveDir, filename);
  } catch(e) {
    writeLog('ERROR', 'getAutoSavePath failed: ' + e.message);
    return null;
  }
});

// ── Duro GNSS TCP handlers ────────────────────────────────────────────────────
let duroSocket = null;
let duroBuffer = '';
let duroConnected = false;
let duroReconnectTimer = null;
let duroConfig = { host: '192.168.0.222', port: 2101, enabled: false };

function parseDuroNMEA(sentence) {
  const parts = sentence.split(',');
  const type = parts[0]?.replace('$', '');

  if (type === 'GPGGA' || type === 'GNGGA') {
    const lat = parseFloat(parts[2]) || 0;
    const latDir = parts[3];
    const lon = parseFloat(parts[4]) || 0;
    const lonDir = parts[5];
    const fixQ = parseInt(parts[6]) || 0;
    const sats = parseInt(parts[7]) || 0;
    const hdop = parseFloat(parts[8]) || 0;
    const alt = parseFloat(parts[9]) || 0;

    const latDeg = Math.floor(lat / 100) + (lat % 100) / 60;
    const lonDeg = Math.floor(lon / 100) + (lon % 100) / 60;

    return {
      type: 'position',
      lat: latDir === 'S' ? -latDeg : latDeg,
      lon: lonDir === 'W' ? -lonDeg : lonDeg,
      altitude: alt,
      satellites: sats,
      hdop,
      fixQuality: fixQ,
      timestamp: Date.now(),
      raw: sentence
    };
  }

  if (type === 'GPRMC' || type === 'GNRMC') {
    const speedKnots = parseFloat(parts[7]) || 0;
    const course = parseFloat(parts[8]) || 0;
    return {
      type: 'velocity',
      speedKnots,
      speedMps: speedKnots * 0.51444,
      speedKph: speedKnots * 1.852,
      heading: course,
      timestamp: Date.now(),
      raw: sentence
    };
  }

  if (type === 'PASHR') {
    // Proprietary NMEA: $PASHR,heading,,,pitch,roll,,,,,*checksum
    const heading = parseFloat(parts[1]) || null;
    const pitch = parseFloat(parts[4]) || null;
    const roll = parseFloat(parts[5]) || null;
    return {
      type: 'imu',
      heading,
      pitch,
      roll,
      heaveRate: null,
      timestamp: Date.now(),
      raw: sentence
    };
  }

  if (type === 'GPGSA' || type === 'GNGSA') {
    const mode = parseInt(parts[2]) || null;
    const pdop = parseFloat(parts[15]) || null;
    const hdop = parseFloat(parts[16]) || null;
    const vdop = parseFloat(parts[17]?.split('*')[0]) || null;
    return { type: 'dop', mode, pdop, hdop, vdop, raw: sentence };
  }

  return null;
}

function duroConnect() {
  if (duroSocket) { try { duroSocket.destroy(); } catch(e) {} }
  duroSocket = new net.Socket();
  duroBuffer = '';

  duroSocket.connect(duroConfig.port, duroConfig.host, () => {
    duroConnected = true;
    writeLog('DURO', `Connected to ${duroConfig.host}:${duroConfig.port}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('duro:status', { connected: true, host: duroConfig.host, port: duroConfig.port });
    }
  });

  duroSocket.on('data', (data) => {
    duroBuffer += data.toString('ascii');
    const lines = duroBuffer.split('\n');
    duroBuffer = lines.pop() || ''; // keep incomplete line

    for (const line of lines) {
      const sentence = line.trim();
      if (!sentence.startsWith('$')) continue;
      const parsed = parseDuroNMEA(sentence);
      if (parsed && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('duro:data', parsed);
      }
    }
  });

  duroSocket.on('error', (err) => {
    writeLog('DURO', `Error: ${err.message}`);
    duroConnected = false;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('duro:status', { connected: false, error: err.message });
    }
  });

  duroSocket.on('close', () => {
    duroConnected = false;
    writeLog('DURO', 'Disconnected');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('duro:status', { connected: false });
    }
    // Auto-reconnect after 3s if still enabled
    if (duroConfig.enabled) {
      duroReconnectTimer = setTimeout(duroConnect, 3000);
    }
  });

  duroSocket.setTimeout(5000);
  duroSocket.on('timeout', () => {
    writeLog('DURO', 'Connection timeout');
    duroSocket.destroy();
  });
}

ipcMain.handle('duro:connect', async (_event, config) => {
  duroConfig = { ...duroConfig, ...config, enabled: true };
  if (duroReconnectTimer) { clearTimeout(duroReconnectTimer); duroReconnectTimer = null; }
  duroConnect();
  return { ok: true };
});

ipcMain.handle('duro:disconnect', async () => {
  duroConfig.enabled = false;
  if (duroReconnectTimer) { clearTimeout(duroReconnectTimer); duroReconnectTimer = null; }
  if (duroSocket) { duroSocket.destroy(); duroSocket = null; }
  duroConnected = false;
  return { ok: true };
});

ipcMain.handle('duro:status', async () => ({
  connected: duroConnected,
  host: duroConfig.host,
  port: duroConfig.port,
  enabled: duroConfig.enabled
}));

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
    icon: getIconPath(),
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
  const iconPath = getIconPath();
  if (!fs.existsSync(iconPath)) {
    writeLog('WARN', 'Tray icon not found — skipping tray: ' + iconPath);
    return;
  }

  tray = new Tray(iconPath);
  tray.setToolTip('MeasurePRO v' + app.getVersion());

  const trayMenu = Menu.buildFromTemplate([
    { label: 'MeasurePRO v' + app.getVersion(), enabled: false },
    { type: 'separator' },
    { label: 'Open MeasurePRO', click: () => {
      if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    }},
    { type: 'separator' },
    { label: 'Check for Updates', click: () => {
      if (autoUpdater && !isDev) autoUpdater.checkForUpdates().catch(() => {});
    }},
    { type: 'separator' },
    { label: 'Quit MeasurePRO', click: () => app.quit() },
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

  // Helper to close splash and show main window
  let splashClosed = false;
  const closeSplash = () => {
    if (splashClosed) return;
    splashClosed = true;
    try { if (!splash.isDestroyed()) splash.close(); } catch(e) {}
    mainWindow.show();
    mainWindow.focus();
    try { createTray(); } catch(e) { writeLog('WARN', 'Tray creation failed: ' + e.message); }
  };

  // Close splash when main window finishes loading
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(closeSplash, 1800);
  });

  // FAILSAFE: Always close splash after 8 seconds no matter what
  setTimeout(closeSplash, 8000);

  // Also close splash on load failure (so user can see error)
  mainWindow.webContents.once('did-fail-load', () => {
    setTimeout(closeSplash, 500);
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
