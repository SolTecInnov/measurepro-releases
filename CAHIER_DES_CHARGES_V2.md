# MeasurePRO v2 — Cahier des Charges Complet

**Date:** 2026-04-14  
**Auteur:** Jean-Francois Prince / Soltec Innovation  
**Objectif:** Réécriture complète de MeasurePRO — sortir du PWA/IndexedDB vers une architecture Electron-native avec SQLite

---

## 1. VISION & OBJECTIFS

### 1.1 Pourquoi la réécriture

L'architecture actuelle (PWA + IndexedDB + Web Serial/Bluetooth) atteint ses limites:

- **Performance:** IndexedDB ralentit après ~150 POIs (5-13 secondes par entrée)
- **Fiabilité:** Caches corrompues, React error #31 causé par des objets Firestore dans le DOM
- **Complexité:** Double-cache (IndexedDB + in-memory MeasurementFeed), workers pour contourner les limites du main thread
- **Hardware:** Web Serial/Bluetooth API sont des workarounds — Node.js serialport est natif et fiable
- **Offline:** Service worker + IndexedDB est fragile vs SQLite natif

### 1.2 Architecture cible v2

| Couche | Actuel (v1) | Cible (v2) |
|--------|-------------|------------|
| **Database locale** | IndexedDB (17 object stores) | SQLite via better-sqlite3 (synchrone, indexé) |
| **Cache** | In-memory MeasurementFeed + workers | Requêtes SQLite directes (< 1ms) |
| **Hardware** | Web Serial API + polyfill Electron | Node.js serialport natif dans main process |
| **GPS** | Web Bluetooth + HTTP polling | Node.js serialport + HTTP natif |
| **UI** | React 18 + Vite + Tailwind | React 18 + Vite + Tailwind (inchangé) |
| **État** | Zustand + React Query | Zustand (simplifié, alimenté par SQLite) |
| **Sync cloud** | IndexedDB → Firestore (fragile) | SQLite → Firestore (robuste, background) |
| **PWA** | Service worker + manifest | Supprimé — Electron pur |

### 1.3 Exigences de performance

- POI creation: **< 50ms** à 1000+ POIs
- Laser auto-log: **5-10 POIs/seconde** soutenu
- Export CSV 1000 POIs: **< 2 secondes**
- Démarrage app: **< 3 secondes**
- Mémoire max: **< 500MB** à 5000 POIs

---

## 2. INTÉGRATIONS HARDWARE

### 2.1 Laser Rangefinders

**Protocoles supportés:**

| Modèle | Baud | Format | Données |
|--------|------|--------|---------|
| SolTec Standard (30m, 70m, AR2700) | 115200, 8N1 | LDM71 ASCII | `D <distance> <amplitude>` |
| SolTec Legacy (10m) | 19200, 7E1 | LDM71 ASCII | Même format |
| Bosch GLM (Bluetooth) | BLE | Propriétaire | UUID: 02a6c0d0-... |

**Pipeline de données:**
```
Port série → LaserReader → LDM71AsciiDriver.feedBytes() → AmplitudeFilter → serialStore.setLastLaserData()
```

**Commandes laser:**
- `DM\r` — Mesure unique
- `DT\r` — Mesure continue
- `\x1B` — Stop
- `LE\r` / `LD\r` — Laser on/off
- `TP\r` — Température

**Modes de mesure:**
- Normal: 10 Hz, ±1-3mm
- Fast: 20 Hz, ±2-6mm
- Precise: 6 Hz, ±0.8-2.4mm
- Natural: 0.3 Hz, ±5-15mm

**Configuration stockée:**
- Profil hardware par utilisateur (VID/PID fingerprint)
- Auto-reconnect basé sur le profil sauvegardé
- Ground reference height (hauteur du laser au-dessus du sol)

### 2.2 GPS/GNSS

**Sources (par priorité):**

1. **Duro GNSS Bridge** — HTTP polling `http://<url>/api/gnss/live` (500ms interval)
   - Position + IMU (heading, roll, pitch) + DOP + constellations
   - Fix quality: No Fix, GPS Fix, GPS Fix (2D), DGPS, RTK Float, RTK Fixed
   
