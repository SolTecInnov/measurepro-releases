/**
 * Live Broadcast Integration
 * 
 * Connects MeasurementFeed to Live Monitor broadcasting.
 * Subscribes to measurement updates and queues them for broadcast
 * when live sharing is enabled.
 */

import { getMeasurementFeed } from '../survey/MeasurementFeed';
import { queueMeasurementsForBroadcast, isBroadcastEnabled } from './liveMonitorService';
import { useSettingsStore } from '../settings';
import { logger } from '../utils/logger';

let isIntegrationActive = false;
let unsubscribe: (() => void) | null = null;

/**
 * Initialize the live broadcast integration
 * This subscribes to MeasurementFeed and queues measurements when sharing is enabled
 */
export function initLiveBroadcastIntegration(): void {
  if (isIntegrationActive) {
    logger.debug('[LiveBroadcast] Integration already active');
    return;
  }

  const feed = getMeasurementFeed();
  
  unsubscribe = feed.subscribe(() => {
    // Check if broadcasting is enabled before queuing
    if (!isBroadcastEnabled()) {
      return;
    }

    // Get latest measurements from feed
    const measurements = feed.getMeasurementsWithLimit(50);
    
    if (measurements.length > 0) {
      queueMeasurementsForBroadcast(measurements);
    }
  });

  isIntegrationActive = true;
  logger.log('[LiveBroadcast] Integration initialized');
}

/**
 * Stop the live broadcast integration
 */
export function stopLiveBroadcastIntegration(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  isIntegrationActive = false;
  logger.log('[LiveBroadcast] Integration stopped');
}

/**
 * Check if integration is active
 */
export function isLiveBroadcastIntegrationActive(): boolean {
  return isIntegrationActive;
}

/**
 * Auto-start broadcasting when a survey starts (if setting enabled)
 */
export async function handleSurveyStart(surveyId: string, surveyTitle: string): Promise<void> {
  const settings = useSettingsStore.getState().liveSharingSettings;
  
  if (!settings.enabled || !settings.autoStartWithSurvey) {
    return;
  }

  // Import dynamically to avoid circular deps
  const { enableLiveBroadcast, setSyncInterval } = await import('./liveMonitorService');
  
  // Set the configured sync interval
  setSyncInterval(settings.syncIntervalSeconds);
  
  // Start broadcasting
  const success = await enableLiveBroadcast(surveyId, surveyTitle);
  
  if (success) {
    logger.log(`[LiveBroadcast] Auto-started for survey: ${surveyTitle}`);
  }
}

/**
 * Stop broadcasting when survey closes
 */
export async function handleSurveyClose(): Promise<void> {
  const { disableLiveBroadcast } = await import('./liveMonitorService');
  await disableLiveBroadcast();
  logger.log('[LiveBroadcast] Stopped on survey close');
}
