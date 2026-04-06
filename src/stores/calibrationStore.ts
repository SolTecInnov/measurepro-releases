import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CapturedCalibrationImage, CalibrationSettings, CalibrationData } from '@/types/calibration';

interface CalibrationStore {
  capturedImages: CapturedCalibrationImage[];
  calibrationData: CalibrationData | null;
  settings: CalibrationSettings;
  isCalibrating: boolean;
  setSettings: (settings: Partial<CalibrationSettings>) => void;
  addCapturedImage: (image: CapturedCalibrationImage) => void;
  removeCapturedImage: (id: string) => void;
  clearCapturedImages: () => void;
  setCalibrationData: (data: CalibrationData | null) => void;
  setIsCalibrating: (isCalibrating: boolean) => void;
}

export const useCalibrationStore = create<CalibrationStore>()(
  persist(
    (set) => ({
      capturedImages: [],
      calibrationData: null,
      settings: {
        patternSize: {
          width: 9,
          height: 6,
        },
        squareSize: 25,
        minCaptures: 10,
      },
      isCalibrating: false,
      setSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      addCapturedImage: (image) =>
        set((state) => ({
          capturedImages: [...state.capturedImages, image],
        })),
      removeCapturedImage: (id) =>
        set((state) => ({
          capturedImages: state.capturedImages.filter((img) => img.id !== id),
        })),
      clearCapturedImages: () =>
        set({ capturedImages: [] }),
      setCalibrationData: (data) =>
        set({ calibrationData: data }),
      setIsCalibrating: (isCalibrating) =>
        set({ isCalibrating }),
    }),
    {
      name: 'calibration-storage',
    }
  )
);
