import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { PerformanceWarning } from './usePerformanceMonitor';

export const usePerformanceWarnings = (warnings: PerformanceWarning[], enabled: boolean) => {
  const lastWarningTime = useRef<{ [key: string]: number }>({});
  
  useEffect(() => {
    if (!enabled) return;
    
    const now = Date.now();
    
    warnings.forEach((warning) => {
      const warningKey = `${warning.type}-${warning.severity}`;
      const lastShown = lastWarningTime.current[warningKey] || 0;
      
      // Only show each warning type once every 30 seconds (avoid spam)
      if (now - lastShown < 30000) {
        return;
      }
      
      // Only show critical warnings as errors
      if (warning.severity === 'critical') {
        toast.error(warning.message, {
          description: warning.recommendation,
          duration: 10000,
          id: warningKey
        });
        lastWarningTime.current[warningKey] = now;
      }
    });
    
    // Clear old warnings from tracking
    Object.keys(lastWarningTime.current).forEach((key) => {
      if (now - lastWarningTime.current[key] > 60000) {
        delete lastWarningTime.current[key];
      }
    });
  }, [warnings, enabled]);
};
