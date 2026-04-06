import { useEffect, useState } from 'react';
import { detectAvailableCameras } from '../lib/camera/CameraInterface';
import { useCameraStore } from '../lib/camera';

/**
 * Hook to auto-detect available cameras on app startup
 * Runs camera detection and sets recommended camera type in store
 */
export function useCameraAutoDetect() {
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  
  const setCameraType = useCameraStore((state) => state.setCameraType);
  const setIsAutoDetected = useCameraStore((state) => state.setIsAutoDetected);

  useEffect(() => {
    const runDetection = async () => {
      // Only run detection once
      if (isDetecting) return;
      
      setIsDetecting(true);
      setDetectionError(null);

      try {
        const detectionResults = await detectAvailableCameras();

        // Set recommended camera type in store
        if (detectionResults.recommendedCamera) {
          setCameraType(detectionResults.recommendedCamera);
          setIsAutoDetected(true);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setDetectionError(errorMessage);
        
        // Even on error, default to standard camera as fallback
        setCameraType('standard');
        setIsAutoDetected(false);
      } finally {
        setIsDetecting(false);
      }
    };

    runDetection();
  }, []); // Run only once on mount

  return {
    isDetecting,
    detectionError
  };
}
