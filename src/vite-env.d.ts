/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Add global garbage collector interface for debugging
interface Window {
  gc?: () => void;
  cv?: any;
}

declare const __BUILD_TIMESTAMP__: string;
declare const __BUILD_TIME__: number;