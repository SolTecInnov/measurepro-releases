import { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  CheckCircle, 
  XCircle, 
  Download, 
  Save, 
  Upload,
  Play,
  Square,
  Loader2,
  AlertTriangle,
  Calculator,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { useCameraStore } from '@/lib/camera';
import { useCalibrationStore } from '@/stores/calibrationStore';
import { initializeOpenCV } from '@/lib/opencv/opencv-init';
import { 
  captureCalibrationImage, 
  calculateCameraCalibration 
} from '@/lib/opencv/calibration';
import { 
  saveCalibrationToStorage, 
  loadCalibrationFromStorage 
} from '@/lib/opencv/calibration-storage';

export function CameraCalibration() {
  const {
    selectedCamera,
    setSelectedCamera,
  } = useCameraStore();

  const {
    capturedImages,
    calibrationData,
    settings,
    isCalibrating,
    addCapturedImage,
    clearCapturedImages,
    setCalibrationData,
    setIsCalibrating,
  } = useCalibrationStore();

  const [isInitializing, setIsInitializing] = useState(true);
  const [openCVReady, setOpenCVReady] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('info');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [previewCorners, setPreviewCorners] = useState<number[][] | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    initOpenCV();
    enumerateCameras();
    
    return () => {
      stopCamera();
    };
  }, []);

  const initOpenCV = async () => {
    setIsInitializing(true);
    setStatusMessage('Initializing OpenCV.js...');
    setStatusType('info');
    
    const success = await initializeOpenCV();
    
    if (success) {
      setOpenCVReady(true);
      setStatusMessage('OpenCV.js ready');
      setStatusType('success');
    } else {
      setStatusMessage('Failed to initialize OpenCV.js');
      setStatusType('error');
      toast.error('Failed to initialize OpenCV.js');
    }
    
    setIsInitializing(false);
  };

  const enumerateCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      
      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (error) {
      toast.error('Failed to access cameras');
    }
  };

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraStarted(true);
        setStatusMessage('Camera started');
        setStatusType('success');
        // toast suppressed
      }
    } catch (error) {
      setStatusMessage('Failed to start camera');
      setStatusType('error');
      toast.error('Failed to access camera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraStarted(false);
    setPreviewCorners(null);
  };

  const handleCaptureImage = async () => {
    if (!videoRef.current || !openCVReady) {
      toast.error('Camera or OpenCV not ready');
      return;
    }

    setIsCapturing(true);
    setStatusMessage('Detecting chessboard pattern...');
    setStatusType('info');

    try {
      const result = await captureCalibrationImage(videoRef.current, settings);

      if (result.success && result.imageData) {
        const capturedImage = {
          id: crypto.randomUUID(),
          imageData: result.imageData,
          corners: result.corners,
          timestamp: Date.now(),
        };

        addCapturedImage(capturedImage);
        setPreviewCorners(result.corners);
        setStatusMessage(result.message);
        setStatusType('success');
        // toast suppressed

        drawCornersOnCanvas(result.corners);
      } else {
        setStatusMessage(result.message);
        setStatusType('error');
        toast.error(result.message);
        setPreviewCorners(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to capture image';
      setStatusMessage(message);
      setStatusType('error');
      toast.error(message);
    } finally {
      setIsCapturing(false);
    }
  };

  const drawCornersOnCanvas = (corners: number[][]) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    ctx.fillStyle = '#00ff00';
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;

    corners.forEach((corner, index) => {
      const [x, y] = corner;
      
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();

      if (index === 0) {
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#00ff00';
      }
    });

    for (let i = 1; i < corners.length; i++) {
      ctx.beginPath();
      ctx.moveTo(corners[i - 1][0], corners[i - 1][1]);
      ctx.lineTo(corners[i][0], corners[i][1]);
      ctx.stroke();
    }
  };

  const handleCalculateCalibration = async () => {
    if (capturedImages.length < settings.minCaptures) {
      toast.error(`Need at least ${settings.minCaptures} images`);
      return;
    }

    if (!videoRef.current) {
      toast.error('Video element not available');
      return;
    }

    setIsCalibrating(true);
    setStatusMessage('Calculating camera calibration...');
    setStatusType('info');

    try {
      const result = await calculateCameraCalibration(
        capturedImages,
        settings,
        videoRef.current.videoWidth,
        videoRef.current.videoHeight
      );

      if (result.success) {
        const calibData = {
          cameraMatrix: result.cameraMatrix,
          distortionCoeffs: result.distortionCoeffs,
          focalLength: result.focalLength,
          principalPoint: result.principalPoint,
          reprojectionError: result.reprojectionError,
          quality: result.quality,
          calibrationDate: Date.now(),
          imageWidth: videoRef.current.videoWidth,
          imageHeight: videoRef.current.videoHeight,
        };

        setCalibrationData(calibData);
        setStatusMessage(result.message);
        setStatusType('success');
        // toast suppressed
      } else {
        setStatusMessage(result.message);
        setStatusType('error');
        toast.error(result.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Calibration failed';
      setStatusMessage(message);
      setStatusType('error');
      toast.error(message);
    } finally {
      setIsCalibrating(false);
    }
  };

  const handleSaveCalibration = async () => {
    if (!calibrationData) {
      toast.error('No calibration data to save');
      return;
    }

    try {
      const success = await saveCalibrationToStorage(calibrationData);
      if (success) {
        // toast suppressed
      } else {
        toast.error('Failed to save calibration');
      }
    } catch (error) {
      toast.error('Failed to save calibration');
    }
  };

  const handleLoadCalibration = async () => {
    try {
      const loaded = await loadCalibrationFromStorage();
      if (loaded) {
        setCalibrationData(loaded);
        // toast suppressed
        setStatusMessage('Calibration loaded from storage');
        setStatusType('success');
      } else {
        // toast suppressed
      }
    } catch (error) {
      toast.error('Failed to load calibration');
    }
  };

  const handleDownloadPattern = () => {
    window.open(
      'https://raw.githubusercontent.com/opencv/opencv/master/doc/pattern.png',
      '_blank'
    );
    // toast suppressed
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'EXCELLENT':
        return 'text-green-400';
      case 'GOOD':
        return 'text-blue-400';
      case 'NEEDS_IMPROVEMENT':
        return 'text-yellow-400';
      case 'POOR':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getQualityBadgeColor = (quality: string) => {
    switch (quality) {
      case 'EXCELLENT':
        return 'bg-green-900/30 text-green-400 border-green-700';
      case 'GOOD':
        return 'bg-blue-900/30 text-blue-400 border-blue-700';
      case 'NEEDS_IMPROVEMENT':
        return 'bg-yellow-900/30 text-yellow-400 border-yellow-700';
      case 'POOR':
        return 'bg-red-900/30 text-red-400 border-red-700';
      default:
        return 'bg-gray-900/30 text-gray-400 border-gray-700';
    }
  };

  const progress = (capturedImages.length / settings.minCaptures) * 100;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Camera Calibration</h1>
        <p className="text-gray-400">
          Calibrate your camera using a chessboard pattern for accurate measurements
        </p>
      </div>

      {isInitializing ? (
        <div className="flex items-center justify-center p-12 bg-gray-800 rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mr-3" />
          <span className="text-lg">Initializing OpenCV...</span>
        </div>
      ) : !openCVReady ? (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-red-400 mb-1">OpenCV Failed to Initialize</h3>
            <p className="text-gray-300">
              Cannot proceed with calibration. Please refresh the page and try again.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Camera and Controls */}
          <div className="space-y-6">
            {/* Camera Preview */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-400" />
                Camera Preview
              </h2>

              {/* Camera Selection */}
              {!cameraStarted && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Select Camera
                  </label>
                  <select
                    value={selectedCamera}
                    onChange={(e) => setSelectedCamera(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                    data-testid="select-camera"
                  >
                    {availableCameras.map((camera) => (
                      <option key={camera.deviceId} value={camera.deviceId}>
                        {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Video Preview */}
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-4">
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  playsInline
                  muted
                  data-testid="video-preview"
                />
                {previewCorners && (
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full object-contain"
                  />
                )}
                {!cameraStarted && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
                    <p className="text-gray-400">Camera not started</p>
                  </div>
                )}
              </div>

              {/* Camera Controls */}
              <div className="flex gap-3">
                {!cameraStarted ? (
                  <button
                    onClick={startCamera}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors flex-1"
                    data-testid="button-start-camera"
                  >
                    <Play className="w-4 h-4" />
                    Start Camera Calibration
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleCaptureImage}
                      disabled={isCapturing}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex-1"
                      data-testid="button-capture-image"
                    >
                      {isCapturing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Detecting...
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          Capture Calibration Image
                        </>
                      )}
                    </button>
                    <button
                      onClick={stopCamera}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
                      data-testid="button-stop-camera"
                    >
                      Stop
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Calibration Settings */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Square className="w-5 h-5 text-blue-400" />
                Calibration Settings
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Pattern Size:</span>
                  <span className="font-mono">
                    {settings.patternSize.width} x {settings.patternSize.height} internal corners
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-700">
                  <span className="text-gray-400">Square Size:</span>
                  <span className="font-mono">{settings.squareSize}mm</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-400">Minimum Captures:</span>
                  <span className="font-mono">{settings.minCaptures} images</span>
                </div>
              </div>

              <button
                onClick={handleDownloadPattern}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
                data-testid="button-download-pattern"
              >
                <Download className="w-4 h-4" />
                Download Chessboard Pattern
              </button>
            </div>
          </div>

          {/* Right Column - Progress and Results */}
          <div className="space-y-6">
            {/* Capture Progress */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Capture Progress</h2>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Images Captured</span>
                  <span className="font-mono font-semibold" data-testid="text-capture-progress">
                    {capturedImages.length} / {settings.minCaptures}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all duration-300"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              </div>

              {capturedImages.length > 0 && (
                <button
                  onClick={clearCapturedImages}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors mb-4"
                  data-testid="button-clear-captures"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All Captures
                </button>
              )}

              <button
                onClick={handleCalculateCalibration}
                disabled={capturedImages.length < settings.minCaptures || isCalibrating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                data-testid="button-calculate-calibration"
              >
                {isCalibrating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4" />
                    Calculate Calibration
                  </>
                )}
              </button>
            </div>

            {/* Status Messages */}
            {statusMessage && (
              <div
                className={`rounded-xl p-4 border flex items-start gap-3 ${
                  statusType === 'success'
                    ? 'bg-green-900/30 border-green-700'
                    : statusType === 'error'
                    ? 'bg-red-900/30 border-red-700'
                    : 'bg-blue-900/30 border-blue-700'
                }`}
                data-testid="text-status-message"
              >
                {statusType === 'success' && (
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                )}
                {statusType === 'error' && (
                  <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                {statusType === 'info' && (
                  <Loader2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5 animate-spin" />
                )}
                <p className="text-sm">{statusMessage}</p>
              </div>
            )}

            {/* Calibration Results */}
            {calibrationData && (
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h2 className="text-xl font-semibold mb-4">Calibration Results</h2>

                <div className="space-y-4">
                  {/* Quality Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Quality:</span>
                    <span
                      className={`px-3 py-1 rounded-full border text-sm font-semibold ${getQualityBadgeColor(
                        calibrationData.quality
                      )}`}
                      data-testid="badge-calibration-quality"
                    >
                      {calibrationData.quality}
                    </span>
                  </div>

                  {/* Focal Length */}
                  {calibrationData.focalLength && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-400">Focal Length</h3>
                      <div className="bg-gray-700 rounded-lg p-3 font-mono text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-400">fx:</span>
                          <span data-testid="text-focal-length-x">
                            {calibrationData.focalLength.x.toFixed(2)} px
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">fy:</span>
                          <span data-testid="text-focal-length-y">
                            {calibrationData.focalLength.y.toFixed(2)} px
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reprojection Error */}
                  {calibrationData.reprojectionError !== null && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-400">Reprojection Error</h3>
                      <div className="bg-gray-700 rounded-lg p-3 font-mono text-sm">
                        <span
                          className={getQualityColor(calibrationData.quality)}
                          data-testid="text-reprojection-error"
                        >
                          {calibrationData.reprojectionError.toFixed(4)} pixels
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Save/Load Buttons */}
                  <div className="flex gap-3 pt-4 border-t border-gray-700">
                    <button
                      onClick={handleSaveCalibration}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors flex-1"
                      data-testid="button-save-calibration"
                    >
                      <Save className="w-4 h-4" />
                      Save Calibration
                    </button>
                    <button
                      onClick={handleLoadCalibration}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium transition-colors flex-1"
                      data-testid="button-load-calibration"
                    >
                      <Upload className="w-4 h-4" />
                      Load Existing
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
