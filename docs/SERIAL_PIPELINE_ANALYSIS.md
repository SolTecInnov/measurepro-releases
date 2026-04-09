# MeasurePRO Serial Port Pipeline — Full Technical Analysis

**Date:** 2026-04-09  
**Issue:** Laser data throughput is ~50% of what TeraTerm achieves on the same COM port  
**Laser:** Leica LDM71 ASCII protocol, sends `D  12.345 42.1\r\n` lines at ~10-20Hz  
**Platform:** Electron 35.7.5 on Windows 11, using `serialport` npm package in main process

---

## Architecture Overview

MeasurePRO is an Electron app. The browser renderer process **cannot** access serial ports directly. All serial I/O goes through Node.js in the Electron main process, then crosses the IPC boundary to reach the renderer where the app logic lives.

TeraTerm reads the COM port directly in a single process with zero IPC overhead. MeasurePRO has **7 hops** between the serial hardware and the screen.

---

## Complete Pipeline (7 Hops)

### HOP 1 — Node.js SerialPort (Main Process)

**File:** `electron/main.cjs` lines 272–301

```js
const port = new SerialPort({
  path: portPath,
  baudRate: options.baudRate || 9600,
  dataBits: options.dataBits || 8,
  stopBits: options.stopBits || 1,
  parity: options.parity || 'none',
  autoOpen: false,
});

port.on('data', (chunk) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('serial:data', portPath,
      new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
  }
});
```

**What happens:**
- The `serialport` npm package opens the COM port via native Node.js addon
- The OS delivers data in chunks (typically 64–4096 bytes depending on USB driver buffering)
- Each `data` event fires once per OS read
- The chunk (Node.js Buffer) is converted to `Uint8Array` and sent to the renderer via Electron IPC

**Bottleneck A — IPC per chunk:**  
Every OS serial read = 1 IPC message. Electron `webContents.send()` has ~0.5–2ms overhead per call (serialization, context switch between processes, deserialization). At high data rates with small chunks, this is the **primary bottleneck**. If the OS delivers 200 small chunks/sec, that's 200 IPC round-trips/sec.

---

### HOP 2 — Preload Bridge (IPC → Renderer)

**File:** `electron/preload.cjs` lines 124–126

```js
onData: (callback) => {
  ipcRenderer.on('serial:data', (_event, portPath, data) => {
    callback(portPath, data);
  });
},
```

**What happens:**
- Preload script receives the IPC message in the renderer process
- Passes the `portPath` string and `Uint8Array` data directly to the registered callback
- Pure passthrough — no processing

**Bottleneck:** Negligible, but the `ipcRenderer.on` event system has some overhead per message.

---

### HOP 3 — ReadableStream Polyfill (Web Serial API Emulation)

**File:** `src/lib/electron-serial-polyfill.ts` lines 58–76

```js
this._readable = new ReadableStream<Uint8Array>({
  start: (controller) => {
    this._readableController = controller;
    this._dataHandler = (portPath: string, data: Uint8Array | number[]) => {
      if (portPath === this.portPath) {
        try {
          controller.enqueue(data instanceof Uint8Array ? data : new Uint8Array(data));
        } catch {
          // Stream may have been closed
        }
      }
    };
    serial.onData(this._dataHandler);
  },
});
```

**What happens:**
- The polyfill emulates the Web Serial API (`navigator.serial`) so the renderer code works identically in both PWA and Electron modes
- IPC data is pushed into a `ReadableStream` via `controller.enqueue()`
- A `portPath` string comparison filters data for this specific port

**Bottleneck B — Global listener:**  
The `onData` callback receives data for ALL open serial ports. The `portPath === this.portPath` check runs on every chunk for every port. With multiple ports (laser + GPS), every chunk triggers callbacks for all ports.

---

### HOP 4 — Serial Read Loop

**File:** `src/lib/serial.ts` lines 489–506

