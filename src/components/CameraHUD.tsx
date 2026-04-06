import { useState, useEffect, useCallback } from 'react';
import '../styles/camera.css';
import { useCameraControl } from '../hooks/useCameraControl';
import { useGPSStore } from '../lib/stores/gpsStore';
import { useSurveyStore } from '../lib/survey';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const CameraHUD: React.FC = () => {
  const {
    status,
    settings,
    cameraConnected,
    bridgeOnline,
    cameraWarnings,
    isCapturingPhoto,
    lastPhotoResult,
    capturePhotoPOI,
    activeSurveyId,
  } = useCameraControl();

  const { data: gpsData } = useGPSStore();
  const { activeSurvey } = useSurveyStore();

  const [photoBtnState, setPhotoBtnState] = useState<'idle' | 'capturing' | 'success'>('idle');

  useEffect(() => {
    if (isCapturingPhoto) {
      setPhotoBtnState('capturing');
    } else if (lastPhotoResult) {
      setPhotoBtnState('success');
      const t = setTimeout(() => setPhotoBtnState('idle'), 1200);
      return () => clearTimeout(t);
    } else {
      setPhotoBtnState('idle');
    }
  }, [isCapturingPhoto, lastPhotoResult]);

  const handleManualPhoto = useCallback(() => {
    if (!cameraConnected || isCapturingPhoto || !activeSurvey) return;
    void capturePhotoPOI({
      lat: gpsData?.lat ?? 0,
      lng: gpsData?.lng ?? 0,
      altitude: gpsData?.altitude ?? 0,
      heading: gpsData?.heading ?? 0,
      surveyId: activeSurvey.id,
      poiType: 'manual',
      poiLabel: 'Manual 360°'
    });
  }, [cameraConnected, isCapturingPhoto, activeSurvey, capturePhotoPOI, gpsData]);

  if (!bridgeOnline || !cameraConnected || !settings.showHUD) return null;

  const fixedStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 900,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-end',
    pointerEvents: 'none',
    ...(settings.hudPosition.includes('right') ? { right: 12 } : { left: 12 }),
    ...(settings.hudPosition.includes('top') ? { top: 12 } : { bottom: 12 }),
  };

  return (
    <div style={fixedStyle} data-testid="status-camera-hud">
      {status?.isRecording && (
        <div className="camera-hud-badge camera-hud-badge--ok" data-testid="status-camera-recording">
          <span className="camera-hud-rec-dot" />
          <span>REC</span>
          <span className="camera-hud-duration">{formatDuration(status.recordingDuration)}</span>
        </div>
      )}

      {!status?.isRecording && (
        <div className="camera-hud-badge camera-hud-badge--ok" data-testid="status-camera-standby">
          <span>🎥</span>
          <span>STANDBY</span>
        </div>
      )}

      {cameraWarnings.map((w, i) => (
        <div key={i} className="camera-hud-badge camera-hud-badge--warn" data-testid={`status-camera-warning-${i}`}>
          <span className="camera-hud-warn-text">⚡ {w}</span>
        </div>
      ))}

      {activeSurveyId && (
        <button
          className={`camera-hud-photo-btn${isCapturingPhoto ? ' camera-hud-photo-btn--capturing' : ''}${photoBtnState === 'success' ? ' camera-hud-photo-btn--success' : ''}`}
          style={{ pointerEvents: 'all' }}
          onClick={handleManualPhoto}
          disabled={isCapturingPhoto || !activeSurvey}
          title="Take 360° photo"
          data-testid="button-camera-photo"
        >
          {photoBtnState === 'success' ? '✓' : '📸'}
        </button>
      )}
    </div>
  );
};

export default CameraHUD;
