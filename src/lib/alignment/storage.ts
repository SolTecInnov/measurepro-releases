/**
 * Alignment + Profile Storage
 * Dual persistence: IndexedDB (local cache) + Firebase (cloud sync)
 */

import { openDB, IDBPDatabase } from 'idb';
import type { Alignment, LinkedProfile, AlignmentProfileLinkedSet } from './types';
import { computePolylineCumDist } from './geometry';

const DB_NAME = 'alignment-profiles-db';
const DB_VERSION = 1;
const ALIGNMENTS_STORE = 'alignments';
const PROFILES_STORE = 'linkedProfiles';

let dbPromise: Promise<IDBPDatabase> | null = null;

async function openAlignmentDB(): Promise<IDBPDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(ALIGNMENTS_STORE)) {
        const alignmentStore = db.createObjectStore(ALIGNMENTS_STORE, { keyPath: 'id' });
        alignmentStore.createIndex('by-project', 'projectId');
        alignmentStore.createIndex('by-date', 'createdAt');
      }

      if (!db.objectStoreNames.contains(PROFILES_STORE)) {
        const profileStore = db.createObjectStore(PROFILES_STORE, { keyPath: 'id' });
        profileStore.createIndex('by-project', 'projectId');
        profileStore.createIndex('by-alignment', 'alignmentId');
        profileStore.createIndex('by-date', 'metadata.createdAt');
      }
    },
  });

  return dbPromise;
}

export async function saveAlignment(alignment: Alignment): Promise<void> {
  const db = await openAlignmentDB();
  await db.put(ALIGNMENTS_STORE, alignment);
}

export async function getAlignment(id: string): Promise<Alignment | undefined> {
  const db = await openAlignmentDB();
  return db.get(ALIGNMENTS_STORE, id);
}

export async function getAlignmentsByProject(projectId: string): Promise<Alignment[]> {
  const db = await openAlignmentDB();
  return db.getAllFromIndex(ALIGNMENTS_STORE, 'by-project', projectId);
}

export async function deleteAlignment(id: string): Promise<{ profilesAffected: number }> {
  const db = await openAlignmentDB();
  
  const profiles = await db.getAllFromIndex(PROFILES_STORE, 'by-alignment', id);
  
  await db.delete(ALIGNMENTS_STORE, id);
  
  return { profilesAffected: profiles.length };
}

export async function saveLinkedProfile(profile: LinkedProfile): Promise<void> {
  const db = await openAlignmentDB();
  await db.put(PROFILES_STORE, profile);
}

export async function getLinkedProfile(id: string): Promise<LinkedProfile | undefined> {
  const db = await openAlignmentDB();
  return db.get(PROFILES_STORE, id);
}

export async function getProfilesByProject(projectId: string): Promise<LinkedProfile[]> {
  const db = await openAlignmentDB();
  return db.getAllFromIndex(PROFILES_STORE, 'by-project', projectId);
}

export async function getProfilesByAlignment(alignmentId: string): Promise<LinkedProfile[]> {
  const db = await openAlignmentDB();
  return db.getAllFromIndex(PROFILES_STORE, 'by-alignment', alignmentId);
}

export async function deleteLinkedProfile(id: string): Promise<void> {
  const db = await openAlignmentDB();
  await db.delete(PROFILES_STORE, id);
}

export async function getLinkedSet(alignmentId: string): Promise<AlignmentProfileLinkedSet | null> {
  const alignment = await getAlignment(alignmentId);
  if (!alignment) return null;
  
  const profiles = await getProfilesByAlignment(alignmentId);
  return { alignment, profiles };
}

export async function saveLinkedSet(set: AlignmentProfileLinkedSet): Promise<void> {
  await saveAlignment(set.alignment);
  for (const profile of set.profiles) {
    await saveLinkedProfile(profile);
  }
}

export function generateAlignmentId(): string {
  return `align_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateProfileId(): string {
  return `prof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createNewAlignment(
  projectId: string,
  name: string,
  polyline: { lat: number; lon: number }[],
  createdBy: string
): Alignment {
  const cumDistM = computePolylineCumDist(polyline);
  const now = new Date().toISOString();
  
  return {
    id: generateAlignmentId(),
    projectId,
    name,
    polyline,
    cumDistM,
    createdAt: now,
    updatedAt: now,
    createdBy,
    cloudSynced: false,
  };
}

export async function getAllAlignments(): Promise<Alignment[]> {
  const db = await openAlignmentDB();
  return db.getAll(ALIGNMENTS_STORE);
}

export async function getAllLinkedProfiles(): Promise<LinkedProfile[]> {
  const db = await openAlignmentDB();
  return db.getAll(PROFILES_STORE);
}

export async function clearAlignmentCache(): Promise<void> {
  const db = await openAlignmentDB();
  const tx = db.transaction([ALIGNMENTS_STORE, PROFILES_STORE], 'readwrite');
  await tx.objectStore(ALIGNMENTS_STORE).clear();
  await tx.objectStore(PROFILES_STORE).clear();
  await tx.done;
}
