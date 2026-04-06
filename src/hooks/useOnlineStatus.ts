import { useState, useEffect } from 'react';

interface OnlineStatusResult {
  isOnline: boolean;
  wasOnlineAtStart: boolean;
}

export function useOnlineStatus(): OnlineStatusResult {
  // Track if we started online (never changes after mount)
  const [wasOnlineAtStart] = useState(() => navigator.onLine);
  
  // Track current online status (updates with events)
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Clean up
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOnlineAtStart };
}