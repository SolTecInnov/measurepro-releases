# RoadScope Sync — Technical Flow for Replit

## Overview

MeasurePRO syncs surveys to RoadScope in 6 phases. Photos are uploaded SEPARATELY from POI data — they go to signed S3 URLs first, then the storage URLs are included in POI payloads.

## Sync Phases

### Phase 1: API Key Validation
```
POST /api/roadscope/proxy/auth/validate
Body: { apiKey: "..." }
Response: { valid: true, userId: "...", scopes: ["surveys:read", "surveys:write", "pois:read", "pois:write", "files:upload"] }
```

### Phase 2: Survey Creation
```
POST /api/roadscope/proxy/surveys
Body: {
  externalId: "measurepro-survey-uuid",
  name: "Highway 101 Survey Part 1",
  companyId: "...",
  dataPhase: "field",
  status: "completed",
  metadata: { surveyorName, clientName, projectNumber, ... }
}
Response: { id: "roadscope-survey-id" }
```

### Phase 3: File Upload (PHOTOS)

This is the critical phase. Photos are uploaded in 3 steps:

**Step 3a: Get signed upload URLs**
```
POST /api/roadscope/proxy/surveys/{surveyId}/upload-urls
Body: {
  files: [
    { filename: "photo_001.jpg", contentType: "image/jpeg", size: 150000, category: "photos", poiExternalId: "poi-uuid-1" },
    { filename: "photo_002.jpg", contentType: "image/jpeg", size: 200000, category: "photos", poiExternalId: "poi-uuid-2" }
  ]
}
Response: {
  urls: [
    { filename: "photo_001.jpg", uploadUrl: "https://storage.googleapis.com/...?X-Goog-Signature=...", storagePath: "measurepro/{surveyId}/photos/{poiId}/photo_001.jpg" },
    { filename: "photo_002.jpg", uploadUrl: "https://storage.googleapis.com/...?X-Goog-Signature=...", storagePath: "measurepro/{surveyId}/photos/{poiId}/photo_002.jpg" }
  ]
}
```

**Step 3b: Upload files to signed URLs (direct to S3)**
```
PUT {uploadUrl}
Headers: { Content-Type: "image/jpeg" }
Body: <binary JPEG blob>
```

**Step 3c: Register files with RoadScope**
```
POST /api/roadscope/proxy/surveys/{surveyId}/files
Body: {
  files: [
    {
      filename: "photo_001.jpg",
      storageUrl: "measurepro/{surveyId}/photos/{poiId}/photo_001.jpg",
      category: "photos",
      contentType: "image/jpeg",
      size: 150000,
      linkedPoiExternalId: "poi-uuid-1"
    }
  ]
}
```

### Phase 4: POI Sync

```
POST /api/roadscope/proxy/surveys/{surveyId}/pois
Body: {
  pois: [
    {
      externalId: "poi-uuid-1",
      type: "wire",
      coordinates: { latitude: 45.5, longitude: -73.6, altitude: 145 },
      measurements: { heightClearance: 5.234, unit: "m" },
      photos: ["https://storage.googleapis.com/os-hub-db.firebasestorage.app/measurepro/{surveyId}/photos/{poiId}/photo_001.jpg"],
      note: "wire | 5.23m | GND:2.08m",
      capturedAt: "2026-04-15T12:00:00Z",
      source: "MeasurePRO"
    }
  ]
}
```

**CRITICAL:** The `photos` field contains STORAGE URLs (https://...), NOT base64 data URLs. RoadScope must fetch the photo from the storage URL to display it.

### Phase 5: Route/Trace Sync
```
POST /api/roadscope/proxy/surveys/{surveyId}/routes
Body: {
  routes: [
    {
      externalId: "route-uuid",
      name: "Vehicle Trace",
      geometry: { type: "LineString", coordinates: [[lon, lat], ...] }
    }
  ]
}
```

### Phase 6: Save sync state locally

## Photo Display on RoadScope

When RoadScope displays a POI, it should:
1. Read the `photos` array from the POI record
2. Each entry is a full HTTPS URL to Google Cloud Storage
3. Fetch/display the image from that URL

**If photos are missing, check:**
1. Are the `photos` field populated in the POI records RoadScope received?
2. Are the storage URLs valid and accessible?
3. Did the file upload phase (Phase 3) succeed? Check MeasurePRO console for `[RoadScope Sync]` logs
4. Is the GCS bucket (`os-hub-db.firebasestorage.app`) publicly readable for those paths?

## File Storage Path Convention

```
measurepro/{surveyId}/photos/{poiExternalId}/photo_001.jpg
measurepro/{surveyId}/drawings/{poiExternalId}/drawing_001.png
```

Full URL format:
```
https://storage.googleapis.com/os-hub-db.firebasestorage.app/measurepro/{surveyId}/photos/{poiExternalId}/photo_001.jpg
```

## POI Type Mapping

MeasurePRO types are mapped to RoadScope types via `mapPOIType()` in `syncService.ts`:
- wire → wire
- powerLine → power_line
- bridge → bridge
- overpass → overpass
- tree → vegetation
- road → road_segment
- etc.

Unmapped types are sent as-is with a `measurepro_` prefix.
