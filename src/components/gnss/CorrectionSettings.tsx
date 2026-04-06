/**
 * Correction Settings Component
 * NTRIP/PPP/RTK configuration and status
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Radio, Satellite, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getCorrectionStatus, updateCorrectionSettings } from '@/lib/gnssApi';
import type { CorrectionStatus, CorrectionType } from '../../../server/gnss/types';

export function CorrectionSettings() {
  const [correctionType, setCorrectionType] = useState<CorrectionType>('none');
  const [enabled, setEnabled] = useState(false);
  const [ntripSettings, setNtripSettings] = useState({
    host: '',
    port: 2101,
    mountpoint: '',
    username: '',
    password: '',
  });
  const [status, setStatus] = useState<CorrectionStatus | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000); // Update every 5s
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const correctionStatus = await getCorrectionStatus();
      setStatus(correctionStatus);
      setCorrectionType(correctionStatus.type);
      setEnabled(correctionStatus.active);
    } catch (error) {
      // Silently fail on status fetch
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCorrectionSettings({
        type: correctionType,
        enabled,
        ntrip: correctionType === 'rtk' || correctionType === 'ppp' ? ntripSettings : undefined,
      });
      toast.success('Correction settings saved');
      await loadStatus();
    } catch (error) {
      toast.error('Failed to save correction settings');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusIcon = () => {
    if (!status || !status.active) {
      return <XCircle className="h-5 w-5 text-gray-500" />;
    }
    if (status.error) {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
    if (status.type === 'ppp' && !status.converged) {
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
    return <CheckCircle className="h-5 w-5 text-green-500" />;
  };

  const getStatusText = () => {
    if (!status || !status.active) {
      return 'Inactive';
    }
    if (status.error) {
      return `Error: ${status.error}`;
    }
    if (status.type === 'ppp') {
      if (status.converged) {
        return `PPP Converged (${status.convergence_time_s}s)`;
      } else {
        return 'PPP Converging...';
      }
    }
    if (status.type === 'rtk') {
      return `RTK Active${status.base_station ? ` (${status.base_station})` : ''}`;
    }
    return 'Active';
  };

  return (
    <Card className="w-full" data-testid="card-correction-settings">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            <span>Correction Services</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-normal" data-testid="status-correction">
            {getStatusIcon()}
            <span className="text-gray-400">{getStatusText()}</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded border border-gray-700">
          <div>
            <div className="font-medium">Enable Corrections</div>
            <div className="text-sm text-gray-400">Use differential correction for improved accuracy</div>
          </div>
          <Button
            onClick={() => setEnabled(!enabled)}
            variant={enabled ? 'default' : 'outline'}
            data-testid="button-toggle-correction"
          >
            {enabled ? 'Enabled' : 'Disabled'}
          </Button>
        </div>

        {/* Correction Type Selector */}
        <div>
          <Label>Correction Type</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {(['none', 'ppp', 'rtk', 'sbas'] as CorrectionType[]).map(type => (
              <button
                key={type}
                onClick={() => setCorrectionType(type)}
                className={`px-4 py-2 rounded border ${
                  correctionType === type
                    ? 'bg-blue-600 border-blue-500'
                    : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                }`}
                data-testid={`button-correction-${type}`}
              >
                {type.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-400">
            {correctionType === 'none' && 'Standalone GPS (no corrections)'}
            {correctionType === 'ppp' && 'Precise Point Positioning via Skylark or similar service'}
            {correctionType === 'rtk' && 'Real-Time Kinematic via NTRIP base station'}
            {correctionType === 'sbas' && 'Satellite-Based Augmentation System (WAAS/EGNOS)'}
          </div>
        </div>

        {/* NTRIP Settings (for PPP/RTK) */}
        {(correctionType === 'rtk' || correctionType === 'ppp') && (
          <div className="space-y-3 p-4 bg-gray-900/50 rounded border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Satellite className="h-4 w-4" />
              <span className="font-medium">NTRIP Configuration</span>
            </div>
            
            <div>
              <Label htmlFor="ntrip-host">Host</Label>
              <Input
                id="ntrip-host"
                value={ntripSettings.host}
                onChange={(e) => setNtripSettings(prev => ({ ...prev, host: e.target.value }))}
                placeholder="ntrip.example.com"
                data-testid="input-ntrip-host"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ntrip-port">Port</Label>
                <Input
                  id="ntrip-port"
                  type="number"
                  value={ntripSettings.port}
                  onChange={(e) => setNtripSettings(prev => ({ ...prev, port: Number(e.target.value) }))}
                  data-testid="input-ntrip-port"
                />
              </div>
              <div>
                <Label htmlFor="ntrip-mountpoint">Mountpoint</Label>
                <Input
                  id="ntrip-mountpoint"
                  value={ntripSettings.mountpoint}
                  onChange={(e) => setNtripSettings(prev => ({ ...prev, mountpoint: e.target.value }))}
                  placeholder="RTCM3"
                  data-testid="input-ntrip-mountpoint"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ntrip-username">Username (optional)</Label>
                <Input
                  id="ntrip-username"
                  value={ntripSettings.username}
                  onChange={(e) => setNtripSettings(prev => ({ ...prev, username: e.target.value }))}
                  data-testid="input-ntrip-username"
                />
              </div>
              <div>
                <Label htmlFor="ntrip-password">Password (optional)</Label>
                <Input
                  id="ntrip-password"
                  type="password"
                  value={ntripSettings.password}
                  onChange={(e) => setNtripSettings(prev => ({ ...prev, password: e.target.value }))}
                  data-testid="input-ntrip-password"
                />
              </div>
            </div>

            {status?.ntrip_mountpoint && (
              <div className="text-sm text-green-500">
                ✓ Connected to: {status.ntrip_mountpoint}
              </div>
            )}
          </div>
        )}

        {/* PPP Convergence Status */}
        {correctionType === 'ppp' && status?.type === 'ppp' && status.active && (
          <div className="p-3 bg-blue-900/20 border border-blue-700 rounded">
            <div className="text-sm font-medium mb-1">PPP Convergence</div>
            {status.converged ? (
              <div className="text-sm text-green-400">
                ✓ Converged in {status.convergence_time_s}s
              </div>
            ) : (
              <div className="text-sm text-yellow-400">
                ⏳ Converging... This may take 5-30 minutes
              </div>
            )}
          </div>
        )}

        {/* Save Button */}
        <div className="flex gap-2 pt-2 border-t border-gray-700">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1"
            data-testid="button-save-correction"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
          <Button
            onClick={loadStatus}
            variant="outline"
            data-testid="button-refresh-status"
          >
            Refresh Status
          </Button>
        </div>

        {/* Info Box */}
        <div className="text-xs text-gray-500 p-3 bg-gray-900/30 rounded">
          <strong>Note:</strong> RTK Fixed provides centimeter-level accuracy, PPP provides decimeter-level after convergence.
          SBAS provides meter-level accuracy. For heavy transport route analysis, RTK Fixed or converged PPP is recommended.
        </div>
      </CardContent>
    </Card>
  );
}
