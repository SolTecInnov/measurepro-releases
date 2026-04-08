# MeasurePRO & SweptPRO — Complete Rebuild Guide
# Written: 2026-04-07 by OpenClaw agent
# Version of apps at time of writing: MeasurePRO v15.6.38 / SweptPRO v1.3.4
# Purpose: Someone with no prior context can rebuild everything from scratch

---

# TABLE OF CONTENTS

1. What These Apps Are (Product Vision)
2. Hardware Setup
3. All Credentials & API Keys
4. Technology Stack
5. Project Directory Structure
6. Electron Architecture (main.cjs + preload.cjs)
7. Laser Reading Pipeline (serial → store → log)
8. GPS/GNSS Pipeline (Duro → store)
9. Logging Engine (3 modes)
10. Database Architecture (IndexedDB + Firebase)
11. Firebase Auth & Licensing
12. Field App (mobile PWA — Firestore relay)
13. Camera Integration (Insta360)
14. Drone Import (DJI)
15. Settings Architecture
16. UI Architecture (components, stores, hooks)
17. Survey Data Model
18. POI Types & Actions
19. SweptPRO — Convoy Simulation
20. Build & Release Process
21. Future: GNSS Profiling (separate app)
22. Future: RPLIDAR A2M12
23. Critical Lessons Learned (DO NOT repeat)
24. Full File Tree
25. Quick Reference Commands

---

# PART 1 — WHAT THESE APPS ARE

## Product Vision

**MeasurePRO** is a professional field survey application for overhead clearance measurement. A technician drives a survey vehicle under overhead obstacles (power lines, bridges, traffic signs, overpasses) while a laser rangefinder measures clearance distances continuously. The app logs GPS-stamped POIs (Points of Interest) with photos and height measurements. Data syncs to Firebase for reporting.

**SweptPRO** is a swept path analysis tool for oversized/overwidth convoy route planning. The user draws a route on a satellite map, selects a convoy configuration, and the app simulates the swept path envelope — showing exactly how much space the convoy needs at every point in the route, especially in turns.

## Business Context

Company: Soltec Innovation (jfprince@soltec.ca)
Market: Transport/survey professionals in North America
Competition: AutoTurn (~$15K/yr), HeavyGoods, custom solutions
Revenue model: Annual/monthly SaaS licenses per user

## Who Uses It

- Survey technicians in a truck — must be able to use while driving (voice commands, Stream Deck)
- Road survey contractors — need reliable data collection, no laptop skills required
- OS/OW (Oversize/Overwidth) transport planners — need swept path analysis

---

# PART 2 — HARDWARE SETUP

## Primary Survey Truck Hardware

### Laser Rangefinder — Soltec/Jenoptik LDM71
- Connection: USB-to-Serial adapter → COM port (Windows)
- Protocol: ASCII, 9600 or 115200 baud
- Output format: `D 0005.230 021.9\r\n`
  - `D` = distance marker
  - `0005.230` = distance in meters (4 digits + 3 decimal)
  - `021.9` = amplitude in dB (signal strength, optional)
- Error codes: `DE02` = no target (sky), `E001` = hardware error
- Physical: mounted on roof of truck, pointed upward at 90°

### GNSS Receiver — Swift Navigation Duro Inertial
- Connection: Ethernet cable to truck router → TCP socket
- Default IP: 192.168.0.222, Port: 2101
- Protocol: NMEA 0183 sentences over TCP
- Key sentences: $GPGGA (position+altitude), $GPRMC (speed+course), $GPGSV (satellites)
- RTK Fix Quality codes: 1=GPS, 4=RTK Fixed (cm accuracy), 5=RTK Float (dm accuracy)
- IMU data: heading, roll, pitch (proprietary sentences)
- Physical: mounted on roof of truck, connected to base station via radio

### Camera — Insta360 X5
- Connection: USB-C cable → RNDIS virtual network adapter (IP 192.168.42.1)
- Protocol: Open Spherical Camera (OSC) API over HTTP
  - GET http://192.168.42.1/osc/info → camera info
  - POST http://192.168.42.1/osc/state → battery, storage, mode
  - POST http://192.168.42.1/osc/commands/execute → take photo, start/stop video
- Physical: mounted on roof of truck, records 360° video
- Note: USB-A adapter may NOT create RNDIS adapter — use USB-C cable

### Input Devices
- Elgato Stream Deck — keyboard shortcuts while driving
- Voice commands — for eyes-on-road operation

### Future Hardware (2 weeks from now)
- Slamtec RPLIDAR A2M12 — 2D 360° lidar scanner
  - Mounted perpendicular to road direction
  - Scans cross-section of road: ceiling height, left clearance, right clearance
  - Protocol: USB serial, binary SDK packets
  - Use case: Generate full clearance profile at each POI

## DJI Drones (Bridge Inspection)
- DJI Mini 4 Pro — primary inspection drone
- DJI Matrice 4E — heavy inspection, RTK GPS
- Connected via: SD card in laptop OR USB-C cable (RNDIS, same as Insta360)
- Used for: pre-survey aerial photos to overlay on Mapbox satellite

---

# PART 3 — ALL CREDENTIALS & API KEYS

## Firebase (CRITICAL — auth + database)
```
Project ID:           measureprov1
Auth Domain:          measureprov1.firebaseapp.com
Database URL:         (not enabled — using Firestore only)
Storage Bucket:       measureprov1.firebasestorage.app
Messaging Sender ID:  341067281215
App ID:               1:341067281215:web:57ac6a6a298dd65f73598a
Measurement ID:       G-YWX367PWKJ
Firebase API Key:     AIzaSyCIC_bcUVl0gtjmBq82WK5Fbc61Bec3bFw
```

Firebase master admin accounts (full access, bypass all license checks):
- jfprince@soltec.ca (JF Prince — owner)

Firebase security model:
- API key is PUBLIC (by design — Firebase restricts by Firebase Rules, not key secrecy)
- Real security is in Firebase Authentication + Firestore Rules
- Do NOT restrict the API key — it breaks SDK initialization

## Mapbox (for SweptPRO satellite maps)
```
Access Token: pk.eyJ1IjoiamZwcmluY2UiLCJhIjoiY21ubzA5dnpqMjAzZzJwcHNkdDVqb3RpbCJ9.W9gbUE1yxw9_30lfQ1UjPA
Username: jfprince
Style: mapbox://styles/mapbox/satellite-streets-v12 (primary)
```

## GitHub (release hosting)
```
Organization: SolTecInnov
Repository (MeasurePRO): measurepro-releases (public, binary releases only)
Repository (SweptPRO):   sweptpro-releases   (public, binary releases only)
Personal Access Token:   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
Scope: repo (needed for creating releases and uploading assets)
```

Token usage in scripts:
```bash
GH_TOKEN=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 node scripts/create-release.cjs "15.6.38" "Release notes"
```

## Google Maps
```
API Key: AIzaSyAp_RmGGw4Pb_zL25Q7Tr2O7b17QoSXuPk
Used for: (legacy, being phased out in favor of Mapbox)
```

## Replit
```
Username: jfprince
Password: Tremor2025!!
Project: MeasurePro-v1 (team: soltec-innovation)
URL: https://measure-pro.app (serves field app PWA)
```
Note: measure-pro.app serves the old PWA build. The field app slave-app route needs updating.

## Environment File (.env in project root)
```
VITE_FIREBASE_API_KEY=AIzaSyCIC_bcUVl0gtjmBq82WK5Fbc61Bec3bFw
VITE_FIREBASE_AUTH_DOMAIN=measureprov1.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=measureprov1
VITE_FIREBASE_STORAGE_BUCKET=measureprov1.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=341067281215
VITE_FIREBASE_APP_ID=1:341067281215:web:57ac6a6a298dd65f73598a
VITE_FIREBASE_MEASUREMENT_ID=G-YWX367PWKJ
VITE_GOOGLE_MAPS_API_KEY=AIzaSyAp_RmGGw4Pb_zL25Q7Tr2O7b17QoSXuPk
VITE_API_URL=https://measure-pro.app
```

---

# PART 4 — TECHNOLOGY STACK

## Frontend
```
Framework:    React 18 + TypeScript 5 (strict mode)
Build tool:   Vite 6
CSS:          Tailwind CSS 3.4
UI Components: Radix UI primitives (for accessible components)
Icons:        Lucide React ONLY (no emoji, no other icon libs)
State:        Zustand 5 (simple, direct)
Routing:      React Router DOM 7 (main app) + Wouter (some pages)
Toasts:       Sonner (MINIMIZE USE — sound is primary feedback)
Date/time:    date-fns
HTTP:         Native fetch API (no axios)
```

## Desktop Shell
```
Runtime:      Electron 35
Builder:      electron-builder 25 (NSIS for installer, win-unpacked for portable)
Node IPC:     contextBridge + ipcRenderer/ipcMain
Auto-update:  electron-updater (from electron-builder)
```

## Backend/Database
```
Local DB:     IndexedDB via idb library (offline-first)
Future local: better-sqlite3 (synchronous, fast, no overhead)
Cloud sync:   Firebase Firestore (realtime, auth, licensing)
Cloud auth:   Firebase Authentication (email/password)
```

## Development Environment
```
OS:           Windows 11 with WSL2 (Ubuntu)
Node:         v22.22.0 (via nvm)
npm:          v10+
Python:       3.12 (for build scripts)
Shell:        bash (WSL) + PowerShell (Windows builds)
```

