/**
 * CRS (Coordinate Reference System) Utilities
 * Transformations using proj4js
 */

import proj4 from 'proj4';
import { SUPPORTED_CRS, type CRSCode, type CRSDefinition } from '../types';

const registeredCRS = new Set<string>();

export function registerCRS(definition: CRSDefinition): void {
  if (!registeredCRS.has(definition.code)) {
    proj4.defs(definition.code, definition.proj4);
    registeredCRS.add(definition.code);
  }
}

export function initializeCRS(): void {
  SUPPORTED_CRS.forEach(registerCRS);
}

export function registerCustomCRS(code: string, proj4String: string): void {
  if (!registeredCRS.has(code)) {
    proj4.defs(code, proj4String);
    registeredCRS.add(code);
  }
}

export function getCRSDefinition(code: CRSCode): CRSDefinition | undefined {
  return SUPPORTED_CRS.find(crs => crs.code === code);
}

export function getCRSName(code: CRSCode): string {
  const def = getCRSDefinition(code);
  return def?.name || code;
}

export function transformCoordinate(
  lon: number,
  lat: number,
  fromCRS: CRSCode = 'EPSG:4326',
  toCRS: CRSCode
): [number, number] {
  if (fromCRS === toCRS) {
    return [lon, lat];
  }

  initializeCRS();

  try {
    const result = proj4(fromCRS, toCRS, [lon, lat]);
    return [result[0], result[1]];
  } catch (e) {
    console.error(`[CRS] Transform failed from ${fromCRS} to ${toCRS}:`, e);
    return [lon, lat];
  }
}

export function transformCoordinates(
  coordinates: Array<[number, number]>,
  fromCRS: CRSCode = 'EPSG:4326',
  toCRS: CRSCode
): Array<[number, number]> {
  if (fromCRS === toCRS) {
    return coordinates;
  }

  initializeCRS();

  return coordinates.map(([lon, lat]) => {
    try {
      const result = proj4(fromCRS, toCRS, [lon, lat]);
      return [result[0], result[1]];
    } catch {
      return [lon, lat];
    }
  });
}

export function isProjectedCRS(code: CRSCode): boolean {
  return code !== 'EPSG:4326';
}

export function getWKT(code: CRSCode): string {
  const wktMap: Record<string, string> = {
    'EPSG:4326': `GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]`,
    'EPSG:3857': `PROJCS["WGS 84 / Pseudo-Mercator",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Mercator_1SP"],PARAMETER["central_meridian",0],PARAMETER["scale_factor",1],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Easting",EAST],AXIS["Northing",NORTH],EXTENSION["PROJ4","+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs"],AUTHORITY["EPSG","3857"]]`,
    'EPSG:28354': `PROJCS["GDA94 / MGA zone 54",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",141],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28354"]]`,
    'EPSG:28355': `PROJCS["GDA94 / MGA zone 55",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",147],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28355"]]`,
    'EPSG:28356': `PROJCS["GDA94 / MGA zone 56",GEOGCS["GDA94",DATUM["Geocentric_Datum_of_Australia_1994",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6283"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4283"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",153],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","28356"]]`,
  };

  return wktMap[code] || wktMap['EPSG:4326'];
}
