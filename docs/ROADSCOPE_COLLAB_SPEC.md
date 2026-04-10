# RoadScope Collaborative Survey — Feature Spec

**Date:** 2026-04-10
**Status:** Design

---

## Overview

Enable real-time collaborative surveying: field surveyors collect data with MeasurePRO, office staff monitor and work on the same RoadScope map simultaneously. Data syncs every 500 POIs or 1 hour automatically.

---

## Workflow

### 1. Office Preparation (RoadScope Web)
1. Office user creates a "Book Survey" in RoadScope with a preparation map
2. RoadScope generates a **Survey Pairing Code** (e.g. `RS-A7K9X2`)
3. Office user shares the code with the field surveyor

### 2. Field Survey Start (MeasurePRO)
1. Surveyor opens MeasurePRO → "New Survey"
2. App asks: **"Create new survey or pair with existing RoadScope survey?"**
   - **New** → Normal flow (creates survey locally)
   - **Pair with RoadScope** → Enter pairing code → App verifies code via RoadScope API → Links local survey to remote RoadScope survey
3. Paired surveys show a cloud icon + sync status indicator

### 3. During Survey (Auto-Sync)
- Every **500 POIs** or **1 hour** (whichever comes first):
  - MeasurePRO packages current data (POIs, images, traces, routes)
  - Pushes to RoadScope via API as an incremental sync
  - Office users see new data appear on the RoadScope map in near-real-time
- Each sync is a "part" (part-0, part-1, part-2...) — same as auto-part system
- Sync happens in background — never blocks the surveyor
- Failed syncs queue and retry on next interval

### 4. End of Day (Upload Verification)
- When surveyor closes the app or clicks "End Day":
  - App checks ALL parts (part-0 through part-N) have been uploaded to RoadScope
  - Shows a checklist: Part 1 ✅, Part 2 ✅, Part 3 ❌ (retry button)
  - Won't fully close until all parts confirmed or user explicitly skips
  - Also checks: survey metadata synced, route data synced, vehicle traces synced

