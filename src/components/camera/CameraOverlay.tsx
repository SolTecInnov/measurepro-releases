import { Measurement } from '../../types';
import { useGPSStore } from '../../lib/stores/gpsStore';
import { useSerialStore } from '../../lib/stores/serialStore';
import { useLaserStore } from '../../lib/laser';
import { useSettingsStore } from '../../lib/settings';
import { useEnvelopeStore } from '../../stores/envelopeStore';
import { useCameraStore } from '../../lib/camera';
import { usePOIStore, POI_TYPES } from '../../lib/poi';
import { useEffect, useReducer, useMemo } from 'react';

type ClearanceStatus = 'safe' | 'warning' | 'critical';

interface CameraOverlayProps {
  enabled: boolean;
  overlayScale?: number;  // 0.25 to 1.0, affects live display only (not burned images)
  options: {
    showPOI: boolean;
    showPOIType: boolean;
    showGPS: boolean;
    showHeight: boolean;
    showDateTime: boolean;
    showHeading: boolean;
    showLogo: boolean;
    showText: boolean;
    showSurveyTitle?: boolean;
    showProjectNumber?: boolean;
    showSurveyorName?: boolean;
    showPOINotes?: boolean;
  };
  measurements: Measurement[];
  currentMeasure?: string;
}

