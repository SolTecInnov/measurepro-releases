import L from 'leaflet';

declare global {
  interface Window {
    L: typeof L;
  }
}

(window as any).L = L;

let routingMachineLoaded = false;
let loadingPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

function loadStylesheet(href: string): Promise<void> {
  return new Promise((resolve) => {
    if (document.querySelector(`link[href="${href}"]`)) {
      resolve();
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve();
    link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

function waitForRoutingControl(maxWait = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if ((window as any).L?.Routing?.control) {
        resolve();
      } else if (Date.now() - start > maxWait) {
        reject(new Error('Leaflet Routing Machine failed to initialize'));
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

export async function loadLeafletRoutingMachine(): Promise<void> {
  if (routingMachineLoaded) {
    return;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      // Verify Leaflet is available (bundled with app)
      if (!L || typeof L !== 'object') {
        throw new Error('Leaflet not loaded - module import failed');
      }

      // In Electron production, absolute paths like /vendor/ resolve to file:///C:/vendor/
      // Use relative path from the loaded HTML (index.html is in dist/)
      const base = (window as any).electronAPI?.isElectron ? './vendor/lrm' : '/vendor/lrm';

      await Promise.all([
        loadScript(`${base}/leaflet-routing-machine.min.js`),
        loadStylesheet(`${base}/leaflet-routing-machine.css`)
      ]);

      await waitForRoutingControl();

      routingMachineLoaded = true;
    } catch (error) {
      loadingPromise = null;
      throw error;
    }
  })();

  return loadingPromise;
}

export function isRoutingMachineLoaded(): boolean {
  return routingMachineLoaded;
}

export { L };
