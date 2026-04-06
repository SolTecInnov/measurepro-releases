/**
 * Camera-Based Measurement Component
 * Works on iPhone Safari using camera + device sensors
 * Alternative to LiDAR for distance/height estimation
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Ruler, Target, Info, ArrowUp, ArrowDown, CheckCircle2 } from 'lucide-react';
import { useVisualMeasurement } from '@/hooks/useVisualMeasurement';

interface CameraMeasurementProps {
  onHeightCaptured: (height: number) => void;
}

export function CameraMeasurement({ onHeightCaptured }: CameraMeasurementProps) {
  const {
    capabilities,
    orientation,
    measurement,
    error,
    videoRef,
    startCamera,
    stopCamera,
    measureByAngle,
    quickEstimate,
  } = useVisualMeasurement();

  const [cameraActive, setCameraActive] = useState(false);
  const [topAngle, setTopAngle] = useState<number | null>(null);
  const [bottomAngle, setBottomAngle] = useState<number | null>(null);
  const [deviceHeight, setDeviceHeight] = useState('1.5'); // meters
  const [activeTab, setActiveTab] = useState<'quick' | 'angle'>('quick');

  useEffect(() => {
    return () => {
      if (cameraActive) {
        stopCamera();
      }
    };
  }, [cameraActive, stopCamera]);

  const handleStartCamera = async () => {
    const success = await startCamera();
    setCameraActive(success);
  };

  const handleStopCamera = () => {
    stopCamera();
    setCameraActive(false);
  };

  const handleCaptureTop = () => {
    if (orientation.beta !== null) {
      setTopAngle(orientation.beta);
    }
  };

  const handleCaptureBottom = () => {
    if (orientation.beta !== null) {
      setBottomAngle(orientation.beta);
    }
  };

  const handleCalculateByAngle = () => {
    const result = measureByAngle(parseFloat(deviceHeight), topAngle, bottomAngle);
    if (result) {
      onHeightCaptured(result.distance);
    }
  };

  const handleQuickEstimate = (preset: 'close' | 'medium' | 'far') => {
    const result = quickEstimate(preset);
    onHeightCaptured(result.distance);
  };

  if (!capabilities.camera && !capabilities.orientation) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-white">
            <Camera className="h-4 w-4 text-blue-400" />
            Camera Measurement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-300">
              <Info className="h-4 w-4" />
              <span className="text-sm">Camera not available on this device</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-white">
          <Camera className="h-4 w-4 text-blue-400" />
          Visual Measurement Tools
        </CardTitle>
        <CardDescription className="text-slate-400">
          Use your iPhone camera and sensors to estimate measurements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-300">
              <Info className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 bg-slate-900 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('quick')}
            className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
              activeTab === 'quick' 
                ? 'bg-slate-800 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
            data-testid="tab-quick"
          >
            Quick Presets
          </button>
          <button
            onClick={() => setActiveTab('angle')}
            className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
              activeTab === 'angle' 
                ? 'bg-slate-800 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
            data-testid="tab-angle"
          >
            Angle Method
          </button>
        </div>

        {/* Tab Content: Quick Presets */}
        {activeTab === 'quick' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 mb-2">
              Select an approximate distance for quick measurement:
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => handleQuickEstimate('close')}
                variant="outline"
                className="flex flex-col h-auto py-3 border-slate-600 hover:bg-slate-800 text-white"
                data-testid="button-quick-close"
              >
                <Target className="h-5 w-5 mb-1 text-green-400" />
                <span className="text-xs">Close</span>
                <span className="text-xs text-slate-400">~2m</span>
              </Button>
              
              <Button
                onClick={() => handleQuickEstimate('medium')}
                variant="outline"
                className="flex flex-col h-auto py-3 border-slate-600 hover:bg-slate-800 text-white"
                data-testid="button-quick-medium"
              >
                <Target className="h-5 w-5 mb-1 text-yellow-400" />
                <span className="text-xs">Medium</span>
                <span className="text-xs text-slate-400">~5m</span>
              </Button>
              
              <Button
                onClick={() => handleQuickEstimate('far')}
                variant="outline"
                className="flex flex-col h-auto py-3 border-slate-600 hover:bg-slate-800 text-white"
                data-testid="button-quick-far"
              >
                <Target className="h-5 w-5 mb-1 text-red-400" />
                <span className="text-xs">Far</span>
                <span className="text-xs text-slate-400">~10m</span>
              </Button>
            </div>

            {measurement && measurement.method === 'manual' && (
              <div className="bg-green-900/20 border border-green-600 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center gap-2 text-green-300">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">
                    Set to <strong>{measurement.distance.toFixed(1)}m</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Angle Method */}
        {activeTab === 'angle' && (
          <div className="space-y-3">
            {!cameraActive ? (
              <>
                <div className="text-xs text-slate-400 mb-2">
                  Use device tilt to measure object height:
                </div>
                <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside">
                  <li>Stand at known distance from object</li>
                  <li>Point camera at TOP of object, tap "Capture Top"</li>
                  <li>Point camera at BOTTOM, tap "Capture Bottom"</li>
                  <li>Tap "Calculate Height"</li>
                </ol>
                
                <Button
                  onClick={handleStartCamera}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  data-testid="button-start-camera"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Start Camera
                </Button>
              </>
            ) : (
              <>
                <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  
                  {orientation.beta !== null && (
                    <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
                      Angle: {orientation.beta.toFixed(1)}°
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-white text-xs">Device Height Above Ground (m)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={deviceHeight}
                    onChange={(e) => setDeviceHeight(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white"
                    data-testid="input-device-height"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleCaptureTop}
                    variant="outline"
                    className="border-slate-600 hover:bg-slate-800 text-white"
                    disabled={!orientation.beta}
                    data-testid="button-capture-top"
                  >
                    <ArrowUp className="h-4 w-4 mr-1" />
                    Top {topAngle !== null && `(${topAngle.toFixed(1)}°)`}
                  </Button>
                  
                  <Button
                    onClick={handleCaptureBottom}
                    variant="outline"
                    className="border-slate-600 hover:bg-slate-800 text-white"
                    disabled={!orientation.beta}
                    data-testid="button-capture-bottom"
                  >
                    <ArrowDown className="h-4 w-4 mr-1" />
                    Bottom {bottomAngle !== null && `(${bottomAngle.toFixed(1)}°)`}
                  </Button>
                </div>

                <Button
                  onClick={handleCalculateByAngle}
                  disabled={topAngle === null || bottomAngle === null}
                  className="w-full bg-green-600 hover:bg-green-700 text-white disabled:bg-slate-600"
                  data-testid="button-calculate-height"
                >
                  <Ruler className="h-4 w-4 mr-2" />
                  Calculate Height
                </Button>

                <Button
                  onClick={handleStopCamera}
                  variant="outline"
                  className="w-full border-slate-600 hover:bg-slate-800 text-white"
                  data-testid="button-stop-camera"
                >
                  Stop Camera
                </Button>

                {measurement && measurement.method === 'device_angle' && (
                  <div className="bg-green-900/20 border border-green-600 rounded-lg p-2 text-center">
                    <span className="text-sm text-green-300">
                      Height: <strong>{measurement.distance.toFixed(2)}m</strong>
                      <br />
                      <span className="text-xs">Confidence: {(measurement.confidence * 100).toFixed(0)}%</span>
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
