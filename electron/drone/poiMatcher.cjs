/**
 * POI Matcher
 * Groups drone images by proximity and matches them to existing survey POIs
 */

/**
 * Haversine distance between two GPS points (meters)
 */
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/**
 * Compute centroid of a group of GPS points
 */
function computeCentroid(images) {
  const lats = images.map(i => i.gps.lat);
  const lons = images.map(i => i.gps.lon);
  return {
    lat: lats.reduce((a,b) => a+b, 0) / lats.length,
    lon: lons.reduce((a,b) => a+b, 0) / lons.length,
  };
}

/**
 * Group images that are within groupRadius meters of each other
 * Uses simple greedy clustering
 */
function groupImages(images, groupRadiusM = 20) {
  const ungrouped = [...images];
  const groups = [];

  while (ungrouped.length > 0) {
    const seed = ungrouped.shift();
    const group = [seed];

    // Find all images within groupRadius of the seed
    for (let i = ungrouped.length - 1; i >= 0; i--) {
      const img = ungrouped[i];
      const dist = distanceMeters(
        seed.gps.lat, seed.gps.lon,
        img.gps.lat, img.gps.lon
      );
      if (dist <= groupRadiusM) {
        group.push(img);
        ungrouped.splice(i, 1);
      }
    }

    groups.push(group);
  }

  return groups;
}

/**
 * Match image groups to existing POIs
 * Returns array of import groups with matched or new POI info
 */
function matchGroupsToPois(imageGroups, existingPois, associateRadiusM = 50) {
  return imageGroups.map((images, idx) => {
    const centroid = computeCentroid(images);
    
    // Find nearest existing POI within associateRadius
    let matchedPoi = null;
    let minDist = Infinity;

    for (const poi of existingPois) {
      if (!poi.latitude || !poi.longitude) continue;
      const dist = distanceMeters(
        centroid.lat, centroid.lon,
        poi.latitude, poi.longitude
      );
      if (dist < minDist && dist <= associateRadiusM) {
        minDist = dist;
        matchedPoi = { ...poi, distanceM: Math.round(dist) };
      }
    }

    // Get altitude range for this group
    const alts = images
      .map(i => i.xmp?.absoluteAltitude || i.gps?.altitude)
      .filter(Boolean);
    const altMin = alts.length ? Math.min(...alts) : null;
    const altMax = alts.length ? Math.max(...alts) : null;

    // Get gimbal angles range
    const pitches = images.map(i => i.xmp?.gimbalPitch).filter(v => v !== undefined);

    return {
      groupId: `drone_group_${idx + 1}`,
      images,
      centroid,
      imageCount: images.length,
      altitudeRange: altMin !== null ? { min: altMin.toFixed(1), max: altMax.toFixed(1) } : null,
      gimbalPitchRange: pitches.length ? { 
        min: Math.min(...pitches).toFixed(1), 
        max: Math.max(...pitches).toFixed(1) 
      } : null,
      matchedPoi,       // null = create new Drone POI
      suggestedName: matchedPoi 
        ? `${matchedPoi.poi_type || 'Structure'} — ${matchedPoi.poiNumber || ''}`
        : `Drone Inspection ${idx + 1}`,
    };
  });
}

module.exports = { groupImages, matchGroupsToPois, distanceMeters };
