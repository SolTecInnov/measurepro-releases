import '../styles/camera.css';
import { useCameraControl } from '../hooks/useCameraControl';

const CameraDownloadBanner: React.FC = () => {
  const { downloadProgress } = useCameraControl();

  if (!downloadProgress) return null;

  const pct = downloadProgress.totalFiles > 0
    ? Math.round((downloadProgress.downloadedFiles / downloadProgress.totalFiles) * 100)
    : 0;

  const isError = downloadProgress.status === 'error';

  return (
    <div
      className={`camera-download-banner${isError ? ' camera-download-banner--error' : ''}`}
      data-testid="banner-camera-download"
    >
      <span>{isError ? '❌' : '⬇️'}</span>
      <div className="camera-download-banner__content">
        <div>
          {isError
            ? `360° download failed: ${downloadProgress.errorMessage || 'Unknown error'}`
            : downloadProgress.status === 'done'
            ? '360° footage downloaded successfully'
            : `Downloading 360° footage… ${downloadProgress.downloadedFiles}/${downloadProgress.totalFiles} files`}
        </div>
        {downloadProgress.status === 'running' && (
          <div className="camera-download-banner__bar">
            <div
              className="camera-download-banner__fill"
              style={{ width: `${pct}%` }}
              data-testid="status-camera-download-progress"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraDownloadBanner;
