// Stub — original deleted during orphan cleanup
export interface UploadProgress { phase: string; progress: number; message: string; }
export interface UploadResult { success: boolean; url?: string; error?: string; }
export interface PendingUpload { id: string; surveyId: string; status: string; }
export const uploadSurveyPackage = async (_surveyId: string, _blob: Blob, _onProgress?: (p: UploadProgress) => void): Promise<UploadResult> => ({ success: false, error: 'stub' });
export const trackUploadStatus = async (_uploadId: string): Promise<string> => 'stub';
export const getPendingUploads = async (): Promise<PendingUpload[]> => [];
export const canUploadToCloud = (): boolean => false;
export const getPackageSizeInfo = (_bytes: number): { formatted: string; isLarge: boolean } => ({ formatted: '0 B', isLarge: false });
