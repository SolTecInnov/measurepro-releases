/**
 * PointCloudViewer - Three.js 3D Viewer for Point Clouds
 * 
 * Features:
 * - Three.js scene with PerspectiveCamera, WebGLRenderer, OrbitControls
 * - Point cloud rendering using BufferGeometry
 * - Load data from IndexedDB
 * - RGB color visualization or depth-based gradient
 * - Camera controls (orbit, pan, zoom)
 * - Distance measurement tool
 * - Axis helper and grid
 * - Memory leak prevention (cleanup on unmount)
 */

import { useEffect, useRef, useState } from 'react';
import { Ruler, Grid3x3, RotateCw, Loader2 } from 'lucide-react';
import { loadScanFrames } from '../../lib/pointCloud/storage/indexedDbStore';
import { toast } from 'sonner';

type ThreeModule = typeof import('three');
type OrbitControlsModule = typeof import('three/examples/jsm/controls/OrbitControls');

let threeModule: ThreeModule | null = null;
let orbitControlsModule: OrbitControlsModule | null = null;

async function loadThreeModules(): Promise<{ THREE: ThreeModule; OrbitControls: any }> {
  if (threeModule && orbitControlsModule) {
    return { THREE: threeModule, OrbitControls: orbitControlsModule.OrbitControls };
  }

  const [THREE, controls] = await Promise.all([
    import('three'),
    import('three/examples/jsm/controls/OrbitControls')
  ]);

  threeModule = THREE;
  orbitControlsModule = controls;

  return { THREE, OrbitControls: controls.OrbitControls };
}

interface PointCloudViewerProps {
  scanId: string;
  width?: number;
  height?: number;
}

