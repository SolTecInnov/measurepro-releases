// Production-optimized logger - minimal console output by default
// All logging disabled by default. Enable with: localStorage.setItem('measurepro_verbose_logging', 'true')

// Helper to safely check localStorage (handles SSR/initial render)
const getVerboseLogging = (): boolean => {
  try {
    return localStorage.getItem('measurepro_verbose_logging') === 'true';
  } catch {
    return false;
  }
};

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
