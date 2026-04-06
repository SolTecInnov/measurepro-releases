import React, { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, ArrowRight, Trash2, AlertCircle, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getMeasurementLogger } from '../../lib/workers/MeasurementLoggerClient';
import { openSurveyDB } from '../../lib/survey/db';
import { useSurveyStore } from '../../lib/survey';
import { Survey } from '../../lib/survey/types';
import { toast } from 'sonner';

interface RecoveryData {
  surveyId: string;
  surveyTitle: string;
  partOrdinal: number;
  measurementCount: number;
  bufferSize: number;
  lastActivity: string;
  ownerEmail: string;
  isEndOfDay?: boolean;
  pausedAt?: string;
}

interface CrashRecoveryDialogProps {
  onClose: () => void;
}

const CrashRecoveryDialog: React.FC<CrashRecoveryDialogProps> = ({ onClose }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [recoveryData, setRecoveryData] = useState<RecoveryData | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const { setActiveSurvey, loadPreviousSurvey } = useSurveyStore();

  useEffect(() => {
    checkForRecoveryData();
  }, []);

  const checkForRecoveryData = async () => {
    try {
      setIsLoading(true);

      // Check for unsaved measurements in worker buffer
      const logger = getMeasurementLogger();
      await logger.init();
      const stats = await logger.getStats();

      // Check for last active survey in IndexedDB
      const db = await openSurveyDB();
      const surveys = await db.getAll('surveys');
      
      // Find surveys that were active (have measurements but not closed)
      const activeSurveys = surveys.filter((s: Survey) => !s.closedAt);
      
      // Also check for end-of-day paused surveys (these need a friendly "resume" prompt)
      const endOfDaySurveys = surveys.filter((s: Survey) => s.closureReason === 'end_of_day' && !s.active);
      
      if (activeSurveys.length === 0 && stats.bufferSize === 0 && endOfDaySurveys.length === 0) {
        // No recovery needed
        onClose();
        return;
      }

      // Prioritize end-of-day paused surveys over crash recovery
      if (endOfDaySurveys.length > 0 && activeSurveys.length === 0) {
        const pausedSurvey = endOfDaySurveys.sort((a: Survey, b: Survey) => {
          const aDate = new Date(a.pausedAt || a.closedAt || a.createdAt).getTime();
          const bDate = new Date(b.pausedAt || b.closedAt || b.createdAt).getTime();
          return bDate - aDate;
        })[0];
        
        const measurements = await db.getAllFromIndex('measurements', 'by-survey', pausedSurvey.id);
        setRecoveryData({
          surveyId: pausedSurvey.id,
          surveyTitle: pausedSurvey.surveyTitle || 'Unnamed Survey',
          partOrdinal: pausedSurvey.partOrdinal || 1,
          measurementCount: measurements.length,
          bufferSize: stats.bufferSize,
          lastActivity: pausedSurvey.pausedAt || pausedSurvey.closedAt || pausedSurvey.createdAt,
          ownerEmail: pausedSurvey.ownerEmail || '',
          isEndOfDay: true,
          pausedAt: pausedSurvey.pausedAt || pausedSurvey.closedAt
        });
        return;
      }

      // Get most recent active survey
      const lastSurvey = activeSurveys.sort((a: Survey, b: Survey) => {
        const aDate = new Date(a.createdAt).getTime();
        const bDate = new Date(b.createdAt).getTime();
        return bDate - aDate;
      })[0];

      if (lastSurvey) {
        // Get measurements for this survey (by-survey index uses user_id field)
        const measurements = await db.getAllFromIndex('measurements', 'by-survey', lastSurvey.id);
        
        setRecoveryData({
          surveyId: lastSurvey.id,
          surveyTitle: lastSurvey.surveyTitle || 'Unnamed Survey',
          partOrdinal: lastSurvey.partOrdinal || 1,
          measurementCount: measurements.length,
          bufferSize: stats.bufferSize,
          lastActivity: lastSurvey.createdAt,
          ownerEmail: lastSurvey.ownerEmail || ''
        });
      } else if (stats.bufferSize > 0) {
        // We have orphaned buffer data but no survey
        setRecoveryData({
          surveyId: '',
          surveyTitle: 'Unknown Survey',
          partOrdinal: 1,
          measurementCount: 0,
          bufferSize: stats.bufferSize,
          lastActivity: new Date().toISOString(),
          ownerEmail: ''
        });
      }
    } catch (error) {
      console.error('Failed to check recovery data:', error);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueSurvey = async () => {
    if (!recoveryData || !recoveryData.surveyId) return;
    
    setIsRecovering(true);
    try {
      if (recoveryData.isEndOfDay) {
        // Use loadPreviousSurvey to properly clear closureReason and log DAY_RESUME POI
        await loadPreviousSurvey(recoveryData.surveyId);
      } else {
        // Restore the survey as active (crash recovery path)
        const db = await openSurveyDB();
        const survey = await db.get('surveys', recoveryData.surveyId);
        
        if (survey) {
          setActiveSurvey(survey);
          // Note: No toast per policy (errors only)
        }
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to continue survey:', error);
      toast.error('Failed to restore survey');
    } finally {
      setIsRecovering(false);
    }
  };

  const handleStartPart2 = async () => {
    if (!recoveryData || !recoveryData.surveyId) return;
    
    setIsRecovering(true);
    try {
      const db = await openSurveyDB();
      const oldSurvey = await db.get('surveys', recoveryData.surveyId);
      
      if (oldSurvey) {
        // Mark old survey as closed
        await db.put('surveys', {
          ...oldSurvey,
          closedAt: new Date().toISOString()
        });
        
        // Create new survey as Part 2 (copy all fields from old survey)
        const newSurvey: Survey = {
          ...oldSurvey,
          id: crypto.randomUUID(),
          partOrdinal: (oldSurvey.partOrdinal || 1) + 1,
          rootSurveyId: oldSurvey.rootSurveyId || recoveryData.surveyId,
          poiCount: 0,
          createdAt: new Date().toISOString(),
          closedAt: undefined,
          closureReason: null
        };
        
        await db.put('surveys', newSurvey);
        setActiveSurvey(newSurvey);
        // Note: No toast per policy (errors only)
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to start Part 2:', error);
      toast.error('Failed to create Part 2');
    } finally {
      setIsRecovering(false);
    }
  };

  const handleStartFresh = async () => {
    setIsRecovering(true);
    try {
      // Clear the worker buffer
      const logger = getMeasurementLogger();
      await logger.clearBuffer();
      
      // Note: Don't delete the old survey data - user might want it later
      // Just close this dialog and let them create a new survey
      
      onClose();
    } catch (error) {
      console.error('Failed to start fresh:', error);
      toast.error('Failed to clear buffer');
    } finally {
      setIsRecovering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-400" />
          <p className="text-gray-300">Checking for recovery data...</p>
        </div>
      </div>
    );
  }

  if (!recoveryData) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          {recoveryData.isEndOfDay ? (
            <Moon className="w-8 h-8 text-amber-400" />
          ) : (
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          )}
          <h2 className="text-xl font-bold text-white">
            {recoveryData.isEndOfDay ? 'Good morning — Resume Your Survey?' : 'Survey Recovery'}
          </h2>
        </div>

        <div className={`rounded-lg p-4 mb-6 ${recoveryData.isEndOfDay ? 'bg-amber-900/30 border border-amber-500/30' : 'bg-yellow-900/30 border border-yellow-500/30'}`}>
          <p className={`text-sm ${recoveryData.isEndOfDay ? 'text-amber-200' : 'text-yellow-200'}`}>
            {recoveryData.isEndOfDay
              ? `You paused "${recoveryData.surveyTitle}" yesterday${recoveryData.pausedAt ? ` on ${new Date(recoveryData.pausedAt).toLocaleDateString()}` : ''}. Ready to continue?`
              : 'We found an incomplete survey from your previous session. How would you like to proceed?'
            }
          </p>
        </div>

        <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-400">Survey:</div>
            <div className="text-white font-medium">{recoveryData.surveyTitle}</div>
            
            {recoveryData.partOrdinal > 1 && (
              <>
                <div className="text-gray-400">Part:</div>
                <div className="text-white">{recoveryData.partOrdinal}</div>
              </>
            )}
            
            <div className="text-gray-400">Saved POIs:</div>
            <div className="text-white">{recoveryData.measurementCount}</div>
            
            {recoveryData.bufferSize > 0 && (
              <>
                <div className="text-gray-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-orange-400" />
                  Unsaved:
                </div>
                <div className="text-orange-400 font-medium">{recoveryData.bufferSize}</div>
              </>
            )}
            
            <div className="text-gray-400">Last Activity:</div>
            <div className="text-white">{formatDate(recoveryData.lastActivity)}</div>
          </div>
        </div>

        <div className="space-y-3">
          {recoveryData.surveyId && (
            <Button
              onClick={handleContinueSurvey}
              disabled={isRecovering}
              className={`w-full text-white ${recoveryData.isEndOfDay ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}
              data-testid="button-continue-survey"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              {recoveryData.isEndOfDay ? 'Resume Survey' : 'Continue Survey'}
            </Button>
          )}

          {recoveryData.surveyId && !recoveryData.isEndOfDay && (
            <Button
              onClick={handleStartPart2}
              disabled={isRecovering}
              variant="outline"
              className="w-full border-blue-500 text-blue-400 hover:bg-blue-900/30"
              data-testid="button-start-part2"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Start Part {(recoveryData.partOrdinal || 1) + 1}
            </Button>
          )}

          <Button
            onClick={handleStartFresh}
            disabled={isRecovering}
            variant="outline"
            className="w-full border-red-500 text-red-400 hover:bg-red-900/30"
            data-testid="button-start-fresh"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Start Fresh (Discard Buffer)
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          Previous survey data will be preserved in storage regardless of your choice.
        </p>
      </div>
    </div>
  );
};

export default CrashRecoveryDialog;
