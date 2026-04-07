/**
 * DroneImportToast
 * Non-blocking notification when a DJI device is detected
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSurveyStore } from '@/lib/survey';

interface DjiDevice {
  driveLetter: string;
  drivePath: string;
  driveLabel: string;
  dcimPath: string;
  imageCount: number;
  deviceType: string;
}

interface Props {
  onImportRequest: (device: DjiDevice) => void;
}

export function DroneImportToast({ onImportRequest }: Props) {
  const { activeSurvey } = useSurveyStore();

  useEffect(() => {
    const api = (window as any).electronAPI?.drone;
    if (!api) return;

    api.onDeviceDetected((device: DjiDevice) => {
      console.log('[DroneImport] Device detected:', device);

      /* toast removed */
    });

    api.onDeviceRemoved(({ driveLetter }: { driveLetter: string }) => {
      // toast suppressed
    });

    return () => api.removeListeners?.();
  }, [activeSurvey, onImportRequest]);

  return null;
}