2. **USB Serial** — NMEA 0183 (4800-115200 baud)
   - Sentences: $GPGGA, $GPRMC, $GPGSV, $GNGGA, $GNRMC, $GNGSV
   
3. **Bluetooth** — NMEA via BLE (u-blox, Bad Elf, Garmin)

4. **Browser Geolocation** — Fallback après 10s sans hardware GPS

**Données GPS:**
```typescript
GPSData {
  latitude, longitude, altitude
  speed, course, satellites
  fixQuality: 'No Fix' | 'GPS Fix' | 'DGPS Fix' | 'RTK Float' | 'RTK Fixed'
  hdop, pdop, vdop
  source: 'serial' | 'browser' | 'duro' | 'bluetooth'
  imu?: { heading, roll, pitch, heaveRate } // Duro seulement
  constellations?: Record<string, { name, activePrns[] }>
}
```

### 2.3 Caméras

**Standard Camera:**
- MediaDevices API (`getUserMedia`)
- Résolution: 1280x720 (configurable)
- 30 FPS, JPEG capture
- Multi-position: front/left/right/rear (4 caméras USB)
- Overlay configurable: logo, timestamp, GPS, hauteur, heading

**Insta360 X5 (360°):**
- Protocole OSC (Open Spherical Camera) via USB-C réseau virtuel
- Adresse: `http://192.168.42.1:80`
- Commandes: startCapture, stopCapture, takePicture, getOptions
- Live preview MJPEG: `/livepreview/preview`
- Polling statut: 3s interval

**Enregistrement vidéo:**
- MediaRecorder API (WebM/VP9, fallback VP8)
- Buffer circulaire 5 secondes
- Segments 1 seconde pour découpe précise

**Timelapse:**
- Intervalle configurable (5s par défaut)
- Qualité JPEG 0-1
- Processing en background via worker

### 2.4 Drone Import (DJI)

- Détection USB automatique (polling 3s)
- Extraction images DCIM: EXIF GPS + XMP gimbal (pitch/roll/yaw)
- Groupement par proximité 20m
- Association aux POIs existants (rayon 50m)
- Stockage: `Documents/MeasurePRO/surveys/<surveyId>/drone/<poiId>/`

### 2.5 LiDAR / Point Cloud

- ZED 2i depth → projection 3D (intrinsèques caméra)
- Downsample 1-4x, filtre profondeur 0.3-20m
- Confidence > 50%
- Stockage: XYZ vertices + RGB colors + GPS georeference

### 2.6 Auto-reconnexion hardware

```typescript
HardwareProfile {
  laserFingerprint: { usbVendorId, usbProductId, portIndex }
  gpsFingerprint: { usbVendorId, usbProductId, portIndex }
  laserType, laserBaudRate, duroUrl
}
```
- Sauvegardé par utilisateur dans localStorage (`hw_profile_v1_<userId>`)
- Au démarrage: match VID/PID → auto-connect ou UI de sélection

---

## 3. MODÈLES DE DONNÉES

### 3.1 Survey (Enquête)

```typescript
Survey {
  id: string                     // UUID
  surveyTitle: string
  surveyorName: string
  clientName: string
  projectNumber: string
  originAddress: string
  destinationAddress: string
  description: string
  notes: string
  ownerEmail: string
  completionEmailList: string[]
  
  // État
  active: boolean
  roadNumber: number             // Route courante (commence à 1)
  createdAt: string              // ISO 8601
  closedAt?: string
  pausedAt?: string
  
  // Multi-parts (auto-split)
  rootSurveyId?: string          // ID du Part 1
  partOrdinal?: number           // Numéro de part
  partLabel?: string
  maxPoiPerPart?: number         // Seuil auto-split (défaut: 100)
  poiCount?: number
  closureReason?: 'completed' | 'continuation' | 'error' | 'end_of_day'
  
  // Cloud sync
  cloudUploadStatus: string
  syncId: string
  lastSyncedAt?: string
  
  // Convoy
  convoyId?: string
  fleetUnitRole?: string
  
  // AI
  aiUserModelId?: string
  aiHistoryScore?: number
}
```

