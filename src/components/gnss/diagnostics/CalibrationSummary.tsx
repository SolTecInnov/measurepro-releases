/**
 * Calibration Summary Card
 * Shows current state of altitude and orientation calibrations with confidence indicators
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, AlertTriangle, XCircle, Mountain, Compass, 
  RefreshCw, Gauge, Download
} from 'lucide-react';
import { altitudeCalibration, type AltitudeCalibration } from '@/lib/calibration/altitude';
import { orientationCalibration, type OrientationCalibration } from '@/lib/calibration/orientation';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';

interface CalibrationSummaryProps {
  deviceId?: string;
  projectId?: string;
  userId?: string;
  onOpenAltitudeWizard?: () => void;
  onOpenOrientationWizard?: () => void;
}

export function CalibrationSummary({
  deviceId = 'default',
  projectId,
  userId,
  onOpenAltitudeWizard,
  onOpenOrientationWizard
}: CalibrationSummaryProps) {
  const [altCal, setAltCal] = useState<AltitudeCalibration | null>(null);
  const [orientCal, setOrientCal] = useState<OrientationCalibration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCalibrations = async () => {
      setLoading(true);
      await altitudeCalibration.load(deviceId, projectId);
      await orientationCalibration.load(deviceId, projectId);
      setLoading(false);
    };

    loadCalibrations();

    const unsubAlt = altitudeCalibration.subscribe(setAltCal);
    const unsubOrient = orientationCalibration.subscribe(setOrientCal);

    return () => {
      unsubAlt();
      unsubOrient();
    };
  }, [deviceId, projectId]);

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return 'text-green-400';
    if (confidence >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) {
      return (
        <Badge className="bg-green-600 text-white">
          <CheckCircle className="w-3 h-3 mr-1" />
          High ({confidence.toFixed(0)}%)
        </Badge>
      );
    }
    if (confidence >= 50) {
      return (
        <Badge className="bg-yellow-600 text-white">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Medium ({confidence.toFixed(0)}%)
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-600 text-white">
        <XCircle className="w-3 h-3 mr-1" />
        Low ({confidence.toFixed(0)}%)
      </Badge>
    );
  };

  const getMethodBadge = (method: AltitudeCalibration['calibrationMethod']) => {
    const styles: Record<string, string> = {
      benchmark: 'bg-green-600',
      phone: 'bg-blue-600',
      manual: 'bg-purple-600',
      none: 'bg-gray-600'
    };
    return (
      <Badge className={`${styles[method]} text-white text-xs`}>
        {method === 'none' ? 'Uncalibrated' : method.charAt(0).toUpperCase() + method.slice(1)}
      </Badge>
    );
  };

  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const exportAllCalibrations = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      deviceId,
      projectId,
      altitudeCalibration: altCal,
      orientationCalibration: orientCal
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    saveAs(blob, `calibrations-${deviceId}-${Date.now()}.json`);
    toast.success('Calibrations exported');
  };

  if (loading) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="py-8 text-center text-gray-500">
          Loading calibrations...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800/50 border-gray-700" data-testid="card-calibration-summary">
      <CardHeader className="py-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <Gauge className="w-4 h-4 text-blue-400" />
          Calibration Summary
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={exportAllCalibrations}
          data-testid="button-export-calibrations"
        >
          <Download className="h-4 w-4 mr-1" />
          Export All
        </Button>
      </CardHeader>
      <CardContent className="py-2 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-gray-900/50 rounded border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Mountain className="w-4 h-4 text-green-400" />
                <span className="font-medium text-sm">Altitude Calibration</span>
              </div>
              {altCal && getMethodBadge(altCal.calibrationMethod)}
            </div>
            
            {altCal ? (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2 text-gray-400">
                  <div>Strategy:</div>
                  <div className="text-white">{altCal.sourceStrategy.replace('_', ' ')}</div>
                  <div>Offset:</div>
                  <div className="text-white font-mono">{altCal.offsetM.toFixed(2)} m</div>
                  {altCal.referenceAltitude !== undefined && (
                    <>
                      <div>Reference:</div>
                      <div className="text-white font-mono">{altCal.referenceAltitude.toFixed(2)} m</div>
                    </>
                  )}
                  <div>Calibrated:</div>
                  <div className="text-white text-xs">{formatDate(altCal.calibratedAt)}</div>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={onOpenAltitudeWizard}
                    data-testid="button-recalibrate-altitude"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Recalibrate
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No calibration data</div>
            )}
          </div>

          <div className="p-3 bg-gray-900/50 rounded border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-400" />
                <span className="font-medium text-sm">Axis Orientation</span>
              </div>
              {orientCal && getConfidenceBadge(orientCal.confidence.overall)}
            </div>
            
            {orientCal ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  {orientCal.validationPassed ? (
                    <Badge className="bg-green-600 text-white text-xs">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Validated
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-600 text-white text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Not Validated
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1 text-xs font-mono">
                  <div className="text-gray-400">X (Forward):</div>
                  <div className="text-white">
                    {orientCal.mapping.vehicleX.sign > 0 ? '+' : '-'}
                    {orientCal.mapping.vehicleX.duroAxis}
                  </div>
                  <div className={getConfidenceColor(orientCal.confidence.x)}>
                    {orientCal.confidence.x.toFixed(0)}%
                  </div>
                  
                  <div className="text-gray-400">Y (Lateral):</div>
                  <div className="text-white">
                    {orientCal.mapping.vehicleY.sign > 0 ? '+' : '-'}
                    {orientCal.mapping.vehicleY.duroAxis}
                  </div>
                  <div className={getConfidenceColor(orientCal.confidence.y)}>
                    {orientCal.confidence.y.toFixed(0)}%
                  </div>
                  
                  <div className="text-gray-400">Z (Vertical):</div>
                  <div className="text-white">
                    {orientCal.mapping.vehicleZ.sign > 0 ? '+' : '-'}
                    {orientCal.mapping.vehicleZ.duroAxis}
                  </div>
                  <div className={getConfidenceColor(orientCal.confidence.z)}>
                    {orientCal.confidence.z.toFixed(0)}%
                  </div>
                </div>

                <div className="text-gray-400 text-xs pt-1">
                  Calibrated: {formatDate(orientCal.calibratedAt)}
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={onOpenOrientationWizard}
                    data-testid="button-recalibrate-orientation"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Recalibrate
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No calibration data</div>
            )}
          </div>
        </div>
        
        {userId && (
          <div className="pt-3 border-t border-gray-700">
            <SyncStatusIndicator userId={userId} compact />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
