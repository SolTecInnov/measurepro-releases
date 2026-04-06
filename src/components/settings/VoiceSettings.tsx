import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, Globe, CheckCircle, XCircle, ChevronDown, ChevronUp, HelpCircle, Play, AlertTriangle } from 'lucide-react';
import { useVoiceAssistant } from '../../hooks/useVoiceAssistant';
import type { SupportedLanguage } from '../../lib/voice/types';
import { toast } from 'sonner';

const VoiceSettings: React.FC = () => {
  const [voiceState, voiceActions] = useVoiceAssistant();
  const [volume, setVolume] = useState(0.8);
  const [showCommands, setShowCommands] = useState(false);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.6);
  const [voiceTalksEnabled, setVoiceTalksEnabled] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  const detectGender = (voiceName: string): string => {
    const nameLower = voiceName.toLowerCase();
    if (nameLower.includes('female') || nameLower.includes('woman') || 
        nameLower.includes('samantha') || nameLower.includes('victoria') || 
        nameLower.includes('karen') || nameLower.includes('zira') ||
        nameLower.includes('alice') || nameLower.includes('fiona')) {
      return 'Female';
    }
    if (nameLower.includes('male') || nameLower.includes('man') || 
        nameLower.includes('david') || nameLower.includes('daniel') || 
        nameLower.includes('mark') || nameLower.includes('alex') ||
        nameLower.includes('tom')) {
      return 'Male';
    }
    return '';
  };

  const loadVoices = () => {
    if (!('speechSynthesis' in window)) {
      setVoicesLoaded(true);
      return;
    }

    const allVoices = window.speechSynthesis.getVoices();
    
    if (allVoices.length === 0) {
      return;
    }

    const langCode = voiceState.currentLanguage.split('-')[0];
    const filteredVoices = allVoices.filter(voice => 
      voice.lang === voiceState.currentLanguage || voice.lang.startsWith(langCode)
    );

    setAvailableVoices(filteredVoices);
    setVoicesLoaded(true);

    const preferredVoice = localStorage.getItem('preferred_voice_name');
    if (preferredVoice && filteredVoices.some(v => v.name === preferredVoice)) {
      setSelectedVoice(preferredVoice);
    } else if (filteredVoices.length > 0) {
      setSelectedVoice(filteredVoices[0].name);
    }
  };

  useEffect(() => {
    setVolume(voiceActions.getVolume());
    
    const saved = localStorage.getItem('voice_talks_enabled');
    if (saved !== null) {
      setVoiceTalksEnabled(JSON.parse(saved));
    }

    const savedThreshold = localStorage.getItem('voice_confidence_threshold');
    if (savedThreshold) {
      setConfidenceThreshold(parseFloat(savedThreshold));
    }

    loadVoices();

    if (window.speechSynthesis && speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (window.speechSynthesis && speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadVoices();
  }, [voiceState.currentLanguage]);

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    voiceActions.setVolume(newVolume);
  };

  const handleLanguageChange = (language: SupportedLanguage) => {
    voiceActions.setLanguage(language);
    toast.success(`Language changed to ${getLanguageName(language)}`);
  };

  const handleVoiceTalksToggle = () => {
    const newValue = !voiceTalksEnabled;
    setVoiceTalksEnabled(newValue);
    localStorage.setItem('voice_talks_enabled', JSON.stringify(newValue));
    
    if (newValue) {
      voiceActions.setVolume(volume);
    } else {
      voiceActions.setVolume(0);
    }
    
    toast.success(newValue ? 'Voice responses enabled' : 'Voice responses disabled');
  };

  const handleConfidenceChange = (threshold: number) => {
    setConfidenceThreshold(threshold);
    localStorage.setItem('voice_confidence_threshold', threshold.toString());
  };

  const handleVoiceChange = (voiceName: string) => {
    setSelectedVoice(voiceName);
    localStorage.setItem('preferred_voice_name', voiceName);
    voiceActions.setPreferredVoice(voiceName);
    const gender = detectGender(voiceName);
    toast.success(`Voice changed to ${voiceName}${gender ? ` (${gender})` : ''}`);
  };

  const handleTestVoice = async () => {
    const testMessages: Record<SupportedLanguage, string> = {
      'en-US': 'This is a test message. Voice assistant is working correctly.',
      'fr-FR': 'Ceci est un message de test. L\'assistant vocal fonctionne correctement.',
      'es-ES': 'Este es un mensaje de prueba. El asistente de voz funciona correctamente.'
    };

    // Temporarily enable voice if disabled
    const wasDisabled = !voiceTalksEnabled;
    if (wasDisabled) {
      voiceActions.setVolume(volume);
    }

    // Import SpeechSynthesizer to speak test message
    const { SpeechSynthesizer } = await import('../../lib/voice/SpeechSynthesizer');
    const synthesizer = new SpeechSynthesizer();
    synthesizer.setVolume(volume);
    synthesizer.setLanguage(voiceState.currentLanguage);
    await synthesizer.speak(testMessages[voiceState.currentLanguage], voiceState.currentLanguage);

    // Restore volume if it was disabled
    if (wasDisabled) {
      voiceActions.setVolume(0);
    }

    toast.success('Test message played');
  };

  const getLanguageName = (lang: SupportedLanguage): string => {
    const names: Record<SupportedLanguage, string> = {
      'en-US': 'English (US)',
      'fr-FR': 'Français (France)',
      'es-ES': 'Español (España)'
    };
    return names[lang];
  };

  const getStatusColor = (): string => {
    if (!voiceState.isSupported) return 'text-red-500';
    if (voiceState.error) return 'text-red-500';
    if (voiceState.isProcessing) return 'text-blue-500';
    if (voiceState.isListening) return 'text-green-500';
    if (voiceState.isActive) return 'text-green-500';
    return 'text-gray-500';
  };

  const getStatusText = (): string => {
    if (!voiceState.isSupported) return 'Not Supported';
    if (voiceState.error) return 'Error';
    if (voiceState.isProcessing) return 'Processing';
    if (voiceState.isListening) return 'Listening';
    if (voiceState.isActive) return 'Active';
    return 'Inactive';
  };

  const commandsByCategory = {
    'Query Commands': [
      { intent: 'identity', example: 'who are you / what\'s your name', shortcut: '-' },
      { intent: 'current_time', example: 'what time is it / current time', shortcut: '-' },
      { intent: 'last_measurement', example: 'last measurement / what was the last reading', shortcut: '-' },
      { intent: 'gps_location', example: 'GPS location / where am I', shortcut: '-' },
      { intent: 'laser_status', example: 'laser status / is laser connected', shortcut: '-' },
      { intent: 'gps_status', example: 'GPS status / is GPS connected', shortcut: '-' },
      { intent: 'fix_quality', example: 'fix quality / signal quality', shortcut: '-' },
      { intent: 'speed', example: 'speed / how fast', shortcut: '-' }
    ],
    'General Actions': [
      { intent: 'capture_image', example: 'capture / take photo', shortcut: 'Alt+1' },
      { intent: 'clear_alert', example: 'clear alert / dismiss alert', shortcut: 'Alt+2' },
      { intent: 'clear_captured_images', example: 'clear images / delete all images', shortcut: '-' },
      { intent: 'log_measurement', example: 'log measurement / save POI', shortcut: 'Alt+G' }
    ],
    'Logging Controls': [
      { intent: 'start_logging', example: 'start logging / begin logging', shortcut: 'Alt+7' },
      { intent: 'stop_logging', example: 'stop logging / end logging', shortcut: 'Alt+8' },
      { intent: 'pause_logging', example: 'pause logging', shortcut: '-' },
      { intent: 'mode_manual', example: 'manual mode / mode manual', shortcut: '-' },
      { intent: 'mode_all_data', example: 'all data mode / mode all data', shortcut: '-' },
      { intent: 'mode_detection', example: 'detection mode / mode detection', shortcut: 'Alt+9' },
      { intent: 'mode_manual_detection', example: 'manual detection mode', shortcut: '-' },
      { intent: 'mode_counter_detection', example: 'counter detection mode', shortcut: 'Alt+0' },
      { intent: 'clear_all_alerts', example: 'clear all alerts', shortcut: '-' },
      { intent: 'start_gps_trace', example: 'start GPS trace / trace route', shortcut: '-' }
    ],
    'Video & Detection': [
      { intent: 'toggle_video_recording', example: 'start video / stop video', shortcut: 'Alt+V' },
      { intent: 'accept_detection', example: 'accept / confirm detection', shortcut: '-' },
      { intent: 'reject_detection', example: 'reject / decline detection', shortcut: '-' },
      { intent: 'correct_detection', example: 'correct detection', shortcut: '-' },
      { intent: 'test_detection', example: 'test detection', shortcut: '-' }
    ],
    'Envelope Clearance': [
      { intent: 'toggle_envelope', example: 'toggle envelope / envelope on/off', shortcut: '-' },
      { intent: 'cycle_vehicle_profile', example: 'next vehicle / cycle profile', shortcut: '-' }
    ],
    'POI Types (Alt + Letter)': [
      { intent: 'poi_bridge', example: 'POI type bridge', shortcut: 'Alt+B' },
      { intent: 'poi_trees', example: 'POI type trees', shortcut: 'Alt+T' },
      { intent: 'poi_wire', example: 'POI type wire', shortcut: 'Alt+W' },
      { intent: 'poi_power_line', example: 'POI type power line', shortcut: 'Alt+P' },
      { intent: 'poi_traffic_light', example: 'POI type traffic light', shortcut: 'Alt+L' },
      { intent: 'poi_walkways', example: 'POI type walkways', shortcut: 'Alt+K' },
      { intent: 'poi_lateral_obstruction', example: 'POI type lateral obstruction', shortcut: 'Alt+O' },
      { intent: 'poi_road', example: 'POI type road', shortcut: 'Alt+R' },
      { intent: 'poi_intersection', example: 'POI type intersection', shortcut: 'Alt+I' },
      { intent: 'poi_signalization', example: 'POI type signalization', shortcut: 'Alt+S' },
      { intent: 'poi_railroad', example: 'POI type railroad', shortcut: 'Alt+A' },
      { intent: 'poi_information', example: 'POI type information', shortcut: 'Alt+N' },
      { intent: 'poi_danger', example: 'POI type danger', shortcut: 'Alt+D' },
      { intent: 'poi_important_note', example: 'POI type important note', shortcut: 'Alt+M' },
      { intent: 'poi_work_required', example: 'POI type work required', shortcut: 'Alt+Q' },
      { intent: 'poi_restricted', example: 'POI type restricted', shortcut: 'Alt+X' }
    ],
    'Audio & Voice Controls': [
      { intent: 'clear_warnings', example: 'clear warnings / dismiss warnings', shortcut: '-' },
      { intent: 'clear_critical', example: 'clear critical / dismiss critical alerts', shortcut: '-' },
      { intent: 'volume_up', example: 'volume up / louder', shortcut: '-' },
      { intent: 'volume_down', example: 'volume down / quieter', shortcut: '-' },
      { intent: 'manual_log', example: 'manual log / log entry', shortcut: '-' },
      { intent: 'record_note', example: 'record note / voice note', shortcut: '-' }
    ]
  };

  const totalCommands = Object.values(commandsByCategory).reduce((sum, cmds) => sum + cmds.length, 0);

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <Mic className="w-6 h-6 text-blue-400" />
        Voice Commands Settings
      </h2>

      <div className="space-y-6">
        {/* Offline Limitation Warning */}
        <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 mb-6" data-testid="warning-offline-limitation">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-300 mb-1">Internet Connection Required for Voice Commands</h4>
              <p className="text-sm text-amber-100/90">
                Voice commands require an active internet connection due to browser Web Speech API limitations. However, <strong>voice notes work completely offline</strong> and are stored locally in IndexedDB.
              </p>
            </div>
          </div>
        </div>

        {/* Voice Assistant Status */}
        <div className="bg-gray-750 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-blue-400" />
            Voice Assistant Status
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Browser Support</span>
              <div className="flex items-center gap-2" data-testid="text-voice-support">
                {voiceState.isSupported ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-green-500">Supported</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-red-500">Not Supported</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Current Status</span>
              <span className={`text-sm font-medium ${getStatusColor()}`} data-testid="text-voice-status">
                {getStatusText()}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Voice Assistant</span>
              <button
                onClick={() => {
                  if (voiceState.isActive) {
                    voiceActions.stopListening();
                  } else {
                    voiceActions.startListening();
                  }
                }}
                disabled={!voiceState.isSupported}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  voiceState.isActive
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                } disabled:bg-gray-600 disabled:cursor-not-allowed`}
                data-testid="button-toggle-voice"
              >
                {voiceState.isActive ? (
                  <>
                    <MicOff className="w-4 h-4 inline mr-2" />
                    Disable
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 inline mr-2" />
                    Enable
                  </>
                )}
              </button>
            </div>

            {voiceState.error && (
              <div className="mt-2 p-3 bg-red-900/30 border border-red-700 rounded text-sm text-red-300" data-testid="text-voice-error">
                Error: {voiceState.error.message}
              </div>
            )}
          </div>
        </div>

        {/* Language Settings */}
        <div className="bg-gray-750 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" />
            Language Settings
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Current Language: {getLanguageName(voiceState.currentLanguage)}
              </label>
              <div className="space-y-2">
                {(['en-US', 'fr-FR', 'es-ES'] as SupportedLanguage[]).map((lang) => (
                  <label
                    key={lang}
                    className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors"
                  >
                    <input
                      type="radio"
                      name="language"
                      value={lang}
                      checked={voiceState.currentLanguage === lang}
                      onChange={() => handleLanguageChange(lang)}
                      className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      data-testid={`radio-language-${lang}`}
                    />
                    <span className="flex-1">{getLanguageName(lang)}</span>
                    {voiceState.currentLanguage === lang && (
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Voice Response Settings */}
        <div className="bg-gray-750 rounded-lg p-4 border-2 border-blue-500/30">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-blue-400" />
            Voice Response Settings
          </h3>

          <div className="space-y-4">
            {/* Voice Responses Toggle - Prominent */}
            <div className="bg-blue-900/20 border border-blue-500/40 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                  <label className="text-base font-semibold text-gray-200 flex items-center gap-2">
                    Voice Responses
                    {!voiceTalksEnabled && (
                      <span className="text-xs bg-amber-600 text-white px-2 py-0.5 rounded-full">
                        Listen Only Mode
                      </span>
                    )}
                  </label>
                  <p className="text-sm text-gray-300 mt-1">
                    {voiceTalksEnabled 
                      ? 'App speaks confirmation messages (may cause feedback loop if microphone picks up speakers)'
                      : 'App stays silent - only listens to your commands (recommended to prevent feedback loop)'
                    }
                  </p>
                </div>
                <button
                  onClick={handleVoiceTalksToggle}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${
                    voiceTalksEnabled ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                  data-testid="toggle-voice-talks"
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      voiceTalksEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                💡 Tip: If you hear the same command repeating, turn OFF voice responses to use listen-only mode
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Volume: {Math.round(volume * 100)}%
              </label>
              <div className="flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-gray-400" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume * 100}
                  onChange={(e) => handleVolumeChange(parseInt(e.target.value) / 100)}
                  className="flex-1"
                  disabled={!voiceTalksEnabled}
                  data-testid="slider-voice-volume"
                />
                <span className="text-sm text-gray-400 w-12 text-right">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Voice Selection
              </label>
              {!voicesLoaded ? (
                <div className="p-3 bg-gray-700 rounded-lg text-sm text-gray-400">
                  Loading voices...
                </div>
              ) : availableVoices.length === 0 ? (
                <div className="p-3 bg-gray-700 rounded-lg text-sm text-gray-400">
                  No voices available for this language
                </div>
              ) : (
                <select
                  value={selectedVoice}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  className="w-full p-3 bg-gray-700 rounded-lg text-sm text-gray-200 border border-gray-600 focus:border-blue-500 focus:outline-none"
                  data-testid="select-voice"
                >
                  {availableVoices.map((voice) => {
                    const gender = detectGender(voice.name);
                    const displayName = gender ? `${voice.name} (${gender})` : voice.name;
                    return (
                      <option key={voice.name} value={voice.name}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
              )}
              <p className="text-xs text-gray-400 mt-2">
                Select a voice for speech synthesis responses
              </p>
            </div>

            <div>
              <button
                onClick={handleTestVoice}
                disabled={!voiceState.isSupported}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                data-testid="button-test-voice"
              >
                <Play className="w-4 h-4" />
                Click to hear a test message
              </button>
            </div>
          </div>
        </div>

        {/* Voice Detection Settings */}
        <div className="bg-gray-750 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Mic className="w-5 h-5 text-blue-400" />
            Voice Detection Settings
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Fuzzy Matching Tolerance: {Math.round(confidenceThreshold * 100)}%
              </label>
              <p className="text-xs text-gray-400 mb-3">
                Lower values = more strict command matching. Higher values = more lenient.
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">Strict</span>
                <input
                  type="range"
                  min="40"
                  max="90"
                  value={confidenceThreshold * 100}
                  onChange={(e) => handleConfidenceChange(parseInt(e.target.value) / 100)}
                  className="flex-1"
                  data-testid="slider-confidence-threshold"
                />
                <span className="text-xs text-gray-400">Lenient</span>
              </div>
              <div className="text-xs text-gray-400 mt-1 text-right">
                {Math.round(confidenceThreshold * 100)}%
              </div>
            </div>

            <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded">
              <div className="flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-blue-400 mt-0.5" />
                <div className="text-xs text-gray-300">
                  <p className="font-medium mb-1">Note:</p>
                  <p>The voice assistant uses continuous listening mode. Click the microphone button in the header to enable/disable listening.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Available Commands List */}
        <div className="bg-gray-750 rounded-lg p-4">
          <button
            onClick={() => setShowCommands(!showCommands)}
            className="w-full flex items-center justify-between text-lg font-medium hover:text-blue-400 transition-colors"
            data-testid="button-toggle-commands"
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-400" />
              Available Voice Commands ({totalCommands})
            </span>
            {showCommands ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>

          {showCommands && (
            <div className="mt-4 space-y-6" data-testid="list-voice-commands">
              <div className="bg-blue-900/20 border border-blue-700/50 rounded p-3">
                <p className="text-sm text-gray-300">
                  💡 <strong>Tip:</strong> These commands work in {getLanguageName(voiceState.currentLanguage)}. Switch languages to use translated commands.
                  Commands with keyboard shortcuts trigger the same action as pressing the key combination.
                </p>
              </div>

              {Object.entries(commandsByCategory).map(([category, commands]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-base font-semibold text-blue-300 flex items-center gap-2">
                    {category}
                    <span className="text-xs font-normal text-gray-400">({commands.length} commands)</span>
                  </h4>
                  <div className="space-y-2">
                    {commands.map((cmd) => (
                      <div
                        key={cmd.intent}
                        className="p-3 bg-gray-700 rounded-lg hover:bg-gray-650 transition-colors"
                        data-testid={`command-${cmd.intent}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-blue-400">
                                {cmd.intent.replace(/_/g, ' ').replace(/poi /g, 'POI: ').toUpperCase()}
                              </span>
                              {cmd.shortcut !== '-' && (
                                <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded font-mono">
                                  {cmd.shortcut}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">
                              Say: <span className="text-gray-300 italic">"{cmd.example}"</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Voice Notes Settings */}
        <div className="bg-gray-750 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Mic className="w-5 h-5 text-blue-400" />
            Voice Notes Settings
          </h3>

          <div className="space-y-3">
            <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded">
              <div className="flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-blue-400 mt-0.5" />
                <div className="text-xs text-gray-300">
                  <p className="font-medium mb-1">Voice Notes Feature:</p>
                  <p>Use the "record note" voice command or the voice note recorder in measurement controls to attach audio notes to your measurements.</p>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-400">
              <p>Voice notes are automatically saved with measurements and can be played back later for reference.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceSettings;
