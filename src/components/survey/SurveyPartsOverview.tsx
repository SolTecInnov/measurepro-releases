/**
 * SurveyPartsOverview
 *
 * Groups multi-part surveys by rootSurveyId and shows:
 * - Total parts count
 * - POI count per part and total
 * - RoadScope sync status per part
 * - "Merge to ZIP" button to combine all parts
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Cloud, CloudOff, Package, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import type { Survey } from '../../lib/survey/types';

interface PartInfo {
  survey: Survey;
  poiCount: number;
  roadScopeSynced: boolean;
  roadScopePoisSynced: number;
}

interface SurveyGroup {
  rootName: string;
  rootId: string;
  parts: PartInfo[];
  totalPOIs: number;
  totalParts: number;
  allSynced: boolean;
}

interface SurveyPartsOverviewProps {
  surveys: Survey[];
  poiCounts: Record<string, number>;
  syncStatuses: Record<string, { synced: boolean; poisSynced: number }>;
}

function buildGroups(surveys: Survey[], poiCounts: Record<string, number>, syncStatuses: Record<string, { synced: boolean; poisSynced: number }>): SurveyGroup[] {
  const groupMap = new Map<string, PartInfo[]>();

  for (const survey of surveys) {
    const rootId = survey.rootSurveyId || survey.id;
    if (!groupMap.has(rootId)) groupMap.set(rootId, []);
    groupMap.get(rootId)!.push({
      survey,
      poiCount: poiCounts[survey.id] ?? 0,
      roadScopeSynced: syncStatuses[survey.id]?.synced ?? false,
      roadScopePoisSynced: syncStatuses[survey.id]?.poisSynced ?? 0,
    });
  }

  const groups: SurveyGroup[] = [];
  for (const [rootId, parts] of groupMap) {
    if (parts.length < 2) continue; // Only show groups with 2+ parts
    parts.sort((a, b) => (a.survey.partOrdinal ?? 1) - (b.survey.partOrdinal ?? 1));
    const totalPOIs = parts.reduce((sum, p) => sum + p.poiCount, 0);
    const allSynced = parts.every(p => p.roadScopeSynced);
    const rootName = parts[0].survey.name || parts[0].survey.surveyTitle || 'Unnamed Survey';
    groups.push({ rootName, rootId, parts, totalPOIs, totalParts: parts.length, allSynced });
  }

  return groups.sort((a, b) => {
    const dateA = a.parts[0]?.survey.createdAt || '';
    const dateB = b.parts[0]?.survey.createdAt || '';
    return dateB.localeCompare(dateA);
  });
}

async function mergePartsToZip(parts: PartInfo[]) {
  const { generateSurveyPackageBlob } = await import('../../lib/utils/exportUtils');
  const mergedZip = new JSZip();
  let totalMeasurements = 0;

  for (const part of parts) {
    const partLabel = part.survey.partLabel || `Part ${part.survey.partOrdinal ?? 1}`;
    try {
      const { blob, measurementCount } = await generateSurveyPackageBlob(part.survey);
      totalMeasurements += measurementCount;

      // Load the individual part ZIP and add its contents under a subfolder
      const partZip = await JSZip.loadAsync(blob);
      const folder = mergedZip.folder(partLabel)!;
      for (const [path, file] of Object.entries(partZip.files)) {
        if (!file.dir) {
          folder.file(path, await file.async('blob'));
        }
      }
    } catch (err) {
      console.error(`Failed to export ${partLabel}:`, err);
      toast.error(`Failed to export ${partLabel}`);
    }
  }

  // Add a merged summary README
  const summaryLines = [
    `MeasurePRO Merged Survey Export`,
    `================================`,
    `Survey: ${parts[0]?.survey.name || parts[0]?.survey.surveyTitle || 'Unknown'}`,
    `Parts: ${parts.length}`,
    `Total POIs: ${totalMeasurements}`,
    `Exported: ${new Date().toISOString()}`,
    ``,
    `Parts included:`,
    ...parts.map(p => `  - ${p.survey.partLabel || `Part ${p.survey.partOrdinal ?? 1}`}: ${p.poiCount} POIs`),
  ];
  mergedZip.file('MERGED_SUMMARY.txt', summaryLines.join('\n'));

  return mergedZip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

const SurveyPartsOverview: React.FC<SurveyPartsOverviewProps> = ({ surveys, poiCounts, syncStatuses }) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [mergingGroup, setMergingGroup] = useState<string | null>(null);

  const groups = React.useMemo(
    () => buildGroups(surveys, poiCounts, syncStatuses),
    [surveys, poiCounts, syncStatuses]
  );

  if (groups.length === 0) return null;

  const toggleGroup = (rootId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(rootId)) next.delete(rootId); else next.add(rootId);
      return next;
    });
  };

  const handleMerge = async (group: SurveyGroup) => {
    setMergingGroup(group.rootId);
    toast.loading('Merging parts into ZIP...', { id: 'merge-zip' });
    try {
      const blob = await mergePartsToZip(group.parts);
      const filename = `${(group.rootName).replace(/[^a-zA-Z0-9_-]/g, '_')}_merged_${group.totalParts}parts.zip`;

      // Try Electron save dialog first, fallback to browser download
      const api = (window as any).electronAPI;
      if (api?.saveFile) {
        const buffer = await blob.arrayBuffer();
        await api.saveFile(filename, Buffer.from(buffer));
      } else {
        const { saveAs } = await import('file-saver');
        saveAs(blob, filename);
      }

      toast.success(`Merged ${group.totalParts} parts (${group.totalPOIs} POIs)`, { id: 'merge-zip' });
    } catch (err) {
      console.error('Merge failed:', err);
      toast.error('Failed to merge parts', { id: 'merge-zip' });
    } finally {
      setMergingGroup(null);
    }
  };

  return (
    <div className="mb-4">
      <h4 className="text-xs uppercase tracking-wide text-gray-400 mb-2">Multi-Part Surveys</h4>
      <div className="space-y-2">
        {groups.map(group => {
          const expanded = expandedGroups.has(group.rootId);
          return (
            <div key={group.rootId} className="bg-gray-700/50 rounded-lg border border-gray-600 overflow-hidden">
              {/* Group header */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-700/80 transition-colors"
                onClick={() => toggleGroup(group.rootId)}
              >
                <div className="flex items-center gap-3">
                  {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  <div>
                    <span className="font-medium text-sm">{group.rootName}</span>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                      <span>{group.totalParts} parts</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {group.totalPOIs} POIs total
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {group.allSynced ? (
                    <span className="bg-green-500/20 text-green-300 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Cloud className="w-3 h-3" /> All synced
                    </span>
                  ) : (
                    <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CloudOff className="w-3 h-3" /> Partial
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMerge(group); }}
                    disabled={mergingGroup === group.rootId}
                    className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded text-xs font-medium transition-colors"
                    title="Merge all parts into a single ZIP file"
                  >
                    {mergingGroup === group.rootId ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Package className="w-3 h-3" />
                    )}
                    Merge ZIP
                  </button>
                </div>
              </div>

              {/* Expanded part details */}
              {expanded && (
                <div className="border-t border-gray-600 px-4 py-2 space-y-1">
                  {group.parts.map(part => (
                    <div
                      key={part.survey.id}
                      className="flex items-center justify-between py-1.5 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300 font-medium">
                          {part.survey.partLabel || `Part ${part.survey.partOrdinal ?? 1}`}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(part.survey.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-blue-300 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {part.poiCount}
                        </span>
                        {part.roadScopeSynced ? (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <Cloud className="w-3 h-3" />
                            {part.roadScopePoisSynced} synced
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <CloudOff className="w-3 h-3" />
                            Not synced
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SurveyPartsOverview;
