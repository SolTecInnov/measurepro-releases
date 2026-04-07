import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Download, Trash2, Image as ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  getAllTrainingFrames,
  deleteTrainingFrame,
  getTrainingDataSize,
  exportTrainingDataYOLO,
} from '../../../lib/training';
import type { TrainingFrame } from '../../../lib/training';
import { queryClient } from '../../../lib/queryClient';

const TrainingDataManager = () => {
  const [selectedFrames, setSelectedFrames] = useState<Set<string>>(new Set());
  const [viewingFrame, setViewingFrame] = useState<TrainingFrame | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch training frames
  const { data: frames = [], isLoading } = useQuery({
    queryKey: ['training-frames'],
    queryFn: getAllTrainingFrames,
  });

  // Fetch data size
  const { data: dataSize } = useQuery({
    queryKey: ['training-data-size'],
    queryFn: getTrainingDataSize,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteTrainingFrame,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-frames'] });
      queryClient.invalidateQueries({ queryKey: ['training-data-size'] });
      // toast suppressed
    },
    onError: () => {
      toast.error('Failed to delete training frame');
    },
  });

  const handleSelectFrame = (id: string) => {
    setSelectedFrames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedFrames.size === frames.length) {
      setSelectedFrames(new Set());
    } else {
      setSelectedFrames(new Set(frames.map(f => f.id)));
    }
  };

  const handleDeleteSelected = async () => {
    try {
      await Promise.all(
        Array.from(selectedFrames).map(id => deleteTrainingFrame(id))
      );
      queryClient.invalidateQueries({ queryKey: ['training-frames'] });
      queryClient.invalidateQueries({ queryKey: ['training-data-size'] });
      // toast suppressed
      setSelectedFrames(new Set());
    } catch (error) {
      toast.error('Failed to delete selected frames');
    }
  };

  const handleExportToYOLO = async () => {
    try {
      setIsExporting(true);
      // toast suppressed

      // Get all enabled classes for class mapping
      const enabledClasses = Array.from(
        new Set(
          frames.flatMap(f =>
            (f.metadata.labels || []).map(l => l.objectClass)
          )
        )
      );

      const classMapping = new Map(enabledClasses.map((c, i) => [c, i]));

      const blob = await exportTrainingDataYOLO(frames, classMapping);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `training-data-${new Date().toISOString().split('T')[0]}.zip`;
      link.click();
      URL.revokeObjectURL(url);

      // toast suppressed
    } catch (error) {
      toast.error('Failed to export training data');
    } finally {
      setIsExporting(false);
    }
  };

  const getObjectCount = (frame: TrainingFrame) => {
    return frame.metadata.labels?.length || 0;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">AI Training Data Manager</h3>
          <p className="text-sm text-gray-400 mt-1">
            {frames.length} frame{frames.length !== 1 ? 's' : ''}
            {dataSize && ` • ${dataSize.sizeInMB.toFixed(2)} MB`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportToYOLO}
            disabled={frames.length === 0 || isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg transition-colors"
            data-testid="button-export-yolo"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Exporting...' : 'Export All to YOLO'}
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={selectedFrames.size === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg transition-colors"
            data-testid="button-delete-selected"
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected ({selectedFrames.size})
          </button>
        </div>
      </div>

      {/* Select All */}
      {frames.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedFrames.size === frames.length}
              onChange={handleSelectAll}
              className="w-4 h-4 bg-gray-700 border border-gray-600 rounded"
              data-testid="checkbox-select-all"
            />
            Select All
          </label>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading training data...</div>
      ) : frames.length === 0 ? (
        <div className="text-center py-12">
          <ImageIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No training data available</p>
          <p className="text-sm text-gray-500 mt-2">
            Enable training mode in AI+ settings to start capturing frames
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {frames.map((frame) => (
            <div
              key={frame.id}
              className={`bg-gray-800 rounded-lg overflow-hidden border-2 transition-all ${
                selectedFrames.has(frame.id)
                  ? 'border-blue-500'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="relative aspect-video bg-gray-900">
                <img
                  src={frame.imageData}
                  alt="Training frame"
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setViewingFrame(frame)}
                  data-testid={`img-frame-${frame.id}`}
                />
                <div className="absolute top-2 left-2">
                  <input
                    type="checkbox"
                    checked={selectedFrames.has(frame.id)}
                    onChange={() => handleSelectFrame(frame.id)}
                    className="w-5 h-5 bg-gray-700 border border-gray-600 rounded cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`checkbox-frame-${frame.id}`}
                  />
                </div>
                {getObjectCount(frame) > 0 && (
                  <div className="absolute top-2 right-2 px-2 py-1 bg-purple-600 text-white text-xs font-medium rounded">
                    {getObjectCount(frame)} object{getObjectCount(frame) !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {new Date(frame.timestamp).toLocaleString()}
                  </span>
                  <button
                    onClick={() => deleteMutation.mutate(frame.id)}
                    className="p-1 text-red-400 hover:bg-red-900/30 rounded"
                    data-testid={`button-delete-frame-${frame.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full-size Image Dialog */}
      {viewingFrame && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-5xl w-full">
            <button
              onClick={() => setViewingFrame(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
              data-testid="button-close-viewer"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="bg-gray-900 rounded-lg overflow-hidden">
              <img
                src={viewingFrame.imageData}
                alt="Training frame"
                className="w-full h-auto"
              />
              <div className="p-4 bg-gray-800 border-t border-gray-700">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Timestamp:</span>
                    <span className="text-gray-200 ml-2">
                      {new Date(viewingFrame.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Objects:</span>
                    <span className="text-gray-200 ml-2">{getObjectCount(viewingFrame)}</span>
                  </div>
                  {viewingFrame.metadata.gps && (
                    <div className="col-span-2">
                      <span className="text-gray-400">GPS:</span>
                      <span className="text-gray-200 ml-2 font-mono">
                        {viewingFrame.metadata.gps.latitude.toFixed(6)},{' '}
                        {viewingFrame.metadata.gps.longitude.toFixed(6)}
                      </span>
                    </div>
                  )}
                  {viewingFrame.metadata.labels && viewingFrame.metadata.labels.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-gray-400">Detected Objects:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {viewingFrame.metadata.labels.map((label, idx) => (
                          <span
                            key={idx}
                            className="inline-flex px-2 py-1 text-xs font-medium bg-purple-900/40 text-purple-300 rounded"
                          >
                            {label.objectClass}
                            {label.confidence && ` (${(label.confidence * 100).toFixed(0)}%)`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingDataManager;
