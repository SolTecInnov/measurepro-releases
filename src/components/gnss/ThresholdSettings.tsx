/**
 * Threshold Settings Component
 * Configure grade and K-factor detection thresholds
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Settings, Save } from 'lucide-react';
import { toast } from 'sonner';

interface ThresholdConfig {
  grade_trigger_pct: number;
  k_factor_convex_warning: number;
  k_factor_convex_critical: number;
  k_factor_concave_warning: number;
  k_factor_concave_critical: number;
  rail_crossing_threshold_m: number;
  profile_step_m: number;
}

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  grade_trigger_pct: 12,
  k_factor_convex_warning: 10000,
  k_factor_convex_critical: 5000,
  k_factor_concave_warning: -8000,
  k_factor_concave_critical: -4000,
  rail_crossing_threshold_m: 0.15,
  profile_step_m: 5,
};

export function ThresholdSettings() {
  const [thresholds, setThresholds] = useState<ThresholdConfig>(DEFAULT_THRESHOLDS);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadThresholds();
  }, []);

  const loadThresholds = () => {
    try {
      const saved = localStorage.getItem('gnss_thresholds');
      if (saved) {
        setThresholds(JSON.parse(saved));
      }
    } catch (error) {
      // Use defaults
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage
      localStorage.setItem('gnss_thresholds', JSON.stringify(thresholds));
      
      // Optionally save to backend via API
      // await updateThresholds(thresholds);
      
      toast.success('Threshold settings saved');
    } catch (error) {
      toast.error('Failed to save threshold settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setThresholds(DEFAULT_THRESHOLDS);
    toast.success('Reset to default thresholds');
  };

  const updateThreshold = (key: keyof ThresholdConfig, value: number) => {
    setThresholds(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card className="w-full" data-testid="card-threshold-settings">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5" />
          <span>Detection Thresholds</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Grade Trigger */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="grade-trigger">Grade Trigger (%)</Label>
            <span className="text-sm font-mono text-gray-400" data-testid="value-grade-trigger">
              {thresholds.grade_trigger_pct}%
            </span>
          </div>
          <input
            id="grade-trigger"
            type="range"
            min="5"
            max="20"
            step="0.5"
            value={thresholds.grade_trigger_pct}
            onChange={(e) => updateThreshold('grade_trigger_pct', Number(e.target.value))}
            className="w-full"
            data-testid="slider-grade-trigger"
          />
          <div className="text-xs text-gray-500">
            Alert when road grade exceeds this percentage (uphill or downhill)
          </div>
        </div>

        {/* K-Factor Convex (Crests) */}
        <div className="space-y-3 p-4 bg-red-900/10 border border-red-900/30 rounded">
          <div className="font-medium text-sm flex items-center gap-2">
            <span className="text-red-500">▲</span>
            K-Factor Convex (Crests)
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="k-convex-warning">Warning Threshold</Label>
              <span className="text-sm font-mono text-gray-400" data-testid="value-k-convex-warning">
                {thresholds.k_factor_convex_warning}m
              </span>
            </div>
            <input
              id="k-convex-warning"
              type="range"
              min="5000"
              max="20000"
              step="500"
              value={thresholds.k_factor_convex_warning}
              onChange={(e) => updateThreshold('k_factor_convex_warning', Number(e.target.value))}
              className="w-full"
              data-testid="slider-k-convex-warning"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="k-convex-critical">Critical Threshold</Label>
              <span className="text-sm font-mono text-gray-400" data-testid="value-k-convex-critical">
                {thresholds.k_factor_convex_critical}m
              </span>
            </div>
            <input
              id="k-convex-critical"
              type="range"
              min="1000"
              max="10000"
              step="500"
              value={thresholds.k_factor_convex_critical}
              onChange={(e) => updateThreshold('k_factor_convex_critical', Number(e.target.value))}
              className="w-full"
              data-testid="slider-k-convex-critical"
            />
          </div>

          <div className="text-xs text-gray-500">
            Smaller K-values = sharper crest. Critical alerts for dangerous crests.
          </div>
        </div>

        {/* K-Factor Concave (Sags) */}
        <div className="space-y-3 p-4 bg-blue-900/10 border border-blue-900/30 rounded">
          <div className="font-medium text-sm flex items-center gap-2">
            <span className="text-blue-500">▼</span>
            K-Factor Concave (Sags)
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="k-concave-warning">Warning Threshold</Label>
              <span className="text-sm font-mono text-gray-400" data-testid="value-k-concave-warning">
                {thresholds.k_factor_concave_warning}m
              </span>
            </div>
            <input
              id="k-concave-warning"
              type="range"
              min="-15000"
              max="-3000"
              step="500"
              value={thresholds.k_factor_concave_warning}
              onChange={(e) => updateThreshold('k_factor_concave_warning', Number(e.target.value))}
              className="w-full"
              data-testid="slider-k-concave-warning"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="k-concave-critical">Critical Threshold</Label>
              <span className="text-sm font-mono text-gray-400" data-testid="value-k-concave-critical">
                {thresholds.k_factor_concave_critical}m
              </span>
            </div>
            <input
              id="k-concave-critical"
              type="range"
              min="-8000"
              max="-1000"
              step="500"
              value={thresholds.k_factor_concave_critical}
              onChange={(e) => updateThreshold('k_factor_concave_critical', Number(e.target.value))}
              className="w-full"
              data-testid="slider-k-concave-critical"
            />
          </div>

          <div className="text-xs text-gray-500">
            More negative K-values = sharper sag. Critical alerts for dangerous sags.
          </div>
        </div>

        {/* Rail Crossing Detection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="rail-threshold">Rail Crossing Elevation Threshold (m)</Label>
            <span className="text-sm font-mono text-gray-400" data-testid="value-rail-threshold">
              {thresholds.rail_crossing_threshold_m}m
            </span>
          </div>
          <input
            id="rail-threshold"
            type="range"
            min="0.05"
            max="0.5"
            step="0.05"
            value={thresholds.rail_crossing_threshold_m}
            onChange={(e) => updateThreshold('rail_crossing_threshold_m', Number(e.target.value))}
            className="w-full"
            data-testid="slider-rail-threshold"
          />
          <div className="text-xs text-gray-500">
            Auto-detect rail crossings when elevation bump exceeds this threshold
          </div>
        </div>

        {/* Profile Resampling Step */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="profile-step">Profile Resampling Step (m)</Label>
            <span className="text-sm font-mono text-gray-400" data-testid="value-profile-step">
              {thresholds.profile_step_m}m
            </span>
          </div>
          <input
            id="profile-step"
            type="range"
            min="1"
            max="20"
            step="1"
            value={thresholds.profile_step_m}
            onChange={(e) => updateThreshold('profile_step_m', Number(e.target.value))}
            className="w-full"
            data-testid="slider-profile-step"
          />
          <div className="text-xs text-gray-500">
            Distance interval for resampling GPS points when generating profile. Smaller = more detail, larger file.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t border-gray-700">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1"
            data-testid="button-save-thresholds"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Thresholds'}
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            data-testid="button-reset-thresholds"
          >
            Reset to Defaults
          </Button>
        </div>

        {/* Info Box */}
        <div className="text-xs text-gray-500 p-3 bg-gray-900/30 rounded">
          <strong>Recommendations for heavy transport:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Grade trigger: 12% (Grades steeper than 1:8 require special consideration)</li>
            <li>K-factor convex: 5000m critical (Sharp crests cause loads to shift)</li>
            <li>K-factor concave: -4000m critical (Sharp sags stress vehicle suspension)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
