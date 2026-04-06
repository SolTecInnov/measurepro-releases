# MeasurePRO Electron Migration Guide

This guide documents all steps required to create a standalone Electron desktop application from the MeasurePRO PWA codebase.

## Overview

**Strategy:** Create a separate Electron project while keeping the PWA intact on Replit.

| Version | Purpose | Deployment |
|---------|---------|------------|
| PWA | Web/mobile users | Replit (current) |
| Electron | Desktop installers | Windows/Mac/Linux |

---

## Phase 1: Project Setup

### 1.1 Create New Project Directory

```bash
mkdir measurepro-electron
cd measurepro-electron
```

### 1.2 Initialize Package.json

```json
{
  "name": "measurepro-desktop",
  "version": "2.0.0",
  "description": "MeasurePRO Desktop - Professional Measurement Application",
  "author": "Soltec Innovation <support@soltecinnovation.com>",
  "license": "UNLICENSED",
  "private": true,
  "main": "electron/main.js",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "electron": "wait-on tcp:5173 && cross-env IS_DEV=true electron .",
    "electron:dev": "concurrently -k \"npm run dev\" \"npm run electron\"",
    "electron:build": "npm run build && electron-builder",
    "electron:build:win": "npm run build && electron-builder --win",
    "electron:build:mac": "npm run build && electron-builder --mac",
    "electron:build:linux": "npm run build && electron-builder --linux"
  },
  "build": {
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
    "mac": {
      "target": "dmg",
      "category": "public.app-category.productivity",
      "icon": "build-resources/icon.icns"
    },
    "win": {
      "target": "nsis",
      "icon": "build-resources/icon.ico"
    },
    "linux": {
      "target": "AppImage",
      "category": "Utility"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "build-resources/icon.ico"
    }
  }
}
```

### 1.3 Install Dependencies

```bash
# Core Electron dependencies
npm install -D electron electron-builder concurrently cross-env wait-on

# Copy all dependencies from PWA package.json (except PWA-specific ones)
# Remove: vite-plugin-pwa, workbox-*
```

---

## Phase 2: Files to Copy from PWA

### 2.1 Essential Directories (Copy Entirely)

```
src/                    # All React source code
├── components/
├── hooks/
├── lib/
├── pages/
├── stores/
├── App.tsx
├── index.css
└── main.tsx           # NEEDS MODIFICATION (see below)

shared/                 # Shared types/schemas
db/                     # Database schema
server/                 # Express backend (optional - see Phase 5)
attached_assets/        # Images and assets
```

### 2.2 Config Files to Copy & Modify

| File | Action |
|------|--------|
| `vite.config.ts` | Copy & modify (see 3.1) |
| `tailwind.config.ts` | Copy as-is |
| `postcss.config.js` | Copy as-is |
| `tsconfig.json` | Copy as-is |
| `tsconfig.node.json` | Copy as-is |
| `drizzle.config.ts` | Copy if using PostgreSQL |
| `components.json` | Copy as-is (shadcn config) |

### 2.3 Files to NOT Copy

```
.replit                 # Replit-specific
replit.nix              # Replit-specific
src/serviceWorker.ts    # PWA only
src/sw.ts               # PWA only
public/manifest.json    # PWA only (create new for Electron if needed)
```

---

## Phase 3: Configuration Changes

### 3.1 vite.config.ts (Modified for Electron)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: './',  // CRITICAL: Use relative paths for Electron
  plugins: [
    react(),
    // DO NOT include VitePWA plugin
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@assets': path.resolve(__dirname, './attached_assets'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true,
  },
});
```

### 3.2 src/main.tsx (Modified)

Remove PWA/Service Worker registration:

```typescript
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// REMOVED: Service worker registration
// REMOVED: PWA install prompt handling

console.log(`MeasurePRO Desktop v${APP_VERSION} (Build: ${BUILD_DATE})`);

createRoot(document.getElementById("root")!).render(<App />);
```

### 3.3 Environment Detection

Create `src/lib/platform.ts`:

```typescript
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && 
         typeof window.process === 'object' && 
         window.process.type === 'renderer';
};

