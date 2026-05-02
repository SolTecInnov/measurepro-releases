const { app, BrowserWindow, ipcMain, dialog, shell, Menu, globalShortcut, desktopCapturer, session: electronSession } = require('electron');

// Auto-updater — loaded with guard so startup never fails if package missing
let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (_e) { /* not bundled */ }
const path = require('path');
const fs = require('fs');
const { SerialPort } = require('serialport');

// License engine — validates offline license keys (compatible with LicensePRO)
const { getMachineId, verifyKey, saveLicenseKey, loadLicenseKey, clearLicenseKey, validateStoredLicense } = require('./license/engine.cjs');

// jszip is loaded lazily for the survey-file IPC handlers (avoids startup cost)
let JSZip = null;
function getJSZip() {
  if (!JSZip) JSZip = require('jszip');
  return JSZip;
}

// Load .env for GH_TOKEN (auto-updater needs it for private repo)
// In packaged app, __dirname is inside app.asar — try multiple locations
try {
  const envCandidates = [
    path.join(__dirname, '..', '.env'),                          // dev mode
    path.join(process.resourcesPath || '', '.env'),              // extraResources (packaged)
    path.join(app.getAppPath(), '.env'),                         // packaged (inside asar)
    path.join(app.getAppPath(), '..', '.env'),                   // packaged (next to asar)
    path.join(path.dirname(process.execPath), '.env'),           // next to exe
    path.join(app.getPath('userData'), '.env'),                  // userData fallback
  ];
  for (const envPath of envCandidates) {
    try {
      if (fs.existsSync(envPath)) {
        fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
          const match = line.match(/^([^#=]+)=(.*)$/);
          if (match && !process.env[match[1].trim()]) {
            process.env[match[1].trim()] = match[2].trim();
          }
        });
        break; // Found and loaded
      }
    } catch (_) {}
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

// ── Drive Mode + active-survey close protection ────────────────────────────
// Both pieces of state live in main and are pushed up by the renderer via IPC.
let hasActiveSurvey = false;
let driveModeEnabled = false;
// Saved window bounds so we can restore them on Drive Mode exit (kiosk replaces them)
let preDriveModeBounds = null;

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

  // ── Screen capture handler for Live Support ──────────────────────────────
  // Electron 27+ API: intercepts getDisplayMedia() from the renderer and
  // presents a source picker so the user can choose screen/window.
  try {
    mainWindow.webContents.session.setDisplayMediaRequestHandler(async (_request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 } });
        if (sources.length === 0) {
          callback({});
          return;
        }
        // If only one source (single monitor, no windows), use it directly
        if (sources.length === 1) {
          callback({ video: sources[0] });
          return;
        }
        // Present a simple picker dialog
        const choices = sources.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
        const result = await dialog.showMessageBox(mainWindow, {
          type: 'question',
          title: 'Share Screen — Live Support',
          message: 'Choose what to share:',
          detail: choices,
          buttons: sources.map(s => s.name).slice(0, 6), // Electron limits buttons
          cancelId: -1,
        });
        if (result.response >= 0 && result.response < sources.length) {
          callback({ video: sources[result.response] });
        } else {
          callback({});
        }
      } catch (err) {
        writeLog('error', `Screen capture picker error: ${err.message}`);
        callback({});
      }
    });
  } catch (err) {
    writeLog('warning', `setDisplayMediaRequestHandler not available: ${err.message}`);
  }

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

  // Handle external links via window.open() (target="_blank")
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Defense in depth: prevent in-window navigation away from the local app URL.
  // Without this, a plain <a href="https://..."> link clicked anywhere in the
  // renderer will navigate the entire Electron BrowserWindow to that URL,
  // trapping the user on a third-party site (no back button visible). This
  // happened in v16.1.20 with the Leaflet "© Google Maps" attribution link in
  // the bottom-right of the live map.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url);
      // Allow internal navigation: file:// (packaged), http://localhost (dev),
      // and devtools:// (Chromium DevTools panes). Block everything else.
      const isInternal =
        parsed.protocol === 'file:' ||
        parsed.protocol === 'devtools:' ||
        (parsed.protocol === 'http:' && parsed.hostname === 'localhost');
      if (!isInternal) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch (_) {
      // If URL parsing fails, block to be safe
      event.preventDefault();
    }
  });

  // ── Active-survey close protection ──────────────────────────────────────
  // Intercept window close (X button, Alt+F4, taskbar close) when a survey
  // is active. Soft lock — user can still confirm. Data is already safe in
  // IndexedDB; this just prevents accidental loss of the recording session.
  mainWindow.on('close', (event) => {
    if (!hasActiveSurvey) return; // no active survey → close normally
    if (mainWindow._closeConfirmed) return; // already confirmed this round

    event.preventDefault();
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      buttons: ['Cancel', 'Stop & Close'],
      defaultId: 0,
      cancelId: 0,
      title: 'Survey is recording',
      message: 'A survey is currently active.',
      detail: 'Closing now will stop the recording. Your measurements are already saved locally — no data will be lost — but the session will end. Are you sure?'
    });
    if (choice === 1) {
      mainWindow._closeConfirmed = true;
      mainWindow.close();
    }
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
          label: 'Live Support',
          click: () => mainWindow.webContents.send('menu-live-support')
        },
        {
          label: 'Submit a Support Ticket',
          click: () => shell.openExternal('mailto:support@soltecinnovation.com?subject=MeasurePRO%20Support%20Request')
        },
        {
          label: 'Visit soltecinnovation.com',
          click: () => shell.openExternal('https://soltecinnovation.com')
        },
        { type: 'separator' },
        { label: 'Check for Updates', click: async () => {
          if (!autoUpdater) {
            dialog.showMessageBox(mainWindow, { type: 'error', title: 'Update', message: 'Auto-updater is not available.' });
            return;
          }
          try {
            const result = await autoUpdater.checkForUpdates();
            if (!result || !result.updateInfo || result.updateInfo.version === app.getVersion()) {
              dialog.showMessageBox(mainWindow, { type: 'info', title: 'Update', message: `You are on the latest version (v${app.getVersion()}).` });
            }
            // If update IS available, the 'update-available' event fires and the renderer shows the download UI
          } catch (err) {
            // Log the full error to file/console for debugging, but show a clean message to the user
            console.error('[AutoUpdater] Menu check failed:', err && err.message ? err.message : err);
            dialog.showMessageBox(mainWindow, {
              type: 'error',
              title: 'Update Check Failed',
              message: 'Could not reach the update server.',
              detail: 'This usually means the device is offline or the update server is temporarily unavailable. Try again later. If this keeps happening, contact support.'
            });
          }
        } },
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

      // Forward incoming data to renderer — BATCHED to reduce IPC overhead
      // Without batching: 1 IPC per OS read (~hundreds/sec) = ~50% throughput loss
      // With batching: 1 IPC per 8ms window (~125/sec) = near-TeraTerm speed
      let pendingChunks = [];
      let flushTimer = null;

      const flushToRenderer = () => {
        flushTimer = null;
        if (pendingChunks.length === 0) return;
        if (!mainWindow || mainWindow.isDestroyed()) { pendingChunks = []; return; }

        // Merge all pending chunks into one Uint8Array
        let totalLen = 0;
        for (const c of pendingChunks) totalLen += c.length;
        const merged = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of pendingChunks) {
          merged.set(c, offset);
          offset += c.length;
        }
        pendingChunks = [];

        mainWindow.webContents.send('serial:data', portPath, merged);
      };

      port.on('data', (chunk) => {
        pendingChunks.push(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        if (!flushTimer) {
          flushTimer = setTimeout(flushToRenderer, 8);
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

        // Batched IPC for laser serial:data (same pattern as generic serial)
        let laserPending = [];
        let laserFlushTimer = null;

        const flushLaserToRenderer = () => {
          laserFlushTimer = null;
          if (laserPending.length === 0) return;
          if (!mainWindow || mainWindow.isDestroyed()) { laserPending = []; return; }
          let totalLen = 0;
          for (const c of laserPending) totalLen += c.length;
          const merged = new Uint8Array(totalLen);
          let off = 0;
          for (const c of laserPending) { merged.set(c, off); off += c.length; }
          laserPending = [];
          mainWindow.webContents.send('serial:data', comPort, merged);
        };

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

          // Batched forward through serial:data for polyfill compatibility
          laserPending.push(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
          if (!laserFlushTimer) {
            laserFlushTimer = setTimeout(flushLaserToRenderer, 8);
          }
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

// ── Survey-zip discovery and read (used by AI assistant historical review) ──
// Restricted to the same allowedDirs as fs:write so the renderer cannot read
// arbitrary files via this IPC.
function getSurveyAllowedDirs() {
  return [
    path.join(app.getPath('documents'), 'MeasurePRO', 'surveys'),
    app.getPath('downloads'),
  ];
}

ipcMain.handle('fs:listSurveyZips', async () => {
  const out = [];
  for (const dir of getSurveyAllowedDirs()) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir);
      for (const name of entries) {
        if (!/_part\d+\.zip$/i.test(name)) continue;
        const full = path.join(dir, name);
        try {
          const stat = fs.statSync(full);
          if (!stat.isFile()) continue;
          out.push({
            filePath: full,
            fileName: name,
            sizeBytes: stat.size,
            modifiedAt: stat.mtime.toISOString(),
          });
        } catch (_e) {}
      }
    } catch (_e) {}
  }
  // Newest first
  out.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  return out;
});

ipcMain.handle('fs:readSurveyZip', async (_event, filePath) => {
  // Path validation: must resolve inside one of the allowed dirs
  const resolved = path.resolve(filePath);
  const allowed = getSurveyAllowedDirs().some(dir => resolved.startsWith(dir + path.sep) || resolved === dir);
  if (!allowed) {
    throw new Error('Read denied: path is outside Documents/MeasurePRO/surveys or Downloads');
  }
  if (!fs.existsSync(resolved)) {
    throw new Error('File not found: ' + resolved);
  }

  const buf = fs.readFileSync(resolved);
  const zip = await getJSZip().loadAsync(buf);

  // Always read survey.json (small)
  let survey = null;
  const surveyEntry = zip.file('survey.json');
  if (surveyEntry) {
    try {
      survey = JSON.parse(await surveyEntry.async('string'));
    } catch (_e) {}
  }

  // Prefer pois.csv (~50KB) over pois.json (~75MB with embedded base64).
  // If only json exists, fall back but strip image fields to keep payload light.
  let pois = [];
  const csvEntry = zip.file('pois.csv');
  if (csvEntry) {
    const csvText = await csvEntry.async('string');
    pois = parseSurveyCsv(csvText);
  } else {
    const jsonEntry = zip.file('pois.json');
    if (jsonEntry) {
      try {
        const parsed = JSON.parse(await jsonEntry.async('string'));
        if (Array.isArray(parsed)) {
          pois = parsed.map(p => {
            const { imageUrl: _u, images: _i, ...rest } = p;
            return { ...rest, hasImage: !!(_u || (Array.isArray(_i) && _i.length)) };
          });
        }
      } catch (_e) {}
    }
  }

  return { survey, pois };
});

// CSV parser tuned for MeasurePRO survey exports. Header schema:
// ID,Date,Time,Height (m),Ground Ref (m),GPS Alt (m),Latitude,Longitude,
// Speed (km/h),Heading (°),Road Number,POI Number,POI Type,Note,Has Image,Has Video
function parseSurveyCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  const idx = (name) => headers.indexOf(name);
  const colId = idx('ID');
  const colDate = idx('Date');
  const colTime = idx('Time');
  const colHeight = idx('Height (m)');
  const colGround = idx('Ground Ref (m)');
  const colAlt = idx('GPS Alt (m)');
  const colLat = idx('Latitude');
  const colLng = idx('Longitude');
  const colSpeed = idx('Speed (km/h)');
  const colHeading = idx('Heading (°)');
  const colRoad = idx('Road Number');
  const colPoiNum = idx('POI Number');
  const colType = idx('POI Type');
  const colNote = idx('Note');
  const colImg = idx('Has Image');

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    // Notes use ';' instead of ',' (per export.ts), so a naive split is fine
    const parts = lines[i].split(',');
    if (parts.length < headers.length) continue;
    const num = (s) => { const n = parseFloat(s); return isNaN(n) ? null : n; };
    const groundField = colGround >= 0 ? num(parts[colGround]) : null;
    // Recover ground ref from note string if structured field is 0/missing
    let groundFromNote = null;
    const note = colNote >= 0 ? (parts[colNote] || '') : '';
    const m = note.match(/GND:?\s*(-?\d+(?:\.\d+)?)\s*m/i);
    if (m) groundFromNote = parseFloat(m[1]);
    out.push({
      id: parts[colId],
      utcDate: parts[colDate],
      utcTime: parts[colTime],
      rel: num(parts[colHeight]),
      groundRefM: (groundField && groundField > 0) ? groundField : (groundFromNote ?? 0),
      altGPS: num(parts[colAlt]),
      latitude: num(parts[colLat]),
      longitude: num(parts[colLng]),
      speed: num(parts[colSpeed]),
      heading: num(parts[colHeading]),
      roadNumber: num(parts[colRoad]),
      poiNumber: num(parts[colPoiNum]),
      poi_type: parts[colType],
      note,
      hasImage: parts[colImg] === 'Yes',
    });
  }
  return out;
}

