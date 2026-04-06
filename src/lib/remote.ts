import { create } from 'zustand';
import { useSerialStore } from './stores/serialStore';
import { useCameraStore } from './camera';
import { soundManager } from './sounds';

export interface RemoteButton {
  id: number;
  name: string;
  description: string;
  vendorId?: number;
  productId?: number;
  buttonCode?: number;
}

export interface RemoteMapping {
  addPOI: RemoteButton;
  capture: RemoteButton;
  startStopMeasure: RemoteButton;
  startStopLaser: RemoteButton;
  startStopGPS: RemoteButton;
  startStopTracing: RemoteButton;
  clearAlert: RemoteButton;
  toggleOverlays: RemoteButton;
  exportCSV: RemoteButton;
  toggleCamera: RemoteButton;
  toggleMap: RemoteButton;
  toggleLogs: RemoteButton;
  toggleSettings: RemoteButton;
  emergencyStop: RemoteButton;
  confirmAction: RemoteButton;
}

const defaultMapping: RemoteMapping = {
  addPOI: { 
    id: 1,
    name: 'Button 1',
    description: 'Add POI',
    vendorId: 0x0483,
    productId: 0x5750,
    buttonCode: 0x01
  },
  capture: {
    id: 2,
    name: 'Button 2',
    description: 'Capture Image',
    vendorId: 0x0483,
    productId: 0x5750,
    buttonCode: 0x02
  },
  startStopMeasure: {
    id: 3,
    name: 'Button 3',
    description: 'Start/Stop Measurement',
    vendorId: 0x0483,
    productId: 0x5750,
    buttonCode: 0x04
  },
  startStopLaser: {
    id: 4,
    name: 'Button 4',
    description: 'Start/Stop Laser',
    vendorId: 0x0483,
    productId: 0x5750,
    buttonCode: 0x08
  },
  startStopGPS: {
    id: 5,
    name: 'Button 5',
    description: 'Start/Stop GPS',
    vendorId: 0x0483,
    productId: 0x5750,
    buttonCode: 0x10
  },
  startStopTracing: {
    id: 6,
    name: 'Button 6',
    description: 'Start/Stop Tracing',
    vendorId: 0x0483,
    productId: 0x5750,
    buttonCode: 0x20
  },
  clearAlert: {
    id: 7,
    name: 'Button 7',
    description: 'Clear Alert',
    vendorId: 0x0483,
    productId: 0x5750,
    buttonCode: 0x40
  },
  toggleOverlays: {
    id: 8,
    name: 'Button 8',
    description: 'Toggle Overlays',
    vendorId: 0x0483,
    productId: 0x5750,
    buttonCode: 0x80
  },
  exportCSV: {
    id: 9,
    name: 'Button 9',
    description: 'Export CSV',
    vendorId: 0x0483,
    productId: 0x5750,
    buttonCode: 0x100
  },
  toggleCamera: {
    id: 10,
    name: 'Button 10',
    description: 'Toggle Camera',
    vendorId: 0x0483,
    productId: 0x5750,
    buttonCode: 0x200
  },
  toggleMap: {
    id: 11,
    name: 'Button 11',
    description: 'Toggle Map',
    vendorId: 0x0483,
    productId: 0x5750,
    buttonCode: 0x400
  },
  toggleLogs: {
    id: 12,
    name: 'Button 12',
    description: 'Toggle Logs',
    vendorId: 0x0483,
    productId: 0x5750,
    buttonCode: 0x800
  },
  toggleSettings: {
    id: 13,
    name: 'Button 13',
    description: 'Toggle Settings',
    vendorId: 0x0483,
    productId: 0x5750,
    buttonCode: 0x1000
  },
  emergencyStop: {
    id: 14,
    name: 'Button 14',
    description: 'Emergency Stop',
    vendorId: 0x0483,
    productId: 0x5750,
    buttonCode: 0x2000
  },
  confirmAction: {
    id: 15,
    name: 'Button 15',
    description: 'Confirm Action',
    vendorId: 0x0483,
    productId: 0x5750,
    buttonCode: 0x4000
  }
};

interface RemoteStore {
  mapping: RemoteMapping;
  device: any | null;
  setMapping: (mapping: RemoteMapping) => void;
  updateButton: (action: keyof RemoteMapping, button: RemoteButton) => void;
  connected: boolean;
  setConnected: (connected: boolean) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  handleInput: (data: DataView) => void;
}

export const useRemoteStore = create<RemoteStore>((set, get) => ({
  mapping: defaultMapping,
  device: null,
  setMapping: (mapping) => set({ mapping }),
  updateButton: (action, button) =>
    set((state) => ({
      mapping: {
        ...state.mapping,
        [action]: button,
      },
    })),
  connected: false,
  setConnected: (connected) => set({ connected }),
  connect: async () => {
    try {
      const nav = navigator as any;
      if (!nav.hid) {
        throw new Error('WebHID API not supported in this browser');
      }

      const pairedDevices = await nav.hid.getDevices();
      
      if (pairedDevices.length > 0) {
        const device = pairedDevices[0];
        await device.open();
        
        device.addEventListener('inputreport', (event: any) => {
          get().handleInput(event.data);
        });

        set({ device, connected: true });
        return;
      }

      const filters = [
        { vendorId: 0x0483 },
        { vendorId: 0x0483, productId: 0x5750 },
        { vendorId: 0x0483, productId: 0x5740 },
        { vendorId: 0x0483, usagePage: 0x01 }
      ];
      
      const devices = await nav.hid.requestDevice({ filters });

      if (devices.length > 0) {
        const device = devices[0];
        await device.open();
        
        device.addEventListener('inputreport', (event: any) => {
          get().handleInput(event.data);
        });

        set({ device, connected: true });
      } else {
        throw new Error('No device selected. Please make sure your remote is connected and select it from the list when prompted.');
      }
    } catch (error: unknown) {
      set({ device: null, connected: false });
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to connect remote: ${message}`);
    }
  },
  disconnect: async () => {
    const { device } = get();
    if (device) {
      await device.close();
      set({ device: null, connected: false });
    }
  },
  handleInput: (data: DataView) => {
    const { mapping } = get();
    const buttonCode = data.getUint8(0);
    
    Object.entries(mapping).forEach(([action, button]: [string, unknown]) => {
      const btn = button as RemoteButton;
      if (btn.buttonCode === buttonCode) {
        switch (action) {
          case 'addPOI':
            break;
          case 'capture':
            useCameraStore.getState().setCapturedImage(null);
            break;
          case 'startStopMeasure':
            useSerialStore.getState();
            break;
          case 'clearAlert':
            soundManager.stopSound('warning');
            soundManager.stopSound('critical');
            break;
          case 'toggleOverlays':
            const { overlayOptions, setOverlayOptions } = useCameraStore.getState();
            setOverlayOptions({ ...overlayOptions, enabled: !overlayOptions.enabled });
            break;
        }
      }
    });
  }
}));