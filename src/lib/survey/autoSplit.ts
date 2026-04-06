/**
 * Auto-Split Survey — utility functions
 *
 * The active auto-split logic lives in AutoPartManager.ts (threshold-based,
 * non-blocking, with email/cloud/RoadScope tail). The functions below are
 * either still in use (getBaseTitle, getDisplayTitle, getSurveyParts,
 * getTotalPoiCountAcrossParts, getGlobalPoiIndex) or are kept for backwards
 * compatibility but marked @deprecated.
 */

import { Survey } from './types';
import { openSurveyDB, countMeasurementsForSurvey } from './db';
import { DEFAULT_AUTO_PART_THRESHOLD } from './constants';

/**
 * Extract the base title from a survey title that may include a part number.
 * e.g., "Highway 101 - Part 3" → "Highway 101"
 */
export function getBaseTitle(title: string): string {
  return title.replace(/\s*-\s*Part\s+\d+$/i, '').trim();
}

/**
 * Build a display title with a part number suffix.
 * Part 1 is returned without a suffix.
 * e.g., "Highway 101", part 3 → "Highway 101 - Part 3"
 */
export function getDisplayTitle(baseTitle: string, partOrdinal: number): string {
  if (partOrdinal <= 1) {
    return baseTitle;
  }
  return `${baseTitle} - Part ${partOrdinal}`;
}

/**
 * Get all parts of a survey (including the root), sorted by part ordinal.
 */
export async function getSurveyParts(rootSurveyId: string): Promise<Survey[]> {
  try {
    const db = await openSurveyDB();
    const allSurveys = await db.getAll('surveys');

    const parts = allSurveys.filter(
      (s: Survey) => s.id === rootSurveyId || s.rootSurveyId === rootSurveyId
    );

    parts.sort((a: Survey, b: Survey) => (a.partOrdinal || 1) - (b.partOrdinal || 1));

    return parts;
  } catch (error) {
    console.error('Error getting survey parts:', error);
    return [];
  }
}

/**
 * Get total POI count across all parts of a survey.
 * Uses count-only queries (O(1) memory each).
 */
export async function getTotalPoiCountAcrossParts(rootSurveyId: string): Promise<number> {
  try {
    const parts = await getSurveyParts(rootSurveyId);
    let totalCount = 0;

    for (const part of parts) {
      totalCount += await countMeasurementsForSurvey(part.id);
    }

    return totalCount;
  } catch (error) {
    console.error('Error getting total POI count:', error);
    return 0;
  }
}

/**
 * Calculate global POI index for a new POI in a multi-part survey.
 * Uses count-only queries (O(1) memory).
 */
export async function getGlobalPoiIndex(surveyId: string): Promise<number> {
  try {
    const db = await openSurveyDB();
    const survey = await db.get('surveys', surveyId);

    if (!survey) return 1;

    if (
      survey.rootSurveyId === surveyId ||
      (!survey.rootSurveyId && (!survey.partOrdinal || survey.partOrdinal === 1))
    ) {
      return (await countMeasurementsForSurvey(surveyId)) + 1;
    }

    const rootId = survey.rootSurveyId || surveyId;
    const totalCount = await getTotalPoiCountAcrossParts(rootId);
    return totalCount + 1;
  } catch (error) {
    console.error('Error getting global POI index:', error);
    return 1;
  }
}

/**
 * Get current POI count for a survey using a count-only query.
 */
export async function getSurveyPoiCount(surveyId: string): Promise<number> {
  try {
    return await countMeasurementsForSurvey(surveyId);
  } catch (error) {
    console.error('Error getting POI count:', error);
    return 0;
  }
}

// ── Deprecated ──────────────────────────────────────────────────────────────
// The functions below are no longer called by any active code path.
// AutoPartManager.ts is the single source of truth for auto-split logic.

/**
 * @deprecated Use AutoPartManager (DEFAULT_AUTO_PART_THRESHOLD = 200).
 * This constant referenced a legacy 800-POI hard limit for RoadScope.
 */
export const SURVEY_SPLIT_CONSTANTS = {
  MAX_POI_PER_PART: DEFAULT_AUTO_PART_THRESHOLD,
  WARNING_THRESHOLD: DEFAULT_AUTO_PART_THRESHOLD - 50,
  CRITICAL_THRESHOLD: DEFAULT_AUTO_PART_THRESHOLD - 10
};

/**
 * @deprecated Use AutoPartManager.triggerManualTransition() instead.
 * This function is dead code — it is not called from anywhere.
 */
