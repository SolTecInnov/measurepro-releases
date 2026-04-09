/**
 * Save a file using Electron's native save dialog.
 * Falls back to returning false if not in Electron context.
 */
export async function saveFileNative(
  filename: string,
  blob: Blob | string,
  mimeType?: string
): Promise<boolean> {
  const api = (window as any).electronAPI;
  if (!api?.isElectron) return false;

  try {
    // Determine default extension from filename or mimeType
    const ext = filename.split('.').pop() || '';
    const filterMap: Record<string, { name: string; extensions: string[] }> = {
      zip: { name: 'ZIP Archive', extensions: ['zip'] },
      csv: { name: 'CSV File', extensions: ['csv'] },
      json: { name: 'JSON File', extensions: ['json'] },
      gpx: { name: 'GPX File', extensions: ['gpx'] },
      kml: { name: 'KML File', extensions: ['kml'] },
      geojson: { name: 'GeoJSON File', extensions: ['geojson'] },
      pdf: { name: 'PDF Document', extensions: ['pdf'] },
      png: { name: 'PNG Image', extensions: ['png'] },
      jpg: { name: 'JPEG Image', extensions: ['jpg'] },
    };
    const filter = filterMap[ext] || { name: 'All Files', extensions: ['*'] };

    const result = await api.showSaveDialog({
      defaultPath: filename,
      filters: [filter, { name: 'All Files', extensions: ['*'] }],
    });

    if (result.canceled || !result.filePath) return false;

    // Convert blob/string to array of bytes
    let buffer: ArrayBuffer;
    if (blob instanceof Blob) {
      buffer = await blob.arrayBuffer();
    } else {
      const encoder = new TextEncoder();
      buffer = encoder.encode(blob).buffer;
    }

    await api.writeFile(result.filePath, Array.from(new Uint8Array(buffer)));
    return true;
  } catch (err) {
    console.error('[ElectronFileSave] Failed:', err);
    return false;
  }
}

export default saveFileNative;
