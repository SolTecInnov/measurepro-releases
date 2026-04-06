/**
 * GNSS Backup System
 * Creates downloadable backups of GNSS data before migration
 */

import { openSurveyDB } from '@/lib/survey/db';

export async function createGnssBackup(): Promise<string> {
  const db = await openSurveyDB();
  const backup = {
    timestamp: Date.now(),
    profiles: await db.getAll('roadProfiles'),
    samples: await db.getAll('roadProfileSamples'),
    events: await db.getAll('roadProfileEvents')
  };
  
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // Download backup
  const a = document.createElement('a');
  a.href = url;
  a.download = `gnss-backup-${Date.now()}.json`;
  a.click();
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
  
  return json;
}
