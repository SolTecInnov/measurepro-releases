import { useState, useEffect } from 'react';
import { Trash2, Download, Folder } from 'lucide-react';
import { Button } from '../ui/button';
import { usePointCloudStore } from '../../stores/pointCloudStore';
import { getAllScansMetadata, deleteScan as deleteIndexedDBScan } from '../../lib/pointCloud/storage/indexedDbStore';
import { formatBytes } from '../../lib/utils';
import { toast } from 'sonner';
import { ExportDialog } from './ExportDialog';

export function ScanListPanel() {
  const { savedScans, setSavedScans, removeSavedScan } = usePointCloudStore();
  const [loading, setLoading] = useState(true);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

  // Load scans from IndexedDB on mount
  useEffect(() => {
    loadScans();
  }, []);

  const loadScans = async () => {
    setLoading(true);
    try {
      const metadata = await getAllScansMetadata();
      // Map to PointCloudScan format
      const scans = metadata.map((m) => ({
        id: m.scanId,
        name: `Scan ${new Date(m.lastModified).toLocaleDateString()}`,
        surveyId: undefined,
        startTime: m.lastModified,
        endTime: m.lastModified,
        totalFrames: m.totalFrames,
        totalPoints: m.totalPoints,
        bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
        gpsCenter: { lat: 0, lon: 0, alt: 0 },
        status: 'completed' as const,
        storageSizeBytes: m.storageSizeBytes,
      }));
      setSavedScans(scans);
    } catch (error) {
      toast.error('Failed to load saved scans');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (scanId: string) => {
    if (!confirm('Are you sure you want to delete this scan? This cannot be undone.')) {
      return;
    }

    try {
      await deleteIndexedDBScan(scanId);
      removeSavedScan(scanId);
      // toast suppressed
    } catch (error) {
      toast.error('Failed to delete scan');
    }
  };

  const handleExport = (scanId: string) => {
    setSelectedScanId(scanId);
    setExportDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold text-white">Saved Scans</h3>
        <div className="text-gray-400 text-sm py-8 text-center">
          Loading scans...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 p-4 bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Saved Scans</h3>
          <span className="text-xs text-gray-400" data-testid="text-scan-count">
            {savedScans.length} scan{savedScans.length !== 1 ? 's' : ''}
          </span>
        </div>

        {savedScans.length === 0 ? (
          <div className="text-gray-400 text-sm py-8 text-center">
            <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No saved scans yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {savedScans.map((scan) => (
              <div
                key={scan.id}
                className="bg-gray-700 p-3 rounded hover:bg-gray-600 transition"
                data-testid={`card-scan-${scan.id}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-white font-medium text-sm" data-testid={`text-scan-name-${scan.id}`}>
                      {scan.name}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(scan.startTime).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                  <div>
                    <span className="text-gray-400">Frames:</span>
                    <span className="text-white ml-1" data-testid={`text-frames-${scan.id}`}>
                      {scan.totalFrames}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Points:</span>
                    <span className="text-white ml-1" data-testid={`text-points-${scan.id}`}>
                      {(scan.totalPoints / 1000).toFixed(0)}k
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Size:</span>
                    <span className="text-white ml-1" data-testid={`text-size-${scan.id}`}>
                      {formatBytes(scan.storageSizeBytes)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => handleExport(scan.id)}
                    data-testid={`button-export-${scan.id}`}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Export
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    onClick={() => handleDelete(scan.id)}
                    data-testid={`button-delete-${scan.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedScanId && (
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          scanId={selectedScanId}
        />
      )}
    </>
  );
}
