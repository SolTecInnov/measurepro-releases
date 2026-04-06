import { useCameraStore, VideoRecording } from '../camera';
import { toast } from 'sonner';

/**
 * Class to handle video recording with a circular buffer
 */
export class VideoRecorder {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private startTime: number = 0;
  private bufferInterval: number | null = null;
  private bufferSegments: { blob: Blob, timestamp: number }[] = [];
  private bufferDuration: number = 5000; // 5 seconds in ms
  private segmentDuration: number = 1000; // 1 second segments
  private videoElement: HTMLVideoElement | null = null;
  private onRecordingComplete: ((recording: VideoRecording) => void) | null = null;

  /**
   * Initialize the video recorder with a media stream
   * @param stream - MediaStream from camera
   * @param videoElement - Optional video element to display the stream
   */
  public initialize(stream: MediaStream, videoElement?: HTMLVideoElement): void {
    this.stream = stream;
    this.videoElement = videoElement || null;
    
    // Set up video element if provided
    if (this.videoElement) {
      this.videoElement.srcObject = stream;
      this.videoElement.muted = true; // Prevent feedback
    }
    
    // Get buffer duration from store
    this.bufferDuration = useCameraStore.getState().videoBufferDuration * 1000;
  }

  /**
   * Start recording with buffer
   */
  public startRecording(): void {
    if (!this.stream) {
      return;
    }
    
    if (this.isCurrentlyRecording()) {
      return;
    }
    
    this.startTime = Date.now();
    this.bufferSegments = [];
    
    // Set up MediaRecorder
    const options = { mimeType: 'video/webm;codecs=vp9' };
    try {
      this.mediaRecorder = new MediaRecorder(this.stream, options);
    } catch (e) {
      // Try with different options
      try {
        this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: 'video/webm' });
      } catch (e) {
        return;
      }
    }
    
    // Set up event handlers
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        // Add to buffer segments with timestamp
        this.bufferSegments.push({
          blob: event.data,
          timestamp: Date.now()
        });
        
        // Maintain buffer size
        this.pruneBuffer();
      }
    };
    
    // Start recording with small segment size for better buffer control
    this.mediaRecorder.start(this.segmentDuration);
    
    useCameraStore.getState().setIsRecording(true);
  }

  /**
   * Stop recording and save the buffer
   * @returns Promise that resolves with the recording data
   */
  public async stopRecording(): Promise<VideoRecording | null> {
    if (!this.isCurrentlyRecording() || !this.mediaRecorder) {
      return null;
    }
    
    return new Promise((resolve) => {
      // Request any pending data before stopping to ensure all recorded data is captured
      if (this.mediaRecorder!.state === 'recording') {
        this.mediaRecorder!.requestData();
      }
      
      // Stop the media recorder
      this.mediaRecorder!.onstop = async () => {
        // Wait a bit for the final ondataavailable to fire
        await new Promise(r => setTimeout(r, 200));
        
        // Combine all buffer segments into a single blob
        const allChunks: Blob[] = this.bufferSegments.map(segment => segment.blob);
        if (allChunks.length === 0) {
          toast.error('No video data captured. Recording may have been too short.');
          useCameraStore.getState().setIsRecording(false);
          resolve(null);
          return;
        }
        
        const videoBlob = new Blob(allChunks, { type: 'video/webm' });
        const duration = (Date.now() - this.startTime) / 1000;
        
        // Generate thumbnail from the video
        const thumbnailUrl = await this.generateThumbnail(videoBlob);
        
        // Create recording object
        const recording: VideoRecording = {
          id: crypto.randomUUID(),
          videoBlob,
          thumbnailUrl,
          timestamp: new Date().toISOString(),
          duration,
          metadata: {
            // Metadata will be filled by the caller
          }
        };
        
        // Reset state
        this.bufferSegments = [];
        useCameraStore.getState().setIsRecording(false);
        
        // Add to store
        useCameraStore.getState().addVideoToBuffer(recording);
        
        // Call completion callback if set
        if (this.onRecordingComplete) {
          this.onRecordingComplete(recording);
        }
        
        resolve(recording);
      };
      
      // Stop the recorder
      this.mediaRecorder!.stop();
    });
  }

  /**
   * Save the current buffer as a video (for object detection)
   * @returns Promise that resolves with the recording data
   */
  public async saveBuffer(): Promise<VideoRecording | null> {
    if (!this.isCurrentlyRecording() || !this.mediaRecorder) {
      return null;
    }
    
    try {
      // Only request data if MediaRecorder is in recording state
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.requestData();
      }
    
      // Wait a moment for the data to be processed
      await new Promise(resolve => setTimeout(resolve, 100));
    
      // Combine all buffer segments into a single blob
      const allChunks: Blob[] = this.bufferSegments.map(segment => segment.blob);
      if (allChunks.length === 0) {
        return null;
      }
    
      const videoBlob = new Blob(allChunks, { type: 'video/webm' });
      const duration = this.bufferDuration / 1000; // Convert ms to seconds
    
      // Generate thumbnail from the video
      const thumbnailUrl = await this.generateThumbnail(videoBlob);
    
      // Create recording object
      const recording: VideoRecording = {
        id: crypto.randomUUID(),
        videoBlob,
        thumbnailUrl,
        timestamp: new Date().toISOString(),
        duration,
        metadata: {
          // Metadata will be filled by the caller
        }
      };
    
      // Add to store
      useCameraStore.getState().addVideoToBuffer(recording);
    
      return recording;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate a thumbnail from a video blob
   * @param videoBlob - The video blob
   * @returns Promise that resolves with the thumbnail URL
   */
  private async generateThumbnail(videoBlob: Blob): Promise<string> {
    return new Promise((resolve) => {
      // Create a temporary container and video element
      let container: HTMLDivElement | null = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;';
      document.body.appendChild(container);

      let video: HTMLVideoElement | null = document.createElement('video');
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.muted = true;
      video.autoplay = false;
      video.preload = 'metadata';
      container.appendChild(video);
      
      // Set up timeout to prevent hanging
      const timeoutId = window.setTimeout(() => {
        if (container && video) {
          cleanupAndResolve('');
        }
      }, 10000);

      // Cleanup function
      const cleanupAndResolve = (thumbnailUrl: string) => {
        window.clearTimeout(timeoutId);
        
        // Clean up video element
        if (video) {
          if (video.src) {
            video.pause();
            video.removeAttribute('src');
            video.load(); // Force release of resources
            URL.revokeObjectURL(video.src);
          }
          
          // Remove event listeners
          video.onloadedmetadata = null;
          video.onloadeddata = null;
          video.onseeked = null;
          video.onerror = null;
        }
        
        // Remove container from DOM
        if (container && container.parentNode) {
          container.parentNode.removeChild(container);
        }
        
        // Clear references
        video = null;
        container = null;
        
        resolve(thumbnailUrl);
      };

      // Handle video loading errors
      video.onerror = (event) => {
        cleanupAndResolve('');
      };

      // When video data is loaded, seek to position
      video.onloadeddata = () => {
        if (!video || !video.videoWidth || !video.videoHeight) {
          cleanupAndResolve('');
          return;
        }

        try {
          // Seek to 1/3 of the video or 1 second, whichever is less
          const seekTime = Math.min(video.duration / 3, 1.0);
          video.currentTime = seekTime;
        } catch (err) {
          cleanupAndResolve('');
        }
      };

      // When the video has seeked to the desired position
      video.onseeked = function() {
        if (!video) {
          cleanupAndResolve('');
          return;
        }
        
        // Double check video dimensions and readiness
        if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
          cleanupAndResolve('');
          return;
        }

        try {
          // Create canvas with verified video dimensions
          const canvas = document.createElement('canvas');
          const width = video.videoWidth;
          const height = video.videoHeight;
          
          // Verify dimensions one final time
          if (width <= 0 || height <= 0) {
            throw new Error('Invalid video dimensions');
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Could not get canvas context');
          }

          try {
            // Draw the video frame
            ctx.drawImage(video, 0, 0, width, height);
          } catch (drawError) {
            cleanupAndResolve('');
            return;
          }
          
          // Convert to data URL with moderate quality
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
          cleanupAndResolve(thumbnailUrl);
        } catch (error) {
          cleanupAndResolve('');
        }
      };

      // Set up metadata handler
      video.onloadedmetadata = () => {
        if (!video) return;
        
        // If we have valid dimensions, proceed to load data
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          try {
            video.play().then(() => {
              if (video) video.pause();
            }).catch(err => {
              // Silent fail
            });
          } catch (err) {
            // Silent fail
          }
        } else {
          cleanupAndResolve('');
        }
      };

      // Load the video with error handling
      try {
        const videoUrl = URL.createObjectURL(videoBlob);
        video.src = videoUrl;
        
        // Explicitly load the video
        video.load();
      } catch (error) {
        cleanupAndResolve('');
      }
    });
  }

  /**
   * Remove old segments to maintain buffer duration
   */
  private pruneBuffer(): void {
    if (this.bufferSegments.length === 0) return;
    
    const now = Date.now();
    const bufferStartTime = now - this.bufferDuration;
    
    // Remove segments older than buffer duration
    this.bufferSegments = this.bufferSegments.filter(segment => 
      segment.timestamp >= bufferStartTime
    );
  }

  /**
   * Set callback for when recording is complete
   * @param callback - Function to call with recording data
   */
  public setOnRecordingComplete(callback: (recording: VideoRecording) => void): void {
    this.onRecordingComplete = callback;
  }

  /**
   * Check if currently recording
   * @returns True if recording, false otherwise
   */
  public isCurrentlyRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  /**
   * Set buffer duration
   * @param duration - Duration in seconds
   */
  public setBufferDuration(duration: number): void {
    this.bufferDuration = duration * 1000; // Convert to ms
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.mediaRecorder && this.isCurrentlyRecording()) {
      this.mediaRecorder.stop();
    }
    
    this.bufferSegments = [];
    
    if (this.bufferInterval) {
      clearInterval(this.bufferInterval);
      this.bufferInterval = null;
    }
    
    useCameraStore.getState().setIsRecording(false);
  }
}

// Create a singleton instance
export const videoRecorder = new VideoRecorder();