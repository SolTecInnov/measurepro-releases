import { openSurveyDB } from '../survey/db';
import { useCameraStore, TimelapseFrame } from '../camera';
import { toast } from 'sonner';

/**
 * ZERO DATA LOSS ARCHITECTURE:
 * 
 * Frame Status State Machine:
 * - 'pending': Just captured, not yet saved/exported
 * - 'saved': Successfully saved/exported, safe to delete
 * 
 * Auto-Recovery Behavior:
 * - On startup: Auto-load ALL frames with status !== 'saved' into memory
 * - No user prompt needed (automatic recovery)
 * - Only delete frames after successful save/export
 * - Guarantees zero data loss across crashes, refreshes, tab closes
 */

/**
 * Auto-recover timelapse frames from IndexedDB on app startup
 * Loads ALL non-saved frames automatically - no user prompt needed
 */
export async function checkForOrphanedFrames(): Promise<void> {
  try {
    const db = await openSurveyDB();
    
    // Defensive check: Ensure frames store exists (migration safety)
    if (!db.objectStoreNames.contains('frames')) {
      // Store doesn't exist yet - database needs upgrade
      // This can happen on old installations before v8
      return; // Silent return - no frames to recover
    }
    
    const allFrames = await db.getAll('frames');
    
    // Auto-load ALL frames that haven't been saved/exported yet
    // Status-based filtering: only skip frames marked as 'saved'
    const unsavedFrames = allFrames.filter((frame: any) => frame.status !== 'saved');
    
    if (!unsavedFrames || unsavedFrames.length === 0) {
      // No unsaved frames, nothing to recover
      return;
    }
    
    // Sort frames by timestamp to maintain order
    const sortedFrames = unsavedFrames.sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
    
    // AUTO-LOAD frames into memory (no user prompt)
    // Use synchronous state access to avoid Zustand async issues
    const store = useCameraStore.getState();
    
    // Clear existing frames first
    store.clearTimelapseFrames();
    
    // Re-number frames synchronously before adding to store
    const rehydratedFrames = sortedFrames.map((frame, index) => ({
      ...frame,
      frameNumber: index,
    }));
    
    // Add all frames with correct numbering
    for (const frame of rehydratedFrames) {
      store.addTimelapseFrame(frame);
    }
    
    // Show informational toast (not a decision prompt)
    /* toast removed */
    
  } catch (error) {
    console.error('Failed to auto-recover timelapse frames:', error);
    // Don't show error to user - frames remain safely in IndexedDB for next startup attempt
  }
}


/**
 * Clear all orphaned frames from IndexedDB
 * @param silent - If true, don't show success/error toasts
 * Export this for manual clearing from settings UI if needed
 */
export async function clearOrphanedFrames(silent: boolean = false): Promise<void> {
  try {
    const db = await openSurveyDB();
    const orphanedFrames = await db.getAll('frames');
    
    // Delete each frame
    for (const frame of orphanedFrames) {
      await db.delete('frames', frame.id);
    }
    
    // Only show toast if not silent (e.g., after successful restore)
    if (!silent) {
      /* toast removed */
    }
    
  } catch (error) {
    console.error('Failed to clear orphaned frames:', error);
    if (!silent) {
      toast.error('Failed to clear orphaned frames', {
        description: 'Please try again or contact support if the issue persists.',
      });
    }
  }
}

/**
 * Clear frames from IndexedDB after successful timelapse save/export
 * Call this after the user saves or exports their timelapse
 * 
 * State machine: pending → saved → deleted
 */
export async function clearFramesAfterSave(): Promise<void> {
  try {
    const db = await openSurveyDB();
    const frames = await db.getAll('frames');
    
    // Mark all frames as 'saved' first (state machine transition)
    for (const frame of frames) {
      await db.put('frames', { 
        ...frame, 
        status: 'saved',
        savedAt: new Date().toISOString()
      });
    }
    
    // Then delete all saved frames
    for (const frame of frames) {
      await db.delete('frames', frame.id);
    }
    
  } catch (error) {
    console.error('Failed to clear frames after save:', error);
    // Don't show error to user - this is a cleanup operation
  }
}
