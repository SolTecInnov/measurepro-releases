import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertTriangle, HardDrive } from 'lucide-react';
import { openSurveyDB, purgeCompletedSurveyFromDB } from '../../lib/survey/db';
import { toast } from 'sonner';
import type { Survey } from '../../lib/survey/types';

interface StorageCleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ClosedSurveyInfo {
  id: string;
  title: string;
  poiCount: number;
  closedAt: string;
  closureReason: string;
}

const StorageCleanupModal: React.FC<StorageCleanupModalProps> = ({ isOpen, onClose }) => {
  const [closedSurveys, setClosedSurveys] = useState<ClosedSurveyInfo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    loadClosedSurveys();
  }, [isOpen]);

  const loadClosedSurveys = async () => {
    setLoading(true);
    try {
      const db = await openSurveyDB();
      const allSurveys = await db.getAll('surveys');
      const closed = allSurveys
        .filter((s: Survey) => !s.active && s.closedAt)
        .map((s: Survey) => ({
          id: s.id,
          title: s.surveyTitle || s.name || 'Untitled',
          poiCount: s.poiCount || 0,
          closedAt: s.closedAt || '',
          closureReason: s.closureReason || 'completed',
        }))
        .sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());

      // Count POIs for each survey
      for (const survey of closed) {
        try {
          const measurements = await db.getAllFromIndex('measurements', 'by-survey', survey.id);
          survey.poiCount = measurements.length;
        } catch {}
      }

      setClosedSurveys(closed);
    } catch (err) {
      console.error('[StorageCleanup] Failed to load surveys:', err);
    }
    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmText('');
  };

  const selectAll = () => {
    if (selectedIds.size === closedSurveys.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(closedSurveys.map(s => s.id)));
    }
    setConfirmText('');
  };

  const handleDelete = async () => {
    if (confirmText.toLowerCase() !== 'delete' || selectedIds.size === 0) return;

    setIsDeleting(true);
    let deleted = 0;
    for (const id of selectedIds) {
      try {
        const result = await purgeCompletedSurveyFromDB(id);
        if (result.success) deleted++;
      } catch (err) {
        console.error(`[StorageCleanup] Failed to delete survey ${id}:`, err);
      }
    }

    toast.success(`${deleted} survey(s) cleaned up`, {
      description: 'Storage freed. The app will run faster.',
    });

    setSelectedIds(new Set());
    setConfirmText('');
    setIsDeleting(false);
    loadClosedSurveys();
  };

  if (!isOpen) return null;

  const totalPOIs = closedSurveys
    .filter(s => selectedIds.has(s.id))
    .reduce((sum, s) => sum + s.poiCount, 0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full m-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <HardDrive className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold">Storage Cleanup</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-md">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Explanation */}
        <p className="text-sm text-gray-400 mb-4">
          Closed surveys stay in memory until you clean them up.
          <strong className="text-gray-200"> Make sure all surveys are saved to your hard drive before deleting.</strong>
        </p>

        {/* Survey list */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-2 min-h-0">
          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading...</div>
          ) : closedSurveys.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No closed surveys in memory. Storage is clean.</div>
          ) : (
            <>
              <button
                onClick={selectAll}
                className="text-xs text-blue-400 hover:text-blue-300 mb-2"
              >
                {selectedIds.size === closedSurveys.length ? 'Deselect all' : 'Select all'}
              </button>
              {closedSurveys.map(s => (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedIds.has(s.id)
                      ? 'bg-red-900/20 border-red-500/40'
                      : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(s.id)}
                    onChange={() => toggleSelect(s.id)}
                    className="rounded border-gray-600"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.title}</div>
                    <div className="text-xs text-gray-500">
                      {s.poiCount} POIs — closed {new Date(s.closedAt).toLocaleDateString()}
                    </div>
                  </div>
                </label>
              ))}
            </>
          )}
        </div>

        {/* Confirmation */}
        {selectedIds.size > 0 && (
          <div className="border-t border-gray-700 pt-4 space-y-3">
            <div className="flex items-start gap-2 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-200">
                You are about to permanently delete <strong>{selectedIds.size} survey(s)</strong> ({totalPOIs} POIs) from memory.
                This cannot be undone. Make sure they are saved to your hard drive.
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1">
                Type <strong className="text-red-400">delete</strong> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="Type 'delete' to confirm"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                autoComplete="off"
              />
            </div>

            <button
              onClick={handleDelete}
              disabled={confirmText.toLowerCase() !== 'delete' || isDeleting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? 'Deleting...' : `Delete ${selectedIds.size} survey(s)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StorageCleanupModal;
