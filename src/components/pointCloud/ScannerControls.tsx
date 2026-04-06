import { useState } from 'react';
import { Play, Pause, Square, Camera } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { usePointCloudScanner } from '../../hooks/usePointCloudScanner';
import { useSurveyStore } from '../../lib/survey';

export function ScannerControls() {
  const {
    recordingStatus,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  } = usePointCloudScanner();

  const { activeSurvey } = useSurveyStore();
  const [scanName, setScanName] = useState('');

  const handleStart = () => {
    if (!scanName.trim()) {
      return;
    }
    startRecording(scanName, activeSurvey?.id);
  };

  const isIdle = recordingStatus === 'idle';
  const isRecording = recordingStatus === 'recording';
  const isPaused = recordingStatus === 'paused';

  return (
    <div className="space-y-4 p-4 bg-gray-800 rounded-lg">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Point Cloud Scanner
        </h3>
        <p className="text-sm text-gray-400">
          Capture 3D infrastructure scans with ZED 2i camera
        </p>
      </div>

      {isIdle && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="scan-name" className="text-white">
              Scan Name
            </Label>
            <Input
              id="scan-name"
              data-testid="input-scan-name"
              value={scanName}
              onChange={(e) => setScanName(e.target.value)}
              placeholder="Enter scan name..."
              className="bg-gray-700 text-white border-gray-600"
            />
          </div>
          <Button
            onClick={handleStart}
            disabled={!scanName.trim()}
            className="w-full bg-green-600 hover:bg-green-700"
            data-testid="button-start-scan"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Scan
          </Button>
        </div>
      )}

      {!isIdle && (
        <div className="flex gap-2">
          {isRecording && (
            <Button
              onClick={pauseRecording}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700"
              data-testid="button-pause-scan"
            >
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}
          
          {isPaused && (
            <Button
              onClick={resumeRecording}
              className="flex-1 bg-green-600 hover:bg-green-700"
              data-testid="button-resume-scan"
            >
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
          )}

          <Button
            onClick={stopRecording}
            className="flex-1 bg-red-600 hover:bg-red-700"
            data-testid="button-stop-scan"
          >
            <Square className="h-4 w-4 mr-2" />
            Stop
          </Button>
        </div>
      )}
    </div>
  );
}
