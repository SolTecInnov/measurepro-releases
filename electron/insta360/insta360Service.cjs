/**
 * Insta360 X5 Native Service
 * 100% native — no bridge required
 * 
 * Uses the OSC (Open Spherical Camera) API over USB-C virtual network
 * When X5 is connected via USB-C, it exposes http://192.168.42.1
 * 
 * OSC API reference: https://developers.theta360.com/en/docs/v2.1/api_reference/
 * Insta360 implements OSC with some extensions for 360° cameras
 */

const { ipcMain } = require('electron');
const http = require('http');
const https = require('https');

// Insta360 USB-C virtual network IP (always this address)
let INSTA360_IP = '192.168.42.1'; // Default USB-C IP, configurable via IPC
const INSTA360_PORT = 80;
const TIMEOUT_MS = 5000;

let mainWindowRef = null;
let statusPollTimer = null;
let lastKnownStatus = null;
let isConnected = false;

// ── OSC HTTP Helper ────────────────────────────────────────────────────────

function oscRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: INSTA360_IP,
      port: INSTA360_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
      },
      timeout: TIMEOUT_MS,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({ raw: data }); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (postData) req.write(postData);
    req.end();
  });
}

function oscCommand(name, parameters = {}) {
  return oscRequest('POST', '/osc/commands/execute', { name, parameters });
}

// ── Camera Operations ──────────────────────────────────────────────────────

async function getCameraInfo() {
  return oscRequest('GET', '/osc/info');
}

async function getCameraStatus() {
  const result = await oscRequest('POST', '/osc/state');
  return result;
}

async function startRecording() {
  return oscCommand('camera.startCapture', { _captureMode: 'video' });
}

async function stopRecording() {
  return oscCommand('camera.stopCapture');
}

async function takePhoto() {
  return oscCommand('camera.takePicture');
}

async function getLensStatus() {
  // Get camera options including lens protection info
  try {
    const result = await oscCommand('camera.getOptions', {
      optionNames: [
        'captureMode', 'batteryLevel', 'remainingSpace',
        '_shutterVolume', 'fileFormat',
      ]
    });
    return result;
  } catch(e) {
    return null;
  }
}

async function checkConnection() {
  try {
    const info = await getCameraInfo();
    return !!(info && info.manufacturer);
  } catch(e) {
    return false;
  }
}

// ── Poll for connection + status ───────────────────────────────────────────

async function pollStatus() {
  try {
    const connected = await checkConnection();

    if (connected !== isConnected) {
      isConnected = connected;
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('insta360:connection', { connected });
      }
      if (connected) {
        console.log('[Insta360] Camera connected at', INSTA360_IP);
        // Get full status on connect
        const [info, state] = await Promise.all([
          getCameraInfo().catch(() => null),
          getCameraStatus().catch(() => null),
        ]);
        lastKnownStatus = { info, state };
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('insta360:status', lastKnownStatus);
        }
      }
    } else if (connected && lastKnownStatus) {
      // Periodic status refresh when connected
      const state = await getCameraStatus().catch(() => null);
      if (state) {
        lastKnownStatus = { ...lastKnownStatus, state };
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('insta360:status', lastKnownStatus);
        }
      }
    }
  } catch(e) {
    if (isConnected) {
      isConnected = false;
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('insta360:connection', { connected: false });
      }
    }
  }
}

function startPolling(mainWindow) {
  mainWindowRef = mainWindow;
  if (statusPollTimer) return;
  // Check every 3s — fast enough to detect connection, light enough not to spam
  statusPollTimer = setInterval(pollStatus, 3000);
  // Check immediately
  pollStatus();
  console.log('[Insta360] Service started — polling', INSTA360_IP, 'every 3s');
}

function stopPolling() {
  if (statusPollTimer) { clearInterval(statusPollTimer); statusPollTimer = null; }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────

ipcMain.handle('insta360:getStatus', async () => {
  try {
    const connected = await checkConnection();
    if (!connected) return { connected: false };
    const [info, state] = await Promise.all([
      getCameraInfo().catch(() => null),
      getCameraStatus().catch(() => null),
    ]);
    lastKnownStatus = { info, state };
    return { connected: true, info, state };
  } catch(e) {
    return { connected: false, error: e.message };
  }
});

ipcMain.handle('insta360:startRecording', async () => {
  try {
    const result = await startRecording();
    return { ok: !result.error, result };
  } catch(e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('insta360:stopRecording', async () => {
  try {
    const result = await stopRecording();
    return { ok: !result.error, result };
  } catch(e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('insta360:takePhoto', async () => {
  try {
    const result = await takePhoto();
    return { ok: !result.error, result };
  } catch(e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('insta360:getLensStatus', async () => {
  try {
    const result = await getLensStatus();
    return { ok: true, result };
  } catch(e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('insta360:getInfo', async () => {
  try {
    const info = await getCameraInfo();
    return { ok: true, info };
  } catch(e) {
    return { ok: false, error: e.message };
  }
});

// Lens check: returns MJPEG preview stream URL
ipcMain.handle('insta360:getLivePreviewUrl', async () => {
  // Insta360 X5 MJPEG preview endpoint
  return { url: `http://${INSTA360_IP}/livepreview/preview` };
});

function setCustomIp(ip) {
  if (ip && ip.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    INSTA360_IP = ip;
    console.log('[Insta360] Custom IP set to:', ip);
  }
}

module.exports = { startPolling, stopPolling, setCustomIp };
