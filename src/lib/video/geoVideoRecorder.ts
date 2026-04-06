import { openDB, IDBPDatabase } from 'idb';
import { getStoragePool } from '@/lib/workers/StoragePool';

interface VideoRecordingDB {
  videoRecordings: {
    key: string;
    value: {
      id: string;
      blob: Blob;
      startTime: string;
      endTime: string;
      surveyId: string;
      duration: number;
    };
  };
  videoChunks: {
    key: string;
    value: {
      id: string;
      recordingId: string;
      chunk: Blob;
      chunkIndex: number;
      timestamp: number;
      savedAt: number;
    };
  };
}

export interface GeoVideoRecorderOptions {
  mimeType?: string;
  videoBitsPerSecond?: number;
  progressiveSaving?: boolean; // Enable progressive chunk saving
}

export class GeoVideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private startTime: number = 0;
  private db: IDBPDatabase<VideoRecordingDB> | null = null;
  private currentRecordingId: string | null = null;
  private surveyId: string | null = null;
  private chunkIndex: number = 0;
  private progressiveSaving: boolean = true; // Default to true for data safety

  constructor() {
    this.initDB();
  }

  /**
   * Recover partial recording from IndexedDB chunks
   * Useful if app crashed during recording
   */
  public async recoverPartialRecording(recordingId: string): Promise<{
    id: string;
    blob: Blob;
    chunksRecovered: number;
  } | null> {
    try {
      if (!this.db) {
        await this.initDB();
      }

      if (!this.db) {
        throw new Error('Database not initialized');
      }

      // Get all chunks for this recording
      const tx = this.db.transaction('videoChunks', 'readonly');
      const index = tx.store.index('by-recording');
      const chunks = await index.getAll(recordingId);

      if (chunks.length === 0) {
        return null;
      }

      // Sort chunks by index
      chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

      // Combine chunks into single blob
      const chunkBlobs = chunks.map(c => c.chunk);
      const blob = new Blob(chunkBlobs, { type: 'video/webm' });

      return {
        id: recordingId,
        blob,
        chunksRecovered: chunks.length,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up chunks for a completed recording
   */
  public async cleanupChunks(recordingId: string): Promise<void> {
    try {
      if (!this.db) return;

      const tx = this.db.transaction('videoChunks', 'readwrite');
      const index = tx.store.index('by-recording');
      const chunks = await index.getAll(recordingId);

      for (const chunk of chunks) {
        await tx.store.delete(chunk.id);
      }

      await tx.done;
    } catch (error) {
      // Silent fail
    }
  }

  private async initDB(): Promise<void> {
    try {
      this.db = await openDB<VideoRecordingDB>('geo-video-recordings-db', 2, {
        upgrade(db, oldVersion) {
          if (!db.objectStoreNames.contains('videoRecordings')) {
            db.createObjectStore('videoRecordings', { keyPath: 'id' });
          }
          // Add videoChunks store for progressive saving
          if (oldVersion < 2 && !db.objectStoreNames.contains('videoChunks')) {
            const chunkStore = db.createObjectStore('videoChunks', { keyPath: 'id' });
            chunkStore.createIndex('by-recording', 'recordingId');
            chunkStore.createIndex('by-timestamp', 'timestamp');
          }
        },
      });
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Start recording video from a video element
   * @param videoElement - The HTML video element with camera stream
   * @param surveyId - The current survey ID to associate the recording with
   * @param options - Recording options
   * @returns The recording ID
   */
  public async startRecording(
    videoElement: HTMLVideoElement,
    surveyId: string,
    options?: GeoVideoRecorderOptions
  ): Promise<string> {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      throw new Error('Already recording');
    }

    if (!videoElement.srcObject) {
      throw new Error('No camera stream available');
    }

    // STREAM VALIDATION: Verify stream has active video tracks
    const stream = videoElement.srcObject as MediaStream;
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();

    if (videoTracks.length === 0) {
      throw new Error('No video tracks available in stream - camera may not be active');
    }

    if (videoTracks[0].readyState !== 'live') {
      throw new Error(`Video track is not live (state: ${videoTracks[0].readyState}) - camera may be disconnected`);
    }

    if (!videoTracks[0].enabled) {
      videoTracks[0].enabled = true;
    }
    
    // Try VP9 codec first, fallback to VP8
    const mimeType = options?.mimeType || this.getSupportedMimeType();
    
    // Optimized for VP9 720p: 500 kbps = ~225 MB/hour (vs 2.5 Mbps = ~1.1 GB/hour)
    // VP9 provides 30-50% better compression than VP8 at same quality
    const recorderOptions: MediaRecorderOptions = {
      mimeType,
      videoBitsPerSecond: options?.videoBitsPerSecond || 500000, // 500 kbps for 720p VP9
    };

    try {
      this.mediaRecorder = new MediaRecorder(stream, recorderOptions);
    } catch (error) {
      // Fallback to basic webm
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    }

    this.recordedChunks = [];
    this.currentRecordingId = crypto.randomUUID();
    this.surveyId = surveyId;
    this.startTime = Date.now();
    this.chunkIndex = 0;
    this.progressiveSaving = options?.progressiveSaving !== false; // Default true

    // ENHANCED DIAGNOSTICS: Add error handler
    this.mediaRecorder.onerror = (event: any) => {
      // Silent fail - errors logged elsewhere
    };

    // PROGRESSIVE CHUNK SAVING: Save chunks as they arrive
    this.mediaRecorder.ondataavailable = async (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
        const currentChunkIndex = this.chunkIndex++;
        
        // PROGRESSIVE SAVING: Save chunk to IndexedDB immediately for data safety
        if (this.progressiveSaving && this.currentRecordingId) {
          try {
            const storagePool = getStoragePool();
            await storagePool.saveVideoChunk(
              this.currentRecordingId,
              event.data,
              currentChunkIndex
            );
          } catch (error) {
            // Continue recording even if chunk save fails
          }
        }
      }
    };

    this.mediaRecorder.start(1000); // Capture in 1-second chunks

    return this.currentRecordingId;
  }

  /**
   * Stop the current recording and save to IndexedDB
   * @returns Object containing blob and recording metadata
   */
  public async stopRecording(): Promise<{
    id: string;
    blob: Blob;
    startTime: string;
    endTime: string;
    duration: number;
  } | null> {
    if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
      return null;
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      // TIMEOUT SAFETY: Reject if onstop doesn't fire within 5 seconds
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout waiting for video recording to stop - camera may have disconnected'));
      }, 5000);

      this.mediaRecorder.onstop = async () => {
        clearTimeout(timeoutId);
        
        const endTime = Date.now();
        const duration = (endTime - this.startTime) / 1000; // Duration in seconds

        if (this.recordedChunks.length === 0) {
          // Resolve null to maintain contract - caller will show appropriate toast
          resolve(null);
          return;
        }

        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        const startTimeISO = new Date(this.startTime).toISOString();
        const endTimeISO = new Date(endTime).toISOString();

        const recording = {
          id: this.currentRecordingId!,
          blob,
          startTime: startTimeISO,
          endTime: endTimeISO,
          surveyId: this.surveyId!,
          duration,
        };

        // Save to IndexedDB
        try {
          if (this.db) {
            await this.db.put('videoRecordings', recording);
          }
        } catch (error) {
          // Silent fail
        }

        // Reset state
        this.recordedChunks = [];
        this.currentRecordingId = null;
        this.surveyId = null;

        resolve(recording);
      };

      // FORCE DATA CAPTURE: Request any pending data before stopping
      try {
        this.mediaRecorder.requestData();
      } catch (error) {
        // Silent fail
      }

      // Small delay to allow requestData to complete, then stop
      setTimeout(() => {
        this.mediaRecorder?.stop();
      }, 100);
    });
  }

  /**
   * Get the current timestamp in seconds since recording started
   * @returns Timestamp in seconds, or null if not recording
   */
  public getCurrentTimestamp(): number | null {
    if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
      return null;
    }

    return (Date.now() - this.startTime) / 1000;
  }

  /**
   * Check if currently recording
   */
  public isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording' || false;
  }

  /**
   * Get the current recording ID
   */
  public getCurrentRecordingId(): string | null {
    return this.currentRecordingId;
  }

  /**
   * Get a video recording from IndexedDB by ID
   */
  public async getRecording(id: string): Promise<{
    id: string;
    blob: Blob;
    startTime: string;
    endTime: string;
    surveyId: string;
    duration: number;
  } | null> {
    if (!this.db) {
      await this.initDB();
    }

    try {
      const recording = await this.db!.get('videoRecordings', id);
      return recording || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all recordings for a survey
   */
  public async getRecordingsForSurvey(surveyId: string): Promise<Array<{
    id: string;
    blob: Blob;
    startTime: string;
    endTime: string;
    surveyId: string;
    duration: number;
  }>> {
    if (!this.db) {
      await this.initDB();
    }

    try {
      const allRecordings = await this.db!.getAll('videoRecordings');
      return allRecordings.filter(r => r.surveyId === surveyId);
    } catch (error) {
      return [];
    }
  }

  /**
   * Delete a recording from IndexedDB
   */
  public async deleteRecording(id: string): Promise<void> {
    if (!this.db) {
      await this.initDB();
    }

    try {
      await this.db!.delete('videoRecordings', id);
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Get the best supported MIME type for video recording
   */
  private getSupportedMimeType(): string {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'video/webm';
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    this.recordedChunks = [];
    this.currentRecordingId = null;
    this.surveyId = null;
  }
}

// Singleton instance
export const geoVideoRecorder = new GeoVideoRecorder();
