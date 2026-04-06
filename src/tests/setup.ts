import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

// Mock HTMLElement dimensions for @tanstack/react-virtual
beforeAll(() => {
  // Mock getBoundingClientRect to provide non-zero dimensions
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function() {
    const original = originalGetBoundingClientRect.call(this);
    return {
      ...original,
      width: this.offsetWidth || 1000,
      height: this.offsetHeight || 600,
      top: 0,
      left: 0,
      right: this.offsetWidth || 1000,
      bottom: this.offsetHeight || 600,
    };
  };

  // Mock scrollHeight and offsetHeight for virtualizer parent containers
  Object.defineProperties(HTMLElement.prototype, {
    scrollHeight: {
      configurable: true,
      get: function() {
        return this._scrollHeight || 600;
      },
      set: function(val) {
        this._scrollHeight = val;
      }
    },
    offsetHeight: {
      configurable: true,
      get: function() {
        return this._offsetHeight || 600;
      },
      set: function(val) {
        this._offsetHeight = val;
      }
    },
    offsetWidth: {
      configurable: true,
      get: function() {
        return this._offsetWidth || 1000;
      },
      set: function(val) {
        this._offsetWidth = val;
      }
    },
  });
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock IndexedDB
const indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
  databases: vi.fn(),
};
global.indexedDB = indexedDB as any;

// Mock Web Serial API
Object.defineProperty(global.navigator, 'serial', {
  value: {
    requestPort: vi.fn(),
    getPorts: vi.fn().mockResolvedValue([]),
  },
  writable: true,
});

// Mock Geolocation API
Object.defineProperty(global.navigator, 'geolocation', {
  value: {
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
  writable: true,
});

// Mock MediaDevices API
Object.defineProperty(global.navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn(),
    enumerateDevices: vi.fn().mockResolvedValue([]),
    getDisplayMedia: vi.fn(),
    getSupportedConstraints: vi.fn(),
  },
  writable: true,
});

// Mock Web Audio API
global.AudioContext = vi.fn().mockImplementation(() => ({
  createOscillator: vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: { value: 0 },
  })),
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    gain: { value: 0 },
  })),
  destination: {},
  currentTime: 0,
})) as any;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
global.localStorage = localStorageMock as any;

// Mock Firebase
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  sendEmailVerification: vi.fn(),
  onAuthStateChanged: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
}));

// Mock Firebase Cloud Functions
vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn((functions, name) => {
    return vi.fn((data) => {
      return Promise.resolve({
        data: { success: true, message: `Mock ${name} called` }
      });
    });
  }),
}));

// Mock Sonner Toast Library
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    promise: vi.fn(),
  },
  Toaster: () => null,
}));

// Mock DOM APIs needed for export functionality
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock document.createElement for download links
const originalCreateElement = document.createElement.bind(document);
document.createElement = vi.fn((tagName: string) => {
  const element = originalCreateElement(tagName);
  if (tagName === 'a') {
    // Mock click method for download links
    element.click = vi.fn();
  }
  return element;
}) as any;