ipcMain.handle('fs:pickSoundFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

// ── License IPC handlers ─────────────────────────────────────────────────────

ipcMain.handle('license:getMachineId', () => getMachineId());
ipcMain.handle('license:validate', () => validateStoredLicense());
ipcMain.handle('license:activate', (_event, key) => {
  const machineId = getMachineId();
  const result = verifyKey(key, machineId);
  if (result.valid) {
    saveLicenseKey(key);
  }
  return result;
});
ipcMain.handle('license:deactivate', () => {
  clearLicenseKey();
  return { success: true };
});
ipcMain.handle('license:getStoredKey', () => loadLicenseKey());

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

  // Private repo: electron-updater reads GH_TOKEN from process.env automatically.
  // Ensure it's set before any check happens.
  const ghToken = process.env.GH_TOKEN;
  if (ghToken) {
    console.log('[AutoUpdater] GH_TOKEN found (' + ghToken.slice(0, 8) + '...), configuring for private repo');
    // electron-updater v6+ reads process.env.GH_TOKEN natively for GitHub provider
    // But also set requestHeaders as belt-and-suspenders
    autoUpdater.requestHeaders = { Authorization: `token ${ghToken}` };
  } else {
    console.warn('[AutoUpdater] No GH_TOKEN — updates will fail on private repo');
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

autoUpdater && autoUpdater.on('update-not-available', (info) => {
  console.log('[AutoUpdater] Already on latest:', info.version);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:update-not-available', info);
  }
});

autoUpdater && autoUpdater.on('error', (err) => {
  console.error('[AutoUpdater] Error:', err.message);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:error', err.message);
  }
});

