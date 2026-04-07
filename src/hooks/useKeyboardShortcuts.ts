import { useEffect, useRef } from 'react';
import { useKeyboardStore } from '../lib/keyboard';
import { toast } from 'sonner';

interface UseKeyboardShortcutsProps {
  onAcceptDetection?: () => void;
  onRejectDetection?: () => void;
  onCorrectDetection?: () => void;
  onTestDetection?: () => void;
  onToggleVideoRecording?: () => void;
  onInsta360ToggleRecording?: () => void;
  onInsta360TakePhoto?: () => void;
  enabled?: boolean;
}

/**
 * Custom hook for handling AI detection and video recording keyboard shortcuts
 * 
 * @param onAcceptDetection - Callback for Alt+7 (Accept Detection)
 * @param onRejectDetection - Callback for Alt+8 (Reject Detection)
 * @param onCorrectDetection - Callback for Alt+9 (Correct Detection)
 * @param onTestDetection - Callback for Alt+0 (Test Detection)
 * @param onToggleVideoRecording - Callback for Alt+V (Toggle Video Recording)
 * @param enabled - Whether shortcuts are enabled (default: true)
 */
export const useKeyboardShortcuts = ({
  onAcceptDetection,
  onRejectDetection,
  onCorrectDetection,
  onTestDetection,
  onToggleVideoRecording,
  onInsta360ToggleRecording,
  onInsta360TakePhoto,
  enabled = true,
}: UseKeyboardShortcutsProps) => {
  const { mapping } = useKeyboardStore();
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent key repeat - debounce to 200ms
      const now = Date.now();
      if (now - lastKeyTimeRef.current < 200) return;
      lastKeyTimeRef.current = now;

      // Skip if we're in an input, textarea or contenteditable
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      // Prevent key repeat
      if (e.repeat) return;

      // Helper function to match shortcuts (Stream Deck compatible)
      const matchShortcut = (shortcut: { key: string; ctrl?: boolean; alt?: boolean; shift?: boolean }) => {
        // Support both e.key and e.code for Stream Deck compatibility
        const eventKey = e.key === ' ' ? 'Space' : e.key.toUpperCase();
        const eventCode = e.code ? e.code.replace('Key', '').replace('Digit', '').toUpperCase() : '';
        const shortcutKey = shortcut.key.toUpperCase();
        
        // Match by key OR code (Stream Deck might use different property)
        const keyMatch = eventKey === shortcutKey || eventCode === shortcutKey;
        
        return keyMatch &&
          !!e.ctrlKey === !!shortcut.ctrl &&
          !!e.altKey === !!shortcut.alt &&
          !!e.shiftKey === !!shortcut.shift;
      };

      // Handle AI Detection shortcuts
      if (matchShortcut(mapping.aiDetection.acceptDetection)) {
        e.preventDefault();
        if (onAcceptDetection) {
          onAcceptDetection();
        } else {
          // toast suppressed
        }
        return;
      }

      if (matchShortcut(mapping.aiDetection.rejectDetection)) {
        e.preventDefault();
        if (onRejectDetection) {
          onRejectDetection();
        } else {
          // toast suppressed
        }
        return;
      }

      if (matchShortcut(mapping.aiDetection.correctDetection)) {
        e.preventDefault();
        if (onCorrectDetection) {
          onCorrectDetection();
        } else {
          // toast suppressed
        }
        return;
      }

      if (matchShortcut(mapping.aiDetection.testDetection)) {
        e.preventDefault();
        if (onTestDetection) {
          onTestDetection();
        } else {
          // toast suppressed
        }
        return;
      }

      // Handle Video Recording shortcuts
      if (matchShortcut(mapping.videoRecording.toggleRecording)) {
        e.preventDefault();
        if (onToggleVideoRecording) {
          onToggleVideoRecording();
        } else {
          // toast suppressed
        }
        return;
      }

      // Handle Insta360 shortcuts (Stream Deck buttons)
      if (matchShortcut(mapping.insta360.toggleRecording)) {
        e.preventDefault();
        if (onInsta360ToggleRecording) {
          onInsta360ToggleRecording();
        } else if ((window as any).electronAPI?.insta360) {
          // Direct call if no handler provided
          const api = (window as any).electronAPI.insta360;
          api.getStatus().then((s: any) => {
            if (s.state?.state?._captureStatus === 'recording') {
              api.stopRecording();
              // toast suppressed
            } else {
              api.startRecording();
              // toast suppressed
            }
          });
        }
        return;
      }

      if (matchShortcut(mapping.insta360.takePhoto)) {
        e.preventDefault();
        if (onInsta360TakePhoto) {
          onInsta360TakePhoto();
        } else if ((window as any).electronAPI?.insta360) {
          (window as any).electronAPI.insta360.takePhoto();
          // toast suppressed
        }
        return;
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup function
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    enabled,
    mapping,
    onAcceptDetection,
    onRejectDetection,
    onCorrectDetection,
    onTestDetection,
    onToggleVideoRecording,
  ]);

  // Return the current mapping for reference
  return {
    shortcuts: {
      acceptDetection: mapping.aiDetection.acceptDetection,
      rejectDetection: mapping.aiDetection.rejectDetection,
      correctDetection: mapping.aiDetection.correctDetection,
      testDetection: mapping.aiDetection.testDetection,
      toggleVideoRecording: mapping.videoRecording.toggleRecording,
    },
  };
};
