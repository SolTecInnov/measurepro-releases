/**
 * Asset Helper - Bridge between image capture and blob storage
 * 
 * Provides functions to:
 * 1. Save captured images/drawings as blobs instead of base64
 * 2. Return lightweight asset references for measurement records
 * 3. Resolve asset references back to displayable URLs
 * 
 * Asset Reference Format: "asset:{type}_{measurementId}"
 * Example: "asset:img_m123456" or "asset:draw_m123456"
 * 
 * Legacy data URLs (starting with "data:") are still supported
 * for backward compatibility.
 */

import { 
  saveAsset, 
  getAsset, 
  generateAssetId,
  dataURLToBlob,
  POIAsset
} from './poiAssetStorage';

// In-memory URL cache for fast rendering
const urlCache = new Map<string, string>();

// Asset reference prefix
const ASSET_PREFIX = 'asset:';

/**
 * Check if a URL is an asset reference
 */
export function isAssetReference(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith(ASSET_PREFIX);
}

/**
 * Check if a URL is a base64 data URL
 */
export function isDataURL(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith('data:');
}

/**
 * Extract asset ID from asset reference
 */
export function extractAssetId(assetRef: string): string {
  return assetRef.replace(ASSET_PREFIX, '');
}

/**
 * Save an image blob and return an asset reference
 */
export async function saveImageAsset(
  blob: Blob,
  measurementId: string,
  surveyId: string
): Promise<string> {
  const assetId = generateAssetId(measurementId, 'image');
  
  const asset: POIAsset = {
    id: assetId,
    type: 'image',
    blob,
    measurementId,
    surveyId,
    mimeType: blob.type || 'image/jpeg',
    size: blob.size,
    createdAt: new Date().toISOString()
  };
  
  const saved = await saveAsset(asset);
  if (!saved) {
    console.warn('[AssetHelper] Failed to save image asset, falling back to data URL');
    // Fallback: convert blob to data URL (legacy behavior)
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  }
  
  return `${ASSET_PREFIX}${assetId}`;
}

/**
 * Save a drawing blob and return an asset reference
 */
export async function saveDrawingAsset(
  blob: Blob,
  measurementId: string,
  surveyId: string
): Promise<string> {
  const assetId = generateAssetId(measurementId, 'drawing');
  
  const asset: POIAsset = {
    id: assetId,
    type: 'drawing',
    blob,
    measurementId,
    surveyId,
    mimeType: blob.type || 'image/png',
    size: blob.size,
    createdAt: new Date().toISOString()
  };
  
  const saved = await saveAsset(asset);
  if (!saved) {
    console.warn('[AssetHelper] Failed to save drawing asset, falling back to data URL');
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  }
  
  return `${ASSET_PREFIX}${assetId}`;
}

/**
 * Save a data URL as a blob asset
 * Use this for migrating existing base64 data or when only data URL is available
 */
export async function saveDataURLAsAsset(
  dataURL: string,
  measurementId: string,
  surveyId: string,
  type: 'image' | 'drawing' = 'image'
): Promise<string> {
  const blob = dataURLToBlob(dataURL);
  if (!blob) {
    // Can't convert, return original data URL
    return dataURL;
  }
  
  if (type === 'image') {
    return saveImageAsset(blob, measurementId, surveyId);
  } else {
    return saveDrawingAsset(blob, measurementId, surveyId);
  }
}

/**
 * Resolve an image URL for display
 * Handles both asset references and legacy data URLs
 * Returns an object URL for asset references, or the original URL for data URLs
 */
export async function resolveImageURL(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  
  // Legacy data URL - return as-is
  if (isDataURL(url)) {
    return url;
  }
  
  // Asset reference - look up blob and create object URL
  if (isAssetReference(url)) {
    const assetId = extractAssetId(url);
    
    // Check cache first
    const cached = urlCache.get(assetId);
    if (cached) return cached;
    
    // Load from storage
    const asset = await getAsset(assetId);
    if (!asset) {
      console.warn(`[AssetHelper] Asset not found: ${assetId}`);
      return null;
    }
    
    // Create and cache object URL
    const objectURL = URL.createObjectURL(asset.blob);
    urlCache.set(assetId, objectURL);
    return objectURL;
  }
  
  // Regular URL (http/https) - return as-is
  return url;
}

/**
 * Resolve multiple image URLs efficiently
 */
export async function resolveImageURLs(urls: (string | null | undefined)[]): Promise<(string | null)[]> {
  return Promise.all(urls.map(resolveImageURL));
}

/**
 * Revoke a cached object URL to free memory
 * Call this when a component unmounts or when done with an image
 */
export function revokeImageURL(url: string | null | undefined): void {
  if (!url || !isAssetReference(url)) return;
  
  const assetId = extractAssetId(url);
  const cached = urlCache.get(assetId);
  if (cached) {
    URL.revokeObjectURL(cached);
    urlCache.delete(assetId);
  }
}

/**
 * Revoke all cached object URLs
 * Call this on survey switch or app cleanup
 */
export function revokeAllCachedURLs(): void {
  for (const url of urlCache.values()) {
    URL.revokeObjectURL(url);
  }
  urlCache.clear();
}

/**
 * Get the blob for an asset reference (for export/upload)
 */
export async function getAssetBlob(url: string | null | undefined): Promise<Blob | null> {
  if (!url) return null;
  
  // Asset reference - get from storage
  if (isAssetReference(url)) {
    const assetId = extractAssetId(url);
    const asset = await getAsset(assetId);
    return asset?.blob || null;
  }
  
  // Data URL - convert to blob
  if (isDataURL(url)) {
    return dataURLToBlob(url);
  }
  
  return null;
}

/**
 * Get the size of an asset without loading the full blob
 */
export async function getAssetSize(url: string | null | undefined): Promise<number> {
  if (!url) return 0;
  
  if (isAssetReference(url)) {
    const assetId = extractAssetId(url);
    const asset = await getAsset(assetId);
    return asset?.size || 0;
  }
  
  if (isDataURL(url)) {
    // Estimate base64 size (roughly 75% of string length)
    return Math.floor(url.length * 0.75);
  }
  
  return 0;
}

/**
 * Preload assets into cache for faster rendering
 */
export async function preloadAssets(urls: (string | null | undefined)[]): Promise<void> {
  const assetRefs = urls.filter(isAssetReference) as string[];
  await resolveImageURLs(assetRefs);
}

export default {
  isAssetReference,
  isDataURL,
  extractAssetId,
  saveImageAsset,
  saveDrawingAsset,
  saveDataURLAsAsset,
  resolveImageURL,
  resolveImageURLs,
  revokeImageURL,
  revokeAllCachedURLs,
  getAssetBlob,
  getAssetSize,
  preloadAssets
};
