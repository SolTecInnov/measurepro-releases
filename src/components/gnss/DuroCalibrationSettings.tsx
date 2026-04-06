import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  RotateCcw, 
  Save, 
  Info, 
  AlertTriangle,
  CheckCircle,
  Compass,
  Move3d,
  Car,
  RotateCw,
  Cable
} from 'lucide-react';
import { toast } from 'sonner';

import duroAxisOrientationImg from '@assets/IMG_1359_1768528798113.jpeg';
import duroAntennaOffsetImg from '@assets/IMG_1360_1768528798113.jpeg';
import duroConnectorsImg from '@assets/IMG_1361_1768528798113.jpeg';

interface DuroCalibration {
  vehicleFrameYaw: number;
  vehicleFramePitch: number;
  vehicleFrameRoll: number;
  antennaOffsetX: number;
  antennaOffsetY: number;
  antennaOffsetZ: number;
  mountingPreset: string;
}

const STORAGE_KEY = 'duro-calibration-settings';

const DEFAULT_CALIBRATION: DuroCalibration = {
  vehicleFrameYaw: 0,
  vehicleFramePitch: 0,
  vehicleFrameRoll: 0,
  antennaOffsetX: 0,
  antennaOffsetY: 0,
  antennaOffsetZ: 0,
  mountingPreset: 'standard'
};

const MOUNTING_PRESETS = [
  { id: 'standard', label: 'Standard (Logo Up, X Forward)', yaw: 0, pitch: 0, roll: 0 },
  { id: 'upside-down', label: 'Upside Down (Logo Down)', yaw: 0, pitch: 0, roll: 180 },
  { id: 'sideways-left', label: 'Sideways (X pointing Left)', yaw: 90, pitch: 0, roll: 0 },
  { id: 'sideways-right', label: 'Sideways (X pointing Right)', yaw: 270, pitch: 0, roll: 0 },
  { id: 'backwards', label: 'Backwards (X pointing Rear)', yaw: 180, pitch: 0, roll: 0 },
  { id: 'vertical-up', label: 'Vertical (X pointing Up)', yaw: 0, pitch: 90, roll: 0 },
  { id: 'vertical-down', label: 'Vertical (X pointing Down)', yaw: 0, pitch: 270, roll: 0 },
  { id: 'custom', label: 'Custom Configuration', yaw: 0, pitch: 0, roll: 0 }
];

