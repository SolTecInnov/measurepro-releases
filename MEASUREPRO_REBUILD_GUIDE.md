# MeasurePRO — Complete Rebuild Guide
# Written: 2026-04-07 by OpenClaw agent before decommission
# Purpose: Complete instructions to rebuild MeasurePRO from scratch

---

## PART 1 — WHAT MEASUREPRO IS

MeasurePRO is a professional survey measurement application for overhead clearance work. 
It runs on Windows as an Electron desktop app (not a web app).

### Core workflow:
1. Technician drives a survey vehicle under overhead obstacles (wires, bridges, signs)
2. A laser rangefinder reads the clearance distance continuously
3. The app logs POIs (Points of Interest) with GPS coordinates, height, photos
4. Data syncs to Firebase cloud for reporting

### Hardware:
- **Laser**: Soltec/Jenoptik LDM71 (serial/USB COM port, format: `D 0005.230 021.9\r\n`)
- **GNSS/GPS**: Swift Navigation Duro Inertial (TCP, IP 192.168.0.222, port 2101, NMEA output)
- **Camera**: Insta360 X5 (USB-C, RNDIS virtual network, IP 192.168.42.1, OSC API)
- **Future**: Slamtec RPLIDAR A2M12 2D scanner (perpendicular to road)

---

## PART 2 — CREDENTIALS & API KEYS

### Firebase (Authentication + Firestore)
```
Project ID: measureprov1
Auth Domain: measureprov1.firebaseapp.com
Storage Bucket: measureprov1.firebasestorage.app
Messaging Sender ID: 341067281215
App ID: 1:341067281215:web:57ac6a6a298dd65f73598a
Measurement ID: G-YWX367PWKJ
Firebase API Key: AIzaSyCIC_bcUVl0gtjmBq82WK5Fbc61Bec3bFw
```
Master admin email: jfprince@soltec.ca

### Mapbox (for SweptPRO)
```
Token: pk.eyJ1IjoiamZwcmluY2UiLCJhIjoiY21ubzA5dnpqMjAzZzJwcHNkdDVqb3RpbCJ9.W9gbUE1yxw9_30lfQ1UjPA
Username: jfprince
```

### GitHub (for releases)
```
Org: SolTecInnov
Repos: measurepro-releases, sweptpro-releases
PAT: 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
```

### Google Maps (for map features)
```
API Key: AIzaSyAp_RmGGw4Pb_zL25Q7Tr2O7b17QoSXuPk
```

---

## PART 3 — TECH STACK

### Frontend
- **Framework**: React 18 + TypeScript
- **Build**: Vite 6
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Icons**: Lucide React (ONLY — no emoji icons)
- **Notifications**: Sonner (toasts — use SPARINGLY, sound is primary feedback)
- **Routing**: React Router DOM (wouter for some parts)

### Desktop shell
- **Electron**: v35
- **Build**: electron-builder (NSIS installer + win-unpacked portable)
- **IPC**: contextBridge + ipcRenderer/ipcMain

### Database
- **Local**: IndexedDB via `idb` library (offline-first)
- **Cloud**: Firebase Firestore (sync, auth, licensing)
- **Future**: better-sqlite3 for local SQLite (schema already designed)

### Hardware communication
- **Serial (laser)**: Web Serial API (browser-native, no node serialport needed in renderer)
- **TCP (GNSS Duro)**: Electron main process → net.Socket → IPC to renderer
- **Camera (Insta360)**: HTTP fetch to 192.168.42.1/osc/... endpoints
- **USB detection**: Windows drive polling via child_process/wmic

---

## PART 4 — ELECTRON ARCHITECTURE

### File structure
```
electron/
  main.cjs          — Main process: window, menus, IPC handlers
  preload.cjs       — contextBridge exposing safe APIs to renderer
  db/
    measurementsDB.cjs   — SQLite (future) + IPC handlers
  drone/
    driveDetector.cjs    — DJI SD card detection
    droneImportService.cjs — Image import from drone
    imageProcessor.cjs   — EXIF extraction
  insta360/
    insta360Service.cjs  — Camera control via OSC API
```

