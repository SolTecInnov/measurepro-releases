import { useBufferDetectionStore } from '@/lib/detection/BufferDetectionService';
import { Progress } from '@/components/ui/progress';
import { Timer, Ruler, TrendingDown, Activity } from 'lucide-react';

export function BufferProgressIndicator() {
  const { state, progress } = useBufferDetectionStore();
  
  if (state !== 'buffering') {
    return null;
  }
  
  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)}km`;
    }
    return `${meters.toFixed(0)}m`;
  };
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };
  
  const getProgressLabel = (): string => {
    if (progress.mode === 'distance') {
      return `${formatDistance(progress.traveledDistanceMeters)} / ${formatDistance(progress.targetDistanceMeters)}`;
    }
    return `${formatTime(progress.elapsedTimeSeconds)} / ${formatTime(progress.targetTimeSeconds || 0)}`;
  };
  
  return (
    <div 
      className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2"
      data-testid="buffer-progress-indicator"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
            Buffer Active: {progress.poiType}
          </span>
        </div>
        <span className="text-xs text-blue-600 dark:text-blue-400">
          {progress.measurementCount} readings
        </span>
      </div>
      
      <Progress value={progress.progressPercent} className="h-2" />
      
      <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-300">
        <div className="flex items-center gap-1">
          {progress.mode === 'distance' ? (
            <Ruler className="h-3 w-3" />
          ) : (
            <Timer className="h-3 w-3" />
          )}
          <span>{getProgressLabel()}</span>
        </div>
        
        {progress.currentMin !== null && (
          <div className="flex items-center gap-1 font-medium">
            <TrendingDown className="h-3 w-3 text-green-600 dark:text-green-400" />
            <span className="text-green-700 dark:text-green-300">
              Min: {progress.currentMin.toFixed(2)}m
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