### 3.2 Measurement (POI)

```typescript
Measurement {
  id: string                     // UUID
  user_id: string                // Survey ID
  
  // Hauteur
  rel: number | null             // Hauteur ajustée (raw + groundRef)
  groundRefM: number             // Référence sol
  
  // GPS
  latitude: number
  longitude: number
  altGPS: number
  speed: number                  // km/h
  heading: number                // degrés 0-360
  
  // Classification
  poi_type: string               // Type de POI (76 types)
  poiNumber: number              // Séquentiel dans le survey
  roadNumber: number             // Numéro de route
  source: 'manual' | 'all_data' | 'counter' | 'buffer'
  measurementFree?: boolean      // POI sans mesure hauteur
  
  // Média
  imageUrl?: string
  images?: string[]
  videoUrl?: string
  videoBlobId?: string
  videoTimestamp?: number
  timelapseFrameNumber?: number
  drawingUrl?: string
  
  // Mesures latérales
  leftClearance?: number
  rightClearance?: number
  totalWidth?: number
  rearDistance?: number
  widthMeasure?: number
  lengthMeasure?: number
  
  // Métadonnées
  note: string
  noGpsFix?: boolean
  utcDate: string                // YYYY-MM-DD
  utcTime: string                // HH:MM:SS
  createdAt: string              // ISO 8601
}
```

### 3.3 Autres tables IndexedDB à migrer vers SQLite

| Table actuelle | Records | Usage |
|---------------|---------|-------|
| surveys | ~10-50 | Metadata enquêtes |
| measurements | **100-5000+** | **POIs — table critique** |
| routes | ~1-10 | Routes du survey |
| alerts | ~0-100 | Alertes hauteur |
| vehicleTraces | ~1-5 | Traces GPS véhicule |
| voiceNotes | ~0-50 | Notes vocales |
| timelapses | ~0-5 | Séquences timelapse |
| frames | ~0-1000 | Frames pour crash recovery |
| roadProfiles | ~0-10 | Profils GNSS route |
| roadProfileSamples | ~0-10000 | Points d'échantillonnage |
| roadProfileEvents | ~0-100 | Événements grade/K-factor |
| processedPOIs | ~0-5000 | Déduplication POI |
| surveyMetadata | ~10-50 | Versioning mutations |
| surveyCheckpoints | ~0-50 | Health monitoring (chaque 10 min) |
| uploadQueue | ~0-20 | Queue upload cloud |
| appSettings | ~10-30 | Préférences utilisateur |

---

## 4. PIPELINE DE MESURE (CRITIQUE)

### 4.1 Modes de logging

**Manual (`manual`):**
- Utilisateur déclenche manuellement (bouton ou `Alt+G`)
- Utilise la dernière mesure laser disponible
- Ouvre optionnellement le modal d'entrée manuelle

**All Data (`all_data`):**
- **Chaque** lecture laser valide → 1 POI automatiquement
- Filtres: dédup, plage hauteur (4-25m par défaut), lectures invalides (DE02, sky)
- Skip si action POI = `auto-capture-no-measurement`, `voice-note`, `select-only`
- Image capturée async après la sauvegarde du POI

**Counter / Auto-Capture (`counter`):**
- Machine à états: ciel → objet → ciel → log
- Buffer les lectures pendant la phase objet
- Log la lecture **MINIMUM** après retour au ciel (timeout 500ms)
- Même filtrage hauteur et action que all_data
- Force-log après 3s sous objet ou 50m de déplacement

### 4.2 POI Actions (76 types)

