/**
 * 3D Point Cloud Preview Component
 * Displays a downsampled real-time point cloud visualization using Three.js
 */

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Point3D } from '@/lib/lidar/types';

interface PointCloudPreviewProps {
  points: Point3D[];
  width?: number;
  height?: number;
}

const MAX_POINTS = 100_000;

export function PointCloudPreview({ points, width = 400, height = 300 }: PointCloudPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pointsMeshRef = useRef<THREE.Points | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 10, 20);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2;
    controlsRef.current = controls;

    const gridHelper = new THREE.GridHelper(40, 40, 0x444444, 0x333333);
    scene.add(gridHelper);

    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_POINTS * 3);
    const colors = new Float32Array(MAX_POINTS * 3);
    const posAttr = new THREE.BufferAttribute(positions, 3);
    const colAttr = new THREE.BufferAttribute(colors, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', posAttr);
    geometry.setAttribute('color', colAttr);
    geometry.setDrawRange(0, 0);
    geometryRef.current = geometry;

    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      sizeAttenuation: true,
    });

    const pointsMesh = new THREE.Points(geometry, material);
    scene.add(pointsMesh);
    pointsMeshRef.current = pointsMesh;

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      geometryRef.current = null;
      pointsMeshRef.current = null;
    };
  }, [width, height]);

  useEffect(() => {
    const geometry = geometryRef.current;
    if (!geometry) return;

    const count = Math.min(points.length, MAX_POINTS);
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;
    const colArray = colAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const point = points[i];
      posArray[i * 3] = point.x;
      posArray[i * 3 + 1] = point.z;
      posArray[i * 3 + 2] = -point.y;

      const h = point.z;
      let r = 0, g = 0, b = 0;
      if (h < 0) {
        r = 0.2; g = 0.6; b = 0.2;
      } else if (h < 2) {
        r = 0.2; g = 0.8; b = 0.2;
      } else if (h < 4) {
        r = 1.0; g = 0.8; b = 0.2;
      } else if (h < 6) {
        r = 1.0; g = 0.5; b = 0.0;
      } else {
        r = 1.0; g = 0.2; b = 0.2;
      }
      colArray[i * 3] = r;
      colArray[i * 3 + 1] = g;
      colArray[i * 3 + 2] = b;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    geometry.setDrawRange(0, count);
  }, [points]);

  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-700">
      <div ref={containerRef} style={{ width, height }} />
      <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-gray-300">
        {points.length.toLocaleString()} points
      </div>
      <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-gray-400">
        Drag to rotate • Scroll to zoom
      </div>
      <div className="absolute bottom-2 left-2 flex gap-2 text-xs">
        <span className="bg-green-600/80 px-1 rounded">0-2m</span>
        <span className="bg-yellow-500/80 px-1 rounded text-black">2-4m</span>
        <span className="bg-orange-500/80 px-1 rounded">4-6m</span>
        <span className="bg-red-500/80 px-1 rounded">6m+</span>
      </div>
    </div>
  );
}
