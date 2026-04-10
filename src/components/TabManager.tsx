import React, { useMemo, useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Camera, Map as MapIcon, FileText, Bell, HelpCircle, Keyboard, Home, Cloud, Gauge, Image as ImageIcon, Monitor, Mail, Brain, Truck, Users, Shield, Navigation, Target, Route, Radar, Mic, Database, Satellite, Smartphone, Wrench, Info, Bot, ArrowLeftRight, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEnabledFeatures } from '@/hooks/useLicenseEnforcement';
import { isBetaUser, isMasterAdmin } from '../lib/auth/masterAdmin';
import { getSafeAuth } from '../lib/firebase';
import { useAuth } from '../lib/auth/AuthContext';
import CameraSettings from './CameraSettings';
import MapSettings from './settings/MapSettings';
import LoggingSettings from './settings/LoggingSettings';
import AlertSettings from './settings/AlertSettings';
import EmailSettings from './settings/EmailSettings';
import KeyboardSettings from './settings/KeyboardSettings';
import HelpSettings from './settings/HelpSettings';
import LaserGPSSettings from './settings/LaserGPSSettings';
import DisplaySettings from './settings/DisplaySettings';
import VoiceSettings from './settings/VoiceSettings';
import AISettings from './settings/AISettings';
import EnvelopeSettings from './settings/EnvelopeSettings';
import ConvoySettings from './settings/ConvoySettings';
import PermittedRouteSettings from './settings/PermittedRouteSettings';
import SweptPathSettings from './settings/SweptPathSettings';
import SurveyManager from './SurveyManager';
import SyncControls from './SyncControls';
import { Settings2, Sliders } from 'lucide-react';
import LogoSettings from './settings/LogoSettings';
import BackupSettings from './settings/BackupSettings';
import POIActionSettings from './settings/POIActionSettings';
import { LayoutCustomizer } from './LayoutCustomizer';
import { useLayoutCustomization } from '../hooks/useLayoutCustomization';
import { CameraCalibration } from './calibration/CameraCalibration';
import { DetectionSettings } from './settings/DetectionSettings';
import GnssSettings from './settings/GnssSettings';
import { SlaveAppPairingDisplay } from './slave/SlaveAppPairingDisplay';
import { DeveloperSettings } from './settings/DeveloperSettings';
import RoadScopeSettings from './settings/RoadScopeSettings';
import LiveSharingSettings from './settings/LiveSharingSettings';
import AboutSettings from './settings/AboutSettings';
import AIAssistantChat from './ai/AIAssistantChat';
import LateralRearLaserSettings from './settings/LateralRearLaserSettings';
import MultiCameraSettings from './settings/MultiCameraSettings';
import { CameraSettingsPanel } from './CameraSettingsPanel';

interface TabManagerProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showSurveyDialog: boolean;
  setShowSurveyDialog: (show: boolean) => void;
  setOfflineItems: (items: number | ((prev: number) => number)) => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
}

// Tab to feature key mapping for license enforcement
const tabFeatureMap: Record<string, string | null> = {
  'calibration': 'calibration',
  'ai': 'ai_detection',
  'envelope': 'envelope_clearance',
  'convoy': 'convoy_guardian',
  'route': 'route_enforcement',
  'swept-path': 'swept_path_analysis',
  'admin': 'admin',
  // These tabs don't require special features
  'laser-gps': null,
  'lateral-rear': null,
  'camera': null,
  'detection': null,
  'logo': null,
  'map': null,
  'logging': null,
  'alerts': null,
  'email': null,
  'display': null,
  'voice': null,
  'keyboard': null,
  'poi-actions': null,
  'sync': null,
  'slave-app': 'slave_app',
  'backup': null,
  'developer': null,
  'layout': null,
  'help': null,
  'about': null,
  'ai-assistant': null,
  'company': null,
};