```js
const readData = async () => {
  this.reader = this.port!.readable!.getReader();
  const textDecoder = new TextDecoder();
  while (true) {
    const { value, done } = await this.reader.read();
    if (done) break;

    if (this.isGPS && this.gpsReader) {
      this.gpsReader.processData(value);
    } else if (!this.isGPS && this.laserReader) {
      this.laserReader.processData(value);
    }

    if (this.onDataCallback && value && value.length > 0) {
      this.onDataCallback(textDecoder.decode(value));
    }
  }
};
```

**What happens:**
- Reads from the `ReadableStream` in an async loop
- Routes data to either `gpsReader` or `laserReader` based on port type
- Also decodes the raw bytes to string for `onDataCallback`

**Bottleneck C — Redundant decode:**  
`textDecoder.decode(value)` runs on every chunk even when `onDataCallback` is null or unused. This is the **first** text decode of the data. The laser reader does its own decode (see HOP 5), so this is wasted work.

---

### HOP 5 — Laser Reader + LDM71 Driver

**File:** `src/lib/readers/serialLaserReader.ts` lines 114–136

```js
processData(chunk: Uint8Array): void {
  this.processLdm71Data(chunk);
}

private processLdm71Data(chunk: Uint8Array): void {
  const measurements: LDM71MeasurementWithAmplitude[] = this.ldm71Driver!.feedBytes(chunk);

  for (const m of measurements) {
    if (m.distanceM !== null) {
      this.emitMeasurement(m.distanceM.toFixed(3));
    } else {
      this.emitMeasurement('--');
    }

    if (m.amplitudeDb !== undefined) {
      try {
        const driverFilter = this.ldm71Driver!.getAmplitudeFilter();
        useAmplitudeFilterStore.getState().updateStats(driverFilter.getStats());
      } catch (_e) {}
    }
  }
}
```

**File:** `src/lib/hardware/laser/ldm71AsciiDriver.ts` lines 110–158

```js
feedBytes(chunk: Uint8Array): LDM71MeasurementWithAmplitude[] {
  const results: LDM71MeasurementWithAmplitude[] = [];
  const now = Date.now();

  this.stats.bytesProcessed += chunk.length;
  const text = this.textDecoder.decode(chunk, { stream: true });  // ← 2nd decode!
  this.buffer += text;

  // ... splits on \n, parses each line with regex ...
}
```

**What happens:**
1. `feedBytes()` decodes the Uint8Array to string (**2nd decode** of same bytes)
2. Appends to internal line buffer
3. Splits on `\n`, parses each complete line
4. For each line: regex match `D  xxxx.xxx [xx.x]`, extract distance + amplitude
5. Runs amplitude filter (synchronous, fast)
6. Returns array of parsed measurements

**For each measurement, `emitMeasurement()` does:**
1. `measurementFilter.filter()` — synchronous consistency check
2. `window.dispatchEvent()` — custom event (throttled to 66ms / 15fps)
3. `notifyCallbacks()` — synchronous callbacks
4. `useSerialStore.getState().setLastLaserData()` — Zustand store update

**Bottleneck D — Zustand getState() per line:**  
`useAmplitudeFilterStore.getState().updateStats()` is called for every measurement line. While `getState()` is synchronous, `updateStats()` triggers Zustand `set()` which notifies all subscribers.

---

### HOP 6 — Zustand Store Update (Throttled)

**File:** `src/lib/stores/serialStore.ts` lines 824–890

```js
setLastLaserData: (data) => {
  const now = Date.now();
  const shouldUpdate = now - lastStoreUpdateTime >= STORE_UPDATE_THROTTLE_MS;

  if (!shouldUpdate) {
    return;  // ← DATA DROPPED for UI purposes
  }
  lastStoreUpdateTime = now;

  // NMEA filter (regex on every call)
  if (typeof data === 'string' && (
    data.startsWith('$GP') || data.startsWith('$GN') || ...
  )) {
    return;
  }

  // ... Zustand set() with measurement data ...
}
```

