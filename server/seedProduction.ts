/**
 * Production database admin utilities.
 *
 * Companies and members are managed directly through the admin panel at
 * measure-pro.app — no boot-time seeding is used. Data lives in the database.
 *
 * To export current database state as JSON (for backup or migration purposes),
 * call GET /api/admin/seed-export (master admin only).
 */

import { db } from '../db/index.js';
import { companies as companiesTable, companyMembers as companyMembersTable } from '../db/schema.js';

/**
 * Exports all companies and members from the database.
 * Used by GET /api/admin/seed-export for admin backups/migrations.
 */
export async function exportSeedFromDatabase(): Promise<{ companies: any[]; members: any[] }> {
  const companies = await db.select().from(companiesTable);
  const members   = await db.select().from(companyMembersTable);
  return { companies, members };
}
