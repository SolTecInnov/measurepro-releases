/**
 * RoadScope Re-Sync Tool — forces re-upload of all files with correct POI associations.
 * Use this to fix surveys where photos were linked to wrong POIs due to the
 * fileToMeasurement key collision bug (fixed in v16.1.80).
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, X, AlertTriangle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { openSurveyDB } from '../../lib/survey/db';
import type { Survey } from '../../lib/survey/types';

interface RoadScopeResyncToolProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SyncedSurvey {
  id: string;
  title: string;
  poiCount: number;
  lastSyncTime: string;
  roadscopeSurveyId: string;
}

const RoadScopeResyncTool: React.FC<RoadScopeResyncToolProps> = ({ isOpen, onClose }) => {
  const [syncedSurveys, setSyncedSurveys] = useState<SyncedSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [resyncingId, setResyncingId] = useState<string | null>(null);
  const [resyncResults, setResyncResults] = useState<Map<string, 'success' | 'error'>>(new Map());

  useEffect(() => {
    if (!isOpen) return;
    loadSyncedSurveys();
  }, [isOpen]);

  const loadSyncedSurveys = async () => {
    setLoading(true);
    try {
      const db = await openSurveyDB();
      const allSettings = await db.getAll('appSettings');
      const syncStates = allSettings.filter((s: any) => s.id?.startsWith('roadscope_sync_'));

      const surveys: SyncedSurvey[] = [];
      for (const state of syncStates) {
        const surveyId = state.id.replace('roadscope_sync_', '');
        const parsed = typeof state.value === 'string' ? JSON.parse(state.value) : state.value;
        if (!parsed?.roadscopeSurveyId) continue;

        // Try to get survey title
        let title = surveyId;
        let poiCount = 0;
        try {
          const survey = await db.get('surveys', surveyId);
          if (survey) {
            title = (survey as Survey).surveyTitle || (survey as Survey).name || surveyId;
            poiCount = (survey as Survey).poiCount || 0;
          }
        } catch {}

        surveys.push({
          id: surveyId,
          title,
          poiCount,
          lastSyncTime: parsed.lastSyncTime || '',
          roadscopeSurveyId: parsed.roadscopeSurveyId,
        });
      }

      setSyncedSurveys(surveys.sort((a, b) =>
        new Date(b.lastSyncTime).getTime() - new Date(a.lastSyncTime).getTime()
      ));
    } catch (err) {
      console.error('[ResyncTool] Failed to load synced surveys:', err);
    }
    setLoading(false);
  };

  const handleResync = async (survey: SyncedSurvey) => {
    setResyncingId(survey.id);
    try {
      // Step 1: Clear file sync state so files get re-uploaded
      const { clearFileSyncState } = await import('../../lib/roadscope/syncService');
      const cleared = await clearFileSyncState(survey.id);
      console.log(`[ResyncTool] Cleared ${cleared} file sync records for ${survey.title}`);

      // Step 2: Re-trigger sync with files included
      const { syncSurveyToRoadScope } = await import('../../lib/roadscope/syncService');
      const db = await openSurveyDB();
      const surveyData = await db.get('surveys', survey.id) as Survey;

      if (!surveyData) {
        toast.error('Survey data not found in local database');
        setResyncResults(prev => new Map(prev).set(survey.id, 'error'));
        setResyncingId(null);
        return;
      }

      const result = await syncSurveyToRoadScope(surveyData, {
        includeFiles: true,
        targetSurveyId: survey.roadscopeSurveyId,
      });

      if (result.success) {
        toast.success(`Re-synced: ${survey.title}`, {
          description: `${result.filesSynced} files re-uploaded with correct POI links`,
        });
        setResyncResults(prev => new Map(prev).set(survey.id, 'success'));
      } else {
        toast.error(`Re-sync failed: ${survey.title}`, {
          description: result.errors.join(', '),
        });
        setResyncResults(prev => new Map(prev).set(survey.id, 'error'));
      }
    } catch (err) {
      console.error('[ResyncTool] Re-sync failed:', err);
      toast.error('Re-sync failed');
      setResyncResults(prev => new Map(prev).set(survey.id, 'error'));
    }
    setResyncingId(null);
  };

  const handleResyncAll = async () => {
    for (const survey of syncedSurveys) {
      if (resyncResults.get(survey.id) === 'success') continue;
      await handleResync(survey);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full m-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-bold">RoadScope Photo Re-Sync</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded-md">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex items-start gap-2 p-3 bg-amber-900/20 border border-amber-500/30 rounded-lg mb-4">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-200">
            This tool re-uploads photos to RoadScope with the correct POI associations.
            Photos were previously linked to wrong POIs due to a file mapping bug.
            Your survey data in RoadScope will not be affected — only photo links are fixed.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto mb-4 space-y-2 min-h-0">
          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading synced surveys...</div>
          ) : syncedSurveys.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No surveys have been synced to RoadScope.</div>
          ) : (
            syncedSurveys.map(s => (
              <div
                key={s.id}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  resyncResults.get(s.id) === 'success'
                    ? 'bg-green-900/20 border-green-500/30'
                    : resyncResults.get(s.id) === 'error'
                      ? 'bg-red-900/20 border-red-500/30'
                      : 'bg-gray-800/50 border-gray-700/50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.title}</div>
                  <div className="text-xs text-gray-500">
                    {s.poiCount} POIs — synced {s.lastSyncTime ? new Date(s.lastSyncTime).toLocaleDateString() : 'unknown'}
                  </div>
                </div>
                {resyncResults.get(s.id) === 'success' ? (
                  <Check className="w-5 h-5 text-green-400 shrink-0" />
                ) : (
                  <button
                    onClick={() => handleResync(s)}
                    disabled={resyncingId !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${resyncingId === s.id ? 'animate-spin' : ''}`} />
                    {resyncingId === s.id ? 'Syncing...' : 'Re-sync'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {syncedSurveys.length > 0 && (
          <button
            onClick={handleResyncAll}
            disabled={resyncingId !== null}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${resyncingId ? 'animate-spin' : ''}`} />
            Re-sync All Surveys
          </button>
        )}
      </div>
    </div>
  );
};

export default RoadScopeResyncTool;
