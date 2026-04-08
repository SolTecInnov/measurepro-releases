const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');

// Auto-updater — loaded with guard so startup never fails if package missing
let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (_e) { /* not bundled */ }
const path = require('path');
const fs = require('fs');
const { SerialPort } = require('serialport');

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

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
