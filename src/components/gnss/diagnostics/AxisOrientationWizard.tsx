/**
 * Axis Orientation Wizard
 * Guides user through identifying Duro X/Y/Z axes relative to vehicle frame
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  RotateCcw, ArrowUp, ArrowRight, ArrowDown, 
  Play, Square, Check, AlertTriangle, Car, Box
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  orientationCalibration, 
  type AxisMapping, 
  type CalibrationWindow,
  type AccelGyroSample,
  type AxisMappingResult
} from '@/lib/calibration/orientation';
import { useGnssData } from '@/hooks/useGnssData';

type WizardStep = 'intro' | 'baseline' | 'forward' | 'lateral' | 'vertical' | 'results' | 'validation';

interface TestResult {
  dominantAxis: 'X' | 'Y' | 'Z';
  sign: 1 | -1;
  confidence: number;
  explanation: string;
}

export function AxisOrientationWizard() {
  const { latestSample, hasImu } = useGnssData();
  
  const [step, setStep] = useState<WizardStep>('intro');
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [captureTarget, setCaptureTarget] = useState(5);
  
  const [baselineWindow, setBaselineWindow] = useState<CalibrationWindow | null>(null);
  const [forwardResult, setForwardResult] = useState<TestResult | null>(null);
  const [lateralResult, setLateralResult] = useState<TestResult | null>(null);
  const [verticalResult, setVerticalResult] = useState<TestResult | null>(null);
  const [mappingResult, setMappingResult] = useState<AxisMappingResult | null>(null);
  
  const [currentMapping, setCurrentMapping] = useState<AxisMapping | null>(null);
  
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const cal = orientationCalibration.getCurrent();
    if (cal) {
      setCurrentMapping(cal.mapping);
    }

    const unsubscribe = orientationCalibration.subscribe((cal) => {
      if (cal) {
        setCurrentMapping(cal.mapping);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isCapturing && latestSample) {
      const sample: AccelGyroSample = {
        timestamp: Date.now(),
        accelX: latestSample.acceleration?.x ?? 0,
        accelY: latestSample.acceleration?.y ?? 0,
        accelZ: latestSample.acceleration?.z ?? 0,
        gyroX: latestSample.angularRate?.roll,
        gyroY: latestSample.angularRate?.pitch,
        gyroZ: latestSample.angularRate?.yaw,
        roll: latestSample.attitude?.roll,
        pitch: latestSample.attitude?.pitch,
        yaw: latestSample.attitude?.yaw,
      };
      orientationCalibration.addSample(sample);
    }
  }, [isCapturing, latestSample]);

  const startCapture = (type: CalibrationWindow['type'], duration: number) => {
    orientationCalibration.startCapture(type);
    setIsCapturing(true);
    setCaptureProgress(0);
    setCaptureTarget(duration);

    let elapsed = 0;
    captureIntervalRef.current = setInterval(() => {
      elapsed += 0.1;
      setCaptureProgress((elapsed / duration) * 100);

      if (elapsed >= duration) {
        stopCapture(type);
      }
    }, 100);
  };

  const stopCapture = (type: CalibrationWindow['type']) => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
    }
    setIsCapturing(false);
    setCaptureProgress(100);

    const window = orientationCalibration.stopCapture();
    
    if (!window || window.samples.length < 5) {
      toast.error('Not enough samples captured. Please try again.');
      return;
    }

    if (type === 'baseline') {
      setBaselineWindow(window);
      const vertResult = orientationCalibration.analyzeVerticalTest(window);
      setVerticalResult(vertResult);
      // toast suppressed
      setStep('forward');
    } else if (type === 'forward' && baselineWindow) {
      const result = orientationCalibration.analyzeForwardTest(baselineWindow, window);
      setForwardResult(result);
      // toast suppressed
      setStep('lateral');
    } else if (type === 'lateral' && baselineWindow) {
      const result = orientationCalibration.analyzeLateralTest(baselineWindow, window);
      setLateralResult(result);
      // toast suppressed
      setStep('results');
    }
  };

  const buildAndShowResults = () => {
    if (!forwardResult || !lateralResult || !verticalResult) {
      toast.error('Missing test results');
      return;
    }

    const result = orientationCalibration.buildMapping(forwardResult, lateralResult, verticalResult);
    setMappingResult(result);
  };

  useEffect(() => {
    if (step === 'results' && forwardResult && lateralResult && verticalResult && !mappingResult) {
      buildAndShowResults();
    }
  }, [step, forwardResult, lateralResult, verticalResult]);

  const applyMapping = () => {
    if (!mappingResult) return;
    
    orientationCalibration.applyMapping(mappingResult.mapping);
    orientationCalibration.updateConfidence(mappingResult.confidence);
    // toast suppressed
    setStep('validation');
  };

  const resetWizard = () => {
    setStep('intro');
    setBaselineWindow(null);
    setForwardResult(null);
    setLateralResult(null);
    setVerticalResult(null);
    setMappingResult(null);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-green-400';
    if (confidence >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const renderAxisBadge = (axis: 'X' | 'Y' | 'Z', sign: 1 | -1) => (
    <Badge className={sign > 0 ? 'bg-green-600' : 'bg-red-600'}>
      {sign > 0 ? '+' : '-'}{axis}
    </Badge>
  );

  if (!hasImu) {
    return (
      <Card className="bg-yellow-900/20 border-yellow-700/50">
        <CardContent className="py-6 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-yellow-300 mb-2">IMU Data Not Available</h3>
          <p className="text-sm text-yellow-400 mb-4">
            Accelerometer data is required for axis orientation calibration.
            The Duro is not currently providing IMU data.
          </p>
          <p className="text-xs text-gray-400">
            Falling back to reduced wizard using attitude angles only.
            Results may have lower confidence.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Box className="w-4 h-4 text-purple-400" />
            Vehicle Frame Convention
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <ArrowUp className="w-5 h-5 text-red-400" />
              <span><strong>X</strong>: Forward (+ve forward)</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-green-400" />
              <span><strong>Y</strong>: Right (+ve right)</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowDown className="w-5 h-5 rotate-180 text-blue-400" />
              <span><strong>Z</strong>: Up (+ve up)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {step === 'intro' && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Axis Orientation Wizard</CardTitle>
          </CardHeader>
          <CardContent className="py-4 space-y-4">
            <p className="text-sm text-gray-300">
              This wizard will help you identify how the Duro's axes map to your vehicle's coordinate frame.
              You'll perform three simple tests:
            </p>
            <ol className="list-decimal list-inside text-sm text-gray-400 space-y-2">
              <li>Baseline capture (stationary, 5 seconds)</li>
              <li>Forward acceleration/braking test (10-20 seconds)</li>
              <li>Left/right turn test (10-20 seconds)</li>
            </ol>
            <p className="text-xs text-gray-500">
              Make sure the vehicle is on a level surface before starting.
            </p>
            <Button onClick={() => setStep('baseline')} data-testid="button-start-axis-wizard">
              <Play className="w-4 h-4 mr-2" />
              Start Wizard
            </Button>

            {currentMapping && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="text-sm text-gray-400 mb-2">Current Mapping:</div>
                <div className="flex gap-4 text-sm">
                  <div>X_vehicle = {renderAxisBadge(currentMapping.vehicleX.duroAxis, currentMapping.vehicleX.sign)}</div>
                  <div>Y_vehicle = {renderAxisBadge(currentMapping.vehicleY.duroAxis, currentMapping.vehicleY.sign)}</div>
                  <div>Z_vehicle = {renderAxisBadge(currentMapping.vehicleZ.duroAxis, currentMapping.vehicleZ.sign)}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'baseline' && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Car className="w-4 h-4" />
              Test A: Baseline Capture
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4 space-y-4">
            <p className="text-sm text-gray-300">
              Keep the vehicle completely still on a level surface for 5 seconds.
              This establishes the gravity vector direction.
            </p>
            
            {isCapturing ? (
              <div className="space-y-2">
                <Progress value={captureProgress} />
                <div className="text-sm text-center text-gray-400">
                  Capturing... Keep vehicle still
                </div>
              </div>
            ) : (
              <Button 
                onClick={() => startCapture('baseline', 5)}
                data-testid="button-capture-baseline"
              >
                <Play className="w-4 h-4 mr-2" />
                Capture Baseline (5s)
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'forward' && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowUp className="w-4 h-4 text-red-400" />
              Test B: Forward Acceleration
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4 space-y-4">
            <p className="text-sm text-gray-300">
              Start recording, then accelerate forward gently, and brake gently.
              This identifies the longitudinal (X) axis.
            </p>
            
            {isCapturing ? (
              <div className="space-y-2">
                <Progress value={captureProgress} />
                <div className="text-sm text-center text-gray-400">
                  Recording... Accelerate and brake
                </div>
                <Button variant="destructive" onClick={() => stopCapture('forward')}>
                  <Square className="w-4 h-4 mr-2" />
                  Stop Early
                </Button>
              </div>
            ) : (
              <Button 
                onClick={() => startCapture('forward', 15)}
                data-testid="button-test-forward"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Forward Test (15s)
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'lateral' && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-green-400" />
              Test C: Lateral Movement
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4 space-y-4">
            <p className="text-sm text-gray-300">
              Start recording, then make gentle turns right and left.
              This identifies the lateral (Y) axis.
            </p>
            
            {isCapturing ? (
              <div className="space-y-2">
                <Progress value={captureProgress} />
                <div className="text-sm text-center text-gray-400">
                  Recording... Turn right then left
                </div>
                <Button variant="destructive" onClick={() => stopCapture('lateral')}>
                  <Square className="w-4 h-4 mr-2" />
                  Stop Early
                </Button>
              </div>
            ) : (
              <Button 
                onClick={() => startCapture('lateral', 15)}
                data-testid="button-test-lateral"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Lateral Test (15s)
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'results' && mappingResult && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Calibration Results</CardTitle>
          </CardHeader>
          <CardContent className="py-4 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-900 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">X (Forward)</div>
                <div className="text-lg">
                  {renderAxisBadge(mappingResult.mapping.vehicleX.duroAxis, mappingResult.mapping.vehicleX.sign)}
                </div>
                <div className={`text-xs mt-1 ${getConfidenceColor(mappingResult.confidence.x)}`}>
                  {mappingResult.confidence.x.toFixed(0)}% confidence
                </div>
              </div>
              <div className="bg-gray-900 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Y (Right)</div>
                <div className="text-lg">
                  {renderAxisBadge(mappingResult.mapping.vehicleY.duroAxis, mappingResult.mapping.vehicleY.sign)}
                </div>
                <div className={`text-xs mt-1 ${getConfidenceColor(mappingResult.confidence.y)}`}>
                  {mappingResult.confidence.y.toFixed(0)}% confidence
                </div>
              </div>
              <div className="bg-gray-900 rounded p-3">
                <div className="text-xs text-gray-400 mb-1">Z (Up)</div>
                <div className="text-lg">
                  {renderAxisBadge(mappingResult.mapping.vehicleZ.duroAxis, mappingResult.mapping.vehicleZ.sign)}
                </div>
                <div className={`text-xs mt-1 ${getConfidenceColor(mappingResult.confidence.z)}`}>
                  {mappingResult.confidence.z.toFixed(0)}% confidence
                </div>
              </div>
            </div>

            <div className={`text-center text-lg font-medium ${getConfidenceColor(mappingResult.confidence.overall)}`}>
              Overall Confidence: {mappingResult.confidence.overall.toFixed(0)}%
            </div>

            {mappingResult.suggestions.length > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-700/50 rounded p-3">
                <div className="text-sm text-yellow-400 font-medium mb-1">Suggestions:</div>
                <ul className="text-xs text-yellow-300 space-y-1">
                  {mappingResult.suggestions.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={resetWizard}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Restart
              </Button>
              <Button onClick={applyMapping} data-testid="button-apply-axis-mapping">
                <Check className="w-4 h-4 mr-2" />
                Apply Mapping
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'validation' && (
        <Card className="bg-green-900/20 border-green-700/50">
          <CardContent className="py-6 text-center">
            <Check className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-green-300 mb-2">Calibration Complete</h3>
            <p className="text-sm text-green-400 mb-4">
              Axis mapping has been applied. You can now use the Live Validation panel
              to verify orientation on a flat surface.
            </p>
            <Button variant="outline" onClick={resetWizard}>
              Run Again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
