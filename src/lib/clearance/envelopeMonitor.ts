import { useSerialStore } from '../stores/serialStore';
import { useGPSStore } from '../stores/gpsStore';
import { useDetectionStore } from '../stores/detectionStore';
import { useEnvelopeStore } from '../../stores/envelopeStore';
import { soundManager } from '../sounds';
import { saveMeasurement } from '@/lib/storage/measurement-storage';
import type { ClearanceStatus } from '../../../shared/schema';
import type { MeasurementRecord } from '@/types/measurements';

/**
 * Envelope Clearance Monitoring Service
 * Monitors laser measurements against vehicle envelope profiles
 * and triggers alerts when clearances are violated
 */

interface ClearanceCalculation {
  status: ClearanceStatus;
  measurement: number; // in meters
  envelope: number; // vehicle height + threshold in meters
  clearance: number; // measurement - envelope (deficit if negative)
  deficit: number; // how much under safe clearance (positive = violation)
}

class EnvelopeMonitor {
  private isInitialized = false;
  private lastAlertStatus: ClearanceStatus = 'safe';
  private lastMeasurement: string | null = null;
  private alertSoundPlaying: 'warning' | 'critical' | null = null;

  /**
   * Initialize the envelope monitoring system
   * Sets up subscriptions to measurement and settings changes
   */
  initialize() {
    if (this.isInitialized) {
      return;
    }

    // Subscribe to serial store for laser measurements
    useSerialStore.subscribe((state, prevState) => {
      const envelopeStore = useEnvelopeStore.getState();
      
      // Only monitor if enabled
      if (!envelopeStore.settings.enabled) {
        this.stopAllAlerts();
        return;
      }

      // Check if measurement changed
      if (state.lastMeasurement !== prevState.lastMeasurement) {
        this.handleMeasurementUpdate(state.lastMeasurement);
      }
    });

    // Subscribe to envelope store for settings changes
    useEnvelopeStore.subscribe((state, prevState) => {
      // If just enabled, start monitoring
      if (state.settings.enabled && !prevState.settings.enabled) {
        state.startMonitoring();
      }
      
      // If just disabled, stop all alerts
      if (!state.settings.enabled && prevState.settings.enabled) {
        this.stopAllAlerts();
        state.stopMonitoring();
      }

      // If thresholds changed, re-evaluate current measurement
      if (
        state.settings.warningThreshold !== prevState.settings.warningThreshold ||
        state.settings.criticalThreshold !== prevState.settings.criticalThreshold ||
        state.settings.activeProfileId !== prevState.settings.activeProfileId
      ) {
        const serialState = useSerialStore.getState();
        this.handleMeasurementUpdate(serialState.lastMeasurement);
      }
    });

    this.isInitialized = true;
  }

  /**
   * Handle laser measurement updates
   */
  private handleMeasurementUpdate(measurementStr: string) {
    if (measurementStr === '--' || measurementStr === this.lastMeasurement) {
      return;
    }

    this.lastMeasurement = measurementStr;
    const envelopeStore = useEnvelopeStore.getState();

    if (!envelopeStore.settings.enabled || !envelopeStore.isMonitoring) {
      return;
    }

    const calculation = this.calculateClearance(measurementStr);
    
    if (!calculation) {
      return;
    }

    // Handle status changes and alerts
    if (calculation.status !== this.lastAlertStatus) {
      this.handleStatusChange(calculation);
    }

    // Log violations
    if (calculation.status !== 'safe') {
      this.checkAndLogViolation(calculation);
    }
  }

  /**
   * Calculate clearance status based on measurement and envelope profile
   */
  private calculateClearance(measurementStr: string): ClearanceCalculation | null {
    const envelopeStore = useEnvelopeStore.getState();
    const activeProfile = envelopeStore.getActiveProfile();

    if (!activeProfile) {
      return null;
    }

    // Parse measurement (assumed to be in meters)
    const measurement = parseFloat(measurementStr);
    if (isNaN(measurement)) {
      return null;
    }

    // Convert profile height to meters if needed
    let vehicleHeight = activeProfile.height;
    if (activeProfile.heightUnit === 'feet') {
      vehicleHeight = vehicleHeight * 0.3048; // feet to meters
    }

    const { warningThreshold, criticalThreshold } = envelopeStore.settings;

    // Clearance is measurement minus vehicle height
    const clearance = measurement - vehicleHeight;
    
    // Determine status
    let status: ClearanceStatus;
    let deficit: number;

    if (clearance >= warningThreshold) {
      // Safe: measurement is at or above vehicle height + warning threshold
      status = 'safe';
      deficit = 0;
    } else if (clearance >= criticalThreshold) {
      // Warning: clearance is between critical and warning thresholds
      status = 'warning';
      deficit = warningThreshold - clearance;
    } else {
      // Critical: clearance is below critical threshold
      status = 'critical';
      deficit = criticalThreshold - clearance;
    }

    return {
      status,
      measurement,
      envelope: vehicleHeight,
      clearance,
      deficit
    };
  }

