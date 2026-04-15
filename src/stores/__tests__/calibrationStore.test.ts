import { describe, it, expect, beforeEach } from 'vitest';
import { useCalibrationStore } from '../calibrationStore';

describe('useCalibrationStore', () => {
  beforeEach(() => {
    useCalibrationStore.setState({
      capturedImages: [],
      calibrationData: null,
      settings: {
        patternSize: { width: 9, height: 6 },
        squareSize: 25,
        minCaptures: 10,
      },
      isCalibrating: false,
    });
  });

  it('has correct defaults', () => {
    const state = useCalibrationStore.getState();
    expect(state.capturedImages).toEqual([]);
    expect(state.calibrationData).toBeNull();
    expect(state.settings.patternSize).toEqual({ width: 9, height: 6 });
    expect(state.settings.squareSize).toBe(25);
    expect(state.settings.minCaptures).toBe(10);
    expect(state.isCalibrating).toBe(false);
  });

  describe('setSettings', () => {
    it('merges partial settings', () => {
      useCalibrationStore.getState().setSettings({ squareSize: 30 });
      const settings = useCalibrationStore.getState().settings;
      expect(settings.squareSize).toBe(30);
      expect(settings.minCaptures).toBe(10); // unchanged
    });

    it('updates patternSize', () => {
      useCalibrationStore.getState().setSettings({ patternSize: { width: 7, height: 5 } });
      expect(useCalibrationStore.getState().settings.patternSize).toEqual({ width: 7, height: 5 });
    });
  });

  describe('addCapturedImage', () => {
    it('adds an image to the list', () => {
      const img = { id: 'img1', imageData: 'base64...', corners: [[0, 0]], timestamp: Date.now() };
      useCalibrationStore.getState().addCapturedImage(img);
      expect(useCalibrationStore.getState().capturedImages).toHaveLength(1);
      expect(useCalibrationStore.getState().capturedImages[0].id).toBe('img1');
    });

    it('appends multiple images', () => {
      useCalibrationStore.getState().addCapturedImage({ id: 'img1', imageData: '', corners: [], timestamp: 1 });
      useCalibrationStore.getState().addCapturedImage({ id: 'img2', imageData: '', corners: [], timestamp: 2 });
      expect(useCalibrationStore.getState().capturedImages).toHaveLength(2);
    });
  });

  describe('removeCapturedImage', () => {
    it('removes image by id', () => {
      useCalibrationStore.getState().addCapturedImage({ id: 'img1', imageData: '', corners: [], timestamp: 1 });
      useCalibrationStore.getState().addCapturedImage({ id: 'img2', imageData: '', corners: [], timestamp: 2 });
      useCalibrationStore.getState().removeCapturedImage('img1');
      const images = useCalibrationStore.getState().capturedImages;
      expect(images).toHaveLength(1);
      expect(images[0].id).toBe('img2');
    });
  });

  describe('clearCapturedImages', () => {
    it('removes all images', () => {
      useCalibrationStore.getState().addCapturedImage({ id: 'img1', imageData: '', corners: [], timestamp: 1 });
      useCalibrationStore.getState().addCapturedImage({ id: 'img2', imageData: '', corners: [], timestamp: 2 });
      useCalibrationStore.getState().clearCapturedImages();
      expect(useCalibrationStore.getState().capturedImages).toEqual([]);
    });
  });

  describe('setCalibrationData', () => {
    it('sets calibration data', () => {
      const data = {
        cameraMatrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        distortionCoeffs: [0.1, -0.2, 0, 0, 0],
        focalLength: { x: 500, y: 500 },
        principalPoint: { x: 320, y: 240 },
        reprojectionError: 0.5,
        quality: 'GOOD' as const,
        calibrationDate: Date.now(),
        imageWidth: 640,
        imageHeight: 480,
      };
      useCalibrationStore.getState().setCalibrationData(data);
      expect(useCalibrationStore.getState().calibrationData).toEqual(data);
    });

    it('clears calibration data with null', () => {
      useCalibrationStore.getState().setCalibrationData({
        cameraMatrix: null,
        distortionCoeffs: null,
        focalLength: null,
        principalPoint: null,
        reprojectionError: null,
        quality: 'POOR',
        calibrationDate: 0,
        imageWidth: 0,
        imageHeight: 0,
      });
      useCalibrationStore.getState().setCalibrationData(null);
      expect(useCalibrationStore.getState().calibrationData).toBeNull();
    });
  });

  describe('setIsCalibrating', () => {
    it('sets calibrating state', () => {
      useCalibrationStore.getState().setIsCalibrating(true);
      expect(useCalibrationStore.getState().isCalibrating).toBe(true);
      useCalibrationStore.getState().setIsCalibrating(false);
      expect(useCalibrationStore.getState().isCalibrating).toBe(false);
    });
  });
});