**Constants:**
```js
const STORE_UPDATE_THROTTLE_MS = 100;  // 10fps max re-renders
const DISPATCH_THROTTLE_MS = 66;       // 15fps max events
```

**What happens:**
- Store updates are throttled to **10 updates/sec** (100ms)
- Any data arriving faster than 10Hz is **silently dropped** at the store level
- NMEA regex filter runs on every call even for laser data
- `dispatchEvent` is separately throttled to 15fps

**Bottleneck E — Intentional throttle:**  
This throttle exists to prevent React from re-rendering 16+ subscriber components at 20Hz. It's correct for UI updates, but it means the display only shows every ~5th measurement. The actual data processing pipeline (logging, POI creation) operates upstream of this throttle and gets all data.

---

### HOP 7 — React Re-render

Components subscribed to `useSerialStore` re-render on every `set()` call (max 10fps due to throttle). This is the final hop.

---

## Why TeraTerm Is Faster

**TeraTerm pipeline (2 hops):**
```
COM port → OS kernel → TeraTerm process buffer → screen
```

**MeasurePRO pipeline (7 hops):**
```
COM port → OS kernel → Node SerialPort → Uint8Array copy
→ IPC serialize → process boundary → IPC deserialize
→ ReadableStream enqueue → ReadableStream read
→ TextDecoder #1 (unused) → TextDecoder #2 (actual)
→ Line parse → Regex → Filter → Zustand → React
```

The critical difference is **IPC overhead**. Each `webContents.send()` involves:
1. Structured clone serialization of the Uint8Array
2. Cross-process message passing (Chromium Mojo IPC)
3. Deserialization in the renderer process
4. JavaScript event dispatch

At ~0.5–2ms per IPC call, with the OS delivering data in many small chunks, this overhead accumulates to 50%+ throughput loss.

---

## Recommended Fixes (Ranked by Impact)

### Fix 1: Batch IPC Messages (HIGH IMPACT)
**File:** `electron/main.cjs`

Buffer incoming serial data for 8–16ms before sending one batched IPC message. This reduces IPC calls from hundreds/sec to ~60/sec.

```js
// Instead of sending per chunk:
const pendingData = new Map();  // portPath → [chunks]
let flushScheduled = false;

port.on('data', (chunk) => {
  if (!pendingData.has(portPath)) pendingData.set(portPath, []);
  pendingData.get(portPath).push(chunk);
  
  if (!flushScheduled) {
    flushScheduled = true;
    setTimeout(() => {
      for (const [path, chunks] of pendingData) {
        const merged = Buffer.concat(chunks);
        mainWindow.webContents.send('serial:data', path,
          new Uint8Array(merged.buffer, merged.byteOffset, merged.byteLength));
      }
      pendingData.clear();
      flushScheduled = false;
    }, 8);  // 8ms = ~125 batches/sec, well above 60fps
  }
});
```

### Fix 2: Remove Redundant TextDecoder (MEDIUM IMPACT)
**File:** `src/lib/serial.ts` line 504

```js
// BEFORE (always decodes):
if (this.onDataCallback && value && value.length > 0) {
  this.onDataCallback(textDecoder.decode(value));
}

// AFTER (only decode if callback exists):
if (this.onDataCallback) {
  this.onDataCallback(textDecoder.decode(value));
}
```

Or better: remove the `textDecoder` entirely from this loop since `ldm71AsciiDriver.feedBytes()` does its own decode.

### Fix 3: Per-Port IPC Channels (MEDIUM IMPACT)
**File:** `electron/preload.cjs` + `electron-serial-polyfill.ts`

Instead of one global `serial:data` channel with portPath filtering, use per-port IPC channels like `serial:data:COM3`. Eliminates the string comparison on every chunk for every port.

### Fix 4: MessagePort for Zero-Copy (HIGH IMPACT, MORE WORK)
Use Electron's `MessagePort` API instead of `webContents.send()`. MessagePort supports transferable objects (zero-copy `ArrayBuffer` transfer) and has lower per-message overhead.

