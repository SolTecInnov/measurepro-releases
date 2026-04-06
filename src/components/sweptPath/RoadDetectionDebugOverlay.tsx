import { useEffect, useRef } from 'react';
import type { Point } from '../../lib/sweptPath/roadDetection';

interface RoadDetectionDebugOverlayProps {
  canvasWidth: number;
  canvasHeight: number;
  videoWidth: number;
  videoHeight: number;
  roadBoundaries: {left: Point[], right: Point[]} | null;
  confidence: number;
  isAnalyzing: boolean;
}

const RoadDetectionDebugOverlay: React.FC<RoadDetectionDebugOverlayProps> = ({
  canvasWidth,
  canvasHeight,
  videoWidth,
  videoHeight,
  roadBoundaries,
  confidence,
  isAnalyzing,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Calculate scale factor from video intrinsic size to canvas display size
    const scaleX = canvasWidth / videoWidth;
    const scaleY = canvasHeight / videoHeight;

    // Show analyzing indicator
    if (isAnalyzing) {
      ctx.fillStyle = 'rgba(128, 0, 255, 0.2)';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      
      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('ANALYZING ROAD...', canvasWidth / 2, 50);
    }

    // Draw road boundaries if detected
    if (roadBoundaries) {
      // Helper function to scale points from video coordinates to canvas coordinates
      const scalePoint = (point: Point) => ({
        x: point.x * scaleX,
        y: point.y * scaleY,
      });
      
      // Draw left boundary
      if (roadBoundaries.left.length > 0) {
        ctx.strokeStyle = '#FFFF00'; // Yellow
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        
        ctx.beginPath();
        roadBoundaries.left.forEach((point, i) => {
          const scaled = scalePoint(point);
          if (i === 0) ctx.moveTo(scaled.x, scaled.y);
          else ctx.lineTo(scaled.x, scaled.y);
        });
        ctx.stroke();

        // Draw points
        ctx.fillStyle = '#FFFF00';
        roadBoundaries.left.forEach(point => {
          const scaled = scalePoint(point);
          ctx.beginPath();
          ctx.arc(scaled.x, scaled.y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Draw right boundary
      if (roadBoundaries.right.length > 0) {
        ctx.strokeStyle = '#00FFFF'; // Cyan
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        
        ctx.beginPath();
        roadBoundaries.right.forEach((point, i) => {
          const scaled = scalePoint(point);
          if (i === 0) ctx.moveTo(scaled.x, scaled.y);
          else ctx.lineTo(scaled.x, scaled.y);
        });
        ctx.stroke();

        // Draw points
        ctx.fillStyle = '#00FFFF';
        roadBoundaries.right.forEach(point => {
          const scaled = scalePoint(point);
          ctx.beginPath();
          ctx.arc(scaled.x, scaled.y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Draw confidence and detection info
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, canvasHeight - 80, 300, 70);
      
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('Road Detection Results:', 20, canvasHeight - 60);
      ctx.font = '12px Arial';
      ctx.fillText(`Left Points: ${roadBoundaries.left.length}`, 20, canvasHeight - 40);
      ctx.fillText(`Right Points: ${roadBoundaries.right.length}`, 20, canvasHeight - 25);
      ctx.fillText(`Confidence: ${(confidence * 100).toFixed(1)}%`, 20, canvasHeight - 10);
    }
  }, [roadBoundaries, confidence, isAnalyzing, canvasWidth, canvasHeight, videoWidth, videoHeight]);

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className="absolute top-0 left-0 pointer-events-none"
      style={{ zIndex: 15 }}
    />
  );
};

export default RoadDetectionDebugOverlay;
