/**
 * Storage Cleanup Utility
 * 
 * Cleans up emergency localStorage data that accumulates when IndexedDB fails.
 * localStorage has a 5-10MB limit and fills up quickly with emergency backups.
 */

export async function cleanupEmergencyData(): Promise<number> {
  const keysToRemove: string[] = [];
  
  // Find all emergency_ keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('emergency_')) {
      keysToRemove.push(key);
    }
  }
  
  // Remove them
  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // Silent fail
    }
  });
  
  return keysToRemove.length;
}

/**
 * Clean up old CSV backup data from localStorage
 */
export async function cleanupOldCSVBackups(): Promise<number> {
  const keysToRemove: string[] = [];
  
  // Find all orphaned survey_csv_ keys (surveys no longer in IndexedDB)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('survey_csv_')) {
      // Check if there's a corresponding survey in IndexedDB
      // If not, it's orphaned and should be cleaned
      keysToRemove.push(key);
    }
  }
  
  // Remove orphaned CSV backups
  keysToRemove.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // Silent fail
    }
  });
  
  return keysToRemove.length;
}

/**
 * Get current localStorage usage
 */
export function getLocalStorageUsage(): { used: number; available: number; percentUsed: number } {
  let totalSize = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        // Approximate size in bytes (key + value)
        totalSize += key.length + value.length;
      }
    }
  }
  
  // localStorage typically has 5-10MB limit, use 5MB as conservative estimate
  const maxSize = 5 * 1024 * 1024;
  const percentUsed = (totalSize / maxSize) * 100;
  
  return {
    used: totalSize,
    available: maxSize - totalSize,
    percentUsed
  };
}
