/**
 * Wind Blade Transport Settings Component
 * Configure vehicle geometry and K-factor/radius thresholds for ground contact detection
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Wind, Save, RotateCcw, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import type { WindBladeConfig } from '@/lib/roadProfile/types';
import {
  DEFAULT_WIND_BLADE_CONFIG,
  loadWindBladeConfig,
  saveWindBladeConfig,
  kFactorToRadius,
  radiusToKFactor
} from '@/lib/roadProfile/windBladeUtils';

export function WindBladeSettings() {
  const [config, setConfig] = useState<WindBladeConfig>(DEFAULT_WIND_BLADE_CONFIG);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setConfig(loadWindBladeConfig());
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      saveWindBladeConfig(config);
      // toast suppressed
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_WIND_BLADE_CONFIG);
    // toast suppressed
  };

  const updateConfig = (key: keyof WindBladeConfig, value: number | boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const toggleUseRadius = () => {
    setConfig(prev => {
      const newUseRadius = !prev.useRadius;
      if (newUseRadius) {
        return {
          ...prev,
          useRadius: true,
          convexThreshold: kFactorToRadius(prev.convexThreshold),
          concaveThreshold: kFactorToRadius(prev.concaveThreshold)
        };
      } else {
        return {
          ...prev,
          useRadius: false,
          convexThreshold: radiusToKFactor(prev.convexThreshold),
          concaveThreshold: radiusToKFactor(prev.concaveThreshold)
        };
      }
    });
  };

  const thresholdLabel = config.useRadius ? 'Radius (m)' : 'K-Factor';

  return (
    <Card className="w-full" data-testid="card-wind-blade-settings">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wind className="h-5 w-5" />
          <span>Wind Blade Transport</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 mt-0.5 text-blue-400" />
            <p className="text-gray-300">
              Configure vehicle geometry to detect ground contact risk on vertical curves.
              Alerts only trigger when thresholds are exceeded over the minimum detection distance.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="total-length">Total Transport Length (m)</Label>
            <Input
              id="total-length"
              type="number"
              min="10"
              max="200"
              step="1"
              value={config.totalLength_m}
              onChange={(e) => updateConfig('totalLength_m', parseFloat(e.target.value) || 0)}
              className="bg-gray-800 border-gray-700"
              data-testid="input-total-length"
            />
            <p className="text-xs text-gray-500">Truck + trailer + load</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rear-overhang">Rear Overhang (m)</Label>
            <Input
              id="rear-overhang"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={config.rearOverhang_m}
              onChange={(e) => updateConfig('rearOverhang_m', parseFloat(e.target.value) || 0)}
              className="bg-gray-800 border-gray-700"
              data-testid="input-rear-overhang"
            />
            <p className="text-xs text-gray-500">Beyond last axle</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ground-clearance">Ground Clearance (m)</Label>
            <Input
              id="ground-clearance"
              type="number"
              min="0.05"
              max="2"
              step="0.05"
              value={config.groundClearance_m}
              onChange={(e) => updateConfig('groundClearance_m', parseFloat(e.target.value) || 0)}
              className="bg-gray-800 border-gray-700"
              data-testid="input-ground-clearance"
            />
            <p className="text-xs text-gray-500">Minimum at rest</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min-distance">Min Detection Distance (m)</Label>
            <Input
              id="min-distance"
              type="number"
              min="50"
              max="500"
              step="10"
              value={config.minDetectionDistance_m}
              onChange={(e) => updateConfig('minDetectionDistance_m', parseFloat(e.target.value) || 0)}
              className="bg-gray-800 border-gray-700"
              data-testid="input-min-distance"
            />
            <p className="text-xs text-gray-500">Sustained distance for alert</p>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-4">
          <div className="flex items-center justify-between mb-4">
            <Label className="text-base">Threshold Mode</Label>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${!config.useRadius ? 'text-green-400' : 'text-gray-500'}`}>
                K-Factor
              </span>
              <Switch
                checked={config.useRadius}
                onCheckedChange={toggleUseRadius}
                data-testid="switch-use-radius"
              />
              <span className={`text-sm ${config.useRadius ? 'text-green-400' : 'text-gray-500'}`}>
                Radius
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="convex-threshold" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-orange-400" />
                Convex (Crest) {thresholdLabel}
              </Label>
              <Input
                id="convex-threshold"
                type="number"
                min="100"
                max="100000"
                step="100"
                value={config.convexThreshold}
                onChange={(e) => updateConfig('convexThreshold', parseFloat(e.target.value) || 0)}
                className="bg-gray-800 border-gray-700"
                data-testid="input-convex-threshold"
              />
              <p className="text-xs text-gray-500">
                {config.useRadius 
                  ? `K ≈ ${radiusToKFactor(config.convexThreshold).toFixed(0)}`
                  : `R ≈ ${kFactorToRadius(config.convexThreshold).toFixed(0)}m`
                }
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="concave-threshold" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-blue-400" />
                Concave (Sag) {thresholdLabel}
              </Label>
              <Input
                id="concave-threshold"
                type="number"
                min="100"
                max="100000"
                step="100"
                value={config.concaveThreshold}
                onChange={(e) => updateConfig('concaveThreshold', parseFloat(e.target.value) || 0)}
                className="bg-gray-800 border-gray-700"
                data-testid="input-concave-threshold"
              />
              <p className="text-xs text-gray-500">
                {config.useRadius 
                  ? `K ≈ ${radiusToKFactor(config.concaveThreshold).toFixed(0)}`
                  : `R ≈ ${kFactorToRadius(config.concaveThreshold).toFixed(0)}m`
                }
              </p>
            </div>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-400" />
            <div className="text-gray-300">
              <p className="font-medium mb-1">Risk Detection:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><span className="text-orange-400">Crest curves</span>: Rear overhang tip may touch ground</li>
                <li><span className="text-blue-400">Sag curves</span>: Middle section/belly may touch ground</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1"
            data-testid="button-save-wind-blade"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            className="border-gray-600"
            data-testid="button-reset-wind-blade"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default WindBladeSettings;
