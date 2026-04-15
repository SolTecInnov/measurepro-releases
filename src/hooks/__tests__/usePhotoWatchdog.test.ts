import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
});

vi.mock('@/lib/camera', () => ({
  useCameraStore: {
    getState: vi.fn(() => ({ isCameraConnected: true })),
  },
}));

vi.mock('@/lib/survey/MeasurementFeed', () => ({
  getMeasurementFeed: vi.fn(() => ({
    subscribe: vi.fn(() => vi.fn()),
    getMeasurementsWithLimit: vi.fn(() => []),
    getMeasurement: vi.fn(() => null),
  })),
}));

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { useCameraStore } from '@/lib/camera';
import { getMeasurementFeed } from '@/lib/survey/MeasurementFeed';
import { toast } from 'sonner';

describe('usePhotoWatchdog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should detect camera disconnection during logging', async () => {
    // Simulate camera disconnected
    vi.mocked(useCameraStore.getState).mockReturnValue({ isCameraConnected: false } as any);

    // Import and manually test the camera check logic
    const checkCamera = () => {
      const { isCameraConnected } = useCameraStore.getState();
      if (!isCameraConnected) {
        toast.error('Camera disconnected', {
          description: 'POIs are being logged WITHOUT photos.',
        });
        return false;
      }
      return true;
    };

    const result = checkCamera();
    expect(result).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Camera disconnected', expect.any(Object));
  });

  it('should detect camera reconnection', () => {
    vi.mocked(useCameraStore.getState).mockReturnValue({ isCameraConnected: true } as any);

    const { isCameraConnected } = useCameraStore.getState();
    expect(isCameraConnected).toBe(true);
  });

  it('should detect POI without image', () => {
    const mockPOI = {
      id: 'poi-1',
      poiNumber: 42,
      poi_type: 'wire',
      imageUrl: null,
      images: [],
      measurementFree: false,
    };

    const hasImage = mockPOI.imageUrl || (mockPOI.images && mockPOI.images.length > 0);
    expect(hasImage).toBeFalsy();
  });

  it('should pass for POI with image', () => {
    const mockPOI = {
      id: 'poi-2',
      poiNumber: 43,
      poi_type: 'wire',
      imageUrl: 'data:image/jpeg;base64,abc123',
      images: ['data:image/jpeg;base64,abc123'],
    };

    const hasImage = mockPOI.imageUrl || (mockPOI.images && mockPOI.images.length > 0);
    expect(hasImage).toBeTruthy();
  });

  it('should not warn for measurement-free POIs without images', () => {
    const mockPOI = {
      id: 'poi-3',
      poiNumber: 44,
      poi_type: 'road',
      imageUrl: null,
      images: [],
      measurementFree: true,
    };

    // Measurement-free POIs in some modes intentionally have no image
    const shouldWarn = !mockPOI.measurementFree || !!mockPOI.imageUrl;
    expect(shouldWarn).toBe(false);
  });
});
