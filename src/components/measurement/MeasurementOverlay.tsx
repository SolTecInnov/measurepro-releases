import { useEffect, useRef } from 'react';
import { Detection } from '@/lib/mockDetection';
import { BridgeClearanceMeasurement, LaneWidthMeasurement } from '@/lib/opencv/specialized-measurements';

interface MeasurementOverlayProps {
  videoElement: HTMLVideoElement | null;
  detections: Detection[];
  measurements?: {
    bridgeClearance?: BridgeClearanceMeasurement;
    laneWidths?: LaneWidthMeasurement;
  };
  width: number;
  height: number;
}

export function drawMeasurementOverlay(
  canvas: HTMLCanvasElement,
  measurements: MeasurementOverlayProps['measurements'],
  detections: Detection[]
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Draw Detection Bounding Boxes
  detections.forEach((detection) => {
    const bbox = detection.boundingBox;
    const xmin = bbox.x * canvas.width;
    const ymin = bbox.y * canvas.height;
    const width = bbox.width * canvas.width;
    const height = bbox.height * canvas.height;

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.strokeRect(xmin, ymin, width, height);

    ctx.fillStyle = '#22c55e';
    ctx.font = '16px Arial';
    const label = `${detection.objectClass} ${(detection.confidence * 100).toFixed(0)}%`;
    ctx.fillText(label, xmin, ymin - 5);
  });

  // 2. Draw Bridge Clearance Overlay
  if (measurements?.bridgeClearance && 'minimumClearance' in measurements.bridgeClearance) {
    const clearance = measurements.bridgeClearance.minimumClearance.camera?.value 
      || measurements.bridgeClearance.minimumClearance.validated?.value 
      || 0;
    
    const minPoint = measurements.bridgeClearance.minimumLocation;
    const complianceLevel = measurements.bridgeClearance.complianceLevel;

    const strokeColor = clearance < 5.0 ? '#ef4444' : '#22c55e';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(minPoint.x, minPoint.y);
    ctx.lineTo(minPoint.x, canvas.height);
    ctx.stroke();

    const labelText = `${clearance.toFixed(2)}m`;
    const labelWidth = ctx.measureText(labelText).width + 20;
    const labelHeight = 30;
    const labelX = minPoint.x - labelWidth / 2;
    const labelY = minPoint.y + 10;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(labelText, labelX + 10, labelY + 20);

    const complianceText = complianceLevel;
    const complianceColor = complianceLevel === 'COMPLIANT' ? '#22c55e' : '#ef4444';
    const badgeX = canvas.width - 150;
    const badgeY = 20;

    ctx.fillStyle = complianceColor;
    ctx.fillRect(badgeX, badgeY, 130, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(complianceText, badgeX + 10, badgeY + 26);
  }

  // 3. Draw Lane Width Overlays
  if (measurements?.laneWidths && 'lanes' in measurements.laneWidths) {
    const lanes = measurements.laneWidths.lanes;
    
    lanes.forEach((lane, index) => {
      const startX = 100 + (index * 150);
      const endX = startX + 120;
      const y = canvas.height - 100;

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();

      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 14px Arial';
      const laneText = `Lane ${lane.laneNumber}: ${lane.width.toFixed(2)}m`;
      ctx.fillText(laneText, startX, y - 10);
    });
  }
}

export default function MeasurementOverlay({
  videoElement,
  detections,
  measurements,
  width,
  height
}: MeasurementOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !videoElement) return;

    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;

    const animate = () => {
      drawMeasurementOverlay(canvas, measurements, detections);
      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [videoElement, detections, measurements, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 pointer-events-none"
      style={{
        width: `${width}px`,
        height: `${height}px`
      }}
      data-testid="canvas-measurement-overlay"
    />
  );
}