| Action | Types POI | Comportement |
|--------|-----------|-------------|
| `auto-capture-and-log` | wire, powerLine, overpass, tunnel, signalization... (29 types) | Laser crée le POI automatiquement |
| `auto-capture-no-measurement` | road, bridge, culvert, intersection... (18 types) | Clavier/StreamDeck crée directement (pas de hauteur) |
| `open-manual-modal` | danger, information, workRequired... (12 types) | Ouvre le modal d'entrée manuelle |
| `voice-note` | voiceNote | Enregistrement vocal |
| `select-only` | — | Sélectionne le type, pas d'action |

**Overrides:**
- **Rain Mode:** `auto-capture-and-log` → `auto-capture-no-measurement` (pas de laser)
- **GPS-Only Survey:** Même downgrade, mais via KeyboardShortcutHandler
- **Beta users:** Overhead types → `auto-capture-no-measurement` (pas de laser)
- **Custom:** Utilisateur peut configurer l'action par type

### 4.3 Sauvegarde POI (savePOI)

```
1. Cache in-memory (MeasurementFeed.addMeasurement) → UI instant
2. Worker fire-and-forget (measurement-logger.worker) → IndexedDB async
3. Fallback direct (openSurveyDB.put) → Si worker échoue
4. Son de confirmation (soundManager.playLogEntry)
```

**v2 cible:**
```
1. SQLite INSERT synchrone (< 1ms) → UI instant
2. Pas de worker nécessaire — SQLite est synchrone dans le main process
3. Son de confirmation
```

### 4.4 Keyboard/StreamDeck

| Action POI | Via clavier | Résultat |
|------------|-------------|----------|
| `auto-capture-and-log` | `break;` — laser gère | Le hook useAllDataMode réagit aux lectures |
| `auto-capture-no-measurement` | `handleAutoCaptureNoMeasurement()` | Crée POI directement (GPS + photo) |
| `open-manual-modal` | `handleOpenModalWithPOIType()` | Ouvre modal |
| `voice-note` | `handleVoiceNoteRequested()` | Enregistrement vocal |

---

## 5. FONCTIONNALITÉS UI

### 5.1 Pages & Routes

**Application principale:**
- `/app` — Dashboard terrain (mesure, carte, caméra, logging)

**Pages publiques:**
- `/` — Landing page
- `/help`, `/blog`, `/features`, `/pricing`, `/contact`
- `/documentation`, `/docs/*` — Guides techniques
- `/manual` — Manuel utilisateur

**Auth:**
- `/login`, `/register`, `/signup`, `/forgot-password`
- `/verify`, `/verify-sms`, `/set-password`, `/awaiting-approval`

**Admin:**
- `/admin`, `/admin/accounts`, `/admin/companies`, `/admin/analytics`
- `/admin-licensing`, `/company-admin`
- `/pricing-management`, `/license-management`, `/subscription`

**Features avancées:**
- `/LiveMonitor` — Monitoring temps réel
- `/point-cloud-scanner` — Scan point cloud (feature-locked)
- `/lidar`, `/lidar/source` — Interface LiDAR
- `/convoy/leader`, `/convoy/join/:token` — Convoy Guardian
- `/route-enforcement/*` — Enforcement de route
- `/slave-app` — App esclave
- `/demo` — Démo

### 5.2 Layout

**Deux colonnes (défaut):**
- Gauche: Survey, mesures, logging controls, POI height rows
- Droite: Carte ou caméra (toggle)

**Trois colonnes (optionnel):**
- Gauche: Controls
- Centre: Carte
- Droite: Caméra

- Colonnes redimensionnables (drag)
- Cards collapsibles
- Zoom app: 80%-150%

### 5.3 76 Types de POI

**Catégories:**
- Infrastructure (bridge, overpass, tunnel, flyover, culvert, gate...)
- Power/Electrical (powerLine, highVoltage, wire...)
- Communication (opticalFiber, communicationCable, communicationCluster)
- Traffic/Signalization (trafficLight, signalization, trafficWire, trafficMast...)
- Signage/VMS (signMast, signTruss, vmsTruss, vmsMast)
- Toll (tollTruss, tollPlaza)
- Railroad (railroad, railroadMast, railroadTruss, railroadCrossing)
- Natural (tree, gravelRoad, unpavedRoad)
- Road Features (road, intersection, roundabout, parking, deadEnd...)
- Grades (gradeUp/Down 10-12%, 12-14%, 14%+)
- Turns (leftTurn, rightTurn, uTurn)
- Highway (highwayEntrance, highwayExit)
- Safety (danger, restricted, lateralObstruction, construction)
- Notes (voiceNote, logNote, clearNote, information, importantNote, workRequired)
- Measurements (pitch, roll)
- Multi-purpose (bridgeAndWires, overheadStructure, pipeRack, lightPole)

