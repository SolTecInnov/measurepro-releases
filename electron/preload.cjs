const { contextBridge, ipcRenderer } = require('electron');

// Leaflet's UMD bundle checks for AMD `define` and calls it incorrectly in Electron.
// Clearing it here forces Leaflet to use the CommonJS/global path instead.
if (typeof globalThis.define !== 'undefined' && globalThis.define.amd) {
  delete globalThis.define;
}

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  onMenuAbout: (callback) => ipcRenderer.on('menu-about', callback),
  onMenuNavigate: (callback) => ipcRenderer.on('menu-navigate', (_event, route) => callback(route)),
  onMenuNavigateTab: (callback) => ipcRenderer.on('menu-navigate-tab', (_event, tab) => callback(tab)),
  onMenuOpenSupportTicket: (callback) => ipcRenderer.on('menu-open-support-ticket', callback),

  // ── Auto-updater ─────────────────────────────────────────────────
  updater: {
    check:      () => ipcRenderer.invoke('updater:check'),
    download:   () => ipcRenderer.invoke('updater:download'),
    install:    () => ipcRenderer.invoke('updater:install'),
    getPref:    () => ipcRenderer.invoke('updater:get-pref'),
    setPref:    (p) => ipcRenderer.invoke('updater:set-pref', p),
    getVersion: () => ipcRenderer.invoke('updater:get-version'),
    onStatus:   (cb) => ipcRenderer.on('update-status', (_e, data) => cb(data)),
  },

  // ── File I/O ───────────────────────────────────────────────────────────────
  writeFile: (filePath, data) => ipcRenderer.invoke('file:write', filePath, data),
  getAutoSavePath: (filename) => ipcRenderer.invoke('fs:getAutoSavePath', filename),
  pickSoundFile:  ()         => ipcRenderer.invoke('fs:pickSoundFile'),

  // ── Duro GNSS TCP ─────────────────────────────────────────────
  duro: {
    connect:    (config) => ipcRenderer.invoke('duro:connect', config),
    disconnect: ()       => ipcRenderer.invoke('duro:disconnect'),
    getStatus:  ()       => ipcRenderer.invoke('duro:status'),
    onData:     (cb)     => ipcRenderer.on('duro:data',   (_e, d) => cb(d)),
    onStatus:   (cb)     => ipcRenderer.on('duro:status', (_e, s) => cb(s)),
    removeListeners: ()  => {
      ipcRenderer.removeAllListeners('duro:data');
      ipcRenderer.removeAllListeners('duro:status');
    },
  },

  // ── Serial Port ────────────────────────────────────────────────────────────
  serial: {
    list: () => ipcRenderer.invoke('serial:list'),
    requestPort: (filters) => ipcRenderer.invoke('serial:requestPort', filters),
    open: (portPath, options) => ipcRenderer.invoke('serial:open', portPath, options),
    write: (portPath, data) => ipcRenderer.invoke('serial:write', portPath, data),
    close: (portPath) => ipcRenderer.invoke('serial:close', portPath),
    getInfo: (portPath) => ipcRenderer.invoke('serial:getInfo', portPath),
    onData: (callback) => {
      ipcRenderer.on('serial:data', (_event, portPath, data) => callback(portPath, data));
    },
    onError: (callback) => {
      ipcRenderer.on('serial:error', (_event, portPath, message) => callback(portPath, message));
    },
    onClose: (callback) => {
      ipcRenderer.on('serial:close', (_event, portPath) => callback(portPath));
    },
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('serial:data');
      ipcRenderer.removeAllListeners('serial:error');
      ipcRenderer.removeAllListeners('serial:close');
    },
  },
});