function getCardinalDirection(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

function formatDateTimeDisplay(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day} - ${hours}:${minutes}`;
}

const CameraOverlay: React.FC<CameraOverlayProps> = ({ 
  enabled, 
  overlayScale = 1,
  options, 
  measurements,
  currentMeasure
}) => {
  const { data: gpsData } = useGPSStore();
  const { lastMeasurement } = useSerialStore();
  const { groundReferenceHeight } = useLaserStore();
  const { alertSettings } = useSettingsStore();
  const { overlayFields } = useCameraStore();
  const envelopeStore = useEnvelopeStore();
  const { selectedType: currentPOIType } = usePOIStore();
  
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  
  const measurementToUse = currentMeasure || lastMeasurement;

  useEffect(() => {
    const handleLaserUpdate = (_event: CustomEvent) => {
      forceUpdate();
    };
    
    window.addEventListener('laser-measurement-update', handleLaserUpdate as EventListener);
    
    return () => {
      window.removeEventListener('laser-measurement-update', handleLaserUpdate as EventListener);
    };
  }, []);
  
  useEffect(() => {
    forceUpdate();
  }, [measurementToUse, lastMeasurement, groundReferenceHeight]);

  useEffect(() => {
    const handleEnvelopeStatusChange = () => {
      forceUpdate();
    };

    window.addEventListener('envelope-status-change', handleEnvelopeStatusChange as EventListener);
    
    return () => {
      window.removeEventListener('envelope-status-change', handleEnvelopeStatusChange as EventListener);
    };
  }, []);
  
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(), 1000);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    const handleLogoUpdate = () => {
      forceUpdate();
    };
    window.addEventListener('logo-updated', handleLogoUpdate);
    return () => window.removeEventListener('logo-updated', handleLogoUpdate);
  }, []);

  if (!enabled) return null;
  
  const calculateHeight = () => {
    if (!measurementToUse || measurementToUse === '--' || measurementToUse === 'infinity') {
      return '--m';
    }
    
    const numValue = parseFloat(measurementToUse);
    
    if (isNaN(numValue)) {
      return '--m';
    }
    
    const validGroundRef = isNaN(groundReferenceHeight) ? 0.0 : groundReferenceHeight;
    const adjustedValue = numValue + validGroundRef;
    
    const thresholds = (alertSettings?.thresholds) || {
      minHeight: 0,
      maxHeight: 25,
      warningThreshold: 4.2,
      criticalThreshold: 4.0
    };
    
    if (adjustedValue < thresholds.minHeight || adjustedValue > thresholds.maxHeight) {
      return '--m';
    }
    
    return adjustedValue.toFixed(2) + 'm';
  };

  const getClearanceDisplay = () => {
    if (!envelopeStore.settings.enabled || !envelopeStore.settings.visualEnabled) {
      return null;
    }

    const activeProfile = envelopeStore.getActiveProfile();
    if (!activeProfile) return null;

    const measurement = parseFloat(measurementToUse);
    if (isNaN(measurement)) return null;

    let vehicleHeight = activeProfile.height;
    if (activeProfile.heightUnit === 'feet') {
      vehicleHeight = vehicleHeight * 0.3048;
    }

    const { warningThreshold, criticalThreshold } = envelopeStore.settings;
    const clearance = measurement - vehicleHeight;
    
    let status: ClearanceStatus;
    let color: string;
    let borderColor: string;
    let textColor: string;

    if (clearance > warningThreshold) {
      status = 'safe';
      color = 'bg-green-500/20';
      borderColor = 'border-green-500';
      textColor = 'text-green-400';
    } else if (clearance > criticalThreshold) {
      status = 'warning';
      color = 'bg-yellow-500/20';
      borderColor = 'border-yellow-500';
      textColor = 'text-yellow-400';
    } else {
      status = 'critical';
      color = 'bg-red-500/20';
      borderColor = 'border-red-500';
      textColor = 'text-red-400';
    }

    const displayMeasurement = measurement;
    const displayEnvelope = vehicleHeight;
    const displayClearance = clearance;
    const displayUnit = 'm';

    return {
      status,
      color,
      borderColor,
      textColor,
      measurement: displayMeasurement,
      envelope: displayEnvelope,
      clearance: displayClearance,
      unit: displayUnit
    };
  };

  const clearanceDisplay = getClearanceDisplay();

  const heightValue = options.showHeight !== false ? calculateHeight() : null;
  const showHeight = options.showHeight !== false;
  const dateTimeStr = formatDateTimeDisplay(new Date());

  const getPoiTypeLabel = (poiType: string): string => {
    if (!poiType) return '';
    const config = POI_TYPES.find(p => p.type === poiType);
    return config?.label || poiType
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  // For live overlay: use current POI type from store; for captured: use overlayFields
  const displayPoiType = currentPOIType || overlayFields.poiType;

  const topRightLines: { label: string; value: string }[] = [];
  // POI ID only shows for captured images (8-char UUID format, not POI type names)
  if (options.showPOI !== false && overlayFields.poi && overlayFields.poi.length === 8) {
    topRightLines.push({ label: 'POI ID', value: overlayFields.poi });
  }
  // POI Type shows for both live and captured overlays
  if (options.showPOIType !== false && displayPoiType) {
    topRightLines.push({ label: 'Type', value: getPoiTypeLabel(displayPoiType) });
  }
  if (options.showDateTime !== false) {
    topRightLines.push({ label: 'Date', value: dateTimeStr });
  }
  if (options.showSurveyorName !== false && overlayFields.surveyorName) {
    topRightLines.push({ label: 'Surveyor', value: overlayFields.surveyorName });
  }

  const bottomLines: { label: string; value: string }[] = [];
  if (options.showProjectNumber !== false && overlayFields.projectNumber) {
    bottomLines.push({ label: 'Project No', value: overlayFields.projectNumber });
  }
  if (options.showSurveyTitle !== false && overlayFields.surveyTitle) {
    bottomLines.push({ label: 'Survey title', value: overlayFields.surveyTitle });
  }
  if (options.showGPS !== false) {
    if (gpsData.latitude !== 0 || gpsData.longitude !== 0) {
      const latDir = gpsData.latitude >= 0 ? 'N' : 'S';
      const lonDir = gpsData.longitude >= 0 ? 'W' : 'E';
      bottomLines.push({ label: 'GPS', value: `${Math.abs(gpsData.latitude).toFixed(4)}° ${latDir}, ${Math.abs(gpsData.longitude).toFixed(4)}° ${lonDir}` });
    } else {
      bottomLines.push({ label: 'GPS', value: '--' });
    }
  }
  if (options.showHeading !== false) {
    if (gpsData.course !== 0) {
      bottomLines.push({ label: 'Heading', value: `${gpsData.course.toFixed(0)}° ${getCardinalDirection(gpsData.course)}` });
    } else {
      bottomLines.push({ label: 'Heading', value: '--' });
    }
  }
  if (options.showPOINotes !== false && overlayFields.poiNotes) {
    bottomLines.push({ label: 'Notes', value: overlayFields.poiNotes });
  }

  const hasTopSection = showHeight || topRightLines.length > 0;
  const hasBottomSection = bottomLines.length > 0;
  const showCard = hasTopSection || hasBottomSection;

  const logoUrl = options.showLogo ? localStorage.getItem('app_logo_url') : null;

  return (
    <div className={`absolute inset-0 pointer-events-none z-10 ${clearanceDisplay?.status === 'critical' ? 'animate-pulse border-4 border-red-500' : ''}`}>
      
      {/* Logo and overlay card container - bottom left */}
      <div className="absolute bottom-4 left-4 flex flex-col items-start gap-2" style={{ transform: `scale(${overlayScale})`, transformOrigin: 'bottom left', transition: 'transform 0.15s' }}>
        {/* Logo without background - 20% smaller */}
        {logoUrl && (
          <img 
            src={logoUrl} 
            alt="Company Logo" 
            className="h-8 w-auto object-contain"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.7))' }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        )}

        {/* Overlay card - 20% wider, 10% shorter */}
        {showCard && (
          <div className="bg-black/80 rounded-lg px-3 py-2 min-w-[269px] max-w-[403px]">
          {hasTopSection && (
            <div className="flex items-stretch gap-4">
              {showHeight && (
                <>
                  <div className="flex flex-col justify-center">
                    <span className="text-gray-400 text-xs leading-none">Height</span>
                    <span className="text-white text-3xl font-bold leading-none">{heightValue || '--'}</span>
                  </div>
                  {topRightLines.length > 0 && (
                    <div className="w-[3px] self-stretch rounded-full" style={{ backgroundColor: '#F5A623' }} />
                  )}
                </>
              )}
              {topRightLines.length > 0 && (
                <div className="flex flex-col justify-center space-y-0">
                  {topRightLines.map((line, idx) => (
                    <div key={idx} className="text-xs leading-tight">
                      <span className="text-gray-400">{line.label} </span>
                      <span className="text-white font-semibold">{line.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {hasTopSection && hasBottomSection && (
            <div className="border-t border-gray-600/60 my-2" />
          )}
          
          {hasBottomSection && (
            <div className="space-y-0">
              {bottomLines.map((line, idx) => (
                <div key={idx} className="text-xs leading-tight">
                  <span className="text-gray-400">{line.label} </span>
                  <span className="text-white font-semibold">{line.value}</span>
                </div>
              ))}
            </div>
          )}
          </div>
        )}
      </div>

      {clearanceDisplay && (
        <>
          <div 
            className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3/4 h-1/3 border-4 ${clearanceDisplay.borderColor} ${clearanceDisplay.color} rounded-lg ${clearanceDisplay.status === 'critical' ? 'animate-pulse' : ''}`}
          />
          
          <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-black/90 backdrop-blur-sm rounded-lg p-3 border-2" 
               style={{ borderColor: clearanceDisplay.status === 'safe' ? '#22c55e' : clearanceDisplay.status === 'warning' ? '#f59e0b' : '#ef4444' }}>
            <div className="text-center">
              <div className={`text-xl font-bold ${clearanceDisplay.textColor} mb-1`}>
                {clearanceDisplay.status.toUpperCase()}
              </div>
              <div className="text-white text-sm space-y-1">
                <div>Measurement: <span className="font-semibold">{(clearanceDisplay.measurement ?? 0).toFixed(2)} {clearanceDisplay.unit}</span></div>
                <div>Envelope: <span className="font-semibold">{(clearanceDisplay.envelope ?? 0).toFixed(2)} {clearanceDisplay.unit}</span></div>
                <div className={clearanceDisplay.textColor}>
                  Clearance: <span className="font-bold">
                    {(clearanceDisplay.clearance ?? 0) > 0 ? '+' : ''}{(clearanceDisplay.clearance ?? 0).toFixed(2)} {clearanceDisplay.unit}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CameraOverlay;
