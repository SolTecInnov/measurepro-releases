/**
 * Live Support — Zustand store
 * Global state so the session survives route changes and modal close/open.
 */

import { create } from 'zustand';
import type { SessionDTO, AnnotationMsg, SessionDirection } from './types';

export interface LiveSupportState {
  // Session
  sessionId: string | null;
  session: SessionDTO | null;
  // Connection
  peerConnected: boolean;
  wsConnected: boolean;
  // Media
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  // Annotations
  annotations: Array<AnnotationMsg & { receivedAt: number }>;
  remoteCursor: { x: number; y: number } | null;
  // UI
  modalOpen: boolean;
  endedMessage: string | null;

  // Actions
  setSession: (s: SessionDTO | null) => void;
  setSessionId: (id: string | null) => void;
  setPeerConnected: (v: boolean) => void;
  setWsConnected: (v: boolean) => void;
  setLocalStream: (s: MediaStream | null) => void;
  setRemoteStream: (s: MediaStream | null) => void;
  addAnnotation: (a: AnnotationMsg) => void;
  clearAnnotations: () => void;
  pruneAnnotations: (now: number, ttl: number) => void;
  setRemoteCursor: (c: { x: number; y: number } | null) => void;
  setModalOpen: (v: boolean) => void;
  setEndedMessage: (msg: string | null) => void;
  reset: () => void;
}

export const useLiveSupportStore = create<LiveSupportState>((set) => ({
  sessionId: null,
  session: null,
  peerConnected: false,
  wsConnected: false,
  localStream: null,
  remoteStream: null,
  annotations: [],
  remoteCursor: null,
  modalOpen: false,
  endedMessage: null,

  setSession: (s) => set({ session: s }),
  setSessionId: (id) => set({ sessionId: id }),
  setPeerConnected: (v) => set({ peerConnected: v }),
  setWsConnected: (v) => set({ wsConnected: v }),
  setLocalStream: (s) => set({ localStream: s }),
  setRemoteStream: (s) => set({ remoteStream: s }),
  addAnnotation: (a) => set((state) => ({
    annotations: [...state.annotations, { ...a, receivedAt: Date.now() }],
  })),
  clearAnnotations: () => set({ annotations: [], remoteCursor: null }),
  pruneAnnotations: (now, ttl) => set((state) => ({
    annotations: state.annotations.filter((a) => now - a.receivedAt < ttl),
  })),
  setRemoteCursor: (c) => set({ remoteCursor: c }),
  setModalOpen: (v) => set({ modalOpen: v }),
  setEndedMessage: (msg) => set({ endedMessage: msg }),
  reset: () => set({
    sessionId: null,
    session: null,
    peerConnected: false,
    wsConnected: false,
    localStream: null,
    remoteStream: null,
    annotations: [],
    remoteCursor: null,
    modalOpen: false,
    endedMessage: null,
  }),
}));
