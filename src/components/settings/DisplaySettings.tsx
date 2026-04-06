import { useSettingsStore } from '../../lib/settings';
import { Ruler, Moon, Sun } from 'lucide-react';
import { useTheme } from '../ThemeProvider';

export default function DisplaySettings() {
  const { displaySettings, setDisplaySettings } = useSettingsStore();
  const { theme, toggleTheme } = useTheme();

  const handleUnitsChange = async (units: 'metric' | 'imperial') => {
    await setDisplaySettings({
      ...displaySettings,
      units
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
      <div className="flex items-center gap-2 mb-6">
        <Ruler className="w-5 h-5 text-blue-500" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Display Settings</h2>
      </div>

      <div className="space-y-6">
        {/* Theme Toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Theme
          </label>
          <div className="flex gap-4">
            <button
              onClick={toggleTheme}
              className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                theme === 'light'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
              }`}
              data-testid="button-theme-toggle"
            >
              <div className="flex items-center justify-center gap-2">
                <Sun className="w-5 h-5" />
                <div className="text-center">
                  <div className="font-semibold">Light</div>
                  <div className="text-sm opacity-75">Default theme</div>
                </div>
              </div>
            </button>
            <button
              onClick={toggleTheme}
              className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                theme === 'dark'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
              }`}
              data-testid="button-theme-toggle"
            >
              <div className="flex items-center justify-center gap-2">
                <Moon className="w-5 h-5" />
                <div className="text-center">
                  <div className="font-semibold">Dark</div>
                  <div className="text-sm opacity-75">Eye-friendly</div>
                </div>
              </div>
            </button>
          </div>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Switch between light and dark theme. Your preference will be saved automatically.
          </p>
        </div>

        {/* Units Toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Measurement Units
          </label>
          <div className="flex gap-4">
            <button
              onClick={() => handleUnitsChange('metric')}
              className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                displaySettings.units === 'metric'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
              }`}
              data-testid="button-metric-units"
            >
              <div className="text-center">
                <div className="font-semibold">Metric</div>
                <div className="text-sm opacity-75">Meters (m)</div>
              </div>
            </button>
            <button
              onClick={() => handleUnitsChange('imperial')}
              className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                displaySettings.units === 'imperial'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
              }`}
              data-testid="button-imperial-units"
            >
              <div className="text-center">
                <div className="font-semibold">Imperial</div>
                <div className="text-sm opacity-75">Feet + Inches (ft/in)</div>
              </div>
            </button>
          </div>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            This setting controls how measurements are displayed throughout the app. All measurements are stored in meters internally.
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Unit Conversion</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
            <li>• Laser measurements are always in meters (from device)</li>
            <li>• Conversion happens only for display purposes</li>
            <li>• All backend calculations remain in meters</li>
            <li>• Imperial format: Feet + Inches (e.g., 12ft 6in)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
