interface ElectronSerialAPI {
  list: () => Promise<Array<{
    path: string;
    manufacturer: string;
    serialNumber: string;
    pnpId: string;
    vendorId: string;
    productId: string;
  }>>;
  requestPort: (filters?: Array<{ usbVendorId?: number; usbProductId?: number }>) => Promise<{
    path: string;
    vendorId: string;
    productId: string;
  }>;
  open: (portPath: string, options: {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: string;
  }) => Promise<{ success: boolean }>;
  write: (portPath: string, data: number[]) => Promise<{ success: boolean }>;
  close: (portPath: string) => Promise<{ success: boolean }>;
  getInfo: (portPath: string) => Promise<{ usbVendorId: number; usbProductId: number }>;
  onData: (callback: (portPath: string, data: number[]) => void) => void;
  onError: (callback: (portPath: string, message: string) => void) => void;
  onClose: (callback: (portPath: string) => void) => void;
  removeAllListeners: () => void;
}

interface ElectronAPI {
  isElectron: boolean;
  platform: 'darwin' | 'win32' | 'linux';
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  showSaveDialog: (options: any) => Promise<{ canceled: boolean; filePath?: string }>;
  showOpenDialog: (options: any) => Promise<{ canceled: boolean; filePaths?: string[] }>;
  onMenuAbout: (callback: () => void) => void;
  onMenuNavigate: (callback: (route: string) => void) => void;
  onMenuNavigateTab: (callback: (tab: string) => void) => void;
  onMenuOpenSupportTicket: (callback: () => void) => void;
  onMenuLiveSupport?: (callback: () => void) => void;
  updater: {
    check:      () => Promise<{ status: string; message?: string }>;
    download:   () => Promise<void>;
    install:    () => Promise<void>;
    getPref:    () => Promise<string>;
    setPref:    (pref: string) => Promise<string>;
    getVersion: () => Promise<string>;
    onStatus:   (cb: (data: { status: string; version?: string; percent?: number; speed?: number }) => void) => void;
  };
  writeFile: (filePath: string, data: ArrayBuffer | number[]) => Promise<{ success: boolean }>;
  getAutoSavePath: (filename: string) => Promise<string | null>;
  pickSoundFile:   () => Promise<string | null>;
  clearAppCache:   () => Promise<{ success: boolean; error?: string }>;
  relaunch:        () => Promise<void>;
  duro: {
    connect:         (config: { host: string; port: number }) => Promise<{ ok: boolean }>;
    disconnect:      () => Promise<{ ok: boolean }>;
    getStatus:       () => Promise<{ connected: boolean; host: string; port: number; enabled: boolean }>;
    onData:          (cb: (data: DuroNMEAData) => void) => void;
    onStatus:        (cb: (status: { connected: boolean; host?: string; port?: number; error?: string }) => void) => void;
    removeListeners: () => void;
  };
}

interface DuroNMEAData {
  type: 'position' | 'velocity' | 'imu' | 'dop';
  lat?: number; lon?: number; altitude?: number; satellites?: number; hdop?: number; fixQuality?: number;
  speedKnots?: number; speedMps?: number; speedKph?: number;
  heading?: number | null; pitch?: number | null; roll?: number | null; heaveRate?: number | null;
  pdop?: number | null; vdop?: number | null; mode?: number | null;
  timestamp: number; raw: string;
  serial: ElectronSerialAPI;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