### 5. Office Collaboration (RoadScope Web)
- Multiple collaborators can be added to a RoadScope survey
- Each sees field data appear as it syncs
- Office users can add annotations, classifications, notes on the same map
- Field data is read-only for office users (can't modify field measurements)

---

## Architecture

### MeasurePRO Side (Electron App)

```
Survey Creation
    │
    ├─ New Survey (local only)
    │
    └─ Pair with RoadScope
         │
         ├─ Enter pairing code
         ├─ GET /api/roadscope/proxy/surveys/pair/{code}
         │   → Returns: surveyId, surveyName, surveyConfig
         ├─ Link local survey to remote surveyId
         └─ Start auto-sync timer

Auto-Sync Timer
    │
    ├─ Triggers on: 500 POIs since last sync OR 1 hour elapsed
    ├─ Collects: new POIs, images, traces since last sync
    ├─ POST /api/roadscope/proxy/surveys/{id}/sync
    │   → Sends: { pois[], images[], traces[], partNumber }
    ├─ Updates sync state: lastSyncAt, lastSyncPOICount
    └─ On failure: queues for retry, shows warning badge

End-of-Day Verification
    │
    ├─ GET /api/roadscope/proxy/surveys/{id}/sync-status
    │   → Returns: { parts: [{partNumber, poiCount, uploaded, verified}] }
    ├─ Shows verification checklist UI
    ├─ Retry button for failed parts
    └─ "All uploaded" confirmation before closing
```

### RoadScope Backend (Replit)

New endpoints needed:

```
POST   /api/surveys/prepare
  → Creates survey from preparation map
  → Generates pairing code
  → Returns: { surveyId, pairingCode }

GET    /api/surveys/pair/{code}
  → Validates pairing code
  → Returns: { surveyId, surveyName, config, collaborators }

POST   /api/surveys/{id}/sync
  → Receives incremental data from MeasurePRO
  → Body: { partNumber, pois[], routes[], traces[], images[] }
  → Merges into existing survey data
  → Notifies connected collaborators via WebSocket/SSE

GET    /api/surveys/{id}/sync-status
  → Returns upload status for all parts
  → { parts: [{ part: 1, poiCount: 500, uploaded: true, at: "..." }] }

POST   /api/surveys/{id}/collaborators
  → Add/remove collaborators
  → Body: { email, role: "viewer" | "editor" }

WebSocket /ws/surveys/{id}/live
  → Real-time updates for collaborators
  → Pushes: new POIs, status changes, sync events
```

### Database Schema (RoadScope PostgreSQL)

```sql
-- Survey pairing codes
ALTER TABLE surveys ADD COLUMN pairing_code VARCHAR(10) UNIQUE;
ALTER TABLE surveys ADD COLUMN pairing_code_created_at TIMESTAMP;
ALTER TABLE surveys ADD COLUMN pairing_code_expires_at TIMESTAMP;

-- Sync tracking
CREATE TABLE survey_sync_parts (
  id SERIAL PRIMARY KEY,
  survey_id UUID REFERENCES surveys(id),
  part_number INTEGER NOT NULL,
  poi_count INTEGER DEFAULT 0,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  data_hash VARCHAR(64),
  UNIQUE(survey_id, part_number)
);

-- Collaborators
CREATE TABLE survey_collaborators (
  id SERIAL PRIMARY KEY,
  survey_id UUID REFERENCES surveys(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(20) DEFAULT 'viewer',
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(survey_id, user_id)
);
```

---

## MeasurePRO Implementation Plan

### Phase 1: Survey Pairing (can ship now)
- [ ] Add "Pair with RoadScope" option in survey creation dialog
- [ ] Pairing code input + validation UI
- [ ] Store `roadscopeSurveyId` and `roadscopePairingCode` on local survey
- [ ] Cloud sync icon in survey header when paired

### Phase 2: Auto-Sync Timer
- [ ] Create `RoadScopeAutoSyncService` — watches POI count + elapsed time
- [ ] Incremental sync: only send POIs added since last sync
- [ ] Background sync with progress indicator (non-blocking)
- [ ] Sync failure queue + retry logic

### Phase 3: End-of-Day Verification
- [ ] "Upload Verification" dialog shown on survey close / app exit
- [ ] Fetches sync-status from RoadScope API
- [ ] Checklist UI with retry buttons for failed parts
- [ ] Block close until verified or user explicitly skips

### Phase 4: Real-Time Collaboration
- [ ] WebSocket connection to RoadScope for live updates
- [ ] Office users see new POIs appear on map in real-time
- [ ] Collaborator management in RoadScope web UI

---

## Replit Backend Prompt

Copy this prompt to Replit to implement the RoadScope backend endpoints:

---

### PROMPT FOR REPLIT

```
I need you to add the following endpoints to the RoadScope Express API for collaborative survey support with MeasurePRO field app.

## Context
MeasurePRO is a field surveying app that captures POIs (Points of Interest) with laser measurements, GPS coordinates, and images. RoadScope is a web platform for viewing and managing survey data on maps. We want field surveyors using MeasurePRO to sync their data to RoadScope in near-real-time so office staff can see it.

## New Endpoints Needed

### 1. POST /api/surveys/prepare
Creates a new survey from a preparation/planning map and generates a pairing code.

Request:
{
  "name": "Highway 401 Bridge Survey",
  "description": "Bridge clearance assessment",
  "region": { "lat": 45.5, "lng": -73.5, "radius": 50 },
  "createdBy": "userId"
}

Response:
{
  "success": true,
  "data": {
    "surveyId": "uuid",
    "pairingCode": "RS-A7K9X2",
    "expiresAt": "2026-04-17T00:00:00Z"
  }
}

Pairing code format: "RS-" + 6 alphanumeric chars (uppercase).
Expires after 7 days. Stored in surveys table.

### 2. GET /api/surveys/pair/:code
Validates a pairing code and returns survey info for the field app.

Response (success):
{
  "success": true,
  "data": {
    "surveyId": "uuid",
    "surveyName": "Highway 401 Bridge Survey",
    "description": "...",
    "createdBy": "userId",
    "collaborators": [{ "email": "office@company.com", "role": "editor" }]
  }
}

Response (invalid/expired):
{ "success": false, "error": "Invalid or expired pairing code" }

### 3. POST /api/surveys/:id/sync
Receives incremental data from MeasurePRO. Called every 500 POIs or 1 hour.
Must be idempotent (same partNumber = update, not duplicate).

Request:
{
  "partNumber": 3,
  "pois": [
    {
      "id": "uuid",
      "type": "bridge",
      "latitude": 45.5,
      "longitude": -73.5,
      "measurements": { "heightClearance": 4.2 },
      "imageUrl": "base64 or signed URL",
      "timestamp": "2026-04-10T14:30:00Z",
      "note": "Low clearance"
    }
  ],
  "routes": [...],
  "traces": [...],
  "metadata": {
    "surveyorId": "userId",
    "deviceId": "machineId",
    "syncedAt": "2026-04-10T14:35:00Z",
    "totalPOIsSoFar": 1500
  }
}

Response:
{
  "success": true,
  "data": {
    "partNumber": 3,
    "poisReceived": 500,
    "poisTotal": 1500,
    "syncId": "uuid"
  }
}

This should:
- Upsert POIs (by id) — don't create duplicates
- Track the sync part in survey_sync_parts table
- Emit a real-time event to connected collaborators (if WebSocket is available, otherwise just update DB)

### 4. GET /api/surveys/:id/sync-status
Returns upload verification status for all parts.

Response:
{
  "success": true,
  "data": {
    "surveyId": "uuid",
    "totalParts": 5,
    "totalPOIs": 2347,
    "parts": [
      { "partNumber": 0, "poiCount": 500, "uploaded": true, "uploadedAt": "..." },
      { "partNumber": 1, "poiCount": 500, "uploaded": true, "uploadedAt": "..." },
      { "partNumber": 2, "poiCount": 500, "uploaded": true, "uploadedAt": "..." },
      { "partNumber": 3, "poiCount": 500, "uploaded": true, "uploadedAt": "..." },
      { "partNumber": 4, "poiCount": 347, "uploaded": false }
    ],
    "allUploaded": false
  }
}

### 5. POST /api/surveys/:id/collaborators
Add or remove collaborators.

Request:
{ "email": "colleague@company.com", "role": "viewer" }

### Database Changes
Add to the surveys table:
- pairing_code VARCHAR(10) UNIQUE
- pairing_code_created_at TIMESTAMP
- pairing_code_expires_at TIMESTAMP

Create survey_sync_parts table:
- id SERIAL PRIMARY KEY
- survey_id UUID REFERENCES surveys(id)
- part_number INTEGER NOT NULL
- poi_count INTEGER DEFAULT 0
- uploaded_at TIMESTAMP DEFAULT NOW()
- verified BOOLEAN DEFAULT FALSE
- data_hash VARCHAR(64)
- UNIQUE(survey_id, part_number)

Create survey_collaborators table:
- id SERIAL PRIMARY KEY  
- survey_id UUID REFERENCES surveys(id)
- user_id UUID (or email VARCHAR)
- role VARCHAR(20) DEFAULT 'viewer'
- added_at TIMESTAMP DEFAULT NOW()

### Auth
All endpoints require the same Bearer token auth (mpro_ API key) that existing RoadScope endpoints use. The /pair/:code endpoint is the only one that doesn't require a pre-existing survey link — it's how the link is established.

### Important
- sync endpoint must be idempotent on partNumber
- pairing codes expire after 7 days
- all POI upserts should be by POI id (not insert — upsert)
```

---

## Timeline Estimate

| Phase | Scope | Depends On |
|-------|-------|------------|
| Phase 1 | MeasurePRO pairing UI | Replit: /prepare, /pair |
| Phase 2 | Auto-sync timer | Replit: /sync |
| Phase 3 | End-of-day verification | Replit: /sync-status |
| Phase 4 | Real-time collab | Replit: WebSocket |