## Key npm packages to include from scratch
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "typescript": "^5.8.3",
    "electron": "^35.7.5",
    "firebase": "^11.7.1",
    "zustand": "^5.0.5",
    "idb": "^8.0.3",
    "lucide-react": "^0.511.0",
    "sonner": "^2.0.7",
    "tailwindcss": "^3.4.17",
    "wouter": "^3.7.1",
    "react-router-dom": "^7.14.0",
    "qrcode.react": "^4.2.0",
    "jszip": "^3.10.1",
    "jspdf": "^2.5.1",
    "electron-updater": "^6.3.9",
    "exifr": "^7.1.3",
    "serialport": "^12.0.0",
    "better-sqlite3": "^11.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.5.2",
    "electron-builder": "^25.1.8",
    "vite": "^6.3.3",
    "@electron/asar": "^3.4.0",
    "concurrently": "^9.1.2",
    "cross-env": "^7.0.3",
    "wait-on": "^8.0.3"
  }
}
```

---

# PART 5 — PROJECT DIRECTORY STRUCTURE

## MeasurePRO (C:\Users\jfpri\measurepro-electron)

```
measurepro-electron/
├── electron/                   ← Electron main process (Node.js, CommonJS)
│   ├── main.cjs                ← App entry, window creation, IPC handlers
│   ├── preload.cjs             ← contextBridge API for renderer
│   ├── db/
│   │   └── measurementsDB.cjs  ← SQLite schema + IPC handlers
│   ├── drone/
│   │   ├── driveDetector.cjs   ← DJI SD card detection (Windows drives)
│   │   ├── droneImportService.cjs ← Image import orchestrator
│   │   ├── imageProcessor.cjs  ← EXIF/XMP extraction
│   │   └── poiMatcher.cjs      ← GPS-based grouping
│   └── insta360/
│       └── insta360Service.cjs ← Camera control via OSC API
├── src/                        ← Vite/React frontend (ESM, TypeScript)
│   ├── App.tsx                 ← Main component, auth, routing
│   ├── main.tsx                ← React entry point
│   ├── components/
│   │   ├── settings/           ← All Settings tab components
│   │   │   ├── LaserGPSSettings.tsx      ← Serial laser + GPS config
│   │   │   ├── LaserConnectionSettings.tsx ← NEW: COM/baud/format/test
│   │   │   ├── GnssSettings.tsx          ← Duro TCP connection
│   │   │   ├── CameraSettings.tsx        ← Camera selection
│   │   │   ├── LoggingSettings.tsx       ← Auto-save, thresholds
│   │   │   ├── DetectionSettings.tsx     ← Buffer detection per-type
│   │   │   ├── AlertSettings.tsx         ← Warning/critical thresholds
│   │   │   ├── EmailSettings.tsx         ← Auto-email survey reports
│   │   │   ├── POIActionSettings.tsx     ← Per-type capture actions
│   │   │   ├── BackupSettings.tsx        ← Export/import all data
│   │   │   ├── AboutSettings.tsx         ← Version, changelog
│   │   │   └── HelpSettings.tsx          ← Documentation
│   │   ├── measurement/        ← Measurement display cards
│   │   │   ├── CurrentMeasureCard.tsx    ← Big current reading
│   │   │   ├── LastMeasureCard.tsx       ← Last reading (half size)
│   │   │   └── MinimumDistanceCard.tsx  ← Session minimum
│   │   ├── camera/             ← Camera UI
│   │   │   ├── CameraOverlay.tsx         ← On-screen overlay (GPS, height, etc.)
│   │   │   └── Insta360Card.tsx          ← Camera preview + controls
│   │   ├── gnss/               ← GNSS profiling components
│   │   │   ├── RoadProfileCard.tsx       ← Mini elevation chart (main screen)
│   │   │   └── GnssViewer.tsx            ← Full GNSS data display
│   │   ├── drone/              ← Drone import UI
│   │   │   └── DroneImportPanel.tsx
│   │   ├── profile/            ← GNSS profiling visualization
│   │   │   ├── RoadProfileView.tsx       ← Split map+profile panel
│   │   │   └── ProfileExport.ts          ← GPX/KML/JSON export
│   │   ├── slave/              ← Field app mobile components
│   │   │   ├── SlaveAppCodeEntry.tsx     ← Code entry / QR scan
│   │   │   └── SlaveAppWithPairing.tsx   ← Firestore relay logic
│   │   ├── AutoUpdater.tsx     ← Auto-update notification UI
│   │   ├── DisclaimerModal.tsx ← Legal terms (shown once)
│   │   ├── LiveCamera.tsx      ← Camera live feed card
│   │   ├── MeasurementCards.tsx ← Main measurement display
│   │   ├── MeasurementLog.tsx  ← Activity log (list of POIs)
│   │   └── TabManager.tsx      ← Settings panel orchestrator
│   ├── hooks/
│   │   ├── logging/            ← NEW logging engine (replaces useMeasurementLogging)
│   │   │   ├── useLoggingCore.ts     ← save POI, GPS snapshot, async image
│   │   │   ├── useAllDataMode.ts     ← log every valid reading
│   │   │   ├── useCounterMode.ts     ← sky→object→sky detection
│   │   │   ├── useBufferMode.ts      ← per-type timer+distance
│   │   │   └── useLogging.ts         ← orchestrator, public API
│   │   ├── useMeasurementLogging.ts  ← OLD (keep for reference, not used)
│   │   ├── useGnssData.ts      ← unified GNSS data hook
│   │   ├── useProfileRecording.ts ← GNSS road profiling
│   │   └── useLicenseEnforcement.tsx ← feature gating
│   ├── lib/
│   │   ├── stores/
│   │   │   ├── serialStore.ts  ← laser lastMeasurement, connection state
│   │   │   ├── gpsStore.ts     ← GPS data (lat/lng/alt/speed/fix quality)
│   │   │   └── alertsStore.ts  ← warning/critical alert state
│   │   ├── readers/
│   │   │   └── serialLaserReader.ts ← multi-format laser parser
│   │   ├── hardware/
│   │   │   └── laser/
│   │   │       ├── ldm71AsciiDriver.ts  ← LDM71 protocol driver
│   │   │       ├── amplitudeFilter.ts   ← (disabled — for future use)
│   │   │       └── profiles.ts          ← laser hardware profiles
│   │   ├── survey/
│   │   │   ├── store.ts        ← active survey Zustand store
│   │   │   ├── db.ts           ← openSurveyDB() IndexedDB
│   │   │   └── types.ts        ← Survey, Measurement TypeScript interfaces
│   │   ├── poi.ts              ← POI types, MEASUREMENT_FREE_POI_TYPES
│   │   ├── poiActions.ts       ← per-type capture actions store
│   │   ├── laserLog.ts         ← module-level laser output buffer
│   │   ├── firebase.ts         ← Firebase init (with memoryLocalCache guard)
│   │   ├── settings.ts         ← global settings Zustand store
│   │   ├── laser.ts            ← useLaserStore (ground reference etc.)
│   │   ├── sounds.ts           ← soundManager (play sounds for events)
│   │   ├── detection/
│   │   │   └── BufferDetectionService.ts ← buffer config store (per-type)
│   │   ├── gnss/
│   │   │   ├── duroGpsService.ts    ← Duro polling service
│   │   │   └── profileComputation.ts ← grade + K-factor calculation
│   │   ├── auth/
│   │   │   ├── masterAdmin.ts       ← master admin list, feature keys
│   │   │   ├── FeatureProtectedRoute.tsx
│   │   │   └── offlineAuth.ts       ← offline license caching
│   │   └── utils/
│   │       ├── geoUtils.ts     ← calculateDistance() (haversine)
│   │       ├── unitConversion.ts ← meters/feet/inches conversion
│   │       └── laserUtils.ts   ← isInvalidMeasurement(), convertToMeters()
│   ├── stores/
│   │   ├── droneStore.ts       ← drone images on map state
│   │   └── cameraStore360.ts   ← Insta360 state
│   ├── pages/
│   │   ├── Settings.tsx        ← Main settings page (uses TabManager)
│   │   └── RoadProfile.tsx     ← GNSS profiling full page
│   └── engine/                 ← (SweptPRO only — see Part 19)
├── public/
│   └── sounds/                 ← WAV/MP3 sound files
│       ├── notify-soft.wav
│       ├── poi-log.wav
│       ├── warning-soft.wav
│       ├── critical-alert.wav
│       ├── camera-click.wav
│       ├── mode-change.wav
│       └── success-chime.wav
├── build-resources/
│   └── icon.ico                ← App icon
├── scripts/
│   └── create-release.cjs      ← GitHub release automation
├── .env                        ← API keys (see Part 3)
├── electron-builder.json5      ← Build config
├── vite.config.ts              ← Vite config
├── package.json
└── tsconfig.json
```

---

# PART 6 — ELECTRON ARCHITECTURE

## main.cjs — Complete Structure

```javascript
'use strict';
const { app, BrowserWindow, ipcMain, Menu, shell, Tray, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { SerialPort } = require('serialport'); // if using node serialport

// ── CRITICAL: Auto-updater guard ──────────────────────────────────────────
// MUST have try-catch — if electron-updater is not bundled, app crashes
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
} catch (_e) {
  console.warn('[Main] electron-updater not available:', _e.message);
}

const isDev = process.env.IS_DEV === 'true';
let mainWindow;

// ── Window creation ───────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1024, minHeight: 768,
    title: 'MeasurePRO',
    icon: path.join(__dirname, '../build-resources/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,  // needed for local file:// access
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// ── App menu (Windows title bar) ──────────────────────────────────────────
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New Survey', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('menu', 'new-survey') },
        { label: 'Save Survey', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu', 'save-survey') },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' }
      ]
    },
    {
      label: 'Survey',
      submenu: [
        { label: 'Start All Data Logging', accelerator: 'F5', click: () => mainWindow.webContents.send('menu', 'start-all-data') },
        { label: 'Start Counter Detection', accelerator: 'F6', click: () => mainWindow.webContents.send('menu', 'start-counter') },
        { label: 'Start Buffer Detection', accelerator: 'F7', click: () => mainWindow.webContents.send('menu', 'start-buffer') },
        { label: 'Stop Logging', accelerator: 'F8', click: () => mainWindow.webContents.send('menu', 'stop-logging') },
        { label: 'Log POI (Manual)', accelerator: 'Space', click: () => mainWindow.webContents.send('menu', 'log-manual') },
      ]
    },
    {
      label: 'Hardware',
      submenu: [
        { label: 'Connect Laser', click: () => mainWindow.webContents.send('menu', 'connect-laser') },
        { label: 'Connect GNSS (Duro)', click: () => mainWindow.webContents.send('menu', 'connect-gnss') },
        { label: 'Connect Camera', click: () => mainWindow.webContents.send('menu', 'connect-camera') },
      ]
    },
    {
      label: 'Settings',
      click: () => mainWindow.webContents.send('menu', 'open-settings')
    },
    {
      label: 'Help',
      submenu: [
        { label: 'User Manual', click: () => shell.openExternal('https://soltecinnovation.com/manual') },
        { label: 'Help & FAQ', click: () => mainWindow.webContents.send('menu', 'open-help') },
        { type: 'separator' },
        { label: 'Check for Updates', click: () => {
          if (autoUpdater) autoUpdater.checkForUpdates().catch(console.error);
          else shell.openExternal('https://github.com/SolTecInnov/measurepro-releases/releases/latest');
        }},
        { label: 'About MeasurePRO', click: () => mainWindow.webContents.send('menu', 'about') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Auto-updater events ────────────────────────────────────────────────────
if (autoUpdater) {
  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('updater:update-available', info);
  });
  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('updater:download-progress', progress);
  });
  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('updater:update-downloaded', info);
  });
  autoUpdater.on('error', (err) => console.error('[AutoUpdater]', err.message));
}

ipcMain.handle('updater:check', async () => {
  return autoUpdater ? await autoUpdater.checkForUpdates() : null;
});
ipcMain.handle('updater:install-now', () => {
  if (autoUpdater) autoUpdater.quitAndInstall(false, true);
});

// ── GNSS Duro TCP connection ───────────────────────────────────────────────
const net = require('net');
let duroSocket = null;

ipcMain.handle('duro:connect', async (_, host, port) => {
  if (duroSocket) { duroSocket.destroy(); duroSocket = null; }
  return new Promise((resolve, reject) => {
    duroSocket = new net.Socket();
    duroSocket.connect(port, host, () => {
      mainWindow?.webContents.send('duro:connected', { host, port });
      resolve({ connected: true });
    });
    duroSocket.on('data', (data) => {
      mainWindow?.webContents.send('duro:data', data.toString('utf8'));
    });
    duroSocket.on('error', (err) => {
      mainWindow?.webContents.send('duro:error', err.message);
      resolve({ connected: false, error: err.message });
    });
    duroSocket.on('close', () => {
      mainWindow?.webContents.send('duro:disconnected');
    });
    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
});

ipcMain.handle('duro:disconnect', () => {
  if (duroSocket) { duroSocket.destroy(); duroSocket = null; }
  return { disconnected: true };
});

ipcMain.handle('duro:getStatus', () => ({
  connected: duroSocket?.readyState === 'open',
}));

// ── Insta360 service ────────────────────────────────────────────────────────
const { startPolling: startInsta360, stopPolling: stopInsta360 } = 
  require('./insta360/insta360Service.cjs');

// ── Drone import service ────────────────────────────────────────────────────
const { startDroneWatcher, stopDroneWatcher } = require('./drone/droneService.cjs');

// ── DB IPC handlers ─────────────────────────────────────────────────────────
const { initDBHandlers } = require('./db/measurementsDB.cjs');
initDBHandlers(ipcMain);

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createMenu();
  startInsta360(mainWindow);
  startDroneWatcher(mainWindow);
  
  // Check for updates 30 seconds after launch (not on first launch)
  setTimeout(() => {
    if (autoUpdater) autoUpdater.checkForUpdates().catch(() => {});
  }, 30000);
});

app.on('will-quit', () => {
  stopInsta360();
  stopDroneWatcher();
});
```

## preload.cjs — Full API Surface

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  
  // Menu events
  onMenu: (cb) => ipcRenderer.on('menu', (_e, action) => cb(action)),
  removeMenuListener: () => ipcRenderer.removeAllListeners('menu'),
  
  // GNSS Duro
  duroConnect:       (host, port) => ipcRenderer.invoke('duro:connect', host, port),
  duroDisconnect:    ()           => ipcRenderer.invoke('duro:disconnect'),
  duroGetStatus:     ()           => ipcRenderer.invoke('duro:getStatus'),
  onDuroData:        (cb)         => ipcRenderer.on('duro:data',         (_e, d) => cb(d)),
  onDuroConnected:   (cb)         => ipcRenderer.on('duro:connected',    (_e, d) => cb(d)),
  onDuroDisconnected:(cb)         => ipcRenderer.on('duro:disconnected', ()      => cb()),
  onDuroError:       (cb)         => ipcRenderer.on('duro:error',        (_e, d) => cb(d)),
  removeDuroListeners: () => {
    ['duro:data','duro:connected','duro:disconnected','duro:error']
      .forEach(ch => ipcRenderer.removeAllListeners(ch));
  },
  
  // Insta360 Camera
  insta360GetStatus:        ()    => ipcRenderer.invoke('insta360:getStatus'),
  insta360TakePhoto:        ()    => ipcRenderer.invoke('insta360:takePhoto'),
  insta360StartRecording:   ()    => ipcRenderer.invoke('insta360:startRecording'),
  insta360StopRecording:    ()    => ipcRenderer.invoke('insta360:stopRecording'),
  insta360GetLivePreviewUrl:()    => ipcRenderer.invoke('insta360:getLivePreviewUrl'),
  insta360SetCustomIp:      (ip)  => ipcRenderer.invoke('insta360:setCustomIp', ip),
  onInsta360Connection:  (cb)     => ipcRenderer.on('insta360:connection', (_e, d) => cb(d)),
  onInsta360Status:      (cb)     => ipcRenderer.on('insta360:status',     (_e, d) => cb(d)),
  removeInsta360Listeners: () => {
    ipcRenderer.removeAllListeners('insta360:connection');
    ipcRenderer.removeAllListeners('insta360:status');
  },
  
  // Drone import
  droneScan:        ()      => ipcRenderer.invoke('drone:scan'),
  droneLoadImages:  (opts)  => ipcRenderer.invoke('drone:load-images', opts),
  droneReadImage:   (opts)  => ipcRenderer.invoke('drone:read-image', opts),
  onDroneDetected:  (cb)    => ipcRenderer.on('drone:detected', (_e, d) => cb(d)),
  onDroneRemoved:   (cb)    => ipcRenderer.on('drone:removed',  (_e, d) => cb(d)),
  onDroneProgress:  (cb)    => ipcRenderer.on('drone:progress', (_e, d) => cb(d)),
  removeDroneListeners: () => {
    ['drone:detected','drone:removed','drone:progress']
      .forEach(ch => ipcRenderer.removeAllListeners(ch));
  },
  
  // Auto-updater
  updaterCheck:       ()    => ipcRenderer.invoke('updater:check'),
  updaterInstallNow:  ()    => ipcRenderer.invoke('updater:install-now'),
  onUpdateAvailable:  (cb)  => ipcRenderer.on('updater:update-available',  (_e, d) => cb(d)),
  onDownloadProgress: (cb)  => ipcRenderer.on('updater:download-progress', (_e, d) => cb(d)),
  onUpdateDownloaded: (cb)  => ipcRenderer.on('updater:update-downloaded', (_e, d) => cb(d)),
  removeUpdaterListeners: () => {
    ['updater:update-available','updater:download-progress','updater:update-downloaded']
      .forEach(ch => ipcRenderer.removeAllListeners(ch));
  },
  
  // Database (SQLite)
  dbSaveMeasurement:  (m)           => ipcRenderer.invoke('db:save-measurement', m),
  dbGetMeasurements:  (id, limit)   => ipcRenderer.invoke('db:get-measurements', id, limit),
  dbNextPoiNumber:    (surveyId)    => ipcRenderer.invoke('db:next-poi-number', surveyId),
  dbGetSetting:       (key, def)    => ipcRenderer.invoke('db:get-setting', key, def),
  dbSetSetting:       (key, val)    => ipcRenderer.invoke('db:set-setting', key, val),
});
```

---

# PART 7 — LASER READING PIPELINE

## Full flow from bytes to UI

```
User connects laser via USB/serial
  ↓
Web Serial API (navigator.serial)
  → requestPort() shows port picker
  → port.open({ baudRate: 115200 })
  → port.readable.getReader()
  ↓
LaserReader class (src/lib/readers/serialLaserReader.ts)
  → processData(chunk: Uint8Array)
  → For LDM71: delegates to LDM71AsciiDriver.feedBytes()
  ↓
LDM71AsciiDriver (src/lib/hardware/laser/ldm71AsciiDriver.ts)
  → Accumulates bytes in buffer
  → Splits on \n to get lines
  → For each line:
    a) rawLineCallback(line)  → appendToLaserOutput(line)
    b) parseLine(line)        → returns { distanceM, amplitudeDb } or null
  ↓
appendToLaserOutput() (src/lib/laserLog.ts)
  → Appends to module-level laserLogBuffer (NOT React state)
  → Notifies subscribers (throttled to 250ms)
  → Used by counter/buffer detection
  ↓
LaserReader.emitMeasurement(distanceM.toFixed(3))
  → isInvalidReading() check
  → MeasurementFilter (quality tracking only, non-blocking)
  → useSerialStore.setLastLaserData(displayValue)
  ↓
useSerialStore (Zustand)
  → lastMeasurement: string  ← React components subscribe here
  → triggers re-renders of measurement cards
  ↓
MeasurementCards.tsx
  → CurrentMeasureCard shows lastMeasurement + groundRef
  → LastMeasureCard shows previous reading
  → SessionMin card shows minimum since survey start
```

## LaserLog module (src/lib/laserLog.ts)

```typescript
// This is NOT React state — it's a module-level buffer
// Avoids per-byte re-renders
let laserLogBuffer = "";

export function appendToLaserOutput(line: string) {
  laserLogBuffer += line + "\n";
  const lines = laserLogBuffer.split("\n");
  if (lines.length > 500) {  // keep last 500 lines only
    laserLogBuffer = lines.slice(lines.length - 500).join("\n");
  }
  scheduleNotify(); // throttled 250ms notification
}

export function getLaserLog() { return laserLogBuffer; }
```

## LDM71 format parsing
```
Input line:  "D 0005.230 021.9"
Regex:       /^D\s+(\d+\.\d+)(?:\s+[\d.]+)?$/
Group 1:     "0005.230" → parseFloat → 5.23
Amplitude:   "021.9" → 21.9 dB (optional)

Sky/error:
  "DE02"     → no target (sky/infinity)
  "E001"     → hardware error
  Regex:     /^([Dd][Ee]\d+|E\d+)$/
  
Command echo:
  "DT"       → start streaming command (ignore)
  "DM"       → stop streaming (ignore)
```

## Multi-format laser parser
```typescript
// In LaserReader.processAsciiData():
function parseAsciiLine(line: string, format: string): number | null {
  switch(format) {
    case 'ldm71':
      // D 0005.230 021.9 → already handled by LDM71AsciiDriver
      const m1 = line.match(/^D\s+(\d+\.\d+)/);
      return m1 ? parseFloat(m1[1]) : null;
      
    case 'acuity':
      // +005230 → µm → /1000 = meters
      const m2 = line.match(/^([+-]?\d+)\s*$/);
      return m2 ? parseInt(m2[1]) / 1000000 : null;
      
    case 'dimetix':
      // g0+00005230 → µm → /1000 = meters
      const m3 = line.match(/^g0([+-]\d{8,10})\s*$/);
      return m3 ? parseInt(m3[1]) / 1000000 : null;
      
    case 'astech':
      // [LASER] D -> 5.230 m
      const m4 = line.match(/\[LASER\].*->\s*([\d.]+)\s*m/);
      return m4 ? parseFloat(m4[1]) : null;
      
    case 'generic_m':
      // 5.230
      const m5 = line.match(/^([\d.]+)\s*$/);
      return m5 ? parseFloat(m5[1]) : null;
      
    case 'generic_mm':
      // 5230
      const m6 = line.match(/^(\d+)\s*$/);
      return m6 ? parseInt(m6[1]) / 1000 : null;
      
    default:
      return null;
  }
}

function isSkySoltec(line: string): boolean {
  const t = line.trim();
  return /^[Dd][Ee]\d+$/.test(t) ||
         /^[Ee]\d+$/.test(t) ||
         t === '--' || t === 'infinity' ||
         t.includes('[ERR]');
}
```

---

# PART 8 — GPS/GNSS PIPELINE

## Duro TCP connection flow
```
electron/main.cjs
  → net.Socket.connect(2101, '192.168.0.222')
  → On data: mainWindow.webContents.send('duro:data', nmeaString)
  ↓
preload.cjs
  → ipcRenderer.on('duro:data') → onDuroData callback
  ↓
src/lib/gnss/duroGpsService.ts (or GnssSettings.tsx)
  → parseNMEA(nmeaString)
  → Extract $GPGGA: lat, lng, alt, fixQuality, satellites, hdop
  → Extract $GPRMC: speed, course, date/time
  → Extract $GPGSV: satellites in view
  → useGPSStore.updateData({...})
  ↓
useGPSStore (Zustand, src/lib/stores/gpsStore.ts)
  → data.latitude, longitude, altitude, speed, course
  → data.fixQuality: 'No Fix' | 'GPS Fix' | 'RTK Fixed' | 'RTK Float'
  → data.source: 'duro' | 'browser' | 'none'
```

## NMEA parsing key sentences
```
$GPGGA,HHMMSS.ss,LLLL.LL,a,YYYYY.YY,b,t,uu,v.v,w.w,M,x.x,M,y.y,ZZZZ*hh
  Field 2:  Latitude (DDMM.MMMMM)
  Field 4:  Longitude (DDDMM.MMMMM)
  Field 6:  Fix quality: 0=no fix, 1=GPS, 2=DGPS, 4=RTK Fixed, 5=RTK Float
  Field 9:  Altitude (meters)
  Field 8:  HDOP

$GPRMC,HHMMSS.ss,A,LLLL.LL,a,YYYYY.YY,b,x.x,y.y,DDMMYY,z,Z*hh
  Field 7:  Speed (knots) → × 1.852 = km/h
  Field 8:  Course (degrees)
```

## Browser GPS fallback
```typescript
// Used when no Duro connected
navigator.geolocation.watchPosition(
  (pos) => useGPSStore.getState().updateData({
    latitude:   pos.coords.latitude,
    longitude:  pos.coords.longitude,
    altitude:   pos.coords.altitude ?? 0,
    speed:      (pos.coords.speed ?? 0) * 3.6, // m/s → km/h
    source:     'browser',
    fixQuality: 'GPS Fix',
  }),
  (err) => console.warn('GPS error:', err.message),
  { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
);
```

---

# PART 9 — LOGGING ENGINE

## Overview

The new logging engine is in `src/hooks/logging/`. It replaces the old 3588-line `useMeasurementLogging.ts`.

5 files, ~730 lines total:
- `useLoggingCore.ts` — shared: save POI, GPS snapshot, image capture
- `useAllDataMode.ts` — Mode 1: immediate logging
- `useCounterMode.ts` — Mode 2: sky→object→sky detection
- `useBufferMode.ts` — Mode 3: per-type timer + distance
- `useLogging.ts` — orchestrator, public API

## useLoggingCore.ts

```typescript
// Key functions:

export function isInvalidReading(value: string | null | undefined): boolean {
  if (!value) return true;
  const s = value.trim();
  // Error codes
  if (s === '--' || s === 'infinity' || s === 'DE02') return true;
  if (/^[Dd][Ee]\d+$/.test(s)) return true;  // DE02, De02...
  if (/^[Ee]\d+$/.test(s)) return true;       // E001...
  if (s.includes('[ERR]')) return true;
  // Noise / ground reflection
  const n = parseFloat(s);
  if (isNaN(n) || n <= 0.1) return true;
  return false;
}

export function parseMeters(raw: string, groundRef = 0): LaserReading {
  if (isInvalidReading(raw)) return { raw, meters: 0, isValid: false, isSky: true };
  const n = parseFloat(raw);
  if (isNaN(n)) return { raw, meters: 0, isValid: false, isSky: false };
  return { raw, meters: Math.round((n + groundRef) * 1000) / 1000, isValid: true, isSky: false };
}

export function getGpsSnapshot(): GpsSnapshot {
  const gps = useGPSStore.getState().data;
  return {
    latitude:   gps.latitude  || 0,
    longitude:  gps.longitude || 0,
    altitude:   gps.altitude  || 0,
    speed:      gps.speed     || 0,
    heading:    gps.course    || 0,
    source:     gps.source    || 'none',
    fixQuality: gps.fixQuality || 'No Fix',
  };
}

// Save POI to IndexedDB
export async function savePOI(record: POIRecord, activeSurveyId: string): Promise<boolean> {
  const db = await openSurveyDB();
  const measurement = {
    id:         record.id,
    user_id:    activeSurveyId,    // legacy field name
    poi_type:   record.poiType,
    poiNumber:  record.poiNumber,
    roadNumber: record.roadNumber,
    rel:        record.heightM !== null ? Math.round(record.heightM * 100) / 100 : null,
    altGPS:     record.gps.altitude,
    latitude:   record.gps.latitude,
    longitude:  record.gps.longitude,
    utcDate:    record.utcDate,
    utcTime:    record.utcTime,
    speed:      record.gps.speed,
    heading:    record.gps.heading,
    imageUrl:   record.imageUrl || null,
    images:     record.images || [],
    note:       record.note || '',
    createdAt:  record.createdAt,
    source:     record.source,
  };
  await db.put('measurements', measurement);
  soundManager.playLogEntry();
  return true;
}
```

## Mode 1: useAllDataMode.ts

```typescript
// Runs on every measurement change
useEffect(() => {
  if (!isActive || !activeSurvey?.id) return;
  if (!lastMeasurement || lastMeasurement === lastLoggedRef.current) return;
  
  const reading = parseMeters(lastMeasurement, groundRef);
  if (!reading.isValid) return; // DE02, sky → silent skip
  
  const poiType = selectedPOIType || 'wire';
  const action = getActionForPOI(poiType);
  if (action === 'skip') return;
  
  lastLoggedRef.current = lastMeasurement;
  
  // Save POI immediately (no image yet)
  const id = globalThis.crypto?.randomUUID?.() || `poi-${Date.now()}`;
  getNextPoiNumber().then(async (poiNumber) => {
    const gps = getGpsSnapshot();
    const now = new Date();
    await savePOI({
      id, surveyId: activeSurvey.id, poiType, poiNumber,
      roadNumber: activeSurvey.roadNumber || 1,
      heightM: reading.meters,
      heightRawM: parseFloat(lastMeasurement),
      groundRefM: groundRef,
      gps, utcDate: now.toISOString().split('T')[0],
      utcTime: now.toTimeString().split(' ')[0],
      createdAt: now.toISOString(),
      source: 'all_data',
      note: `${poiType} | ${reading.meters.toFixed(2)}m | GND:${groundRef.toFixed(2)}m`,
    }, activeSurvey.id);
    
    // Capture image ASYNC — attaches to POI after
    if (action !== 'log-only') {
      captureImage().then(imageUrl => {
        if (!imageUrl) return;
        openSurveyDB().then(db => {
          db.get('measurements', id).then(m => {
            if (m) db.put('measurements', { ...m, imageUrl, images: [imageUrl] });
          });
        });
      }).catch(() => {});
    }
  });
}, [lastMeasurement, isActive]);
```

## Mode 2: useCounterMode.ts

```typescript
// 150ms polling interval
const processTick = async () => {
  const rawLog = getLaserLog();
  const lines = rawLog.split('\n').filter(l => l.trim());
  const lastLine = lines[lines.length - 1]?.trim() || '';
  
  const isSky = isInvalidReading(lastLine) || lastLine.includes('[ERR]');
  
  // Parse measurement
  let measuredM: number | null = null;
  if (!isSky) {
    const m = lastLine.match(/^D\s+(\d+\.\d+)/);
    if (m) measuredM = parseFloat(m[1]) + groundRef;
    else { const n = parseFloat(lastLine); if (!isNaN(n) && n > 0.1) measuredM = n + groundRef; }
  }
  
  if (isSky || measuredM === null) {
    skyCountRef.current++;
    if (stateRef.current === 'object' && bufferRef.current.length > 0) {
      const skyDurationMs = skyCountRef.current * 150;
      if (skyDurationMs >= SKY_TIMEOUT_MS) {  // 1000ms
        await logBuffer('sky_timeout');
      }
    }
  } else {
    skyCountRef.current = 0;
    if (stateRef.current === 'sky') {
      // Object detected — capture GPS + image immediately
      stateRef.current = 'object';
      capturedGpsRef.current = getGpsSnapshot();
      captureImage().then(url => { capturedImageRef.current = url; }).catch(() => {});
    }
    bufferRef.current.push(measuredM);
    
    // Check max duration
    if (Date.now() - objectStartTimeRef.current >= MAX_OBJECT_MS) {  // 5000ms
      await logBuffer('max_duration');
      return;
    }
    
    // Check max distance
    if (objectStartGpsRef.current) {
      const gps = getGpsSnapshot();
      const distKm = calculateDistance(objectStartGpsRef.current.lat, objectStartGpsRef.current.lng, gps.latitude, gps.longitude);
      if (distKm * 1000 >= MAX_OBJECT_DIST_M) {  // 300m
        await logBuffer('max_distance');
      }
    }
  }
};

const logBuffer = async (reason: string) => {
  const readings = bufferRef.current;
  if (!readings.length) return;
  
  const minReading = Math.min(...readings);
  const avgReading = readings.reduce((a, b) => a + b, 0) / readings.length;
  
  // Reset BEFORE async save (so next object starts immediately)
  bufferRef.current = [];
  stateRef.current = 'sky';
  skyCountRef.current = 0;
  
  await savePOI({
    heightM: Math.round(minReading * 100) / 100,
    heightMinM: Math.round(minReading * 100) / 100,
    heightAvgM: Math.round(avgReading * 100) / 100,
    readingCount: readings.length,
    gps: capturedGpsRef.current,   // captured at START of object
    imageUrl: capturedImageRef.current,
    note: `Min:${minReading.toFixed(2)}m Avg:${avgReading.toFixed(2)}m ${readings.length}rdgs | ${reason}`,
    source: 'counter',
    // ...
  }, activeSurvey.id);
};
```

## Mode 3: useBufferMode.ts

```typescript
// Default config per POI type
const DEFAULT_BUFFER_CONFIG = {
  wire:              { maxTimeMs: 15000, maxDistM: 100 },
  bridgeAndWires:    { maxTimeMs: 15000, maxDistM: 100 },
  powerLine:         { maxTimeMs: 15000, maxDistM: 100 },
  tree:              { maxTimeMs: 10000, maxDistM:  50 },
  trafficLight:      { maxTimeMs:  8000, maxDistM:  50 },
  overpass:          { maxTimeMs: 15000, maxDistM: 100 },
  signalization:     { maxTimeMs:  5000, maxDistM:  30 },
  opticalFiber:      { maxTimeMs:  8000, maxDistM:  50 },
  overheadStructure: { maxTimeMs: 10000, maxDistM:  50 },
};

// Sky timeout: 1 second of continuous sky = end of object (same as counter mode)
const SKY_TIMEOUT_MS = 1000;

// Process tick is same as counter mode BUT:
// - Instead of same config for all types, reads per-type config
// - After POI created, IMMEDIATELY restarts for next POI of same type
// - Sky timeout triggers flush AND immediate restart
```

## POI type change handler (all modes)

```typescript
// In useCounterMode and useBufferMode:
useEffect(() => {
  const prevType = prevPOITypeRef.current;
  if (prevType !== selectedPOIType && bufferRef.current.length > 0) {
    logBuffer('poi_type_change').then(() => {
      // Restart with new type immediately
    });
  }
  prevPOITypeRef.current = selectedPOIType;
}, [selectedPOIType]);
```

---

# PART 10 — DATABASE ARCHITECTURE

## IndexedDB Schema (via idb library)

```typescript
// src/lib/survey/db.ts
export async function openSurveyDB() {
  return openDB('MeasurePRODB', 3, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const surveyStore = db.createObjectStore('surveys', { keyPath: 'id' });
        surveyStore.createIndex('by-date', 'createdAt');
        
        const measurementStore = db.createObjectStore('measurements', { keyPath: 'id' });
        measurementStore.createIndex('by-survey', 'user_id');
        measurementStore.createIndex('by-date', 'createdAt');
        measurementStore.createIndex('by-road', ['user_id', 'roadNumber']);
      }
    }
  });
}
```

## SQLite Schema (future, already designed)

