/**
 * Electron Serial Polyfill
 *
 * Bridges Electron's IPC-based serial port access (via the `serialport` npm
 * package running in the main process) to the Web Serial API surface that the
 * renderer code already expects (`navigator.serial`).
 *
 * Activated once at startup from main.tsx — no other files need to change.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const api = () => window.electronAPI?.serial;

// ---------------------------------------------------------------------------
// ElectronSerialPort – implements the subset of the Web Serial API's
// SerialPort interface that MeasurePro actually uses.
// ---------------------------------------------------------------------------

class ElectronSerialPort implements SerialPort {
  readonly portPath: string;
  private _readable: ReadableStream<Uint8Array> | null = null;
  private _writable: WritableStream<Uint8Array> | null = null;
  private _readableController: ReadableStreamDefaultController<Uint8Array> | null = null;
  private _dataHandler: ((portPath: string, data: number[]) => void) | null = null;
  private _opened = false;

  constructor(portPath: string) {
    this.portPath = portPath;
  }

  // -- Web Serial API surface ------------------------------------------------

  get readable(): ReadableStream<Uint8Array> | null {
    return this._readable;
  }

  get writable(): WritableStream<Uint8Array> | null {
    return this._writable;
  }

  async open(options: SerialOptions): Promise<void> {
    const serial = api();
    if (!serial) throw new Error('Electron serial API not available');

    await serial.open(this.portPath, {
      baudRate: options.baudRate,
      dataBits: options.dataBits,
      stopBits: options.stopBits,
      parity: options.parity,
    });

    this._opened = true;

    // Build ReadableStream – data is pushed from the main process via IPC
    this._readable = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this._readableController = controller;
        this._dataHandler = (portPath: string, data: Uint8Array | number[]) => {
          if (portPath === this.portPath) {
            try {
              // Fast path: data arrives as Uint8Array from structured clone IPC
              controller.enqueue(data instanceof Uint8Array ? data : new Uint8Array(data));
            } catch {
              // Stream may have been closed
            }
          }
        };
        serial.onData(this._dataHandler);
      },
      cancel: () => {
        this._readableController = null;
      },
    });

    // Build WritableStream
    this._writable = new WritableStream<Uint8Array>({
      write: async (chunk) => {
        await serial.write(this.portPath, chunk);
      },
    });
  }

  async close(): Promise<void> {
    const serial = api();
    if (!serial) return;

    try {
      this._readableController?.close();
    } catch {
      // Already closed
    }
    this._readableController = null;
    this._readable = null;
    this._writable = null;
    this._opened = false;

    await serial.close(this.portPath);
  }

  getInfo(): SerialPortInfo {
    // Return cached VID/PID set during getPorts() for fingerprint matching
    return {
      usbVendorId: (this as any)._vendorId  ?? 0,
      usbProductId: (this as any)._productId ?? 0,
    };
  }

  // Fetch info asynchronously (bonus helper, not part of spec)
  async getInfoAsync(): Promise<SerialPortInfo> {
    const serial = api();
    if (!serial) return { usbVendorId: 0, usbProductId: 0 };
    return serial.getInfo(this.portPath);
  }

  // Required by the SerialPort interface but unused in this app
  readonly connected = true;
  ondisconnect: ((this: SerialPort, ev: Event) => void) | null = null;
  onconnect: ((this: SerialPort, ev: Event) => void) | null = null;
  forget(): Promise<void> { return Promise.resolve(); }
  addEventListener(..._args: any[]): void { /* noop */ }
  removeEventListener(..._args: any[]): void { /* noop */ }
  dispatchEvent(_event: Event): boolean { return false; }
}

// ---------------------------------------------------------------------------
// ElectronSerial – implements navigator.serial
// ---------------------------------------------------------------------------

const knownPorts = new Map<string, ElectronSerialPort>();

const electronSerial: Serial = {
  async getPorts(): Promise<SerialPort[]> {
    // BUGFIX: In Electron, knownPorts is empty on fresh launch.
    // Call serial:list to get ALL available ports and register them.
    // This is what enables auto-reconnect on startup.
    const serial = api();
    if (serial?.list) {
      try {
        const listed = await serial.list();
        for (const info of listed) {
          if (!knownPorts.has(info.path)) {
            const port = new ElectronSerialPort(info.path);
            // Store VID/PID on the port so fingerprint matching works
            (port as any)._vendorId  = info.vendorId  ? parseInt(info.vendorId,  16) : undefined;
            (port as any)._productId = info.productId ? parseInt(info.productId, 16) : undefined;
            knownPorts.set(info.path, port);
          }
        }
      } catch(e) {
        console.warn('[SerialPolyfill] getPorts list failed:', e);
      }
    }
    return Array.from(knownPorts.values());
  },

  async requestPort(options?: SerialPortRequestOptions): Promise<SerialPort> {
    const serial = api();
    if (!serial) throw new DOMException('Electron serial API not available', 'NotFoundError');

    const filters = options?.filters?.map(f => ({
      usbVendorId: f.usbVendorId,
      usbProductId: f.usbProductId,
    }));

    const chosen = await serial.requestPort(filters);

    let port = knownPorts.get(chosen.path);
    if (!port) {
      port = new ElectronSerialPort(chosen.path);
      // Cache VID/PID from the chosen port info
      (port as any)._vendorId  = chosen.vendorId  ? parseInt(chosen.vendorId,  16) : undefined;
      (port as any)._productId = chosen.productId ? parseInt(chosen.productId, 16) : undefined;
      knownPorts.set(chosen.path, port);
    }
    return port;
  },

  // Event stubs required by the Serial interface
  onconnect: null,
  ondisconnect: null,
  addEventListener(..._args: any[]): void { /* noop */ },
  removeEventListener(..._args: any[]): void { /* noop */ },
  dispatchEvent(_event: Event): boolean { return false; },
};

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function activateSerialPolyfill(): void {
  if (!window.electronAPI?.isElectron) return;

  // Always override navigator.serial in Electron — the native Web Serial API
  // (Chromium's implementation) does NOT have access to COM ports in Electron
  // without special session permissions. Our IPC bridge via serialport npm
  // package is the correct path and must always win.
  Object.defineProperty(navigator, 'serial', {
    value: electronSerial,
    writable: false,
    configurable: true,
  });

  console.log('[SerialPolyfill] Electron serial bridge activated');
}
