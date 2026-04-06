/**
 * Visual Measurement Tool for iPhone
 * Uses camera + device sensors for distance estimation
 * Works on Safari/iOS without requiring WebXR or LiDAR
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface DeviceOrientation {
  alpha: number | null; // Z-axis rotation (0-360)
  beta: number | null;  // X-axis rotation (-180 to 180)
  gamma: number | null; // Y-axis rotation (-90 to 90)
}

interface VisualMeasurement {
  distance: number; // in meters
  method: 'reference_object' | 'device_angle' | 'manual';
  confidence: number; // 0-1
  timestamp: number;
}

interface MeasurementCapabilities {
  camera: boolean;
  orientation: boolean;
  motion: boolean;
}

export function useVisualMeasurement() {
  const [capabilities, setCapabilities] = useState<MeasurementCapabilities>({
    camera: false,
    orientation: false,
    motion: false,
  });
  const [orientation, setOrientation] = useState<DeviceOrientation>({
    alpha: null,
    beta: null,
    gamma: null,
  });
  const [measurement, setMeasurement] = useState<VisualMeasurement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check device capabilities
  useEffect(() => {
    const checkCapabilities = async () => {
      const caps: MeasurementCapabilities = {
        camera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        orientation: 'DeviceOrientationEvent' in window,
        motion: 'DeviceMotionEvent' in window,
      };
      setCapabilities(caps);
    };

    checkCapabilities();
  }, []);

  // Request device orientation permission (iOS 13+)
  const requestOrientationPermission = useCallback(async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation);
          return true;
        }
        setError('Device orientation permission denied');
        return false;
      } catch (err) {
        setError('Failed to request orientation permission');
        return false;
      }
    } else {
      // Non-iOS or older iOS - no permission needed
      window.addEventListener('deviceorientation', handleOrientation);
      return true;
    }
  }, []);

  const handleOrientation = (event: DeviceOrientationEvent) => {
    setOrientation({
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma,
    });
  };

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Request orientation permission
      await requestOrientationPermission();

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access camera');
      return false;
    }
  }, [requestOrientationPermission]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  /**
   * Measure using reference object method
   * User provides known object height, app calculates distance
   */
  const measureByReferenceObject = useCallback((
    knownHeightMeters: number,
    pixelHeight: number,
    totalPixelHeight: number,
    cameraFOV: number = 60 // Default iPhone camera FOV
  ): VisualMeasurement => {
    // Calculate distance using similar triangles
    // distance = (knownHeight * focalLength) / pixelHeight
    // focalLength ≈ (imageHeight / 2) / tan(FOV/2)
    
    const fovRadians = (cameraFOV * Math.PI) / 180;
    const focalLength = (totalPixelHeight / 2) / Math.tan(fovRadians / 2);
    const distance = (knownHeightMeters * focalLength) / pixelHeight;

    const measurement: VisualMeasurement = {
      distance,
      method: 'reference_object',
      confidence: pixelHeight > 50 ? 0.7 : 0.5, // Higher confidence for larger objects
      timestamp: Date.now(),
    };

    setMeasurement(measurement);
    return measurement;
  }, []);

  /**
   * Measure using device angle method
   * User aims phone at top and bottom of object, app calculates height/distance
   */
  const measureByAngle = useCallback((
    deviceHeight: number, // Height of device above ground in meters
    topAngle: number | null,
    bottomAngle: number | null
  ): VisualMeasurement | null => {
    if (topAngle === null || bottomAngle === null) {
      setError('Need both top and bottom angles');
      return null;
    }

    // Convert angles to radians
    const topRad = (topAngle * Math.PI) / 180;
    const bottomRad = (bottomAngle * Math.PI) / 180;

    // Calculate height using trigonometry
    // This is a simplified calculation
    const distance = deviceHeight / (Math.tan(topRad) - Math.tan(bottomRad));

    const measurement: VisualMeasurement = {
      distance: Math.abs(distance),
      method: 'device_angle',
      confidence: 0.6,
      timestamp: Date.now(),
    };

    setMeasurement(measurement);
    return measurement;
  }, []);

  /**
   * Quick estimation presets for common scenarios
   */
  const quickEstimate = useCallback((preset: 'close' | 'medium' | 'far'): VisualMeasurement => {
    const distances = {
      close: 2.0,   // 2 meters
      medium: 5.0,  // 5 meters
      far: 10.0,    // 10 meters
    };

    const measurement: VisualMeasurement = {
      distance: distances[preset],
      method: 'manual',
      confidence: 0.5,
      timestamp: Date.now(),
    };

    setMeasurement(measurement);
    return measurement;
  }, []);

  return {
    capabilities,
    orientation,
    measurement,
    error,
    videoRef,
    startCamera,
    stopCamera,
    measureByReferenceObject,
    measureByAngle,
    quickEstimate,
  };
}
