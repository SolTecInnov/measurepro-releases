/**
 * Convoy Video Loop Recorder
 * Maintains a rolling 60-second video buffer for alert evidence capture
 */

class ConvoyVideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private circularBuffer: { blob: Blob; timestamp: number }[] = [];
  private stream: MediaStream | null = null;
  private isRecording = false;
  private bufferDuration = 60000; // 60 seconds
  private maxBufferSize = 120; // Maximum chunks to keep in buffer

  /**
   * Initialize and start continuous recording
   */
  async startRecording(videoStream: MediaStream): Promise<boolean> {
    try {
      this.stream = videoStream;

      // Check if MediaRecorder is supported
      if (!MediaRecorder.isTypeSupported('video/webm')) {
        return false;
      }

      this.mediaRecorder = new MediaRecorder(videoStream, {
        mimeType: 'video/webm;codecs=vp8',
        videoBitsPerSecond: 2500000, // 2.5 Mbps for decent quality
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);

          // Add to circular buffer with timestamp
          this.circularBuffer.push({
            blob: event.data,
            timestamp: Date.now(),
          });

          // Prune old chunks from buffer
          this.pruneBuffer();
        }
      };

      this.mediaRecorder.onerror = (event) => {
      };

      // Start recording with chunks every 1 second
      this.mediaRecorder.start(1000);
      this.isRecording = true;

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Stop continuous recording
   */
  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.chunks = [];
      this.circularBuffer = [];
    }
  }

  /**
   * Prune buffer to keep only recent chunks
   */
  private pruneBuffer() {
    const now = Date.now();
    
    // Remove chunks older than buffer duration
    this.circularBuffer = this.circularBuffer.filter(
      chunk => now - chunk.timestamp < this.bufferDuration
    );

    // Also limit by count to prevent memory issues
    if (this.circularBuffer.length > this.maxBufferSize) {
      this.circularBuffer = this.circularBuffer.slice(-this.maxBufferSize);
    }
  }

  /**
   * Save a clip from the buffer around an alert
   * @param preAlertSeconds - Seconds before alert to include (negative number)
   * @param postAlertSeconds - Seconds after alert to continue recording
   * @returns Promise with blob URL of saved clip
   */
  async saveClipFromBuffer(
    preAlertSeconds: number = -10,
    postAlertSeconds: number = 20
  ): Promise<{ url: string; blob: Blob; duration: number }> {
    const alertTime = Date.now();
    const preAlertTime = alertTime + (preAlertSeconds * 1000); // preAlertSeconds is negative

    // Get chunks from buffer that fall within the time range
    const relevantChunks = this.circularBuffer.filter(
      chunk => chunk.timestamp >= preAlertTime && chunk.timestamp <= alertTime
    );

    // If we need post-alert footage, collect it
    if (postAlertSeconds > 0) {
      // Wait for post-alert recording
      await this.recordForDuration(postAlertSeconds * 1000);
    }

    // Combine all chunks into a single blob
    const allChunks = [
      ...relevantChunks.map(c => c.blob),
      ...this.chunks, // Recent chunks from ongoing recording
    ];

    const clipBlob = new Blob(allChunks, { type: 'video/webm' });
    const clipUrl = URL.createObjectURL(clipBlob);

    const duration = (allChunks.length * 1000) / 1000; // Approximate duration

    // Save to IndexedDB for persistence
    await this.saveToIndexedDB(clipBlob, {
      timestamp: alertTime,
      duration,
      preAlertSeconds,
      postAlertSeconds,
    });

    return { url: clipUrl, blob: clipBlob, duration };
  }

  /**
   * Record for a specific duration
   */
  private async recordForDuration(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, durationMs);
    });
  }

  /**
   * Capture a snapshot from the current video stream
   */
  async captureSnapshot(): Promise<{ url: string; blob: Blob }> {
    if (!this.stream) {
      throw new Error('No active video stream');
    }

    const videoTrack = this.stream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error('No video track available');
    }

    // Create a temporary video element to capture frame
    const video = document.createElement('video');
    video.srcObject = this.stream;
    video.muted = true;
    
    await video.play();

    // Wait for video to be ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Create canvas to capture frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob from canvas'));
        },
        'image/jpeg',
        0.9
      );
    });

    const url = URL.createObjectURL(blob);

    // Clean up
    video.pause();
    video.srcObject = null;

    return { url, blob };
  }

  /**
   * Save video clip to IndexedDB for persistence
   */
  private async saveToIndexedDB(
    blob: Blob,
    metadata: {
      timestamp: number;
      duration: number;
      preAlertSeconds: number;
      postAlertSeconds: number;
    }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ConvoyVideoStore', 1);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['videos'], 'readwrite');
        const store = transaction.objectStore('videos');

        const videoRecord = {
          id: `convoy-alert-${metadata.timestamp}`,
          blob,
          metadata,
          savedAt: Date.now(),
        };

        const addRequest = store.add(videoRecord);

        addRequest.onsuccess = () => {
          resolve();
        };

        addRequest.onerror = () => reject(addRequest.error);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('videos')) {
          const objectStore = db.createObjectStore('videos', { keyPath: 'id' });
          objectStore.createIndex('savedAt', 'savedAt', { unique: false });
        }
      };
    });
  }

  /**
   * Get all saved video clips from IndexedDB
   */
  async getSavedClips(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ConvoyVideoStore', 1);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['videos'], 'readonly');
        const store = transaction.objectStore('videos');
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          resolve(getAllRequest.result);
        };

        getAllRequest.onerror = () => reject(getAllRequest.error);
      };
    });
  }

  /**
   * Delete a saved clip
   */
  async deleteClip(clipId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ConvoyVideoStore', 1);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['videos'], 'readwrite');
        const store = transaction.objectStore('videos');
        const deleteRequest = store.delete(clipId);

        deleteRequest.onsuccess = () => resolve();
        deleteRequest.onerror = () => reject(deleteRequest.error);
      };
    });
  }

  /**
   * Check if recording is active
   */
  isActiveRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get current buffer size (number of chunks)
   */
  getBufferSize(): number {
    return this.circularBuffer.length;
  }
}

// Export singleton instance
export const convoyVideoRecorder = new ConvoyVideoRecorder();
