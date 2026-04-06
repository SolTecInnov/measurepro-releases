import { useState, useEffect } from 'react';
import { Radio, Wifi, WifiOff, Clock, Users, Shield } from 'lucide-react';
import { useSettingsStore } from '../../lib/settings';
import { getCurrentUser, isOnline } from '../../lib/firebase';
import { 
  enableLiveBroadcast, 
  disableLiveBroadcast, 
  isBroadcastEnabled,
  getBroadcastStatus,
  setSyncInterval
} from '../../lib/firebase/liveMonitorService';
import { useSurveyStore } from '../../lib/survey';
import { toast } from 'sonner';

const LiveSharingSettings = () => {
  const { liveSharingSettings, setLiveSharingSettings } = useSettingsStore();
  const { activeSurvey } = useSurveyStore();
  const [broadcasting, setBroadcasting] = useState(false);
  const [online, setOnline] = useState(true);
  const user = getCurrentUser();

  useEffect(() => {
    setBroadcasting(isBroadcastEnabled());
    setOnline(isOnline());
    setSyncInterval(liveSharingSettings.syncIntervalSeconds);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleToggleBroadcast = async () => {
    if (!user?.email) {
      toast.error('Please sign in to enable live sharing');
      return;
    }

    if (!online) {
      toast.error('Live sharing requires an internet connection');
      return;
    }

    if (broadcasting) {
      await disableLiveBroadcast();
      setBroadcasting(false);
      toast.success('Live sharing stopped');
    } else {
      if (!activeSurvey) {
        toast.error('Please start a survey first');
        return;
      }
      const success = await enableLiveBroadcast(activeSurvey.id, activeSurvey.name || 'Untitled Survey');
      if (success) {
        setBroadcasting(true);
        toast.success('Live sharing started');
      } else {
        toast.error('Failed to start live sharing');
      }
    }
  };

  const handleSettingChange = async (key: keyof typeof liveSharingSettings, value: boolean | number) => {
    setLiveSharingSettings({
      ...liveSharingSettings,
      [key]: value
    });

    if (key === 'enabled') {
      if (!value && broadcasting) {
        await disableLiveBroadcast();
        setBroadcasting(false);
        toast.success('Live sharing disabled');
      }
    }

    if (key === 'syncIntervalSeconds' && typeof value === 'number') {
      setSyncInterval(value);
    }
  };

  const broadcastStatus = getBroadcastStatus();

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <Radio className="w-6 h-6 text-red-400" />
        Live Sharing Settings
      </h2>

      <div className="space-y-6">
        <div className="bg-blue-600/20 border border-blue-500/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-blue-300">Privacy Notice</h3>
              <p className="text-sm text-gray-300 mt-1">
                When enabled, your measurement data will be shared in real-time with other MeasurePRO users 
                who have your email address. Only enable this if you want colleagues to monitor your progress.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Wifi className="w-5 h-5 text-green-400" />
              Broadcast Status
            </h3>

            <div className="bg-gray-900 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Connection</span>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className={online ? 'text-green-400' : 'text-red-400'}>
                    {online ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-300">Broadcast</span>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${broadcasting ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                  <span className={broadcasting ? 'text-green-400' : 'text-gray-400'}>
                    {broadcasting ? 'Sharing' : 'Stopped'}
                  </span>
                </div>
              </div>

              {broadcastStatus.surveyTitle && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Survey</span>
                  <span className="text-blue-400 truncate max-w-[180px]">
                    {broadcastStatus.surveyTitle}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-gray-300">User</span>
                <span className="text-gray-400 truncate max-w-[180px]">
                  {user?.email || 'Not signed in'}
                </span>
              </div>
            </div>

            <button
              onClick={handleToggleBroadcast}
              disabled={!online || !user?.email || !liveSharingSettings.enabled}
              className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                broadcasting 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              } disabled:bg-gray-600 disabled:cursor-not-allowed`}
              data-testid="button-toggle-broadcast"
            >
              {broadcasting ? (
                <>
                  <WifiOff className="w-5 h-5" />
                  Stop Sharing
                </>
              ) : (
                <>
                  <Wifi className="w-5 h-5" />
                  Start Sharing
                </>
              )}
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-400" />
              Settings
            </h3>

            <div className="bg-gray-900 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-gray-300">Enable Live Sharing</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={liveSharingSettings.enabled}
                    onChange={(e) => handleSettingChange('enabled', e.target.checked)}
                    className="sr-only peer"
                    data-testid="input-live-sharing-enabled"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-gray-300">Auto-start with Survey</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={liveSharingSettings.autoStartWithSurvey}
                    onChange={(e) => handleSettingChange('autoStartWithSurvey', e.target.checked)}
                    className="sr-only peer"
                    data-testid="input-auto-start-survey"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
                </label>
              </div>

              <div>
                <label className="block text-gray-300 mb-2">Sync Interval</label>
                <select
                  value={liveSharingSettings.syncIntervalSeconds}
                  onChange={(e) => handleSettingChange('syncIntervalSeconds', Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  data-testid="select-sync-interval"
                >
                  <option value={15}>Every 15 seconds</option>
                  <option value={30}>Every 30 seconds (Default)</option>
                  <option value={60}>Every 1 minute</option>
                  <option value={300}>Every 5 minutes</option>
                  <option value={900}>Every 15 minutes</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Lower intervals provide more real-time updates but use more data.
                </p>
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center gap-2 text-gray-300 mb-2">
                <Users className="w-4 h-4" />
                <span className="font-medium">How it works</span>
              </div>
              <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                <li>Your measurements sync to the cloud</li>
                <li>Colleagues enter your email in Live Monitor</li>
                <li>They see your location and data in real-time</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveSharingSettings;
