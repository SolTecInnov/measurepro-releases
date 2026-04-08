// Stub — original deleted during orphan cleanup
export interface BackupMetadata { version: string; timestamp: string; }
export interface BackupProgress { phase: string; progress: number; message: string; }
export class BackupManager {}
export const backupManager = new BackupManager();
export async function createCompleteBackup(_onProgress?: (p: BackupProgress) => void): Promise<Blob | null> { return null; }
