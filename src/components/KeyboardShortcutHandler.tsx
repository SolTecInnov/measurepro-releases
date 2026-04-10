import React from 'react';
import { useKeyboardStore } from '../lib/keyboard';
import { soundManager } from '../lib/sounds';
import { useSurveyStore } from '../lib/survey';
import { useEnvelopeStore } from '../stores/envelopeStore';
import { toast } from 'sonner';
import type { POIType } from '../lib/poi';
import { usePOIActionsStore } from '../lib/poiActions';
import { useRainModeStore } from '../lib/stores/rainModeStore';

interface KeyboardShortcutHandlerProps {
  setSelectedPOIType: (type: string | POIType | '') => void;
  handleCaptureImage: () => void;
  clearCapturedImages: () => void;
  handleLogMeasurement: () => void;
  handleDeleteLastEntry: () => void;
  setAlertStatus: (status: 'OK' | 'WARNING' | 'DANGER') => void;
  startLogging: () => void;
  stopLogging: () => void;
  pauseLogging: () => void;
  resumeLogging: () => void;
  handleLoggingModeChange: (mode: 'manual' | 'all' | 'detection' | 'manualDetection' | 'counterDetection') => void;
  handleAutoCaptureNoMeasurement: () => Promise<void>;
  handleOpenModalWithPOIType: (poiType: POIType) => void;
  handleVoiceNoteRequested: () => Promise<void>;
  loggingMode?: string;
  isLogging?: boolean;
}

