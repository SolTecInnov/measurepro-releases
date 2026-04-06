import { Smartphone, Gauge, Users, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEnabledFeatures } from '../hooks/useLicenseEnforcement';

const MobileAppSelector = () => {
  const navigate = useNavigate();
  const { hasFeature } = useEnabledFeatures();

  const handleAppSelect = (app: 'main' | 'slave' | 'convoy') => {
    // Set manual navigation flag to prevent auto-redirect
    sessionStorage.setItem('manual_navigation', 'true');
    sessionStorage.setItem('selected_app', app);
    
    switch (app) {
      case 'main':
        navigate('/');
        break;
      case 'slave':
        navigate('/slave-app');
        break;
      case 'convoy':
        // Navigate to convoy join page where users can join or create a convoy
        navigate('/convoy/join');
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-gray-900 to-purple-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">MeasurePRO</h1>
          <p className="text-gray-300 text-lg">Choose your application mode</p>
        </div>

        {/* App Selection Cards */}
        <div className="space-y-4">
          {/* Main App */}
          <button
            onClick={() => handleAppSelect('main')}
            className="w-full bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl hover:shadow-2xl transition-all hover:scale-105 text-left group"
            data-testid="button-select-main-app"
          >
            <div className="flex items-start gap-4">
              <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                <Gauge className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  Main App
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Full MeasurePRO experience with all features, AI detection, and advanced controls
                </p>
              </div>
            </div>
          </button>

          {/* Slave App - Premium Feature */}
          {hasFeature('slave_app') && (
            <button
              onClick={() => handleAppSelect('slave')}
              className="w-full bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl hover:shadow-2xl transition-all hover:scale-105 text-left group"
              data-testid="button-select-slave-app"
            >
              <div className="flex items-start gap-4">
                <div className="bg-green-100 dark:bg-green-900 p-3 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
                  <Smartphone className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    Mobile Data Collection
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Simplified mobile interface for quick field data capture and logging
                  </p>
                </div>
              </div>
            </button>
          )}

          {/* Convoy Guardian - Premium Feature */}
          {hasFeature('convoy_guardian') && (
            <button
              onClick={() => handleAppSelect('convoy')}
              className="w-full bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl hover:shadow-2xl transition-all hover:scale-105 text-left group"
              data-testid="button-select-convoy-guardian"
            >
              <div className="flex items-start gap-4">
                <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                  <Users className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    Convoy Guardian
                    <span className="ml-2 text-xs font-semibold bg-purple-600 text-white px-2 py-1 rounded">
                      PREMIUM
                    </span>
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
                    Multi-vehicle coordination with real-time data sharing and black box logging
                  </p>
                  <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded border border-orange-300 dark:border-orange-500/50">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    <span className="font-semibold">Internet required</span>
                  </div>
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-400 text-sm">
          <p>SolTecInnovation © {new Date().getFullYear()}</p>
          <p className="mt-1">Professional Field Measurement Solutions</p>
        </div>
      </div>
    </div>
  );
};

export default MobileAppSelector;
