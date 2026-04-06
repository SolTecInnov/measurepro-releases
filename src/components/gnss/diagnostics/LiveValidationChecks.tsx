/**
 * Live Validation Checks Panel
 * Displays real-time validation of GNSS data quality and calibration
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, AlertTriangle, XCircle, 
  Gauge, Mountain, RotateCcw, Satellite, Clock
} from 'lucide-react';
import { useGnssData } from '@/hooks/useGnssData';
import { orientationCalibration } from '@/lib/calibration/orientation';

interface ValidationCheck {
  id: string;
  name: string;
  description: string;
  status: 'pass' | 'warn' | 'fail' | 'pending';
  value?: string;
  threshold?: string;
  icon: React.ReactNode;
}

export function LiveValidationChecks() {
  const { latestSample, isConnected, fixQuality, hasImu } = useGnssData();
  const [checks, setChecks] = useState<ValidationCheck[]>([]);
  const [overallScore, setOverallScore] = useState(0);

  const runValidations = useMemo(() => {
    const validations: ValidationCheck[] = [];

    const isOnline = isConnected;
    validations.push({
      id: 'connection',
      name: 'GNSS Connection',
      description: 'Duro receiver is connected and streaming',
      status: isOnline ? 'pass' : 'fail',
      value: isOnline ? 'Connected' : 'Disconnected',
      icon: <Satellite className="w-4 h-4" />,
    });

    const age = latestSample?.timestamp 
      ? (Date.now() - new Date(latestSample.timestamp).getTime()) / 1000 
      : 999;
    validations.push({
      id: 'data_freshness',
      name: 'Data Freshness',
      description: 'Data received within last 5 seconds',
      status: age < 2 ? 'pass' : age < 5 ? 'warn' : 'fail',
      value: age < 100 ? `${age.toFixed(1)}s ago` : 'No data',
      threshold: '< 5s',
      icon: <Clock className="w-4 h-4" />,
    });

    const fixStatus = fixQuality;
    const fixGood = ['rtk_fixed', 'rtk_float'].includes(fixStatus);
    const fixOk = ['dgps', 'gps'].includes(fixStatus);
    validations.push({
      id: 'fix_quality',
      name: 'Fix Quality',
      description: 'RTK or differential fix preferred',
      status: fixGood ? 'pass' : fixOk ? 'warn' : 'fail',
      value: fixStatus.toUpperCase(),
      threshold: 'RTK Fixed/Float',
      icon: <Satellite className="w-4 h-4" />,
    });

    const satellites = latestSample?.num_sats ?? 0;
    validations.push({
      id: 'satellites',
      name: 'Satellite Count',
      description: 'Minimum 6 satellites for good positioning',
      status: satellites >= 10 ? 'pass' : satellites >= 6 ? 'warn' : 'fail',
      value: `${satellites} sats`,
      threshold: '>= 6',
      icon: <Satellite className="w-4 h-4" />,
    });

    const hdop = latestSample?.hdop ?? 99;
    validations.push({
      id: 'hdop',
      name: 'HDOP',
      description: 'Horizontal dilution of precision',
      status: hdop <= 1.5 ? 'pass' : hdop <= 3 ? 'warn' : 'fail',
      value: hdop < 99 ? hdop.toFixed(2) : '--',
      threshold: '<= 1.5',
      icon: <Gauge className="w-4 h-4" />,
    });

    const hasAlt = latestSample?.altitude != null;
    validations.push({
      id: 'altitude_available',
      name: 'Altitude Data',
      description: 'MSL or ellipsoid height available',
      status: hasAlt ? 'pass' : 'fail',
      value: hasAlt ? `${latestSample?.altitude?.toFixed(2)} m` : 'N/A',
      icon: <Mountain className="w-4 h-4" />,
    });

    validations.push({
      id: 'imu_available',
      name: 'IMU Data',
      description: 'Accelerometer and attitude available',
      status: hasImu ? 'pass' : 'warn',
      value: hasImu ? 'Available' : 'Not available',
      icon: <RotateCcw className="w-4 h-4" />,
    });

    if (hasImu) {
      const roll = latestSample?.attitude?.roll ?? 0;
      const pitch = latestSample?.attitude?.pitch ?? 0;
      const toleranceDeg = 5;
      const isLevel = Math.abs(roll) <= toleranceDeg && Math.abs(pitch) <= toleranceDeg;
      
      validations.push({
        id: 'orientation_level',
        name: 'Vehicle Level',
        description: 'Roll and pitch within tolerance at rest',
        status: isLevel ? 'pass' : 'warn',
        value: `R:${roll.toFixed(1)}° P:${pitch.toFixed(1)}°`,
        threshold: `±${toleranceDeg}°`,
        icon: <RotateCcw className="w-4 h-4" />,
      });
    }

    const orientationCal = orientationCalibration.getCurrent();
    if (orientationCal) {
      const isCalibrated = orientationCal.confidence.overall > 50;
      validations.push({
        id: 'orientation_calibrated',
        name: 'Axis Orientation',
        description: 'Vehicle axis mapping configured',
        status: isCalibrated ? 'pass' : 'warn',
        value: isCalibrated ? `${orientationCal.confidence.overall.toFixed(0)}% confidence` : 'Not calibrated',
        threshold: '> 50%',
        icon: <RotateCcw className="w-4 h-4" />,
      });
    }

    return validations;
  }, [latestSample, isConnected, fixQuality, hasImu]);

  useEffect(() => {
    setChecks(runValidations);
    
    const passCount = runValidations.filter(c => c.status === 'pass').length;
    const warnCount = runValidations.filter(c => c.status === 'warn').length;
    const total = runValidations.length;
    
    const score = Math.round(((passCount + warnCount * 0.5) / total) * 100);
    setOverallScore(score);
  }, [runValidations]);

  const getStatusIcon = (status: ValidationCheck['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'warn': return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'fail': return <XCircle className="w-5 h-5 text-red-400" />;
      default: return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: ValidationCheck['status']) => {
    switch (status) {
      case 'pass': return <Badge className="bg-green-600 text-white">PASS</Badge>;
      case 'warn': return <Badge className="bg-yellow-600 text-white">WARN</Badge>;
      case 'fail': return <Badge className="bg-red-600 text-white">FAIL</Badge>;
      default: return <Badge className="bg-gray-600 text-white">--</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const passCount = checks.filter(c => c.status === 'pass').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const failCount = checks.filter(c => c.status === 'fail').length;

  return (
    <div className="space-y-4">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Overall System Health</span>
            <span className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
              {overallScore}%
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 space-y-3">
          <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${getProgressColor(overallScore)}`}
              style={{ width: `${overallScore}%` }}
            />
          </div>
          
          <div className="flex justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>{passCount} Pass</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span>{warnCount} Warn</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <span>{failCount} Fail</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {checks.map((check) => (
          <Card 
            key={check.id} 
            className={`border ${
              check.status === 'pass' ? 'border-green-700/50 bg-green-900/10' :
              check.status === 'warn' ? 'border-yellow-700/50 bg-yellow-900/10' :
              check.status === 'fail' ? 'border-red-700/50 bg-red-900/10' :
              'border-gray-700 bg-gray-800/50'
            }`}
          >
            <CardContent className="py-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getStatusIcon(check.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-medium text-sm">{check.name}</h4>
                    {getStatusBadge(check.status)}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{check.description}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs">
                    {check.value && (
                      <span className="font-mono">{check.value}</span>
                    )}
                    {check.threshold && (
                      <span className="text-gray-500">Target: {check.threshold}</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-blue-900/20 border-blue-700/50">
        <CardContent className="py-3">
          <div className="text-sm text-blue-300 space-y-1">
            <p><strong>Validation Tips:</strong></p>
            <ul className="text-xs text-blue-400 list-disc list-inside space-y-1">
              <li>Ensure clear sky view for best satellite reception</li>
              <li>RTK corrections significantly improve accuracy</li>
              <li>Calibrate axis orientation on a level surface</li>
              <li>Low HDOP (&lt;1.5) indicates good geometry</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
