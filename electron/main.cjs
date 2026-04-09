const { app, BrowserWindow, ipcMain, dialog, shell, Menu, globalShortcut } = require('electron');

// Auto-updater — loaded with guard so startup never fails if package missing
let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (_e) { /* not bundled */ }
const path = require('path');
const fs = require('fs');
const { SerialPort } = require('serialport');

// Load .env for GH_TOKEN (auto-updater needs it for private repo)
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2].trim();
      }
    });
  }
} catch (_) {}

const isDev = process.env.IS_DEV === 'true';

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
      webSecurity: false, // Required: app loads from file:// and calls Firebase cross-origin
    },
  });

  // Capture renderer console output to log file
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levels = ['verbose', 'info', 'warning', 'error'];
    writeLog(levels[level] || 'info', `${message} (${sourceId}:${line})`);
  });

  // Debug: log ALL keyboard input at Electron level (check if StreamDeck reaches here)
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown') {
      writeLog('INPUT', `key=${input.key} code=${input.code} alt=${input.alt} ctrl=${input.control} shift=${input.shift} repeat=${input.isAutoRepeat}`);
    }
  });

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    writeLog('error', `did-fail-load: ${code} ${desc} ${url}`);
  });

  mainWindow.webContents.on('crashed', () => writeLog('error', 'Renderer CRASHED'));

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Show loading screen first, then load main app
    mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
      <!DOCTYPE html>
      <html style="background:#0F1923;margin:0;height:100%">
      <body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:'DM Sans',sans-serif;background:#0F1923">
        <div style="text-align:center">
          <div style="width:60px;height:60px;border:3px solid #2a3a4a;border-top-color:#FF6B2B;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 20px"></div>
          <div style="color:#E8ECF1;font-size:18px;font-weight:600;margin-bottom:8px">MeasurePRO</div>
          <div style="color:#8899AA;font-size:13px">Starting up...</div>
          <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
        </div>
      </body></html>
    `));
    // Small delay then load real app
    setTimeout(() => {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }, 300);
    // DevTools removed from production — use View > Toggle DevTools if needed
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  createMenu();

  // Start hardware services after window is ready
  if (insta360Service) insta360Service.startPolling(mainWindow);
  if (droneService) droneService.startDriveWatcher(mainWindow);
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
      label: 'Help',
      submenu: [
        {
          label: 'User Manual',
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
          label: 'Help & FAQ',
          click: () => mainWindow.webContents.send('menu-navigate', '/help')
        },
        {
          label: 'Quick Start Guide',
          click: () => mainWindow.webContents.send('menu-navigate', '/welcome')
        },
        { type: 'separator' },
        {
          label: 'Submit a Support Ticket',
          click: () => shell.openExternal('mailto:support@soltecinnovation.com?subject=MeasurePRO%20Support%20Request')
        },
        {
          label: 'Visit soltecinnovation.com',
          click: () => shell.openExternal('https://soltecinnovation.com')
        },
        { type: 'separator' },
        { label: 'Check for Updates', click: () => { if (autoUpdater) autoUpdater.checkForUpdates(); } },
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
          // Send as Uint8Array via structured clone — avoids slow Array.from(Buffer) conversion
          mainWindow.webContents.send('serial:data', portPath, new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
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
  // Accept Uint8Array (structured clone) or number[] (legacy)
  const buf = data instanceof Uint8Array ? Buffer.from(data.buffer, data.byteOffset, data.byteLength) : Buffer.from(data);
  return new Promise((resolve, reject) => {
    port.write(buf, (err) => {
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

// ── Laser IPC handlers (high-level, wraps serial) ───────────────────────────

let laserPort = null;
let laserBuffer = '';

function parseLDM71Line(line) {
  // LDM71 ASCII format: "D 0001.724 012.9" → distance in meters
  const match = line.match(/^D\s+(\d+\.\d+)/);
  if (match) {
    return { type: 'measurement', value: match[1], raw: line };
  }
  return { type: 'raw', raw: line };
}

function parseSolTec3Byte(buf) {
  // 3-byte binary: MSB, MID, LSB → millimetres
  const results = [];
  for (let i = 0; i + 2 < buf.length; i += 3) {
    const mm = (buf[i] << 16) | (buf[i + 1] << 8) | buf[i + 2];
    if (mm > 0 && mm < 100000) {
      const meters = (mm / 1000).toFixed(3);
      results.push({ type: 'measurement', value: meters, raw: `${mm}mm` });
    }
  }
  return results;
}

ipcMain.handle('laser:list-ports', async () => {
  const ports = await SerialPort.list();
  return ports.map(p => ({
    path: p.path,
    manufacturer: p.manufacturer || '',
    vendorId: p.vendorId || '',
    productId: p.productId || '',
  }));
});

ipcMain.handle('laser:connect', async (_event, opts) => {
  const { comPort, baudRate = 115200, format = 'ldm71' } = opts || {};
  if (!comPort) return { connected: false, error: 'No COM port specified' };

  // Close existing laser connection if any
  if (laserPort && laserPort.isOpen) {
    try { laserPort.close(); } catch (_) {}
  }

  try {
    const portOpts = {
      path: comPort,
      baudRate,
      dataBits: format === 'soltec-legacy' ? 7 : 8,
      stopBits: 1,
      parity: format === 'soltec-legacy' ? 'even' : 'none',
      autoOpen: false,
    };

    laserPort = new SerialPort(portOpts);

    return new Promise((resolve) => {
      laserPort.open(err => {
        if (err) {
          laserPort = null;
          resolve({ connected: false, error: err.message });
          return;
        }

        laserBuffer = '';
        openPorts.set(comPort, laserPort);

        laserPort.on('data', (chunk) => {
          if (!mainWindow || mainWindow.isDestroyed()) return;

          if (format === 'soltec-new' || format === 'soltec-legacy') {
            // 3-byte binary protocol
            const results = parseSolTec3Byte(chunk);
            results.forEach(r => mainWindow.webContents.send('laser:measurement', r));
          } else {
            // ASCII line protocol (LDM71, etc.)
            laserBuffer += chunk.toString('ascii');
            const lines = laserBuffer.split(/\r?\n/);
            laserBuffer = lines.pop() || '';
            lines.forEach(line => {
              const trimmed = line.trim();
              if (!trimmed) return;
              mainWindow.webContents.send('laser:raw-line', trimmed);
              const parsed = parseLDM71Line(trimmed);
              if (parsed.type === 'measurement') {
                mainWindow.webContents.send('laser:measurement', parsed);
              }
            });
          }

          // Also forward raw data through serial:data for compatibility
          mainWindow.webContents.send('serial:data', comPort, new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        });

        laserPort.on('error', (err) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('laser:error', err.message);
          }
        });

        laserPort.on('close', () => {
          openPorts.delete(comPort);
          laserPort = null;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('laser:disconnected');
          }
        });

        resolve({ connected: true, port: comPort });
      });
    });
  } catch (err) {
    return { connected: false, error: err.message };
  }
});

ipcMain.handle('laser:disconnect', async () => {
  if (!laserPort) return { success: true };
  return new Promise((resolve) => {
    laserPort.close(() => {
      laserPort = null;
      resolve({ success: true });
    });
  });
});

ipcMain.handle('laser:send-command', async (_event, cmd) => {
  if (!laserPort || !laserPort.isOpen) {
    throw new Error('Laser not connected');
  }
  return new Promise((resolve, reject) => {
    laserPort.write(cmd + '\r\n', (err) => {
      if (err) reject(new Error(err.message));
      else laserPort.drain(() => resolve({ success: true }));
    });
  });
});

// ── Insta360 Native Service ──────────────────────────────────────────────────
let insta360Service = null;
try {
  insta360Service = require('./insta360/insta360Service.cjs');
  writeLog('MAIN', 'Insta360 service loaded');
} catch (e) {
  writeLog('MAIN', `Insta360 service not available: ${e.message}`);
}
ipcMain.handle('insta360:setCustomIp', (_event, ip) => {
  if (insta360Service) insta360Service.setCustomIp(ip);
  return { success: true };
});

// ── Drone Import Service ─────────────────────────────────────────────────────
let droneService = null;
try {
  droneService = require('./drone/droneImportService.cjs');
  writeLog('MAIN', 'Drone import service loaded');
} catch (e) {
  writeLog('MAIN', `Drone import service not available: ${e.message}`);
}

// ── Duro GNSS stub handlers ─────────────────────────────────────────────────
ipcMain.handle('duro:connect', () => ({ connected: false, error: 'Not implemented' }));
ipcMain.handle('duro:disconnect', () => ({ success: true }));
ipcMain.handle('duro:status', () => ({ connected: false }));

// ── File I/O IPC handler ─────────────────────────────────────────────────────

ipcMain.handle('file:write', async (_event, filePath, data) => {
  // Restrict writes to user's Documents and Downloads folders
  const resolved = path.resolve(filePath);
  const allowedDirs = [
    app.getPath('documents'),
    app.getPath('downloads'),
    app.getPath('userData'),
  ];
  const isAllowed = allowedDirs.some(dir => resolved.startsWith(dir + path.sep) || resolved === dir);
  if (!isAllowed) {
    throw new Error(`Write denied: path must be inside Documents, Downloads, or app data`);
  }
  fs.writeFileSync(resolved, Buffer.from(data));
  return { success: true };
});

// ── Auto-save path handler ──────────────────────────────────────────────────
ipcMain.handle('fs:getAutoSavePath', async (_event, filename) => {
  const docsDir = path.join(app.getPath('documents'), 'MeasurePRO', 'surveys');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  return path.join(docsDir, filename);
});

ipcMain.handle('fs:pickSoundFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

// ── App IPC handlers ─────────────────────────────────────────────────────────

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:platform', () => process.platform);
ipcMain.handle('laser:status', () => {
  const ports = Array.from(openPorts.keys());
  return { connected: ports.length > 0, ports };
});
ipcMain.handle('show-save-dialog', async (_event, options) => {
  return dialog.showSaveDialog(mainWindow, options);
});
ipcMain.handle('show-open-dialog', async (_event, options) => {
  return dialog.showOpenDialog(mainWindow, options);
});

// App lifecycle
// ── Auto-updater ─────────────────────────────────────────────────────────────
if (autoUpdater) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  // Token required for private GitHub repo releases — set GH_TOKEN env var or in .env
  if (process.env.GH_TOKEN) {
    // GH_TOKEN already set via environment
  }
}

autoUpdater && autoUpdater.on('update-available', (info) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:update-available', info);
  }
});

autoUpdater && autoUpdater.on('download-progress', (progress) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:download-progress', progress);
  }
});

autoUpdater && autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:update-downloaded', info);
  }
});

autoUpdater && autoUpdater.on('error', (err) => {
  console.error('[AutoUpdater] Error:', err.message);
});

ipcMain.handle('updater:check', async () => {
  try {
    return autoUpdater ? await autoUpdater.checkForUpdates() : null;
  } catch (e) {
    return null;
  }
});

ipcMain.handle('updater:install-now', () => {
  if (autoUpdater) autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('updater:get-version', () => {
  return app.getVersion();
});

// Auto-check for updates 10s after window is ready
app.whenReady().then(() => {
  setTimeout(() => {
    if (autoUpdater) {
      autoUpdater.checkForUpdates().catch(e => console.error('[AutoUpdater] Startup check failed:', e.message));
    }
  }, 10000);
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