### 5.4 Raccourcis clavier (150+)

**Généraux:** Alt+1 capture, Alt+G log, Ctrl+Backspace delete, Alt+Shift+M modal  
**Modes:** Alt+M manual, Alt+A all-data, Alt+D detection, Alt+Shift+C counter  
**POI types:** Alt+B bridge, Alt+T tree, Alt+W wire, Alt+P powerLine...  
**Complex POI:** Alt+Shift+B bridgeAndWires, Ctrl+Alt+C communicationCable...  
**Caméra:** Alt+V video, Alt+Shift+R insta360, Alt+[ left, Alt+] right  
**StreamDeck:** Profil téléchargeable, mapping 1:1 avec les raccourcis

### 5.5 Modes spéciaux

**Rain Mode** (`Alt+R`):
- Tous les POI laser → log sans mesure hauteur
- GPS + photo enregistrés
- Banner bleu en haut

**GPS-Only Survey Mode** (`Alt+Shift+R`):
- TOUS les POI types sans laser
- Note auto: "NO VERTICAL CLEARANCE ASSESSMENT"
- Débloque auto-log/auto-capture sans laser connecté

**Drive Mode:**
- Fullscreen + always-on-top + kiosk
- Triple-tap badge pour sortir
- Protection fermeture accidentelle

### 5.6 Système d'alertes

- Alertes hauteur automatiques (seuil configurable)
- Envelope clearance: profil véhicule 3D (vert/jaune/rouge)
- Son configurable
- Log automatique des alertes dans le survey
- Seuils Ignore Below / Ignore Above

### 5.7 Modal d'entrée manuelle

- Champs: hauteur, largeur, longueur, roll, pitch
- Dropdown 76 types POI
- Capture photo + vidéo + dessin annoté + note vocale
- Commande vocale: "Bridge 4.5 meters"
- Auto-population depuis lecture laser courante

### 5.8 Carte

- Leaflet + OpenStreetMap
- Tracking véhicule temps réel
- POI markers colorés par type
- Clustering zoom-dépendant
- Vehicle trace polyline
- Route manager
- Mode fullscreen

### 5.9 Voix

- Web Speech API (Google)
- Commandes: "Log bridge", "Start recording", etc.
- Notes vocales attachées aux POIs
- Synthèse vocale feedback (optionnel)

---

## 6. BACKEND & CLOUD

### 6.1 Express Backend (port 3001)

**Endpoints principaux (60+):**
- Auth: login, register, forgot-password, verify
- Licensing: packages, user-licenses, feature-snapshot
- Subscriptions: create-payment (Square, $300), pause, cancel, unpause
- Email: contact, survey-completion, alert, export, live-monitor-qr
- Admin: users CRUD, companies CRUD, vouchers, terms, analytics
- Convoy: create, join, end, GPS tracking, incidents
- Route Enforcement: dispatch, driver, violations
- Data: upload-survey-package, export, GNSS profiles
- RoadScope: webhook member-changed

### 6.2 Firebase

**Collections Firestore:**
- `users/{uid}/surveys/{surveyId}` — Metadata survey
- `users/{uid}/surveys/{surveyId}/measurements/{poiId}` — POIs
- `liveMonitorFeeds` — Broadcasting temps réel
- `companies` — Gestion entreprises
- `convoySessions`, `convoyEvents` — Convoy Guardian

**Auth:** Firebase Authentication (email/password)  
**Storage:** Firebase Cloud Storage (images, ZIPs)  
**Live Monitor:** Heartbeat 60s, 50 dernières mesures, debounce 30s

