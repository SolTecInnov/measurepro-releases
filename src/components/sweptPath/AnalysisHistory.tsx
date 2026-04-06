import { useState } from 'react';
import { History, Trash2, CheckCircle, AlertTriangle, XCircle, Filter } from 'lucide-react';
import { useSweptPathStore } from '../../stores/sweptPathStore';
import { toast } from 'sonner';

const AnalysisHistory = () => {
  const { analysisHistory, removeFromHistory } = useSweptPathStore();
  const [filterVerdict, setFilterVerdict] = useState<string>('all');

  const filteredHistory = analysisHistory.filter(analysis => {
    if (filterVerdict === 'all') return true;
    return analysis.verdict?.toLowerCase() === filterVerdict;
  });

  const handleLoadAnalysis = (_analysis: any) => {
    // TODO: Load full analysis with snapshots from IndexedDB
    toast.info('Loading analysis...');
  };

  const handleDeleteAnalysis = (id: string) => {
    removeFromHistory(id);
    toast.success('Analysis deleted');
  };

  const getVerdictIcon = (verdict: string) => {
    const v = verdict?.toLowerCase();
    switch (v) {
      case 'feasible':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'tight':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'impossible':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getVerdictColor = (verdict: string) => {
    const v = verdict?.toLowerCase();
    switch (v) {
      case 'feasible':
        return 'border-green-500 bg-green-500/10';
      case 'tight':
        return 'border-yellow-500 bg-yellow-500/10';
      case 'impossible':
        return 'border-red-500 bg-red-500/10';
      default:
        return 'border-border bg-background';
    }
  };

  return (
    <div className="bg-background border border-border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5" />
          <h3 className="font-bold">Analysis History</h3>
          <span className="text-sm text-muted-foreground">
            ({filteredHistory.length} {filteredHistory.length === 1 ? 'analysis' : 'analyses'})
          </span>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <select
            value={filterVerdict}
            onChange={(e) => setFilterVerdict(e.target.value)}
            className="border border-border rounded px-2 py-1 text-sm"
            data-testid="select-filter-verdict"
          >
            <option value="all">All</option>
            <option value="feasible">Feasible</option>
            <option value="tight">Tight</option>
            <option value="impossible">Impossible</option>
          </select>
        </div>
      </div>

      {/* History List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No analyses yet. Click "Analyze Turn" to create one.
          </p>
        ) : (
          filteredHistory.map((analysis: any) => (
            <div
              key={analysis.id}
              className={`border-2 rounded-lg p-3 ${getVerdictColor(analysis.verdict)}`}
              data-testid={`card-analysis-${analysis.id}`}
            >
              <div className="flex gap-3">
                {/* Thumbnail */}
                {analysis.captureImageUrl && (
                  <img
                    src={analysis.captureImageUrl}
                    alt="Analysis thumbnail"
                    className="w-24 h-16 object-cover rounded border border-border"
                  />
                )}

                {/* Details */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getVerdictIcon(analysis.verdict)}
                    <span className="font-bold capitalize">{analysis.verdict?.toLowerCase()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(analysis.timestamp).toLocaleString()}
                  </p>
                  <p className="text-xs mt-1">
                    {analysis.vehicleProfileName || analysis.vehicleProfileId}
                  </p>
                  <div className="flex gap-4 mt-1 text-xs">
                    <span>Off-tracking: {analysis.maxOffTracking?.toFixed(2) || 'N/A'}m</span>
                    <span>Clearance: {analysis.worstClearance?.toFixed(2) || 'N/A'}m</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleLoadAnalysis(analysis)}
                    className="btn btn-sm btn-secondary"
                    title="Load analysis"
                    data-testid={`button-load-${analysis.id}`}
                  >
                    Load
                  </button>
                  <button
                    onClick={() => handleDeleteAnalysis(analysis.id)}
                    className="btn btn-sm btn-ghost text-red-500"
                    title="Delete analysis"
                    data-testid={`button-delete-${analysis.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AnalysisHistory;
