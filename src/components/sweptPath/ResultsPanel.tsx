import { CheckCircle, AlertTriangle, XCircle, TrendingUp, Ruler, AlertOctagon } from 'lucide-react';
import { useSweptPathStore } from '../../stores/sweptPathStore';

const ResultsPanel = () => {
  const { currentAnalysis } = useSweptPathStore();

  if (!currentAnalysis) return null;

  const getVerdictIcon = () => {
    switch (currentAnalysis.verdict) {
      case 'feasible':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'tight':
        return <AlertTriangle className="w-6 h-6 text-yellow-500" />;
      case 'impossible':
        return <XCircle className="w-6 h-6 text-red-500" />;
    }
  };

  const getVerdictColor = () => {
    switch (currentAnalysis.verdict) {
      case 'feasible':
        return 'bg-green-500/10 border-green-500';
      case 'tight':
        return 'bg-yellow-500/10 border-yellow-500';
      case 'impossible':
        return 'bg-red-500/10 border-red-500';
    }
  };

  const getRecommendations = () => {
    const recommendations: string[] = [];

    if (currentAnalysis.verdict === 'impossible') {
      recommendations.push('Turn is not feasible - find alternative route');
      recommendations.push('Consider using different vehicle configuration');
    } else if (currentAnalysis.verdict === 'tight') {
      recommendations.push('Proceed with extreme caution');
      recommendations.push('Use spotter for blind spots');
      recommendations.push('Consider pilot vehicle escort');
    } else {
      recommendations.push('Turn is feasible with normal precautions');
      recommendations.push('Maintain recommended clearances');
    }

    if (currentAnalysis.worstClearance < 1.0) {
      recommendations.push('Minimal clearance detected - proceed slowly');
    }

    return recommendations;
  };

  return (
    <div className="bg-background border border-border rounded-lg p-4 space-y-4">
      {/* Verdict Header */}
      <div className={`border-2 rounded-lg p-4 ${getVerdictColor()}`}>
        <div className="flex items-center gap-3">
          {getVerdictIcon()}
          <div>
            <h3 className="text-xl font-bold capitalize" data-testid="text-verdict">
              {currentAnalysis.verdict}
            </h3>
            <p className="text-sm text-muted-foreground">
              {currentAnalysis.verdict === 'feasible' && 'Turn can be completed safely'}
              {currentAnalysis.verdict === 'tight' && 'Turn is possible but requires caution'}
              {currentAnalysis.verdict === 'impossible' && 'Turn cannot be completed safely'}
            </p>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium">Max Off-Tracking</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-max-offtracking">
            {currentAnalysis.maxOffTracking.toFixed(2)} m
          </p>
        </div>

        <div className="border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Ruler className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium">Worst Clearance</span>
          </div>
          <p className="text-2xl font-bold" data-testid="text-worst-clearance">
            {currentAnalysis.worstClearance.toFixed(2)} m
          </p>
        </div>
      </div>

      {/* Recommendations */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <AlertOctagon className="w-4 h-4" />
          <h4 className="font-medium">Recommendations</h4>
        </div>
        <ul className="space-y-1 text-sm">
          {getRecommendations().map((rec, idx) => (
            <li key={idx} className="flex items-start gap-2" data-testid={`text-recommendation-${idx}`}>
              <span className="text-primary">•</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Analysis info */}
      <div className="text-xs text-muted-foreground border-t border-border pt-3">
        <p>Analysis completed: {new Date(currentAnalysis.timestamp).toLocaleString()}</p>
        <p>Total frames: {currentAnalysis.snapshots.length}</p>
      </div>
    </div>
  );
};

export default ResultsPanel;
