/**
 * GNSS Recording Store
 * Global state for GNSS profile recording status
 * Allows any component to check if profile recording is active
 * 
 * Uses persistent subscription to the recording buffer to stay
 * updated even when the profile recording hook unmounts
 */

import { create } from 'zustand';
import { getProfileRecordingBuffer } from '@/lib/roadProfile';

interface GnssRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  pointCount: number;
  totalDistance_m: number;
  sessionId: string | null;
  startTime: Date | null;
  isSubscribed: boolean;
  
  setRecording: (isRecording: boolean) => void;
  setPaused: (isPaused: boolean) => void;
  updateStats: (pointCount: number, totalDistance_m: number) => void;
  startSession: (sessionId: string) => void;
  endSession: () => void;
  initSubscription: () => void;
}

export const useGnssRecordingStore = create<GnssRecordingState>((set, get) => ({
  isRecording: false,
  isPaused: false,
  pointCount: 0,
  totalDistance_m: 0,
  sessionId: null,
  startTime: null,
  isSubscribed: false,
  
  setRecording: (isRecording) => set({ isRecording }),
  setPaused: (isPaused) => set({ isPaused }),
  updateStats: (pointCount, totalDistance_m) => set({ pointCount, totalDistance_m }),
  startSession: (sessionId) => set({ 
    sessionId, 
    isRecording: true, 
    isPaused: false,
    startTime: new Date(),
    pointCount: 0,
    totalDistance_m: 0
  }),
  endSession: () => set({ 
    sessionId: null, 
    isRecording: false, 
    isPaused: false,
    startTime: null,
    pointCount: 0,
    totalDistance_m: 0
  }),
  
  initSubscription: () => {
    if (get().isSubscribed) return;
    
    const buffer = getProfileRecordingBuffer();
    buffer.subscribe((event) => {
      switch (event.type) {
        case 'state':
          const state = event.data.state;
          set({ 
            isRecording: state === 'recording',
            isPaused: state === 'paused'
          });
          if (state === 'idle') {
            set({ 
              pointCount: 0, 
              totalDistance_m: 0,
              sessionId: null,
              startTime: null
            });
          }
          break;
        case 'stats':
          set({ 
            pointCount: event.data.pointCount,
            totalDistance_m: event.data.totalDistance_m
          });
          break;
      }
    });
    
    set({ isSubscribed: true });
  }
}));

// Initialize subscription immediately when module loads
// This ensures the store stays updated regardless of component mounting
if (typeof window !== 'undefined') {
  setTimeout(() => {
    useGnssRecordingStore.getState().initSubscription();
  }, 100);
}
