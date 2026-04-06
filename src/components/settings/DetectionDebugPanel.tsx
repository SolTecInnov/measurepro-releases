import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Bug, RotateCcw } from 'lucide-react';

export function DetectionDebugPanel() {
  const [testOutput, setTestOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTestHarness = () => {
    setIsRunning(true);
    setTestOutput([]);
    
    const logs: string[] = [];
    
    logs.push('🧪 Detection Test Harness');
    logs.push('⚠️ Test suite not available in this build');
    logs.push('');
    logs.push('To run detection tests:');
    logs.push('1. Enable AI detection mode in Detection Settings');
    logs.push('2. Use live camera feed with test objects');
    logs.push('3. Check console for detection logs');
    logs.push('');
    logs.push('✅ Use the Detection Settings panel to configure:');
    logs.push('   - Sky threshold');
    logs.push('   - Canopy blocking');
    logs.push('   - City mode settings');
    logs.push('   - Detection confidence');
    
    setTestOutput(logs);
    setIsRunning(false);
  };

  const clearOutput = () => {
    setTestOutput([]);
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-gray-800 border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Bug className="w-6 h-6 text-yellow-400" />
            <h2 className="text-2xl font-bold text-white">Detection Test Harness</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={clearOutput}
              variant="outline"
              disabled={isRunning}
              className="flex items-center gap-2"
              data-testid="button-clear-output"
            >
              <RotateCcw className="w-4 h-4" />
              Clear
            </Button>
            <Button
              onClick={runTestHarness}
              disabled={isRunning}
              className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700"
              data-testid="button-run-tests"
            >
              <Play className="w-4 h-4" />
              {isRunning ? 'Running...' : 'Run Tests'}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-3 bg-gray-900/50 rounded border border-gray-700">
            <h3 className="font-semibold text-yellow-400 mb-2">Test Scenarios:</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• <strong>Bridge Detection:</strong> Single POI at minimum clearance</li>
              <li>• <strong>Utility Wires:</strong> One POI per 10m corridor (lowest only)</li>
              <li>• <strong>HV Wires:</strong> Max 3 POIs per corridor (3 lowest conductors)</li>
              <li>• <strong>City Mode:</strong> Aggressive suppression and rate limiting</li>
            </ul>
          </div>

          <div className="bg-black/50 rounded-lg p-4 border border-gray-700 max-h-96 overflow-y-auto">
            <div className="font-mono text-xs space-y-1">
              {testOutput.length === 0 ? (
                <div className="text-gray-500 italic">Test output will appear here...</div>
              ) : (
                testOutput.map((line, idx) => (
                  <div
                    key={idx}
                    className={
                      line.includes('===') ? 'text-yellow-400 font-bold mt-2' :
                      line.includes('Test') ? 'text-cyan-400 font-semibold' :
                      line.includes('Expected') ? 'text-green-400' :
                      line.includes('Got') ? 'text-blue-400' :
                      line.includes('POI') ? 'text-purple-400' :
                      line.includes('ERROR') ? 'text-red-400' :
                      'text-gray-300'
                    }
                    data-testid={`test-output-${idx}`}
                  >
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
