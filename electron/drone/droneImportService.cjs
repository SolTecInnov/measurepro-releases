/**
 * Drone Import Service
 * Orchestrates drive detection, image processing, POI matching, and file storage
 * All IPC handlers for the renderer
 */

const fs = require('fs');
const path = require('path');
const { app, ipcMain } = require('electron');
const { scanForDjiDevices, getDjiImageFiles } = require('./driveDetector.cjs');
const { processBatch, computeFileHash } = require('./imageProcessor.cjs');
const { groupImages, matchGroupsToPois } = require('./poiMatcher.cjs');

// Import deduplication: track hashes of already-imported files per session
const importedHashes = new Set();

// Polling interval for USB detection (ms)
const POLL_INTERVAL_MS = 3000;
let pollTimer = null;
let lastDetectedDrives = new Set();
let mainWindowRef = null;

/**
 * Get the drone images storage path for a survey
 */
function getDroneStoragePath(surveyId, poiId) {
  const docsPath = app.getPath('documents');
  return path.join(docsPath, 'MeasurePRO', 'surveys', surveyId, 'drone', poiId);
}

/**
 * Copy a drone image to survey storage and generate thumbnail
 */
async function copyImageToStorage(srcPath, surveyId, poiId, filename) {
  const destDir = getDroneStoragePath(surveyId, poiId);
  fs.mkdirSync(destDir, { recursive: true });
  
  const destPath = path.join(destDir, filename);
  const thumbPath = path.join(destDir, `thumb_${filename}`);
  
  // Copy original
  fs.copyFileSync(srcPath, destPath);
  
  // Generate thumbnail using sharp if available
  try {
    const sharp = require('sharp');
    await sharp(srcPath)
      .resize(400, null, { withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(thumbPath);
  } catch(e) {
    // sharp not available — use original as thumbnail
    fs.copyFileSync(srcPath, thumbPath);
  }
  
  return { destPath, thumbPath };
}

/**
 * Start watching for DJI devices (poll every 3s)
 */
function startDriveWatcher(mainWindow) {
  mainWindowRef = mainWindow;
  if (pollTimer) return;
  
  pollTimer = setInterval(() => {
    const devices = scanForDjiDevices();
    const currentDriveKeys = new Set(devices.map(d => d.driveLetter));
    
    // Detect NEW drives (not seen before)
    for (const device of devices) {
      if (!lastDetectedDrives.has(device.driveLetter)) {
        console.log('[DroneImport] New DJI device detected:', device.deviceType, device.driveLetter);
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('drone:device-detected', device);
        }
      }
    }
    
    // Detect REMOVED drives
    for (const oldKey of lastDetectedDrives) {
      if (!currentDriveKeys.has(oldKey)) {
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
          mainWindowRef.webContents.send('drone:device-removed', { driveLetter: oldKey });
        }
      }
    }
    
    lastDetectedDrives = currentDriveKeys;
  }, POLL_INTERVAL_MS);
  
  console.log('[DroneImport] Drive watcher started');
}

function stopDriveWatcher() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

/**
 * Scan for connected DJI devices
 */
ipcMain.handle('drone:scan', async () => {
  const devices = scanForDjiDevices();
  return devices;
});

/**
 * Preview images from a DJI device without importing
 * Returns metadata + GPS for all valid images
 */
ipcMain.handle('drone:preview', async (_event, { dcimPath }) => {
  const filePaths = getDjiImageFiles(dcimPath);
  if (filePaths.length === 0) return { images: [], skipped: [] };
  
  // Process in batches of 20 for performance
  const batchSize = 20;
  const allImages = [];
  const allSkipped = [];
  
  for (let i = 0; i < filePaths.length; i += batchSize) {
    const batch = filePaths.slice(i, i + batchSize);
    const { images, skipped } = processBatch(batch, (current, total) => {
      if (mainWindowRef && !mainWindowRef.isDestroyed()) {
        mainWindowRef.webContents.send('drone:progress', {
          phase: 'scanning',
          current: i + current,
          total: filePaths.length
        });
      }
    });
    allImages.push(...images);
    allSkipped.push(...skipped);
  }
  
  return { images: allImages, skipped: allSkipped, total: filePaths.length };
});

/**
 * Match processed images to survey POIs
 */
ipcMain.handle('drone:match', async (_event, { images, existingPois }) => {
  // Filter out already-imported images
  const newImages = images.filter(img => 
    !img.fileHash || !importedHashes.has(img.fileHash)
  );
  
  const groups = groupImages(newImages, 20);  // 20m grouping radius
  const matched = matchGroupsToPois(groups, existingPois || [], 50); // 50m association radius
  
  return { groups: matched, duplicatesSkipped: images.length - newImages.length };
});

/**
 * Import a confirmed group of images into a survey
 */
ipcMain.handle('drone:import-group', async (_event, { group, surveyId, poiId, poiType }) => {
  const imported = [];
  const failed = [];
  
  for (const img of group.images) {
    try {
      // Skip duplicates
      if (img.fileHash && importedHashes.has(img.fileHash)) {
        continue;
      }
      
      const { destPath, thumbPath } = await copyImageToStorage(
        img.filePath, surveyId, poiId, img.filename
      );
      
      // Mark as imported
      if (img.fileHash) importedHashes.add(img.fileHash);
      
      imported.push({
        originalPath: img.filePath,
        storedPath: destPath,
        thumbPath,
        filename: img.filename,
        gps: img.gps,
        gimbal: {
          pitch: img.xmp?.gimbalPitch ?? null,
          roll:  img.xmp?.gimbalRoll  ?? null,
          yaw:   img.xmp?.gimbalYaw   ?? null,
        },
        altitude: {
          relative: img.xmp?.relativeAltitude ?? null,
          absolute: img.xmp?.absoluteAltitude ?? img.gps?.altitude ?? null,
        },
        droneModel: img.model || 'DJI Drone',
        captureTime: img.captureTime,
        originalFilename: img.filename,
        poiId,
        source: 'drone',
        fileHash: img.fileHash,
      });
    } catch(e) {
      failed.push({ file: img.filename, error: e.message });
    }
  }
  
  return { imported, failed, poiId };
});

/**
 * Get import history for current session
 */
ipcMain.handle('drone:get-history', async () => {
  return { importedCount: importedHashes.size };
});

/**
 * Clear session import history (allow re-import of same SD card)
 */
ipcMain.handle('drone:clear-history', async () => {
  importedHashes.clear();
  return { ok: true };
});

module.exports = { startDriveWatcher, stopDriveWatcher };
