import { useEffect, useCallback } from 'react';
import { useMultiLaserStore } from '../lib/stores/multiLaserStore';
import { useSettingsStore } from '../lib/settings';
import { useSurveyStore } from '../lib/survey';
import { soundManager } from '../lib/sounds';
import { toast } from 'sonner';

import type { CameraPosition } from '../lib/camera';

interface LateralRearCaptureHandlerProps {
  onCapturePOI?: (poiData: {
    type: 'lateralObstruction';
    subType: 'leftLateral' | 'rightLateral' | 'totalWidth' | 'rearOverhang';
    measurement: number | null;
    leftClearance?: number | null;
    rightClearance?: number | null;
    totalWidth?: number | null;
    rearDistance?: number | null;
    timestamp: number;
    cameraPosition: CameraPosition;
  }) => void;
}

export const useLateralRearCaptureHandler = ({ onCapturePOI }: LateralRearCaptureHandlerProps = {}) => {
  const lateralLaserSettings = useSettingsStore(state => state.lateralLaserSettings);
  const rearOverhangSettings = useSettingsStore(state => state.rearOverhangSettings);
  const { activeSurvey } = useSurveyStore();

  const captureLeftLateral = useCallback(() => {
    if (lateralLaserSettings.mode === 'off') {
      // toast suppressed
      return;
    }

    const leftClearance = useMultiLaserStore.getState().getLeftClearance();
    
    if (!leftClearance) {
      toast.error('No left lateral measurement available');
      soundManager.playWarning();
      return;
    }

    const measurement = leftClearance.clearanceWithVehicle ?? leftClearance.clearanceWithoutVehicle;
    
    soundManager.playLogEntry();
    /* toast removed */

    if (onCapturePOI) {
      onCapturePOI({
        type: 'lateralObstruction',
        subType: 'leftLateral',
        measurement,
        leftClearance: measurement,
        timestamp: Date.now(),
        cameraPosition: 'left',
      });
    }

    if (!activeSurvey) {
      console.log('[LateralRear] Independent measurement captured:', { side: 'left', measurement });
    }
  }, [lateralLaserSettings.mode, onCapturePOI, activeSurvey]);

  const captureRightLateral = useCallback(() => {
    if (lateralLaserSettings.mode === 'off') {
      // toast suppressed
      return;
    }

    const rightClearance = useMultiLaserStore.getState().getRightClearance();
    
    if (!rightClearance) {
      toast.error('No right lateral measurement available');
      soundManager.playWarning();
      return;
    }

    const measurement = rightClearance.clearanceWithVehicle ?? rightClearance.clearanceWithoutVehicle;
    
    soundManager.playLogEntry();
    /* toast removed */

    if (onCapturePOI) {
      onCapturePOI({
        type: 'lateralObstruction',
        subType: 'rightLateral',
        measurement,
        rightClearance: measurement,
        timestamp: Date.now(),
        cameraPosition: 'right',
      });
    }

    if (!activeSurvey) {
      console.log('[LateralRear] Independent measurement captured:', { side: 'right', measurement });
    }
  }, [lateralLaserSettings.mode, onCapturePOI, activeSurvey]);

  const captureTotalWidth = useCallback(() => {
    if (lateralLaserSettings.mode === 'off') {
      // toast suppressed
      return;
    }

    const leftClearance = useMultiLaserStore.getState().getLeftClearance();
    const rightClearance = useMultiLaserStore.getState().getRightClearance();
    const totalWidth = useMultiLaserStore.getState().getTotalWidth();
    
    if (totalWidth === null) {
      toast.error('No total width measurement available');
      soundManager.playWarning();
      return;
    }
    
    soundManager.playLogEntry();
    /* toast removed */

    if (onCapturePOI) {
      onCapturePOI({
        type: 'lateralObstruction',
        subType: 'totalWidth',
        measurement: totalWidth,
        leftClearance: leftClearance?.clearanceWithVehicle ?? leftClearance?.clearanceWithoutVehicle ?? null,
        rightClearance: rightClearance?.clearanceWithVehicle ?? rightClearance?.clearanceWithoutVehicle ?? null,
        totalWidth,
        timestamp: Date.now(),
        cameraPosition: 'front',
      });
    }

    if (!activeSurvey) {
      console.log('[LateralRear] Independent measurement captured:', { type: 'totalWidth', totalWidth });
    }
  }, [lateralLaserSettings.mode, onCapturePOI, activeSurvey]);

  const captureRearOverhang = useCallback(() => {
    if (!rearOverhangSettings.enabled) {
      // toast suppressed
      return;
    }

    const rearMeasurement = useMultiLaserStore.getState().getRearOverhang();
    
    if (!rearMeasurement || rearMeasurement.distanceMeters === null) {
      toast.error('No rear overhang measurement available');
      soundManager.playWarning();
      return;
    }
    
    soundManager.playLogEntry();
    /* toast removed */

    if (onCapturePOI) {
      onCapturePOI({
        type: 'lateralObstruction',
        subType: 'rearOverhang',
        measurement: rearMeasurement.distanceMeters,
        rearDistance: rearMeasurement.distanceMeters,
        timestamp: Date.now(),
        cameraPosition: 'rear',
      });
    }

    if (!activeSurvey) {
      console.log('[LateralRear] Independent measurement captured:', { type: 'rearOverhang', distance: rearMeasurement.distanceMeters });
    }
  }, [rearOverhangSettings.enabled, onCapturePOI, activeSurvey]);

  useEffect(() => {
    const handleCaptureLeft = () => captureLeftLateral();
    const handleCaptureRight = () => captureRightLateral();
    const handleCaptureTotal = () => captureTotalWidth();
    const handleCaptureRear = () => captureRearOverhang();

    window.addEventListener('lateral-capture-left', handleCaptureLeft);
    window.addEventListener('lateral-capture-right', handleCaptureRight);
    window.addEventListener('lateral-capture-total', handleCaptureTotal);
    window.addEventListener('rear-capture', handleCaptureRear);

    return () => {
      window.removeEventListener('lateral-capture-left', handleCaptureLeft);
      window.removeEventListener('lateral-capture-right', handleCaptureRight);
      window.removeEventListener('lateral-capture-total', handleCaptureTotal);
      window.removeEventListener('rear-capture', handleCaptureRear);
    };
  }, [captureLeftLateral, captureRightLateral, captureTotalWidth, captureRearOverhang]);

  return {
    captureLeftLateral,
    captureRightLateral,
    captureTotalWidth,
    captureRearOverhang,
  };
};
