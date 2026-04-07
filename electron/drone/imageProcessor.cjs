/**
 * DJI Image Processor
 * Extracts EXIF/XMP metadata from DJI photos
 * Uses piexifjs for EXIF and custom XMP parser for DJI gimbal data
 * No external tools required — pure Node.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Parse EXIF GPS rational value [degrees, minutes, seconds] to decimal
 */
function gpsRationalToDecimal(rational, ref) {
  if (!rational || rational.length < 3) return null;
  const deg = rational[0][0] / rational[0][1];
  const min = rational[1][0] / rational[1][1];
  const sec = rational[2][0] / rational[2][1];
  let decimal = deg + min / 60 + sec / 3600;
  if (ref === 'S' || ref === 'W') decimal = -decimal;
  return Math.round(decimal * 10000000) / 10000000; // 7 decimal places
}

/**
 * Parse DJI XMP data embedded in JPEG
 * DJI writes XMP data between <?xpacket ...> tags
 */
function extractDjiXmp(buffer) {
  const xmp = {};
  
  try {
    const str = buffer.toString('binary');
    
    // Find XMP packet
    const xmpStart = str.indexOf('<?xpacket begin');
    const xmpEnd = str.indexOf('<?xpacket end');
    if (xmpStart === -1 || xmpEnd === -1) return xmp;
    
    const xmpStr = str.slice(xmpStart, xmpEnd + 50);

    // Extract DJI-specific fields
    const fields = {
      'drone-dji:GimbalPitchDegree': 'gimbalPitch',
      'drone-dji:GimbalRollDegree': 'gimbalRoll',
      'drone-dji:GimbalYawDegree': 'gimbalYaw',
      'drone-dji:RelativeAltitude': 'relativeAltitude',
      'drone-dji:AbsoluteAltitude': 'absoluteAltitude',
      'drone-dji:FlightXSpeed': 'flightXSpeed',
      'drone-dji:FlightYSpeed': 'flightYSpeed',
      'drone-dji:FlightZSpeed': 'flightZSpeed',
      'drone-dji:CalibratedFocalLength': 'focalLength',
      'drone-dji:CalibratedOpticalCenterX': 'opticalCenterX',
      'drone-dji:CalibratedOpticalCenterY': 'opticalCenterY',
      'tiff:Make': 'make',
      'tiff:Model': 'model',
    };
    
    for (const [xmpKey, jsKey] of Object.entries(fields)) {
      // Match attribute format: drone-dji:GimbalPitchDegree="-45.20"
      const attrMatch = xmpStr.match(new RegExp(`${xmpKey.replace(':', ':')}="([^"]+)"`));
      if (attrMatch) {
        const val = parseFloat(attrMatch[1]);
        xmp[jsKey] = isNaN(val) ? attrMatch[1] : val;
        continue;
      }
      // Match element format: <drone-dji:GimbalPitchDegree>-45.20</drone-dji:GimbalPitchDegree>
      const elemMatch = xmpStr.match(new RegExp(`<${xmpKey}>([^<]+)</${xmpKey}>`));
      if (elemMatch) {
        const val = parseFloat(elemMatch[1]);
        xmp[jsKey] = isNaN(val) ? elemMatch[1] : val;
      }
    }
  } catch(e) {
    console.warn('[DroneImport] XMP parse error:', e.message);
  }
  
  return xmp;
}

/**
 * Extract EXIF data from JPEG buffer using manual parsing
 * Avoids piexifjs quirks with DJI files
 */
function extractExifBasic(buffer) {
  const exif = {};
  
  try {
    // Find EXIF marker (0xFFE1)
    let offset = 2; // Skip SOI marker
    while (offset < buffer.length - 4) {
      if (buffer[offset] === 0xFF && buffer[offset + 1] === 0xE1) {
        // Found APP1 marker
        const length = buffer.readUInt16BE(offset + 2);
        const app1 = buffer.slice(offset + 4, offset + 2 + length);
        
        // Check for Exif header
        if (app1.toString('ascii', 0, 4) === 'Exif') {
          const tiffOffset = 6;
          const isLittleEndian = app1[tiffOffset] === 0x49;
          
          const readUInt16 = (off) => isLittleEndian ? app1.readUInt16LE(off) : app1.readUInt16BE(off);
          const readUInt32 = (off) => isLittleEndian ? app1.readUInt32LE(off) : app1.readUInt32BE(off);
          
          // Read IFD0
          const ifd0Offset = tiffOffset + readUInt32(tiffOffset + 4);
          const ifd0Count = readUInt16(ifd0Offset);
          
          for (let i = 0; i < ifd0Count; i++) {
            const entryOffset = ifd0Offset + 2 + i * 12;
            const tag = readUInt16(entryOffset);
            const type = readUInt16(entryOffset + 2);
            const count = readUInt32(entryOffset + 4);
            
            if (tag === 0x010F) { // Make
              const valueOffset = readUInt32(entryOffset + 8);
              exif.make = app1.toString('ascii', tiffOffset + valueOffset, tiffOffset + valueOffset + count).replace(/\0/g, '');
            } else if (tag === 0x0110) { // Model
              const valueOffset = readUInt32(entryOffset + 8);
              exif.model = app1.toString('ascii', tiffOffset + valueOffset, tiffOffset + valueOffset + count).replace(/\0/g, '');
            }
          }
        }
        break;
      }
      offset++;
    }
  } catch(e) {}
  
  return exif;
}