export function PointCloudViewer({ scanId, width = 800, height = 600 }: PointCloudViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any | null>(null);
  const cameraRef = useRef<any | null>(null);
  const rendererRef = useRef<any | null>(null);
  const controlsRef = useRef<any | null>(null);
  const pointsRef = useRef<any | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [threeLoaded, setThreeLoaded] = useState(false);
  const [threeLoadError, setThreeLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pointCount, setPointCount] = useState(0);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [measurementPoints, setMeasurementPoints] = useState<any[]>([]);
  const [distance, setDistance] = useState<number | null>(null);

  // Load Three.js dynamically
  useEffect(() => {
    let mounted = true;

    const loadThree = async () => {
      try {
        await loadThreeModules();
        if (mounted) {
          setThreeLoaded(true);
        }
      } catch (error) {
        if (mounted) {
          const errorMsg = error instanceof Error ? error.message : 'Failed to load Three.js';
          setThreeLoadError(errorMsg);
          toast.error(errorMsg);
        }
      }
    };

    loadThree();

    return () => {
      mounted = false;
    };
  }, []);

  // Initialize Three.js scene (only after Three.js is loaded)
  useEffect(() => {
    if (!containerRef.current || !threeLoaded) return;

    const initScene = async () => {
      const { THREE, OrbitControls } = await loadThreeModules();

      // Scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a1a);
      sceneRef.current = scene;

      // Camera setup
      const camera = new THREE.PerspectiveCamera(
        75,
        width / height,
        0.1,
        1000
      );
      camera.position.set(5, 5, 5);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // Renderer setup
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      if (containerRef.current) {
        containerRef.current.appendChild(renderer.domElement);
      }
      rendererRef.current = renderer;

      // OrbitControls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = false;
      controls.minDistance = 1;
      controls.maxDistance = 50;
      controls.maxPolarAngle = Math.PI;
      controlsRef.current = controls;

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
      directionalLight.position.set(10, 10, 10);
      scene.add(directionalLight);

      // Grid and axes helpers
      const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
      scene.add(gridHelper);

      const axesHelper = new THREE.AxesHelper(5);
      scene.add(axesHelper);

      // Animation loop
      function animate() {
        animationFrameRef.current = requestAnimationFrame(animate);
        
        if (controlsRef.current) {
          controlsRef.current.update();
        }
        
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      }
      animate();
    };

    initScene();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Dispose controls
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      
      // Dispose renderer
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (containerRef.current && rendererRef.current.domElement) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }
      
      // Dispose geometries and materials
      if (pointsRef.current) {
        pointsRef.current.geometry.dispose();
        if (Array.isArray(pointsRef.current.material)) {
          pointsRef.current.material.forEach((m: any) => m.dispose());
        } else {
          pointsRef.current.material.dispose();
        }
      }
    };
  }, [width, height, threeLoaded]);

  // Load point cloud data
  useEffect(() => {
    if (!scanId || !sceneRef.current || !threeLoaded) return;

    const loadPointCloud = async () => {
      setLoading(true);
      
      try {
        const { THREE } = await loadThreeModules();
        const frames = await loadScanFrames(scanId);
        
        if (frames.length === 0) {
          toast.error('No frames found for this scan');
          setLoading(false);
          return;
        }

        // Merge all frames into a single point cloud
        const allPoints: number[] = [];
        const allColors: number[] = [];
        let totalPoints = 0;

        for (const frame of frames) {
          // Convert Float32Array to regular array
          for (let i = 0; i < frame.points.length; i += 3) {
            allPoints.push(frame.points[i], frame.points[i + 1], frame.points[i + 2]);
          }

          // Add colors (RGB or depth-based gradient)
          if (frame.colors) {
            for (let i = 0; i < frame.colors.length; i += 3) {
              allColors.push(
                frame.colors[i] / 255,
                frame.colors[i + 1] / 255,
                frame.colors[i + 2] / 255
              );
            }
          } else {
            // Depth-based gradient (blue to red)
            for (let i = 0; i < frame.points.length; i += 3) {
              const depth = frame.points[i + 2]; // Z coordinate
              const normalizedDepth = Math.min(Math.max(depth / 10.0, 0), 1);
              allColors.push(
                normalizedDepth,        // R
                0.5 * (1 - normalizedDepth), // G
                1 - normalizedDepth     // B
              );
            }
          }

          totalPoints += frame.pointCount;
        }

        // Create BufferGeometry
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(allPoints, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(allColors, 3));

        // Create material
        const material = new THREE.PointsMaterial({
          size: 0.05,
          vertexColors: true,
          sizeAttenuation: true,
        });

        // Remove old points if exists
        if (pointsRef.current && sceneRef.current) {
          sceneRef.current.remove(pointsRef.current);
          pointsRef.current.geometry.dispose();
          if (Array.isArray(pointsRef.current.material)) {
            pointsRef.current.material.forEach((m: any) => m.dispose());
          } else {
            pointsRef.current.material.dispose();
          }
        }

        // Create Points object
        const points = new THREE.Points(geometry, material);
        pointsRef.current = points;
        sceneRef.current.add(points);

        // Center camera on point cloud
        geometry.computeBoundingSphere();
        if (geometry.boundingSphere && cameraRef.current && controlsRef.current) {
          const center = geometry.boundingSphere.center;
          const radius = geometry.boundingSphere.radius;
          
          controlsRef.current.target.copy(center);
          cameraRef.current.position.set(
            center.x + radius * 2,
            center.y + radius * 2,
            center.z + radius * 2
          );
          cameraRef.current.lookAt(center);
        }

        setPointCount(totalPoints);
        setLoading(false);
        /* toast removed */

      } catch (error) {
        toast.error('Failed to load point cloud data');
        setLoading(false);
      }
    };

    loadPointCloud();
  }, [scanId, threeLoaded]);

  // Handle measurement mode clicks
  const handleCanvasClick = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (!measurementMode || !cameraRef.current || !pointsRef.current || !threeLoaded) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const { THREE } = await loadThreeModules();

    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const intersects = raycaster.intersectObject(pointsRef.current);
    
    if (intersects.length > 0) {
      const point = intersects[0].point;
      
      setMeasurementPoints(prev => {
        const newPoints = [...prev, point];
        
        if (newPoints.length === 2) {
          // Calculate distance
          const dist = newPoints[0].distanceTo(newPoints[1]);
          setDistance(dist);
          /* toast removed */
          
          // Reset after showing distance
          setTimeout(() => {
            setMeasurementPoints([]);
            setDistance(null);
          }, 5000);
        }
        
        return newPoints.length > 2 ? [point] : newPoints;
      });
    }
  };

  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current && pointsRef.current) {
      const geometry = pointsRef.current.geometry;
      geometry.computeBoundingSphere();
      
      if (geometry.boundingSphere) {
        const center = geometry.boundingSphere.center;
        const radius = geometry.boundingSphere.radius;
        
        controlsRef.current.target.copy(center);
        cameraRef.current.position.set(
          center.x + radius * 2,
          center.y + radius * 2,
          center.z + radius * 2
        );
        cameraRef.current.lookAt(center);
      }
    }
  };

  return (
    <div className="relative">
      {/* Canvas Container */}
      <div
        ref={containerRef}
        onClick={handleCanvasClick}
        className="rounded-lg overflow-hidden border border-gray-700"
        style={{ width, height, cursor: measurementMode ? 'crosshair' : 'default' }}
        data-testid="canvas-pointcloud-viewer"
      />

      {/* Three.js Loading State */}
      {!threeLoaded && !threeLoadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 rounded-lg">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-white">Loading Three.js library...</p>
          </div>
        </div>
      )}

      {/* Three.js Error State */}
      {threeLoadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 rounded-lg">
          <div className="text-center max-w-md">
            <p className="text-red-400 mb-2">Failed to load 3D viewer</p>
            <p className="text-gray-400 text-sm">{threeLoadError}</p>
          </div>
        </div>
      )}

      {/* Point Cloud Loading State */}
      {threeLoaded && loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 rounded-lg">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-white">Loading point cloud...</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-2 right-2 flex flex-col gap-2">
        <button
          onClick={() => setMeasurementMode(!measurementMode)}
          className={`p-2 rounded-lg transition-colors ${
            measurementMode 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
          }`}
          title="Measurement Tool"
          data-testid="button-measurement-tool"
        >
          <Ruler className="w-5 h-5" />
        </button>
        
        <button
          onClick={resetCamera}
          className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
          title="Reset Camera"
          data-testid="button-reset-camera"
        >
          <RotateCw className="w-5 h-5" />
        </button>
      </div>

      {/* Stats */}
      <div className="absolute bottom-2 left-2 bg-gray-900/90 px-3 py-2 rounded-lg text-sm">
        <div className="flex items-center gap-2 text-gray-300">
          <Grid3x3 className="w-4 h-4" />
          <span>{pointCount.toLocaleString()} points</span>
        </div>
        {distance !== null && (
          <div className="flex items-center gap-2 text-blue-400 mt-1">
            <Ruler className="w-4 h-4" />
            <span>{distance.toFixed(3)} m</span>
          </div>
        )}
      </div>

      {/* Measurement Instructions */}
      {measurementMode && measurementPoints.length < 2 && (
        <div className="absolute top-2 left-2 bg-blue-900/90 px-3 py-2 rounded-lg text-sm text-white">
          Click {measurementPoints.length === 0 ? 'first' : 'second'} point to measure distance
        </div>
      )}
    </div>
  );
}
