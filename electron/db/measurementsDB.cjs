/**
 * MeasurePRO — SQLite measurements database
 * Local-first, sync to Firebase async
 *
 * Tables:
 *   measurements — all POI records
 *   surveys      — survey sessions
 *   settings     — key/value settings store
 *
 * RPLIDAR columns reserved for future use (not null, default null)
 */

const path = require('path');
const { app } = require('electron');

let db = null;
let Database = null;

function getDbPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'measurepro.db');
}

function initDB() {
  if (db) return db;
  
  try {
    Database = require('better-sqlite3');
  } catch (e) {
    console.warn('[DB] better-sqlite3 not available, falling back to IndexedDB mode');
    return null;
  }

  const dbPath = getDbPath();
  db = new Database(dbPath);
  
  // Performance settings
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      surveyor_name TEXT,
      client_name TEXT,
      project_number TEXT,
      road_number INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT,
      firebase_synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS measurements (
      id TEXT PRIMARY KEY,
      survey_id TEXT NOT NULL REFERENCES surveys(id),
      poi_type TEXT,
      poi_number INTEGER,
      road_number INTEGER,
      
      -- Laser measurement
      height_m REAL,           -- adjusted height (laser + ground ref)
      height_raw_m REAL,       -- raw laser reading
      ground_ref_m REAL DEFAULT 0,
      height_min_m REAL,       -- min in buffer session
      height_avg_m REAL,       -- avg in buffer session
      reading_count INTEGER DEFAULT 1,
      
      -- GPS at moment of capture (start of buffer)
      latitude REAL,
      longitude REAL,
      altitude_gps REAL,
      speed_kmh REAL,
      heading_deg REAL,
      gps_source TEXT,         -- 'duro', 'browser', 'serial'
      gps_fix_quality TEXT,    -- 'RTK Fixed', 'GPS Fix', etc.
      
      -- RPLIDAR (future — reserved columns)
      rplidar_height_top_m REAL,
      rplidar_clear_left_m REAL,
      rplidar_clear_right_m REAL,
      rplidar_profile_json TEXT,  -- full 360° scan points as JSON
      
      -- Timestamps
      utc_date TEXT NOT NULL,
      utc_time TEXT NOT NULL,
      created_at TEXT NOT NULL,
      
      -- Media
      image_url TEXT,
      images_json TEXT,        -- JSON array of image URLs
      video_timestamp INTEGER,
      
      -- Metadata
      note TEXT,
      source TEXT DEFAULT 'manual',  -- 'manual', 'all_data', 'counter', 'buffer'
      logging_mode TEXT,
      
      -- Sync
      synced_at TEXT,
      firebase_synced INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_measurements_survey ON measurements(survey_id);
    CREATE INDEX IF NOT EXISTS idx_measurements_created ON measurements(created_at);
    CREATE INDEX IF NOT EXISTS idx_measurements_type ON measurements(poi_type);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  console.log('[DB] SQLite initialized at:', dbPath);
  return db;
}

// ── Measurements ──────────────────────────────────────────────────────────────

function saveMeasurement(m) {
  const db = initDB();
  if (!db) return false;
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO measurements (
      id, survey_id, poi_type, poi_number, road_number,
      height_m, height_raw_m, ground_ref_m, height_min_m, height_avg_m, reading_count,
      latitude, longitude, altitude_gps, speed_kmh, heading_deg, gps_source, gps_fix_quality,
      rplidar_height_top_m, rplidar_clear_left_m, rplidar_clear_right_m, rplidar_profile_json,
      utc_date, utc_time, created_at,
      image_url, images_json, video_timestamp,
      note, source, logging_mode, firebase_synced
    ) VALUES (
      @id, @survey_id, @poi_type, @poi_number, @road_number,
      @height_m, @height_raw_m, @ground_ref_m, @height_min_m, @height_avg_m, @reading_count,
      @latitude, @longitude, @altitude_gps, @speed_kmh, @heading_deg, @gps_source, @gps_fix_quality,
      @rplidar_height_top_m, @rplidar_clear_left_m, @rplidar_clear_right_m, @rplidar_profile_json,
      @utc_date, @utc_time, @created_at,
      @image_url, @images_json, @video_timestamp,
      @note, @source, @logging_mode, 0
    )
  `);
  
  try {
    stmt.run({
      id: m.id,
      survey_id: m.surveyId || m.user_id,
      poi_type: m.poi_type || null,
      poi_number: m.poiNumber || null,
      road_number: m.roadNumber || 1,
      height_m: m.rel || null,
      height_raw_m: m.height_raw_m || null,
      ground_ref_m: m.ground_ref_m || 0,
      height_min_m: m.height_min_m || null,
      height_avg_m: m.height_avg_m || null,
      reading_count: m.reading_count || 1,
      latitude: m.latitude || null,
      longitude: m.longitude || null,
      altitude_gps: m.altGPS || null,
      speed_kmh: m.speed || null,
      heading_deg: m.heading || null,
      gps_source: m.gps_source || null,
      gps_fix_quality: m.gps_fix_quality || null,
      rplidar_height_top_m: m.rplidar_height_top_m || null,
      rplidar_clear_left_m: m.rplidar_clear_left_m || null,
      rplidar_clear_right_m: m.rplidar_clear_right_m || null,
      rplidar_profile_json: m.rplidar_profile_json || null,
      utc_date: m.utcDate || new Date().toISOString().split('T')[0],
      utc_time: m.utcTime || new Date().toTimeString().split(' ')[0],
      created_at: m.createdAt || new Date().toISOString(),
      image_url: m.imageUrl || null,
      images_json: m.images ? JSON.stringify(m.images) : null,
      video_timestamp: m.videoTimestamp || null,
      note: m.note || null,
      source: m.source || 'manual',
      logging_mode: m.logging_mode || null,
    });
    return true;
  } catch (e) {
    console.error('[DB] saveMeasurement error:', e.message);
    return false;
  }
}

function getMeasurementsBySurvey(surveyId, limit = 10000) {
  const db = initDB();
  if (!db) return [];
  return db.prepare(
    'SELECT * FROM measurements WHERE survey_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(surveyId, limit);
}

function getNextPoiNumber(surveyId) {
  const db = initDB();
  if (!db) return 1;
  const row = db.prepare(
    'SELECT MAX(poi_number) as max_num FROM measurements WHERE survey_id = ?'
  ).get(surveyId);
  return (row?.max_num || 0) + 1;
}

// ── Settings ──────────────────────────────────────────────────────────────────

function getSetting(key, defaultValue = null) {
  const db = initDB();
  if (!db) return defaultValue;
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return defaultValue;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function setSetting(key, value) {
  const db = initDB();
  if (!db) return;
  db.prepare(
    'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)'
  ).run(key, JSON.stringify(value), new Date().toISOString());
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function initDBHandlers(ipcMain) {
  ipcMain.handle('db:save-measurement', (_e, m) => saveMeasurement(m));
  ipcMain.handle('db:get-measurements', (_e, surveyId, limit) => getMeasurementsBySurvey(surveyId, limit));
  ipcMain.handle('db:next-poi-number', (_e, surveyId) => getNextPoiNumber(surveyId));
  ipcMain.handle('db:get-setting', (_e, key, def) => getSetting(key, def));
  ipcMain.handle('db:set-setting', (_e, key, val) => { setSetting(key, val); return true; });
  
  console.log('[DB] IPC handlers registered');
}

module.exports = { initDB, saveMeasurement, getMeasurementsBySurvey, getNextPoiNumber, getSetting, setSetting, initDBHandlers };