export function DuroCalibrationSettings() {
  const [calibration, setCalibration] = useState<DuroCalibration>(DEFAULT_CALIBRATION);
  const [hasChanges, setHasChanges] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setCalibration(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to load calibration settings:', e);
      }
    }
  }, []);

  const handlePresetChange = (presetId: string) => {
    const preset = MOUNTING_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setCalibration(prev => ({
        ...prev,
        mountingPreset: presetId,
        vehicleFrameYaw: preset.yaw,
        vehicleFramePitch: preset.pitch,
        vehicleFrameRoll: preset.roll
      }));
      setHasChanges(true);
    }
  };

  const handleValueChange = (field: keyof DuroCalibration, value: number) => {
    setCalibration(prev => ({
      ...prev,
      [field]: value,
      mountingPreset: 'custom'
    }));
    setHasChanges(true);
  };

  const handleAntennaChange = (field: 'antennaOffsetX' | 'antennaOffsetY' | 'antennaOffsetZ', value: number) => {
    setCalibration(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calibration));
    setHasChanges(false);
    toast.success('Calibration settings saved');
  };

  const handleReset = () => {
    setCalibration(DEFAULT_CALIBRATION);
    setHasChanges(true);
  };

  return (
    <div className="space-y-6">
      {/* Instructions Section */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Info className="h-5 w-5 text-blue-400" />
              Duro Installation & Calibration Guide
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInstructions(!showInstructions)}
              data-testid="button-toggle-instructions"
            >
              {showInstructions ? 'Hide' : 'Show'}
            </Button>
          </div>
        </CardHeader>
        {showInstructions && (
          <CardContent className="space-y-4 text-sm">
            {/* Mounting Requirements */}
            <div className="bg-gray-900 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-400 flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4" />
                Mounting Requirements
              </h4>
              <ul className="space-y-2 text-gray-300">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Rigid mounting required</strong> - Mount on a solid, vibration-free surface (chassis floor, seat rails, spare tire bay)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Orthogonal alignment</strong> - All angles should be multiples of 90° (0°, 90°, 180°, 270°)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Antenna connection</strong> - GNSS antenna must be on the same rigid body as the Duro unit</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                  <span><strong>Clear sky view</strong> - Antenna needs unobstructed view of the sky for satellite reception</span>
                </li>
              </ul>
            </div>

            {/* Reference Frame */}
            <div className="bg-gray-900 rounded-lg p-4">
              <h4 className="font-semibold text-blue-400 flex items-center gap-2 mb-3">
                <Compass className="h-4 w-4" />
                Duro Reference Frame
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 text-gray-300">
                  <p><strong>Origin:</strong> Intersection of top reference mark and bottom surface of enclosure</p>
                  <p><strong>X-axis:</strong> Points forward (direction of travel in standard mount)</p>
                  <p><strong>Y-axis:</strong> Points left (perpendicular to X)</p>
                  <p><strong>Z-axis:</strong> Points downward from device</p>
                </div>
                <div className="bg-gray-800 rounded p-2">
                  <img 
                    src={duroAxisOrientationImg} 
                    alt="Duro axis orientation - Top, Front, and Side views showing X, Y, Z axes"
                    className="w-full h-auto rounded max-h-48 object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Auto-Calibration */}
            <div className="bg-gray-900 rounded-lg p-4">
              <h4 className="font-semibold text-green-400 flex items-center gap-2 mb-3">
                <RotateCw className="h-4 w-4" />
                Automatic Calibration Process
              </h4>
              <ol className="space-y-2 text-gray-300 list-decimal list-inside">
                <li>Power on the Duro and wait for GNSS fix (ensure clear sky view)</li>
                <li>Once GNSS fix is acquired, <strong>drive the vehicle forward</strong> for 30-60 seconds</li>
                <li>The IMU will automatically align and calibrate during motion</li>
                <li>Purple POS LED indicates INS is active and fused solution is being output</li>
                <li><strong>No manual zero calibration needed</strong> - the device auto-calibrates</li>
              </ol>
              <div className="mt-3 p-2 bg-blue-900/30 rounded border border-blue-700 text-blue-300 text-xs">
                <strong>Note:</strong> Calibration improves over time with vehicle motion. Initial accuracy may be lower until IMU fully converges.
              </div>
            </div>

            {/* Antenna Placement */}
            <div className="bg-gray-900 rounded-lg p-4">
              <h4 className="font-semibold text-purple-400 flex items-center gap-2 mb-3">
                <Move3d className="h-4 w-4" />
                Antenna Offset Measurement
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 text-gray-300">
                  <p>Measure the distance from the Duro reference point to the antenna phase center:</p>
                  <ul className="ml-4 space-y-1">
                    <li><strong>X offset:</strong> Forward (+) or backward (-) distance in meters</li>
                    <li><strong>Y offset:</strong> Left (+) or right (-) distance in meters</li>
                    <li><strong>Z offset:</strong> Down (+) or up (-) distance in meters</li>
                  </ul>
                  <p className="text-yellow-400 text-xs mt-2">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    Accurate antenna offset is critical for precise positioning, especially during turns and at high speeds.
                  </p>
                </div>
                <div className="bg-gray-800 rounded p-2">
                  <img 
                    src={duroAntennaOffsetImg} 
                    alt="Antenna offset measurement - X, Y, Z distances from Duro to antenna phase center"
                    className="w-full h-auto rounded max-h-48 object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Connectors */}
            <div className="bg-gray-900 rounded-lg p-4">
              <h4 className="font-semibold text-cyan-400 flex items-center gap-2 mb-3">
                <Cable className="h-4 w-4" />
                Duro Connectors
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 text-gray-300">
                  <ul className="space-y-1">
                    <li><strong>Ethernet:</strong> Network connection for data output and configuration</li>
                    <li><strong>Serial:</strong> RS-232 serial port for NMEA output</li>
                    <li><strong>Power:</strong> 9-36V DC power input</li>
                    <li><strong>AUX:</strong> Auxiliary port for external sensors</li>
                    <li><strong>GNSS Antenna:</strong> TNC connector for GNSS antenna cable</li>
                  </ul>
                </div>
                <div className="bg-gray-800 rounded p-2">
                  <img 
                    src={duroConnectorsImg} 
                    alt="Duro front panel connectors - Ethernet, Serial, Power, AUX, and GNSS Antenna ports"
                    className="w-full h-auto rounded max-h-48 object-contain"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Mounting Preset */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Car className="h-5 w-5 text-orange-400" />
            Mounting Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Mounting Preset</label>
            <select
              value={calibration.mountingPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white"
              data-testid="select-mounting-preset"
            >
              {MOUNTING_PRESETS.map(preset => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
          </div>

          {/* Vehicle Frame Orientation */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Yaw (Z rotation)</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={360}
                  step={90}
                  value={calibration.vehicleFrameYaw}
                  onChange={(e) => handleValueChange('vehicleFrameYaw', parseFloat(e.target.value) || 0)}
                  className="bg-gray-900 border-gray-700"
                  data-testid="input-yaw"
                />
                <span className="text-gray-400">°</span>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Pitch (Y rotation)</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={360}
                  step={90}
                  value={calibration.vehicleFramePitch}
                  onChange={(e) => handleValueChange('vehicleFramePitch', parseFloat(e.target.value) || 0)}
                  className="bg-gray-900 border-gray-700"
                  data-testid="input-pitch"
                />
                <span className="text-gray-400">°</span>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Roll (X rotation)</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={360}
                  step={90}
                  value={calibration.vehicleFrameRoll}
                  onChange={(e) => handleValueChange('vehicleFrameRoll', parseFloat(e.target.value) || 0)}
                  className="bg-gray-900 border-gray-700"
                  data-testid="input-roll"
                />
                <span className="text-gray-400">°</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Rotation order: Z (yaw) → Y (pitch) → X (roll). Values should be multiples of 90° for best accuracy.
          </div>
        </CardContent>
      </Card>

      {/* Antenna Offset */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Move3d className="h-5 w-5 text-purple-400" />
            Antenna Offset (meters)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">X (forward/back)</label>
              <Input
                type="number"
                step={0.01}
                value={calibration.antennaOffsetX}
                onChange={(e) => handleAntennaChange('antennaOffsetX', parseFloat(e.target.value) || 0)}
                className="bg-gray-900 border-gray-700"
                data-testid="input-antenna-x"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Y (left/right)</label>
              <Input
                type="number"
                step={0.01}
                value={calibration.antennaOffsetY}
                onChange={(e) => handleAntennaChange('antennaOffsetY', parseFloat(e.target.value) || 0)}
                className="bg-gray-900 border-gray-700"
                data-testid="input-antenna-y"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Z (down/up)</label>
              <Input
                type="number"
                step={0.01}
                value={calibration.antennaOffsetZ}
                onChange={(e) => handleAntennaChange('antennaOffsetZ', parseFloat(e.target.value) || 0)}
                className="bg-gray-900 border-gray-700"
                data-testid="input-antenna-z"
              />
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Measure from Duro reference point (bottom surface) to antenna phase center. Use positive values for forward/left/down.
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleReset}
          className="border-gray-600"
          data-testid="button-reset-calibration"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Default
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges}
          className={hasChanges ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600'}
          data-testid="button-save-calibration"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
      </div>

      {hasChanges && (
        <div className="text-center text-yellow-400 text-sm">
          <AlertTriangle className="h-4 w-4 inline mr-1" />
          You have unsaved changes
        </div>
      )}
    </div>
  );
}