const tabs = [
  { id: 'laser-gps', name: 'Laser & GPS', icon: <Gauge className="w-5 h-5" /> },
  { id: 'lateral-rear', name: 'Lateral/Rear', icon: <ArrowLeftRight className="w-5 h-5 text-cyan-400" /> },
  { id: 'gnss', name: 'GPS/Duro', icon: <Satellite className="w-5 h-5 text-green-400" /> },
  { id: 'camera', name: 'Camera', icon: <Camera className="w-5 h-5" /> },
  { id: 'calibration', name: 'Calibration', icon: <Target className="w-5 h-5 text-cyan-400" /> },
  { id: 'detection', name: 'Detection', icon: <Radar className="w-5 h-5 text-teal-400" /> },
  { id: 'ai', name: 'AI+', icon: <Brain className="w-5 h-5 text-purple-400" /> },
  { id: 'ai-assistant', name: 'AI Assistant', icon: <Bot className="w-5 h-5 text-emerald-400" /> },
  { id: 'envelope', name: 'Envelope', icon: <Truck className="w-5 h-5 text-orange-400" /> },
  { id: 'convoy', name: 'Convoy', icon: <Users className="w-5 h-5 text-blue-400" /> },
  { id: 'route', name: 'Route', icon: <Navigation className="w-5 h-5 text-green-400" /> },
  { id: 'swept-path', name: 'Swept Path', icon: <Route className="w-5 h-5 text-yellow-400" /> },
  { id: 'logo', name: 'Logo', icon: <ImageIcon className="w-5 h-5" /> },
  { id: 'map', name: 'Map', icon: <MapIcon className="w-5 h-5" /> },
  { id: 'logging', name: 'Logging', icon: <FileText className="w-5 h-5" /> },
  { id: 'alerts', name: 'Alerts', icon: <Bell className="w-5 h-5" /> },
  { id: 'email', name: 'Email', icon: <Mail className="w-5 h-5" /> },
  { id: 'display', name: 'Display', icon: <Monitor className="w-5 h-5" /> },
  { id: 'voice', name: 'Voice', icon: <Mic className="w-5 h-5 text-green-400" /> },
  { id: 'keyboard', name: 'Keyboard', icon: <Keyboard className="w-5 h-5" /> },
  { id: 'poi-actions', name: 'POI Actions', icon: <Sliders className="w-5 h-5 text-amber-400" /> },
  { id: 'sync', name: 'Sync', icon: <Cloud className="w-5 h-5" /> },
  { id: 'slave-app', name: 'Field App', icon: <Smartphone className="w-5 h-5 text-cyan-400" /> },
  { id: 'backup', name: 'Backup', icon: <Database className="w-5 h-5 text-indigo-400" /> },
  { id: 'developer', name: 'Developer', icon: <Wrench className="w-5 h-5 text-gray-400" /> },
  { id: 'admin', name: 'Admin', icon: <Shield className="w-5 h-5 text-red-400" /> },
  { id: 'company', name: 'Company', icon: <Building2 className="w-5 h-5 text-emerald-400" /> },
  { id: 'layout', name: 'Customize', icon: <Settings2 className="w-5 h-5" /> },
  { id: 'help', name: 'Help', icon: <HelpCircle className="w-5 h-5" /> },
  { id: 'about', name: 'About', icon: <Info className="w-5 h-5 text-blue-400" /> },
];