```sql
-- electron/db/measurementsDB.cjs

CREATE TABLE IF NOT EXISTS surveys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  surveyor_name TEXT,
  client_name TEXT,
  project_number TEXT,
  road_number INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,
  firebase_synced INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS measurements (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL REFERENCES surveys(id),
  poi_type TEXT,
  poi_number INTEGER,
  road_number INTEGER,
  
  -- Laser measurement
  height_m REAL,
  height_raw_m REAL,
  ground_ref_m REAL DEFAULT 0,
  height_min_m REAL,
  height_avg_m REAL,
  reading_count INTEGER DEFAULT 1,
  
  -- GPS at moment of capture (beginning of buffer)
  latitude REAL,
  longitude REAL,
  altitude_gps REAL,
  speed_kmh REAL,
  heading_deg REAL,
  gps_source TEXT,
  gps_fix_quality TEXT,
  
  -- RPLIDAR (future columns)
  rplidar_height_top_m REAL,
  rplidar_clear_left_m REAL,
  rplidar_clear_right_m REAL,
  rplidar_profile_json TEXT,
  
  -- Timestamps
  utc_date TEXT NOT NULL,
  utc_time TEXT NOT NULL,
  created_at TEXT NOT NULL,
  
  -- Media
  image_url TEXT,
  images_json TEXT,
  video_timestamp INTEGER,
  
  -- Metadata
  note TEXT,
  source TEXT DEFAULT 'manual',
  logging_mode TEXT,
  firebase_synced INTEGER DEFAULT 0
);

CREATE INDEX idx_measurements_survey ON measurements(survey_id);
CREATE INDEX idx_measurements_created ON measurements(created_at);
CREATE INDEX idx_measurements_type ON measurements(poi_type);
```

## Firebase sync strategy

```
Local IndexedDB → Firebase Firestore
- Write locally first (offline-first)
- Sync to Firestore when online
- Use background sync service (backgroundSync.ts)
- Check navigator.onLine before sync attempts
- Firebase sync is ASYNC — never blocks UI
- Sync failures are silent (retry on next sync cycle)
```

---

# PART 11 — FIREBASE AUTH & LICENSING

## Authentication Flow

```
1. User opens app → Firebase checks localStorage for cached auth
2. If cached → restore session (works offline)
3. If not cached → show login screen
4. Login: signInWithEmailAndPassword(auth, email, password)
5. On success: check /licenses/{uid} in Firestore
6. License status determines available features
```

## License types
```
trial:    7 days, all features
monthly:  subscription, all features  
annual:   subscription, all features
custom:   admin-defined expiry + features
```

## Master admin list (src/lib/auth/masterAdmin.ts)
```typescript
const MASTER_ADMIN_EMAILS = [
  'jfprince@soltec.ca',
  'admin@soltecinnovation.com',
  // add others here
];

export function isMasterAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return MASTER_ADMIN_EMAILS.includes(email.toLowerCase());
}
```

Master admins bypass ALL license checks. Always full access.

## Feature keys
```typescript
const FEATURE_KEYS = [
  'gnss_profiling',     // GNSS road profiling page
  'convoy_guardian',    // Convoy clearance monitoring
  'route_enforcement',  // Permitted route enforcement
  'swept_path_analysis', // Swept path (AI)
  'slave_app',          // Field app pairing
  'point_cloud_scanning', // 3D LiDAR (disabled)
  'envelope_clearance', // Vehicle envelope monitoring
];
```

## FeatureProtectedRoute (critical fix)
```typescript
// IMPORTANT: Cache master admin email in localStorage
// So feature access works OFFLINE (auth may be null when offline)

const checkAccess = async () => {
  // Check localStorage cache FIRST (works offline)
  const cachedEmail = localStorage.getItem('last_logged_in_email');
  if (cachedEmail && isMasterAdmin(cachedEmail)) {
    setHasAccess(true); setIsLoading(false); return;
  }
  
  // Then check Firebase auth
  if (auth.currentUser) {
    // Cache email for offline use
    localStorage.setItem('last_logged_in_email', auth.currentUser.email || '');
    if (isMasterAdmin(auth.currentUser.email)) {
      setHasAccess(true); setIsLoading(false); return;
    }
    // Check Firestore license...
  }
};
```

## Firebase initialization (CRITICAL)
```typescript
// src/lib/firebase.ts
// MUST use memoryLocalCache to avoid IndexedDB errors in Electron

import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';

const app = initializeApp(firebaseConfig);

// CRITICAL: Do NOT use getFirestore() — it tries IndexedDB which fails in Electron
let db;
try {
  db = initializeFirestore(app, { localCache: memoryLocalCache() });
} catch {
  db = getFirestore(app); // fallback if already initialized
}
```

---

# PART 12 — FIELD APP (MOBILE PWA)

## Architecture

```
Tablet (Electron app)    ←→    Firebase Firestore    ←→    Phone (PWA at /slave-app)
    Master                          Relay                        Slave
```

No custom WebSocket server needed. Firestore is the relay.

## Firestore pairing collections

```
/pairing/{6-digit-code}/
  masterOnline: boolean
  slaveOnline: boolean  
  surveyData: Survey object
  createdAt: Timestamp
  expiresAt: number (Unix ms, 10 minutes)
  slaveLastSeen: Timestamp (heartbeat)

/pairing/{code}/toSlave/  ← subcollection
  {messageId}: {
    type: 'survey_data' | 'slave_measurement_ack',
    data: any,
    ts: Timestamp
  }

/pairing/{code}/toMaster/  ← subcollection
  {messageId}: {
    type: 'slave_measurement',
    measurement: Measurement,
    ts: Timestamp
  }
```

## Master side (tablet, in SlaveAppPairingDisplay or slavePairingStore.ts)

```typescript
// Create session
const code = String(Math.floor(100000 + Math.random() * 900000));
await setDoc(doc(db, 'pairing', code), {
  masterOnline: true,
  slaveOnline: false,
  surveyData: null,
  createdAt: serverTimestamp(),
  expiresAt: Date.now() + 10 * 60 * 1000,
});

// Watch for slave joining
onSnapshot(doc(db, 'pairing', code), snap => {
  if (snap.data()?.slaveOnline) setSlaveConnected(true);
});

// Watch for measurements from slave
onSnapshot(collection(db, 'pairing', code, 'toMaster'), snap => {
  snap.forEach(msgDoc => {
    const msg = msgDoc.data();
    if (msg.type === 'slave_measurement') {
      saveMeasurementLocally(msg.measurement);
      // ACK back to slave
      addDoc(collection(db, 'pairing', code, 'toSlave'), {
        type: 'slave_measurement_ack',
        id: msg.measurement.id,
        failed: false,
        ts: serverTimestamp(),
      });
    }
  });
});
```

## Slave side (phone, in SlaveAppCodeEntry.tsx)

```typescript
const handleConnect = async (code: string) => {
  const sessionRef = doc(db, 'pairing', code);
  const snap = await getDoc(sessionRef);
  
  if (!snap.exists()) { setError('Code not found'); return; }
  if (snap.data().expiresAt < Date.now()) { setError('Code expired'); return; }
  
  // Mark slave as online
  await setDoc(sessionRef, { slaveOnline: true, slaveJoinedAt: serverTimestamp() }, { merge: true });
  
  // Get initial survey data
  if (snap.data().surveyData) {
    localStorage.setItem('mainApp_activeSurvey', JSON.stringify(snap.data().surveyData));
  }
  
  // Subscribe to messages from master
  onSnapshot(collection(db, 'pairing', code, 'toSlave'), snap => {
    snap.forEach(msgDoc => {
      const msg = msgDoc.data();
      if (msg.type === 'survey_data') {
        localStorage.setItem('mainApp_activeSurvey', JSON.stringify(msg.data));
      }
    });
  });
};

// Send measurement to master
const sendMeasurement = async (measurement: Measurement) => {
  await addDoc(collection(db, 'pairing', code, 'toMaster'), {
    type: 'slave_measurement',
    measurement,
    ts: serverTimestamp(),
  });
};
```

## Firestore rules (MUST SET IN FIREBASE CONSOLE)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Pairing — open access (no auth required for field workers)
    match /pairing/{code} {
      allow read, write: if true;
    }
    match /pairing/{code}/{sub=**} {
      allow read, write: if true;
    }
    
    // Surveys — authenticated users only
    match /surveys/{surveyId} {
      allow read, write: if request.auth != null;
    }
    
    // Users — own data only
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Licenses — read own, admin writes
    match /licenses/{userId} {
      allow read: if request.auth.uid == userId;
      allow write: if false; // admin SDK only
    }
  }
}
```

---

# PART 13 — CAMERA INTEGRATION (INSTA360)

## Connection method
When X5 is connected via USB-C, Windows creates a virtual network adapter.
The camera appears at IP 192.168.42.1 on this virtual network.
Communication is HTTP (not USB direct).

## OSC API endpoints
```
GET  http://192.168.42.1/osc/info
  → { manufacturer, model, firmwareVersion, serialNumber }

POST http://192.168.42.1/osc/state
  → { state: { batteryLevel, storageUri, captureStatus } }

POST http://192.168.42.1/osc/commands/execute
  Body: { name: 'camera.takePicture' }
  → { state: 'done', results: { fileUri: '...' } }

POST http://192.168.42.1/osc/commands/execute
  Body: { name: 'camera.startCapture', parameters: { _captureMode: 'video' } }
  
POST http://192.168.42.1/osc/commands/execute
  Body: { name: 'camera.stopCapture' }
```

## electron/insta360/insta360Service.cjs

```javascript
const INSTA360_IP = '192.168.42.1';  // default, configurable
const POLL_MS = 3000;

async function checkConnection() {
  try {
    const result = await oscRequest('GET', '/osc/info');
    return result?.model?.includes('X5') || result?.manufacturer?.includes('Insta360');
  } catch { return false; }
}

function oscRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: INSTA360_IP, port: 80, path, method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 3000,
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
```

## Image capture flow
```
1. startCapture() called in React component
2. → preload.cjs insta360TakePhoto()
3. → IPC → insta360Service.cjs takePhoto()
4. → POST /osc/commands/execute { name: 'camera.takePicture' }
5. → Response: { results: { fileUri: '/DCIM/...' } }
6. → Download image from camera
7. → Convert to base64 or save to IndexedDB
8. → Return imageUrl to React component
9. → Attach to POI record
```

---

# PART 14 — DRONE IMPORT (DJI)

## Detection
```javascript
// electron/drone/driveDetector.cjs
// Polls Windows drives every 3 seconds
// Looks for DCIM folder with JPG files

function scanForDjiDevices() {
  const drives = getWindowsDrives();  // via wmic command
  return drives.filter(drive => {
    const dcimPath = findDjiDcimFolder(drive.path);
    return dcimPath && countDjiImages(dcimPath) > 0;
  }).map(drive => ({
    driveLetter: drive.letter,
    dcimPath: findDjiDcimFolder(drive.path),
    imageCount: countDjiImages(findDjiDcimFolder(drive.path)),
    deviceType: drive.label || 'DJI SD Card',
  }));
}
```

## EXIF/XMP extraction
```typescript
// Uses exifr library (faster than manual parsing)
const data = await Exifr.parse(file, {
  tiff: true, gps: true, exif: true, xmp: true,
  chunked: true, chunkSize: 131072,  // read only first 128KB
});

// DJI-specific XMP fields:
const gimbalPitch = data.GimbalPitchDegree ?? data['drone-dji:GimbalPitchDegree'];
const relativeAlt = data.RelativeAltitude ?? data['drone-dji:RelativeAltitude'];
const isNadir = gimbalPitch <= -75;  // camera pointed down
```

## GSD (Ground Sampling Distance) calculation
```typescript
// cm/pixel based on altitude and focal length
const gsd = (altitude * sensorWidth) / (focalLength * imageWidth) * 100;

