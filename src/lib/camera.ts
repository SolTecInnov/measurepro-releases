import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ICamera } from './camera/CameraInterface';

// Define the type for captured images
export interface CapturedImage {
  imageUrl: string;
  timestamp: string;
  metadata?: {
    latitude?: number;
    longitude?: number;
    height?: number;
    poiId?: string;
  };
}

// Define the type for video recording
export interface VideoRecording {
  id: string;
  videoBlob: Blob;
  videoBlobId?: string;
  thumbnailUrl: string;
  timestamp: string;
  duration: number;
  metadata?: {
    latitude?: number;
    longitude?: number;
    height?: number;
    poiId?: string;
  };
}

// Define the type for timelapse frame with POI tracking
export interface TimelapseFrame {
  id: string;
  imageUrl: string;
  timestamp: string;
  frameNumber: number;
  metadata?: {
    latitude?: number;
    longitude?: number;
    height?: number;
    poiId?: string;
  };
  // POI/Measurement tracking for emphasis in viewer
  associatedPOIs?: {
    id: string;
    poiType: string;
    poiNumber: number;
    roadNumber: number;
    note?: string;
    timestamp: string;
  }[];
  hasPOI?: boolean; // Quick flag for UI filtering
}

// Define timelapse settings
export interface TimelapseSettings {
  interval: number; // Seconds between captures
  quality: number; // 0-1, JPEG quality
  includeOverlay: boolean; // Whether to include metadata overlay
  autoSave: boolean; // Auto-save frames to disk
}

// Multi-camera position settings
export type CameraPosition = 'front' | 'left' | 'right' | 'rear';

export interface MultiCameraSettings {
  front: string; // deviceId for front camera
  left: string; // deviceId for left camera
  right: string; // deviceId for right camera
  rear: string; // deviceId for rear camera
}

// Define the camera store interface
interface CameraStore {
  selectedCamera: string;
  
  // Multi-camera position settings
  multiCameraSettings: MultiCameraSettings;
  imageSize: { width: number; height: number };
  imageFormat: 'image/jpeg' | 'image/png';
  overlayOptions: {
    enabled: boolean;
    showPOI: boolean;
    showPOIType: boolean;
    showGPS: boolean;
    showHeight: boolean;
    showDateTime: boolean;
    showHeading: boolean;
    showLogo: boolean;
    showText: boolean;
    showSurveyTitle: boolean;
    showProjectNumber: boolean;
    showSurveyorName: boolean;
    showPOINotes: boolean;
  };
  overlayFields: {
    surveyTitle: string;
    projectNumber: string;
    surveyorName: string;
    poiNotes: string;
    poi: string;
    poiType: string;
  };
  capturedImage: string | null;
  autoCapture: boolean;
  previewEnabled: boolean;
  videoMode: boolean;
  videoBuffer: VideoRecording[];
  isRecording: boolean;
  recordingDuration: number;
  videoBufferDuration: number;
  displayMode: 'fit' | 'fill';
  activeStream: MediaStream | null;
  
  // Timelapse state
  isTimelapseActive: boolean;
  timelapseSettings: TimelapseSettings;
  timelapseFrames: TimelapseFrame[];
  timelapseStartTime: string | null;
  
  // Camera type and connection state
  cameraType: 'standard' | 'zed2i' | null;
  isAutoDetected: boolean;
  isCameraConnected: boolean;
  
  // Disconnect tracking
  lastDisconnectReason: string | null;
  reconnectionAttempts: number;
  
  // Live overlay visibility (separate from capture overlay options)
  showLiveOverlay: boolean;
  
  // Shared camera instance
  activeCamera: ICamera | null;
  
  setSelectedCamera: (deviceId: string) => void;
  setImageSize: (width: number, height: number) => void;
  setImageFormat: (format: 'image/jpeg' | 'image/png') => void;
  setOverlayOptions: (options: Partial<CameraStore['overlayOptions']>) => void;
  setOverlayFields: (fields: Partial<CameraStore['overlayFields']>) => void;
  setCapturedImage: (image: string | null) => void;
  setAutoCapture: (enabled: boolean) => void;
  setPreviewEnabled: (enabled: boolean) => void;
  setVideoMode: (enabled: boolean) => void;
  setIsRecording: (recording: boolean) => void;
  setRecordingDuration: (duration: number) => void;
  setVideoBufferDuration: (duration: number) => void;
  setDisplayMode: (mode: 'fit' | 'fill') => void;
  setActiveStream: (stream: MediaStream | null) => void;
  addVideoToBuffer: (video: VideoRecording) => void;
  clearVideoBuffer: () => void;
  getLastVideoFromBuffer: () => VideoRecording | null;
  saveVideoBlobToDB: (blob: Blob) => Promise<string>;
  getVideoBlobFromDB: (id: string) => Promise<Blob | null>;
  syncOverlayFromSurvey: (survey: any | null) => void;
  
  // Timelapse methods
  setTimelapseActive: (active: boolean) => void;
  setTimelapseSettings: (settings: Partial<TimelapseSettings>) => void;
  addTimelapseFrame: (frame: TimelapseFrame) => void;
  clearTimelapseFrames: () => void;
  setTimelapseStartTime: (time: string | null) => void;
  
