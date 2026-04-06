import '../styles/camera.css';
import { useCameraControl } from '../hooks/useCameraControl';

const CameraErrorBanner: React.FC = () => {
  const { cameraError, dismissError, retryAfterError } = useCameraControl();

  if (!cameraError) return null;

  return (
    <div
      className="camera-error-banner"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      data-testid="banner-camera-error"
    >
      <div className="camera-error-banner__icon">⚠️</div>
      <div className="camera-error-banner__content">
        <div className="camera-error-banner__title" data-testid="text-camera-error-message">
          {cameraError.message}
        </div>
        <div className="camera-error-banner__action" data-testid="text-camera-error-action">
          {cameraError.action}
        </div>
      </div>
      <div className="camera-error-banner__buttons">
        {cameraError.recoverable && (
          <button
            className="camera-error-btn camera-error-btn--retry"
            onClick={() => retryAfterError()}
            data-testid="button-camera-retry"
          >
            Retry
          </button>
        )}
        <button
          className="camera-error-btn camera-error-btn--dismiss"
          onClick={dismissError}
          data-testid="button-camera-dismiss"
        >
          Continue without camera
        </button>
      </div>
    </div>
  );
};

export default CameraErrorBanner;
