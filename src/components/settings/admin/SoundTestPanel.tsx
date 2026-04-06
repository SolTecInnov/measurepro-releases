import { useState, useEffect } from 'react';
import { Play, Volume2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { soundManager } from '../../../lib/sounds';

const SoundTestPanel = () => {
  const [audioContextState, setAudioContextState] = useState<'suspended' | 'running' | 'closed'>('suspended');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const checkAudioContext = () => {
      try {
        const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const context = new AudioContext();
          setAudioContextState(context.state);
          context.close();
        }
      } catch (error) {
      }
    };

    checkAudioContext();

    // Subscribe to sound manager updates
    const unsubscribe = soundManager.subscribe(() => {
      setIsInitialized(true);
      checkAudioContext();
    });

    return unsubscribe;
  }, []);

  const handleTestWarning = async () => {
    try {
      await soundManager.initialize();
      await soundManager.playWarning();
      toast.success('Playing warning sound');
    } catch (error) {
      toast.error('Failed to play warning sound');
    }
  };

  const handleTestCritical = async () => {
    try {
      await soundManager.initialize();
      await soundManager.playCritical();
      toast.success('Playing critical sound');
    } catch (error) {
      toast.error('Failed to play critical sound');
    }
  };

  const handleTestLogEntry = async () => {
    try {
      await soundManager.initialize();
      await soundManager.playLogEntry();
      toast.success('Playing log entry sound');
    } catch (error) {
      toast.error('Failed to play log entry sound');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-100">Sound System Test Panel</h3>
        <p className="text-sm text-gray-400 mt-1">
          Test audio alerts and verify sound system functionality
        </p>
      </div>

      {/* Audio Context Status */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center gap-2 mb-2">
          <Volume2 className="w-5 h-5 text-blue-400" />
          <h4 className="text-sm font-semibold text-gray-300">Audio System Status</h4>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Audio Context:</span>
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
            audioContextState === 'running'
              ? 'bg-green-900/40 text-green-300'
              : 'bg-yellow-900/40 text-yellow-300'
          }`}>
            {audioContextState.toUpperCase()}
          </span>
          {!isInitialized && audioContextState === 'suspended' && (
            <span className="text-xs text-gray-500">Click any test button to initialize</span>
          )}
        </div>
      </div>

      {/* Test Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-yellow-900/30 rounded-full">
              <Volume2 className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h5 className="font-semibold text-gray-100 mb-1">Warning Sound</h5>
              <p className="text-xs text-gray-400">
                Played for height measurements approaching threshold
              </p>
            </div>
            <button
              onClick={handleTestWarning}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
              data-testid="button-test-warning-sound"
            >
              <Play className="w-4 h-4" />
              Test Warning
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-red-900/30 rounded-full">
              <Volume2 className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h5 className="font-semibold text-gray-100 mb-1">Critical Sound</h5>
              <p className="text-xs text-gray-400">
                Played for height measurements below critical threshold
              </p>
            </div>
            <button
              onClick={handleTestCritical}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              data-testid="button-test-critical-sound"
            >
              <Play className="w-4 h-4" />
              Test Critical
            </button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-blue-900/30 rounded-full">
              <Volume2 className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h5 className="font-semibold text-gray-100 mb-1">Log Entry Sound</h5>
              <p className="text-xs text-gray-400">
                Played when a measurement is logged to the database
              </p>
            </div>
            <button
              onClick={handleTestLogEntry}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              data-testid="button-test-log-entry-sound"
            >
              <Play className="w-4 h-4" />
              Test Log Entry
            </button>
          </div>
        </div>
      </div>

      {/* Browser Autoplay Policy Notice */}
      <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h5 className="text-sm font-semibold text-blue-300 mb-1">About Browser Autoplay Policy</h5>
            <p className="text-sm text-blue-200/80">
              Modern browsers require user interaction before playing audio. The audio system will automatically
              initialize when you click any test button. Once initialized, sounds will work throughout the application.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SoundTestPanel;
