/**
 * Badge Store
 * Tracks the last created POI and manages badge application.
 * Badges (Danger, Information, WorkRequired) are added to the most
 * recently created POI via keyboard shortcut or StreamDeck.
 */

import { create } from 'zustand';
import { openSurveyDB } from '@/lib/survey/db';
import { getMeasurementFeed } from '@/lib/survey/MeasurementFeed';
import { toast } from 'sonner';

export type BadgeType = 'danger' | 'information' | 'workRequired';

export const BADGE_INFO: Record<BadgeType, { label: string; color: string; icon: string }> = {
  danger: { label: 'Danger', color: '#ef4444', icon: '⚠️' },
  information: { label: 'Information', color: '#3b82f6', icon: 'ℹ️' },
  workRequired: { label: 'Work Required', color: '#f97316', icon: '🔧' },
};

interface BadgeState {
  lastPoiId: string | null;
  lastPoiType: string | null;
  lastPoiTime: number; // Date.now() when POI was created

  setLastPoi: (id: string, poiType: string | null) => void;
  addBadgeToLastPoi: (badge: BadgeType) => Promise<void>;
}

export const useBadgeStore = create<BadgeState>((set, get) => ({
  lastPoiId: null,
  lastPoiType: null,
  lastPoiTime: 0,

  setLastPoi: (id, poiType) => set({
    lastPoiId: id,
    lastPoiType: poiType,
    lastPoiTime: Date.now(),
  }),

  addBadgeToLastPoi: async (badge: BadgeType) => {
    const { lastPoiId, lastPoiTime } = get();

    if (!lastPoiId) {
      toast.error('No POI to add badge to');
      return;
    }

    // Don't apply badge if last POI is too old (> 5 minutes)
    if (Date.now() - lastPoiTime > 5 * 60 * 1000) {
      toast.error('Last POI is too old — create a new one first');
      return;
    }

    try {
      // Update in IndexedDB
      const db = await openSurveyDB();
      const tx = db.transaction('measurements', 'readwrite');
      const store = tx.objectStore('measurements');
      const poi = await store.get(lastPoiId);

      if (!poi) {
        toast.error('POI not found in database');
        return;
      }

      // Toggle badge: add if not present, remove if already there
      const existing = poi.badges || [];
      const hasBadge = existing.includes(badge);
      const updated = hasBadge
        ? existing.filter((b: string) => b !== badge)
        : [...existing, badge];

      poi.badges = updated;
      await store.put(poi);
      await tx.done;

      // Update in-memory feed cache
      const feed = getMeasurementFeed();
      const cached = feed.getMeasurements().find((m) => m.id === lastPoiId);
      if (cached) {
        cached.badges = updated;
        feed.notifySubscribers();
      }

      const info = BADGE_INFO[badge];
      if (hasBadge) {
        toast(`${info.icon} ${info.label} removed from POI`);
      } else {
        toast.success(`${info.icon} ${info.label} added to POI`);
      }
    } catch (err) {
      console.error('[Badge] Failed to update POI:', err);
      toast.error('Failed to add badge');
    }
  },
}));
