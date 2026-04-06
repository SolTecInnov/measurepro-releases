/**
 * Event List Component
 * Sortable table of grade events, K-factor events, and rail crossings
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Filter, ArrowUp, ArrowDown, MapPin } from 'lucide-react';
import type { GradeEvent, KFactorEvent, RailCrossingEvent } from '../../../server/gnss/types';

interface EventListProps {
  gradeEvents: GradeEvent[];
  kFactorEvents: KFactorEvent[];
  railCrossings: RailCrossingEvent[];
  onEventClick?: (type: 'grade' | 'kfactor' | 'rail', eventId: string, distance: number) => void;
}

type EventType = 'all' | 'grade_up' | 'grade_down' | 'kfactor_convex' | 'kfactor_concave' | 'rail';
type SortField = 'distance' | 'severity' | 'timestamp';
type SortDirection = 'asc' | 'desc';

interface UnifiedEvent {
  id: string;
  type: EventType;
  distance_m: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  value: string; // Display value
  lat: number;
  lon: number;
  timestamp: string;
}

export function EventList({ gradeEvents = [], kFactorEvents = [], railCrossings = [], onEventClick }: EventListProps) {
  const [filterType, setFilterType] = useState<EventType>('all');
  const [sortField, setSortField] = useState<SortField>('distance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Unify all events into single array
  const allEvents = useMemo<UnifiedEvent[]>(() => {
    const unified: UnifiedEvent[] = [];

    // Add grade events
    (gradeEvents || []).forEach(event => {
      unified.push({
        id: event.id,
        type: event.direction === 'up' ? 'grade_up' : 'grade_down',
        distance_m: event.start_distance_m,
        severity: Math.abs(event.max_grade_pct) > 15 ? 'critical' : Math.abs(event.max_grade_pct) > 12 ? 'high' : 'medium',
        value: `${event.max_grade_pct.toFixed(1)}%`,
        lat: event.start_latitude,
        lon: event.start_longitude,
        timestamp: event.start_timestamp,
      });
    });

    // Add K-factor events
    (kFactorEvents || []).forEach(event => {
      unified.push({
        id: event.id,
        type: event.curvature_type === 'convex' ? 'kfactor_convex' : 'kfactor_concave',
        distance_m: event.distance_m,
        severity: event.severity === 'critical' ? 'critical' : 'high',
        value: `${event.k_factor.toFixed(0)}m`,
        lat: event.latitude,
        lon: event.longitude,
        timestamp: event.timestamp,
      });
    });

    // Add rail crossings
    (railCrossings || []).forEach(event => {
      unified.push({
        id: event.id,
        type: 'rail',
        distance_m: event.distance_m,
        severity: 'low',
        value: event.detection_method === 'manual' ? 'Manual' : 'Auto',
        lat: event.latitude || 0,
        lon: event.longitude || 0,
        timestamp: event.timestamp || event.created_at,
      });
    });

    return unified;
  }, [gradeEvents, kFactorEvents, railCrossings]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (filterType === 'all') return allEvents;
    return allEvents.filter(e => e.type === filterType);
  }, [allEvents, filterType]);

  // Sort events
  const sortedEvents = useMemo(() => {
    const sorted = [...filteredEvents];
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'distance':
          comparison = a.distance_m - b.distance_m;
          break;
        case 'severity':
          const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
          comparison = severityOrder[a.severity] - severityOrder[b.severity];
          break;
        case 'timestamp':
          comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filteredEvents, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleEventClick = (event: UnifiedEvent) => {
    if (!onEventClick) return;
    
    const eventType = event.type.includes('grade') ? 'grade' : 
                      event.type.includes('kfactor') ? 'kfactor' : 'rail';
    onEventClick(eventType, event.id, event.distance_m);
  };

  const exportToCSV = () => {
    const headers = ['Type', 'Distance (m)', 'Severity', 'Value', 'Latitude', 'Longitude', 'Timestamp'];
    const rows = sortedEvents.map(e => [
      e.type.replace('_', ' '),
      e.distance_m.toFixed(1),
      e.severity,
      e.value,
      e.lat.toFixed(6),
      e.lon.toFixed(6),
      new Date(e.timestamp).toISOString(),
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `road-events-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getTypeLabel = (type: EventType): string => {
    const labels: Record<EventType, string> = {
      all: 'All Events',
      grade_up: 'Grade Up',
      grade_down: 'Grade Down',
      kfactor_convex: 'K-Factor Convex',
      kfactor_concave: 'K-Factor Concave',
      rail: 'Rail Crossings',
    };
    return labels[type];
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  const getTypeIcon = (type: EventType): string => {
    if (type.includes('grade_up')) return '↗';
    if (type.includes('grade_down')) return '↘';
    if (type.includes('kfactor_convex')) return '▲';
    if (type.includes('kfactor_concave')) return '▼';
    if (type === 'rail') return '✕';
    return '•';
  };

  return (
    <Card className="w-full" data-testid="card-event-list">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Events & Alerts</span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-sm font-normal text-gray-400">
              <Filter className="h-4 w-4" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as EventType)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
                data-testid="select-event-filter"
              >
                <option value="all">All Events ({allEvents.length})</option>
                <option value="grade_up">Grade Up ({gradeEvents.filter(e => e.direction === 'up').length})</option>
                <option value="grade_down">Grade Down ({gradeEvents.filter(e => e.direction === 'down').length})</option>
                <option value="kfactor_convex">K-Factor Convex ({kFactorEvents.filter(e => e.curvature_type === 'convex').length})</option>
                <option value="kfactor_concave">K-Factor Concave ({kFactorEvents.filter(e => e.curvature_type === 'concave').length})</option>
                <option value="rail">Rail Crossings ({railCrossings.length})</option>
              </select>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={exportToCSV}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedEvents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-700">
                <tr>
                  <th className="text-left py-2 px-2">Type</th>
                  <th 
                    className="text-left py-2 px-2 cursor-pointer hover:bg-gray-800"
                    onClick={() => handleSort('distance')}
                    data-testid="header-distance"
                  >
                    <div className="flex items-center gap-1">
                      Distance
                      {sortField === 'distance' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-left py-2 px-2 cursor-pointer hover:bg-gray-800"
                    onClick={() => handleSort('severity')}
                    data-testid="header-severity"
                  >
                    <div className="flex items-center gap-1">
                      Severity
                      {sortField === 'severity' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </div>
                  </th>
                  <th className="text-left py-2 px-2">Value</th>
                  <th className="text-left py-2 px-2">GPS Coordinates</th>
                  <th 
                    className="text-left py-2 px-2 cursor-pointer hover:bg-gray-800"
                    onClick={() => handleSort('timestamp')}
                    data-testid="header-timestamp"
                  >
                    <div className="flex items-center gap-1">
                      Time
                      {sortField === 'timestamp' && (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      )}
                    </div>
                  </th>
                  <th className="text-left py-2 px-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedEvents.map((event, index) => (
                  <tr 
                    key={event.id} 
                    className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                    onClick={() => handleEventClick(event)}
                    data-testid={`row-event-${index}`}
                  >
                    <td className="py-2 px-2">
                      <span className="flex items-center gap-1">
                        <span className="text-lg">{getTypeIcon(event.type)}</span>
                        <span className="text-xs">{getTypeLabel(event.type)}</span>
                      </span>
                    </td>
                    <td className="py-2 px-2 font-mono">{event.distance_m.toFixed(1)}m</td>
                    <td className={`py-2 px-2 font-semibold ${getSeverityColor(event.severity)}`}>
                      {event.severity.toUpperCase()}
                    </td>
                    <td className="py-2 px-2 font-mono">{event.value}</td>
                    <td className="py-2 px-2 font-mono text-xs">
                      {event.lat.toFixed(6)}, {event.lon.toFixed(6)}
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-400">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(event);
                        }}
                        data-testid={`button-locate-${index}`}
                      >
                        <MapPin className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-gray-500">
            {filterType === 'all' 
              ? 'No events detected yet. Start recording to detect grade changes, sharp curves, and rail crossings.'
              : `No ${getTypeLabel(filterType).toLowerCase()} detected in current session.`
            }
          </div>
        )}
      </CardContent>
    </Card>
  );
}