### main.cjs structure
```javascript
// 1. Imports
const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');

// 2. Auto-updater (CRITICAL: guard with try-catch)
let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (_e) {}

// 3. createWindow()
// 4. IPC handlers
// 5. app.whenReady() → createWindow() + start services
// 6. autoUpdater.checkForUpdates() after 30s
```

### preload.cjs — exposed APIs
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  onMenu: (cb) => ipcRenderer.on('menu', (_e, action) => cb(action)),
  // GNSS Duro
  duroConnect: (host, port) => ipcRenderer.invoke('duro:connect', host, port),
  duroDisconnect: () => ipcRenderer.invoke('duro:disconnect'),
  onDuroData: (cb) => ipcRenderer.on('duro:data', (_e, d) => cb(d)),
  // Insta360
  insta360GetStatus: () => ipcRenderer.invoke('insta360:getStatus'),
  insta360TakePhoto: () => ipcRenderer.invoke('insta360:takePhoto'),
  insta360StartRecording: () => ipcRenderer.invoke('insta360:startRecording'),
  insta360StopRecording: () => ipcRenderer.invoke('insta360:stopRecording'),
  onInsta360Connection: (cb) => ipcRenderer.on('insta360:connection', (_e, d) => cb(d)),
  // Drone import
  droneScan: () => ipcRenderer.invoke('drone:scan'),
  droneLoadImages: (opts) => ipcRenderer.invoke('drone:load-images', opts),
  onDroneDetected: (cb) => ipcRenderer.on('drone:detected', (_e, d) => cb(d)),
  // Auto-updater
  updaterCheck: () => ipcRenderer.invoke('updater:check'),
  updaterInstallNow: () => ipcRenderer.invoke('updater:install-now'),
  onUpdateAvailable: (cb) => ipcRenderer.on('updater:update-available', (_e, d) => cb(d)),
  onDownloadProgress: (cb) => ipcRenderer.on('updater:download-progress', (_e, d) => cb(d)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('updater:update-downloaded', (_e, d) => cb(d)),
});
```

---

## PART 5 — LASER READING PIPELINE

### Overview
```
COM port → Web Serial API → LaserReader class → LDM71AsciiDriver
→ rawLineCallback → appendToLaserOutput (module-level buffer)
→ emitMeasurement → useSerialStore.setLastLaserData()
```

### Laser formats to support
```
LDM71 (Soltec/Jenoptik): D 0005.230 021.9\r\n
  Parse: /^D\s+(\d+\.\d+)(?:\s+[\d.]+)?$/
  
Acuity AR700: +005230\r\n (µm, signed)
  Parse: /^([+-]?\d+)\r?\n$/ → value / 1000 = meters

Dimetix FLS/DLS: g0+00005230\r\n (µm, signed, 10 digits)
  Parse: /^g0([+-]\d{8,10})\r?\n$/ → value / 1000 = meters

Astech: [LASER] D -> 5.230 m
  Parse: /\[LASER\].*->\s+([\d.]+)\s*m/

Generic float meters: 5.230\r\n
  Parse: /^([\d.]+)\r?\n$/

Generic int mm: 5230\r\n
  Parse: /^(\d+)\r?\n$/ → value / 1000 = meters

Sky/Error codes (all lasers):
  DE02, De02, E001, [ERR], --, infinity → treat as sky, log nothing
  Values <= 0.1m → treat as noise/ground reflection, skip
