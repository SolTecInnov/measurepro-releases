// Stub — original deleted during orphan cleanup
interface MigrationStats { migrated: number; failed: number; skipped: number; }
export async function migrateAllAssets(_onProgress?: (p: number) => void): Promise<MigrationStats> { return { migrated: 0, failed: 0, skipped: 0 }; }
export async function getMigrationStatus(): Promise<{ needed: boolean; count: number }> { return { needed: false, count: 0 }; }
export async function runMigrationWithUI(): Promise<MigrationStats | null> { return null; }
export default { migrateAllAssets, getMigrationStatus, runMigrationWithUI };
