/**
 * Live Support — Type definitions
 * Matches the RoadScope backend contract exactly.
 */

// ── Session ──────────────────────────────────────────────────────────────────

export type SessionState = 'pending' | 'awaiting-approval' | 'active' | 'ended' | 'expired';
export type SessionDirection = 'user-to-admin' | 'admin-to-user';
export type SessionEndedBy = 'user' | 'admin' | 'system';

export interface SessionDTO {
  id: string;
  state: SessionState;
  userId: string;
  userEmail: string;
  adminId?: string;
  adminEmail?: string;
  createdAt: string;
  approvedAt?: string;
  endedAt?: string;
  direction: SessionDirection;
  directionsUsed: string[];
  endedBy?: SessionEndedBy;
  endReason?: string;
}

// ── WebSocket messages (inbound from server) ─────────────────────────────────

export interface WsConnectedMsg {
  type: 'connected';
  session: SessionDTO;
  peerConnected: boolean;
}

export interface WsPeerConnectedMsg {
  type: 'peer-connected';
}

export interface WsPeerDisconnectedMsg {
  type: 'peer-disconnected';
  role: string;
}

export interface WsAdminRequestMsg {
  type: 'admin-request';
  adminEmail: string;
  session: SessionDTO;
}

export interface WsSessionApprovedMsg {
  type: 'session-approved';
  direction: SessionDirection;
  session: SessionDTO;
}

export interface WsDirectionChangedMsg {
  type: 'direction-changed';
  direction: SessionDirection;
  session: SessionDTO;
}

export interface WsSessionEndedMsg {
  type: 'session-ended';
  endedBy: SessionEndedBy;
  endReason?: string;
  session: SessionDTO;
}

// ── WebSocket messages (outbound / relay) ────────────────────────────────────

export interface WsOfferMsg {
  type: 'offer';
  sdp: string;
  from?: string;
}

export interface WsAnswerMsg {
  type: 'answer';
  sdp: string;
  from?: string;
}

export interface WsIceCandidateMsg {
  type: 'ice-candidate';
  candidate: RTCIceCandidateInit | null;
  from?: string;
}

export interface WsReadyMsg {
  type: 'ready';
}

export interface WsByeMsg {
  type: 'bye';
}

// ── Annotation messages (data channel or WS relay) ───────────────────────────

export interface CursorMsg {
  type: 'cursor';
  x: number;
  y: number;
  from?: string;
}

export interface AnnotationMsg {
  type: 'annotation';
  tool: 'cursor' | 'arrow' | 'freehand';
  color: string;
  points: Array<{ x: number; y: number }>;
  id: string;
  createdAt?: number;
  from?: string;
}

export interface AnnotationClearMsg {
  type: 'annotation-clear';
  from?: string;
}

export type WsInboundMsg =
  | WsConnectedMsg
  | WsPeerConnectedMsg
  | WsPeerDisconnectedMsg
  | WsAdminRequestMsg
  | WsSessionApprovedMsg
  | WsDirectionChangedMsg
  | WsSessionEndedMsg
  | WsOfferMsg
  | WsAnswerMsg
  | WsIceCandidateMsg
  | CursorMsg
  | AnnotationMsg
  | AnnotationClearMsg;

export type WsOutboundMsg =
  | WsOfferMsg
  | WsAnswerMsg
  | WsIceCandidateMsg
  | WsReadyMsg
  | WsByeMsg
  | CursorMsg
  | AnnotationMsg
  | AnnotationClearMsg;

// ── Constants ────────────────────────────────────────────────────────────────

export const ANNOTATION_TTL_MS = 5000;
export const CURSOR_THROTTLE_MS = 30;
export const PENDING_TIMEOUT_MS = 5 * 60 * 1000;
export const SESSION_END_DISPLAY_MS = 4000;

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
