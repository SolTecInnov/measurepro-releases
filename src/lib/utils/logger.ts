// Production-optimized logger - minimal console output by default
// All logging disabled by default. Enable with: localStorage.setItem('measurepro_verbose_logging', 'true')

// Cache verbose logging flag — only read localStorage once, then listen for changes
// This prevents 1000+ localStorage reads/sec in hot paths
let _verbose: boolean = false;
try { _verbose = localStorage.getItem('measurepro_verbose_logging') === 'true'; } catch {}

// Allow toggling at runtime without full reload
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'measurepro_verbose_logging') {
      _verbose = e.newValue === 'true';
    }
  });
}

const getVerboseLogging = (): boolean => _verbose;

export const logger = {
  // Always log errors
  error: (...args: any[]) => {
    console.error(...args);
  },
  
  // Only log warnings if verbose enabled
  warn: (...args: any[]) => {
    if (getVerboseLogging()) {
      console.warn(...args);
    }
  },
  
  // Only log info if verbose enabled
  log: (...args: any[]) => {
    if (getVerboseLogging()) {
      console.log(...args);
    }
  },
  
  // Only log debug if verbose enabled (never in production)
  debug: (...args: any[]) => {
    if (getVerboseLogging()) {
      console.log(...args);
    }
  }
};
