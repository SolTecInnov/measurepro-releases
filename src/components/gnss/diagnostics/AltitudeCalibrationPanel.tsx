/**
 * Altitude Calibration Panel
 * Handles altitude offset calibration with wizard interface
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mountain, Plus, Minus, RotateCcw, Wand2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { altitudeCalibration, type AltitudeCalibration } from '@/lib/calibration/altitude';
import { useGnssData } from '@/hooks/useGnssData';

type CalibrationStep = 'idle' | 'select_method' | 'enter_reference' | 'confirm';
type CalibrationMethod = 'benchmark' | 'phone' | 'manual';

export function AltitudeCalibrationPanel() {
  const { latestSample } = useGnssData();
  const [calibration, setCalibration] = useState<AltitudeCalibration | null>(null);
  const [offset, setOffset] = useState(0);
  const [currentAltitude, setCurrentAltitude] = useState<number | null>(null);
  
  const [wizardStep, setWizardStep] = useState<CalibrationStep>('idle');
  const [selectedMethod, setSelectedMethod] = useState<CalibrationMethod>('benchmark');
  const [referenceAltitude, setReferenceAltitude] = useState('');
  const [calculatedOffset, setCalculatedOffset] = useState(0);

  useEffect(() => {
    altitudeCalibration.load('default-device').then((cal) => {
      if (cal) {
        setCalibration(cal);
        setOffset(cal.offsetM);
      }
    });

    const unsubscribe = altitudeCalibration.subscribe((cal) => {
      if (cal) {
        setCalibration(cal);
        setOffset(cal.offsetM);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (latestSample?.altitude != null) {
      setCurrentAltitude(latestSample.altitude);
    }
  }, [latestSample?.altitude]);

  const adjustOffset = (delta: number) => {
    const newOffset = Math.round((offset + delta) * 100) / 100;
    setOffset(newOffset);
    altitudeCalibration.setOffset(newOffset);
  };

  const resetOffset = () => {
    setOffset(0);
    altitudeCalibration.resetOffset();
    // toast suppressed
  };

  const startWizard = () => {
    setWizardStep('select_method');
    setReferenceAltitude('');
  };

  const cancelWizard = () => {
    setWizardStep('idle');
  };

  const selectMethod = (method: CalibrationMethod) => {
    setSelectedMethod(method);
    setWizardStep('enter_reference');
  };

  const calculateAndConfirm = () => {
    const ref = parseFloat(referenceAltitude);
    if (isNaN(ref)) {
      toast.error('Please enter a valid altitude');
      return;
    }

    if (currentAltitude === null) {
      toast.error('No current altitude reading available');
      return;
    }

    const newOffset = ref - currentAltitude;
    setCalculatedOffset(newOffset);
    setWizardStep('confirm');
  };

  const applyCalibration = () => {
    const ref = parseFloat(referenceAltitude);
    if (currentAltitude !== null) {
      altitudeCalibration.calibrateWithReference(ref, currentAltitude, selectedMethod);
      /* toast removed */
    }
    setWizardStep('idle');
  };

  const correctedAltitude = currentAltitude !== null ? currentAltitude + offset : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mountain className="w-4 h-4 text-green-400" />
              Current Altitude
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-400 mb-1">Raw Altitude</div>
                <div className="text-xl font-mono">
                  {currentAltitude?.toFixed(2) ?? '--'} m
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Corrected Altitude</div>
                <div className="text-xl font-mono text-green-400">
                  {correctedAltitude?.toFixed(2) ?? '--'} m
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-700">
              <div className="text-xs text-gray-400 mb-2">Current Offset</div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => adjustOffset(-5)}
                  data-testid="button-offset-minus-5"
                >
                  <Minus className="w-3 h-3" /> 5
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => adjustOffset(-1)}
                  data-testid="button-offset-minus-1"
                >
                  <Minus className="w-3 h-3" /> 1
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => adjustOffset(-0.5)}
                  data-testid="button-offset-minus-half"
                >
                  <Minus className="w-3 h-3" /> 0.5
                </Button>
                
                <div className="text-xl font-mono text-yellow-400 px-3 min-w-[100px] text-center">
                  {offset >= 0 ? '+' : ''}{offset.toFixed(2)} m
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => adjustOffset(0.5)}
                  data-testid="button-offset-plus-half"
                >
                  <Plus className="w-3 h-3" /> 0.5
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => adjustOffset(1)}
                  data-testid="button-offset-plus-1"
                >
                  <Plus className="w-3 h-3" /> 1
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => adjustOffset(5)}
                  data-testid="button-offset-plus-5"
                >
                  <Plus className="w-3 h-3" /> 5
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetOffset}
                  data-testid="button-reset-offset"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-purple-400" />
              Calibration Wizard
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            {wizardStep === 'idle' && (
              <div className="space-y-3">
                <Button
                  onClick={startWizard}
                  className="w-full"
                  data-testid="button-start-calibration-wizard"
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  Calibrate Now
                </Button>

                {calibration && calibration.calibrationMethod !== 'none' && (
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Last calibrated: {new Date(calibration.calibratedAt).toLocaleString()}</div>
                    <div>Method: {calibration.calibrationMethod}</div>
                    {calibration.referenceAltitude !== undefined && (
                      <div>Reference: {calibration.referenceAltitude.toFixed(2)} m</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {wizardStep === 'select_method' && (
              <div className="space-y-3">
                <div className="text-sm font-medium">Step 1: Choose calibration method</div>
                
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => selectMethod('benchmark')}
                  data-testid="button-method-benchmark"
                >
                  <Check className="w-4 h-4 mr-2 text-green-400" />
                  Known Benchmark Altitude (Recommended)
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => selectMethod('phone')}
                  data-testid="button-method-phone"
                >
                  <Mountain className="w-4 h-4 mr-2 text-yellow-400" />
                  Phone Reference (Less Accurate)
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => selectMethod('manual')}
                  data-testid="button-method-manual"
                >
                  <Mountain className="w-4 h-4 mr-2 text-blue-400" />
                  Manual / Map Reference
                </Button>

                <Button variant="ghost" size="sm" onClick={cancelWizard}>
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
              </div>
            )}

            {wizardStep === 'enter_reference' && (
              <div className="space-y-3">
                <div className="text-sm font-medium">Step 2: Enter reference altitude</div>
                
                <div className="text-xs text-gray-400 mb-2">
                  {selectedMethod === 'benchmark' && 'Enter the known altitude at your current location (e.g., from a survey marker).'}
                  {selectedMethod === 'phone' && 'Enter altitude from your phone GPS. Note: Phone GPS altitude is often inaccurate.'}
                  {selectedMethod === 'manual' && 'Enter altitude from a trusted source (e.g., topographic map, online elevation service).'}
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="reference-altitude">Reference Altitude (m)</Label>
                    <Input
                      id="reference-altitude"
                      type="number"
                      step="0.1"
                      value={referenceAltitude}
                      onChange={(e) => setReferenceAltitude(e.target.value)}
                      placeholder="e.g., 156.5"
                      data-testid="input-reference-altitude"
                    />
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  Current raw altitude: <span className="font-mono">{currentAltitude?.toFixed(2) ?? '--'} m</span>
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={cancelWizard}>
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" onClick={calculateAndConfirm} data-testid="button-calculate-offset">
                    Calculate Offset
                  </Button>
                </div>
              </div>
            )}

            {wizardStep === 'confirm' && (
              <div className="space-y-3">
                <div className="text-sm font-medium">Step 3: Confirm calibration</div>
                
                <div className="bg-gray-900 rounded p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Reference altitude:</span>
                    <span className="font-mono">{parseFloat(referenceAltitude).toFixed(2)} m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Current raw altitude:</span>
                    <span className="font-mono">{currentAltitude?.toFixed(2) ?? '--'} m</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-700 pt-2">
                    <span className="text-gray-400">Calculated offset:</span>
                    <span className="font-mono text-yellow-400">
                      {calculatedOffset >= 0 ? '+' : ''}{calculatedOffset.toFixed(2)} m
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">New corrected altitude:</span>
                    <span className="font-mono text-green-400">
                      {currentAltitude !== null ? (currentAltitude + calculatedOffset).toFixed(2) : '--'} m
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={cancelWizard}>
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" onClick={applyCalibration} data-testid="button-apply-calibration">
                    <Check className="w-4 h-4 mr-1" /> Apply Offset
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-blue-900/20 border-blue-700/50">
        <CardContent className="py-3">
          <div className="text-sm text-blue-300 space-y-1">
            <p><strong>About Altitude Calibration:</strong></p>
            <p className="text-xs text-blue-400">
              GNSS altitude varies by model, reference system (MSL vs ellipsoid), and local atmospheric conditions.
              Calibrating with a known reference point aligns displayed altitude with local ground truth.
            </p>
            <p className="text-xs text-blue-400">
              <strong>Recalibrate after:</strong> Moving &gt;200 km, changing hardware mount, firmware updates, or significant weather changes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
