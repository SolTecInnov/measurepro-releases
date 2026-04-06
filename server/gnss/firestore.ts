/**
 * Firestore Helpers for GNSS Data
 * Handles storage and retrieval of GNSS samples, profiles, and events
 * Stage 3: Enhanced with runtime validation guards
 */

import { Firestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { GnssSample, RawObservation, RoadProfile, GradeEvent, KFactorEvent, RailCrossingEvent, ProfileSection } from './types.js';
import { gnssConfig } from './config.js';
import {
  StrictGnssSampleSchema,
  StrictGradeEventSchema,
  StrictKFactorEventSchema,
  StrictRailCrossingEventSchema,
  StrictRoadProfileSchema,
  validateAndFilterArray,
  hasRequiredIdentifiers,
} from './validation.js';
import {
  logFirestoreWrite,
  logFirestoreError,
} from './logger.js';

export class GnssFirestore {
  private db: Firestore;

  constructor(firestore: Firestore) {
    this.db = firestore;
  }

  /**
   * Insert GNSS sample
   * Stage 3: Enhanced with runtime validation
   */
  async insertSample(sample: GnssSample): Promise<string> {
    // Runtime validation guard
    const validation = StrictGnssSampleSchema.safeParse(sample);
    
    if (!validation.success) {
      const errorMsg = `Cannot insert GNSS sample without required identifiers: ${validation.error.message}`;
      console.error('[GnssFirestore]', errorMsg, {
        surveyId: sample.surveyId,
        sessionId: sample.sessionId,
        errors: validation.error.issues,
      });
      
      logFirestoreError(
        'gnssSamples',
        'insert',
        new Error(errorMsg),
        { surveyId: sample.surveyId, sessionId: sample.sessionId }
      );
      
      throw new Error(errorMsg);
    }
    
    try {
      const docRef = await this.db.collection('gnssSamples').add({
        ...validation.data,
        created_at: FieldValue.serverTimestamp(),
      });
      
      logFirestoreWrite(
        'gnssSamples',
        'insert',
        1,
        { surveyId: validation.data.surveyId, sessionId: validation.data.sessionId }
      );
      
      return docRef.id;
    } catch (error: any) {
      logFirestoreError(
        'gnssSamples',
        'insert',
        error,
        { surveyId: sample.surveyId, sessionId: sample.sessionId }
      );
      throw error;
    }
  }

  /**
   * Batch insert GNSS samples (for USB/browser ingestion)
   * Stage 3: Enhanced with runtime validation and filtering
   * FIXED: Creates new batch every 500 items to avoid reusing committed batch
   */
  async insertSamplesBatch(samples: GnssSample[]): Promise<{ accepted: number; rejected: number }> {
    // Filter samples with runtime validation
    const { valid, rejected } = validateAndFilterArray(samples, StrictGnssSampleSchema);
    
    if (rejected > 0) {
      console.warn(`[GnssFirestore] Filtered ${rejected} invalid samples from batch (missing required identifiers)`);
    }
    
    if (valid.length === 0) {
      console.warn('[GnssFirestore] No valid samples to insert');
      return { accepted: 0, rejected };
    }
    
    try {
      let batch = this.db.batch();
      let batchCount = 0;
      let totalAccepted = 0;

      for (const sample of valid) {
        const docRef = this.db.collection('gnssSamples').doc();
        batch.set(docRef, {
          ...sample,
          created_at: FieldValue.serverTimestamp(),
        });
        batchCount++;
        totalAccepted++;

        // Commit and create NEW batch every 500 items
        if (batchCount === 500) {
          await batch.commit();
          batch = this.db.batch();  // CREATE NEW BATCH
          batchCount = 0;
        }
      }

      // Commit remaining items
      if (batchCount > 0) {
        await batch.commit();
      }
      
      logFirestoreWrite(
        'gnssSamples',
        'batch',
        totalAccepted,
        { surveyId: valid[0]?.surveyId, sessionId: valid[0]?.sessionId }
      );

      return { accepted: totalAccepted, rejected };
    } catch (error: any) {
      logFirestoreError(
        'gnssSamples',
        'batch',
        error,
        { surveyId: valid[0]?.surveyId, sessionId: valid[0]?.sessionId }
      );
      throw error;
    }
  }

  /**
   * Query GNSS samples by time range
   */
  async querySamplesByTime(
    start: Date,
    end: Date,
    sessionId?: string,
    limit = 10000
  ): Promise<GnssSample[]> {
    let query = this.db
      .collection('gnssSamples')
      .where('timestamp', '>=', start.toISOString())
      .where('timestamp', '<=', end.toISOString())
      .orderBy('timestamp', 'asc')
      .limit(limit);

    if (sessionId) {
      query = query.where('sessionId', '==', sessionId);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => doc.data() as GnssSample);
  }

  /**
   * Get latest GNSS samples
   */
  async getLatestSamples(limit = 100, sessionId?: string): Promise<GnssSample[]> {
    let query = this.db
      .collection('gnssSamples')
      .orderBy('timestamp', 'desc')
      .limit(limit);

    if (sessionId) {
      query = query.where('sessionId', '==', sessionId);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => doc.data() as GnssSample).reverse();
  }

  /**
   * Store raw observation (for PPK)
   */
  async insertRawObservation(obs: RawObservation): Promise<string> {
    const docRef = await this.db.collection('rawObservations').add({
      ...obs,
      created_at: FieldValue.serverTimestamp(),
    });
    return docRef.id;
  }

  /**
   * Save road profile
   * Stage 3: Enhanced with runtime validation
   */
  async saveProfile(profile: Omit<RoadProfile, 'id' | 'created_at'>): Promise<string> {
    // Runtime validation guard
    const validation = StrictRoadProfileSchema.safeParse(profile);
    
    if (!validation.success) {
      const errorMsg = `Cannot save road profile without required identifiers: ${validation.error.message}`;
      console.error('[GnssFirestore]', errorMsg, {
        surveyId: profile.surveyId,
        sessionId: profile.sessionId,
        errors: validation.error.issues,
      });
      
      logFirestoreError(
        'roadProfiles',
        'insert',
        new Error(errorMsg),
        { surveyId: profile.surveyId, sessionId: profile.sessionId }
      );
      
      throw new Error(errorMsg);
    }
    
    try {
      const docRef = await this.db.collection('roadProfiles').add({
        ...validation.data,
        created_at: FieldValue.serverTimestamp(),
      });
      
      logFirestoreWrite(
        'roadProfiles',
        'insert',
        1,
        { surveyId: validation.data.surveyId, sessionId: validation.data.sessionId }
      );
      
      return docRef.id;
    } catch (error: any) {
      logFirestoreError(
        'roadProfiles',
        'insert',
        error,
        { surveyId: profile.surveyId, sessionId: profile.sessionId }
      );
      throw error;
    }
  }

  /**
   * Get road profile by ID
   */
  async getProfile(profileId: string): Promise<RoadProfile | null> {
    const doc = await this.db.collection('roadProfiles').doc(profileId).get();
    if (!doc.exists) return null;
    
    return { id: doc.id, ...doc.data() } as RoadProfile;
  }

  /**
   * Save profile section
   */
  async saveProfileSection(
    profileId: string,
    section: Omit<ProfileSection, 'id' | 'profileId' | 'created_at'>
  ): Promise<string> {
    const docRef = await this.db
      .collection('roadProfiles')
      .doc(profileId)
      .collection('sections')
      .add({
        ...section,
        profileId,
        created_at: FieldValue.serverTimestamp(),
      });
    return docRef.id;
  }

  /**
   * Save grade event
   * Stage 3: Enhanced with runtime validation
   */
  async saveGradeEvent(event: Omit<GradeEvent, 'id' | 'created_at'>): Promise<string> {
    // Runtime validation guard
    const validation = StrictGradeEventSchema.safeParse(event);
    
    if (!validation.success) {
      const errorMsg = `Cannot save grade event without required identifiers: ${validation.error.message}`;
      console.error('[GnssFirestore]', errorMsg, {
        surveyId: event.surveyId,
        sessionId: event.sessionId,
        profileId: event.profileId,
        errors: validation.error.issues,
      });
      
      logFirestoreError(
        'gradeEvents',
        'insert',
        new Error(errorMsg),
        { surveyId: event.surveyId, sessionId: event.sessionId, profileId: event.profileId }
      );
      
      throw new Error(errorMsg);
    }
    
    try {
      const docRef = await this.db.collection('gradeEvents').add({
        ...validation.data,
        created_at: FieldValue.serverTimestamp(),
      });
      
      logFirestoreWrite(
        'gradeEvents',
        'insert',
        1,
        { surveyId: validation.data.surveyId, sessionId: validation.data.sessionId, profileId: validation.data.profileId }
      );
      
      return docRef.id;
    } catch (error: any) {
      logFirestoreError(
        'gradeEvents',
        'insert',
        error,
        { surveyId: event.surveyId, sessionId: event.sessionId, profileId: event.profileId }
      );
      throw error;
    }
  }

  /**
   * Save K-factor event
   * Stage 3: Enhanced with runtime validation
   */
  async saveKFactorEvent(event: Omit<KFactorEvent, 'id' | 'created_at'>): Promise<string> {
    // Runtime validation guard
    const validation = StrictKFactorEventSchema.safeParse(event);
    
    if (!validation.success) {
      const errorMsg = `Cannot save K-factor event without required identifiers: ${validation.error.message}`;
      console.error('[GnssFirestore]', errorMsg, {
        surveyId: event.surveyId,
        sessionId: event.sessionId,
        profileId: event.profileId,
        errors: validation.error.issues,
      });
      
      logFirestoreError(
        'kFactorEvents',
        'insert',
        new Error(errorMsg),
        { surveyId: event.surveyId, sessionId: event.sessionId, profileId: event.profileId }
      );
      
      throw new Error(errorMsg);
    }
    
    try {
      const docRef = await this.db.collection('kFactorEvents').add({
        ...validation.data,
        created_at: FieldValue.serverTimestamp(),
      });
      
      logFirestoreWrite(
        'kFactorEvents',
        'insert',
        1,
        { surveyId: validation.data.surveyId, sessionId: validation.data.sessionId, profileId: validation.data.profileId }
      );
      
      return docRef.id;
    } catch (error: any) {
      logFirestoreError(
        'kFactorEvents',
        'insert',
        error,
        { surveyId: event.surveyId, sessionId: event.sessionId, profileId: event.profileId }
      );
      throw error;
    }
  }

  /**
   * Save rail crossing event
   * Stage 3: Enhanced with runtime validation
   */
  async saveRailCrossingEvent(event: Omit<RailCrossingEvent, 'id' | 'created_at'>): Promise<string> {
    // Runtime validation guard
    const validation = StrictRailCrossingEventSchema.safeParse(event);
    
    if (!validation.success) {
      const errorMsg = `Cannot save rail crossing event without required identifiers: ${validation.error.message}`;
      console.error('[GnssFirestore]', errorMsg, {
        surveyId: event.surveyId,
        sessionId: event.sessionId,
        profileId: event.profileId,
        errors: validation.error.issues,
      });
      
      logFirestoreError(
        'railCrossingEvents',
        'insert',
        new Error(errorMsg),
        { surveyId: event.surveyId, sessionId: event.sessionId, profileId: event.profileId }
      );
      
      throw new Error(errorMsg);
    }
    
    try {
      const docRef = await this.db.collection('railCrossingEvents').add({
        ...validation.data,
        created_at: FieldValue.serverTimestamp(),
      });
      
      logFirestoreWrite(
        'railCrossingEvents',
        'insert',
        1,
        { surveyId: validation.data.surveyId, sessionId: validation.data.sessionId, profileId: validation.data.profileId }
      );
      
      return docRef.id;
    } catch (error: any) {
      logFirestoreError(
        'railCrossingEvents',
        'insert',
        error,
        { surveyId: event.surveyId, sessionId: event.sessionId, profileId: event.profileId }
      );
      throw error;
    }
  }

  /**
   * Query grade events by profile
   */
  async getGradeEventsByProfile(profileId: string): Promise<GradeEvent[]> {
    const snapshot = await this.db
      .collection('gradeEvents')
      .where('profileId', '==', profileId)
      .orderBy('start_distance_m', 'asc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GradeEvent));
  }

  /**
   * Query K-factor events by profile
   */
  async getKFactorEventsByProfile(profileId: string): Promise<KFactorEvent[]> {
    const snapshot = await this.db
      .collection('kFactorEvents')
      .where('profileId', '==', profileId)
      .orderBy('distance_m', 'asc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KFactorEvent));
  }

  /**
   * Query rail crossing events by profile
   */
  async getRailCrossingEventsByProfile(profileId: string): Promise<RailCrossingEvent[]> {
    const snapshot = await this.db
      .collection('railCrossingEvents')
      .where('profileId', '==', profileId)
      .orderBy('distance_m', 'asc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RailCrossingEvent));
  }

  /**
   * Query grade events by session
   */
  async getGradeEventsBySession(sessionId: string): Promise<GradeEvent[]> {
    const snapshot = await this.db
      .collection('gradeEvents')
      .where('sessionId', '==', sessionId)
      .orderBy('start_distance_m', 'asc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GradeEvent));
  }

  /**
   * Query K-factor events by session
   */
  async getKFactorEventsBySession(sessionId: string): Promise<KFactorEvent[]> {
    const snapshot = await this.db
      .collection('kFactorEvents')
      .where('sessionId', '==', sessionId)
      .orderBy('distance_m', 'asc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KFactorEvent));
  }

  /**
   * Query rail crossing events by session
   */
  async getRailCrossingEventsBySession(sessionId: string): Promise<RailCrossingEvent[]> {
    const snapshot = await this.db
      .collection('railCrossingEvents')
      .where('sessionId', '==', sessionId)
      .orderBy('distance_m', 'asc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RailCrossingEvent));
  }

  /**
   * Get all saved profiles
   */
  async listProfiles(limit = 100): Promise<RoadProfile[]> {
    const snapshot = await this.db
      .collection('roadProfiles')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoadProfile));
  }

  /**
   * Query road profiles by survey
   */
  async getProfilesBySurvey(surveyId: string): Promise<RoadProfile[]> {
    const snapshot = await this.db
      .collection('roadProfiles')
      .where('surveyId', '==', surveyId)
      .orderBy('created_at', 'desc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoadProfile));
  }

  /**
   * Query grade events by survey
   */
  async getGradeEventsBySurvey(surveyId: string): Promise<GradeEvent[]> {
    const snapshot = await this.db
      .collection('gradeEvents')
      .where('surveyId', '==', surveyId)
      .orderBy('start_distance_m', 'asc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GradeEvent));
  }

  /**
   * Query K-factor events by survey
   */
  async getKFactorEventsBySurvey(surveyId: string): Promise<KFactorEvent[]> {
    const snapshot = await this.db
      .collection('kFactorEvents')
      .where('surveyId', '==', surveyId)
      .orderBy('distance_m', 'asc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KFactorEvent));
  }

  /**
   * Query rail crossing events by survey
   */
  async getRailCrossingEventsBySurvey(surveyId: string): Promise<RailCrossingEvent[]> {
    const snapshot = await this.db
      .collection('railCrossingEvents')
      .where('surveyId', '==', surveyId)
      .orderBy('distance_m', 'asc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RailCrossingEvent));
  }

  /**
   * Query GNSS samples by survey
   */
  async getSamplesBySurvey(surveyId: string, limit = 10000): Promise<GnssSample[]> {
    const snapshot = await this.db
      .collection('gnssSamples')
      .where('surveyId', '==', surveyId)
      .orderBy('timestamp', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.data() as GnssSample);
  }

  /**
   * Cleanup old samples (retention policy)
   */
  async cleanupOldSamples(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - gnssConfig.firestoreRetentionDays);

    const snapshot = await this.db
      .collection('gnssSamples')
      .where('timestamp', '<', cutoffDate.toISOString())
      .limit(1000)
      .get();

    if (snapshot.empty) return 0;

    const batch = this.db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return snapshot.size;
  }
}
