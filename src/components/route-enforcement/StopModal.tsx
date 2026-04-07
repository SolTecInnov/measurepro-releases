import { useEffect, useRef } from 'react';
import { AlertTriangle, Phone, MapPin, Radio } from 'lucide-react';
import { soundManager } from '@/lib/sounds';

interface StopModalProps {
  isVisible: boolean;
  incidentId: string | null;
  reason: string | null;
  distanceOffRoute: number | null;
  dispatchPhone?: string;
  canDismiss: boolean;
  onDismiss: () => void;
}

export default function StopModal({
  isVisible,
  incidentId,
  reason,
  distanceOffRoute,
  dispatchPhone,
  canDismiss,
  onDismiss,
}: StopModalProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrame = useRef<number | null>(null);

  // Play loud warning sound when modal appears
  useEffect(() => {
    if (isVisible) {
      // Play critical alert sound
      soundManager.playCritical();
      
      // Create audio element for continuous alarm
      void (async () => {
      const { soundPath } = await import('@/lib/sounds');
      const audio = new Audio(soundPath('security-facility-breach-alarm-994.wav'));
      audio.loop = true;
      audio.volume = 0.8;
      audio.play().catch(() => {});
      audioRef.current = audio;
      })();
      
      return () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      };
    }
  }, [isVisible]);

  // Prevent page scroll when modal is visible
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVisible]);

  // Disable back button
  useEffect(() => {
    if (isVisible && !canDismiss) {
      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
      };
      
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isVisible, canDismiss]);

  if (!isVisible) return null;

  const handleCallDispatch = () => {
    if (dispatchPhone) {
      window.location.href = `tel:${dispatchPhone}`;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-red-900 flex items-center justify-center"
      data-testid="modal-stop"
    >
      {/* Animated warning stripes background */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div
          className="absolute inset-0 bg-gradient-to-br from-red-800 via-red-900 to-black"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #991b1b 0, #991b1b 10px, #7f1d1d 10px, #7f1d1d 20px)',
            animation: 'slide 2s linear infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes slide {
          0% { transform: translateX(0); }
          100% { transform: translateX(28.28px); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: 1; box-shadow: 0 0 30px rgba(239, 68, 68, 0.8); }
          50% { opacity: 0.7; box-shadow: 0 0 60px rgba(239, 68, 68, 1); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
      `}</style>

      {/* Content */}
      <div className="relative z-10 max-w-2xl mx-4 text-center">
        {/* Warning Icon */}
        <div 
          className="mx-auto mb-6 w-32 h-32 flex items-center justify-center rounded-full bg-red-600 border-8 border-white"
          style={{ animation: 'pulse-glow 1s ease-in-out infinite, shake 0.5s ease-in-out infinite' }}
        >
          <AlertTriangle className="w-20 h-20 text-white" />
        </div>

        {/* STOP Text */}
        <h1 
          className="text-9xl font-black text-white mb-4 drop-shadow-2xl"
          style={{ 
            textShadow: '0 0 20px rgba(255,255,255,0.5), 0 0 40px rgba(255,255,255,0.3)',
            animation: 'shake 0.5s ease-in-out infinite'
          }}
        >
          STOP
        </h1>

        <h2 className="text-4xl font-bold text-white mb-8">
          YOU ARE OFF THE PERMITTED ROUTE
        </h2>

        {/* Violation Details */}
        <div className="bg-black/50 backdrop-blur rounded-xl p-8 mb-8 border-4 border-white">
          <div className="grid grid-cols-2 gap-6 text-white">
            <div className="flex items-center gap-3">
              <MapPin className="w-8 h-8 text-red-300" />
              <div className="text-left">
                <div className="text-sm opacity-80">Distance Off-Route</div>
                <div className="text-3xl font-bold" data-testid="text-distance-off">
                  {distanceOffRoute?.toFixed(1) || '--'}m
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Radio className="w-8 h-8 text-red-300" />
              <div className="text-left">
                <div className="text-sm opacity-80">Incident ID</div>
                <div className="text-lg font-mono" data-testid="text-incident-id">
                  {incidentId?.substring(0, 8) || '--------'}
                </div>
              </div>
            </div>
          </div>

          {reason && (
            <div className="mt-6 pt-6 border-t border-white/20">
              <p className="text-white text-lg" data-testid="text-reason">
                {reason}
              </p>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-yellow-500/20 border-4 border-yellow-500 rounded-xl p-6 mb-8">
          <h3 className="text-2xl font-bold text-yellow-300 mb-4">
            IMMEDIATE ACTIONS REQUIRED:
          </h3>
          <ol className="text-left text-white text-lg space-y-3">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center font-bold text-black">
                1
              </span>
              <span>Stop your vehicle safely as soon as possible</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center font-bold text-black">
                2
              </span>
              <span>Contact dispatch immediately for instructions</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center font-bold text-black">
                3
              </span>
              <span>Do NOT proceed until dispatch clears you</span>
            </li>
          </ol>
        </div>

        {/* Call Dispatch Button */}
        {dispatchPhone && (
          <button
            onClick={handleCallDispatch}
            className="w-full px-8 py-6 bg-white hover:bg-gray-100 text-red-900 rounded-xl font-bold text-2xl flex items-center justify-center gap-4 mb-6 shadow-2xl"
            style={{ animation: 'pulse-glow 1.5s ease-in-out infinite' }}
            data-testid="button-call-dispatch"
          >
            <Phone className="w-8 h-8" />
            CALL DISPATCH: {dispatchPhone}
          </button>
        )}

        {/* Status Message */}
        <div className="text-white text-xl font-medium">
          {canDismiss ? (
            <div className="bg-green-600/30 border-2 border-green-400 rounded-lg p-4">
              <p className="text-green-200" data-testid="text-cleared">
                ✓ Dispatch has cleared this incident. You may proceed.
              </p>
              <button
                onClick={onDismiss}
                className="mt-4 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold"
                data-testid="button-dismiss"
              >
                Acknowledge & Continue
              </button>
            </div>
          ) : (
            <div className="bg-red-800/50 border-2 border-red-400 rounded-lg p-4">
              <p className="text-red-200" data-testid="text-waiting">
                ⏳ Waiting for dispatch clearance...
              </p>
              <p className="text-sm text-red-300 mt-2">
                This alert cannot be dismissed until dispatch clears you to proceed
              </p>
            </div>
          )}
        </div>

        {/* Legal Notice */}
        <div className="mt-8 text-xs text-white/60">
          <p>
            Operating outside permitted routes may result in legal penalties,
            fines, and license suspension.
          </p>
        </div>
      </div>
    </div>
  );
}