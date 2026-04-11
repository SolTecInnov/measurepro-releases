import { useState, useEffect } from 'react';
import { Radio, Wifi, WifiOff, Clock } from 'lucide-react';
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
    } else {
      if (!activeSurvey) {
        toast.error('Please start a survey first');
        return;
      }
      const success = await enableLiveBroadcast(activeSurvey.id, activeSurvey.name || 'Untitled Survey');
      if (success) {
        setBroadcasting(true);
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
      }
    }

    if (key === 'syncIntervalSeconds' && typeof value === 'number') {
      setSyncInterval(value);
    }
  };

  const broadcastStatus = getBroadcastStatus();

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Radio className="w-5 h-5 text-red-400" />
        Live Sharing
      </h2>

      <div className="space-y-3">
        {/* Compact status row */}
        <div className="bg-gray-900 rounded-lg p-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <div className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={online ? 'text-green-400' : 'text-red-400'}>
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${broadcasting ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
            <span className={broadcasting ? 'text-green-400' : 'text-gray-400'}>
              {broadcasting ? 'Sharing live' : 'Not sharing'}
            </span>
          </div>
          {broadcastStatus.surveyTitle && (
            <div className="text-blue-400 truncate max-w-[200px]">
              {broadcastStatus.surveyTitle}
            </div>
          )}
        </div>

        {/* Toggles + interval inline */}
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm text-white" title="When on, colleagues with your email can monitor your live progress in real time.">Enable live sharing</label>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
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

        <div className="flex items-center justify-between gap-3">
          <label className="text-sm text-gray-300">Auto-start with survey</label>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
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

        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-400 flex items-center gap-1.5 flex-shrink-0">
            <Clock className="w-4 h-4" />
            Interval:
          </label>
          <select
            value={liveSharingSettings.syncIntervalSeconds}
            onChange={(e) => handleSettingChange('syncIntervalSeconds', Number(e.target.value))}
            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 text-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            data-testid="select-sync-interval"
          >
            <option value={15}>Every 15 seconds</option>
            <option value={30}>Every 30 seconds (default)</option>
            <option value={60}>Every 1 minute</option>
            <option value={300}>Every 5 minutes</option>
            <option value={900}>Every 15 minutes</option>
          </select>
        </div>

        <button
          onClick={handleToggleBroadcast}
          disabled={!online || !user?.email || !liveSharingSettings.enabled}
          className={`w-full py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
            broadcasting
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          } disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed`}
          data-testid="button-toggle-broadcast"
        >
          {broadcasting ? (
            <>
              <WifiOff className="w-5 h-5" />
              Stop sharing
            </>
          ) : (
            <>
              <Wifi className="w-5 h-5" />
              Start sharing
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default LiveSharingSettings;