const TabManager: React.FC<TabManagerProps> = ({
  activeTab,
  setActiveTab,
  showSurveyDialog,
  setShowSurveyDialog,
  setOfflineItems,
  videoRef,
  zoomLevel,
  setZoomLevel
}) => {
  const navigate = useNavigate();
  const [showLayoutCustomizer, setShowLayoutCustomizer] = React.useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    try { return localStorage.getItem('settings-sidebar-expanded') === 'true'; } catch { return false; }
  });

  const toggleSidebar = () => setSidebarExpanded(prev => {
    const next = !prev;
    try { localStorage.setItem('settings-sidebar-expanded', String(next)); } catch {}
    return next;
  });
  
  // Get layout cards from the hook
  const { layoutConfig, saveLayout } = useLayoutCustomization();

  // Get enabled features for license enforcement
  const { hasFeature, features } = useEnabledFeatures();
  
  // Check if beta user (hide voice tab for beta/not-logged-in users)
  const auth = getSafeAuth();
  const isBeta = isBetaUser(auth?.currentUser, features);
  
  // Check if current user is admin (for admin tab visibility)
  const { isMasterAdmin: isCurrentUserMasterAdmin, cachedUserData, user } = useAuth();
  const currentUserEmail = auth?.currentUser?.email || cachedUserData?.email || null;
  const [hasAdminClaim, setHasAdminClaim] = React.useState(false);

  // Check Firebase custom claims for admin:true (set by Admin SDK on account creation/promotion)
  React.useEffect(() => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) { setHasAdminClaim(false); return; }
    firebaseUser.getIdTokenResult(false).then(result => {
      setHasAdminClaim(result.claims['admin'] === true);
    }).catch(() => setHasAdminClaim(false));
  }, [auth?.currentUser]);

  const isAdmin = isCurrentUserMasterAdmin || isMasterAdmin(currentUserEmail) || currentUserEmail === 'admin@soltec.ca' || hasAdminClaim;

  // Check if the current user is a company admin (for company portal tab)
  const [isCompanyAdmin, setIsCompanyAdmin] = React.useState(false);
  React.useEffect(() => {
    if (!user || isAdmin) return; // soltec admins already have the Admin tab
    let cancelled = false;
    const check = async () => {
      // 1. Try the API first (most authoritative, works even without prior cache)
      try {
        const { authedFetch } = await import('../lib/authedFetch');
        const res = await authedFetch('/api/my-company');
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setIsCompanyAdmin(data?.membership?.role === 'company_admin');
          return;
        }
      } catch { /* network error — fall through */ }
      // 2. Auth cache (companyRole written at login by seedCompanyDataOffline)
      try {
        const { getCompanyMembershipFromCache } = await import('../lib/auth/offlineAuth');
        const cached = await getCompanyMembershipFromCache();
        if (cached?.companyRole !== undefined) {
          if (!cancelled) setIsCompanyAdmin(cached.companyRole === 'company_admin');
          return;
        }
      } catch { /* ignore */ }
      // 3. Members IndexedDB store (secondary fallback)
      try {
        const { getUserCompanyMembership } = await import('../lib/companyOfflineStore');
        const m = await getUserCompanyMembership(user.uid);
        if (!cancelled) setIsCompanyAdmin(m?.role === 'company_admin');
      } catch { /* ignore */ }
    };
    check();
    return () => { cancelled = true; };
  }, [user, isAdmin]);

  // Filter tabs based on license (beta accounts have restricted access)
  const visibleTabs = useMemo(() => {
    return tabs.filter(tab => {
      const requiredFeature = tabFeatureMap[tab.id];
      
      // Hide voice, backup, and developer tabs for beta users
      if (tab.id === 'voice' && isBeta) return false;
      if (tab.id === 'backup' && isBeta) return false;
      if (tab.id === 'developer' && isBeta) return false;
      
      // Hide admin tab for non-admin users — never render for non-admins
      if (tab.id === 'admin' && !isAdmin) return false;
      // Admin tab is always visible for admins, regardless of beta restrictions
      if (tab.id === 'admin') return true;

      // Company tab: visible to master admins (always) or company_admin role users
      if (tab.id === 'company' && !isAdmin && !isCompanyAdmin) return false;
      // Company tab is always visible for admins/company admins, regardless of beta restrictions
      if (tab.id === 'company') return true;
      
      // If tab doesn't require a feature, always show it
      if (!requiredFeature) return true;
      // Otherwise, check if user has access to this feature
      return hasFeature(requiredFeature);
    });
  }, [hasFeature, isBeta, isAdmin, isCompanyAdmin]);

  // Group tabs by category for better organization
  const tabCategories = useMemo(() => {
    const categories = [
      { name: 'Hardware', tabs: ['laser-gps', 'lateral-rear', 'gnss', 'camera', 'calibration'] },
      { name: 'Detection', tabs: ['detection', 'ai'] },
      { name: 'Premium', tabs: ['envelope', 'convoy', 'route', 'swept-path'] },
      { name: 'Display', tabs: ['logo', 'map', 'display'] },
      { name: 'Data', tabs: ['logging', 'alerts', 'email', 'poi-actions', 'sync', 'slave-app', 'backup'] },
      { name: 'System', tabs: ['voice', 'keyboard', 'developer', 'admin', 'company', 'layout', 'help', 'about'] },
    ];
    return categories.map(cat => ({
      ...cat,
      tabs: cat.tabs.map(id => visibleTabs.find(t => t.id === id)).filter(Boolean)
    })).filter(cat => cat.tabs.length > 0);
  }, [visibleTabs]);

  // Get current tab info
  const currentTab = activeTab === 'home' 
    ? { id: 'home', name: 'Home', icon: <Home className="w-4 h-4" /> }
    : visibleTabs.find(t => t.id === activeTab) || { id: 'home', name: 'Home', icon: <Home className="w-4 h-4" /> };

  // Shared content panel — rendered in both mobile and desktop branches
  const contentPanel = (
    <div className="p-2 sm:p-3">
      {activeTab === 'home' && (
        <div className="space-y-6">
          <SurveyManager
            showSurveyDialog={showSurveyDialog}
            setShowSurveyDialog={setShowSurveyDialog}
            setOfflineItems={setOfflineItems}
            videoRef={videoRef}
          />
        </div>
      )}
      {activeTab === 'laser-gps' && <LaserGPSSettings />}
      {activeTab === 'lateral-rear' && <LateralRearLaserSettings />}
      {activeTab === 'gnss' && <GnssSettings />}
      {activeTab === 'camera' && (
        <div className="space-y-8">
          <CameraSettings />
          <div className="border-t border-gray-700 pt-6">
            <MultiCameraSettings />
          </div>
          <div className="border-t border-gray-700 pt-6">
            <CameraSettingsPanel />
          </div>
        </div>
      )}
      {activeTab === 'calibration' && <CameraCalibration />}
      {activeTab === 'detection' && (
        <div className="space-y-6">
          <DetectionSettings />
        </div>
      )}
      {activeTab === 'ai' && <AISettings />}
      {activeTab === 'ai-assistant' && <AIAssistantChat />}
      {activeTab === 'envelope' && <EnvelopeSettings />}
      {activeTab === 'convoy' && <ConvoySettings />}
      {activeTab === 'route' && <PermittedRouteSettings />}
      {activeTab === 'swept-path' && <SweptPathSettings />}
      {activeTab === 'logo' && <LogoSettings />}
      {activeTab === 'map' && <MapSettings />}
      {activeTab === 'logging' && <LoggingSettings />}
      {activeTab === 'alerts' && <AlertSettings />}
      {activeTab === 'email' && <EmailSettings />}
      {activeTab === 'display' && <DisplaySettings />}
      {activeTab === 'voice' && <VoiceSettings />}
      {activeTab === 'keyboard' && <KeyboardSettings />}
      {activeTab === 'poi-actions' && <POIActionSettings />}
      {activeTab === 'sync' && (
        <div className="space-y-4">
          <SyncControls />
          <RoadScopeSettings />
          <LiveSharingSettings />
        </div>
      )}
      {activeTab === 'slave-app' && <SlaveAppPairingDisplay className="max-w-2xl mx-auto" />}
      {activeTab === 'backup' && <BackupSettings />}
      {activeTab === 'developer' && <DeveloperSettings />}

      {activeTab === 'layout' && (
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Settings2 className="w-6 h-6 text-blue-400" />
              Layout Customization
            </h2>
            <div className="space-y-6">
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-blue-400" />
                  Display Zoom
                </h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <span className="text-sm text-gray-300">Zoom Level:</span>
                  <div className="flex flex-wrap items-center gap-2 bg-gray-800 rounded-lg p-2">
                    {[70, 80, 90, 100, 110, 120].map((zoom) => (
                      <button
                        key={zoom}
                        onClick={() => setZoomLevel(zoom)}
                        className={`px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm transition-colors ${
                          zoomLevel === zoom ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {zoom}%
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  Adjust the overall zoom level of the application interface. Changes are saved automatically.
                </p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">Customize Interface Layout</h3>
                <p className="text-gray-300 mb-4">
                  Customize each card individually on the main interface. You can change the position,
                  visibility, and size of each component.
                </p>
                <button
                  onClick={() => setShowLayoutCustomizer(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                >
                  <Settings2 className="w-4 h-4" />
                  Open Layout Customizer
                </button>
              </div>
            </div>
          </div>
          <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-400 mb-2">Layout Features</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• Individual measurement cards: Current Measure, Last Measure, Minimum Distance, Height Settings</li>
              <li>• Control cards: POI Selector, Logging Controls, Survey Manager, GPS Data</li>
              <li>• Optional cards: Detection Logs, Live Monitor Access, Sync Controls</li>
              <li>• Choose from Quarter, Third, Half, Two-Thirds, Three-Quarters, or Full width</li>
              <li>• Arrange cards in flexible rows and columns</li>
              <li>• Show/hide any individual component</li>
              <li>• Changes are saved automatically</li>
            </ul>
          </div>
        </div>
      )}
      {activeTab === 'help' && <HelpSettings />}
      {activeTab === 'about' && <AboutSettings />}
    </div>
  );

  return (
    <>
    <Tabs.Root value={activeTab} onValueChange={(val) => setActiveTab(val)}>
      <div className="flex">
        {/* ── Collapsible Sidebar Nav ── */}
        <nav
          className="flex-shrink-0 border-r border-gray-700/60 bg-gray-900/50 flex flex-col transition-all duration-200"
          style={{ width: sidebarExpanded ? '120px' : '40px' }}
          data-testid="settings-sidebar"
        >
          {/* Toggle button */}
          <button
            onClick={toggleSidebar}
            title={sidebarExpanded ? 'Collapse menu' : 'Expand menu'}
            className="w-full flex items-center justify-center py-2 text-gray-200 hover:text-white bg-gray-700/50 hover:bg-gray-600/70 transition-colors border-b border-gray-600"
            data-testid="sidebar-toggle"
          >
            {sidebarExpanded
              ? <ChevronLeft className="w-5 h-5" />
              : <ChevronRight className="w-5 h-5" />}
          </button>

          {/* Home */}
          <button
            onClick={() => setActiveTab('home')}
            title={sidebarExpanded ? undefined : 'Home'}
            className={`w-full flex items-center py-2.5 transition-colors ${
              sidebarExpanded ? 'gap-1.5 px-2 justify-start' : 'justify-center px-0'
            } ${
              activeTab === 'home'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
            data-testid="sidebar-nav-home"
          >
            <Home className="w-4 h-4 flex-shrink-0" />
            {sidebarExpanded && <span className="text-xs font-medium truncate">Home</span>}
          </button>

          {/* Category groups */}
          {tabCategories.map((category) => (
            <div key={category.name}>
              {sidebarExpanded ? (
                <div className="px-3 pt-3 pb-1 text-[9px] font-semibold text-gray-500 uppercase tracking-widest border-t border-gray-700/40">
                  {category.name}
                </div>
              ) : (
                <div className="border-t border-gray-700/40 my-1" title={category.name} />
              )}
              {category.tabs.map((tab: any) => (
                <button
                  key={tab.id}
                  onClick={() => tab.id === 'admin' ? navigate('/admin') : tab.id === 'company' ? navigate('/company-admin') : setActiveTab(tab.id)}
                  title={sidebarExpanded ? undefined : `${category.name} › ${tab.name}`}
                  className={`w-full flex items-center py-2 transition-colors ${
                    sidebarExpanded ? 'gap-1.5 px-2 justify-start' : 'justify-center px-0'
                  } ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                  data-testid={`sidebar-nav-${tab.id}`}
                >
                  {React.cloneElement(tab.icon, { className: "w-4 h-4 flex-shrink-0" })}
                  {sidebarExpanded && <span className="text-xs truncate">{tab.name}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* ── Content area ── */}
        <div className="flex-1 min-w-0">
          {contentPanel}
        </div>
      </div>
    </Tabs.Root>

    {showLayoutCustomizer && (
      <LayoutCustomizer
        cards={layoutConfig}
        onLayoutChange={(newCards) => { saveLayout(newCards); }}
        isOpen={showLayoutCustomizer}
        onClose={() => setShowLayoutCustomizer(false)}
      />
    )}
    </>
  );
};

export default TabManager;