import React, { useEffect } from 'react';
import { useSettingsStore } from '../lib/settings';
import { useSerialStore } from '../lib/stores/serialStore';
import { soundManager } from '../lib/sounds';
import AlertBanner from './AlertBanner';
import { useLaserStore } from '../lib/laser';
import { isInvalidMeasurement } from '../lib/utils/laserUtils';
import { useAlertsStore } from '../lib/stores/alertsStore';

// Import refactored components
import CurrentMeasureCard from './measurement/CurrentMeasureCard';
import LastMeasureCard from './measurement/LastMeasureCard';
import MinimumDistanceCard from './measurement/MinimumDistanceCard';
import HistorySettingsModal from './measurement/HistorySettingsModal';
import { calculateOptimalColumns } from './measurement/utils';
import { formatMeasurementDual } from '../lib/utils/unitConversion';

const MeasurementCards = () => {
  const { groundReferenceHeight } = useLaserStore();
  const { alertSettings } = useSettingsStore();
  const { lastMeasurement, measurementSampleId } = useSerialStore();
  
  // Ensure we have valid settings with defaults
  const settings = alertSettings || {
    thresholds: {
      minHeight: 0,
      maxHeight: 25,
      warningThreshold: 4.2,
      criticalThreshold: 4.0
    }
  };
  
  // Settings for measurement history display
  const [lastMeasureHistoryCount, setLastMeasureHistoryCount] = React.useState(() => {
    const saved = localStorage.getItem('lastMeasureHistoryCount');
    return saved ? parseInt(saved) : 5;
  });
  
  const [minDistanceHistoryCount, setMinDistanceHistoryCount] = React.useState(() => {
    const saved = localStorage.getItem('minDistanceHistoryCount');
    return saved ? parseInt(saved) : 5;
  });
  
  const [showHistorySettings, setShowHistorySettings] = React.useState(false);
  
  // Use thresholds from settings
  const thresholds = settings.thresholds;
  
  // Add state for measurements
  const [measurementInMeters, setMeasurementInMeters] = React.useState('--');
  const [measurementInFeet, setMeasurementInFeet] = React.useState('--');
  const [filteredMeasurement, setFilteredMeasurement] = React.useState('--');
  const [minDistance, setMinDistance] = React.useState('--');
  const [maxDistance, setMaxDistance] = React.useState('--');
  const [measurementHistory, setMeasurementHistory] = React.useState<string[]>([]);
  const [minDistanceHistory, setMinDistanceHistory] = React.useState<string[]>([]);
  const [maxDistanceHistory, setMaxDistanceHistory] = React.useState<string[]>([]);
  
  // Add state for dynamic column calculation
  const [lastMeasureColumns, setLastMeasureColumns] = React.useState(2);
  const [minDistanceColumns, setMinDistanceColumns] = React.useState(2);
  const [maxDistanceColumns, setMaxDistanceColumns] = React.useState(2);
  const lastMeasureCardRef = React.useRef<HTMLDivElement>(null);
  const [sessionMin, setSessionMin] = React.useState<string>('--');
  const minDistanceCardRef = React.useRef<HTMLDivElement>(null);
  const maxDistanceCardRef = React.useRef<HTMLDivElement>(null);
  const averageDistanceCardRef = React.useRef<HTMLDivElement>(null);
  const { alertStatus, setAlertStatus, triggerValue, setTriggerValue } = useAlertsStore();
  const [hasTriggeredAlert, setHasTriggeredAlert] = React.useState(false);
  
  // ARCHITECT-APPROVED SESSION-BASED ALERT SYSTEM
  // Tracks alert sessions keyed by {severity, sampleId, acknowledged, acknowledgedSeverity}
  // acknowledgedSeverity tracks WHAT was acknowledged to prevent re-triggering after invalid data
  const alertSession = React.useRef<{
    severity: 'warning' | 'critical' | null;
    sampleId: number;
    acknowledged: boolean;
    acknowledgedSeverity: 'warning' | 'critical' | null;
    triggerValue: number | null;
  }>({
    severity: null,
    sampleId: -1,
    acknowledged: false,
    acknowledgedSeverity: null,
    triggerValue: null
  });

  // Update column counts when card sizes or item counts change
  React.useEffect(() => {
    const updateColumnCounts = () => {
      if (lastMeasureCardRef.current) {
        const cardWidth = lastMeasureCardRef.current.offsetWidth - 32; // Subtract padding
        const itemCount = measurementHistory.length - 1; // Exclude current measurement
        if (itemCount > 0) {
          const columns = calculateOptimalColumns(cardWidth, itemCount);
          setLastMeasureColumns(columns);
        }
      }
      
      if (minDistanceCardRef.current) {
        const cardWidth = minDistanceCardRef.current.offsetWidth - 32; // Subtract padding
        const itemCount = minDistanceHistory.length;
        if (itemCount > 0) {
          const columns = calculateOptimalColumns(cardWidth, itemCount);
          setMinDistanceColumns(columns);
        }
      }
    };
    
    // Update on mount and when window resizes
    updateColumnCounts();
    window.addEventListener('resize', updateColumnCounts);
    
    // Also update when measurement history changes
    const timeoutId = setTimeout(updateColumnCounts, 100);
    
    return () => {
      window.removeEventListener('resize', updateColumnCounts);
      clearTimeout(timeoutId);
    };
  }, [measurementHistory.length, minDistanceHistory.length]);

  // Save settings to localStorage when they change
  React.useEffect(() => {
    localStorage.setItem('lastMeasureHistoryCount', lastMeasureHistoryCount.toString());
  }, [lastMeasureHistoryCount]);
  
  React.useEffect(() => {
    localStorage.setItem('minDistanceHistoryCount', minDistanceHistoryCount.toString());
  }, [minDistanceHistoryCount]);

  // Track session minimum
  React.useEffect(() => {
    if (!filteredMeasurement || filteredMeasurement === '--' || isNaN(parseFloat(filteredMeasurement))) return;
    const val = parseFloat(filteredMeasurement) + (isNaN(groundReferenceHeight) ? 0 : groundReferenceHeight);
    if (val > 0 && (sessionMin === '--' || val < parseFloat(sessionMin))) {
      setSessionMin(val.toFixed(2));
    }
  }, [filteredMeasurement, groundReferenceHeight]);

  // SESSION-BASED ALERT EFFECT - Triggers on new samples or threshold changes
  // Uses measurementSampleId to detect new measurements and re-trigger alerts
  // CRITICAL: Uses lastMeasurement directly to avoid stale minDistance data
  useEffect(() => {
    // 1. CRITICAL: Fetch fresh measurement directly to avoid stale component state
    // This ensures alert effect sees the SAME measurement that incremented sampleId
    const currentMinDistance = lastMeasurement;
    
    // Validate measurement
    if (currentMinDistance === '--' || isInvalidMeasurement(currentMinDistance) || isNaN(parseFloat(currentMinDistance))) {
      // CRITICAL: Preserve acknowledged state when clearing on invalid data
      // This prevents re-triggering alerts when measurements return to valid danger zone
      if (alertSession.current.severity !== null) {
        
        // Preserve acknowledged state AND acknowledgedSeverity when clearing severity
        alertSession.current.severity = null;
        alertSession.current.sampleId = measurementSampleId;
        alertSession.current.triggerValue = null;
        // Keep alertSession.current.acknowledged and acknowledgedSeverity as is!
        
        // Clear UI state
        setAlertStatus(null);
        setTriggerValue(null);
        setHasTriggeredAlert(false);
        
        // Stop any looping sounds
        soundManager.stopSound('warning');
        soundManager.stopSound('critical');
      }
      return;
    }
    
    // 2. Calculate minAdjustedValue using groundReferenceHeight
    const validGroundRef = isNaN(groundReferenceHeight) ? 0.0 : groundReferenceHeight;
    const minAdjustedValue = parseFloat(currentMinDistance) + validGroundRef;
    
    // 2.5. CRITICAL: Skip alerts for filtered measurements (outside min/max range)
    // Users don't need these measurements, so they shouldn't trigger alerts
    if (minAdjustedValue < thresholds.minHeight || minAdjustedValue > thresholds.maxHeight) {
      // Measurement is filtered out - clear any existing alert and return early
      if (alertSession.current.severity !== null) {
        alertSession.current.severity = null;
        alertSession.current.sampleId = measurementSampleId;
        alertSession.current.triggerValue = null;
        
        setAlertStatus(null);
        setTriggerValue(null);
        setHasTriggeredAlert(false);
        
        soundManager.stopSound('warning');
        soundManager.stopSound('critical');
      }
      return;
    }
    
    // 3. Determine severity: critical if ≤ criticalThreshold, warning if ≤ warningThreshold, else null
    // Only applies to measurements within the accepted range (minHeight to maxHeight)
    let severity: 'warning' | 'critical' | null = null;
    if (thresholds.criticalThreshold > 0 && minAdjustedValue <= thresholds.criticalThreshold) {
      severity = 'critical';
    } else if (thresholds.warningThreshold > 0 && minAdjustedValue <= thresholds.warningThreshold) {
      severity = 'warning';
    }
    
    // 4. If severity is null (safe reading) → clear session completely
    // CRITICAL: Also reset if session has acknowledged flag, even if severity is already null
    // This handles case where invalid data set severity=null but preserved acknowledgment
    if (severity === null) {
      if (alertSession.current.severity !== null || alertSession.current.acknowledged) {
        
        // Safe readings reset everything including acknowledged flag
        // This allows alerts to re-trigger if measurements become dangerous again
        alertSession.current = {
          severity: null,
          sampleId: -1,
          acknowledged: false,
          acknowledgedSeverity: null,
          triggerValue: null
        };
        
        // Clear UI state
        setAlertStatus(null);
        setTriggerValue(null);
        setHasTriggeredAlert(false);
        
        // Stop any looping sounds
        soundManager.stopSound('warning');
        soundManager.stopSound('critical');
      }
      return;
    }
    
    // 5. If severity differs from current session OR current session is cleared → start new session
    // CRITICAL: Don't re-trigger if returning to previously acknowledged severity after invalid data
    // This prevents re-triggering alerts when measurements return from '--' to same danger level
    const severityDiffers = alertSession.current.severity !== severity;
    const sessionIsCleared = alertSession.current.severity === null && !alertSession.current.acknowledged;
    const returningToAcknowledgedSeverity = alertSession.current.acknowledgedSeverity === severity;
    
    const shouldStartNewSession = (severityDiffers && !returningToAcknowledgedSeverity) || sessionIsCleared;
    
    if (shouldStartNewSession) {
      
      // Stop previous sound if severity changed
      if (alertSession.current.severity && alertSession.current.severity !== severity) {
        soundManager.stopSound(alertSession.current.severity);
      }
      
      // 6. New session = {severity, sampleId, acknowledged: false, acknowledgedSeverity: null, triggerValue}
      alertSession.current = {
        severity,
        sampleId: measurementSampleId,
        acknowledged: false,
        acknowledgedSeverity: null, // Will be set when user acknowledges
        triggerValue: minAdjustedValue
      };
      
      // 8. Update UI state (setAlertStatus, setTriggerValue, setHasTriggeredAlert)
      setAlertStatus(severity);
      setTriggerValue(minAdjustedValue);
      setHasTriggeredAlert(true);
      
      // 7. Sound playback: ONLY when !session.acknowledged at session creation
      if (!alertSession.current.acknowledged) {
        if (severity === 'critical') {
          soundManager.playCritical();
        } else {
          soundManager.playWarning();
        }
      }
    } else {
      // Same session continuing - restore severity and update state
      // CRITICAL: Must restore severity so safe readings can properly reset session
      alertSession.current.severity = severity;
      alertSession.current.sampleId = measurementSampleId;
      
      // Update trigger value if it changed
      if (alertSession.current.triggerValue !== minAdjustedValue) {
        alertSession.current.triggerValue = minAdjustedValue;
        setTriggerValue(minAdjustedValue);
      }
    }
  }, [measurementSampleId, lastMeasurement, thresholds.warningThreshold, thresholds.criticalThreshold, groundReferenceHeight]);
  
  // Sync acknowledged flag when alerts are cleared externally
  useEffect(() => {
    if (alertStatus === null && !alertSession.current.acknowledged && alertSession.current.severity !== null) {
      alertSession.current.acknowledged = true;
      alertSession.current.acknowledgedSeverity = alertSession.current.severity; // Remember WHAT was acknowledged
    }
  }, [alertStatus]);

  const handleResetMin = () => {
    // Reset minimum distance to "--" and clear history
    setMinDistance('--');
    setMinDistanceHistory([]);
    setHasTriggeredAlert(false);
    
    // Clear any active alerts
    setAlertStatus(null);
    setTriggerValue(null);
    
    // Stop any alert sounds
    soundManager.stopSound('warning');
    soundManager.stopSound('critical');
    
  };
  
  const handleResetMax = () => {
    setMaxDistance('--');
    setMaxDistanceHistory([]);
  };
  
  const handleResetAverage = () => {
    setMeasurementHistory([]);
  };

  // Update measurements when lastMeasurement changes
  useEffect(() => {
    // Ensure groundReferenceHeight is a valid number
    const validGroundRef = isNaN(groundReferenceHeight) ? 0.0 : groundReferenceHeight;
    
    // For current measurement, show the latest value but apply filtering for logging consistency
    if (lastMeasurement === undefined || lastMeasurement === null) {
      setMeasurementInMeters('--');
      setMeasurementInFeet('--');
    } else if (lastMeasurement === 'infinity') {
      setMeasurementInMeters('infinity');
      setMeasurementInFeet('infinity');
    } else if (!isNaN(parseFloat(lastMeasurement))) {
      try {
        const measurementValue = parseFloat(lastMeasurement);
        const adjustedValue = measurementValue + validGroundRef;
        
        // CRITICAL: Only display measurements that are within valid range
        // This ensures consistency between what's displayed and what's logged
        if (adjustedValue >= thresholds.minHeight && adjustedValue <= thresholds.maxHeight) {
          setMeasurementInMeters(adjustedValue.toFixed(2));
          setMeasurementInFeet((adjustedValue * 3.28084).toFixed(2));
        } else {
          setMeasurementInMeters('--');
          setMeasurementInFeet('--');
        }
        
        // For filtered measurement and history, only update if within valid range
        if (adjustedValue >= thresholds.minHeight && adjustedValue <= thresholds.maxHeight) {
          setFilteredMeasurement(lastMeasurement);
          
          // Update measurement history with unique values only
          setMeasurementHistory(prev => {
            const newValue = adjustedValue.toFixed(2);
            // Only add if it's different from the last measurement in history
            if (prev.length === 0 || prev[0] !== newValue) {
              // Add to front and keep only last measurements
              return [newValue, ...prev.slice(0, lastMeasureHistoryCount - 1)];
            }
            return prev;
          });
          
          // Update minimum distance if this is a new minimum
          if (minDistance === '--' || (
              !isInvalidMeasurement(lastMeasurement) && 
              !isInvalidMeasurement(minDistance) && 
              parseFloat(lastMeasurement) < parseFloat(minDistance))) {
            // Store previous minimum in history before updating
            if (minDistance !== '--' && !isInvalidMeasurement(minDistance)) {
              const prevMinAdjusted = (parseFloat(minDistance) + validGroundRef).toFixed(2);
              setMinDistanceHistory(prev => {
                // Only add if it's different from the last minimum in history
                if (prev.length === 0 || prev[0] !== prevMinAdjusted) {
                  return [prevMinAdjusted, ...prev.slice(0, minDistanceHistoryCount - 1)];
                }
                return prev;
              });
            }
            
            setMinDistance(lastMeasurement);
          }
          
          // Update maximum distance if this is a new maximum
          if (maxDistance === '--' || (
              !isInvalidMeasurement(lastMeasurement) && 
              !isInvalidMeasurement(maxDistance) && 
              parseFloat(lastMeasurement) > parseFloat(maxDistance))) {
            // Store previous maximum in history before updating
            if (maxDistance !== '--' && !isInvalidMeasurement(maxDistance)) {
              const prevMaxAdjusted = (parseFloat(maxDistance) + validGroundRef).toFixed(2);
              setMaxDistanceHistory(prev => {
                if (prev.length === 0 || prev[0] !== prevMaxAdjusted) {
                  return [prevMaxAdjusted, ...prev.slice(0, minDistanceHistoryCount - 1)];
                }
                return prev;
              });
            }
            
            setMaxDistance(lastMeasurement);
          }
        }
      } catch (error) {
        setMeasurementInMeters('--');
        setMeasurementInFeet('--');
      }
    } else {
      setMeasurementInMeters('--');
      setMeasurementInFeet('--');
    }
  }, [lastMeasurement, groundReferenceHeight, thresholds, minDistance, lastMeasureHistoryCount, minDistanceHistoryCount]);
  
  // Listen for laser measurement updates from the store
  useEffect(() => {
    const handleLaserUpdate = (event: CustomEvent) => {
      const measurement = event.detail.measurement;
      
      // Force re-calculation of measurements
      const validGroundRef = isNaN(groundReferenceHeight) ? 0.0 : groundReferenceHeight;
      
      if (measurement === 'infinity') {
        setMeasurementInMeters('infinity');
        setMeasurementInFeet('infinity');
      } else if (measurement === '--' || isNaN(parseFloat(measurement))) {
        setMeasurementInMeters('--');
        setMeasurementInFeet('--');
      } else {
        const numValue = parseFloat(measurement);
        const adjustedValue = numValue + validGroundRef;
        setMeasurementInMeters(adjustedValue.toFixed(2));
        setMeasurementInFeet((adjustedValue * 3.28084).toFixed(2));
      }
    };
    
    window.addEventListener('laser-measurement-update', handleLaserUpdate as EventListener);
    
    return () => {
      window.removeEventListener('laser-measurement-update', handleLaserUpdate as EventListener);
    };
  }, [groundReferenceHeight]);

  return (
    <div className="space-y-4">
      <AlertBanner 
        alertStatus={alertStatus} 
        setAlertStatus={setAlertStatus}
        triggerValue={triggerValue}
      />
      
      <div className="space-y-4">
        {/* Row 1 - Current (big) | Last + Min (half size) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Current Measure - full column */}
            <CurrentMeasureCard
              measurementInMeters={measurementInMeters}
              measurementInFeet={measurementInFeet}
              lastMeasurement={lastMeasurement}
              groundReferenceHeight={groundReferenceHeight}
              thresholds={thresholds}
            />

            {/* Right column: Last + Min stacked at half size */}
            <div className="flex flex-col gap-2">
              {/* Last Measure - half size text */}
              <div className="bg-gray-800 px-3 py-2 rounded-xl flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                    <span>🕐</span> Last Measure
                  </h3>
                  <button onClick={() => setShowHistorySettings(true)} className="p-0.5 hover:bg-gray-700 rounded">
                    <span className="text-gray-500 text-xs">⚙</span>
                  </button>
                </div>
                <div className="font-mono">
                  {(() => {
                    const val = filteredMeasurement !== '--' && !isNaN(parseFloat(filteredMeasurement))
                      ? parseFloat(filteredMeasurement) + groundReferenceHeight : null;
                    const primary = val !== null ? `${val.toFixed(2)}m` : '--';
                    const ftIn = val !== null ? `${Math.floor(val * 3.28084)}' ${Math.round((val * 3.28084 % 1) * 12)}"` : '--';
                    return (
                      <>
                        <div className="text-xl font-bold">{primary}</div>
                        <div className="text-sm text-gray-400">{ftIn}</div>
                      </>
                    );
                  })()}
                </div>
                {measurementHistory.length > 1 && (
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {measurementHistory.slice(1, 4).map((m, i) => {
                      const v = parseFloat(m) + groundReferenceHeight;
                      return <span key={i} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded font-mono">{isNaN(v) ? '--' : v.toFixed(2)}m</span>;
                    })}
                  </div>
                )}
              </div>

              {/* Session Minimum */}
              <div className="bg-gray-800 px-3 py-2 rounded-xl flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                    <span>⬇</span> Session Min
                  </h3>
                  <button onClick={() => setSessionMin('--')} className="p-0.5 hover:bg-gray-700 rounded" title="Reset minimum">
                    <span className="text-gray-500 text-xs">↺</span>
                  </button>
                </div>
                <div className="font-mono">
                  {(() => {
                    const val = sessionMin !== '--' && !isNaN(parseFloat(sessionMin)) ? parseFloat(sessionMin) : null;
                    const primary = val !== null ? `${val.toFixed(2)}m` : '--';
                    const ftIn = val !== null ? `${Math.floor(val * 3.28084)}ft ${Math.round((val * 3.28084 % 1) * 12)}in` : '--';
                    return (
                      <>
                        <div className={`text-xl font-bold ${val !== null && val < (thresholds.warningThreshold || 99) ? 'text-orange-400' : ''}`}>{primary}</div>
                        <div className="text-sm text-gray-400">{ftIn}</div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
        </div>
      </div>
      
      <HistorySettingsModal
        isOpen={showHistorySettings}
        onClose={() => setShowHistorySettings(false)}
        lastMeasureHistoryCount={lastMeasureHistoryCount}
        setLastMeasureHistoryCount={setLastMeasureHistoryCount}
        minDistanceHistoryCount={minDistanceHistoryCount}
        setMinDistanceHistoryCount={setMinDistanceHistoryCount}
      />
    </div>
  );
};

export default MeasurementCards;