/**
 * DJI Drive Detector
 * Detects SD cards and USB-C connected DJI devices with DCIM folders
 * Works with both SD card readers and direct USB-C drone/RC+ connections
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Known DJI device names when connected via USB-C (Windows drive labels)
const DJI_DEVICE_LABELS = [
  'DJI RC Plus', 'DJI RC', 'DJI Mini 4 Pro', 'DJI Mini 3 Pro',
  'DJI Mini 3', 'DJI Air 3', 'DJI Air 2S', 'DJI Mavic 3',
  'DJI Mavic 3 Pro', 'NO NAME', // DJI SD cards often show as NO NAME
];

// DCIM subfolders used by DJI drones
const DJI_DCIM_PATTERNS = [
  'DCIM/100MEDIA',
  'DCIM/DJI_001',
  'DCIM/PANORAMA',
  'DCIM',
];

/**
 * Get all drive letters on Windows
 */
function getWindowsDrives() {
  try {
    const output = execSync('wmic logicaldisk get caption,drivetype,volumename /format:csv', {
      encoding: 'utf8', timeout: 5000
    });
    
    const drives = [];
    const lines = output.split('\n').filter(l => l.trim() && !l.startsWith('Node'));
    
    for (const line of lines) {
      const parts = line.trim().split(',');
      if (parts.length >= 4) {
        const caption = parts[1]?.trim();  // e.g. "D:"
        const driveType = parseInt(parts[2]?.trim()); // 2=removable, 3=fixed, 5=CD
        const volumeName = parts[3]?.trim() || '';
        
        if (caption && (driveType === 2 || driveType === 3)) {
          drives.push({ 
            letter: caption, 
            path: caption + '\\', 
            label: volumeName,
            isRemovable: driveType === 2
          });
        }
      }
    }
    return drives;
  } catch(e) {
    // Fallback: check common drive letters
    const drives = [];
    for (const letter of ['D','E','F','G','H','I','J','K']) {
      const drivePath = letter + ':\\';
      try {
        if (fs.existsSync(drivePath)) {
          drives.push({ letter: letter + ':', path: drivePath, label: '', isRemovable: true });
        }
      } catch(e2) {}
    }
    return drives;
  }
}

/**
 * Check if a drive has a DJI DCIM structure
 * Returns the DCIM folder path if found, null otherwise
 */
function findDjiDcimFolder(drivePath) {
  for (const pattern of DJI_DCIM_PATTERNS) {
    const dcimPath = path.join(drivePath, pattern.replace(/\//g, path.sep));
    try {
      if (fs.existsSync(dcimPath) && fs.statSync(dcimPath).isDirectory()) {
        // Check for at least one JPG file
        const files = fs.readdirSync(dcimPath);
        const hasJpeg = files.some(f => /\.(jpg|jpeg|dng)$/i.test(f));
        if (hasJpeg) return dcimPath;
      }
    } catch(e) {}
  }
  return null;
}

/**
 * Count DJI images in a DCIM folder
 */
function countDjiImages(dcimPath) {
  try {
    const files = fs.readdirSync(dcimPath);
    return files.filter(f => /\.(jpg|jpeg|dng)$/i.test(f)).length;
  } catch(e) { return 0; }
}

/**
 * Scan all drives for DJI devices
 * Returns array of detected DJI sources
 */
function scanForDjiDevices() {
  const drives = getWindowsDrives();
  const djiDevices = [];

  for (const drive of drives) {
    // Skip C: drive (system) unless it's labeled as DJI
    if (drive.letter === 'C:' && !DJI_DEVICE_LABELS.includes(drive.label)) continue;

    const dcimPath = findDjiDcimFolder(drive.path);
    if (!dcimPath) continue;

    const imageCount = countDjiImages(dcimPath);
    if (imageCount === 0) continue;

    // Determine device type from label
    let deviceType = 'DJI Drone SD Card';
    if (drive.label.includes('RC Plus') || drive.label.includes('RC+')) {
      deviceType = 'DJI RC+ Direct';
    } else if (drive.label.includes('RC')) {
      deviceType = 'DJI RC Direct';
    } else if (drive.label.startsWith('DJI')) {
      deviceType = drive.label + ' (USB-C)';
    }

    djiDevices.push({
      driveLetter: drive.letter,
      drivePath: drive.path,
      driveLabel: drive.label || 'Unnamed Drive',
      dcimPath,
      imageCount,
      deviceType,
      isRemovable: drive.isRemovable,
      detectedAt: new Date().toISOString(),
    });
  }

  return djiDevices;
}

/**
 * Get list of JPEG files in a DCIM path
 */
function getDjiImageFiles(dcimPath) {
  try {
    return fs.readdirSync(dcimPath)
      .filter(f => /\.(jpg|jpeg)$/i.test(f))
      .map(f => path.join(dcimPath, f))
      .sort(); // Sort by filename (DJI uses sequential numbering)
  } catch(e) { return []; }
}

module.exports = { scanForDjiDevices, getDjiImageFiles, findDjiDcimFolder };
