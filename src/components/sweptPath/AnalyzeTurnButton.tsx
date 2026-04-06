import { useState } from 'react';
import { Route, Loader } from 'lucide-react';
import { useSweptPathStore } from '../../stores/sweptPathStore';
import { useEnvelopeStore } from '../../stores/envelopeStore';
import { useCameraStore } from '../../lib/camera';
import { ComplexVehicle } from '../../lib/sweptPath/complexVehicle';
import { RoadDetector } from '../../lib/sweptPath/roadDetection';
import { SweptPathSimulator } from '../../lib/sweptPath/simulator';
import { initializeOpenCV, isOpenCVReady } from '../../lib/opencv/opencv-init';
import { toast } from 'sonner';

const AnalyzeTurnButton = () => {
  const { settings, setCurrentAnalysis, setPlaybackState, addToHistory, setDebugState } = useSweptPathStore();
  const { getActiveProfile } = useEnvelopeStore();
  const { activeStream } = useCameraStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeTurn = async () => {
    if (!settings.enabled) {
      toast.error('Swept Path Analysis not enabled');
      return;
    }

    const selectedProfile = getActiveProfile();
    if (!selectedProfile) {
      toast.error('No vehicle profile selected');
      return;
    }

    if (!activeStream) {
      toast.error('Camera not active');
      return;
    }

    setIsAnalyzing(true);
    setDebugState({ isAnalyzing: true, roadBoundaries: null, confidence: 0 });
    toast.info('Analyzing turn... This may take a few seconds.');

    try {
      // Initialize OpenCV.js if not already loaded
      if (!isOpenCVReady()) {
        toast.info('Loading AI image processing library...');
        const opencvLoaded = await initializeOpenCV();
        if (!opencvLoaded) {
          throw new Error('Failed to load OpenCV.js. Please check your internet connection and try again.');
        }
      }
      
      // Capture current frame from camera
      const canvas = document.createElement('canvas');
      const video = document.querySelector('video');
      if (!video) throw new Error('Camera video not found');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      ctx.drawImage(video, 0, 0);
      const captureImageUrl = canvas.toDataURL('image/jpeg', 0.8);

      // Get ImageData for road detection
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Road detection
      const roadDetector = new RoadDetector(null, {}, true); // Enable debug mode
      const roadResult = roadDetector.detectRoadBoundaries(imageData);
      
      if (!roadResult || 
          !roadResult.leftBoundary || 
          !roadResult.rightBoundary ||
          roadResult.leftBoundary.length === 0 ||
          roadResult.rightBoundary.length === 0) {
        throw new Error('Could not detect road boundaries. Please ensure the camera is pointing at a road with visible lane markings or edges.');
      }
      
      if (roadResult.confidence < 0.1) {
        throw new Error(`Road detection confidence too low (${(roadResult.confidence * 100).toFixed(1)}%). Please adjust the camera angle or lighting.`);
      }
      
      // Update debug state with road detection results
      setDebugState({
        isAnalyzing: false, // Turn off "ANALYZING..." overlay so boundaries are visible
        roadBoundaries: {
          left: roadResult.leftBoundary,
          right: roadResult.rightBoundary,
        },
        confidence: roadResult.confidence,
      });
      
      // Wait a moment to show the road detection visualization
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Build vehicle
      const vehicle = ComplexVehicle.fromProfile(selectedProfile);

      // Estimate turn radius (MVP: use simple calculation)
      // TODO: Use TurnDetector for accurate radius
      const turnRadius = 15.0; // meters (conservative default)

      // Run simulation
      const simulator = new SweptPathSimulator(
        vehicle,
        {
          left: roadResult.leftBoundary,
          right: roadResult.rightBoundary,
        },
        turnRadius,
        0.5 // 0.5m step size
      );

      const snapshots = simulator.simulateTurn();

      // Calculate verdict
      const hasCollision = snapshots.some(s => s.collision?.hasCollision);
      const worstClearance = Math.min(...snapshots.map(s => s.clearance.minimumMargin));
      const maxOffTracking = Math.max(...snapshots.map(s => s.offTracking));

      const verdict: 'feasible' | 'tight' | 'impossible' = hasCollision ? 'impossible' : (worstClearance < 1.0 ? 'tight' : 'feasible');

      // Create analysis
      const analysis = {
        id: `analysis-${Date.now()}`,
        vehicleProfileId: selectedProfile.id,
        roadBoundaries: {
          left: roadResult.leftBoundary,
          right: roadResult.rightBoundary,
        },
        turnRadius,
        snapshots,
        verdict,
        maxOffTracking,
        worstClearance,
        timestamp: new Date().toISOString(),
        captureImageUrl,
      };

      // Set current analysis
      setCurrentAnalysis(analysis);

      // Set playback state
      setPlaybackState({
        isPlaying: false,
        currentFrame: 0,
        totalFrames: snapshots.length,
        speed: settings.animationSpeed,
      });

      // Add to history
      addToHistory({
        id: analysis.id,
        timestamp: analysis.timestamp,
        verdict: verdict.toUpperCase() as any,
        vehicleProfileId: selectedProfile.id,
        vehicleProfileName: selectedProfile.name,
        maxOffTracking,
        worstClearance,
        turnRadius,
        captureImageUrl,
      } as any);

      toast.success(`Analysis complete: ${verdict.toUpperCase()}`);
    } catch (error) {
      toast.error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
      // Clear debug state after a delay
      setTimeout(() => {
        setDebugState({ isAnalyzing: false, roadBoundaries: null, confidence: 0 });
      }, 3000);
    }
  };

  if (!settings.enabled) return null;

  const selectedProfile = getActiveProfile();

  return (
    <button
      onClick={handleAnalyzeTurn}
      disabled={isAnalyzing || !selectedProfile || !activeStream}
      className="px-2 sm:px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-1 sm:gap-2 text-xs sm:text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      data-testid="button-analyze-turn"
    >
      {isAnalyzing ? (
        <>
          <Loader className="w-3 h-3 sm:w-5 sm:h-5 animate-spin" />
          <span className="hidden sm:inline">Analyzing...</span>
          <span className="sm:hidden">...</span>
        </>
      ) : (
        <>
          <Route className="w-3 h-3 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Analyze Turn</span>
          <span className="sm:hidden">Analyze</span>
        </>
      )}
    </button>
  );
};

export default AnalyzeTurnButton;
