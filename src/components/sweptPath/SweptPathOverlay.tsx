import React, { useEffect, useRef } from 'react';
import { useSweptPathStore } from '../../stores/sweptPathStore';
import type { Point } from '../../lib/sweptPath/roadDetection';
import { ClearanceLevel } from '../../lib/sweptPath/simulator';

interface SweptPathOverlayProps {
  canvasWidth: number;
  canvasHeight: number;
}

const SweptPathOverlay: React.FC<SweptPathOverlayProps> = ({ canvasWidth, canvasHeight }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { settings, currentAnalysis, playback } = useSweptPathStore();

  useEffect(() => {
    if (!canvasRef.current || !currentAnalysis) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Get current snapshot
    const snapshot = currentAnalysis.snapshots[playback.currentFrame] || currentAnalysis.snapshots[0];
    if (!snapshot) return;

    // Draw road boundaries (if enabled)
    if (settings.showRoadBoundaries) {
      drawRoadBoundaries(ctx, currentAnalysis.roadBoundaries);
    }

    // Draw vehicle envelope (if enabled)
    if (settings.showVehicleEnvelope) {
      drawVehicleEnvelope(ctx, snapshot.vehicleEnvelope, snapshot.clearance.level);
    }

    // Draw collision markers (if enabled)
    if (settings.showCollisionMarkers && snapshot.collision?.hasCollision) {
      drawCollisionMarkers(ctx, snapshot.collision);
    }

    // Draw clearance zones (if enabled)
    if (settings.showClearanceZones) {
      drawClearanceZones(ctx, snapshot.clearance);
    }
  }, [currentAnalysis, playback.currentFrame, settings, canvasWidth, canvasHeight]);

  // Helper function: Draw road boundaries
  const drawRoadBoundaries = (ctx: CanvasRenderingContext2D, boundaries: {left: Point[], right: Point[]}) => {
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 2;

    // Left boundary
    ctx.beginPath();
    boundaries.left.forEach((point, i) => {
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    // Right boundary
    ctx.beginPath();
    boundaries.right.forEach((point, i) => {
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
  };

  // Helper function: Draw vehicle envelope
  const drawVehicleEnvelope = (ctx: CanvasRenderingContext2D, envelope: Point[], clearanceLevel: ClearanceLevel) => {
    const color = getClearanceColor(clearanceLevel);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;

    ctx.beginPath();
    envelope.forEach((point, i) => {
      if (i === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.stroke();
  };

  // Helper function: Draw collision markers
  const drawCollisionMarkers = (ctx: CanvasRenderingContext2D, collision: any) => {
    if (collision.firstCollisionPoint) {
      ctx.fillStyle = 'red';
      ctx.beginPath();
      ctx.arc(collision.firstCollisionPoint.x, collision.firstCollisionPoint.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    if (collision.worstCollisionPoint) {
      ctx.fillStyle = 'darkred';
      ctx.beginPath();
      ctx.arc(collision.worstCollisionPoint.x, collision.worstCollisionPoint.y, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Helper function: Draw clearance zones
  const drawClearanceZones = (ctx: CanvasRenderingContext2D, clearance: any) => {
    const color = getClearanceColor(clearance.level);
    ctx.fillStyle = color + '40'; // 25% opacity
    // TODO: Draw clearance zones based on margins
  };

  // Helper function: Get color based on clearance level
  const getClearanceColor = (level: ClearanceLevel): string => {
    switch (level) {
      case ClearanceLevel.SAFE: return '#00FF00'; // Green
      case ClearanceLevel.CAUTION: return '#FFFF00'; // Yellow
      case ClearanceLevel.WARNING: return '#FFA500'; // Orange
      case ClearanceLevel.CRITICAL: return '#FF4500'; // Red-Orange
      case ClearanceLevel.COLLISION: return '#FF0000'; // Red
      default: return '#FFFFFF';
    }
  };

  if (!settings.enabled || !currentAnalysis) return null;

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      className="absolute top-0 left-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
};

export default SweptPathOverlay;
