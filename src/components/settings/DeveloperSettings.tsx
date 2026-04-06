import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSettingsStore } from '@/lib/settings';

export const DeveloperSettings = () => {
  const { developerSettings, setDeveloperSettings } = useSettingsStore();

  const handleTogglePerformanceMonitor = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDeveloperSettings({
      ...developerSettings,
      showPerformanceMonitor: e.target.checked
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Developer Tools</CardTitle>
        <CardDescription>
          Advanced performance monitoring and debugging tools
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label htmlFor="performance-monitor" className="text-sm font-medium">
              Performance Monitor
            </label>
            <div className="text-sm text-muted-foreground">
              Show real-time performance metrics (FPS, memory, worker health)
            </div>
          </div>
          <input
            type="checkbox"
            id="performance-monitor"
            checked={developerSettings.showPerformanceMonitor}
            onChange={handleTogglePerformanceMonitor}
            className="w-5 h-5 cursor-pointer"
            data-testid="checkbox-performance-monitor"
          />
        </div>
      </CardContent>
    </Card>
  );
};
