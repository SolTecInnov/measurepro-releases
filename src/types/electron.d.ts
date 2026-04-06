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
  serial: ElectronSerialAPI;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
