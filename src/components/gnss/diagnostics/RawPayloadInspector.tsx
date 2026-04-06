/**
 * Raw Payload Inspector
 * Displays raw GNSS packets with altitude reference discovery
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Mountain, Search, AlertTriangle, CheckCircle, Download, Wifi, Signal, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { rawPacketTap, type RawGnssPacket, type AltitudeSummary } from '@/lib/diagnostics/rawPacketTap';
import { altitudeCalibration, type AltitudeSourceStrategy } from '@/lib/calibration/altitude';
import { saveAs } from 'file-saver';

interface RawPayloadInspectorProps {
  maxPackets?: number;
}

export function RawPayloadInspector({ maxPackets = 20 }: RawPayloadInspectorProps) {
  const [packets, setPackets] = useState<RawGnssPacket[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<RawGnssPacket | null>(null);
  const [altitudeSummary, setAltitudeSummary] = useState<AltitudeSummary | null>(null);
  const [strategy, setStrategy] = useState<AltitudeSourceStrategy>('prefer_msl');

  useEffect(() => {
    const unsubscribe = rawPacketTap.subscribe((allPackets) => {
      setPackets(allPackets.slice(-maxPackets));
      if (allPackets.length > 0) {
        const latest = allPackets[allPackets.length - 1];
        setSelectedPacket(latest);
        setAltitudeSummary(rawPacketTap.analyzeAltitudeFields(latest));
      }
    });

    const cal = altitudeCalibration.getCurrent();
    if (cal) {
      setStrategy(cal.sourceStrategy);
    }

    return unsubscribe;
  }, [maxPackets]);

  useEffect(() => {
    if (selectedPacket) {
      setAltitudeSummary(rawPacketTap.analyzeAltitudeFields(selectedPacket));
    }
  }, [selectedPacket]);

  const handleStrategyChange = (newStrategy: AltitudeSourceStrategy) => {
    setStrategy(newStrategy);
    altitudeCalibration.setStrategy(newStrategy);
    toast.success(`Altitude source strategy set to: ${newStrategy.replace('_', ' ')}`);
  };

  const getStatusBadge = (status: AltitudeSummary['status']) => {
    switch (status) {
      case 'msl_explicit':
        return (
          <Badge className="bg-green-600 text-white">
            <CheckCircle className="w-3 h-3 mr-1" />
            MSL Available (Explicit)
          </Badge>
        );
      case 'msl_derived':
        return (
          <Badge className="bg-blue-600 text-white">
            <CheckCircle className="w-3 h-3 mr-1" />
            MSL Derivable (Ellipsoid - Geoid)
          </Badge>
        );
      case 'ambiguous':
      default:
        return (
          <Badge className="bg-yellow-600 text-white">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Altitude Reference Ambiguous
          </Badge>
        );
    }
  };

  const highlightAltitudeFields = (json: string): string => {
    const altitudeKeywords = [
      'alt', 'altitude', 'height', 'msl', 'ellipsoid', 'geoid',
      'undulation', 'geoidsep', 'separation', 'egm', 'ortho'
    ];
    
    let highlighted = json;
    altitudeKeywords.forEach(keyword => {
      const regex = new RegExp(`("${keyword}[^"]*")`, 'gi');
      highlighted = highlighted.replace(regex, '<mark class="bg-yellow-500/30 text-yellow-200">$1</mark>');
    });
    
    return highlighted;
  };

  const getPacketRate = (): number => {
    if (packets.length < 2) return 0;
    const first = new Date(packets[0].receivedAt).getTime();
    const last = new Date(packets[packets.length - 1].receivedAt).getTime();
    const durationSec = (last - first) / 1000;
    return durationSec > 0 ? packets.length / durationSec : 0;
  };

  const getSourceBadge = (source: RawGnssPacket['source']) => {
    const colors = {
      duro: 'bg-green-600',
      usb: 'bg-blue-600',
      browser: 'bg-yellow-600',
      unknown: 'bg-gray-600'
    };
    return (
      <Badge className={`${colors[source]} text-white text-xs`}>
        <Wifi className="w-3 h-3 mr-1" />
        {source.toUpperCase()}
      </Badge>
    );
  };

  const exportDiagnosticsLog = () => {
    const calibration = altitudeCalibration.getCurrent();
    const metadata = {
      strategy,
      calibration: calibration ? {
        id: calibration.id,
        deviceId: calibration.deviceId,
        sourceStrategy: calibration.sourceStrategy,
        offsetM: calibration.offsetM,
        calibratedAt: calibration.calibratedAt,
        calibrationMethod: calibration.calibrationMethod,
        referenceAltitude: calibration.referenceAltitude,
        notes: calibration.notes
      } : null,
      sessionStart: packets.length > 0 ? packets[0].receivedAt : null,
      sessionEnd: packets.length > 0 ? packets[packets.length - 1].receivedAt : null,
      packetRate: getPacketRate().toFixed(2) + ' Hz',
      latestAltitudeSummary: altitudeSummary
    };

    const exportData = rawPacketTap.exportDiagnostics(metadata);
    const blob = new Blob([exportData], { type: 'application/json' });
    saveAs(blob, `gnss-diagnostics-${Date.now()}.json`);
    toast.success('Diagnostics log exported successfully');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mountain className="w-4 h-4 text-green-400" />
              Altitude Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-3">
            {altitudeSummary ? (
              <>
                <div className="flex items-center gap-2">
                  {getStatusBadge(altitudeSummary.status)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="space-y-1">
                    <div className="text-gray-400">MSL Explicit</div>
                    <div className="font-mono">
                      {altitudeSummary.mslExplicit?.toFixed(2) ?? 'N/A'} m
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-gray-400">MSL Derived</div>
                    <div className="font-mono">
                      {altitudeSummary.mslDerived?.toFixed(2) ?? 'N/A'} m
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-gray-400">Ellipsoid Height</div>
                    <div className="font-mono">
                      {altitudeSummary.ellipsoidHeight?.toFixed(2) ?? 'N/A'} m
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-gray-400">Geoid Separation</div>
                    <div className="font-mono">
                      {altitudeSummary.geoidSeparation?.toFixed(2) ?? 'N/A'} m
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Selected Altitude</div>
                  <div className="text-2xl font-mono text-green-400">
                    {altitudeSummary.selectedAltitude?.toFixed(2) ?? 'N/A'} m
                  </div>
                </div>

                {altitudeSummary.status === 'msl_derived' && (
                  <div className="text-xs text-gray-500 bg-gray-900/50 p-2 rounded">
                    <code>MSL = Ellipsoid Height - Geoid Separation</code>
                    <br />
                    <code>
                      {altitudeSummary.ellipsoidHeight?.toFixed(2)} - {altitudeSummary.geoidSeparation?.toFixed(2)} = {altitudeSummary.mslDerived?.toFixed(2)} m
                    </code>
                  </div>
                )}
              </>
            ) : (
              <div className="text-gray-500 text-center py-4">
                No packet data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-400" />
              Altitude Source Strategy
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-3">
            <Select value={strategy} onValueChange={(v: string) => handleStrategyChange(v as AltitudeSourceStrategy)}>
              <SelectTrigger data-testid="select-altitude-strategy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prefer_msl">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Prefer Explicit MSL
                  </div>
                </SelectItem>
                <SelectItem value="derive_msl">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-400" />
                    Derive MSL (Ellipsoid - Geoid)
                  </div>
                </SelectItem>
                <SelectItem value="raw_ambiguous">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    Use Raw Altitude (Ambiguous)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <div className="text-xs text-gray-500 space-y-2">
              <p>
                <strong>Prefer MSL:</strong> Uses explicit MSL field if available, otherwise derives from ellipsoid.
              </p>
              <p>
                <strong>Derive MSL:</strong> Always calculates MSL from ellipsoid height minus geoid separation.
              </p>
              <p>
                <strong>Raw (Ambiguous):</strong> Uses altitude field as-is without interpretation.
                <span className="text-yellow-500 ml-1">Warning: Reference may be unclear.</span>
              </p>
            </div>

            {altitudeSummary?.candidates && altitudeSummary.candidates.length > 0 && (
              <div className="pt-2 border-t border-gray-700">
                <div className="text-sm text-gray-400 mb-2">Detected Altitude Fields</div>
                <div className="space-y-1 text-xs font-mono">
                  {altitudeSummary.candidates.map((c, i) => (
                    <div key={i} className="flex justify-between">
                      <span className={
                        c.type === 'msl' ? 'text-green-400' :
                        c.type === 'ellipsoid' ? 'text-blue-400' :
                        c.type === 'geoid_separation' ? 'text-purple-400' :
                        'text-yellow-400'
                      }>
                        {c.field}
                      </span>
                      <span>{c.value?.toFixed(2) ?? 'null'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="py-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm">Raw Packets ({packets.length})</CardTitle>
            {packets.length > 0 && selectedPacket && getSourceBadge(selectedPacket.source)}
            {packets.length > 1 && (
              <Badge variant="outline" className="text-xs">
                <Timer className="w-3 h-3 mr-1" />
                {getPacketRate().toFixed(1)} Hz
              </Badge>
            )}
            {packets.length > 0 && (
              <Badge variant="outline" className="text-xs">
                <Signal className="w-3 h-3 mr-1" />
                {packets.length} buffered
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportDiagnosticsLog}
              disabled={packets.length === 0}
              data-testid="button-export-diagnostics"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => rawPacketTap.clear()}
              data-testid="button-clear-packets"
            >
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="py-2">
          <div className="flex gap-2 mb-2 flex-wrap">
            {packets.slice(-10).map((p, i) => (
              <Button
                key={i}
                variant={selectedPacket === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPacket(p)}
                className="text-xs"
              >
                {new Date(p.receivedAt).toLocaleTimeString()}
              </Button>
            ))}
          </div>

          {selectedPacket && (
            <div className="bg-gray-900 rounded p-3 overflow-auto max-h-80">
              <pre 
                className="text-xs font-mono text-gray-300 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: highlightAltitudeFields(JSON.stringify(selectedPacket.raw, null, 2))
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
