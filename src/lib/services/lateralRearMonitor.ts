import { useMultiLaserStore, LateralMeasurement, RearMeasurement } from '../stores/multiLaserStore';
import { useSettingsStore } from '../settings';
import { soundManager } from '../sounds';

export type AlertLevel = 'none' | 'warning' | 'critical';

export interface LateralAlertState {
  leftAlert: AlertLevel;
  rightAlert: AlertLevel;
  totalAlert: AlertLevel;
  leftClearanceWithVehicle: number | null;
  rightClearanceWithVehicle: number | null;
  totalWidth: number | null;
}

export interface RearAlertState {
  alert: AlertLevel;
  currentDistance: number | null;
  belowThreshold: boolean;
}

export interface LateralRearMonitorCallbacks {
  onLateralAlert?: (state: LateralAlertState) => void;
  onRearAlert?: (state: RearAlertState) => void;
  onAutoCaptureLateral?: (side: 'left' | 'right' | 'total', measurement: LateralMeasurement) => void;
  onAutoCaptureRear?: (measurement: RearMeasurement) => void;
}

class LateralRearMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private lastLateralAlertState: LateralAlertState = {
    leftAlert: 'none',
    rightAlert: 'none',
    totalAlert: 'none',
    leftClearanceWithVehicle: null,
    rightClearanceWithVehicle: null,
    totalWidth: null
  };
  private lastRearAlertState: RearAlertState = {
    alert: 'none',
    currentDistance: null,
    belowThreshold: false
  };
  private callbacks: LateralRearMonitorCallbacks = {};
  private lastAlertSoundTime: Record<string, number> = {};
  private alertCooldownMs = 2000;

  start(callbacks: LateralRearMonitorCallbacks) {
    this.callbacks = callbacks;
    if (this.intervalId) return;
    
    this.intervalId = setInterval(() => {
      this.checkAlerts();
    }, 100);
    
    console.log('[LateralRearMonitor] Started monitoring');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[LateralRearMonitor] Stopped monitoring');
  }

  private checkAlerts() {
    this.checkLateralAlerts();
    this.checkRearAlerts();
  }

  private checkLateralAlerts() {
    const multiLaserState = useMultiLaserStore.getState();
    const settings = useSettingsStore.getState().lateralLaserSettings;
    
    if (settings.mode === 'off' || !settings.alertEnabled) {
      return;
    }

    const leftMeasurement = multiLaserState.getLeftClearance();
    const rightMeasurement = multiLaserState.getRightClearance();
    const totalWidth = multiLaserState.getTotalWidth();

    const newState: LateralAlertState = {
      leftAlert: 'none',
      rightAlert: 'none',
      totalAlert: 'none',
      leftClearanceWithVehicle: leftMeasurement?.clearanceWithVehicle ?? null,
      rightClearanceWithVehicle: rightMeasurement?.clearanceWithVehicle ?? null,
      totalWidth
    };

    if (leftMeasurement && leftMeasurement.clearanceWithVehicle < settings.alertThresholdLeft) {
      newState.leftAlert = leftMeasurement.clearanceWithVehicle < settings.alertThresholdLeft * 0.5 ? 'critical' : 'warning';
    }

    if (rightMeasurement && rightMeasurement.clearanceWithVehicle < settings.alertThresholdRight) {
      newState.rightAlert = rightMeasurement.clearanceWithVehicle < settings.alertThresholdRight * 0.5 ? 'critical' : 'warning';
    }

    if (totalWidth !== null && totalWidth > settings.alertThresholdTotal) {
      const excess = totalWidth - settings.alertThresholdTotal;
      newState.totalAlert = excess > 0.5 ? 'critical' : 'warning';
    }

    const alertChanged = (
      newState.leftAlert !== this.lastLateralAlertState.leftAlert ||
      newState.rightAlert !== this.lastLateralAlertState.rightAlert ||
      newState.totalAlert !== this.lastLateralAlertState.totalAlert
    );

    if (alertChanged) {
      this.handleLateralAlertChange(newState, leftMeasurement, rightMeasurement);
    }

    this.lastLateralAlertState = newState;
    this.callbacks.onLateralAlert?.(newState);
  }

  private handleLateralAlertChange(
    newState: LateralAlertState,
    leftMeasurement: LateralMeasurement | null,
    rightMeasurement: LateralMeasurement | null
  ) {
    if (newState.leftAlert !== 'none' && this.lastLateralAlertState.leftAlert === 'none') {
      this.playAlertSound('left', newState.leftAlert);
      if (leftMeasurement) {
        this.callbacks.onAutoCaptureLateral?.('left', leftMeasurement);
      }
    }

    if (newState.rightAlert !== 'none' && this.lastLateralAlertState.rightAlert === 'none') {
      this.playAlertSound('right', newState.rightAlert);
      if (rightMeasurement) {
        this.callbacks.onAutoCaptureLateral?.('right', rightMeasurement);
      }
    }

    if (newState.totalAlert !== 'none' && this.lastLateralAlertState.totalAlert === 'none') {
      this.playAlertSound('total', newState.totalAlert);
    }
  }

  private checkRearAlerts() {
    const multiLaserState = useMultiLaserStore.getState();
    const settings = useSettingsStore.getState().rearOverhangSettings;
    
    if (!settings.enabled || !settings.alertEnabled) {
      return;
    }

    const rearMeasurement = multiLaserState.getRearOverhang();
    
    const newState: RearAlertState = {
      alert: 'none',
      currentDistance: rearMeasurement?.distanceMeters ?? null,
      belowThreshold: rearMeasurement?.belowThreshold ?? false
    };

    if (rearMeasurement && rearMeasurement.belowThreshold) {
      const margin = settings.clearanceThresholdMeters - rearMeasurement.distanceMeters;
      newState.alert = margin > 5 ? 'critical' : 'warning';
    }

    const alertChanged = newState.alert !== this.lastRearAlertState.alert;

    if (alertChanged && newState.alert !== 'none' && this.lastRearAlertState.alert === 'none') {
      this.playRearAlertSound(newState.alert);
      if (rearMeasurement) {
        this.callbacks.onAutoCaptureRear?.(rearMeasurement);
      }
    }

    this.lastRearAlertState = newState;
    this.callbacks.onRearAlert?.(newState);
  }

  private playAlertSound(
    side: string,
    level: AlertLevel
  ) {
    const key = `lateral-${side}`;
    const currentTime = Date.now();
    
    if (this.lastAlertSoundTime[key] && currentTime - this.lastAlertSoundTime[key] < this.alertCooldownMs) {
      return;
    }
    
    this.lastAlertSoundTime[key] = currentTime;
    
    try {
      if (level === 'critical') {
        soundManager.playCritical();
      } else {
        soundManager.playWarning();
      }
    } catch (error) {
      console.warn('[LateralRearMonitor] Failed to play sound:', error);
    }
  }

  private playRearAlertSound(level: AlertLevel) {
    const key = 'rear';
    const currentTime = Date.now();
    
    if (this.lastAlertSoundTime[key] && currentTime - this.lastAlertSoundTime[key] < this.alertCooldownMs) {
      return;
    }
    
    this.lastAlertSoundTime[key] = currentTime;
    
    try {
      if (level === 'critical') {
        soundManager.playCritical();
      } else {
        soundManager.playWarning();
      }
    } catch (error) {
      console.warn('[LateralRearMonitor] Failed to play sound:', error);
    }
  }

  getLateralAlertState(): LateralAlertState {
    return this.lastLateralAlertState;
  }

  getRearAlertState(): RearAlertState {
    return this.lastRearAlertState;
  }
}

export const lateralRearMonitor = new LateralRearMonitor();
