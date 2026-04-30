/**
 * AnnotationCanvas — renders cursor, arrow, and freehand annotations
 * over the remote video stream. Annotations fade after ANNOTATION_TTL_MS.
 */

import React, { useRef, useEffect } from 'react';
import { useLiveSupportStore } from '@/lib/liveSupport/liveSupportStore';
import { ANNOTATION_TTL_MS } from '@/lib/liveSupport/types';

const AnnotationCanvas: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const annotations = useLiveSupportStore((s) => s.annotations);
  const remoteCursor = useLiveSupportStore((s) => s.remoteCursor);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const now = Date.now();

      // Draw annotations with fade
      for (const ann of annotations) {
        const age = now - ann.receivedAt;
        if (age >= ANNOTATION_TTL_MS) continue;
        const alpha = Math.max(0, 1 - age / ANNOTATION_TTL_MS);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = ann.color || '#ff0000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (ann.tool === 'freehand' && ann.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(ann.points[0].x * width, ann.points[0].y * height);
          for (let i = 1; i < ann.points.length; i++) {
            ctx.lineTo(ann.points[i].x * width, ann.points[i].y * height);
          }
          ctx.stroke();
        } else if (ann.tool === 'arrow' && ann.points.length >= 2) {
          const start = ann.points[0];
          const end = ann.points[ann.points.length - 1];
          const sx = start.x * width, sy = start.y * height;
          const ex = end.x * width, ey = end.y * height;

          // Line
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          // Arrowhead
          const angle = Math.atan2(ey - sy, ex - sx);
          const headLen = 15;
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
        }
      }

      // Draw remote cursor
      if (remoteCursor) {
        ctx.globalAlpha = 0.8;
        const cx = remoteCursor.x * width;
        const cy = remoteCursor.y * height;
        // Crosshair cursor
        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 15, cy);
        ctx.lineTo(cx + 15, cy);
        ctx.moveTo(cx, cy - 15);
        ctx.lineTo(cx, cy + 15);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [annotations, remoteCursor, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none"
      style={{ width, height }}
    />
  );
};

export default AnnotationCanvas;