export async function checkSurveyNeedsSplit(surveyId: string): Promise<{
  needsSplit: boolean;
  showWarning: boolean;
  currentCount: number;
  maxCount: number;
}> {
  try {
    const db = await openSurveyDB();
    const survey = await db.get('surveys', surveyId);
    const maxCount = survey?.maxPoiPerPart || DEFAULT_AUTO_PART_THRESHOLD;
    const currentCount = await countMeasurementsForSurvey(surveyId);

    return {
      needsSplit: currentCount >= maxCount,
      showWarning: currentCount >= maxCount - 50,
      currentCount,
      maxCount
    };
  } catch (error) {
    console.error('Error checking survey split status:', error);
    return {
      needsSplit: false,
      showWarning: false,
      currentCount: 0,
      maxCount: DEFAULT_AUTO_PART_THRESHOLD
    };
  }
}

/**
 * @deprecated Use AutoPartManager instead.
 * This function is dead code — it is not called from anywhere.
 */
export async function createSurveyContinuation(currentSurvey: Survey): Promise<Survey> {
  const db = await openSurveyDB();
  const poiCount = await countMeasurementsForSurvey(currentSurvey.id);

  const currentPart = currentSurvey.partOrdinal || 1;
  const nextPart = currentPart + 1;
  const rootId = currentSurvey.rootSurveyId || currentSurvey.id;

  const baseTitle = getBaseTitle(currentSurvey.surveyTitle || currentSurvey.name || 'Survey');
  const newTitle = getDisplayTitle(baseTitle, nextPart);

  const closedSurvey: Survey = {
    ...currentSurvey,
    closureReason: 'continuation',
    closedAt: new Date().toISOString(),
    active: false,
    poiCount
  };
  await db.put('surveys', closedSurvey);

  const continuationSurvey: Survey = {
    id: crypto.randomUUID(),
    surveyTitle: newTitle,
    name: newTitle,
    surveyorName: currentSurvey.surveyorName,
    surveyor: currentSurvey.surveyor,
    clientName: currentSurvey.clientName,
    customerName: currentSurvey.customerName,
    projectNumber: currentSurvey.projectNumber,
    originAddress: currentSurvey.originAddress,
    destinationAddress: currentSurvey.destinationAddress,
    description: currentSurvey.description,
    notes: `Auto-continuation of survey (Part ${nextPart}) - Split at ${poiCount} POIs`,
    ownerEmail: currentSurvey.ownerEmail,
    completionEmailList: currentSurvey.completionEmailList,
    enableVehicleTrace: currentSurvey.enableVehicleTrace,
    enableAlertLog: currentSurvey.enableAlertLog,
    createdAt: new Date().toISOString(),
    active: true,
    outputFiles: currentSurvey.outputFiles,
    cloudUploadStatus: null,
    syncId: null,
    exportTarget: null,
    convoyId: currentSurvey.convoyId,
    fleetUnitRole: currentSurvey.fleetUnitRole,
    plannedRouteId: currentSurvey.plannedRouteId,
    routeAnalysis: null,
    aiUserModelId: currentSurvey.aiUserModelId,
    aiHistoryScore: null,
    interventionType: currentSurvey.interventionType,
    checklistCompleted: false,
    rootSurveyId: rootId,
    partOrdinal: nextPart,
    partLabel: `Part ${nextPart}`,
    maxPoiPerPart: currentSurvey.maxPoiPerPart || DEFAULT_AUTO_PART_THRESHOLD,
    poiCount: 0,
    closureReason: null
  };

  await db.put('surveys', continuationSurvey);
  return continuationSurvey;
}

/**
 * @deprecated Use AutoPartManager instead.
 * This function is dead code — it is not called from anywhere.
 */
export function showSplitWarning(_currentCount: number, _maxCount: number): void {
  console.warn('[autoSplit] showSplitWarning is deprecated. AutoPartManager handles warnings.');
}

/**
 * @deprecated Use AutoPartManager.triggerManualTransition() instead.
 * This function is dead code — it is not called from anywhere.
 */
export async function handleAutoSplit(
  currentSurvey: Survey,
  onSurveyChange: (survey: Survey) => void
): Promise<boolean> {
  console.warn('[autoSplit] handleAutoSplit is deprecated. Use AutoPartManager.');
  try {
    const newSurvey = await createSurveyContinuation(currentSurvey);
    onSurveyChange(newSurvey);
    return true;
  } catch (error: any) {
    console.error('[autoSplit] handleAutoSplit failed:', error);
    return false;
  }
}
