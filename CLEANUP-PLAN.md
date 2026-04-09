# MeasurePRO v16.1.0 — Cleanup & Polish Plan

**Prepared by Claude Code during overnight audit (2026-04-09)**

## DONE (this session)

- [x] POI types sorted alphabetically
- [x] Dead menu items removed (Live Monitor, Point Cloud, LiDAR HUD, 3D LiDAR)
- [x] GNSS tab renamed to "GPS/Duro"
- [x] Routes auto-load and persist when RouteManager modal closes
- [x] GNSS profiling removed entirely

## READY TO IMPLEMENT (next session)

### 1. GNSS Tab Deep Cleanup
**File:** `src/components/settings/GnssSettings.tsx` (1329 lines)
- Remove "Heavy Haul Safety Settings" section (banking thresholds, cross-slope) — this was profiling UI
- Remove `profileSettings` / `setProfileSettings` usage from useSettingsStore
- Remove GNSS simulator toggle (demo feature, not needed)
- Keep ONLY: Duro connection config, IMU toggle, diagnostics, calibration
- **Target:** reduce to ~400 lines

### 2. Tab Cleanup — Remove Unused/Gated Tabs
**File:** `src/components/TabManager.tsx`
Tabs to consider removing or hiding:
- `calibration` — gated behind 'calibration' feature (is anyone using it?)
- `detection` — Detection settings without AI+ is empty?
- `envelope` — gated behind 'envelope_clearance'
- `convoy` — gated behind 'convoy_guardian'
- `route` — gated behind 'route_enforcement'
- `swept-path` — gated behind 'swept_path_analysis'
- `ai-assistant` — AI chat (needs API key, verify it works)
**Decision needed:** Remove gated tabs entirely or keep them hidden?

### 3. Map Settings — Google + OSM Only
**File:** `src/components/settings/MapSettings.tsx`
- Keep only Google Maps and OpenStreetMap tile providers
- Remove any other tile providers (Mapbox, etc.)
- OSM works offline if tiles are cached prior to going offline
- Verify Google Maps API key works (it's in .env)

### 4. Camera Tab Cleanup for Electron
**File:** `src/components/CameraSettings.tsx`
- Remove web-only settings that don't apply to Electron
- Verify camera preview works with restored StandardCamera
- Clean up ZED 2i camera option (only show if available)

### 5. Voice Command — Verify No Feedback Loop
**Status:** Code review shows mute/unmute protection exists
- `VoiceAssistant.ts:90-98` — mutes recognizer before speaking, 800ms buffer after
- `SpeechRecognizer.ts:167-177` — isMuted flag checked in onresult handler
- **Need to test:** actually use voice commands and verify no loop occurs
- **Risk:** 800ms buffer might not be enough for slow TTS

### 6. Email Verification
**Status:** Email uses Microsoft Outlook via Replit connectors
- Works ONLY when backend server is running (measure-pro.app)
- Won't work offline in Electron
- Email types: Alert threshold, Survey completion, Support ticket
- **Test:** Send a test email from Email settings tab
- **Consider:** Show "Email requires internet connection" warning in Electron

### 7. Firebase Sync — Auto-send to RoadScope on Log Split
**Current:** Manual sync only (auto-sync disabled)
**Files:**
- `src/lib/firebase/autoSync.ts` — `onSurveyClose()` is intentionally no-op
- `src/lib/survey/AutoPartManager.ts` — handles log splitting
- `src/components/settings/RoadScopeSettings.tsx` — RoadScope config
**Plan:**
- When AutoPartManager splits a survey part, auto-sync the completed part
- Send to RoadScope API if configured
- Keep manual-only for Firebase cloud sync (avoid quota issues)

### 8. Route Navigation — Fix Crash
**Issue:** Clicking "Navigate this route" in RouteManager crashes
**Root cause:** RouteNavigator uses Leaflet Routing Machine which loads from `/vendor/lrm/`
**Fix:** Verify vendor files exist in dist, add error boundary around RouteNavigator

### 9. UI Polish — Make App More PRO
- Consistent card padding and borders
- Remove "toast suppressed" comments (50+ instances)
- Remove debug console.logs still remaining
- Clean up unused imports
- Consistent button styles across all cards

## ARCHITECTURE NOTES

### Tab Groups (current)
1. **Hardware** — Laser & GPS, Lateral/Rear, GPS/Duro, Camera, Calibration
2. **Detection** — Detection, AI+
3. **Premium** — Envelope, Convoy, Route, Swept Path
4. **Display** — Logo, Map, Display
5. **Data** — Logging, Alerts, Email, POI Actions, Sync, Field App, Backup
6. **System** — Voice, Keyboard, Developer, Admin, Company, Layout, Help, About

### GPS Priority Order (working)
1. Duro GNSS (RTK) — highest, via TCP/IPC
2. USB Serial GPS — NMEA via serial port
3. Bluetooth GPS
4. Browser Geolocation — failsafe

### Email System (requires internet)
- Microsoft Outlook via Replit connectors (server/services/emailService.ts)
- Admin BCC enforced server-side (admin@soltec.ca)
- Types: Alert, Survey Completion, Contact, Test

### Voice Commands (130+ registered)
- Echo prevention: mute mic → speak → wait 800ms → unmute
- Languages: en-US, fr-FR, es-ES
- Uses Web Speech API (needs internet for recognition)
