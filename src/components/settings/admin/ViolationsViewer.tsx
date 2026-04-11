import { useState, useMemo } from 'react';
import { Download, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useEnvelopeStore } from '../../../stores/envelopeStore';

const ViolationsViewer = () => {
  const { violations, profiles, deleteViolation, clearViolations } = useEnvelopeStore();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [filterProfile, setFilterProfile] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'warning' | 'critical'>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Filter violations
  const filteredViolations = useMemo(() => {
    return violations.filter(v => {
      if (filterProfile !== 'all' && v.profileId !== filterProfile) return false;
      if (filterStatus !== 'all' && v.severity !== filterStatus) return false;
      
      const violationDate = new Date(v.timestamp);
      if (filterDateFrom && violationDate < new Date(filterDateFrom)) return false;
      if (filterDateTo && violationDate > new Date(filterDateTo + 'T23:59:59')) return false;
      
      return true;
    });
  }, [violations, filterProfile, filterStatus, filterDateFrom, filterDateTo]);

  const exportToCSV = () => {
    if (filteredViolations.length === 0) {
      toast.error('No violations to export');
      return;
    }

    try {
      const headers = [
        'Timestamp',
        'Vehicle Profile',
        'Severity',
        'Clearance (m)',
        'Latitude',
        'Longitude',
        'Altitude',
        'Speed',
        'Heading',
        'AI Object',
        'Confidence',
        'Notes'
      ];

      const rows = filteredViolations.map(v => [
        new Date(v.timestamp).toISOString(),
        v.profileName,
        v.severity.toUpperCase(),
        v.measurement.toFixed(2),
        v.latitude.toFixed(6),
        v.longitude.toFixed(6),
        v.altitude?.toFixed(2) || '',
        v.speed?.toFixed(2) || '',
        v.heading?.toFixed(1) || '',
        v.objectType || '',
        v.confidence?.toFixed(2) || '',
        v.notes || ''
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clearance-violations-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

    } catch (error) {
      toast.error('Failed to export CSV');
    }
  };

  const handleClearAll = () => {
    clearViolations();
    setShowClearConfirm(false);
  };

  const handleDelete = (id: string) => {
    deleteViolation(id);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">Clearance Violations Log</h3>
          <p className="text-sm text-gray-400 mt-1">
            {filteredViolations.length} violation{filteredViolations.length !== 1 ? 's' : ''}
            {filteredViolations.length !== violations.length && ` (${violations.length} total)`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            disabled={filteredViolations.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg transition-colors"
            data-testid="button-export-csv"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={violations.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg transition-colors"
            data-testid="button-clear-all"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h4 className="text-sm font-semibold text-gray-300 mb-3">Filters</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Vehicle Profile</label>
            <select
              value={filterProfile}
              onChange={(e) => setFilterProfile(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
              data-testid="select-filter-profile"
            >
              <option value="all">All Profiles</option>
              {profiles.map(profile => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'warning' | 'critical')}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
              data-testid="select-filter-status"
            >
              <option value="all">All</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">From Date</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
              data-testid="input-filter-date-from"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">To Date</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 text-sm"
              data-testid="input-filter-date-to"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900 border-b border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Timestamp</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Vehicle Profile</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Status</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Clearance (m)</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">GPS Coords</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">AI Object</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredViolations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    {violations.length === 0 ? 'No violations recorded' : 'No violations match the current filters'}
                  </td>
                </tr>
              ) : (
                filteredViolations.map((violation) => (
                  <tr key={violation.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm text-gray-200">
                      {new Date(violation.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-200">{violation.profileName}</td>
                    <td className="px-4 py-3">
                      {violation.severity === 'critical' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-900/40 text-red-300 rounded">
                          <AlertTriangle className="w-3 h-3" />
                          Critical
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-900/40 text-yellow-300 rounded">
                          <AlertTriangle className="w-3 h-3" />
                          Warning
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-200 font-mono">
                      {violation.measurement.toFixed(2)}m
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300 font-mono">
                      {violation.latitude.toFixed(4)}, {violation.longitude.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {violation.objectType || '—'}
                      {violation.confidence && (
                        <span className="text-xs text-gray-500 ml-1">
                          ({(violation.confidence * 100).toFixed(0)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(violation.id)}
                        className="p-1.5 text-red-400 hover:bg-red-900/30 rounded"
                        data-testid={`button-delete-violation-${violation.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clear All Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-700">
            <h4 className="text-lg font-semibold text-gray-100 mb-2">Clear All Violations?</h4>
            <p className="text-gray-300 mb-6">
              This will permanently delete all {violations.length} violation{violations.length !== 1 ? 's' : ''} from the log.
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                data-testid="button-cancel-clear"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                data-testid="button-confirm-clear"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViolationsViewer;