// Sensor sizes (mm):
const SENSORS = {
  'Matrice 4E': { w: 17.3, h: 13.0 },    // 4/3"
  'Mini 4 Pro': { w: 9.7,  h: 7.3  },    // 1/1.3"
  'Air 3':      { w: 9.7,  h: 7.3  },
};
```

## Placement on Mapbox
```typescript
// Calculate 4 corners from GPS + yaw + footprint
const footprintM = altM * Math.tan((fovDeg / 2) * Math.PI / 180) * 2;
const halfLat = footprintM / 2 / 111320;
const halfLng = footprintM / 2 / (111320 * Math.cos(lat * Math.PI / 180));
// Rotate corners by gimbal yaw
const corners = rotateCorners([-halfLng, -halfLat], [halfLng, halfLat], yawRad);

// Add to Mapbox as raster layer
map.addSource(`drone-${id}`, {
  type: 'image', url: objectUrl,
  coordinates: [topLeft, topRight, bottomRight, bottomLeft],
});
map.addLayer({ id: `drone-layer-${id}`, type: 'raster', source: `drone-${id}`,
  paint: { 'raster-opacity': 0.85 } });
```

---

# PART 15 — SETTINGS ARCHITECTURE

## How settings are organized

```typescript
// src/lib/settings.ts — Zustand store with persistence

interface SettingsState {
  // Laser
  laserSettings: {
    comPort: string;
    baudRate: number;
    format: 'ldm71' | 'acuity' | 'dimetix' | 'astech' | 'generic_m' | 'generic_mm';
    amplitudeFilterEnabled: boolean; // DISABLED — toggle for future
  };
  
  // GPS/GNSS
  gnssSettings: {
    host: string;       // default: '192.168.0.222'
    port: number;       // default: 2101
    enabled: boolean;
  };
  
  // Thresholds
  thresholds: {
    minHeight: number;       // display filter minimum
    maxHeight: number;       // display filter maximum
    warningThreshold: number; // alert threshold (lower = more dangerous)
    criticalThreshold: number;
  };
  
  // Profile settings (GNSS grade alerts)
  profileSettings: {
    gradeUpAlertThreshold: number;    // default: 12%
    gradeDownAlertThreshold: number;  // default: -12%
    kFactorAlertThreshold: number;
    minimumCurveRadius_m: number;     // default: 15m
  };
  
  // Display
  displaySettings: {
    units: 'm' | 'ft' | 'ft+in' | 'cm' | 'mm' | 'in';
    zoomLevel: number;  // 70-120%
  };
  
  // Audio
  soundSettings: {
    logEntry: string;      // sound file name
    warning: string;
    critical: string;
    modeChange: string;
  };
}
```

## POI Actions (per-type, user-configurable)
```typescript
// src/lib/poiActions.ts

type POIAction = 
  | 'auto-capture-and-log'  // capture photo + log measurement
  | 'log-only'              // log without photo
  | 'capture-no-log'        // capture photo only, don't log height
  | 'skip';                 // skip this POI type completely

// CRITICAL: User values WIN over defaults
// Do NOT override user settings with defaults on load
const loadSavedActions = () => {
  const saved = localStorage.getItem('poi_action_config');
  if (saved) {
    const parsed = JSON.parse(saved);
    // Start with defaults for missing keys
    const merged = { ...baseDefaults };
    // User saved values OVERRIDE defaults (not the other way around)
    Object.keys(parsed).forEach(key => { merged[key] = parsed[key]; });
    return merged;
  }
  return baseDefaults;
};
```

## Settings UI structure

```
Settings Panel (full screen)
├── Hardware
│   ├── Laser & GPS       ← LaserConnectionSettings + LaserGPSSettings
│   ├── GNSS              ← GnssSettings (Duro TCP config)
│   └── Camera            ← CameraSettings + MultiCameraSettings
├── Survey
│   ├── Logging           ← LoggingSettings (auto-save, ground ref)
│   ├── Detection         ← DetectionSettings (buffer config per type)
│   ├── Alerts            ← AlertSettings (warning/critical thresholds)
│   └── POI Actions       ← POIActionSettings (per-type actions)
├── Display
│   ├── Units & Interface ← DisplaySettings
│   ├── Map               ← MapSettings
│   └── Sounds            ← AlertSettings (sound selection)
├── Data
│   ├── Email             ← EmailSettings
│   ├── Sync              ← RoadScope sync
│   ├── Field App         ← SlaveApp pairing display
│   └── Backup            ← BackupSettings
└── System
    ├── Voice             ← VoiceSettings
    ├── Keyboard          ← KeyboardSettings  
    ├── Admin             ← (admin only) AdminSettings
    ├── About             ← AboutSettings (version, changelog)
    └── Help              ← HelpSettings (documentation)
```

---

# PART 16 — UI ARCHITECTURE

## Main Screen Layout

```
┌─────────────────────────────────────────────────────┐
│ MeasurePRO    Survey: [name]    [⚙] [👤] [🔊]      │  ← AppHeader
├──────────────────────────────┬──────────────────────┤
│                              │ Current Measure       │
│  Live Camera Feed            │    5.58m / 18.3ft     │
│  (with overlay: GPS, height) │                       │
│                              │ Last   Session Min    │
│                              │ 5.61m  4.92m          │
│                              ├──────────────────────┤
│                              │ POI Type Selector     │
│                              │ [Wire ▼]              │
│                              ├──────────────────────┤
│                              │ Logging Controls      │
│                              │ [▶ All Data]          │
│                              │ [⊙ Counter]           │
│                              │ [⊞ Buffer]            │
│                              │ [■ Stop]              │
├──────────────────────────────┴──────────────────────┤
│ Activity Log                                         │
│ 001 Wire  5.58m  48.1234°N  -73.5678°W  14:23:01    │
│ 002 Bridge 4.21m  48.1235°N  -73.5679°W  14:23:45   │
└─────────────────────────────────────────────────────┘
```

## Zustand stores

```typescript
// useSerialStore — laser connection + measurements
{
  connected: boolean;
  lastMeasurement: string;       // "5.230" or "--" or "DE02"
  laserType: string;             // 'ldm71', 'acuity', etc.
  setLastLaserData: (value: string) => void;
}

// useGPSStore — GPS data
{
  connected: boolean;
  data: GPSData;  // lat, lng, alt, speed, fixQuality, etc.
  updateData: (partial: Partial<GPSData>) => void;
}

// useSurveyStore — active survey
{
  activeSurvey: Survey | null;
  setActiveSurvey: (survey: Survey | null) => void;
}

// useLaserStore — ground reference
{
  groundReferenceHeight: number;
  setGroundReferenceHeight: (h: number) => void;
}

// usePOIStore — active POI type
{
  selectedType: string;
  setSelectedType: (type: string) => void;
}

// useSettingsStore — all settings
{
  settings: SettingsState;
  updateSettings: (partial: Partial<SettingsState>) => void;
}
```

---

# PART 17 — SURVEY DATA MODEL

## Survey interface
```typescript
interface Survey {
  id: string;                   // UUID
  name: string;                 // display name
  surveyTitle: string;          // formal title for reports
  surveyorName: string;         // technician name
  clientName: string;           // client company
  projectNumber?: string;       // permit/project reference
  roadNumber: number;           // current road segment (1, 2, 3...)
  notes?: string;
  createdAt: string;            // ISO timestamp
  updatedAt: string;
  status: 'active' | 'completed';
}
```

## Measurement/POI interface
```typescript
interface Measurement {
  id: string;                   // UUID
  user_id: string;              // survey ID (legacy naming, keep for DB compat)
  poi_type: string;             // 'wire', 'bridge', 'overpass', etc.
  poiNumber: number;            // sequential within survey
  roadNumber: number;           // which road segment
  
  // Laser measurement
  rel: number | null;           // adjusted height (raw + groundRef) — MAIN VALUE
  altGPS: number | null;        // GPS altitude
  
  // GPS location
  latitude: number;
  longitude: number;
  
  // Timing
  utcDate: string;              // YYYY-MM-DD
  utcTime: string;              // HH:MM:SS
  speed: number;                // km/h
  heading: number;              // degrees
  
  // Media
  imageUrl: string | null;      // primary photo
  images: string[];             // all photos
  videoTimestamp?: number | null; // video offset in ms
  
  // Context
  note: string;                 // includes avg, count, ground ref info
  createdAt: string;
  source: 'manual' | 'all_data' | 'counter' | 'buffer' | 'detection';
}
```

---

# PART 18 — POI TYPES & ACTIONS

## Height clearance POI types (record height)
```
wire              - Power line, telephone wire
bridgeAndWires    - Bridge with overhead wires
overpass          - Highway overpass, grade crossing
powerLine         - High voltage power line
trafficLight      - Traffic light arm
signalization     - Traffic signs, signal structures  
opticalFiber      - Fiber optic cable
overheadStructure - Any other overhead structure
tree              - Tree branch
```

## Measurement-free POI types (location only, no height)
```
bridge            - Bridge (record location only)
culvert           - Culvert
intersection      - Intersection
railway           - Railway crossing
milestone         - Survey milestone
gradeUp           - Uphill grade event
gradeDown         - Downhill grade event
passingLane       - Passing lane section
kFactorEvent      - Vertical curve event
```

## POI action types
```
auto-capture-and-log  - Take photo AND log measurement (default for height clearance)
log-only              - Log measurement without photo (faster)
capture-no-log        - Take photo but don't log height (for documentation POIs)
skip                  - Ignore this POI type completely
```

---

# PART 19 — SWEPTPRO (CONVOY SIMULATION)

## Location: C:\Users\jfpri\sweptpro-electron
## GitHub: SolTecInnov/sweptpro-releases

## Kinematic engine (src/engine/convoy.ts)

### Tractrix algorithm
```
Unit 0 (tractor/lead):
  Front pivot follows guideline path exactly
  State: { x, y, heading } where x,y = reference axle position

Unit N (trailer, jeep, dolly):
  Tow point = rear pivot of Unit N-1
  Front pivot of Unit N must reach tow point
  New heading = direction from Unit N reference to tow point
  Clamped by maxAngleDeg (prevent unrealistic articulation)
```

### CRITICAL: Variable declaration order (BUG THAT CAUSED CRASH)
```typescript
// WRONG — causes crash on second guideline point:
const frontEdge = fpX + 0.1;  // ERROR: fpX used before declaration
let fpX = firstAxle + 0.3;    // declared here but used above

