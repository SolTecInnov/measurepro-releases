import { useState } from 'react';
import { usePerformanceMonitor, type PerformanceMetrics } from '@/hooks/usePerformanceMonitor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Activity, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PerformanceMonitorProps {
  enabled: boolean;
}

export const PerformanceMonitor = ({ enabled }: PerformanceMonitorProps) => {
  const { metrics, warnings } = usePerformanceMonitor(enabled);
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!enabled) return null;
  
  const getStatusIcon = (health: PerformanceMetrics['systemHealth']) => {
    switch (health) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };
  
  const getWorkerStatusColor = (status: PerformanceMetrics['workerStatus']) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500';
      case 'degraded':
        return 'text-yellow-500';
      case 'critical':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };
  
  const getWorkerStatusDot = (status: PerformanceMetrics['workerStatus']) => {
    switch (status) {
      case 'healthy':
        return '🟢';
      case 'degraded':
        return '🟡';
      case 'critical':
        return '🔴';
      default:
        return '⚪';
    }
  };
  
  return (
    <div className="fixed top-4 right-4 z-50">
      {/* Mini Status Bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg border transition-all',
          'bg-gray-800 backdrop-blur-sm hover:bg-gray-700 text-white',
          metrics.systemHealth === 'critical' && 'border-red-500',
          metrics.systemHealth === 'warning' && 'border-yellow-500',
          metrics.systemHealth === 'healthy' && 'border-green-500'
        )}
        data-testid="button-performance-monitor-toggle"
      >
        <Activity className="w-4 h-4 text-white" />
        {getStatusIcon(metrics.systemHealth)}
        <span className="text-xs font-medium text-white">
          {getWorkerStatusDot(metrics.workerStatus)} {metrics.mainThreadLoad}% | {metrics.fps} FPS
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-white" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white" />
        )}
      </button>
      
      {/* Detailed Panel */}
      {isExpanded && (
        <Card className="mt-2 w-96 shadow-xl border-2 bg-gray-800 backdrop-blur-sm text-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <Activity className="w-5 h-5 text-white" />
              Performance Monitor
              {getStatusIcon(metrics.systemHealth)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-white">
            {/* Overall Health */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-200">System Health</span>
                <span className={cn(
                  'font-bold uppercase',
                  metrics.systemHealth === 'healthy' && 'text-green-400',
                  metrics.systemHealth === 'warning' && 'text-yellow-400',
                  metrics.systemHealth === 'critical' && 'text-red-400'
                )}>
                  {metrics.systemHealth}
                </span>
              </div>
            </div>
            
            {/* Worker Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-200">Worker Status</span>
                <span className={getWorkerStatusColor(metrics.workerStatus)}>
                  {getWorkerStatusDot(metrics.workerStatus)} {metrics.workerStatus.toUpperCase()}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Buffer Usage</span>
                  <span>{metrics.workerBufferUsage}% ({metrics.workerBufferSize} items)</span>
                </div>
                <Progress value={metrics.workerBufferUsage} className="h-2" />
              </div>
            </div>
            
            {/* Storage Health (ACK-based tracking) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-200 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Storage Health
                </span>
                <span className={cn(
                  'font-bold uppercase',
                  metrics.storageHealth === 'healthy' && 'text-green-400',
                  metrics.storageHealth === 'warning' && 'text-yellow-400',
                  metrics.storageHealth === 'critical' && 'text-red-400'
                )}>
                  {metrics.storageHealth}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between text-gray-400">
                  <span>Pending Writes</span>
                  <span className={cn(
                    metrics.pendingWrites >= 500 && 'text-red-400',
                    metrics.pendingWrites >= 200 && metrics.pendingWrites < 500 && 'text-yellow-400',
                    metrics.pendingWrites < 200 && 'text-gray-300'
                  )}>
                    {metrics.pendingWrites}
                  </span>
                </div>
                {metrics.lastSuccessfulWriteAt && (
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Last Write</span>
                    <span>
                      {Math.round((Date.now() - metrics.lastSuccessfulWriteAt) / 1000)}s ago
                    </span>
                  </div>
                )}
                {metrics.lastCheckpointAt && (
                  <div className="flex items-center justify-between text-gray-400">
                    <span>Last Checkpoint</span>
                    <span>
                      {Math.round((Date.now() - metrics.lastCheckpointAt) / 60000)}m ago
                    </span>
                  </div>
                )}
                {metrics.degradedMode && (
                  <div className="p-2 mt-1 rounded bg-red-500/20 border border-red-500 text-red-300">
                    ⚠️ Degraded: {metrics.degradedModeReason || 'Unknown error'}
                  </div>
                )}
              </div>
            </div>
            
            {/* Main Thread Load */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-200">Main Thread Load</span>
                <span className={cn(
                  'font-medium',
                  metrics.mainThreadLoad >= 80 && 'text-red-400',
                  metrics.mainThreadLoad >= 60 && metrics.mainThreadLoad < 80 && 'text-yellow-400',
                  metrics.mainThreadLoad < 60 && 'text-green-400'
                )}>
                  {metrics.mainThreadLoad}%
                </span>
              </div>
              <Progress value={metrics.mainThreadLoad} className="h-2" />
            </div>
            
            {/* Frame Rate (FPS) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-200">Frame Rate</span>
                <span className={cn(
                  'font-medium',
                  metrics.fps <= 30 && 'text-red-400',
                  metrics.fps > 30 && metrics.fps <= 45 && 'text-yellow-400',
                  metrics.fps > 45 && 'text-green-400'
                )}>
                  {metrics.fps} FPS
                </span>
              </div>
              <Progress value={(metrics.fps / 60) * 100} className="h-2" />
            </div>
            
            {/* Memory Usage */}
            {metrics.memoryLimitMB > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-200">Memory Usage</span>
                  <span className={cn(
                    'font-medium',
                    metrics.memoryPercent >= 85 && 'text-red-400',
                    metrics.memoryPercent >= 70 && metrics.memoryPercent < 85 && 'text-yellow-400',
                    metrics.memoryPercent < 70 && 'text-green-400'
                  )}>
                    {metrics.memoryUsageMB} MB / {metrics.memoryLimitMB} MB
                  </span>
                </div>
                <Progress value={metrics.memoryPercent} className="h-2" />
              </div>
            )}
            
            {/* IndexedDB Latency */}
            {metrics.indexedDBLatency > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-200">Database Latency</span>
                  <span className={cn(
                    'font-medium',
                    metrics.indexedDBLatency >= 100 && 'text-red-400',
                    metrics.indexedDBLatency >= 50 && metrics.indexedDBLatency < 100 && 'text-yellow-400',
                    metrics.indexedDBLatency < 50 && 'text-green-400'
                  )}>
                    {metrics.indexedDBLatency}ms
                  </span>
                </div>
              </div>
            )}
            
            {/* POI Creation Time */}
            {metrics.lastPOICreationTime > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-200">Last POI Creation</span>
                  <span className={cn(
                    'font-medium',
                    metrics.lastPOICreationTime >= 500 && 'text-red-400',
                    metrics.lastPOICreationTime >= 200 && metrics.lastPOICreationTime < 500 && 'text-yellow-400',
                    metrics.lastPOICreationTime < 200 && 'text-green-400'
                  )}>
                    {metrics.lastPOICreationTime}ms
                  </span>
                </div>
              </div>
            )}
            
            {/* Session Statistics */}
            <div className="space-y-2 pt-2 border-t border-gray-700">
              <div className="text-sm font-medium text-gray-200">Session Statistics</div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">POIs Created</span>
                <span className="font-bold text-blue-400" data-testid="pois-created-count">
                  {metrics.poisCreatedThisSession}
                </span>
              </div>
            </div>
            
            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-gray-700">
                <div className="text-sm font-medium flex items-center gap-2 text-gray-200">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  Active Warnings
                </div>
                <div className="space-y-2">
                  {warnings.map((warning, index) => (
                    <div
                      key={index}
                      className={cn(
                        'p-2 rounded border text-xs',
                        warning.severity === 'critical' && 'bg-red-500/10 border-red-500 text-red-300',
                        warning.severity === 'warning' && 'bg-yellow-500/10 border-yellow-500 text-yellow-300'
                      )}
                      data-testid={`warning-${warning.type}`}
                    >
                      <div className="font-medium">{warning.message}</div>
                      <div className="text-gray-400 mt-1">{warning.recommendation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
