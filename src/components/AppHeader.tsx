import React from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Smartphone, Activity, LogOut, Zap, Brain, Mic, MicOff, Globe, Volume2, Box, Navigation, Wrench, ChevronDown, Cloud, Scan, Bot, X, LifeBuoy, QrCode, ScanEye, Lock, CloudRain } from 'lucide-react';
import { useDriveModeStore } from '../lib/stores/driveModeStore';
import { useRainModeStore } from '../lib/stores/rainModeStore';
import { useSurveyStore } from '../lib/survey';
import { getCurrentUser, signOutUser } from '../lib/firebase';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { useEnabledFeatures } from '../hooks/useLicenseEnforcement';
import type { SupportedLanguage } from '../lib/voice/types';
import QuickConnect from './QuickConnect';
import OfflineStatusIndicator from './OfflineStatusIndicator';
import { toast } from 'sonner';
import { RoadScopeSyncDialog } from './roadscope/RoadScopeSyncDialog';
import { isBetaUser, isBetaTestAccount } from '../lib/auth/masterAdmin';
import { BetaTrialBadge } from './BetaTrialBadge';
import AIAssistantChat from './ai/AIAssistantChat';
import SupportTicketDialog from './SupportTicketDialog';
import { SlaveAppPairingDisplay } from './slave/SlaveAppPairingDisplay';
import { useSlavePairingStore } from '../lib/stores/slavePairingStore';
import { getMeasurementLogger } from '../lib/workers/MeasurementLoggerClient';
import { getMeasurementFeed } from '../lib/survey/MeasurementFeed';
import { useGPSStore } from '../lib/stores/gpsStore';

