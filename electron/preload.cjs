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
  // New updater API for AutoUpdater.tsx component
  updaterCheck:       () => ipcRenderer.invoke('updater:check'),
  updaterInstallNow:  () => ipcRenderer.invoke('updater:install-now'),
  onUpdateAvailable:  (cb) => ipcRenderer.on('updater:update-available',  (_e, d) => cb(d)),
  onDownloadProgress: (cb) => ipcRenderer.on('updater:download-progress', (_e, d) => cb(d)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('updater:update-downloaded', (_e, d) => cb(d)),
  removeUpdaterListeners: () => {
    ipcRenderer.removeAllListeners('updater:update-available');
    ipcRenderer.removeAllListeners('updater:download-progress');
    ipcRenderer.removeAllListeners('updater:update-downloaded');
  },
  // Legacy updater API
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

  // ── Laser (Electron native — no Web Serial dialog) ──────────────────────────
  laser: {
    listPorts:    ()         => ipcRenderer.invoke('laser:list-ports'),
    connect:      (opts)     => ipcRenderer.invoke('laser:connect', opts),
    disconnect:   ()         => ipcRenderer.invoke('laser:disconnect'),
    sendCommand:  (cmd)      => ipcRenderer.invoke('laser:send-command', cmd),
    getStatus:    ()         => ipcRenderer.invoke('laser:status'),
    onMeasurement:(cb)       => ipcRenderer.on('laser:measurement',   (_e, d) => cb(d)),
    onRawLine:    (cb)       => ipcRenderer.on('laser:raw-line',      (_e, d) => cb(d)),
    onError:      (cb)       => ipcRenderer.on('laser:error',         (_e, d) => cb(d)),
    onDisconnect: (cb)       => ipcRenderer.on('laser:disconnected',  ()      => cb()),
    removeListeners: () => {
      ['laser:measurement','laser:raw-line','laser:error','laser:disconnected']
        .forEach(ch => ipcRenderer.removeAllListeners(ch));
    },
  },

  // ── Insta360 X5 Native (no bridge) ─────────────────────────────────────────
  insta360: {
    getStatus:        ()  => ipcRenderer.invoke('insta360:getStatus'),
    startRecording:   ()  => ipcRenderer.invoke('insta360:startRecording'),
    stopRecording:    ()  => ipcRenderer.invoke('insta360:stopRecording'),
    takePhoto:        ()  => ipcRenderer.invoke('insta360:takePhoto'),
    getLensStatus:    ()  => ipcRenderer.invoke('insta360:getLensStatus'),
    getInfo:          ()  => ipcRenderer.invoke('insta360:getInfo'),
    getLivePreviewUrl:()  => ipcRenderer.invoke('insta360:getLivePreviewUrl'),
    setCustomIp:  (ip)    => ipcRenderer.invoke('insta360:setCustomIp', ip),
    onConnection: (cb)    => ipcRenderer.on('insta360:connection', (_e, d) => cb(d)),
    onStatus:     (cb)    => ipcRenderer.on('insta360:status',     (_e, d) => cb(d)),
    removeListeners: ()   => {
      ipcRenderer.removeAllListeners('insta360:connection');
      ipcRenderer.removeAllListeners('insta360:status');
    },
  },

  // ── Drone Import ─────────────────────────────────────────────────
  drone: {
    scan:         ()      => ipcRenderer.invoke('drone:scan'),
    preview:      (args)  => ipcRenderer.invoke('drone:preview', args),
    match:        (args)  => ipcRenderer.invoke('drone:match', args),
    importGroup:  (args)  => ipcRenderer.invoke('drone:import-group', args),
    getHistory:   ()      => ipcRenderer.invoke('drone:get-history'),
    clearHistory: ()      => ipcRenderer.invoke('drone:clear-history'),
    onDeviceDetected: (cb) => ipcRenderer.on('drone:device-detected', (_e, d) => cb(d)),
    onDeviceRemoved:  (cb) => ipcRenderer.on('drone:device-removed',  (_e, d) => cb(d)),
    onProgress:       (cb) => ipcRenderer.on('drone:progress',        (_e, d) => cb(d)),
    removeListeners:  ()  => {
      ipcRenderer.removeAllListeners('drone:device-detected');
      ipcRenderer.removeAllListeners('drone:device-removed');
      ipcRenderer.removeAllListeners('drone:progress');
    },
  },

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

  // ── Native keyboard input (StreamDeck compatibility) ──────────────────────
  onNativeKeydown: (callback) => {
    ipcRenderer.on('native-keydown', (_event, data) => callback(data));
  },
});
