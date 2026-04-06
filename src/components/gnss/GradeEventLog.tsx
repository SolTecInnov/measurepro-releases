/**
 * GradeEventLog - Displays grade threshold crossing events during profile recording
 * Shows 10-12%, 12-14%, and 14%+ grade segments with location, length, and direction
 */

import { TrendingUp, TrendingDown, MapPin, Ruler, Clock, Activity } from 'lucide-react';
import { 
  getCategoryColor, 
  getCategoryLabel,
  type GradeSegmentEvent 
} from '@/lib/roadProfile';
import { POI_TYPES } from '@/lib/poi';

interface GradeEventLogProps {
  events: GradeSegmentEvent[];
  maxHeight?: string;
}

const GradeEventLog: React.FC<GradeEventLogProps> = ({ 
  events, 
  maxHeight = '300px' 
}) => {
  if (events.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-700" data-testid="grade-event-log-empty">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Grade Events</h3>
        <div className="text-gray-500 text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          No grade events detected yet
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Events are logged when grade exceeds 10% thresholds
        </p>
      </div>
    );
  }

  const sortedEvents = [...events].sort((a, b) => 
    new Date(b.startTimestamp).getTime() - new Date(a.startTimestamp).getTime()
  );

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700" data-testid="grade-event-log">
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Grade Events</h3>
        <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div 
        className="overflow-y-auto divide-y divide-gray-800"
        style={{ maxHeight }}
      >
        {sortedEvents.map((event) => (
          <GradeEventItem key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
};

interface GradeEventItemProps {
  event: GradeSegmentEvent;
}

const GradeEventItem: React.FC<GradeEventItemProps> = ({ event }) => {
  const colorClass = getCategoryColor(event.category);
  const categoryLabel = getCategoryLabel(event.category);
  const isKFactor = event.category === 'kFactor';
  const DirectionIcon = isKFactor ? Activity : event.direction === 'up' ? TrendingUp : TrendingDown;
  const directionLabel = isKFactor ? 'K-FACTOR' : event.direction === 'up' ? 'UPHILL' : 'DOWNHILL';
  
  const poiTypeKey = isKFactor
    ? 'railroad'
    : event.direction === 'up' 
      ? `grade${event.category === 'grade10to12' ? '10to12' : event.category === 'grade12to14' ? '12to14' : '14Plus'}Up`
      : `grade${event.category === 'grade10to12' ? '10to12' : event.category === 'grade12to14' ? '12to14' : '14Plus'}Down`;
  
  const poiConfig = POI_TYPES.find(p => p.type === poiTypeKey);
  
  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return '--:--:--';
    }
  };

  const formatChainage = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters.toFixed(0)} m`;
  };

  return (
    <div 
      className={`p-3 hover:bg-gray-800/50 transition-colors ${poiConfig?.bgColor || 'bg-gray-800/20'}`}
      data-testid={`grade-event-${event.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${poiConfig?.bgColor || 'bg-gray-700'}`}>
          <DirectionIcon className={`h-5 w-5 ${colorClass}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-semibold text-sm ${colorClass}`}>
              {directionLabel} {categoryLabel}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex items-center gap-1 text-gray-400">
              <MapPin className="h-3 w-3" />
              <span>
                {event.startLat.toFixed(5)}, {event.startLon.toFixed(5)}
              </span>
            </div>
            
            <div className="flex items-center gap-1 text-gray-400">
              <Ruler className="h-3 w-3" />
              <span>{event.length_m.toFixed(0)}m section</span>
            </div>
            
            <div className="flex items-center gap-1 text-gray-400">
              <Clock className="h-3 w-3" />
              <span>{formatTime(event.startTimestamp)}</span>
            </div>
            
            <div className="flex items-center gap-1 text-gray-400">
              <span className="text-gray-500">@</span>
              <span>{formatChainage(event.startChainage_m)}</span>
            </div>
          </div>
          
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className={`font-mono ${colorClass}`}>
              Max: {event.maxGrade_pct >= 0 ? '+' : ''}{event.maxGrade_pct.toFixed(1)}%
            </span>
            <span className="text-gray-500">
              Avg: {event.avgGrade_pct >= 0 ? '+' : ''}{event.avgGrade_pct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradeEventLog;