### 6.3 PostgreSQL (Drizzle ORM)

**Tables admin/licensing:**
- customers, subscriptions, companies, company_members
- member_addon_overrides, hardware_vouchers
- activity_logs, login_logs
- terms_versions, terms_acceptances
- pricing, marketing_sections

**Tables métier:**
- swept_path_analyses, turn_simulations, vehicle_profiles
- route_enforcement_convoys, route_enforcement_members, route_incidents

### 6.4 ConvoyHub (WebSocket)

- Leader crée session → QR token
- Followers rejoignent via QR
- Temps réel: GPS, mesures, alertes, urgences
- Route enforcement: distance-to-route, violations, acknowledgment
- Événements logués dans convoyEvents

### 6.5 Sync offline

**Actuel:**
1. Tout écrit en IndexedDB d'abord
2. Queue de sync dans `firebase-sync-queue` IndexedDB
3. Sync manuelle ou sur reconnexion
4. Max 5 retries, backoff exponentiel
5. Circuit breaker 30s sur `resource-exhausted`

**v2 cible:**
1. Tout écrit en SQLite d'abord (synchrone)
2. Table `sync_queue` dans SQLite
3. Background sync automatique
4. Même stratégie retry

---

## 7. AI & DÉTECTION

### 7.1 Claude AI Assistant

- Clé API par utilisateur (pas de clé partagée)
- Modèles: claude-sonnet-4-6, claude-opus-4-6
- Tools structurés:
  - `day_review` — Validation POIs du jour
  - `week_review` — Métriques 7 jours
  - `history_review` — Analyse cross-survey
  - `query_pois` — Filtre POIs
  - `query_obstacles_nearby` — Requête spatiale (9 sources SolTec)
- Suivi coûts par session et par jour
- Preview → approbation utilisateur → apply

### 7.2 TensorFlow.js Detection

- Modèle COCO-SSD (MobileNetV2)
- Confidence minimum: 0.5
- Max 20 détections
- Throttle 333ms
- Mapping COCO → 13 types MeasurePRO

---

## 8. LICENSING & PAIEMENT

### 8.1 Features gated (44 total)

**Catégories:** CORE, PREMIUM, PROFESSIONAL, ENTERPRISE

**Features clés:**
- AI_DETECTION, ZED2I_SUPPORT, SWEPT_PATH_ANALYSIS
- CONVOY_GUARDIAN, ROUTE_ENFORCEMENT, GEOFENCING
- ADVANCED_EXPORT, CLOUD_SYNC, LIVE_MONITORING
- LASER_DISTANCE_METER, GPS_HARDWARE, POINT_CLOUD_SCANNING

### 8.2 Paiement

- Processeur: Square ($300 USD)
- Durée: 30 jours par activation
- Grace period: 30 jours avant suppression
- Master admin: `jfprince@soltec.ca` (bypass tout)

### 8.3 Offline licensing

- Snapshot features cachée côté client
- Expiration après 30 jours offline
- Protection anti-retour horloge (monotonic time floor)

---

## 9. EXPORT DE DONNÉES

### 9.1 Formats

**CSV:**
```
Date,Time,Height (m),Ground Ref (m),GPS Alt (m),Latitude,Longitude,Speed,Heading,Road,POI,Type,Note,Source
```

**JSON:** Array d'objets Measurement complets  
**GeoJSON:** FeatureCollection avec Points (coordonnées + propriétés)

### 9.2 Streaming export

- Generator: `getMeasurementsInChunks(surveyId, chunkSize=50)`
- Curseur IndexedDB natif pour éviter timeout transaction
- Compteur: `countMeasurementsForSurvey(surveyId)`
- Export orphelins séparé

### 9.3 Destinations

- Disque dur local (CSV obligatoire)
- Email (ownerEmail + completionEmailList)
- Firebase Cloud Storage
- RoadScope (API design routier)

---

## 10. WORKERS (v1) — À SIMPLIFIER EN v2

