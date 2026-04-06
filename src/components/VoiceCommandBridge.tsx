import { useEffect, useRef } from 'react';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { soundManager } from '../lib/sounds';

/**
 * VoiceCommandBridge - Simplified!
 * 
 * Most voice commands now trigger keyboard shortcuts directly via triggerKeyboardShortcut(),
 * so we only need to register callbacks for commands that DON'T have keyboard shortcuts:
 * - clearWarnings (audio-only action)
 * - clearCritical (audio-only action)
 * - manualLog (special handling needed)
 * - recordNote (microphone recording)
 * 
 * All other actions (capture, POI types, logging controls, etc.) are handled by existing
 * keyboard shortcut handlers in KeyboardShortcutHandler.tsx
 */

interface VoiceCommandBridgeProps {
  setAlertStatus: (status: 'OK' | 'WARNING' | 'DANGER') => void;
}

const VoiceCommandBridge: React.FC<VoiceCommandBridgeProps> = ({
  setAlertStatus
}) => {
  const [voiceState, voiceActions] = useVoiceAssistant();

  // Use ref to always have access to latest callback function
  const setAlertStatusRef = useRef(setAlertStatus);

  useEffect(() => {
    setAlertStatusRef.current = setAlertStatus;
  }, [setAlertStatus]);

  useEffect(() => {
    if (!voiceState.isInitialized) {
      return;
    }
    
    // Only register callbacks for commands without keyboard shortcuts
    
    voiceActions.onClearWarnings(() => {
      setAlertStatusRef.current('OK');
      soundManager.stopSound('warning');
    });

    voiceActions.onClearCritical(() => {
      setAlertStatusRef.current('OK');
      soundManager.stopSound('critical');
    });

    // Manual log entry - dispatch event for LoggingControls to handle
    voiceActions.onManualLog(() => {
      window.dispatchEvent(new CustomEvent('voice-manual-log'));
    });

    // Voice note recording - dispatch event for future implementation
    voiceActions.onRecordNote(() => {
      window.dispatchEvent(new CustomEvent('voice-record-note'));
    });

  }, [voiceState.isInitialized, voiceActions]);

  return null;
};

export default VoiceCommandBridge;
