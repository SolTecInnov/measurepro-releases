import { useEffect } from 'react';
import { demoRuntime } from '@/lib/demo/demoRuntime';

export function DemoModeProvider() {
  useEffect(() => {
    const isDemoMode = localStorage.getItem('demo_mode') === 'true';
    
    if (isDemoMode && !demoRuntime.isActive) {
      console.log('[DemoModeProvider] Demo mode detected, starting runtime');
      demoRuntime.start();
    }

    const handleBeforeUnload = () => {
      if (demoRuntime.isActive) {
        demoRuntime.stop();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (demoRuntime.isActive) {
        console.log('[DemoModeProvider] Component unmounting, stopping demo');
        demoRuntime.stop();
      }
    };
  }, []);

  return null;
}
