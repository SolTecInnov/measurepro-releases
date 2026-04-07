import React, { useState, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CheckCircle, XCircle, Edit2, Eye, Download, Filter } from 'lucide-react';
import { useDetectionStore, type DetectionLogEntry } from '../../lib/stores/detectionStore';
import { POI_TYPES } from '../../lib/poi';
import { toast } from 'sonner';
import VirtualizedListErrorBoundary from '../VirtualizedListErrorBoundary';

interface FilterState {
  status: 'all' | 'pending' | 'accepted' | 'rejected' | 'corrected';
  objectClass: string;
  startDate: string;
  endDate: string;
}

const DetectionLogViewer: React.FC = () => {
  const { detectionLog } = useDetectionStore();
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    objectClass: 'all',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Filter detections
  const filteredDetections = useMemo(() => {
    return detectionLog.filter(entry => {
      // Status filter
      if (filters.status !== 'all' && entry.status !== filters.status) {
        return false;
      }

      // Object class filter
      if (filters.objectClass !== 'all') {
        const objectClass = entry.correctedClass || entry.detection.objectClass;
        if (objectClass !== filters.objectClass) {
          return false;
        }
      }

      // Date range filter
      if (filters.startDate) {
        const entryDate = new Date(entry.timestamp);
        const startDate = new Date(filters.startDate);
        if (entryDate < startDate) {
          return false;
        }
      }

      if (filters.endDate) {
        const entryDate = new Date(entry.timestamp);
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999); // End of day
        if (entryDate > endDate) {
          return false;
        }
      }

      return true;
    });
  }, [detectionLog, filters]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const total = detectionLog.length;
    const accepted = detectionLog.filter(e => e.status === 'accepted').length;
    const corrected = detectionLog.filter(e => e.status === 'corrected').length;
    const rejected = detectionLog.filter(e => e.status === 'rejected').length;
    
    const acceptanceRate = total > 0 ? ((accepted / total) * 100).toFixed(1) : '0';
    const correctionRate = total > 0 ? ((corrected / total) * 100).toFixed(1) : '0';
    
    // Find most common object
    const classCounts: Record<string, number> = {};
    detectionLog.forEach(entry => {
      const cls = entry.correctedClass || entry.detection.objectClass;
      classCounts[cls] = (classCounts[cls] || 0) + 1;
    });
    
    const mostCommon = Object.entries(classCounts || {}).sort((a, b) => b[1] - a[1])[0];
    
    return {
      total,
      accepted,
      corrected,
      rejected,
      acceptanceRate,
      correctionRate,
      mostCommonObject: mostCommon ? `${mostCommon[0]} (${mostCommon[1]})` : 'N/A',
    };
  }, [detectionLog]);

  // Get unique object classes
  const uniqueClasses = useMemo(() => {
    const classes = new Set<string>();
    detectionLog.forEach(entry => {
      classes.add(entry.correctedClass || entry.detection.objectClass);
    });
    return Array.from(classes).sort();
  }, [detectionLog]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Object Class', 'Confidence', 'Status', 'Corrected Class', 'Measurement', 'GPS Lat', 'GPS Lon'];
    const rows = filteredDetections.map(entry => [
      new Date(entry.timestamp).toISOString(),
      entry.detection.objectClass,
      (entry.detection.confidence * 100).toFixed(1) + '%',
      entry.status,
      entry.correctedClass || '',
      entry.measurement ? `${entry.measurement.height.toFixed(2)}m` : '',
      entry.gpsData?.latitude?.toFixed(6) || '',
      entry.gpsData?.longitude?.toFixed(6) || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `detection-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // toast suppressed
  };

  const getStatusIcon = (status: DetectionLogEntry['status']) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'corrected':
        return <Edit2 className="w-4 h-4 text-yellow-400" />;
      default:
        return <Eye className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: DetectionLogEntry['status']) => {
    const badges = {
      accepted: 'bg-green-900/30 text-green-400 border-green-700',
      rejected: 'bg-red-900/30 text-red-400 border-red-700',
      corrected: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',
      pending: 'bg-gray-900/30 text-gray-400 border-gray-700',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs border ${badges[status]} flex items-center gap-1`}>
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Null safety: normalize filtered detections to empty array
  const safeDetections = Array.isArray(filteredDetections) ? filteredDetections : [];
  
  // Performance monitoring for large datasets (dev only)
  React.useEffect(() => {
    if (import.meta.env.DEV && safeDetections.length > 10000) {
      console.warn(
        `[DetectionLogViewer] Large dataset detected: ${safeDetections.length} detections. ` +
        `Virtualization is active to maintain performance.`
      );
    }
  }, [safeDetections.length]);
  
  // Virtualizer setup with production hardening
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: safeDetections.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
    // Stable key based on detection ID (not array index)
    getItemKey: (index: number) => {
      const item = safeDetections[index];
      if (!item?.id) {
        // This should NEVER happen - all detections must have IDs
        if (import.meta.env.DEV) {
          console.error(`[DetectionLogViewer] Item at index ${index} missing ID - this is a critical bug!`, item);
        }
        // Deterministic fallback: use item's timestamp (stable across renders)
        return `error-${item?.timestamp || 'unknown'}-${item?.detection?.objectClass || 'noclass'}`;
      }
      return item.id;
    },
  });

  // Reset scroll position when filters change
  React.useEffect(() => {
    if (virtualizer && parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
  }, [filters.status, filters.objectClass, filters.startDate, filters.endDate]);

  // Virtual scrolling row component
  const renderRow = (index: number) => {
    if (index >= safeDetections.length) return null;
    
    const entry = safeDetections[index];
    const objectClass = entry.correctedClass || entry.detection.objectClass;
    const poiConfig = POI_TYPES.find(poi => 
      poi.label.toLowerCase().includes(objectClass.toLowerCase())
    );

    return (
      <div
        className="grid grid-cols-[80px_1fr_100px_140px_120px_100px] gap-4 px-4 py-3 hover:bg-gray-600 border-b border-gray-600"
        data-testid={`detection-row-${entry.id}`}
      >
        {/* Thumbnail */}
        <div className="flex items-center">
          <div className="w-12 h-12 bg-gray-900 rounded border border-purple-500 flex items-center justify-center">
            {poiConfig?.icon && (
              <poiConfig.icon className={`w-6 h-6 ${poiConfig.color}`} />
            )}
          </div>
        </div>

        {/* Object Class */}
        <div className="flex flex-col justify-center">
          <div className="font-medium">{objectClass}</div>
          {entry.correctedClass && (
            <div className="text-xs text-gray-400">
              Was: {entry.detection.objectClass}
            </div>
          )}
        </div>

        {/* Confidence */}
        <div className="flex items-center">
          <span className="font-mono text-sm">
            {(entry.detection.confidence * 100).toFixed(1)}%
          </span>
        </div>

        {/* Status */}
        <div className="flex items-center">
          {getStatusBadge(entry.status)}
        </div>

        {/* Timestamp */}
        <div className="flex flex-col justify-center">
          <div className="text-sm">
            {new Date(entry.timestamp).toLocaleDateString()}
          </div>
          <div className="text-xs text-gray-400">
            {new Date(entry.timestamp).toLocaleTimeString()}
          </div>
        </div>

        {/* Measurement */}
        <div className="flex items-center">
          {entry.measurement ? (
            <div className="font-mono text-sm">
              {entry.measurement.height.toFixed(2)}m
            </div>
          ) : (
            <span className="text-gray-500">--</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-400">Total Detections</div>
          <div className="text-2xl font-bold">{statistics.total}</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-400">Acceptance Rate</div>
          <div className="text-2xl font-bold text-green-400">{statistics.acceptanceRate}%</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-400">Correction Rate</div>
          <div className="text-2xl font-bold text-yellow-400">{statistics.correctionRate}%</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-400">Accepted</div>
          <div className="text-2xl font-bold text-green-400">{statistics.accepted}</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-400">Rejected</div>
          <div className="text-2xl font-bold text-red-400">{statistics.rejected}</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-400">Most Common</div>
          <div className="text-sm font-medium truncate">{statistics.mostCommonObject}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm font-medium"
            data-testid="button-toggle-filters"
          >
            <Filter className="w-4 h-4" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
            data-testid="button-export-csv"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 text-gray-200 rounded-lg"
                data-testid="filter-status"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="corrected">Corrected</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Object Class</label>
              <select
                value={filters.objectClass}
                onChange={(e) => setFilters(prev => ({ ...prev, objectClass: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 text-gray-200 rounded-lg"
                data-testid="filter-object-class"
              >
                <option value="all">All Classes</option>
                {uniqueClasses.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 text-gray-200 rounded-lg"
                data-testid="filter-start-date"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 text-gray-200 rounded-lg"
                data-testid="filter-end-date"
              />
            </div>
          </div>
        )}
      </div>

      {/* Detection List */}
      <div className="bg-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          {/* Table Header */}
          <div className="bg-gray-800 grid grid-cols-[80px_1fr_100px_140px_120px_100px] gap-4 px-4 py-3 min-w-[650px]">
            <div className="text-left text-xs font-medium text-gray-400 uppercase">Thumbnail</div>
            <div className="text-left text-xs font-medium text-gray-400 uppercase">Object Class</div>
            <div className="text-left text-xs font-medium text-gray-400 uppercase">Confidence</div>
            <div className="text-left text-xs font-medium text-gray-400 uppercase">Status</div>
            <div className="text-left text-xs font-medium text-gray-400 uppercase">Timestamp</div>
            <div className="text-left text-xs font-medium text-gray-400 uppercase">Measurement</div>
          </div>

          {/* Virtualized List or Empty State */}
          {safeDetections.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400">
              No detections found
            </div>
          ) : (
            <VirtualizedListErrorBoundary>
              <div 
                ref={parentRef} 
                style={{ height: '600px', overflow: 'auto' }}
                data-testid="detection-list-virtualized"
              >
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualItem) => (
                    <div
                      key={virtualItem.key}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      {renderRow(virtualItem.index)}
                    </div>
                  ))}
                </div>
              </div>
            </VirtualizedListErrorBoundary>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-400 text-center">
        Showing {filteredDetections.length} of {detectionLog.length} detections
      </div>
    </div>
  );
};

export default DetectionLogViewer;