  /**
   * Handle clearance status changes (safe -> warning -> critical)
   */
  private handleStatusChange(calculation: ClearanceCalculation) {
    const envelopeStore = useEnvelopeStore.getState();
    const { status } = calculation;

    // Stop previous alerts
    this.stopAllAlerts();

    // Play appropriate alert based on new status
    if (envelopeStore.settings.audioEnabled) {
      if (status === 'warning') {
        soundManager.playWarning();
        this.alertSoundPlaying = 'warning';
      } else if (status === 'critical') {
        soundManager.playCritical();
        this.alertSoundPlaying = 'critical';
      }
    }

    // Dispatch custom event for UI updates (e.g., camera overlay)
    window.dispatchEvent(new CustomEvent('envelope-status-change', { 
      detail: { 
        status,
        calculation
      } 
    }));

    this.lastAlertStatus = status;
  }

  /**
   * Check if violation should be logged and log it
   */
  private async checkAndLogViolation(calculation: ClearanceCalculation) {
    const envelopeStore = useEnvelopeStore.getState();
    const gpsStore = useGPSStore.getState();
    const detectionStore = useDetectionStore.getState();
    const activeProfile = envelopeStore.getActiveProfile();

    if (!activeProfile) return;

    // Don't spam logs - only log new violations or significant changes
    const recentViolations = envelopeStore.violations
      .filter(v => {
        const violationTime = new Date(v.timestamp).getTime();
        const now = Date.now();
        return now - violationTime < 5000; // Within last 5 seconds
      });

    // If we already logged a similar violation recently, skip
    if (recentViolations.length > 0 && recentViolations[0].severity === calculation.status) {
      return;
    }

    // Get GPS data
    const gpsData = gpsStore.data;
    
    // Get AI detection data if available
    const currentDetection = detectionStore.pendingDetection || detectionStore.activeDetections[0];

    // Log the violation to envelope store
    envelopeStore.logViolation({
      timestamp: new Date().toISOString(),
      profileId: activeProfile.id,
      profileName: activeProfile.name,
      severity: calculation.status === 'critical' ? 'critical' : 'warning',
      measurement: calculation.measurement,
      envelope: calculation.envelope,
      deficit: calculation.deficit,
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      altitude: gpsData.altitude || undefined,
      speed: gpsData.speed || undefined,
      heading: gpsData.course || undefined,
      objectType: currentDetection?.objectClass || undefined,
      confidence: currentDetection?.confidence || undefined,
      notes: `Clearance violation detected: ${calculation.status.toUpperCase()}`,
      laser: 'main'
    });

    // Also log to main measurement log for unified tracking
    const measurementRecord: MeasurementRecord = {
      id: `envelope-violation-${Date.now()}`,
      timestamp: Date.now(),
      location: {
        lat: gpsData.latitude,
        lon: gpsData.longitude
      },
      structureType: 'envelope_clearance_violation',
      verticalClearance: {
        camera: null,
        laser: {
          value: calculation.measurement
        },
        validated: null
      },
      horizontalMeasurements: {
        widths: [],
        spacings: []
      },
      tensorflowDetections: currentDetection ? [currentDetection] : [],
      calibrationUsed: {
        focalLength: null,
        reprojectionError: null,
        calibrationDate: null
      },
      originalImage: '',
      annotatedImage: '',
      notes: `ENVELOPE CLEARANCE ${calculation.status.toUpperCase()} VIOLATION\nProfile: ${activeProfile.name}\nMeasurement: ${calculation.measurement.toFixed(3)}m\nRequired: ${calculation.envelope.toFixed(3)}m\nDeficit: ${Math.abs(calculation.deficit).toFixed(3)}m\nSeverity: ${calculation.status === 'critical' ? 'CRITICAL' : 'WARNING'}`,
      complianceLevel: 'RESTRICTED'
    };

    // Save to measurement log
    await saveMeasurement(measurementRecord);
  }

  /**
   * Stop all active alert sounds
   */
  private stopAllAlerts() {
    if (this.alertSoundPlaying) {
      if (this.alertSoundPlaying === 'warning') {
        soundManager.stopSound('warning');
      } else if (this.alertSoundPlaying === 'critical') {
        soundManager.stopSound('critical');
      }
      this.alertSoundPlaying = null;
    }
  }

  /**
   * Get current clearance status for UI display
   */
  getCurrentStatus(): ClearanceCalculation | null {
    const serialStore = useSerialStore.getState();
    const measurementStr = serialStore.lastMeasurement;
    
    if (measurementStr === '--') {
      return null;
    }

    return this.calculateClearance(measurementStr);
  }

  /**
   * Manually trigger a test violation
   */
  testViolation(severity: 'warning' | 'critical') {
    const mockCalculation: ClearanceCalculation = {
      status: severity,
      measurement: severity === 'warning' ? 4.3 : 3.8,
      envelope: 4.2,
      clearance: severity === 'warning' ? 0.1 : -0.4,
      deficit: severity === 'warning' ? 0.4 : 0.6
    };

    this.handleStatusChange(mockCalculation);
    this.checkAndLogViolation(mockCalculation);
  }

  /**
   * Cleanup and reset
   */
  reset() {
    this.stopAllAlerts();
    this.lastAlertStatus = 'safe';
    this.lastMeasurement = null;
  }
}

// Singleton instance
export const envelopeMonitor = new EnvelopeMonitor();

// Auto-initialize when imported
if (typeof window !== 'undefined') {
  // Initialize after a short delay to ensure stores are ready
  setTimeout(() => {
    envelopeMonitor.initialize();
  }, 100);
}