// CORRECT — declare before use:
let fpX = firstAxle + 0.3;    // declare first
const frontEdge = fpX + 0.1;  // then use
```

### deriveUnitGeometry() — correct order
```typescript
export function deriveUnitGeometry(unit: ConvoyUnit): UnitGeometry {
  // Step 1: Build axle positions from axle groups
  const axlePositions = buildAxlePositions(unit.axleGroups);
  const groupCenters = buildGroupCenters(unit.axleGroups);
  
  const firstAxle = axlePositions[0] ?? 0;
  const lastAxle = axlePositions[axlePositions.length - 1] ?? 0;
  
  // Step 2: Compute pivot positions FIRST
  let fpX = firstAxle + 0.3;  // default
  let rpX = lastAxle - 0.3;   // default
  
  if (unit.frontPivot) {
    const g = unit.frontPivot.attachToGroup;
    fpX = (g >= 0 && g < groupCenters.length)
      ? groupCenters[g] + (unit.frontPivot.offsetFromGroupCenter ?? 0)
      : unit.frontPivot.localX;
  }
  
  if (unit.rearPivot) {
    const g = unit.rearPivot.attachToGroup;
    rpX = (g >= 0 && g < groupCenters.length)
      ? groupCenters[g] + (unit.rearPivot.offsetFromGroupCenter ?? 0)
      : unit.rearPivot.localX;
  }
  
  // Step 3: Compute visual edges AFTER pivots are known
  const defaultFrontEdge = firstAxle + 0.5;
  const frontEdge = unit.frontPivot
    ? Math.min(defaultFrontEdge, fpX + 0.1)  // clip at kingpin
    : defaultFrontEdge;
  const rearEdge = lastAxle - 0.5;
  
  return { axlePositions, frontEdge, rearEdge, frontPivotLocalX: fpX, rearPivotLocalX: rpX };
}
```

### Warmup pre-simulation
```typescript
// Before frame 0, run a straight warmup equal to 1.5× total convoy length
// This ensures all units are properly spread out from the start
const warmupDist = Math.max(totalConvoyLength * 1.5, 40);
const warmupSteps = Math.ceil(warmupDist / 0.5);
for (let w = 0; w < warmupSteps; w++) {
  // Step each unit along a straight line
  stepUnits(states, units, geos, initH, warmupPosition(w, warmupDist, initH));
}
```

## ConvoyUnit model
```typescript
interface ConvoyUnit {
  id: string;
  name: string;
  width: number;              // overall width (m)
  
  axleGroups: AxleGroup[];    // ordered front to rear
  gapToNext: number;          // last axle of this unit → first axle of next (m)
  
  frontPivot: PivotPoint | null;  // null = lead unit (no front connection)
  rearPivot: PivotPoint | null;   // null = tail unit (no rear connection)
  
  steeringType: SteeringType;
  maxSteeringAngle: number;   // radians
  
  color: string;
  notes: string;
}

interface PivotPoint {
  id: string;
  label: string;              // 'Kingpin', '5th Wheel', 'Pivot Pin'
  localX: number;             // computed by deriveUnitGeometry — DO NOT SET MANUALLY
  localY: number;             // usually 0 (centered)
  maxAngleDeg: number;        // 65° default, 90° for 5th wheel
  attachToGroup: number;      // index of axle group (-1 = fixed position)
  offsetFromGroupCenter: number; // + = forward, - = rearward from group center
}

interface AxleGroup {
  id: string;
  type: 'single' | 'tandem' | 'tridem' | 'quad' | 'quint' | 'custom';
  axleCount: number;
  spacingM: number;           // center-to-center axle spacing
  tireConfig: TireConfig;
  wheelSteer: boolean;
  maxWheelAngleDeg: number;
  steerGroup: 'front' | 'rear' | 'none';
}
```

## SweptPRO build commands
```bash
# Build
powershell.exe -Command "Set-Location 'C:\Users\jfpri\sweptpro-electron'; npm run build"

# Package
powershell.exe -Command "cd sweptpro-electron; \$env:CSC_IDENTITY_AUTO_DISCOVERY='false'; npx electron-builder --win --config.npmRebuild=false"

# Release
GH_TOKEN=... node scripts/create-release.cjs "1.3.4" "Release notes"
```

---

# PART 20 — BUILD & RELEASE PROCESS

## Full build sequence
```bash
# 1. Bump version
python3 -c "
import json
with open('package.json') as f: d = json.load(f)
v = d['version'].split('.')
v[-1] = str(int(v[-1]) + 1)
d['version'] = '.'.join(v)
with open('package.json', 'w') as f: json.dump(d, f, indent=2)
print('v' + d['version'])
"

# 2. CRITICAL: Check main.cjs syntax before building
node --check electron/main.cjs || echo "SYNTAX ERROR — fix before continuing"

# 3. Build React frontend
powershell.exe -ExecutionPolicy Bypass -Command "
Stop-Process -Name 'MeasurePRO' -Force -ErrorAction SilentlyContinue
Set-Location 'C:\Users\jfpri\measurepro-electron'
npm run build
"

# 4. Package with electron-builder
powershell.exe -ExecutionPolicy Bypass -Command "
Set-Location 'C:\Users\jfpri\measurepro-electron'
\$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
npx electron-builder --win --config.npmRebuild=false
"

# 5. Verify ASAR version matches
node -e "
const asar = require('./node_modules/@electron/asar');
const pkg = JSON.parse(asar.extractFile('./release-builds/win-unpacked/resources/app.asar', 'package.json').toString());
console.log('win-unpacked version:', pkg.version);
// Also check main.cjs syntax in ASAR
const main = asar.extractFile('./release-builds/win-unpacked/resources/app.asar', 'electron/main.cjs').toString();
try { new (require('vm').Script)(main); console.log('main.cjs syntax: OK'); } catch(e) { console.log('SYNTAX ERROR:', e.message); }
"