| Worker actuel | Raison d'être | v2 |
|---------------|---------------|-----|
| measurement-logger | Contourner IndexedDB main thread | **Supprimé** — SQLite synchrone |
| orchestrator | Coordination tâches longues | Simplifié |
| paginated-loader | Streaming données | **Supprimé** — SQLite pagination native |
| gps | Parsing NMEA | Garder (main process Node.js) |
| laser | Lecture série | **Supprimé** — main process natif |
| photo | Compression images | Garder |
| video | Encodage vidéo | Garder |
| timelapse | Assemblage frames | Garder |
| map | Tiles + clustering | Garder |
| error-recovery | Crash handling | Simplifié — SQLite est ACID |

---

## 11. ELECTRON (MAIN PROCESS)

### 11.1 IPC existants à conserver

**Hardware:**
- `laser.*` — connect, disconnect, sendCommand, onMeasurement
- `serial.*` — list, open, write, close, onData
- `insta360.*` — getStatus, startRecording, stopRecording, takePhoto
- `drone.*` — scan, preview, match, importGroup
- `duro.*` — connect, disconnect, getStatus, onData

**App:**
- `setActiveSurveyState`, `setDriveMode`, `getDriveMode`
- `getVersion`, `getPlatform`
- `writeFile`, `getAutoSavePath`, `pickSoundFile`
- `surveyFiles.list()`, `.read()`

**Auto-updater:**
- `updaterCheck`, `updaterInstallNow`, `updaterGetVersion`
- Events: onUpdateAvailable, onDownloadProgress, onUpdateDownloaded

### 11.2 Nouveaux IPC v2

- `db.query(sql, params)` — Requête SQLite
- `db.run(sql, params)` — Mutation SQLite
- `db.transaction(statements)` — Transaction multi-statements
- `db.export(surveyId, format)` — Export depuis main process

---

## 12. MIGRATION

### 12.1 Stratégie

1. **Développement parallèle** — v2 dans un nouveau repo/branche
2. **v1 maintenue** — Corrections de bugs pendant le développement v2
3. **Migration données** — Outil d'import IndexedDB → SQLite au premier lancement v2
4. **Feature parity** — Chaque feature validée avant release

### 12.2 Ordre de priorité

1. **SQLite + pipeline mesure** — Le coeur (performance critique)
2. **Hardware natif** — serialport, GPS, caméra
3. **UI/Logging modes** — Manual, All Data, Counter
4. **Export** — CSV, JSON, GeoJSON
5. **Survey management** — Create, close, parts, delete
6. **Carte + POI display** — Leaflet
7. **Firebase sync** — Cloud backup
8. **AI + détection** — Claude, TensorFlow
9. **Convoy + Route Enforcement** — WebSocket
10. **Admin + Licensing** — Backend

### 12.3 Risques

| Risque | Mitigation |
|--------|-----------|
| Régression features | Tests automatisés par feature |
| Performance SQLite avec blobs images | Images sur filesystem, référence en DB |
| Migration données utilisateur | Outil migration avec validation |
| Electron security (context isolation) | Garder preload + IPC pattern |
| better-sqlite3 packaging | electron-rebuild dans le build CI |

---

## 13. RÉSUMÉ QUANTITATIF

| Métrique | Valeur |
|----------|--------|
| Pages/routes | 50+ |
| Types de POI | 76 |
| Raccourcis clavier | 150+ |
| Tables de données | 17 (IndexedDB) + 15 (PostgreSQL) |
| Workers | 10 |
| Stores Zustand | 25+ |
| Endpoints API | 60+ |
| Features licensed | 44 |
| Intégrations hardware | 7 (laser, GPS, Duro, Bluetooth, Insta360, drone, LiDAR) |
| Formats export | 3 (CSV, JSON, GeoJSON) |
| Fichiers source | ~300+ |

---

*Ce document sert de référence complète pour la réécriture de MeasurePRO v2. Chaque feature, intégration, et workflow documenté ici doit être implémenté et validé dans la nouvelle version avant migration des utilisateurs.*
