/**
 * LivePointCloudMinimap Component
 * Compact 320×320px floating minimap for real-time point cloud visualization.
 * Updates geometry in-place for performance. Supports top-down and front views.
 * The Three.js canvas container is always mounted so collapse/expand works correctly.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Point3D } from '@/lib/lidar/types';

const PANEL_SIZE = 320;

export interface LivePointCloudMinimapProps {
  frame: Point3D[];
  connected: boolean;
  packetsPerSec?: number;
}

type ViewMode = 'top' | 'front';

function getHeightColor(z: number, minZ: number, maxZ: number): [number, number, number] {
  const range = maxZ - minZ || 1;
  const t = Math.max(0, Math.min(1, (z - minZ) / range));
  if (t < 0.5) {
    const s = t * 2;
    return [0, s, 1 - s];
  } else {
    const s = (t - 0.5) * 2;
    return [s, 1 - s, 0];
  }
}

export function LivePointCloudMinimap({
  frame,
  connected,
  packetsPerSec = 0,
}: LivePointCloudMinimapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraTopRef = useRef<THREE.OrthographicCamera | null>(null);
  const cameraFrontRef = useRef<THREE.OrthographicCamera | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const animationRef = useRef<number>(0);
  const maxBufferRef = useRef<number>(0);
  const viewModeRef = useRef<ViewMode>('top');

  const [viewMode, setViewMode] = useState<ViewMode>('top');
  const [collapsed, setCollapsed] = useState(false);

  const toggleView = useCallback(() => {
    setViewMode((v) => (v === 'top' ? 'front' : 'top'));
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);
    sceneRef.current = scene;

    const half = 15;
    const camTop = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 200);
    camTop.position.set(0, 50, 0);
    camTop.lookAt(0, 0, 0);
    cameraTopRef.current = camTop;

    const camFront = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 200);
    camFront.position.set(0, 0, 50);
    camFront.lookAt(0, 0, 0);
    cameraFrontRef.current = camFront;

    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
    renderer.setSize(PANEL_SIZE, PANEL_SIZE);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const gridTop = new THREE.GridHelper(30, 30, 0x1e2a3a, 0x1a2030);
    gridTop.name = 'gridTop';
    scene.add(gridTop);

    const gridFront = new THREE.GridHelper(30, 30, 0x1e2a3a, 0x1a2030);
    gridFront.name = 'gridFront';
    gridFront.rotation.x = Math.PI / 2;
    gridFront.visible = false;
    scene.add(gridFront);

    const coneGeo = new THREE.ConeGeometry(6, 12, 16, 1, true);
    coneGeo.rotateX(-Math.PI / 2);
    coneGeo.translate(0, 0, -6);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x22ff66,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.name = 'cone';
    scene.add(cone);

    const INITIAL_CAP = 65536;
    maxBufferRef.current = INITIAL_CAP;

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(INITIAL_CAP * 3);
    const colors = new Float32Array(INITIAL_CAP * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setDrawRange(0, 0);

    const mat = new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);
    pointsRef.current = points;

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      const cam =
        viewModeRef.current === 'top' ? cameraTopRef.current : cameraFrontRef.current;
      if (cam) renderer.render(scene, cam);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      coneMat.dispose();
      coneGeo.dispose();
    };
  }, []);

  useEffect(() => {
    viewModeRef.current = viewMode;
    if (!sceneRef.current) return;
    sceneRef.current.traverse((obj) => {
      if (obj.name === 'gridTop') obj.visible = viewMode === 'top';
      if (obj.name === 'gridFront') obj.visible = viewMode === 'front';
      if (obj.name === 'cone') obj.visible = viewMode === 'top';
    });
  }, [viewMode]);

  useEffect(() => {
    if (!pointsRef.current) return;

    const pts = pointsRef.current;
    const geo = pts.geometry;
    const count = frame.length;

    if (count === 0) {
      geo.setDrawRange(0, 0);
      return;
    }

    if (count > maxBufferRef.current) {
      const newCap = Math.ceil(count * 1.5);
      maxBufferRef.current = newCap;
      const newPos = new Float32Array(newCap * 3);
      const newCol = new Float32Array(newCap * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(newCol, 3));
    }

    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const colArr = colAttr.array as Float32Array;

    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of frame) {
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }

    for (let i = 0; i < count; i++) {
      const p = frame[i];
      posArr[i * 3] = p.x;
      posArr[i * 3 + 1] = p.z;
      posArr[i * 3 + 2] = -p.y;

      const [r, g, b] = getHeightColor(p.z, minZ, maxZ);
      colArr[i * 3] = r;
      colArr[i * 3 + 1] = g;
      colArr[i * 3 + 2] = b;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    geo.setDrawRange(0, count);
    geo.computeBoundingSphere();
  }, [frame]);

  const borderColor = connected ? 'border-green-500' : 'border-red-500';
  const dotColor = connected ? 'bg-green-500' : 'bg-red-500';

  return (
    <>
      {collapsed && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-950 border-2 ${borderColor} shadow-lg cursor-pointer select-none`}
          onClick={toggleCollapse}
          data-testid="minimap-collapsed"
          title="Expand minimap"
        >
          <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} data-testid="status-dot" />
          <span className="text-xs text-gray-300 font-mono" data-testid="text-pps-collapsed">
            {packetsPerSec.toFixed(1)} pps
          </span>
          <ChevronDown className="w-3 h-3 text-gray-400 ml-1" />
        </div>
      )}

      <div
        className={`relative rounded-xl overflow-hidden border-2 ${borderColor} shadow-2xl bg-gray-950 ${collapsed ? 'hidden' : ''}`}
        style={{ width: PANEL_SIZE, height: PANEL_SIZE }}
        data-testid="minimap-panel"
      >
        <div ref={containerRef} style={{ width: PANEL_SIZE, height: PANEL_SIZE }} />

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 105%, rgba(34,255,102,0.06) 0%, transparent 60%)`,
          }}
        />

        <div
          className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-xs font-mono text-gray-200 space-y-0.5 select-none"
          data-testid="overlay-stats"
        >
          <div data-testid="text-point-count">{frame.length.toLocaleString()} pts</div>
          <div data-testid="text-pps">
            <span className={connected ? 'text-green-400' : 'text-red-400'}>
              {packetsPerSec.toFixed(1)} pps
            </span>
          </div>
        </div>

        <div className="absolute top-2 right-2 flex flex-col gap-1.5">
          <button
            className="bg-black/70 backdrop-blur-sm hover:bg-black/90 text-gray-300 text-xs px-2 py-1 rounded font-mono transition-colors select-none"
            onClick={toggleView}
            data-testid="button-toggle-view"
            title={viewMode === 'top' ? 'Switch to front view' : 'Switch to top-down view'}
          >
            {viewMode === 'top' ? 'TOP' : 'FRT'}
          </button>
          <button
            className="bg-black/70 backdrop-blur-sm hover:bg-black/90 text-gray-300 p-1 rounded transition-colors flex items-center justify-center"
            onClick={toggleCollapse}
            data-testid="button-collapse"
            title="Collapse minimap"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>

        <div
          className="absolute bottom-2 left-2 flex items-center gap-1.5 select-none"
          data-testid="status-indicator"
        >
          <span className={`w-2 h-2 rounded-full ${dotColor} animate-pulse`} />
          <span className={`text-xs font-mono ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected ? 'LIVE' : 'NO SIGNAL'}
          </span>
        </div>

        <div className="absolute bottom-2 right-2 flex gap-1 text-xs select-none">
          <span className="bg-blue-600/70 px-1.5 py-0.5 rounded font-mono">LO</span>
          <span className="bg-green-600/70 px-1.5 py-0.5 rounded font-mono">MID</span>
          <span className="bg-red-600/70 px-1.5 py-0.5 rounded font-mono">HI</span>
        </div>
      </div>
    </>
  );
}
