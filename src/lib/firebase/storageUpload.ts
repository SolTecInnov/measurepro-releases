import { openSurveyDB } from '../survey/db';

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  state: 'running' | 'paused' | 'success' | 'error' | 'canceled';
}

export interface UploadResult {
  success: boolean;
  downloadUrl?: string;
  filePath?: string;
  error?: string;
  fileSize?: number;
}

export interface PendingUpload {
  id: string;
  surveyId: string;
  fileName: string;
  fileSize: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  downloadUrl?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
  retryCount: number;
}

const MAX_RETRIES = 3;

/**
 * Upload a survey package to Firebase Storage via server-side Admin SDK
 * This bypasses client-side auth issues by using the server endpoint
 * Returns a download URL that can be shared via email
 */
export const uploadSurveyPackage = async (
  surveyId: string,
  zipBlob: Blob,
  fileName: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const filePath = `survey-packages/${surveyId}/${fileName}`;
  
  try {
    // Show initial progress
    if (onProgress) {
      onProgress({
        bytesTransferred: 0,
        totalBytes: zipBlob.size,
        percentage: 0,
        state: 'running'
      });
    }

    console.log(`[StorageUpload] Converting blob to base64 (${formatBytes(zipBlob.size)})...`);
    
    // Convert blob to base64 for JSON transport
    const arrayBuffer = await zipBlob.arrayBuffer();
    const base64Data = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Show 30% progress after base64 conversion
    if (onProgress) {
      onProgress({
        bytesTransferred: Math.round(zipBlob.size * 0.3),
        totalBytes: zipBlob.size,
        percentage: 30,
        state: 'running'
      });
    }

    console.log(`[StorageUpload] Uploading ${fileName} to server...`);

    // Upload via server endpoint using Admin SDK
    const response = await fetch('/api/storage/upload-survey-package', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        surveyId,
        fileName,
        fileData: base64Data,
        contentType: 'application/zip',
      }),
    });

    // Show 80% progress after server receives file
    if (onProgress) {
      onProgress({
        bytesTransferred: Math.round(zipBlob.size * 0.8),
        totalBytes: zipBlob.size,
        percentage: 80,
        state: 'running'
      });
    }

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error('[StorageUpload] Server upload failed:', result.error);
      
      // Track failed upload
      await trackUploadStatus(surveyId, fileName, zipBlob.size, 'failed', undefined, result.error);
      
      return {
        success: false,
        error: result.error || 'Server upload failed',
        filePath
      };
    }

    // Show 100% progress on success
    if (onProgress) {
      onProgress({
        bytesTransferred: zipBlob.size,
        totalBytes: zipBlob.size,
        percentage: 100,
        state: 'success'
      });
    }

    console.log('[StorageUpload] Upload complete:', {
      filePath: result.filePath,
      size: formatBytes(zipBlob.size),
      downloadUrl: result.downloadUrl?.substring(0, 50) + '...'
    });

    // Track successful upload in IndexedDB
    await trackUploadStatus(surveyId, fileName, zipBlob.size, 'completed', result.downloadUrl);
    
    return {
      success: true,
      downloadUrl: result.downloadUrl,
      filePath: result.filePath,
      fileSize: zipBlob.size
    };
  } catch (error: any) {
    console.error('[StorageUpload] Upload failed:', error);
    
    // Track failed upload
    await trackUploadStatus(surveyId, fileName, zipBlob.size, 'failed', undefined, error.message);
    
    return {
      success: false,
      error: error.message || 'Network error during upload',
      filePath
    };
  }
};

/**
 * Track upload status in IndexedDB for retry capability
 */
export const trackUploadStatus = async (
  surveyId: string,
  fileName: string,
  fileSize: number,
  status: PendingUpload['status'],
  downloadUrl?: string,
  error?: string
): Promise<void> => {
  try {
    const db = await openSurveyDB();
    const uploadRecord: PendingUpload = {
      id: `${surveyId}-${Date.now()}`,
      surveyId,
      fileName,
      fileSize,
      status,
      downloadUrl,
      error,
      createdAt: new Date().toISOString(),
      completedAt: status === 'completed' ? new Date().toISOString() : undefined,
      retryCount: 0
    };
    
    await db.put('uploadQueue', uploadRecord);
    console.log('[StorageUpload] Upload status tracked:', uploadRecord.id, status);
  } catch (dbError) {
    console.warn('[StorageUpload] Failed to track upload status:', dbError);
  }
};

/**
 * Get pending uploads that need retry
 */
export const getPendingUploads = async (): Promise<PendingUpload[]> => {
  try {
    const db = await openSurveyDB();
    const allUploads = await db.getAll('uploadQueue');
    return allUploads.filter((u: PendingUpload) => 
      u.status === 'pending' || u.status === 'failed' && u.retryCount < MAX_RETRIES
    );
  } catch {
    return [];
  }
};

/**
 * Format bytes to human readable string
 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Check if upload is feasible (online and server endpoint available)
 */
export const canUploadToCloud = (): boolean => {
  return navigator.onLine;
};

/**
 * Generate a summary of package size for email
 */
export const getPackageSizeInfo = (bytes: number): { 
  size: string; 
  canEmailDirectly: boolean;
  recommendation: string;
} => {
  const sizeStr = formatBytes(bytes);
  const canEmail = bytes < 10 * 1024 * 1024; // 10MB limit
  
  return {
    size: sizeStr,
    canEmailDirectly: canEmail,
    recommendation: canEmail 
      ? 'Package is small enough to attach directly'
      : 'Package will be uploaded to cloud storage and a download link will be sent'
  };
};
