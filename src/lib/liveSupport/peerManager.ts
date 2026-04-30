/**
 * Live Support — Peer Manager
 * Orchestrates WebSocket signaling + RTCPeerConnection + RTCDataChannel.
 * Designed as a class (not a hook) so it survives React unmounts.
 */

import { buildWsUrl } from './client';
import { useLiveSupportStore } from './liveSupportStore';
import {
  ICE_SERVERS, ANNOTATION_TTL_MS,
  type WsInboundMsg, type WsOutboundMsg,
  type SessionDTO, type SessionDirection,
} from './types';

type MessageHandler = (msg: WsInboundMsg) => void;

export class PeerManager {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private sessionId: string;
  private onMessage: MessageHandler;
  private reconnectAttempted = false;
  private annotationPruneTimer: ReturnType<typeof setInterval> | null = null;

  constructor(sessionId: string, onMessage: MessageHandler) {
    this.sessionId = sessionId;
    this.onMessage = onMessage;
  }

  // ── WebSocket ────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    const url = await buildWsUrl(this.sessionId);
    this.ws = new WebSocket(url);
    const store = useLiveSupportStore.getState();

    this.ws.onopen = () => {
      store.setWsConnected(true);
      this.reconnectAttempted = false;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WsInboundMsg = JSON.parse(event.data);
        this.handleMessage(msg);
        this.onMessage(msg);
      } catch { /* ignore malformed */ }
    };

    this.ws.onclose = () => {
      store.setWsConnected(false);
      // One reconnect attempt
      if (!this.reconnectAttempted && store.session?.state === 'active') {
        this.reconnectAttempted = true;
        setTimeout(() => this.connect().catch(() => {}), 2000);
      }
    };

    this.ws.onerror = () => { /* onclose will fire */ };

    // Start annotation pruning
    this.annotationPruneTimer = setInterval(() => {
      useLiveSupportStore.getState().pruneAnnotations(Date.now(), ANNOTATION_TTL_MS);
    }, 1000);
  }

  private handleMessage(msg: WsInboundMsg): void {
    const store = useLiveSupportStore.getState();

    switch (msg.type) {
      case 'connected':
        store.setSession(msg.session);
        store.setPeerConnected(msg.peerConnected);
        break;

      case 'peer-connected':
        store.setPeerConnected(true);
        break;

      case 'peer-disconnected':
        store.setPeerConnected(false);
        break;

      case 'admin-request':
        store.setSession(msg.session);
        break;

      case 'session-approved':
        store.setSession(msg.session);
        this.setupPeerConnection(msg.direction);
        break;

      case 'direction-changed':
        store.setSession(msg.session);
        this.teardownPC();
        this.setupPeerConnection(msg.direction);
        break;

      case 'session-ended':
        store.setSession(msg.session);
        store.setEndedMessage(
          msg.endReason || `Session ended by ${msg.endedBy || 'system'}`
        );
        this.teardownPC();
        this.stopCapture();
        break;

      // WebRTC signaling
      case 'offer':
        if (msg.from === 'admin') this.handleOffer(msg.sdp);
        break;
      case 'answer':
        if (msg.from === 'admin') this.handleAnswer(msg.sdp);
        break;
      case 'ice-candidate':
        if (msg.from === 'admin') this.handleIceCandidate(msg.candidate);
        break;

      // Annotations
      case 'cursor':
        if (msg.from === 'admin') store.setRemoteCursor({ x: msg.x, y: msg.y });
        break;
      case 'annotation':
        if (msg.from === 'admin') store.addAnnotation(msg);
        break;
      case 'annotation-clear':
        if (msg.from === 'admin') store.clearAnnotations();
        break;
    }
  }

  // ── WebRTC PeerConnection ────────────────────────────────────────────────

  private setupPeerConnection(direction: SessionDirection): void {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const store = useLiveSupportStore.getState();

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendWs({ type: 'ice-candidate', candidate: event.candidate.toJSON() });
      }
    };

    this.pc.ontrack = (event) => {
      if (event.streams[0]) {
        store.setRemoteStream(event.streams[0]);
      }
    };

    this.pc.ondatachannel = (event) => {
      this.dc = event.channel;
      this.setupDataChannel();
    };

    const iAmPresenter = direction === 'user-to-admin';
    if (iAmPresenter) {
      this.startPresenting();
    }
  }

  private async startPresenting(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15 }, cursor: 'always' } as any,
        audio: false,
      });

      useLiveSupportStore.getState().setLocalStream(stream);

      // Stop sharing when user ends capture via browser/OS UI
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        this.sendWs({ type: 'bye' });
        useLiveSupportStore.getState().setLocalStream(null);
      });

      if (this.pc) {
        for (const track of stream.getTracks()) {
          this.pc.addTrack(track, stream);
        }

        // Create data channel for annotations
        this.dc = this.pc.createDataChannel('annotations');
        this.setupDataChannel();

        // Create and send offer
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        this.sendWs({ type: 'offer', sdp: offer.sdp! });
      }
    } catch (err) {
      console.error('[LiveSupport] Screen capture failed:', err);
    }
  }

  private async handleOffer(sdp: string): Promise<void> {
    if (!this.pc) return;
    await this.pc.setRemoteDescription({ type: 'offer', sdp });
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.sendWs({ type: 'answer', sdp: answer.sdp! });
  }

  private async handleAnswer(sdp: string): Promise<void> {
    if (!this.pc) return;
    await this.pc.setRemoteDescription({ type: 'answer', sdp });
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit | null): Promise<void> {
    if (!this.pc || !candidate) return;
    try {
      await this.pc.addIceCandidate(candidate);
    } catch { /* ignore late candidates */ }
  }

  // ── Data Channel ─────────────────────────────────────────────────────────

  private setupDataChannel(): void {
    if (!this.dc) return;
    this.dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const store = useLiveSupportStore.getState();
        if (msg.type === 'cursor') store.setRemoteCursor({ x: msg.x, y: msg.y });
        else if (msg.type === 'annotation') store.addAnnotation(msg);
        else if (msg.type === 'annotation-clear') store.clearAnnotations();
      } catch { /* ignore */ }
    };
  }

  // ── Send helpers ─────────────────────────────────────────────────────────

  sendData(msg: WsOutboundMsg): void {
    // Prefer data channel when open, fall back to WebSocket
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify(msg));
    } else {
      this.sendWs(msg);
    }
  }

  private sendWs(msg: WsOutboundMsg): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  private teardownPC(): void {
    if (this.dc) {
      try { this.dc.close(); } catch {}
      this.dc = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch {}
      this.pc = null;
    }
    useLiveSupportStore.getState().setRemoteStream(null);
  }

  private stopCapture(): void {
    const stream = useLiveSupportStore.getState().localStream;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      useLiveSupportStore.getState().setLocalStream(null);
    }
  }

  destroy(): void {
    this.sendWs({ type: 'bye' });
    this.teardownPC();
    this.stopCapture();
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    if (this.annotationPruneTimer) {
      clearInterval(this.annotationPruneTimer);
      this.annotationPruneTimer = null;
    }
    useLiveSupportStore.getState().reset();
  }
}