const KeyboardShortcutHandler: React.FC<KeyboardShortcutHandlerProps> = ({
  setSelectedPOIType,
  handleCaptureImage,
  clearCapturedImages,
  handleLogMeasurement,
  handleDeleteLastEntry,
  setAlertStatus,
  startLogging,
  stopLogging,
  pauseLogging,
  resumeLogging,
  handleLoggingModeChange,
  handleAutoCaptureNoMeasurement,
  handleOpenModalWithPOIType,
  handleVoiceNoteRequested,
  loggingMode,
  isLogging
}) => {
  const { mapping } = useKeyboardStore();
  const { activeSurvey } = useSurveyStore();
  const { getActionForPOI } = usePOIActionsStore();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      if (e.altKey || e.ctrlKey) {
      }

      if (e.repeat) return;

      const matchShortcut = (shortcut: { key: string; ctrl?: boolean; alt?: boolean; shift?: boolean; description?: string }) => {
        const eventKey = e.key === ' ' ? 'Space' : e.key.toUpperCase();
        const eventCode = e.code ? e.code.replace('Key', '').replace('Digit', '').toUpperCase() : '';
        const shortcutKey = shortcut.key.toUpperCase();

        // Match by key name OR key code (StreamDeck may send empty code)
        const keyMatch = eventKey === shortcutKey || (eventCode && eventCode === shortcutKey);

        const match = keyMatch &&
          !!e.ctrlKey === !!shortcut.ctrl &&
          !!e.altKey === !!shortcut.alt &&
          !!e.shiftKey === !!shortcut.shift;

        return match;
      };

      if (matchShortcut(mapping.nonePoiType)) {
        e.preventDefault();
        setSelectedPOIType('');
        return;
      }

      if (matchShortcut(mapping.manualLogEntry)) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('open-manual-log-entry'));
        return;
      }

      for (const [type, shortcut] of Object.entries(mapping.poiTypes)) {
        if (matchShortcut(shortcut)) {
          e.preventDefault();
          const poiType = type as POIType;
          
          console.log(`[KeyboardShortcut] POI type keyboard shortcut detected: "${poiType}"`);
          
          setSelectedPOIType(poiType);
          console.log(`[KeyboardShortcut] POI type set in store: "${poiType}"`);
          
          const action = getActionForPOI(poiType);
          console.log(`[KeyboardShortcut] Action for "${poiType}": ${action}`);
          
          switch (action) {
            case 'auto-capture-and-log':
              break;
            case 'auto-capture-no-measurement':
              if (!activeSurvey) {
                toast.error('No active survey', { description: 'Please create a survey before logging POI.' });
                break;
              }
              if (!loggingMode || loggingMode === 'none' || loggingMode === 'off') {
                toast.error('No measurement capture mode selected', { description: 'Please select a measurement capture mode before logging POI.' });
                break;
              }
              if (!isLogging) {
                toast.error('Logging not active', { description: 'Please start logging before capturing POI.' });
                break;
              }
              handleAutoCaptureNoMeasurement();
              break;
            case 'open-manual-modal':
              if (!activeSurvey) {
                toast.error('No active survey', { description: 'Please create a survey before logging POI.' });
                break;
              }
              if (!loggingMode || loggingMode === 'none' || loggingMode === 'off') {
                toast.error('No measurement capture mode selected', { description: 'Please select a measurement capture mode before logging POI.' });
                break;
              }
              handleOpenModalWithPOIType(poiType);
              break;
            case 'voice-note':
              if (!activeSurvey) {
                toast.error('No active survey', { description: 'Please create a survey before logging POI.' });
                break;
              }
              if (!loggingMode || loggingMode === 'none' || loggingMode === 'off') {
                toast.error('No measurement capture mode selected', { description: 'Please select a measurement capture mode before logging POI.' });
                break;
              }
              handleVoiceNoteRequested();
              break;
            case 'select-only':
              break;
          }
          
          return;
        }
      }

      // Rain Mode toggle: Alt+R
      if (e.altKey && (e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        const rainStore = useRainModeStore.getState();
        rainStore.toggle();
        const isNowActive = useRainModeStore.getState().isActive;
        if (isNowActive) {
          toast.info('Rain Mode ON — logging without laser measurements', { id: 'rain-mode', duration: 3000 });
          soundManager.playWarning();
        } else {
          toast.success('Rain Mode OFF — normal measurement logging', { id: 'rain-mode', duration: 3000 });
        }
        return;
      }

      if (matchShortcut(mapping.capture)) {
        e.preventDefault();
        handleCaptureImage();
        return;
      }

      if (matchShortcut(mapping.clearImages)) {
        e.preventDefault();
        clearCapturedImages();
        return;
      }

      if (matchShortcut(mapping.logMeasurement)) {
        e.preventDefault();

        if (!activeSurvey) {
          window.dispatchEvent(new CustomEvent('log-independent-measurement'));
        } else {
          handleLogMeasurement();
        }
        return;
      }

      if (matchShortcut(mapping.deleteLastEntry)) {
        e.preventDefault();
        handleDeleteLastEntry();
        return;
      }

      if (matchShortcut(mapping.clearAlert)) {
        e.preventDefault();
        setAlertStatus('OK');
        soundManager.stopSound('warning');
        soundManager.stopSound('critical');
        return;
      }

      if (matchShortcut(mapping.loggingControls.startLog)) {
        e.preventDefault();
        startLogging();
        return;
      }
      if (matchShortcut(mapping.loggingControls.stopLog)) {
        e.preventDefault();
        stopLogging();
        return;
      }
      if (matchShortcut(mapping.loggingControls.pauseLog)) {
        e.preventDefault();
        pauseLogging();
        return;
      }
      if (matchShortcut(mapping.loggingControls.resumeLog)) {
        e.preventDefault();
        resumeLogging();
        return;
      }
      if (matchShortcut(mapping.loggingControls.modeManual)) {
        e.preventDefault();
        handleLoggingModeChange('manual');
        return;
      }
      if (matchShortcut(mapping.loggingControls.modeAllData)) {
        e.preventDefault();
        handleLoggingModeChange('all');
        return;
      }
      if (matchShortcut(mapping.loggingControls.modeDetection)) {
        e.preventDefault();
        handleLoggingModeChange('detection');
        return;
      }
      if (matchShortcut(mapping.loggingControls.modeManualDetection)) {
        e.preventDefault();
        handleLoggingModeChange('manualDetection');
        return;
      }
      if (matchShortcut(mapping.loggingControls.modeCounterDetection)) {
        e.preventDefault();
        handleLoggingModeChange('counterDetection');
        return;
      }

      if (matchShortcut(mapping.detectionControls.toggleCityMode)) {
        e.preventDefault();
        try {
          const config = localStorage.getItem('overhead_detection_config');
          let parsed = config ? JSON.parse(config) : { version: '1.0.0', profileName: 'Fair Weather', events: {}, global: {} };
          
          const newCityMode = !parsed.global?.cityMode;
          parsed.global = { ...parsed.global, cityMode: newCityMode };
          
          localStorage.setItem('overhead_detection_config', JSON.stringify(parsed));
          
          // toast suppressed
          
          window.dispatchEvent(new CustomEvent('overhead-config-updated'));
        } catch (error) {
          toast.error('Failed to toggle city mode');
        }
        return;
      }

      if (matchShortcut(mapping.envelopeMonitoring.toggleEnvelope)) {
        e.preventDefault();
        const store = useEnvelopeStore.getState();
        const newEnabled = !store.settings.enabled;
        store.updateSettings({ enabled: newEnabled });
        // toast suppressed
        return;
      }

      if (matchShortcut(mapping.envelopeMonitoring.cycleProfile)) {
        e.preventDefault();
        const store = useEnvelopeStore.getState();
        const { profiles, settings } = store;
        const profileArray = Object.values(profiles);
        const currentIndex = profileArray.findIndex(p => p.id === settings.activeProfileId);
        const nextIndex = (currentIndex + 1) % profileArray.length;
        const nextProfile = profileArray[nextIndex];
        
        if (nextProfile) {
          store.updateSettings({ activeProfileId: nextProfile.id });
          // toast suppressed
        }
        return;
      }

      if (matchShortcut(mapping.lateralRearCapture.captureLeft)) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('lateral-capture-left'));
        return;
      }
      if (matchShortcut(mapping.lateralRearCapture.captureRight)) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('lateral-capture-right'));
        return;
      }
      if (matchShortcut(mapping.lateralRearCapture.captureTotal)) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('lateral-capture-total'));
        return;
      }
      if (matchShortcut(mapping.lateralRearCapture.captureRear)) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('rear-capture'));
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    mapping,
    setSelectedPOIType,
    handleCaptureImage,
    clearCapturedImages,
    handleLogMeasurement,
    handleDeleteLastEntry,
    setAlertStatus,
    startLogging,
    stopLogging,
    pauseLogging,
    resumeLogging,
    handleLoggingModeChange,
    handleAutoCaptureNoMeasurement,
    handleOpenModalWithPOIType,
    handleVoiceNoteRequested,
    activeSurvey,
    getActionForPOI,
    loggingMode,
    isLogging
  ]);

  return null;
};

export default KeyboardShortcutHandler;
