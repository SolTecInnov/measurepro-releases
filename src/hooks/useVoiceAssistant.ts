import { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceAssistant } from '../lib/voice/VoiceAssistant';
import type { SupportedLanguage } from '../lib/voice/types';
import { toast } from 'sonner';

interface VoiceAssistantHookState {
  isActive: boolean;
  isListening: boolean;
  isProcessing: boolean;
  isInitialized: boolean;
  currentLanguage: SupportedLanguage;
  transcript: string;
  lastResponse: string;
  error: Error | null;
  isSupported: boolean;
}

interface VoiceAssistantActions {
  startListening: (language?: SupportedLanguage) => void;
  stopListening: () => void;
  setLanguage: (language: SupportedLanguage) => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  setPreferredVoice: (voiceName: string) => void;
  onManualLog: (callback: () => void) => void;
  onRecordNote: (callback: () => void) => void;
  onClearWarnings: (callback: () => void) => void;
  onClearCritical: (callback: () => void) => void;
  
  // General Actions
  onCaptureImage: (callback: () => void) => void;
  onClearAlert: (callback: () => void) => void;
  onClearCapturedImages: (callback: () => void) => void;
  onLogMeasurement: (callback: () => void) => void;
  
  // Logging Controls
  onStartLogging: (callback: () => void) => void;
  onStopLogging: (callback: () => void) => void;
  onPauseLogging: (callback: () => void) => void;
  onSetLoggingMode: (callback: (mode: string) => void) => void;
  onClearAllAlerts: (callback: () => void) => void;
  onStartGPSTrace: (callback: () => void) => void;
  
  // Video Recording
  onToggleVideoRecording: (callback: () => void) => void;
  
  // AI Detection
  onAcceptDetection: (callback: () => void) => void;
  onRejectDetection: (callback: () => void) => void;
  onCorrectDetection: (callback: () => void) => void;
  onTestDetection: (callback: () => void) => void;
  
  // Envelope Clearance
  onToggleEnvelope: (callback: () => void) => void;
  onCycleVehicleProfile: (callback: () => void) => void;
  
  // POI Types
  onSetPOIType: (callback: (type: string) => void) => void;
  
  // Registry instance for dependency tracking
  getRegistryInstance: () => object | null;
}

