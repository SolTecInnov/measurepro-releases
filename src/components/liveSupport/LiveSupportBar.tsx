/**
 * LiveSupportBar — persistent floating bar (bottom-right) when a session is active
 * but the modal is closed. Lets user reopen or end without losing the session.
 */

import React from 'react';
import { Phone, PhoneOff, Maximize2 } from 'lucide-react';
import { useLiveSupportStore } from '@/lib/liveSupport/liveSupportStore';
import { endSession } from '@/lib/liveSupport/client';

const LiveSupportBar: React.FC = () => {
  const sessionId = useLiveSupportStore((s) => s.sessionId);
  const session = useLiveSupportStore((s) => s.session);
  const modalOpen = useLiveSupportStore((s) => s.modalOpen);
  const peerConnected = useLiveSupportStore((s) => s.peerConnected);
  const setModalOpen = useLiveSupportStore((s) => s.setModalOpen);

  // Only show when session exists and modal is closed
  if (!sessionId || !session || modalOpen) return null;
  // Don't show for ended/expired
  if (session.state === 'ended' || session.state === 'expired') return null;

  const handleEnd = async () => {
    try {
      await endSession(sessionId);
    } catch { /* WS will notify */ }
  };

  const stateLabel = {
    pending: 'Waiting for agent...',
    'awaiting-approval': 'Agent requesting access',
    active: 'Live session active',
  }[session.state] || session.state;

  return (
    <div className="fixed bottom-4 right-4 z-[8999] bg-gray-900 border border-gray-600 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 min-w-[280px]">
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${
          session.state === 'active' ? 'bg-green-500 animate-pulse' :
          session.state === 'awaiting-approval' ? 'bg-amber-500 animate-pulse' :
          'bg-blue-500'
        }`} />
        <div>
          <div className="text-sm font-medium text-white">{stateLabel}</div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            {session.state === 'active' && (
              <span className={peerConnected ? 'text-green-400' : 'text-amber-400'}>
                {peerConnected ? 'Agent connected' : 'Agent disconnected'}
              </span>
            )}
            {session.state !== 'active' && (
              <span>Code: {session.id}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      {/* Open modal */}
      <button
        onClick={() => setModalOpen(true)}
        className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
        title="Open session"
      >
        <Maximize2 className="w-4 h-4 text-gray-300" />
      </button>

      {/* End */}
      <button
        onClick={handleEnd}
        className="p-2 bg-red-600/20 hover:bg-red-600/40 rounded-lg"
        title="End session"
      >
        <PhoneOff className="w-4 h-4 text-red-400" />
      </button>
    </div>
  );
};

export default LiveSupportBar;
