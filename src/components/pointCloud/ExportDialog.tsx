import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { exportScanData } from '../../lib/pointCloud/storage/indexedDbStore';
import { exportToPLY } from '../../lib/pointCloud/exporters/PLYExporter';
import { exportToLAS } from '../../lib/pointCloud/exporters/LASExporter';
import { mergePointCloudFrames } from '../../lib/pointCloud/PointCloudGenerator';
import { toast } from 'sonner';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scanId: string;
}

type ExportFormat = 'ply' | 'las';

export function ExportDialog({ open, onOpenChange, scanId }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('ply');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);

    try {
      // Load scan data from IndexedDB
      // toast suppressed
      setProgress(10);
      
      const { frames, metadata } = await exportScanData(scanId);
      
      if (frames.length === 0) {
        toast.error('No frames found for this scan');
        return;
      }

      setProgress(30);
      // toast suppressed

      // Merge all frames
      const { points, colors } = mergePointCloudFrames(frames);
      
      setProgress(60);
      /* toast removed */

      // Export based on format
      let blob: Blob;
      let filename: string;

      if (format === 'ply') {
        const plyData = exportToPLY(points, colors, {
          format: 'binary',
          includeColors: true,
        });
        blob = new Blob([plyData], { type: 'application/octet-stream' });
        filename = `scan_${scanId}_${Date.now()}.ply`;
      } else {
        const lasData = exportToLAS(points, colors, {
          scale: [0.001, 0.001, 0.001],
          offset: [0, 0, 0],
        });
        blob = new Blob([lasData], { type: 'application/octet-stream' });
        filename = `scan_${scanId}_${Date.now()}.las`;
      }

      setProgress(90);

      // Download file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress(100);
      // toast suppressed
      
      setTimeout(() => {
        onOpenChange(false);
        setProgress(0);
      }, 1000);

    } catch (error: any) {
      toast.error('Export failed', { description: error.message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-800 text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Export Point Cloud
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Select export format and download your point cloud scan
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format Selection */}
          <div>
            <Label className="text-white mb-2 block">Export Format</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFormat('ply')}
                className={`p-3 rounded border-2 transition ${
                  format === 'ply'
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                }`}
                data-testid="button-format-ply"
              >
                <div className="font-medium">PLY</div>
                <div className="text-xs text-gray-400">Polygon File Format</div>
              </button>
              <button
                onClick={() => setFormat('las')}
                className={`p-3 rounded border-2 transition ${
                  format === 'las'
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                }`}
                data-testid="button-format-las"
              >
                <div className="font-medium">LAS</div>
                <div className="text-xs text-gray-400">LiDAR Format</div>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          {exporting && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Exporting...</span>
                <span className="text-sm text-white" data-testid="text-progress">
                  {progress}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                  data-testid="progress-export"
                />
              </div>
            </div>
          )}

          {/* Export Button */}
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="w-full bg-blue-600 hover:bg-blue-700"
            data-testid="button-export"
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