/**
 * Extract GPS from JPEG using piexifjs
 */
function extractGpsWithPiexif(filePath) {
  try {
    const piexif = require('piexifjs');
    const data = fs.readFileSync(filePath).toString('binary');
    const exifObj = piexif.load(data);
    
    const gps = exifObj['GPS'];
    if (!gps) return null;
    
    const lat = gpsRationalToDecimal(
      gps[piexif.GPSIFD.GPSLatitude],
      gps[piexif.GPSIFD.GPSLatitudeRef]
    );
    const lon = gpsRationalToDecimal(
      gps[piexif.GPSIFD.GPSLongitude],
      gps[piexif.GPSIFD.GPSLongitudeRef]
    );
    
    if (!lat || !lon) return null;
    
    const altRef = gps[piexif.GPSIFD.GPSAltitudeRef];
    const altRational = gps[piexif.GPSIFD.GPSAltitude];
    let altitude = altRational ? altRational[0] / altRational[1] : 0;
    if (altRef === 1) altitude = -altitude; // Below sea level
    
    // DateTime
    const zerothIfd = exifObj['0th'];
    const dateTime = zerothIfd?.[piexif.ImageIFD.DateTime] || 
                     exifObj['Exif']?.[piexif.ExifIFD.DateTimeOriginal] || null;
    
    return { lat, lon, altitude, dateTime };
  } catch(e) {
    console.warn('[DroneImport] piexif GPS extraction failed:', e.message);
    return null;
  }
}

/**
 * Compute MD5 hash of file for deduplication
 */
function computeFileHash(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(data).digest('hex');
  } catch(e) { return null; }
}

/**
 * Main: Extract all metadata from a DJI JPEG
 */
function processImage(filePath) {
  const result = {
    filePath,
    filename: path.basename(filePath),
    fileSize: 0,
    fileHash: null,
    gps: null,
    xmp: {},
    make: null,
    model: null,
    captureTime: null,
    isDji: false,
    error: null,
  };

  try {
    const stat = fs.statSync(filePath);
    result.fileSize = stat.size;
    result.captureTime = stat.mtime.toISOString();

    // Read file buffer (first 128KB is enough for EXIF/XMP)
    const fd = fs.openSync(filePath, 'r');
    const headerBuffer = Buffer.alloc(Math.min(128 * 1024, stat.size));
    fs.readSync(fd, headerBuffer, 0, headerBuffer.length, 0);
    fs.closeSync(fd);

    // Extract XMP (DJI gimbal data)
    result.xmp = extractDjiXmp(headerBuffer);
    
    // Extract basic EXIF (make/model)
    const basicExif = extractExifBasic(headerBuffer);
    result.make = basicExif.make || result.xmp.make || null;
    result.model = basicExif.model || result.xmp.model || null;

    // Confirm DJI source
    result.isDji = !!(result.make?.toUpperCase().includes('DJI') || 
                      result.model?.toUpperCase().includes('DJI') ||
                      result.xmp.gimbalPitch !== undefined);

    // Extract GPS using piexifjs
    result.gps = extractGpsWithPiexif(filePath);

    // Compute hash for deduplication
    result.fileHash = computeFileHash(filePath);

  } catch(e) {
    result.error = e.message;
  }

  return result;
}

/**
 * Process a batch of images, skip non-DJI or no-GPS images
 */
function processBatch(filePaths, onProgress) {
  const results = [];
  const skipped = [];

  for (let i = 0; i < filePaths.length; i++) {
    if (onProgress) onProgress(i + 1, filePaths.length);
    
    const result = processImage(filePaths[i]);
    
    if (result.error) {
      skipped.push({ file: result.filename, reason: result.error });
      continue;
    }
    if (!result.gps) {
      skipped.push({ file: result.filename, reason: 'No GPS data' });
      continue;
    }
    
    results.push(result);
  }

  return { images: results, skipped };
}

module.exports = { processImage, processBatch, computeFileHash };