export const isPWA = (): boolean => {
  return !isElectron() && 
         (window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as any).standalone === true);
};

export const isWeb = (): boolean => {
  return !isElectron() && !isPWA();
};
```

---

## Phase 4: Electron Main Process

### 4.1 Create electron/main.js

```javascript
import { app, BrowserWindow, Menu, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.IS_DEV === 'true';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'MeasurePRO',
    icon: path.join(__dirname, '../build-resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // Enable Web Serial API and Web Bluetooth
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'serial' || permission === 'bluetooth') {
      return true;
    }
    return true;
  });

  mainWindow.webContents.session.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'serial' || details.deviceType === 'bluetooth') {
      return true;
    }
    return true;
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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
        { label: 'New Survey', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('menu-new-survey') },
        { label: 'Open Survey', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.send('menu-open-survey') },
        { type: 'separator' },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => mainWindow.webContents.send('menu-settings') },
        { type: 'separator' },
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
      label: 'Hardware',
      submenu: [
        { label: 'Connect Laser', click: () => mainWindow.webContents.send('menu-connect-laser') },
        { label: 'Connect GPS', click: () => mainWindow.webContents.send('menu-connect-gps') },
        { label: 'Connect Bluetooth', click: () => mainWindow.webContents.send('menu-connect-bluetooth') },
        { type: 'separator' },
        { label: 'Disconnect All', click: () => mainWindow.webContents.send('menu-disconnect-all') }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Documentation', click: () => shell.openExternal('https://docs.soltecinnovation.com') },
        { label: 'Support', click: () => shell.openExternal('mailto:support@soltecinnovation.com') },
        { type: 'separator' },
        { label: 'About MeasurePRO', click: () => mainWindow.webContents.send('menu-about') }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle serial port selection
app.on('select-serial-port', (event, portList, webContents, callback) => {
  event.preventDefault();
  if (portList && portList.length > 0) {
    callback(portList[0].portId);
  } else {
    callback('');
  }
});
```

### 4.2 Create electron/preload.js

```javascript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Platform detection
  isElectron: true,
  platform: process.platform,
  
  // Menu event listeners
  onMenuNewSurvey: (callback) => ipcRenderer.on('menu-new-survey', callback),
  onMenuOpenSurvey: (callback) => ipcRenderer.on('menu-open-survey', callback),
  onMenuSettings: (callback) => ipcRenderer.on('menu-settings', callback),
  onMenuConnectLaser: (callback) => ipcRenderer.on('menu-connect-laser', callback),
  onMenuConnectGPS: (callback) => ipcRenderer.on('menu-connect-gps', callback),
  onMenuConnectBluetooth: (callback) => ipcRenderer.on('menu-connect-bluetooth', callback),
  onMenuDisconnectAll: (callback) => ipcRenderer.on('menu-disconnect-all', callback),
  onMenuAbout: (callback) => ipcRenderer.on('menu-about', callback),
  
  // File system access (optional - for native file dialogs)
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
});
```

### 4.3 TypeScript Types for Electron API

Create `src/types/electron.d.ts`:

```typescript
interface ElectronAPI {
  isElectron: boolean;
  platform: 'darwin' | 'win32' | 'linux';
  onMenuNewSurvey: (callback: () => void) => void;
  onMenuOpenSurvey: (callback: () => void) => void;
  onMenuSettings: (callback: () => void) => void;
  onMenuConnectLaser: (callback: () => void) => void;
  onMenuConnectGPS: (callback: () => void) => void;
  onMenuConnectBluetooth: (callback: () => void) => void;
  onMenuDisconnectAll: (callback: () => void) => void;
  onMenuAbout: (callback: () => void) => void;
  showSaveDialog: (options: any) => Promise<{ canceled: boolean; filePath?: string }>;
  showOpenDialog: (options: any) => Promise<{ canceled: boolean; filePaths?: string[] }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
```

---

## Phase 5: Backend Options

### Option A: Embedded Backend (Recommended for Offline)

The Express server runs inside Electron:

```javascript
// In electron/main.js, add:
import { spawn } from 'child_process';

let serverProcess;

function startServer() {
  serverProcess = spawn('node', ['server/index.js'], {
    cwd: app.getAppPath(),
    env: { ...process.env, PORT: '3001' }
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});
```

### Option B: Remote Backend

Keep using Replit backend - configure API URL:

```typescript
// src/lib/config.ts
export const API_URL = window.electronAPI?.isElectron 
  ? 'https://your-replit-app.repl.co'  // Production API
  : '';  // Same origin for PWA
```

---

## Phase 6: Firebase Authentication for Electron

### 6.1 Modified Auth Flow

Firebase popup auth works differently in Electron. Use `signInWithRedirect` or custom token auth:

```typescript
// src/lib/firebase/electronAuth.ts
import { getAuth, signInWithCustomToken } from 'firebase/auth';

export async function electronSignIn(email: string, password: string) {
  // Option 1: Use email/password directly
  const auth = getAuth();
  return signInWithEmailAndPassword(auth, email, password);
  
  // Option 2: Use custom backend token exchange
  // const token = await fetchCustomToken(email, password);
  // return signInWithCustomToken(auth, token);
}
```

### 6.2 Conditional Auth Provider

```typescript
// src/lib/firebase/auth.ts
import { isElectron } from '../platform';

export async function signIn() {
  if (isElectron()) {
    return electronSignIn();
  } else {
    return webSignIn(); // Existing popup flow
  }
}
```

---

## Phase 7: Build Resources

### 7.1 Create Icon Files

Create `build-resources/` folder with:

- `icon.icns` - macOS (1024x1024)
- `icon.ico` - Windows (256x256)
- `icon.png` - Linux (512x512)

Use a tool like https://www.electron.build/icons to generate from a single PNG.

### 7.2 App Icons Source

Use the MeasurePRO logo from `attached_assets/` or create new desktop-specific icons.

---

## Phase 8: Development Workflow

### 8.1 Run in Development

```bash
npm run electron:dev
```

This starts:
1. Vite dev server on port 5173
2. Electron window loading from dev server
3. Hot reload for React changes

### 8.2 Build for Distribution

```bash
# All platforms (on each respective OS)
npm run electron:build

# Specific platform
npm run electron:build:win
npm run electron:build:mac
npm run electron:build:linux
```

Output in `release-builds/`:
- Windows: `MeasurePRO Setup x.x.x.exe`
- macOS: `MeasurePRO-x.x.x.dmg`
- Linux: `MeasurePRO-x.x.x.AppImage`

---

## Phase 9: Auto-Updates (Optional)

### 9.1 Install electron-updater

```bash
npm install electron-updater
```

### 9.2 Configure Auto-Update

```javascript
// In electron/main.js
import { autoUpdater } from 'electron-updater';

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update-downloaded');
});
```

---

## Checklist Summary

### Setup
- [ ] Create new project directory
- [ ] Initialize package.json with Electron config
- [ ] Install Electron dependencies

### Copy Files
- [ ] Copy src/ directory
- [ ] Copy shared/ directory
- [ ] Copy tailwind/postcss configs
- [ ] Copy tsconfig files

### Modify
- [ ] Update vite.config.ts (base: './', remove PWA)
- [ ] Update src/main.tsx (remove service worker)
- [ ] Create electron/main.js
- [ ] Create electron/preload.js
- [ ] Add platform detection utility

### Build Resources
- [ ] Create app icons (icns, ico, png)
- [ ] Test on each target platform

### Test
- [ ] Web Serial API (laser connection)
- [ ] Web Bluetooth
- [ ] IndexedDB persistence
- [ ] Firebase authentication
- [ ] GPS/Geolocation

### Distribution
- [ ] Build Windows installer
- [ ] Build macOS dmg
- [ ] Build Linux AppImage
- [ ] Test installation on clean machines

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-12 | 1.0 | Initial migration guide |

---

*Document maintained by Soltec Innovation*
