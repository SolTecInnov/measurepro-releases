/**
 * Native file-save utility for Electron.
 *
 * When running inside Electron, uses a native Save dialog + IPC file write.
 * Otherwise falls back to the standard Blob + <a download> browser approach.
 */

const MIME_TO_EXT: Record<string, string> = {
  'text/csv': 'csv',
  'application/json': 'json',
  'application/geo+json': 'geojson',
  'application/zip': 'zip',
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/xml': 'xml',
  'text/plain': 'txt',
};

function extForMime(mimeType: string): string {
  return MIME_TO_EXT[mimeType] || 'bin';
}

/**
 * Save a file using Electron's native dialog when available,
 * otherwise fall back to browser-style download.
 */
export async function saveFileNative(
  filename: string,
  data: Blob | ArrayBuffer | Uint8Array | string,
  mimeType?: string,
): Promise<boolean> {
  const electron = window.electronAPI;

  if (electron?.isElectron && electron.showSaveDialog && electron.writeFile) {
    // Resolve extension for dialog filter
    const ext = extForMime(mimeType || 'application/octet-stream');
    const result = await electron.showSaveDialog({
      defaultPath: filename,
      filters: [
        { name: `${ext.toUpperCase()} files`, extensions: [ext] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) return false;

    // Convert data to ArrayBuffer for IPC transfer
    let buffer: ArrayBuffer;
    if (data instanceof Blob) {
      buffer = await data.arrayBuffer();
    } else if (data instanceof ArrayBuffer) {
      buffer = data;
    } else if (data instanceof Uint8Array) {
      buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    } else {
      // string
      buffer = new TextEncoder().encode(data).buffer as ArrayBuffer;
    }

    await electron.writeFile(result.filePath, Array.from(new Uint8Array(buffer)));
    return true;
  }

  // Fallback: browser download
  const blob = data instanceof Blob
    ? data
    : new Blob(
        [data instanceof ArrayBuffer || data instanceof Uint8Array ? data : new TextEncoder().encode(data)],
        { type: mimeType || 'application/octet-stream' },
      );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}