ipcMain.handle('updater:check', async () => {
  if (!autoUpdater) return { error: 'Auto-updater not available' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return result; // success path — renderer reads result.updateInfo
  } catch (e) {
    // Log the full error for debugging but return a friendly shape to the renderer
    console.error('[AutoUpdater] IPC check failed:', e && e.message ? e.message : e);
    return { error: 'Could not reach the update server. Try again later.' };
  }
});

ipcMain.handle('updater:install-now', () => {
  if (autoUpdater) autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('updater:get-version', () => {
  return app.getVersion();
});

// ── Clear App Cache (emergency) ─────────────────────────────────────────────
ipcMain.handle('app:clear-cache', async () => {
  try {
    const ses = mainWindow?.webContents?.session;
    if (ses) {
      await ses.clearCache();
      await ses.clearStorageData({
        storages: ['cachestorage', 'serviceworkers', 'shadercache', 'cookies'],
      });
    }
    return { success: true };
  } catch (err) {
    console.error('[ClearCache] Failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('app:relaunch', () => {
  app.relaunch();
  app.exit(0);
});

// ── Drive Mode + active-survey state ─────────────────────────────────────────
ipcMain.handle('app:set-active-survey', (_event, hasActive) => {
  hasActiveSurvey = !!hasActive;
  return hasActiveSurvey;
});

ipcMain.handle('app:get-drive-mode', () => driveModeEnabled);

ipcMain.handle('app:set-drive-mode', (_event, enabled) => {
  if (!mainWindow) return false;
  const next = !!enabled;
  if (next === driveModeEnabled) return next;

  if (next) {
    // Save current bounds so we can restore on exit (kiosk mode mutates them)
    try { preDriveModeBounds = mainWindow.getBounds(); } catch { preDriveModeBounds = null; }
    // setKiosk handles fullscreen + chrome hiding in one call on Windows.
    // alwaysOnTop keeps the window above other apps a user might accidentally focus.
    mainWindow.setKiosk(true);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setFullScreen(true);
  } else {
    mainWindow.setKiosk(false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setFullScreen(false);
    if (preDriveModeBounds) {
      try { mainWindow.setBounds(preDriveModeBounds); } catch {}
      preDriveModeBounds = null;
    }
  }

  driveModeEnabled = next;
  // Notify the renderer so the badge + UI tint update immediately
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:drive-mode-changed', driveModeEnabled);
  }
  return driveModeEnabled;
});

// Update preference: 'auto' (default) or 'manual'
let updatePref = 'auto';
try {
  const stored = fs.readFileSync(path.join(app.getPath('userData'), 'update-pref.txt'), 'utf8').trim();
  if (stored === 'manual' || stored === 'auto') updatePref = stored;
} catch { /* first run — default to auto */ }

if (autoUpdater) {
  autoUpdater.autoDownload = (updatePref === 'auto');
}

ipcMain.handle('updater:get-pref', () => updatePref);

ipcMain.handle('updater:set-pref', (_event, pref) => {
  if (pref !== 'auto' && pref !== 'manual') return updatePref;
  updatePref = pref;
  fs.writeFileSync(path.join(app.getPath('userData'), 'update-pref.txt'), pref, 'utf8');
  if (autoUpdater) {
    autoUpdater.autoDownload = (pref === 'auto');
  }
  return updatePref;
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
