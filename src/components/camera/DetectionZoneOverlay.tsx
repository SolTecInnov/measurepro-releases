import { useSettingsStore } from '@/lib/settings';

const DetectionZoneOverlay: React.FC = () => {
  const { aiSettings } = useSettingsStore();

  if (!aiSettings?.detectionZone?.enabled || !aiSettings?.detectionZone?.showOverlay) {
    return null;
  }

  const { x, y, width, height, overlayColor } = aiSettings.detectionZone;

  // Convert to percentages for consistent display across different container sizes
  const percentX = (x * 100).toFixed(2);
  const percentY = (y * 100).toFixed(2);
  const percentWidth = (width * 100).toFixed(2);
  const percentHeight = (height * 100).toFixed(2);

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${percentX}%`,
        top: `${percentY}%`,
        width: `${percentWidth}%`,
        height: `${percentHeight}%`,
        border: `2px solid ${overlayColor}`,
        borderRadius: '8px',
        opacity: 0.6,
      }}
      data-testid="overlay-detection-zone"
    >
      <div
        className="px-2 py-1 text-xs font-semibold rounded"
        style={{
          backgroundColor: `${overlayColor}40`,
          color: overlayColor,
        }}
        data-testid="label-detection-zone"
      >
        Detection Zone
      </div>
    </div>
  );
};

export default DetectionZoneOverlay;
