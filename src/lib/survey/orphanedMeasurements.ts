import { openSurveyDB } from './db';
import { saveAs } from 'file-saver';

export interface OrphanedMeasurementReport {
  totalOrphaned: number;
  exportedAt: string;
  orphanedBySurveyId: Record<string, number>;
  measurements: any[];
}

export async function findOrphanedMeasurements(): Promise<OrphanedMeasurementReport> {
  const db = await openSurveyDB();
  
  const allSurveys = await db.getAllFromIndex('surveys', 'by-date');
  const surveyIds = new Set(allSurveys.map(s => s.id));
  
  const allMeasurements = await db.getAllFromIndex('measurements', 'by-date');
  const orphanedMeasurements = allMeasurements.filter(m => !surveyIds.has(m.user_id));
  
  const orphanedBySurveyId: Record<string, number> = {};
  orphanedMeasurements.forEach(m => {
    orphanedBySurveyId[m.user_id] = (orphanedBySurveyId[m.user_id] || 0) + 1;
  });
  
  return {
    totalOrphaned: orphanedMeasurements.length,
    exportedAt: new Date().toISOString(),
    orphanedBySurveyId,
    measurements: orphanedMeasurements
  };
}

export async function exportOrphanedMeasurements(): Promise<void> {
  const report = await findOrphanedMeasurements();
  
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: 'application/json'
  });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  saveAs(blob, `orphaned-measurements-${timestamp}.json`);
  
  console.log(`📊 Exported ${report.totalOrphaned} orphaned measurements`);
  console.log('Orphaned by Survey ID:', report.orphanedBySurveyId);
  
  return;
}

export async function deleteOrphanedMeasurements(): Promise<number> {
  const db = await openSurveyDB();
  
  const allSurveys = await db.getAllFromIndex('surveys', 'by-date');
  const surveyIds = new Set(allSurveys.map(s => s.id));
  
  const allMeasurements = await db.getAllFromIndex('measurements', 'by-date');
  const orphanedMeasurements = allMeasurements.filter(m => !surveyIds.has(m.user_id));
  
  console.log(`🗑️ Deleting ${orphanedMeasurements.length} orphaned measurements...`);
  
  const tx = db.transaction('measurements', 'readwrite');
  let deletedCount = 0;
  
  for (const measurement of orphanedMeasurements) {
    await tx.store.delete(measurement.id);
    deletedCount++;
  }
  
  await tx.done;
  
  console.log(`✅ Deleted ${deletedCount} orphaned measurements`);
  
  return deletedCount;
}
