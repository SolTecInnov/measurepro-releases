/**
 * Predefined geographic regions for offline map tile downloads.
 * Users pick a province, state, or country from a dropdown instead of
 * entering bounding box coordinates by hand.
 */

export interface OfflineRegion {
  name: string;
  group: 'country' | 'ca-province' | 'us-state';
  bbox: { north: number; south: number; east: number; west: number };
  /** Suggested zoom range. Users can adjust. */
  defaultMinZoom: number;
  defaultMaxZoom: number;
}

export const OFFLINE_REGIONS: OfflineRegion[] = [
  // ── Countries ────────────────────────────────────────────────────────────────
  { name: 'Canada',        group: 'country', bbox: { north: 72, south: 41.7, east: -52, west: -141 }, defaultMinZoom: 4, defaultMaxZoom: 7 },
  { name: 'United States', group: 'country', bbox: { north: 49.4, south: 24.4, east: -66.9, west: -125 }, defaultMinZoom: 4, defaultMaxZoom: 7 },

  // ── Canadian Provinces & Territories ──────────────────────────────────────────
  { name: 'Alberta',              group: 'ca-province', bbox: { north: 60, south: 49, east: -110, west: -120 }, defaultMinZoom: 6, defaultMaxZoom: 12 },
  { name: 'British Columbia',     group: 'ca-province', bbox: { north: 60, south: 48.3, east: -114.1, west: -139.1 }, defaultMinZoom: 6, defaultMaxZoom: 12 },
  { name: 'Manitoba',             group: 'ca-province', bbox: { north: 60, south: 49, east: -88.9, west: -102.1 }, defaultMinZoom: 6, defaultMaxZoom: 12 },
  { name: 'New Brunswick',        group: 'ca-province', bbox: { north: 48, south: 44.6, east: -63.8, west: -69.1 }, defaultMinZoom: 7, defaultMaxZoom: 13 },
  { name: 'Newfoundland & Labrador', group: 'ca-province', bbox: { north: 60.4, south: 46.6, east: -52.6, west: -67.8 }, defaultMinZoom: 6, defaultMaxZoom: 12 },
  { name: 'Northwest Territories', group: 'ca-province', bbox: { north: 78.8, south: 60, east: -102, west: -136.5 }, defaultMinZoom: 5, defaultMaxZoom: 10 },
  { name: 'Nova Scotia',          group: 'ca-province', bbox: { north: 47.1, south: 43.4, east: -59.7, west: -66.5 }, defaultMinZoom: 7, defaultMaxZoom: 13 },
  { name: 'Nunavut',              group: 'ca-province', bbox: { north: 83.1, south: 51.7, east: -61.1, west: -120.7 }, defaultMinZoom: 4, defaultMaxZoom: 8 },
  { name: 'Ontario',              group: 'ca-province', bbox: { north: 56.9, south: 41.7, east: -74.3, west: -95.2 }, defaultMinZoom: 6, defaultMaxZoom: 12 },
  { name: 'Prince Edward Island', group: 'ca-province', bbox: { north: 47.1, south: 45.9, east: -62, west: -64.5 }, defaultMinZoom: 8, defaultMaxZoom: 14 },
  { name: 'Quebec',               group: 'ca-province', bbox: { north: 62.6, south: 45, east: -57.1, west: -79.8 }, defaultMinZoom: 6, defaultMaxZoom: 12 },
  { name: 'Saskatchewan',         group: 'ca-province', bbox: { north: 60, south: 49, east: -101.4, west: -110 }, defaultMinZoom: 6, defaultMaxZoom: 12 },
  { name: 'Yukon',                group: 'ca-province', bbox: { north: 69.6, south: 60, east: -124, west: -141 }, defaultMinZoom: 5, defaultMaxZoom: 10 },

  // ── US States (full list, alphabetical) ───────────────────────────────────────
  { name: 'Alabama',       group: 'us-state', bbox: { north: 35, south: 30.2, east: -84.9, west: -88.5 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Alaska',        group: 'us-state', bbox: { north: 71.4, south: 51.2, east: -130, west: -179.2 }, defaultMinZoom: 4, defaultMaxZoom: 9 },
  { name: 'Arizona',       group: 'us-state', bbox: { north: 37, south: 31.3, east: -109, west: -115 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Arkansas',      group: 'us-state', bbox: { north: 36.5, south: 33, east: -89.6, west: -94.6 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'California',    group: 'us-state', bbox: { north: 42, south: 32.5, east: -114.1, west: -124.4 }, defaultMinZoom: 6, defaultMaxZoom: 12 },
  { name: 'Colorado',      group: 'us-state', bbox: { north: 41, south: 37, east: -102, west: -109.1 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Connecticut',   group: 'us-state', bbox: { north: 42.1, south: 40.9, east: -71.8, west: -73.7 }, defaultMinZoom: 8, defaultMaxZoom: 13 },
  { name: 'Delaware',      group: 'us-state', bbox: { north: 39.8, south: 38.5, east: -75, west: -75.8 }, defaultMinZoom: 8, defaultMaxZoom: 13 },
  { name: 'Florida',       group: 'us-state', bbox: { north: 31, south: 24.5, east: -80, west: -87.6 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Georgia',       group: 'us-state', bbox: { north: 35, south: 30.4, east: -80.8, west: -85.6 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Hawaii',        group: 'us-state', bbox: { north: 22.3, south: 18.9, east: -154.8, west: -160.3 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Idaho',         group: 'us-state', bbox: { north: 49, south: 42, east: -111, west: -117.2 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Illinois',      group: 'us-state', bbox: { north: 42.5, south: 37, east: -87.5, west: -91.5 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Indiana',       group: 'us-state', bbox: { north: 41.8, south: 37.8, east: -84.8, west: -88.1 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Iowa',          group: 'us-state', bbox: { north: 43.5, south: 40.4, east: -90.1, west: -96.6 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Kansas',        group: 'us-state', bbox: { north: 40, south: 37, east: -94.6, west: -102 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Kentucky',      group: 'us-state', bbox: { north: 39.1, south: 36.5, east: -81.9, west: -89.6 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Louisiana',     group: 'us-state', bbox: { north: 33, south: 28.9, east: -89, west: -94.1 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Maine',         group: 'us-state', bbox: { north: 47.5, south: 43, east: -66.9, west: -71.1 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Maryland',      group: 'us-state', bbox: { north: 39.7, south: 37.9, east: -75, west: -79.5 }, defaultMinZoom: 7, defaultMaxZoom: 13 },
  { name: 'Massachusetts', group: 'us-state', bbox: { north: 42.9, south: 41.2, east: -69.9, west: -73.5 }, defaultMinZoom: 8, defaultMaxZoom: 13 },
  { name: 'Michigan',      group: 'us-state', bbox: { north: 48.3, south: 41.7, east: -82.1, west: -90.4 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Minnesota',     group: 'us-state', bbox: { north: 49.4, south: 43.5, east: -89.5, west: -97.2 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Mississippi',   group: 'us-state', bbox: { north: 35, south: 30.2, east: -88.1, west: -91.7 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Missouri',      group: 'us-state', bbox: { north: 40.6, south: 36, east: -89.1, west: -95.8 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Montana',       group: 'us-state', bbox: { north: 49, south: 44.4, east: -104, west: -116.1 }, defaultMinZoom: 6, defaultMaxZoom: 12 },
  { name: 'Nebraska',      group: 'us-state', bbox: { north: 43, south: 40, east: -95.3, west: -104.1 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Nevada',        group: 'us-state', bbox: { north: 42, south: 35, east: -114, west: -120 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'New Hampshire', group: 'us-state', bbox: { north: 45.3, south: 42.7, east: -70.7, west: -72.6 }, defaultMinZoom: 8, defaultMaxZoom: 13 },
  { name: 'New Jersey',    group: 'us-state', bbox: { north: 41.4, south: 38.9, east: -73.9, west: -75.6 }, defaultMinZoom: 8, defaultMaxZoom: 13 },
  { name: 'New Mexico',    group: 'us-state', bbox: { north: 37, south: 31.3, east: -103, west: -109.1 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'New York',      group: 'us-state', bbox: { north: 45.1, south: 40.5, east: -71.9, west: -79.8 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'North Carolina', group: 'us-state', bbox: { north: 36.6, south: 33.8, east: -75.5, west: -84.3 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'North Dakota',  group: 'us-state', bbox: { north: 49, south: 45.9, east: -96.6, west: -104.1 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Ohio',          group: 'us-state', bbox: { north: 42, south: 38.4, east: -80.5, west: -84.8 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Oklahoma',      group: 'us-state', bbox: { north: 37, south: 33.6, east: -94.4, west: -103 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Oregon',        group: 'us-state', bbox: { north: 46.3, south: 41.9, east: -116.5, west: -124.6 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Pennsylvania',  group: 'us-state', bbox: { north: 42.3, south: 39.7, east: -74.7, west: -80.5 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Rhode Island',  group: 'us-state', bbox: { north: 42.1, south: 41.1, east: -71.1, west: -71.9 }, defaultMinZoom: 9, defaultMaxZoom: 14 },
  { name: 'South Carolina', group: 'us-state', bbox: { north: 35.2, south: 32, east: -78.5, west: -83.4 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'South Dakota',  group: 'us-state', bbox: { north: 46, south: 42.5, east: -96.4, west: -104.1 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Tennessee',     group: 'us-state', bbox: { north: 36.7, south: 35, east: -81.7, west: -90 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Texas',         group: 'us-state', bbox: { north: 36.5, south: 25.8, east: -93.5, west: -106.7 }, defaultMinZoom: 6, defaultMaxZoom: 11 },
  { name: 'Utah',          group: 'us-state', bbox: { north: 42, south: 37, east: -109, west: -114.1 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Vermont',       group: 'us-state', bbox: { north: 45.1, south: 42.7, east: -71.5, west: -73.4 }, defaultMinZoom: 8, defaultMaxZoom: 13 },
  { name: 'Virginia',      group: 'us-state', bbox: { north: 39.5, south: 36.5, east: -75.2, west: -83.7 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Washington',    group: 'us-state', bbox: { north: 49, south: 45.5, east: -116.9, west: -124.8 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'West Virginia', group: 'us-state', bbox: { north: 40.6, south: 37.2, east: -77.7, west: -82.6 }, defaultMinZoom: 7, defaultMaxZoom: 13 },
  { name: 'Wisconsin',     group: 'us-state', bbox: { north: 47, south: 42.5, east: -86.8, west: -92.9 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
  { name: 'Wyoming',       group: 'us-state', bbox: { north: 45, south: 41, east: -104.1, west: -111.1 }, defaultMinZoom: 7, defaultMaxZoom: 12 },
];

export const GROUP_LABELS: Record<OfflineRegion['group'], string> = {
  'country': 'Countries',
  'ca-province': 'Canadian Provinces & Territories',
  'us-state': 'US States',
};
