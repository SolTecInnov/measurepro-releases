const R_EARTH = 6371000;

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.asin(Math.sqrt(a));
  return R_EARTH * c;
}

export type Cluster = {
  minD: number;
  points: Array<{ s: number; d: number; t: number; lat: number; lon: number }>;
};

export function clusterByHeight(
  points: Array<{ s: number; d: number; t: number; lat: number; lon: number }>,
  minSep: number
): Cluster[] {
  if (points.length === 0) return [];
  
  const sorted = [...points].sort((a, b) => a.d - b.d);
  const clusters: Cluster[] = [];
  
  let currentCluster: Cluster = {
    minD: sorted[0].d,
    points: [sorted[0]]
  };
  
  for (let i = 1; i < sorted.length; i++) {
    const point = sorted[i];
    const lastInCluster = currentCluster.points[currentCluster.points.length - 1];
    
    if (point.d - lastInCluster.d <= minSep) {
      currentCluster.points.push(point);
    } else {
      clusters.push(currentCluster);
      currentCluster = {
        minD: point.d,
        points: [point]
      };
    }
  }
  
  clusters.push(currentCluster);
  return clusters;
}

export function partitionCorridors(
  points: Array<{ s: number; d: number; t: number; lat: number; lon: number }>,
  winM: number
): Array<Array<{ s: number; d: number; t: number; lat: number; lon: number }>> {
  if (points.length === 0) return [];
  
  const sorted = [...points].sort((a, b) => a.s - b.s);
  const corridors: Array<Array<{ s: number; d: number; t: number; lat: number; lon: number }>> = [];
  
  let currentCorridor: Array<{ s: number; d: number; t: number; lat: number; lon: number }> = [sorted[0]];
  let baseS = sorted[0].s;
  
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].s - baseS <= winM) {
      currentCorridor.push(sorted[i]);
    } else {
      corridors.push(currentCorridor);
      currentCorridor = [sorted[i]];
      baseS = sorted[i].s;
    }
  }
  
  corridors.push(currentCorridor);
  return corridors;
}