# 6. Release to GitHub
GH_TOKEN=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 \
node scripts/create-release.cjs "15.6.38" "Release notes here"
```

## electron-builder.json5 configuration
```json5
{
  "appId": "com.soltecinnovation.measurepro",
  "productName": "MeasurePRO",
  "copyright": "Copyright © 2025 Soltec Innovation",
  "directories": {
    "output": "release-builds",
    "buildResources": "build-resources"
  },
  "files": [
    "dist/**/*",
    "electron/**/*"
  ],
  "win": {
    "target": "nsis",
    "icon": "build-resources/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  },
  "asar": true,
  "publish": {
    "provider": "github",
    "owner": "SolTecInnov",
    "repo": "measurepro-releases",
    "private": false
  }
}
```

## create-release.cjs structure
```javascript
// scripts/create-release.cjs
// Creates GitHub release and uploads MeasurePROSetup.exe + blockmap + latest.yml
// Usage: GH_TOKEN=... node create-release.cjs "15.6.38" "Release notes"
const TOKEN = process.env.GH_TOKEN;
const REPO = 'SolTecInnov/measurepro-releases';
const RELEASE_DIR = '/mnt/c/Users/jfpri/measurepro-electron/release-builds';
// ... creates release, uploads files via GitHub API
```

---

# PART 21 — FUTURE: GNSS PROFILING (SEPARATE APP)

## Decision: GNSS Profiling will be a separate Electron app

Reasons:
- MeasurePRO is for laser + GPS overhead survey
- GNSS profiling is a different product for road geometry analysis
- Separation = cleaner code, less complexity per app
- They can share data via RoadScope

## GNSSPro app concept
```
GNSSPro (separate Electron app)
├── Connects to Duro TCP directly
├── Records GPS track with grade + K-factor
├── Displays elevation profile in real-time
├── Exports: GPX, KML, GeoJSON, CSV
├── Outputs to RoadScope for combined reports

GPS sharing with MeasurePRO:
└── Exposes REST endpoint: GET http://localhost:7777/gnss/position
    → { lat, lng, alt, speed, heading, fixQuality, hdop }
    MeasurePRO polls this for GPS data when GNSSPro is running
```

## Grade computation (CRITICAL: must smooth)
```typescript
// WRONG — causes 300%+ fake grades from GPS noise:
const grade = ((altitude - prevAltitude) / segmentDist) * 100;

// CORRECT:
// 1. Smooth altitude with 5-sample moving average
const smoothedAlt = average(altitudes.slice(i-2, i+3));
// 2. Require minimum 2m travel between grade calculations
if (segmentDist < 2.0) continue; // skip noise
// 3. Clamp to realistic range
const rawGrade = ((smoothedAlt - prevSmoothedAlt) / segmentDist) * 100;
const grade = Math.max(-50, Math.min(50, rawGrade));
// 4. Only create grade alert POIs when speed > 2 km/h
if (gps.speed < 2) return; // stationary = no POIs
```

---

# PART 22 — FUTURE: RPLIDAR A2M12

## Hardware specs
- Model: Slamtec RPLIDAR A2M12
- Type: 2D 360° lidar scanner, 12m range
- Connection: USB serial (115200 baud)
- Output: binary scan packets (proprietary SDK protocol)
- Scan rate: 10Hz (10 scans per second)

## Mounting
- Perpendicular to road direction (cross-section scanning)
- Each scan creates a cross-section profile of the road

## Data model (already reserved in SQLite schema)
```sql
rplidar_height_top_m REAL,     -- clearance to ceiling/obstruction above (0°)
rplidar_clear_left_m REAL,     -- clearance to left side obstacle (90°)
rplidar_clear_right_m REAL,    -- clearance to right side obstacle (-90°)
rplidar_profile_json TEXT,     -- full scan: JSON array of {angle, distance} points
```

## Use case: clearance box vs convoy envelope
```
Each POI has a cross-section profile.
User defines their convoy envelope (width × height at each point).
App overlays envelope on profile → shows where envelope touches obstacles.
→ "At this POI, your 18'9" wide convoy has 6 inches clearance on the right"
```

## Integration plan
1. Add RPLIDAR driver to electron/main.cjs (serial + binary protocol)
2. Stream scan data to renderer via IPC
3. Add `rplidar_*` columns to POI records
4. Add cross-section visualization in POI detail view
5. Add convoy envelope overlay tool

---

# PART 23 — CRITICAL LESSONS LEARNED

## Code quality issues that caused crashes

### 1. Variable used before declaration (JavaScript TDZ)
```typescript
// CRASH: TDZ (Temporal Dead Zone) error
const frontEdge = fpX + 0.1;  // fpX not yet declared!
let fpX = firstAxle + 0.3;

// FIX: declare before use
let fpX = firstAxle + 0.3;
const frontEdge = fpX + 0.1;
```

### 2. Bad crypto import in renderer
```typescript
// CRASH: 'crypto' is not a browser/ESM module
import { crypto } from 'crypto';

// FIX: use globalThis (already available in Electron renderer)
const id = globalThis.crypto?.randomUUID?.() || `poi-${Date.now()}-${Math.random()}`;
```

### 3. autoUpdater not guarded
```javascript
// CRASH: electron-updater may not be in ASAR
const { autoUpdater } = require('electron-updater');

// FIX:
let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (_e) {}
```

### 4. Firebase uses IndexedDB (fails in Electron file://)
```typescript
// CRASH: IndexedDB unavailable under file:// → Firebase goes offline
const db = getFirestore(app);

// FIX: use memoryLocalCache
const db = initializeFirestore(app, { localCache: memoryLocalCache() });
```

### 5. Hook used before being called in component
```typescript
// CRASH: "disclaimerAccepted is not defined"
import { useDisclaimerAccepted } from './DisclaimerModal';
// ... component starts, uses disclaimerAccepted but hook never called

// FIX: Call hook inside component function
function App() {
  const { accepted: disclaimerAccepted, accept: acceptDisclaimer } = useDisclaimerAccepted();
  // Now it's defined
}
```

### 6. win-unpacked can be stale vs installer
```bash
# Problem: installer builds a fresh ASAR, but win-unpacked may have old one
# ALWAYS verify after build:
node -e "
const asar = require('./node_modules/@electron/asar');
const pkg = JSON.parse(asar.extractFile('./release-builds/win-unpacked/resources/app.asar', 'package.json').toString());
console.log('win-unpacked version:', pkg.version);
"
# FIX: run both
npx electron-builder --win dir  # updates win-unpacked
npx electron-builder --win      # builds installer
```

### 7. Regex toast removal broke code structure
```javascript
// CATASTROPHIC: regex removed toast() calls but left broken syntax
// Before: if (!resuming) toast.info('Standalone mode');
// After regex:  if (!resuming) /* toast removed */
// = SYNTAX ERROR

// Rule: Never use regex to modify code. Use AST tools or manual edits.
```

### 8. GNSS grade noise
```
GPS altitude noise creates fake grades.
Example: 2 samples 0.1m apart, altitude differs by 0.3m → 300% grade
Mitigation:
  - 5-sample moving average on altitude
  - Minimum 2m travel between grade calculations
  - Hard clamp ±50%
  - Speed > 2 km/h required for auto-POIs
```

### 9. Old IndexedDB data persists between sessions
```
This is CORRECT behavior — it's the user's survey history.
"Old data showing in log" = previous survey records.
DO NOT clear IndexedDB on startup.
Add a "Clear current survey data" button in Settings instead.
```

### 10. POI Actions defaults override user settings
```typescript
// WRONG: defaults always win
const merged = { ...parsed, ...baseDefaults }; // defaults override user!

// CORRECT: user values win
const merged = { ...baseDefaults };  // start with defaults for missing keys
Object.keys(parsed).forEach(key => { merged[key] = parsed[key]; }); // user overrides
```

## Development process rules

### Always validate before building
```bash
# 1. Check main.cjs syntax
node --check electron/main.cjs

# 2. Build React
npm run build

# 3. Package
npx electron-builder --win --config.npmRebuild=false

# 4. Verify ASAR version
node -e "const a=require('.../asar'); console.log(JSON.parse(a.extractFile('app.asar','package.json')).version)"

# 5. Test the portable
release-builds/win-unpacked/MeasurePRO.exe
```

### Never claim something is fixed without running step 4-5

---

# PART 24 — FULL FILE TREE (Key Files)

```
measurepro-electron/
├── .env                            ← API keys (see Part 3)
├── electron-builder.json5          ← Build + publish config
├── package.json                    ← Dependencies + version
├── vite.config.ts                  ← Build config
├── tsconfig.json                   ← TypeScript config
│
├── electron/
│   ├── main.cjs                    ← ENTRY POINT — window, menu, IPC
│   ├── preload.cjs                 ← Bridge: Node → browser APIs
│   ├── db/measurementsDB.cjs       ← SQLite (future)
│   ├── drone/
│   │   ├── driveDetector.cjs       ← Windows drive scanning
│   │   ├── droneImportService.cjs  ← IPC handlers for drone import
│   │   └── imageProcessor.cjs     ← EXIF extraction from JPEGs
│   └── insta360/
│       └── insta360Service.cjs    ← Camera polling + OSC commands
│
├── src/
│   ├── main.tsx                    ← React root, error handlers
│   ├── App.tsx                     ← Main component, auth, routes
│   │
│   ├── hooks/
│   │   ├── logging/               ← NEW LOGGING ENGINE
│   │   │   ├── useLoggingCore.ts  ← savePOI, getGPS, parseMeters
│   │   │   ├── useAllDataMode.ts  ← Mode 1: immediate logging
│   │   │   ├── useCounterMode.ts  ← Mode 2: sky→object→sky
│   │   │   ├── useBufferMode.ts   ← Mode 3: per-type timer+distance
│   │   │   └── useLogging.ts      ← Orchestrator
│   │   └── useMeasurementLogging.ts ← OLD (keep for reference)
│   │
│   ├── lib/
│   │   ├── firebase.ts            ← Firebase init (memoryLocalCache!)
│   │   ├── laserLog.ts            ← Module-level laser buffer (NOT React state)
│   │   ├── poi.ts                 ← POI type definitions
│   │   ├── poiActions.ts          ← Per-type actions store
│   │   ├── settings.ts            ← Global settings store
│   │   ├── laser.ts               ← useLaserStore (ground reference)
│   │   ├── sounds.ts              ← soundManager
│   │   ├── survey/
│   │   │   ├── db.ts             ← openSurveyDB() IndexedDB
│   │   │   ├── store.ts          ← useSurveyStore
│   │   │   └── types.ts          ← Survey, Measurement interfaces
│   │   ├── stores/
│   │   │   ├── serialStore.ts    ← lastMeasurement, connection
│   │   │   ├── gpsStore.ts       ← GPS data
│   │   │   └── alertsStore.ts    ← Alert state
│   │   ├── readers/
│   │   │   └── serialLaserReader.ts ← Multi-format laser parser
│   │   ├── hardware/laser/
│   │   │   ├── ldm71AsciiDriver.ts ← LDM71 protocol
│   │   │   └── amplitudeFilter.ts ← (disabled)
│   │   ├── auth/
│   │   │   ├── masterAdmin.ts    ← Admin emails + feature keys
│   │   │   ├── FeatureProtectedRoute.tsx ← License gating
│   │   │   └── offlineAuth.ts    ← Offline license cache
│   │   ├── gnss/
│   │   │   ├── duroGpsService.ts ← Duro polling
│   │   │   └── profileComputation.ts ← Grade computation
│   │   └── utils/
│   │       ├── geoUtils.ts       ← calculateDistance()
│   │       ├── unitConversion.ts ← m/ft/in conversion
│   │       └── laserUtils.ts     ← isInvalidMeasurement()
│   │
│   ├── components/
│   │   ├── AppHeader.tsx          ← Top bar, menu, status
│   │   ├── LiveCamera.tsx         ← Camera card
│   │   ├── MeasurementCards.tsx   ← Current/Last/Min display
│   │   ├── MeasurementLog.tsx     ← POI activity log
│   │   ├── TabManager.tsx         ← Settings panel
│   │   ├── AutoUpdater.tsx        ← Update notification
│   │   ├── DisclaimerModal.tsx    ← Legal terms
│   │   ├── settings/              ← All Settings tabs
│   │   ├── measurement/           ← Measurement cards
│   │   ├── camera/                ← Camera components
│   │   ├── gnss/                  ← GNSS components
│   │   ├── drone/                 ← Drone import
│   │   ├── profile/               ← Road profile visualization
│   │   └── slave/                 ← Field app pairing
│   │
│   └── pages/
│       ├── Settings.tsx           ← Main settings page
│       └── RoadProfile.tsx        ← GNSS profiling page
│
└── scripts/
    └── create-release.cjs         ← GitHub release automation
```

---

# PART 25 — QUICK REFERENCE COMMANDS

## Development

```bash
# Start dev server (Vite)
npm run dev

# Start Electron in dev mode
IS_DEV=true npx electron electron/main.cjs

# Both together
npm run electron:dev

# TypeScript check
npx tsc --noEmit

# Lint
npm run lint
```

## Build & Release

```bash
# Full build + release (run in WSL)

# 1. Bump version
python3 -c "import json; d=json.load(open('package.json')); v=d['version'].split('.'); v[-1]=str(int(v[-1])+1); d['version']='.'.join(v); json.dump(d,open('package.json','w'),indent=2); print('v'+d['version'])"

# 2. Check syntax
node --check electron/main.cjs && echo "OK"

# 3. Build (PowerShell)
/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -ExecutionPolicy Bypass -Command "Stop-Process -Name 'MeasurePRO' -Force -ErrorAction SilentlyContinue; Set-Location 'C:\Users\jfpri\measurepro-electron'; npm run build; \$env:CSC_IDENTITY_AUTO_DISCOVERY='false'; npx electron-builder --win --config.npmRebuild=false"

# 4. Release
GH_TOKEN=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 node scripts/create-release.cjs "VERSION" "Notes"

# Verify ASAR
node -e "const a=require('./node_modules/@electron/asar'); console.log(JSON.parse(a.extractFile('./release-builds/win-unpacked/resources/app.asar','package.json').toString()).version)"

# Restore from backup (if catastrophic failure)
# git checkout v15.6.31-stable
# OR use: C:\Users\jfpri\measurepro-electron-backup-apr7\
```

## Debugging

```bash
# View app logs
cat "$(ls -t /mnt/c/Users/jfpri/AppData/Roaming/MeasurePRO/*.log 2>/dev/null | head -1)"

# Test laser log parsing
node -e "
const { getLaserLog } = require('./src/lib/laserLog.ts'); // won't work directly
// Instead, test parsing logic:
const line = 'D 0005.230 021.9';
const m = line.match(/^D\s+(\d+\.\d+)/);
console.log('LDM71 parse:', m ? parseFloat(m[1]) : null);
"

# Check ASAR contents
node -e "
const asar = require('./node_modules/@electron/asar');
const files = asar.listPackage('./release-builds/win-unpacked/resources/app.asar');
files.filter(f => f.includes('logging')).forEach(f => console.log(f));
"
```

## Database

```bash
# Clear IndexedDB (in app DevTools console)
indexedDB.deleteDatabase('MeasurePRODB');

# Export all surveys (in app)
# Settings → Data → Backup → Export All Data

# Firebase console
https://console.firebase.google.com/project/measureprov1
```

---

# APPENDIX A — HARDWARE QUICK SETUP

## Duro connection test
```bash
# Test if Duro responds
nc -w 3 192.168.0.222 2101
# Should see NMEA sentences like:
# $GPGGA,143022.00,4512.1234,N,07523.4567,W,4,12,0.8,85.4,M,...
```

## Insta360 connection test
```bash
# Test OSC API
curl http://192.168.42.1/osc/info
# Should return: {"manufacturer":"Insta360","model":"X5",...}
```

## LDM71 laser test
```bash
# Send start streaming command and read
# DT\r = start, output: D 0005.230 021.9
# To test: connect via serial terminal at 115200 baud
# Type: DT then Enter
# Should see lines like: D 0005.230 021.9
```

---

# APPENDIX B — TROUBLESHOOTING

## App won't start
1. Check main.cjs syntax: `node --check electron/main.cjs`
2. Check ASAR version: see quick reference
3. Kill all Node processes: `taskkill /F /IM node.exe`
4. Restore from backup: `C:\Users\jfpri\measurepro-electron-backup-apr7\release-builds\win-unpacked\MeasurePRO.exe`

## Login fails with "offline mode activated"
- Cause: Firebase using IndexedDB which fails under file://
- Fix: ensure firebase.ts uses `initializeFirestore(app, { localCache: memoryLocalCache() })`

## Laser not reading
1. Check COM port in Settings → Laser & GPS
2. Verify baud rate (LDM71 = 115200)
3. Test: Settings → Laser & GPS → Test Connection → should see raw lines

## GNSS not connecting
1. Ping 192.168.0.222 — must respond
2. Check Settings → GNSS → host/port
3. Verify Duro is powered and has Ethernet to same network

## Field app can't pair
1. Check Firestore rules allow read/write on /pairing collection
2. Verify Firebase credentials in .env
3. Both devices must have internet access

## Build fails
1. Kill MeasurePRO first: `Stop-Process -Name 'MeasurePRO'`
2. Clear dist: `rm -rf dist/`
3. Rebuild: `npm run build`

---

END OF COMPLETE REBUILD GUIDE
Total: This document covers all aspects needed to rebuild MeasurePRO and SweptPRO from scratch.
Written by OpenClaw agent on 2026-04-07 for Jean-François Prince, Soltec Innovation.