```js
// Main process:
const { port1, port2 } = new MessageChannelMain();
mainWindow.webContents.postMessage('serial-channel', null, [port2]);

// Then in data handler:
port1.postMessage(chunk, [chunk.buffer]);  // zero-copy transfer
```

### Fix 5: SharedArrayBuffer Ring Buffer (HIGHEST IMPACT, MOST WORK)
Create a `SharedArrayBuffer` visible to both main and renderer processes. Main process writes serial data directly into the shared buffer. Renderer reads from it. Zero IPC, zero copy, zero serialization.

---

## File Reference

| File | Lines | Role |
|------|-------|------|
| `electron/main.cjs` | 272–301 | Serial port open + IPC forwarding |
| `electron/main.cjs` | 306–317 | Serial write (app → laser) |
| `electron/main.cjs` | 420–435 | Legacy laser port data forwarding |
| `electron/preload.cjs` | 119–138 | IPC bridge to renderer |
| `src/lib/electron-serial-polyfill.ts` | 22–100 | Web Serial API emulation |
| `src/lib/serial.ts` | 489–506 | ReadableStream read loop |
| `src/lib/readers/serialLaserReader.ts` | 40–159 | Laser data routing + measurement emission |
| `src/lib/hardware/laser/ldm71AsciiDriver.ts` | 110–230 | LDM71 ASCII protocol parser |
| `src/lib/hardware/laser/amplitudeFilter.ts` | 1–100 | Signal amplitude filter |
| `src/lib/filters/measurementFilter.ts` | 1–100 | Consistency filter |
| `src/lib/stores/serialStore.ts` | 824–890 | Zustand store (throttled to 10fps) |
| `src/lib/stores/amplitudeFilterStore.ts` | — | Amplitude filter stats store |

---

## Data Flow Diagram

```
┌──────────────┐
│  USB Serial   │
│  (COM port)   │
└──────┬───────┘
       │ OS kernel reads
       ▼
┌──────────────────────────────────────┐
│  MAIN PROCESS (Node.js)              │
│                                      │
│  SerialPort.on('data', Buffer)       │
│         │                            │
│         ▼                            │
│  webContents.send('serial:data',     │
│    portPath, Uint8Array)             │
│                                      │
│  ⚠ ~0.5-2ms per IPC call            │
└──────────────┬───────────────────────┘
               │ Electron IPC
               ▼
┌──────────────────────────────────────┐
│  RENDERER PROCESS (Chromium)         │
│                                      │
│  preload.cjs                         │
│    ipcRenderer.on('serial:data')     │
│         │                            │
│         ▼                            │
│  electron-serial-polyfill.ts         │
│    ReadableStream.enqueue(Uint8Array)│
│         │                            │
│         ▼                            │
│  serial.ts (read loop)              │
│    reader.read() → Uint8Array        │
│    ├→ textDecoder.decode() [UNUSED]  │
│    └→ laserReader.processData()      │
│              │                       │
│              ▼                       │
│  ldm71AsciiDriver.feedBytes()        │
│    textDecoder.decode() [ACTUAL]     │
│    buffer += text                    │
│    split on \n → parseLine()         │
│         │                            │
│         ▼                            │
│  emitMeasurement()                   │
│    ├→ measurementFilter (sync)       │
│    ├→ notifyCallbacks (sync)         │
│    ├→ dispatchEvent (throttled 66ms) │
│    └→ setLastLaserData (throttled    │
│         100ms = 10fps)               │
│              │                       │
│              ▼                       │
│  React re-render (10fps max)         │
└──────────────────────────────────────┘
```

---

## Repo Location

```
C:\Users\Jean-FrancoisPrince\measurepro-electron
```

**Stack:** Electron 35.7.5 + React + TypeScript + Vite + Zustand  
**Serial library:** `serialport` npm package (Node.js native addon)  
**Baud rate:** Configurable, typically 19200 or 115200 for LDM71