```

### LaserReader class (src/lib/readers/serialLaserReader.ts)
```typescript
class LaserReader {
  setLaserType(type: 'ldm71' | 'acuity' | 'dimetix' | 'astech' | 'generic_m' | 'generic_mm')
  processData(chunk: Uint8Array): void
  private emitMeasurement(value: string): void  // calls useSerialStore.setLastLaserData()
}
```

### laserLog module (src/lib/laserLog.ts)
Module-level buffer, NOT React state (avoids re-renders).
Counter detection reads from this buffer via getLaserLog().

---

## PART 6 — LOGGING PIPELINE (REBUILT FROM SCRATCH)

### 3 modes only

**Mode 1: All Data** (`useAllDataMode.ts`)
```
Every valid laser reading → immediate POI save
No buffer, no algorithm, no conditions
POI type = user's current selection
If DE02/sky/noise → skip silently
Image captured async (doesn't block POI)
```

**Mode 2: Counter Detection** (`useCounterMode.ts`)
```
Timer at 150ms reads laser log
State machine: sky → object → sky

On first valid reading (sky→object):
  - Capture GPS immediately
  - Start image capture async
  - Begin buffering readings

On sky for > 1 second OR max duration (5s) OR max distance (300m):
  - Create POI with min reading in 'height', avg in 'notes'
  - Restart immediately for next object

On POI type change while buffering:
  - Log current buffer immediately
  - Restart with new type

Rules are SAME for all POI types (unlike Buffer mode)
```

**Mode 3: Buffer Detection** (`useBufferMode.ts`)
```
Each POI type has its own config:
  wire:           100m or 15s
  bridgeAndWires: 100m or 15s
  powerLine:      100m or 15s
  tree:            50m or 10s
  trafficLight:    50m or  8s
  etc.

On first valid reading:
  - Capture GPS immediately
  - Start image capture async
  - Start timer + distance tracking

First of 3 conditions triggers POI:
  1. Sky detected for > 1 second
  2. Timer expires (per-type maxTimeMs)
  3. Distance exceeds (per-type maxDistM)

After POI created → IMMEDIATELY restart for next object
On POI type change → flush and restart
```

### POI record structure
```typescript
interface POIRecord {
  id: string;           // crypto.randomUUID()
  surveyId: string;     // active survey ID
  poiType: string;      // 'wire', 'bridge', etc.
  poiNumber: number;    // sequential
  roadNumber: number;   // current road segment
  heightM: number;      // adjusted = raw + groundRef
  heightRawM: number;   // raw laser reading only
  groundRefM: number;   // ground reference height
  heightMinM?: number;  // min in buffer session
  heightAvgM?: number;  // avg in buffer session
  readingCount?: number;
  gps: {
    latitude: number;
    longitude: number;
    altitude: number;
    speed: number;      // km/h
    heading: number;    // degrees
    source: string;     // 'duro', 'browser', 'serial'
    fixQuality: string; // 'RTK Fixed', 'GPS Fix', etc.
  };
  utcDate: string;      // YYYY-MM-DD
  utcTime: string;      // HH:MM:SS
  createdAt: string;    // ISO timestamp
  imageUrl?: string;    // base64 or IndexedDB reference
  images?: string[];
  note?: string;        // includes avg, count, groundRef info
  source: 'manual' | 'all_data' | 'counter' | 'buffer';
  // Future RPLIDAR columns:
  rplidar_height_top_m?: number;
  rplidar_clear_left_m?: number;
  rplidar_clear_right_m?: number;
  rplidar_profile_json?: string;
}
```

---

## PART 7 — GPS/GNSS

### Duro connection (native TCP in Electron main)
```javascript
// electron/main.cjs
const net = require('net');
let duroSocket = null;

ipcMain.handle('duro:connect', async (_, host, port) => {
  duroSocket = new net.Socket();
  duroSocket.connect(port, host, () => {
    mainWindow.webContents.send('duro:connected');
  });
  duroSocket.on('data', (data) => {
    // Parse NMEA sentences
    mainWindow.webContents.send('duro:data', data.toString());
  });
});
```

Default: IP 192.168.0.222, port 2101
NMEA sentences: $GPGGA, $GPRMC, $GPGSV etc.
RTK Fix Quality: 4 = RTK Fixed, 5 = RTK Float, 1 = GPS Fix

### GPS store (src/lib/stores/gpsStore.ts)
Zustand store with:
- latitude, longitude, altitude, speed, course
- satellites, fixQuality, hdop
- source: 'duro' | 'browser' | 'serial' | 'bluetooth'
- imu: { heading, roll, pitch } (from Duro IMU)

### Browser GPS fallback
navigator.geolocation.watchPosition() with high accuracy
Only used when no Duro connected

---

## PART 8 — FIREBASE AUTH & LICENSING

### Auth flow
1. Firebase email/password auth
2. On login: check Firestore /licenses/{uid} for license status
3. License types: trial (7 days), monthly, annual, custom
4. Master admins (jfprince@soltec.ca etc.): always full access
5. Features gated by license: gnss_profiling, convoy_guardian, etc.

### Firestore structure
```
/surveys/{surveyId}
  id, name, surveyorName, clientName, projectNumber, roadNumber, createdAt

/measurements/{measurementId}  
  surveyId, poiType, height, latitude, longitude, imageUrl, ...

/licenses/{userId}
  type, expiresAt, features[], status

/users/{userId}
  email, name, company, role

/pairing/{code}           ← Field app pairing
  masterOnline, slaveOnline, surveyData, createdAt, expiresAt
  /toSlave/{msgId}        ← Messages from tablet to phone
  /toMaster/{msgId}       ← Messages from phone to tablet
```

### Firestore rules (MUST SET)
```
match /pairing/{code} {
  allow read, write: if true;  // Field app pairing — no auth required
}
match /pairing/{code}/{sub=**} {
  allow read, write: if true;
}
```

---

## PART 9 — FIELD APP (mobile PWA)

URL: https://measure-pro.app/slave-app

### Connection flow (Firestore relay — no custom server)
```
Tablet (master):
  1. Create /pairing/{code} document with masterOnline: true
  2. Show QR code + 6-digit code to user
  3. Listen to /pairing/{code} for slaveOnline changes
  4. On slave connect: push surveyData to /pairing/{code}/toSlave

Phone (slave):
  1. User enters 6-digit code
  2. getDoc(/pairing/{code}) — verify exists and not expired
  3. setDoc — slaveOnline: true
  4. Listen to /pairing/{code}/toSlave for messages
  5. Send measurements via addDoc to /pairing/{code}/toMaster
```

### Offline mode
Phone can work fully offline without tablet connection.
Captures save to localStorage.
When reconnected: sync to master via Firestore.

---

## PART 10 — SETTINGS ARCHITECTURE

### What settings exist
```
Laser settings:
  - COM port (string)
  - Baud rate (number: 115200 default)
  - Format (ldm71/acuity/dimetix/astech/generic_m/generic_mm)
  
GPS/GNSS settings:
  - Duro host (default: 192.168.0.222)
  - Duro port (default: 2101)
  - Enable Duro toggle

Camera settings:
  - Selected camera device
  - Overlay options (GPS, height, date, POI type, surveyor)
  - Logo URL

Logging settings:
  - Ground reference height (meters)
  - Auto-save interval (number of POIs)
  - Min/max height thresholds
  
Alert settings:
  - Warning threshold (meters)
  - Critical threshold (meters)
  - Sounds per alert type

POI Actions:
  - Per POI type: 'auto-capture-and-log' | 'log-only' | 'skip'
  - Stored in localStorage, user values WIN over defaults

Buffer detection config:
  - Per POI type: { maxTimeMs, maxDistM, mode }
  - Stored in localStorage

Display settings:
  - Units: m | ft | ft+in | cm | mm | in
  - Zoom level (70-120%)
```

### Settings storage
- Simple settings: localStorage
- Survey data: IndexedDB via openSurveyDB()
- User preferences: Firebase Firestore /users/{uid}/settings (synced)

---

## PART 11 — SURVEY DATA MODEL

### Survey
```typescript
interface Survey {
  id: string;
  name: string;
  surveyTitle: string;
  surveyorName: string;
  clientName: string;
  projectNumber?: string;
  roadNumber: number;       // current road being surveyed
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed';
}
```

### Measurement (POI)
```typescript
interface Measurement {
  id: string;
  user_id: string;          // survey ID (legacy naming)
  poi_type: string;
  poiNumber: number;
  roadNumber: number;
  rel: number | null;       // adjusted height (main value)
  altGPS: number | null;    // GPS altitude
  latitude: number;
  longitude: number;
  utcDate: string;
  utcTime: string;
  speed: number;
  heading: number;
  imageUrl: string | null;
  images: string[];
  note: string;
  createdAt: string;
  source: string;
}
```

### POI types
```
Height clearance types (measure height):
  wire, bridgeAndWires, overpass, powerLine, trafficLight,
  overheadStructure, signalization, opticalFiber, tree

Measurement-free types (no height, just location):
  bridge, culvert, intersection, railway, milestone,
  gradeUp, gradeDown, passingLane, accident, etc.
```

---

## PART 12 — BUILD & RELEASE PROCESS

### Build
```bash
# PowerShell (Windows):
npm run build                    # Vite → dist/
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
npx electron-builder --win --config.npmRebuild=false
# Creates: release-builds/MeasurePROSetup.exe + win-unpacked/

# CRITICAL: win-unpacked may lag behind installer
# To update win-unpacked separately:
npx electron-builder --win dir --config.npmRebuild=false
```

### Version bump
```bash
python3 -c "
import json
with open('package.json') as f: d = json.load(f)
v = d['version'].split('.')
v[-1] = str(int(v[-1]) + 1)
d['version'] = '.'.join(v)
with open('package.json', 'w') as f: json.dump(d, f, indent=2)
print('v' + d['version'])
"
```

### Release to GitHub
```bash
GH_TOKEN=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 \
node scripts/create-release.cjs "15.6.38" "Release notes here"
```

### electron-builder.json5 (publish config)
```json5
{
  "appId": "com.soltecinnovation.measurepro",
  "productName": "MeasurePRO",
  "publish": {
    "provider": "github",
    "owner": "SolTecInnov",
    "repo": "measurepro-releases",
    "private": false
  }
}
```

---

## PART 13 — WHAT TO BUILD FROM SCRATCH

### Phase 1: Core shell (1 week)
1. Electron app with main.cjs + preload.cjs
2. React + Vite + Tailwind setup
3. Firebase auth (email/password)
4. Basic survey creation/management
5. IndexedDB for local storage
6. Auto-updater from GitHub releases
7. Disclaimer modal (legal terms, accepted once)

### Phase 2: Laser integration (1 week)
1. Laser settings window (COM, baud, format, test)
2. Web Serial API connection
3. Multi-format parser (LDM71, Acuity, Dimetix, etc.)
4. laserLog module (NOT React state)
5. Amplitude filter toggle (disabled by default)

### Phase 3: GPS integration (1 week)
1. Duro TCP connection (Electron main → net.Socket → IPC)
2. NMEA parser
3. GPS store (Zustand)
4. Browser GPS fallback

### Phase 4: Logging (1 week)
1. useLoggingCore.ts (savePOI, getGPS, captureImageAsync)
2. useAllDataMode.ts (immediate logging)
3. useCounterMode.ts (sky→object→sky)
4. useBufferMode.ts (per-type timer+distance)
5. useLogging.ts (orchestrator)

### Phase 5: UI (2 weeks)
1. Main screen with measurement cards (Current, Last, Min)
2. POI type selector
3. Logging mode selector (All Data / Counter / Buffer)
4. Activity log (scrollable list of POIs)
5. Camera live preview (no controls)
6. Settings panel (consolidated, Windows-native style)

### Phase 6: Field App (1 week)
1. PWA at /slave-app
2. Firestore pairing relay
3. Offline capture with sync

### Phase 7: GNSS Profiling (separate app)
1. Separate Electron app: GNSSPro
2. Duro connection
3. Grade computation (smoothed altitude, 2m min distance)
4. Profile visualization
5. Export GPX/KML/GeoJSON
6. REST endpoint at localhost:7777 for GPS share to MeasurePRO

---

## PART 14 — CRITICAL LESSONS LEARNED

### DO NOT repeat these mistakes:

1. **Never use `import { crypto } from 'crypto'` in renderer**
   Use `globalThis.crypto?.randomUUID()` instead

2. **Always run `node --check electron/main.cjs` before building**
   A syntax error there makes the app a blank screen

3. **win-unpacked and installer have different ASARs**
   Always run `--win dir` AND `--win` separately, or check versions match:
   ```javascript
   asar.extractFile('app.asar', 'package.json') // check version
   ```

4. **Never declare a variable after using it** (JavaScript TDZ)
   `fpX` was used before `let fpX =` in deriveUnitGeometry — caused crash on 2nd click

5. **Never use regex toast-removal** on complex codebase
   It broke try-catch blocks, if-statements, JSX — manual review only

6. **Keep useMeasurementLogging.ts UNTIL fully replaced**
   Parallel implementation, swap only when new is verified working

7. **Sounds are the primary feedback** — toasts are secondary
   Too many toasts = user frustration. Sound confirms log, toast is optional

8. **GNSS grade needs smoothing**
   Raw GPS altitude noise creates 300%+ fake grades. Always:
   - Moving average over 5 samples
   - Minimum 2m distance between grade calc points
   - Hard clamp ±50%
   - Require speed > 2 km/h for auto-POI creation

9. **IndexedDB data persists between sessions** — this is correct behavior
   Old POIs showing in log = they're from previous surveys. Add survey filter or clear option.

10. **`let autoUpdater = null; try { autoUpdater = require('electron-updater').autoUpdater } catch {}`**
    Always guard electron-updater — it may not be bundled

---

## PART 15 — SWEEPTPRO (companion app)

SweptPRO is a separate Electron app for convoy swept path simulation.

### Location: C:\Users\jfpri\sweptpro-electron
### GitHub: SolTecInnov/sweptpro-releases

### Core concept
User draws a route on Mapbox satellite map.
The app simulates a convoy following that route.
Canvas overlay shows the swept path envelope (orange).

### Kinematic engine (src/engine/convoy.ts)
**Tractrix algorithm:**
```
Unit 0 (tractor): front pivot follows guideline exactly
Unit N: front pivot chases rear pivot of Unit N-1
         → creates tractrix curve on turns
```

**Key fix: variable order in deriveUnitGeometry()**
```typescript
// WRONG (causes crash):
const frontEdge = fpX + 0.1;  // fpX not yet declared!
let fpX = ...;

// CORRECT:
let fpX = ...;  // declare first
const frontEdge = fpX + 0.1;  // then use
```

**Warmup**: simulate 1.5× convoy length in straight line before frame 0
→ ensures units are spread out at start of animation

### Convoy data model
```typescript
interface ConvoyUnit {
  axleGroups: AxleGroup[];   // NOT unit.axles (old model)
  frontPivot: PivotPoint | null;  // null = lead unit
  rearPivot: PivotPoint | null;   // null = tail unit
  gapToNext: number;   // last axle of this unit → first axle of next (meters)
  width: number;
  steeringType: SteeringType;
}

interface PivotPoint {
  attachToGroup: number;           // index of axle group
  offsetFromGroupCenter: number;   // + = forward, - = rearward
  maxAngleDeg: number;             // default 65°
}
```

---

## PART 16 — QUICK REFERENCE

### Run locally
```bash
# Start dev server
npm run dev  # Vite on port 5173

# Start Electron in dev mode
IS_DEV=true npx electron electron/main.cjs

# Or combined
npm run electron:dev
```

### Common debug
```bash
# Check main.cjs syntax
node --check electron/main.cjs

# Verify what's in ASAR
node -e "
const asar = require('./node_modules/@electron/asar');
const pkg = JSON.parse(asar.extractFile('release-builds/win-unpacked/resources/app.asar', 'package.json').toString());
console.log('Version:', pkg.version);
"

# Launch portable
cmd.exe /c start "" "C:\Users\jfpri\measurepro-electron\release-builds\win-unpacked\MeasurePRO.exe"
```

### Version format
`MAJOR.MINOR.PATCH`
- PATCH: bugfix, small change
- MINOR: new feature complete
- MAJOR: product milestone / first paying customers

Current: v15.6.38

---

END OF REBUILD GUIDE