export function useVoiceAssistant(): [VoiceAssistantHookState, VoiceAssistantActions] {
  const assistantRef = useRef<VoiceAssistant | null>(null);
  const [state, setState] = useState<VoiceAssistantHookState>({
    isActive: false,
    isListening: false,
    isProcessing: false,
    isInitialized: false,
    currentLanguage: 'en-US',
    transcript: '',
    lastResponse: '',
    error: null,
    isSupported: true
  });

  // Initialize voice assistant
  useEffect(() => {
    try {
      assistantRef.current = new VoiceAssistant();
      
      // Check if supported
      if (!assistantRef.current.isSupported()) {
        setState(prev => ({ ...prev, isSupported: false, isInitialized: true }));
        toast.error('Voice commands not supported', {
          description: 'Your browser does not support the Web Speech API'
        });
        return;
      }

      // Set up event listeners
      assistantRef.current.addEventListener((event) => {
        switch (event.type) {
          case 'listening':
            setState(prev => ({
              ...prev,
              isListening: true,
              isProcessing: false,
              error: null,
              transcript: event.data?.transcript || prev.transcript
            }));
            break;

          case 'processing':
            setState(prev => ({
              ...prev,
              isListening: false,
              isProcessing: true,
              transcript: event.data?.transcript || prev.transcript
            }));
            break;

          case 'responding':
            setState(prev => ({
              ...prev,
              isProcessing: false,
              lastResponse: event.data?.response || '',
              transcript: ''
            }));
            break;

          case 'idle':
            setState(prev => ({
              ...prev,
              isActive: false,
              isListening: false,
              isProcessing: false,
              transcript: ''
            }));
            break;

          case 'error':
            setState(prev => ({
              ...prev,
              isListening: false,
              isProcessing: false,
              error: event.error || null
            }));
            
            if (event.error && !event.error.message.includes('no-speech')) {
              toast.error('Voice command error', {
                description: event.error.message
              });
            }
            break;
        }
      });

      // Mark as initialized
      setState(prev => ({ ...prev, isInitialized: true }));
    } catch (error) {
      setState(prev => ({ ...prev, isSupported: false, isInitialized: true, error: error as Error }));
    }

    return () => {
      assistantRef.current?.stop();
    };
  }, []);

  const startListening = useCallback((language?: SupportedLanguage) => {
    if (!assistantRef.current || !state.isSupported) {
      toast.error('Voice commands not available');
      return;
    }

    try {
      const lang = language || state.currentLanguage;
      
      // Check if welcome message has been played in this session
      const welcomePlayedKey = 'voice_assistant_welcome_played';
      const hasPlayedWelcome = sessionStorage.getItem(welcomePlayedKey);
      
      // Get current volume to check if voice responses are enabled
      const currentVolume = assistantRef.current.getVolume();
      
      // Play welcome message if:
      // 1. This is the first time starting voice in this session
      // 2. Voice responses are enabled (volume > 0)
      if (!hasPlayedWelcome && currentVolume > 0) {
        const welcomeMessages: Record<SupportedLanguage, string> = {
          'en-US': "Hello, I am Max Load, SolTec Innovation AI agent. I'm here to help you operate this app hands-free for your safety. In many jurisdictions, touching your screen while driving is prohibited. Drive safe.",
          'fr-FR': "Bonjour, je suis Max Load, agent IA de SolTec Innovation. Je suis ici pour vous aider à utiliser cette application mains libres pour votre sécurité. Dans de nombreuses juridictions, toucher votre écran en conduisant est interdit. Conduisez prudemment.",
          'es-ES': "Hola, soy Max Load, agente de IA de SolTec Innovation. Estoy aquí para ayudarte a operar esta aplicación sin manos por tu seguridad. En muchas jurisdicciones, tocar la pantalla mientras conduces está prohibido. Conduce con seguridad."
        };
        
        const welcomeMessage = welcomeMessages[lang];
        
        // Mark as played before speaking to avoid duplicate plays
        sessionStorage.setItem(welcomePlayedKey, 'true');
        
        // Speak the welcome message asynchronously
        assistantRef.current.speak(welcomeMessage, lang).catch(() => {});
      }
      
      assistantRef.current.start(lang);
      
      setState(prev => ({
        ...prev,
        isActive: true,
        currentLanguage: lang,
        error: null
      }));

    } catch (error) {
      toast.error('Failed to start voice commands', {
        description: 'Please ensure microphone permissions are granted'
      });
    }
  }, [state.isSupported, state.currentLanguage]);

  const stopListening = useCallback(() => {
    if (!assistantRef.current) return;

    assistantRef.current.stop();
    setState(prev => ({
      ...prev,
      isActive: false,
      isListening: false,
      isProcessing: false,
      transcript: ''
    }));

  }, []);

  const setLanguage = useCallback((language: SupportedLanguage) => {
    if (!assistantRef.current) return;

    assistantRef.current.setLanguage(language);
    setState(prev => ({ ...prev, currentLanguage: language }));

  }, []);

  const setVolume = useCallback((volume: number) => {
    if (!assistantRef.current) return;
    assistantRef.current.setVolume(volume);
  }, []);

  const getVolume = useCallback(() => {
    return assistantRef.current?.getVolume() || 0.8;
  }, []);

  const setPreferredVoice = useCallback((voiceName: string) => {
    if (!assistantRef.current) return;
    assistantRef.current.setPreferredVoice(voiceName);
  }, []);

  const onManualLog = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onManualLog(callback);
  }, []);

  const onRecordNote = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onRecordNote(callback);
  }, []);

  const onClearWarnings = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onClearWarnings(callback);
  }, []);

  const onClearCritical = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onClearCritical(callback);
  }, []);

  // General Actions
  const onCaptureImage = useCallback((callback: () => void) => {
    if (!assistantRef.current) {
      return;
    }
    assistantRef.current.getCommandRegistry().onCaptureImage(callback);
  }, []);

  const onClearAlert = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onClearAlert(callback);
  }, []);

  const onClearCapturedImages = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onClearCapturedImages(callback);
  }, []);

  const onLogMeasurement = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onLogMeasurement(callback);
  }, []);

  // Logging Controls
  const onStartLogging = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onStartLogging(callback);
  }, []);

  const onStopLogging = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onStopLogging(callback);
  }, []);

  const onPauseLogging = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onPauseLogging(callback);
  }, []);

  const onSetLoggingMode = useCallback((callback: (mode: string) => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onSetLoggingMode(callback);
  }, []);

  const onClearAllAlerts = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onClearAllAlerts(callback);
  }, []);

  const onStartGPSTrace = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onStartGPSTrace(callback);
  }, []);

  // Video Recording
  const onToggleVideoRecording = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onToggleVideoRecording(callback);
  }, []);

  // AI Detection
  const onAcceptDetection = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onAcceptDetection(callback);
  }, []);

  const onRejectDetection = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onRejectDetection(callback);
  }, []);

  const onCorrectDetection = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onCorrectDetection(callback);
  }, []);

  const onTestDetection = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onTestDetection(callback);
  }, []);

  // Envelope Clearance
  const onToggleEnvelope = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onToggleEnvelope(callback);
  }, []);

  const onCycleVehicleProfile = useCallback((callback: () => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onCycleVehicleProfile(callback);
  }, []);

  // POI Types
  const onSetPOIType = useCallback((callback: (type: string) => void) => {
    if (!assistantRef.current) return;
    assistantRef.current.getCommandRegistry().onSetPOIType(callback);
  }, []);

  // Get registry instance for dependency tracking
  const getRegistryInstance = useCallback(() => {
    return assistantRef.current?.getCommandRegistry() || null;
  }, []);

  return [
    state,
    {
      startListening,
      stopListening,
      setLanguage,
      setVolume,
      getVolume,
      setPreferredVoice,
      onManualLog,
      onRecordNote,
      onClearWarnings,
      onClearCritical,
      onCaptureImage,
      onClearAlert,
      onClearCapturedImages,
      onLogMeasurement,
      onStartLogging,
      onStopLogging,
      onPauseLogging,
      onSetLoggingMode,
      onClearAllAlerts,
      onStartGPSTrace,
      onToggleVideoRecording,
      onAcceptDetection,
      onRejectDetection,
      onCorrectDetection,
      onTestDetection,
      onToggleEnvelope,
      onCycleVehicleProfile,
      onSetPOIType,
      getRegistryInstance
    }
  ];
}