interface AppHeaderProps {
  wifiStatus: 'good' | 'poor' | 'none';
  setShowWifiStatus: (show: boolean) => void;
  setShowDatabaseStatus: (show: boolean) => void;
  offlineItems: number;
  showThreeColumns: boolean;
  setShowThreeColumns: (show: boolean) => void;
  isMobile: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  setShowDatabaseStatus,
  offlineItems,
  showThreeColumns: _showThreeColumns,
  setShowThreeColumns: _setShowThreeColumns,
  isMobile
}) => {
  const navigate = useNavigate();
  const { activeSurvey } = useSurveyStore();
  const { features, hasFeature } = useEnabledFeatures();
  const [currentUser, setCurrentUser] = React.useState(getCurrentUser());
  
  // Check if beta user (hide live monitor for beta/not-logged-in users)
  // Use currentUser state which updates on auth changes, not auth.currentUser which may be stale
  const isBeta = isBetaUser(currentUser, features) || isBetaTestAccount(currentUser?.email);
  const [slaveAppMeasurements, setSlaveAppMeasurements] = React.useState<any[]>([]);

  // Drive Mode (kiosk + always-on-top + close protection)
  const driveMode = useDriveModeStore((s) => s.enabled);
  const setDriveMode = useDriveModeStore((s) => s.setEnabled);

  // Rain Mode (logs POIs without laser measurements)
  const rainMode = useRainModeStore((s) => s.isActive);
  const toggleRainMode = useRainModeStore((s) => s.toggle);

  // Voice Assistant
  const [voiceState, voiceActions] = useVoiceAssistant();
  const [showVoiceMenu, setShowVoiceMenu] = React.useState(false);
  const [showToolsMenu, setShowToolsMenu] = React.useState(false);
  const [volume, setVolume] = React.useState(1.0);
  const [showRoadScopeSync, setShowRoadScopeSync] = React.useState(false);
  const [showAIAssistant, setShowAIAssistant] = React.useState(false);
  const [showSupportTicket, setShowSupportTicket] = React.useState(false);
  const [showPhoneQR, setShowPhoneQR] = React.useState(false);
  const { connect: pairingConnect, sendSurveyUpdate, isSlaveConnected } = useSlavePairingStore();
  
  // Check for auth state changes
  // Handle Electron Help menu → Submit Support Ticket
  React.useEffect(() => {
    if (!window.electronAPI?.onMenuOpenSupportTicket) return;
    window.electronAPI.onMenuOpenSupportTicket(() => {
      setShowSupportTicket(true);
    });
  }, []);

  React.useEffect(() => {
    const handleAuthStateChanged = () => {
      setCurrentUser(getCurrentUser());
    };
    
    window.addEventListener('auth-state-changed', handleAuthStateChanged);
    
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChanged);
    };
  }, []);
  
  // Check for slave app measurements
  React.useEffect(() => {
    const checkSlaveAppMeasurements = () => {
      const measurementsJson = localStorage.getItem('slaveApp_measurements');
      if (measurementsJson) {
        try {
          const measurements = JSON.parse(measurementsJson);
          setSlaveAppMeasurements(measurements);
        } catch (error) {
          setSlaveAppMeasurements([]);
        }
      } else {
        setSlaveAppMeasurements([]);
      }
    };
    
    // Check on mount
    checkSlaveAppMeasurements();
    
    // Listen for sync events from slave app
    const handleSlaveAppSync = () => {
      checkSlaveAppMeasurements();
    };
    
    window.addEventListener('slaveApp_sync_complete', handleSlaveAppSync);
    
    // Check periodically
    const intervalId = setInterval(checkSlaveAppMeasurements, 10000);
    
    return () => {
      window.removeEventListener('slaveApp_sync_complete', handleSlaveAppSync);
      clearInterval(intervalId);
    };
  }, []);

  // ── Persistent pairing connection ────────────────────────────────────────────

  // Start WS on mount — no feature gate because features load async and the
  // guard inside the store prevents duplicate connections.
  React.useEffect(() => {
    pairingConnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push survey to slave whenever activeSurvey changes
  React.useEffect(() => {
    if (activeSurvey) {
      sendSurveyUpdate(activeSurvey);
    }
  }, [activeSurvey, sendSurveyUpdate]);

  // Handle measurements arriving from the slave device
  React.useEffect(() => {
    const handler = async (e: Event) => {
      const measurement = (e as CustomEvent).detail;
      if (!measurement) return;
      try {
        const { activeSurvey: survey } = useSurveyStore.getState();
        const surveyId = measurement.survey_id || survey?.id;
        if (!surveyId) {
          toast.error('No survey selected — cannot save field app measurement');
          return;
        }
        const gpsState = useGPSStore.getState();
        const gps = gpsState.connected ? gpsState.data : null;
        const logger = getMeasurementLogger();
        const measurementObject = {
          id: measurement.id,
          user_id: surveyId,
          rel: measurement.rel,
          widthMeasure: measurement.widthMeasure,
          lengthMeasure: measurement.lengthMeasure,
          altGPS: gps?.altitude ?? measurement.altGPS,
          latitude: gps?.latitude ?? measurement.latitude,
          longitude: gps?.longitude ?? measurement.longitude,
          utcDate: measurement.utcDate,
          utcTime: measurement.utcTime,
          speed: gps?.speed ?? measurement.speed,
          heading: gps?.heading ?? gps?.course ?? measurement.heading,
          roadNumber: measurement.roadNumber,
          poiNumber: measurement.poiNumber,
          poi_type: measurement.poi_type,
          note: measurement.note,
          imageUrl: measurement.imageUrl || null,
          drawingUrl: measurement.drawingUrl || null,
          createdAt: measurement.createdAt,
          source: 'slaveApp',
        };
        await logger.logMeasurement(measurementObject);
        getMeasurementFeed().addMeasurement(measurementObject);
        window.dispatchEvent(new Event('dbchange'));
        // toast suppressed
      } catch (err) {
        console.error('[AppHeader] Failed to save slave measurement:', err);
        toast.error('Failed to save field app capture');
      }
    };
    window.addEventListener('slavePairing:measurement', handler);
    return () => window.removeEventListener('slavePairing:measurement', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────

  // Listen for city mode changes from keyboard shortcut
  const handleLogOut = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error('[AppHeader] Sign out failed:', err);
    }
    // Clear the legacy lock-screen flag too so the route guard treats us as logged out
    localStorage.removeItem('app_access');
    navigate('/login', { replace: true });
  };
  
  // Voice Assistant helpers
  const getMicButtonClass = (): string => {
    if (!voiceState.isSupported) return 'bg-gray-600 cursor-not-allowed';
    if (voiceState.error) return 'bg-red-600 hover:bg-red-700';
    if (voiceState.isProcessing) return 'bg-blue-600';
    if (voiceState.isListening) return 'bg-green-600 animate-pulse';
    if (voiceState.isActive) return 'bg-green-600 hover:bg-green-700';
    return 'bg-gray-700 hover:bg-gray-600';
  };
  
  const getLanguageLabel = (lang: SupportedLanguage): string => {
    switch (lang) {
      case 'en-US': return 'EN';
      case 'fr-FR': return 'FR';
      case 'es-ES': return 'ES';
      default: return 'EN';
    }
  };
  
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    voiceActions.setVolume(newVolume);
  };
  
  // Set up voice command callbacks and volume
  React.useEffect(() => {
    setVolume(voiceActions.getVolume());
  }, [voiceActions]);

  // Close menus when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-testid="button-tools-menu"]') && 
          !target.closest('[data-testid="menu-tools"]') &&
          !target.closest('[data-testid="menu-voice-settings"]')) {
        setShowToolsMenu(false);
        setShowVoiceMenu(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className={`flex flex-col lg:flex-row items-start lg:items-center gap-2 mb-3 ${driveMode ? 'border-l-4 border-amber-500 pl-3' : ''}`}>
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {features.includes('*') ? (
            <>
              <Brain className="w-6 h-6 text-purple-400" />
              MeasurePRO<span className="text-purple-400 -ml-1">+</span>
            </>
          ) : (
            <>
              <Zap className="w-6 h-6 text-blue-500" />
              MeasurePRO
            </>
          )}
          {isBeta && (
            <span className="ml-1 px-2 py-0.5 text-xs font-semibold bg-amber-500 text-black rounded-full uppercase tracking-wide">
              Beta
            </span>
          )}
        </h1>
      </div>
      
      <div className="flex-1 flex justify-center">
        <QuickConnect />
      </div>
      
      <div className="flex items-center gap-2 lg:gap-4 flex-wrap">
        {/* Tools Dropdown Menu */}
        <div className="relative">
          <button
            onClick={() => setShowToolsMenu(!showToolsMenu)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
            data-testid="button-tools-menu"
          >
            <Wrench className="w-4 h-4" />
            <span>Tools</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showToolsMenu ? 'rotate-180' : ''}`} />
          </button>

          {showToolsMenu && (
            <div className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 bg-gray-900 border border-gray-700 rounded-lg shadow-lg min-w-[240px] max-w-[calc(100vw-1rem)] z-50 py-1" data-testid="menu-tools">
              {/* ── Analysis tools ─────────────────────────── */}
              <button
                onClick={() => {
                  setShowAIAssistant(true);
                  setShowToolsMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                data-testid="button-ai-assistant"
              >
                <Bot className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>AI Assistant</span>
              </button>

              {(window as any).electronAPI?.drone && (
                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-drone-import'));
                    setShowToolsMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                  data-testid="button-drone-import"
                >
                  <ScanEye className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span>Drone Import</span>
                </button>
              )}

              {/* ── Voice ──────────────────────────────────── */}
              {!isBeta && voiceState.isSupported && (
                <>
                  <div className="border-t border-gray-700 my-1" />
                  <button
                    onClick={() => {
                      if (voiceState.isActive) {
                        voiceActions.stopListening();
                      } else {
                        voiceActions.startListening();
                      }
                      setShowToolsMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      voiceState.isActive
                        ? 'bg-green-600/20 text-green-400'
                        : 'text-gray-200 hover:bg-gray-800'
                    }`}
                    data-testid="button-voice-assistant"
                  >
                    {voiceState.isActive
                      ? <Mic className="w-4 h-4 text-green-400 flex-shrink-0" />
                      : <MicOff className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <span>{voiceState.isActive ? 'Stop Voice' : 'Voice Commands'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowVoiceMenu(!showVoiceMenu);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                    data-testid="button-voice-settings"
                  >
                    <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span>Voice ({getLanguageLabel(voiceState.currentLanguage)})</span>
                  </button>
                </>
              )}

              {/* ── Sharing & sync ─────────────────────────── */}
              {/* Hidden in Drive Mode to keep the menu focused on the road */}
              {!driveMode && (
                <>
                  <div className="border-t border-gray-700 my-1" />

                  {hasFeature('slave_app') && (
                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        useSlavePairingStore.getState().refreshCode();
                        setShowPhoneQR(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                      data-testid="button-open-on-mobile"
                    >
                      <div className="relative flex-shrink-0">
                        <QrCode className="w-4 h-4 text-cyan-400" />
                        {isSlaveConnected && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full ring-1 ring-gray-900" />
                        )}
                      </div>
                      <span className="flex items-center gap-2">
                        Pair Field App
                        {isSlaveConnected && (
                          <span className="text-xs text-green-400 font-medium">● Live</span>
                        )}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (!activeSurvey) {
                        toast.error('Please create or select a survey first');
                        setShowToolsMenu(false);
                        return;
                      }
                      setShowRoadScopeSync(true);
                      setShowToolsMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                    data-testid="button-roadscope-sync"
                  >
                    <Cloud className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span>Sync to RoadScope</span>
                  </button>
                </>
              )}

              {/* ── Operating modes ─────────────────────────── */}
              <div className="border-t border-gray-700 my-1" />

              {/* Rain Mode — log POIs without laser measurements (Alt+R also works) */}
              <button
                onClick={() => {
                  toggleRainMode();
                  setShowToolsMenu(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  rainMode
                    ? 'bg-blue-600/20 text-blue-300 hover:bg-blue-600/30'
                    : 'text-gray-200 hover:bg-gray-800'
                }`}
                data-testid="button-rain-mode"
                title="Logs POIs with photo + GPS but skips the laser distance reading. Use when raining or foggy and the laser gives unreliable values."
              >
                <CloudRain className={`w-4 h-4 flex-shrink-0 ${rainMode ? 'text-blue-300' : 'text-blue-400'}`} />
                <span>{rainMode ? 'Exit Rain Mode' : 'Rain Mode'}</span>
              </button>

              {/* Drive Mode — kiosk + close protection */}
              <button
                onClick={() => {
                  setDriveMode(!driveMode);
                  setShowToolsMenu(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  driveMode
                    ? 'bg-amber-600/20 text-amber-300 hover:bg-amber-600/30'
                    : 'text-gray-200 hover:bg-gray-800'
                }`}
                data-testid="button-drive-mode"
                title="Locks the app fullscreen, prevents accidental close, and blocks other apps from showing in front."
              >
                <Lock className={`w-4 h-4 flex-shrink-0 ${driveMode ? 'text-amber-400' : 'text-amber-500/80'}`} />
                <span>{driveMode ? 'Exit Drive Mode' : 'Drive Mode'}</span>
              </button>

              {/* ── Account ────────────────────────────────── */}
              {/* Log Out hidden in Drive Mode so the operator can't accidentally sign out mid-survey */}
              {!driveMode && (
                <>
                  <div className="border-t border-gray-700 my-1" />
                  <button
                    onClick={() => {
                      setShowSupportTicket(true);
                      setShowToolsMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                    data-testid="button-support-ticket"
                  >
                    <LifeBuoy className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span>Support Ticket</span>
                  </button>

                  <button
                    onClick={() => {
                      handleLogOut();
                      setShowToolsMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                    data-testid="button-log-out"
                  >
                    <LogOut className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span>Log Out</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Voice Settings Submenu */}
          {showVoiceMenu && voiceState.isSupported && (
            <div className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-lg min-w-[220px] max-w-[calc(100vw-1rem)] z-50" data-testid="menu-voice-settings">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">Voice Settings</span>
                <button
                  onClick={() => setShowVoiceMenu(false)}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  Close
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">Language</label>
                  <div className="space-y-1">
                    {(['en-US', 'fr-FR', 'es-ES'] as SupportedLanguage[]).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => voiceActions.setLanguage(lang)}
                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                          voiceState.currentLanguage === lang
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-gray-800 text-gray-300'
                        }`}
                        data-testid={`button-language-${lang}`}
                      >
                        {getLanguageLabel(lang) === 'EN' ? 'English' : getLanguageLabel(lang) === 'FR' ? 'Francais' : 'Espanol'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-2 block">
                    Volume: {Math.round(volume * 100)}%
                  </label>
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-gray-400" />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume * 100}
                      onChange={(e) => handleVolumeChange(parseInt(e.target.value) / 100)}
                      className="flex-1"
                      data-testid="slider-voice-volume"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Voice Transcript/Response Overlays */}
          {voiceState.transcript && voiceState.isListening && (
            <div className="absolute top-full mt-2 left-0 p-2 bg-gray-900 border border-gray-700 rounded-lg shadow-lg min-w-[200px] z-50" data-testid="text-voice-transcript">
              <div className="text-xs text-gray-400 mb-1">Transcript:</div>
              <div className="text-sm text-white">{voiceState.transcript}</div>
            </div>
          )}
          {voiceState.lastResponse && !voiceState.isListening && !voiceState.isProcessing && (
            <div className="absolute top-full mt-2 left-0 p-2 bg-blue-900 border border-blue-700 rounded-lg shadow-lg min-w-[200px] z-50" data-testid="text-voice-response">
              <div className="text-xs text-blue-300 mb-1">Response:</div>
              <div className="text-sm text-white">{voiceState.lastResponse}</div>
            </div>
          )}
        </div>

        {/* Active Survey Status — green dot only, no text */}
        {activeSurvey && !isMobile && (
          <div className="hidden lg:flex items-center">
            <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" title={`Active: ${activeSurvey.surveyTitle || activeSurvey.name}`} />
          </div>
        )}

        {/* Slave App Status */}
        {slaveAppMeasurements.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-purple-500 animate-pulse" title="Slave App Data Available" />
            <button
              onClick={() => setShowDatabaseStatus(true)}
              className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
            >
              <Smartphone className="w-4 h-4" />
              <span className="text-sm">{slaveAppMeasurements.length}</span>
            </button>
          </div>
        )}

        {/* Beta Trial Badge */}
        {isBetaTestAccount(currentUser?.email) && (
          <BetaTrialBadge email={currentUser?.email} />
        )}

        {/* User Status — blue dot only, no email text */}
        {currentUser && !isMobile && (
          <div className="flex items-center">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-500" title={`Signed in: ${currentUser.email}`} />
          </div>
        )}

        {/* Customize Layout Button */}
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${offlineItems > 0 ? 'bg-yellow-500' : 'bg-green-500'}`} />
          <OfflineStatusIndicator />
        </div>
      </div>

      {/* RoadScope Sync Dialog */}
      {activeSurvey && showRoadScopeSync && (
        <RoadScopeSyncDialog
          isOpen={showRoadScopeSync}
          onClose={() => setShowRoadScopeSync(false)}
          survey={activeSurvey}
        />
      )}

      {/* Support Ticket Dialog */}
      {showSupportTicket && (
        <SupportTicketDialog onClose={() => setShowSupportTicket(false)} />
      )}

      {/* Open on Phone QR Modal */}
      {showPhoneQR && createPortal(
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70"
          onClick={() => setShowPhoneQR(false)}
          data-testid="modal-phone-qr"
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-2xl mx-4 max-w-sm w-full shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white">Open Field App on Mobile</h3>
              </div>
              <button
                onClick={() => setShowPhoneQR(false)}
                className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                data-testid="button-close-phone-qr"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 pb-6">
              <SlaveAppPairingDisplay />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* AI Assistant Slide-in Panel */}
      {showAIAssistant && (
        <div className="fixed inset-0 z-[200] flex justify-end" data-testid="panel-ai-assistant">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAIAssistant(false)}
          />
          <div className="relative w-full max-w-lg h-full bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-emerald-400" />
                <span className="font-semibold text-white">AI Assistant</span>
              </div>
              <button
                onClick={() => setShowAIAssistant(false)}
                className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                data-testid="button-close-ai-assistant"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AIAssistantChat />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppHeader;