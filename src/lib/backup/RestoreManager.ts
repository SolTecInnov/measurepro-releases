// Stub — original deleted during orphan cleanup
export interface RestoreProgress { phase: string; progress: number; message: string; }
export interface RestoreMetadata { version: string; timestamp: string; }
export type DuplicateStrategy = 'skip' | 'overwrite' | 'merge';
export class RestoreManager {}
export async function restoreBackup(_file: File, _onProgress?: (p: RestoreProgress) => void, _strategy?: DuplicateStrategy): Promise<boolean> { return false; }
