/**
 * Live Telemetry Dashboard
 * Displays real-time GNSS/IMU data with raw and derived fields
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Satellite, Navigation, Mountain, Gauge, RotateCcw, 
  Pause, Play, Download, Copy, Radio, Clock, Signal
} from 'lucide-react';
import { toast } from 'sonner';
import { useGnssData } from '@/hooks/useGnssData';
import { useGPSStore } from '@/lib/stores/gpsStore';
import { rawPacketTap, type RawGnssPacket } from '@/lib/diagnostics/rawPacketTap';
import { altitudeCalibration } from '@/lib/calibration/altitude';
import { orientationCalibration } from '@/lib/calibration/orientation';

interface LiveTelemetryDashboardProps {
  onRecordComplete?: (packets: RawGnssPacket[]) => void;
}

export function LiveTelemetryDashboard({ onRecordComplete }: LiveTelemetryDashboardProps) {
  const { latestSample, isConnected, source, hasImu, fixQuality, dataSource } = useGnssData();
  const gpsData = useGPSStore((s) => s.data);
  
  const [isPaused, setIsPaused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordTarget, setRecordTarget] = useState(0);
  const [lastPacketAge, setLastPacketAge] = useState(0);
  const [displaySample, setDisplaySample] = useState(latestSample);
  
  const recordingRef = useRef<NodeJS.Timeout | null>(null);
  const ageIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isPaused && latestSample) {
      setDisplaySample(latestSample);
      
      rawPacketTap.addPacket({
        timestamp: latestSample.timestamp,
        raw: latestSample as unknown as Record<string, unknown>,
        source: latestSample.source || 'unknown',
      });
    }
  }, [latestSample, isPaused]);

  useEffect(() => {
    ageIntervalRef.current = setInterval(() => {
      if (displaySample?.timestamp) {
        const age = Date.now() - new Date(displaySample.timestamp).getTime();
        setLastPacketAge(Math.floor(age / 1000));
      }
    }, 1000);

    return () => {
      if (ageIntervalRef.current) clearInterval(ageIntervalRef.current);
    };
  }, [displaySample?.timestamp]);

  useEffect(() => {
    if (isRecording) {
      recordingRef.current = setInterval(() => {
        setRecordDuration(prev => {
          const next = prev + 1;
          if (next >= recordTarget) {
            stopRecording();
            return recordTarget;
          }
          return next;
        });
      }, 1000);
    }

    return () => {
      if (recordingRef.current) clearInterval(recordingRef.current);
    };
  }, [isRecording, recordTarget]);

  const startRecording = (durationSeconds: number) => {
    setIsRecording(true);
    setRecordDuration(0);
    setRecordTarget(durationSeconds);
    rawPacketTap.clear();
    // toast suppressed
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (recordingRef.current) clearInterval(recordingRef.current);
    
    const packets = rawPacketTap.getPackets();
    // toast suppressed
    onRecordComplete?.(packets);
  };

  const exportDiagnostics = () => {
    const metadata = {
      ...altitudeCalibration.getExportMetadata(),
      ...orientationCalibration.getExportMetadata(),
      fixQuality,
      dataSource,
      hasImu,
      source,
    };
    
    const json = rawPacketTap.exportDiagnostics(metadata);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gnss-diagnostics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    // toast suppressed
  };

  const copySummary = () => {
    const summary = rawPacketTap.generateSummary();
    navigator.clipboard.writeText(summary);
    // toast suppressed
  };

  const formatCoord = (value: number | null | undefined, decimals = 6) => {
    if (value === null || value === undefined) return '--';
    return value.toFixed(decimals);
  };

  const formatValue = (value: number | null | undefined, unit: string, decimals = 2) => {
    if (value === null || value === undefined) return '--';
    return `${value.toFixed(decimals)} ${unit}`;
  };

  const altitudeData = altitudeCalibration.applyCalibration(displaySample?.altitude ?? null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm font-medium">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
          <span className="text-xs text-gray-500">via {source}</span>
          {lastPacketAge > 0 && (
            <span className="text-xs text-gray-400">
              <Clock className="w-3 h-3 inline mr-1" />
              {lastPacketAge}s ago
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            data-testid="button-pause-telemetry"
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {isPaused ? 'Resume' : 'Pause'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Navigation className="w-4 h-4 text-blue-400" />
              Position
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Latitude</span>
              <span className="font-mono">{formatCoord(displaySample?.latitude)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Longitude</span>
              <span className="font-mono">{formatCoord(displaySample?.longitude)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Heading</span>
              <span className="font-mono">{formatValue(displaySample?.heading, '°', 1)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mountain className="w-4 h-4 text-green-400" />
              Altitude (MSL)
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Raw</span>
              <span className="font-mono">{formatValue(altitudeData.raw, 'm')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Selected</span>
              <span className="font-mono">{formatValue(altitudeData.selected, 'm')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Corrected</span>
              <span className="font-mono text-green-400">{formatValue(altitudeData.corrected, 'm')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Offset</span>
              <span className="font-mono text-yellow-400">{altitudeData.offset >= 0 ? '+' : ''}{altitudeData.offset.toFixed(2)} m</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="w-4 h-4 text-yellow-400" />
              Motion
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Speed</span>
              <span className="font-mono">{formatValue(displaySample?.speed, 'm/s')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Speed (km/h)</span>
              <span className="font-mono">
                {displaySample?.speed != null ? formatValue(displaySample.speed * 3.6, 'km/h') : '--'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Satellite className="w-4 h-4 text-purple-400" />
              Signal Quality
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Fix Type</span>
              <span className={`font-mono ${
                fixQuality === 'rtk_fixed' ? 'text-green-400' :
                fixQuality === 'rtk_float' ? 'text-yellow-400' :
                fixQuality === 'dgps' ? 'text-blue-400' : 'text-gray-400'
              }`}>
                {fixQuality.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Satellites (GGA)</span>
              <span className="font-mono">{displaySample?.num_sats ?? '--'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">In View (GSV)</span>
              <span className="font-mono">{gpsData.satellitesInView ?? '--'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">HDOP</span>
              <span className="font-mono">{formatValue(displaySample?.hdop, '', 2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Source</span>
              <span className="font-mono">{dataSource ?? '--'}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700" data-testid="card-dop">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Signal className="w-4 h-4 text-indigo-400" />
              DOP (GSA)
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">PDOP</span>
              <span className={`font-mono ${
                gpsData.pdop != null && gpsData.pdop <= 2 ? 'text-green-400' :
                gpsData.pdop != null && gpsData.pdop <= 5 ? 'text-yellow-400' : 'text-red-400'
              }`} data-testid="value-pdop">
                {gpsData.pdop != null ? gpsData.pdop.toFixed(1) : '--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">HDOP</span>
              <span className={`font-mono ${
                gpsData.hdop != null && gpsData.hdop <= 1 ? 'text-green-400' :
                gpsData.hdop != null && gpsData.hdop <= 2 ? 'text-yellow-400' : 'text-red-400'
              }`} data-testid="value-hdop-gsa">
                {gpsData.hdop != null && gpsData.hdop !== 0 ? gpsData.hdop.toFixed(1) : '--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">VDOP</span>
              <span className={`font-mono ${
                gpsData.vdop != null && gpsData.vdop <= 2 ? 'text-green-400' :
                gpsData.vdop != null && gpsData.vdop <= 5 ? 'text-yellow-400' : 'text-red-400'
              }`} data-testid="value-vdop">
                {gpsData.vdop != null ? gpsData.vdop.toFixed(1) : '--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Active PRNs</span>
              <span className="font-mono text-xs text-gray-300" data-testid="value-active-prns">
                {gpsData.activeSatellitePrns && gpsData.activeSatellitePrns.length > 0
                  ? gpsData.activeSatellitePrns.join(', ')
                  : '--'}
              </span>
            </div>
            {gpsData.constellations && Object.keys(gpsData.constellations).length > 0 && (
              <div className="pt-1 border-t border-gray-700 space-y-1">
                <span className="text-xs text-gray-500">By constellation:</span>
                {Object.entries(gpsData.constellations).map(([id, c]) => (
                  <div key={id} className="flex justify-between" data-testid={`value-constellation-${id}`}>
                    <span className="text-gray-500 text-xs">{c.name}</span>
                    <span className="font-mono text-xs text-gray-300">{c.activePrns.length} sats ({c.activePrns.join(', ')})</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-orange-400" />
              Attitude (IMU)
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Roll</span>
              <span className="font-mono">{formatValue(displaySample?.attitude?.roll, '°', 2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Pitch</span>
              <span className="font-mono">{formatValue(displaySample?.attitude?.pitch, '°', 2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Yaw</span>
              <span className="font-mono">{formatValue(displaySample?.attitude?.yaw, '°', 2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">IMU Available</span>
              <span className={`font-mono ${hasImu ? 'text-green-400' : 'text-gray-500'}`}>
                {hasImu ? 'Yes' : 'No'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              Accelerometer
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Accel X</span>
              <span className="font-mono">
                {formatValue(displaySample?.acceleration?.x, 'm/s²', 3)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Accel Y</span>
              <span className="font-mono">
                {formatValue(displaySample?.acceleration?.y, 'm/s²', 3)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Accel Z</span>
              <span className="font-mono">
                {formatValue(displaySample?.acceleration?.z, 'm/s²', 3)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {gpsData.satelliteList && gpsData.satelliteList.length > 0 && (
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Signal className="w-4 h-4 text-indigo-400" />
              Satellites in View (GSV) — {gpsData.satellitesInView ?? gpsData.satelliteList.length} total
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono" data-testid="table-satellites-gsv">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-700">
                    <th className="text-left py-1 pr-3">PRN</th>
                    <th className="text-right py-1 pr-3">Elev°</th>
                    <th className="text-right py-1 pr-3">Az°</th>
                    <th className="text-right py-1">SNR (dB-Hz)</th>
                  </tr>
                </thead>
                <tbody>
                  {gpsData.satelliteList
                    .slice()
                    .sort((a, b) => (b.snr ?? -1) - (a.snr ?? -1))
                    .map((sat) => {
                      const snrColor = sat.snr == null ? 'text-gray-600' :
                        sat.snr >= 40 ? 'text-green-400' :
                        sat.snr >= 25 ? 'text-yellow-400' : 'text-red-400';
                      const isActive = gpsData.activeSatellitePrns?.includes(sat.prn);
                      return (
                        <tr
                          key={sat.prn}
                          className={`border-b border-gray-800 ${isActive ? 'text-gray-200' : 'text-gray-500'}`}
                          data-testid={`row-satellite-${sat.prn}`}
                        >
                          <td className="py-0.5 pr-3">
                            {sat.prn}
                            {isActive && <span className="ml-1 text-green-400 text-xs">★</span>}
                          </td>
                          <td className="text-right py-0.5 pr-3">
                            {sat.elevation != null ? sat.elevation.toFixed(0) : '--'}
                          </td>
                          <td className="text-right py-0.5 pr-3">
                            {sat.azimuth != null ? sat.azimuth.toFixed(0) : '--'}
                          </td>
                          <td className={`text-right py-0.5 ${snrColor}`}>
                            {sat.snr != null ? sat.snr.toFixed(0) : '--'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-600 mt-1">★ = active in navigation solution</p>
          </CardContent>
        </Card>
      )}

      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Recording Controls</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="flex flex-wrap gap-2 items-center">
            {isRecording ? (
              <>
                <div className="flex items-center gap-2 text-red-400">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Recording: {recordDuration}s / {recordTarget}s
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={stopRecording}
                  data-testid="button-stop-recording"
                >
                  Stop
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startRecording(10)}
                  data-testid="button-record-10s"
                >
                  Record 10s
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startRecording(20)}
                  data-testid="button-record-20s"
                >
                  Record 20s
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startRecording(60)}
                  data-testid="button-record-60s"
                >
                  Record 60s
                </Button>
              </>
            )}
            
            <div className="flex-1" />
            
            <Button
              variant="outline"
              size="sm"
              onClick={copySummary}
              data-testid="button-copy-summary"
            >
              <Copy className="w-4 h-4 mr-1" />
              Copy Summary
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportDiagnostics}
              data-testid="button-export-diagnostics"
            >
              <Download className="w-4 h-4 mr-1" />
              Export JSON
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
