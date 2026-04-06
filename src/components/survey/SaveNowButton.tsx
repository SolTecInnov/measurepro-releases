import React, { useState, useEffect } from 'react';
import { Save, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getMeasurementLogger } from '../../lib/workers/MeasurementLoggerClient';
import { triggerManualAutoSave } from '../../lib/utils/autoSaveUtils';
import { useSurveyStore } from '../../lib/survey';
import { toast } from 'sonner';

interface SaveNowButtonProps {
  activeSurveyId?: string;
  compact?: boolean;
}

const SaveNowButton: React.FC<SaveNowButtonProps> = ({ activeSurveyId, compact = false }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [bufferSize, setBufferSize] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const { activeSurvey } = useSurveyStore();

  useEffect(() => {
    if (!activeSurveyId) return;

    const checkBuffer = async () => {
      try {
        const logger = getMeasurementLogger();
        const stats = await logger.getStats();
        setBufferSize(stats.bufferSize || 0);
      } catch (error) {
        // Silent fail - not critical
      }
    };

    checkBuffer();
    const interval = setInterval(checkBuffer, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [activeSurveyId]);

  const handleSaveNow = async () => {
    if (isSaving) return;

    setIsSaving(true);
    let hadErrors = false;
    
    try {
      const logger = getMeasurementLogger();
      const stats = await logger.getStats();
      
      // 1. Flush measurement buffer to IndexedDB
      if (stats.bufferSize > 0) {
        const result = await logger.flush();
        
        if (result.failed > 0) {
          hadErrors = true;
          toast.error(`Save partially failed: ${result.failed} measurements could not be saved`);
        }
      }
      
      // 2. Also save survey metadata
      if (activeSurvey) {
        await triggerManualAutoSave(activeSurvey);
      }
      
      // Show success feedback
      if (!hadErrors) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
      }
      
      setBufferSize(0);
    } catch (error) {
      console.error('Manual save failed:', error);
      toast.error('Failed to save measurements to storage');
    } finally {
      setIsSaving(false);
    }
  };

  if (!activeSurveyId) return null;

  if (compact) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleSaveNow}
        disabled={isSaving}
        className={`h-8 px-2 ${showSuccess ? 'bg-green-500/20 border-green-500' : ''}`}
        data-testid="button-save-now-compact"
        title={bufferSize > 0 ? `Save ${bufferSize} unsaved measurements to storage` : 'Save survey data to storage'}
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : showSuccess ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <>
            <Save className="h-4 w-4" />
            {bufferSize > 0 && (
              <span className="ml-1 text-xs bg-orange-500 text-white rounded-full px-1.5 min-w-[1.25rem]">
                {bufferSize}
              </span>
            )}
          </>
        )}
      </Button>
    );
  }

  return (
    <button
      onClick={handleSaveNow}
      disabled={isSaving}
      className={`flex items-center justify-center px-3 py-2 rounded-lg transition-colors border ${
        showSuccess 
          ? 'bg-green-500/20 border-green-500' 
          : 'bg-gray-700 hover:bg-gray-600 border-gray-600'
      } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
      data-testid="button-save-now"
      title={bufferSize > 0 ? `Save ${bufferSize} unsaved measurements` : 'Save survey data'}
    >
      {isSaving ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : showSuccess ? (
        <Check className="w-5 h-5 text-green-500" />
      ) : (
        <div className="relative">
          <Save className="w-5 h-5" />
          {bufferSize > 0 && (
            <span className="absolute -top-2 -right-2 text-[10px] bg-orange-500 text-white rounded-full px-1 min-w-[1rem] text-center">
              {bufferSize}
            </span>
          )}
        </div>
      )}
    </button>
  );
};

export default SaveNowButton;