  // Camera type and connection methods
  setCameraType: (type: 'standard' | 'zed2i' | null) => void;
  setIsAutoDetected: (detected: boolean) => void;
  setCameraConnected: (connected: boolean) => void;
  
  // Disconnect tracking methods
  setLastDisconnectReason: (reason: string | null) => void;
  setReconnectionAttempts: (count: number) => void;
  
  // Shared camera instance methods
  setActiveCamera: (camera: ICamera | null) => void;
  
  // Live overlay visibility
  setShowLiveOverlay: (show: boolean) => void;
  
  // Multi-camera settings
  setMultiCameraSettings: (settings: Partial<MultiCameraSettings>) => void;
  getCameraForPosition: (position: CameraPosition) => string;
}

import { saveVideoBlob } from './db';

export const useCameraStore = create<CameraStore>()(persist((set, get) => ({
  selectedCamera: '',
  
  // Multi-camera position defaults (empty = use default/front camera)
  multiCameraSettings: {
    front: '',
    left: '',
    right: '',
    rear: '',
  },
  imageSize: { width: 1280, height: 720 },
  imageFormat: 'image/jpeg' as 'image/jpeg' | 'image/png',
  overlayOptions: {
    enabled: true,
    showPOI: true,
    showPOIType: true,
    showGPS: true,
    showHeight: true,
    showDateTime: true,
    showHeading: false,
    showLogo: true,
    showText: false,
    showSurveyTitle: true,
    showProjectNumber: true,
    showSurveyorName: true,
    showPOINotes: false,
  },
  overlayFields: {
    surveyTitle: '',
    projectNumber: '',
    surveyorName: '',
    poiNotes: '',
    poi: '',
    poiType: '',
  },
  capturedImage: null,
  autoCapture: true,
  previewEnabled: false,
  videoMode: false,
  videoBuffer: [],
  isRecording: false,
  recordingDuration: 10, // Default recording duration in seconds
  videoBufferDuration: 5, // Default buffer duration in seconds (prior to detection)
  displayMode: 'fit', // Default to fit mode (shows full image with black bars if needed)
  activeStream: null,
  
  // Timelapse defaults
  isTimelapseActive: false,
  timelapseSettings: {
    interval: 5, // 5 seconds default
    quality: 0.9, // High quality
    includeOverlay: true,
    // Auto-save default depends on user type (false for beta, true for full license)
    // Will be initialized on first load by checking beta status
    autoSave: false, // Default to false (beta-safe default)
  },
  timelapseFrames: [],
  timelapseStartTime: null,
  
  // Camera type and connection defaults
  cameraType: null,
  isAutoDetected: false,
  isCameraConnected: false,
  
  // Disconnect tracking defaults
  lastDisconnectReason: null,
  reconnectionAttempts: 0,
  
  // Live overlay visibility default
  showLiveOverlay: true,
  
  // Shared camera instance default
  activeCamera: null,
  
  setSelectedCamera: (deviceId) => set({ selectedCamera: deviceId }),
  setImageSize: (width, height) => set({ imageSize: { width, height } }),
  setImageFormat: (format) => set({ imageFormat: format as 'image/jpeg' | 'image/png' }),
  setOverlayOptions: (options) => set((state) => ({
    overlayOptions: { ...state.overlayOptions, ...options }
  })),
  setOverlayFields: (fields) => set((state) => ({
    overlayFields: { ...state.overlayFields, ...fields }
  })),
  setCapturedImage: (image) => set({ capturedImage: image }),
  setAutoCapture: (enabled) => set({ autoCapture: enabled }),
  setPreviewEnabled: (enabled) => set({ previewEnabled: enabled }),
  setVideoMode: (enabled) => set({ videoMode: enabled }),
  setIsRecording: (recording) => set({ isRecording: recording }),
  setRecordingDuration: (duration) => set({ recordingDuration: duration }),
  setVideoBufferDuration: (duration) => set({ videoBufferDuration: duration }),
  setDisplayMode: (mode) => set({ displayMode: mode }),
  setActiveStream: (stream) => set({ activeStream: stream }),
  addVideoToBuffer: async (video) => {
    // Save the blob to IndexedDB and get the ID
    let videoBlobId: string | undefined;
    try {
      videoBlobId = await saveVideoBlob(video.videoBlob);
    } catch (error) {
    }
    
    set((state) => {
    // Keep only the most recent videos up to the buffer duration
    if (!video) {
      return state;
    }
    
    try {
      // Create a safe copy of the video object to ensure it's serializable
      const safeVideo = {
        ...video,
        videoBlobId,
        // Ensure videoBlob is a valid Blob
        videoBlob: video.videoBlob instanceof Blob ? 
          video.videoBlob : 
          new Blob([], { type: 'video/webm' })
      };
      
      const newBuffer = [...state.videoBuffer, safeVideo];
      // Sort by timestamp (newest first)
      newBuffer.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      // Limit buffer size (rough estimate based on number of clips)
      const maxBufferSize = Math.ceil(state.videoBufferDuration / (state.recordingDuration / 60)) + 1;
      return { videoBuffer: newBuffer.slice(0, maxBufferSize) };
    } catch (error) {
      return state;
    }
    });
  },
  clearVideoBuffer: () => set({ videoBuffer: [] }),
  getLastVideoFromBuffer: (): VideoRecording | null => {
    const state = useCameraStore.getState();
    if (state.videoBuffer.length === 0) return null;
    return state.videoBuffer[0]; // Return the most recent video (already sorted)
  },
  saveVideoBlobToDB: async (blob: Blob) => {
    // Use localStorage instead of IndexedDB
    const id = crypto.randomUUID();
    const videoUrl = URL.createObjectURL(blob);
    localStorage.setItem(`video_blob_${id}`, videoUrl);
    return id;
  },
  getVideoBlobFromDB: async (id: string) => {
    // Get from localStorage
    const videoUrl = localStorage.getItem(`video_blob_${id}`);
    if (videoUrl) {
      try {
        const response = await fetch(videoUrl);
        return await response.blob();
      } catch (error) {
        return null;
      }
    }
    return null;
  },
  syncOverlayFromSurvey: (survey) => {
    if (survey) {
      set((state) => ({
        overlayFields: {
          ...state.overlayFields,
          surveyTitle: survey.surveyTitle || survey.name || '',
          projectNumber: survey.projectNumber || '',
          surveyorName: survey.surveyorName || survey.surveyor || '',
          // Keep POI notes manual - don't sync from survey
        }
      }));
    }
    // When survey is null, keep existing manual values (don't clear them)
  },
  
  // Timelapse methods
  setTimelapseActive: (active) => set({ 
    isTimelapseActive: active,
    timelapseStartTime: active ? new Date().toISOString() : null
  }),
  setTimelapseSettings: (settings) => set((state) => ({
    timelapseSettings: { ...state.timelapseSettings, ...settings }
  })),
  addTimelapseFrame: (frame) => set((state) => ({
    timelapseFrames: [...state.timelapseFrames, frame]
  })),
  clearTimelapseFrames: () => set({ 
    timelapseFrames: [],
    timelapseStartTime: null
  }),
  setTimelapseStartTime: (time) => set({ timelapseStartTime: time }),
  
  // Camera type and connection methods
  setCameraType: (type) => set({ cameraType: type }),
  setIsAutoDetected: (detected) => set({ isAutoDetected: detected }),
  setCameraConnected: (connected) => set({ isCameraConnected: connected }),
  
  // Disconnect tracking methods
  setLastDisconnectReason: (reason) => set({ lastDisconnectReason: reason }),
  setReconnectionAttempts: (count) => set({ reconnectionAttempts: count }),
  
  // Shared camera instance methods
  setActiveCamera: (camera) => set({ activeCamera: camera }),
  
  // Live overlay visibility
  setShowLiveOverlay: (show) => set({ showLiveOverlay: show }),
  
  // Multi-camera settings
  setMultiCameraSettings: (settings) => set((state) => ({
    multiCameraSettings: { ...state.multiCameraSettings, ...settings }
  })),
  getCameraForPosition: (position) => {
    const state = get();
    const positionCamera = state.multiCameraSettings[position];
    // If position has a camera assigned, use it; otherwise fall back to front camera or selected camera
    if (positionCamera) return positionCamera;
    if (position === 'front') return state.selectedCamera;
    // For other positions, fall back to front camera if available, otherwise selected camera
    return state.multiCameraSettings.front || state.selectedCamera;
  }
}), {
  name: 'camera-settings',
  // Only persist settings, not large data like images/videos
  partialize: (state) => ({
    selectedCamera: state.selectedCamera,
    multiCameraSettings: state.multiCameraSettings,
    imageSize: state.imageSize,
    imageFormat: state.imageFormat,
    overlayOptions: state.overlayOptions,
    overlayFields: state.overlayFields,
    autoCapture: state.autoCapture,
    previewEnabled: state.previewEnabled,
    videoMode: state.videoMode,
    videoBufferDuration: state.videoBufferDuration,
    displayMode: state.displayMode,
    timelapseSettings: state.timelapseSettings,
    cameraType: state.cameraType,
    isAutoDetected: state.isAutoDetected,
    showLiveOverlay: state.showLiveOverlay,
    // Note: isCameraConnected is not persisted - connection state is runtime only
    // Explicitly exclude large data:
    // - videoBuffer (videos are in IndexedDB)
    // - timelapseFrames (images are large)
    // - capturedImage (can be large base64)
    // - activeStream (not serializable)
  }),
  // Modern storage option (replaces deprecated serialize/deserialize)
  storage: {
    getItem: (name) => {
      const str = localStorage.getItem(name);
      if (!str) return null;
      try {
        return JSON.parse(str);
      } catch (error) {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        localStorage.setItem(name, JSON.stringify(value));
      } catch (error) {
        // If quota exceeded, try clearing old data and retry
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          localStorage.removeItem(name);
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (retryError) {
          }
        }
      }
    },
    removeItem: (name) => {
      localStorage.removeItem(name);
    }
  }
}));