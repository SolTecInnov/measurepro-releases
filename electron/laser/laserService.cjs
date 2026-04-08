/**
 * MeasurePRO — Electron Laser Service
 * Uses serialport npm — NO Web Serial API dialog needed
 * Auto-connects on startup using saved COM port settings
 */

const { SerialPort } = require('serialport');

let port = null;
let mainWindowRef = null;
let buffer = '';

// ── Format parsers ────────────────────────────────────────────────────────────

function parseLine(line, format) {
  const t = line.trim();
  if (!t) return null;
  
  // Sky/error codes — always check first
  if (/^[Dd][Ee]\d+$/.test(t) || /^[Ee]\d+$/.test(t) || t === '--' || t === 'infinity') {
    return { type: 'sky', raw: t };
  }
  
  let meters = null;
  
  switch (format || 'ldm71') {
    case 'ldm71':
    case 'astech': {
      // D 0005.230 021.9  OR  D 0005.230
      const m = t.match(/^D\s+(\d+\.\d+)/);
      if (m) meters = parseFloat(m[1]);
      // Also try [LASER] D -> x.xxx m
      if (!meters) {
        const m2 = t.match(/\[LASER\].*->\s*([\d.]+)/);
        if (m2) meters = parseFloat(m2[1]);
      }
      break;
    }
    case 'acuity': {
      // ±005230 (µm)
      const m = t.match(/^([+-]?\d+)\s*$/);
      if (m) meters = parseInt(m[1]) / 1000000;
      break;
    }
    case 'dimetix': {
      // g0+00005230 (µm, signed, 10 digits)
      const m = t.match(/^g0([+-]\d{8,10})\s*$/);
      if (m) meters = parseInt(m[1]) / 1000000;
      break;
    }
    case 'generic_m': {
      const n = parseFloat(t);
      if (!isNaN(n)) meters = n;
      break;
    }
    case 'generic_mm': {
      const n = parseInt(t);
      if (!isNaN(n)) meters = n / 1000;
      break;
    }
  }
  
  if (meters !== null && meters > 0.1) {
    return { type: 'measurement', value: meters.toFixed(3), raw: t };
  }
  if (meters !== null && meters <= 0.1) {
    return { type: 'sky', raw: t }; // noise/ground reflection
  }
  
  return null;
}

function processChunk(chunk, format) {
  buffer += chunk.toString('utf8', 0, chunk.length);
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Always send raw line to laserLog
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('laser:raw-line', line.trim());
    }
    
    const result = parseLine(line, format);
    if (result) {
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('laser:measurement', result);
      }
    }
  }
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function initLaserHandlers(ipcMain, getMainWindow) {
  mainWindowRef = getMainWindow();

  // List available COM ports
  ipcMain.handle('laser:list-ports', async () => {
    try {
      const ports = await SerialPort.list();
      return ports.map(p => ({
        path: p.path,
        manufacturer: p.manufacturer || '',
        serialNumber: p.serialNumber || '',
        pnpId: p.pnpId || '',
        locationId: p.locationId || '',
        vendorId: p.vendorId || '',
        productId: p.productId || '',
      }));
    } catch (e) {
      console.error('[Laser] list-ports error:', e.message);
      return [];
    }
  });

  // Connect to laser (no dialog!)
  ipcMain.handle('laser:connect', async (_, { comPort, baudRate, format, dataBits, stopBits, parity }) => {
    if (port) {
      try { port.close(); } catch {}
      port = null;
    }
    
    try {
      port = new SerialPort({
        path: comPort,
        baudRate: baudRate || 115200,
        dataBits: dataBits || 8,
        stopBits: stopBits || 1,
        parity: parity || 'none',
        autoOpen: false,
      });

      await new Promise((resolve, reject) => {
        port.open(err => err ? reject(err) : resolve());
      });

      port.on('data', (chunk) => processChunk(chunk, format));
      port.on('error', (err) => {
        console.error('[Laser] Port error:', err.message);
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('laser:error', err.message);
        }
      });
      port.on('close', () => {
        console.log('[Laser] Port closed');
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('laser:disconnected');
        }
      });

      console.log(`[Laser] Connected to ${comPort} at ${baudRate || 115200} baud`);
      return { connected: true, port: comPort };
    } catch (e) {
      console.error('[Laser] Connect error:', e.message);
      port = null;
      return { connected: false, error: e.message };
    }
  });

  // Disconnect
  ipcMain.handle('laser:disconnect', async () => {
    if (port) {
      try { port.close(); } catch {}
      port = null;
    }
    return { disconnected: true };
  });

  // Send command to laser (e.g. DT to start streaming)
  ipcMain.handle('laser:send-command', async (_, cmd) => {
    if (!port || !port.isOpen) return { sent: false, error: 'Not connected' };
    try {
      await new Promise((resolve, reject) => {
        port.write(cmd + '\r', err => err ? reject(err) : resolve());
      });
      return { sent: true };
    } catch (e) {
      return { sent: false, error: e.message };
    }
  });

  // Get connection status
  ipcMain.handle('laser:status', () => ({
    connected: port !== null && port.isOpen,
    port: port?.path || null,
  }));

  console.log('[Laser] IPC handlers registered');
}

module.exports = { initLaserHandlers };
