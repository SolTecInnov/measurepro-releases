/**
 * LiveSupportModal — main UI for the Live Support feature.
 * Shows session code, approve/deny, active session view, and end controls.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { X, Copy, Check, Phone, PhoneOff, Monitor, ArrowLeftRight, Loader2 } from 'lucide-react';
import { useLiveSupportStore } from '@/lib/liveSupport/liveSupportStore';
import { createSession, approveSession, denySession, endSession, swapDirection } from '@/lib/liveSupport/client';
import { PeerManager } from '@/lib/liveSupport/peerManager';
import { SESSION_END_DISPLAY_MS } from '@/lib/liveSupport/types';
import type { WsInboundMsg } from '@/lib/liveSupport/types';
import AnnotationCanvas from './AnnotationCanvas';

// Singleton peer manager — survives modal unmount
let peerManager: PeerManager | null = null;

const LiveSupportModal: React.FC = () => {
  const store = useLiveSupportStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [videoSize, setVideoSize] = useState({ width: 640, height: 480 });

  // Attach remote stream to video element
  useEffect(() => {
    if (videoRef.current && store.remoteStream) {
      videoRef.current.srcObject = store.remoteStream;
    }
  }, [store.remoteStream]);

  // Attach local preview
  useEffect(() => {
    if (localVideoRef.current && store.localStream) {
      localVideoRef.current.srcObject = store.localStream;
    }
  }, [store.localStream]);

  // Auto-close after session ended
  useEffect(() => {
    if (store.endedMessage) {
      const timer = setTimeout(() => {
        store.setEndedMessage(null);
        store.setModalOpen(false);
        store.reset();
      }, SESSION_END_DISPLAY_MS);
      return () => clearTimeout(timer);
    }
  }, [store.endedMessage]);

  const handleStart = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const session = await createSession();
      store.setSessionId(session.id);
      store.setSession(session);

      // Connect WebSocket
      peerManager = new PeerManager(session.id, (_msg: WsInboundMsg) => {
        // Messages are handled by PeerManager internally via the store
      });
      await peerManager.connect();
    } catch (err: any) {
      setError(err.message || 'Failed to start session');
    }
    setLoading(false);
  }, []);

  const handleApprove = useCallback(async () => {
    if (!store.sessionId) return;
    try {
      await approveSession(store.sessionId);
    } catch (err: any) {
      setError(err.message);
    }
  }, [store.sessionId]);

  const handleDeny = useCallback(async () => {
    if (!store.sessionId) return;
    try {
      await denySession(store.sessionId);
      peerManager?.destroy();
      peerManager = null;
    } catch (err: any) {
      setError(err.message);
    }
  }, [store.sessionId]);

  const handleEnd = useCallback(async () => {
    if (!store.sessionId) return;
    try {
      await endSession(store.sessionId);
    } catch { /* WS will notify */ }
    peerManager?.destroy();
    peerManager = null;
  }, [store.sessionId]);

  const handleSwap = useCallback(async () => {
    if (!store.sessionId) return;
    try {
      await swapDirection(store.sessionId);
    } catch (err: any) {
      setError(err.message);
    }
  }, [store.sessionId]);

  const handleCopyCode = () => {
    if (store.session?.id) {
      navigator.clipboard.writeText(store.session.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    store.setModalOpen(false);
    // Don't destroy — keep session alive, floating bar shows
  };

  if (!store.modalOpen) return null;

  const state = store.session?.state;
  const direction = store.session?.direction;
  const iAmPresenter = direction === 'user-to-admin';

  return (
    <div className="fixed inset-0 z-[9000] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-bold text-white">Live Support</h2>
          </div>
          <button onClick={handleClose} className="p-1 hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Session ended message */}
          {store.endedMessage && (
            <div className="text-center py-12">
              <PhoneOff className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-300 text-lg">{store.endedMessage}</p>
              <p className="text-gray-500 text-sm mt-2">Closing automatically...</p>
            </div>
          )}

          {/* No session — Start */}
          {!store.sessionId && !store.endedMessage && (
            <div className="text-center py-8">
              <Monitor className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Need help?</h3>
              <p className="text-gray-400 mb-6 max-w-sm mx-auto">
                Start a live support session. You'll get a code to share with our support team.
              </p>
              <button
                onClick={handleStart}
                disabled={loading}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 rounded-xl text-white font-bold flex items-center gap-2 mx-auto"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Phone className="w-5 h-5" />}
                {loading ? 'Starting...' : 'Start Session'}
              </button>
            </div>
          )}

          {/* Pending — show code */}
          {state === 'pending' && (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">Share this code with support:</p>
              <div className="flex items-center justify-center gap-3 mb-4">
                <code className="text-3xl font-mono font-bold text-orange-400 tracking-wider bg-gray-800 px-6 py-3 rounded-xl select-all">
                  {store.session!.id}
                </code>
                <button onClick={handleCopyCode} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg">
                  {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-gray-400" />}
                </button>
              </div>
              <p className="text-gray-500 text-sm">Waiting for an agent to connect...</p>
              <p className="text-gray-600 text-xs mt-2">Session expires in 5 minutes</p>
              <button
                onClick={handleEnd}
                className="mt-6 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Awaiting approval */}
          {state === 'awaiting-approval' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Agent wants to join</h3>
              <p className="text-gray-400 mb-6">
                <strong className="text-white">{store.session?.adminEmail}</strong> is requesting access to your session.
              </p>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleApprove}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-xl text-white font-bold flex items-center gap-2"
                >
                  <Check className="w-5 h-5" /> Approve
                </button>
                <button
                  onClick={handleDeny}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl text-white font-bold flex items-center gap-2"
                >
                  <X className="w-5 h-5" /> Deny
                </button>
              </div>
            </div>
          )}

          {/* Active session */}
          {state === 'active' && !store.endedMessage && (
            <div>
              {/* Viewer mode — show remote stream */}
              {!iAmPresenter && store.remoteStream && (
                <div className="relative bg-black rounded-xl overflow-hidden mb-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        setVideoSize({
                          width: videoRef.current.videoWidth || 640,
                          height: videoRef.current.videoHeight || 480,
                        });
                      }
                    }}
                    className="w-full"
                  />
                  <AnnotationCanvas width={videoSize.width} height={videoSize.height} />
                </div>
              )}

              {/* Presenter mode — show local preview */}
              {iAmPresenter && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm text-gray-400">Sharing your screen</span>
                  </div>
                  {store.localStream && (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-48 rounded-lg border border-gray-700"
                    />
                  )}
                </div>
              )}

              {/* Peer status */}
              {!store.peerConnected && (
                <div className="text-center py-4 text-amber-400 text-sm">
                  Agent disconnected, waiting for reconnection...
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center justify-center gap-3 pt-4 border-t border-gray-700">
                <button
                  onClick={handleSwap}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 flex items-center gap-2"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Swap Direction
                </button>
                <button
                  onClick={handleEnd}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white font-bold flex items-center gap-2"
                >
                  <PhoneOff className="w-4 h-4" />
                  End Session
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveSupportModal;
