import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Square, AlertCircle, CheckCircle, Activity, Camera, MapPin, Image as ImageIcon, Film } from 'lucide-react';
import { addMeasurement } from '@/lib/survey';
import { addPOIFrameToTimelapse } from '@/lib/timelapse/poiIntegration';
import type { Measurement } from '@/lib/survey/types';

interface StressTestResult {
  expectedOperations: number;
  recordedMeasurements: number;
  timelapseFrames: number;
  imagesCaptured: number;
  gpsUpdates: number;
  droppedOperations: number;
  duration: number;
  avgOperationTime: number;
  peakMemory: number;
  success: boolean;
}

interface StressTestStats {
  measurementsLogged: number;
  timelapseFrames: number;
  imagesCaptured: number;
  gpsUpdates: number;
  currentMemoryMB: number;
  peakMemoryMB: number;
  avgLatencyMs: number;
  currentPOIType: string;
}

// Realistic POI types from actual field operations
const POI_TYPES = [
  'wire', 'pole', 'sign', 'tree', 'bridge', 'building', 'marker', 
  'culvert', 'guardrail', 'junction', 'signal', 'tower', 'fence',
  'manhole', 'hydrant', 'crossing', 'tunnel', 'station', 'camera', 'light', 'other'
] as const;

export default function DebugStress() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<StressTestResult | null>(null);
  const [stats, setStats] = useState<StressTestStats>({
    measurementsLogged: 0,
    timelapseFrames: 0,
    imagesCaptured: 0,
    gpsUpdates: 0,
    currentMemoryMB: 0,
    peakMemoryMB: 0,
    avgLatencyMs: 0,
    currentPOIType: 'wire'
  });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const operationCountRef = useRef<number>(0);
  const latencySum = useRef<number>(0);
  const latencyCount = useRef<number>(0);
  const testSurveyIdRef = useRef<string>('');
  
  // Real-world baseline: 1 measurement/second typical field rate
  const REAL_WORLD_RATE = 1;
  const STRESS_MULTIPLIER = 5;
  const TEST_DURATION_SECONDS = 60;
  const TARGET_RATE = REAL_WORLD_RATE * STRESS_MULTIPLIER; // 5 measurements/second
  
  // GPS track simulation (realistic movement along a road)
  const gpsTrackRef = useRef({
    latitude: 45.5017,
    longitude: -73.5673,
    altitude: 50,
    heading: 90,
    speed: 50 // km/h
  });
  
  // Ground reference simulation
  const groundReferenceRef = useRef<number | null>(null);
  
  /**
   * Generate synthetic image as base64 data URL
   * Simulates camera capture with minimal overhead
   */
  const generateSyntheticImage = async (poiType: string, poiNumber: number): Promise<string> => {
    const canvas = new OffscreenCanvas(320, 240);
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Gradient background
      const gradient = ctx.createLinearGradient(0, 0, 320, 240);
      gradient.addColorStop(0, `hsl(${Math.random() * 360}, 60%, 40%)`);
      gradient.addColorStop(1, `hsl(${Math.random() * 360}, 60%, 20%)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 320, 240);
      
      // Text overlay
      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`POI-${poiNumber}`, 10, 30);
      ctx.font = '12px monospace';
      ctx.fillText(poiType.toUpperCase(), 10, 50);
      ctx.fillText(new Date().toISOString(), 10, 70);
      
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.75 });
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
    
    return '';
  };
  
  /**
   * Update GPS track to simulate realistic vehicle movement
   */
  const updateGPSTrack = (deltaTimeSeconds: number) => {
    const track = gpsTrackRef.current;
    
    // Calculate movement based on speed (convert km/h to degrees/second approx)
    const speedInDegreesPerSecond = (track.speed / 3600) / 111; // rough approximation
    
    // Move along heading
    const headingRad = (track.heading * Math.PI) / 180;
    track.latitude += speedInDegreesPerSecond * deltaTimeSeconds * Math.cos(headingRad);
    track.longitude += speedInDegreesPerSecond * deltaTimeSeconds * Math.sin(headingRad);
    
    // Add slight random variation
    track.latitude += (Math.random() - 0.5) * 0.00001;
    track.longitude += (Math.random() - 0.5) * 0.00001;
    track.altitude += (Math.random() - 0.5) * 0.5;
    
    // Occasionally change heading (simulate turns)
    if (Math.random() < 0.05) {
      track.heading += (Math.random() - 0.5) * 30;
      track.heading = (track.heading + 360) % 360;
    }
    
    // Speed variation
    track.speed += (Math.random() - 0.5) * 5;
    track.speed = Math.max(30, Math.min(70, track.speed));
  };
  
  /**
   * Simulate laser measurement with ground reference
   */
  const simulateLaserMeasurement = (): number => {
    // Random raw measurement between 2-15 meters
    const rawMeasurement = 2 + Math.random() * 13;
    
    // Set ground reference on first measurement
    if (groundReferenceRef.current === null) {
      groundReferenceRef.current = rawMeasurement;
      return 0; // First measurement is reference
    }
    
    // Return relative height (subtract ground reference)
    return rawMeasurement - groundReferenceRef.current;
  };
  
  /**
   * Perform one complete field operation cycle
   * This simulates: GPS update → Laser reading → Image capture → Timelapse frame → POI logging
   */
  const performFieldOperation = async (operationIndex: number) => {
    const opStartTime = performance.now();
    const track = gpsTrackRef.current;
    
    // 1. Update GPS track (simulates GPS receiver update)
    updateGPSTrack(1 / TARGET_RATE);
    
    // 2. Get laser measurement with ground reference
    const relativeHeight = simulateLaserMeasurement();
    
    // 3. Select POI type (cycle through types)
    const poiType = POI_TYPES[operationIndex % POI_TYPES.length];
    
    // 4. Capture image (EVERY POI gets an image in real field operations)
    const imageUrl = await generateSyntheticImage(poiType, operationIndex);
    const capturedImageThisCycle = true;
    
    // 5. Create full measurement object (realistic field data)
    const now = new Date();
    const measurement: Measurement = {
      id: `stress-${testSurveyIdRef.current}-${operationIndex}-${Date.now()}`,
      user_id: testSurveyIdRef.current,
      utcDate: now.toISOString().split('T')[0],
      utcTime: now.toTimeString().split(' ')[0],
      rel: relativeHeight,
      altGPS: track.altitude,
      latitude: track.latitude,
      longitude: track.longitude,
      speed: track.speed,
      heading: track.heading,
      roadNumber: 1,
      poiNumber: operationIndex,
      poi_type: poiType,
      note: `Stress test POI ${operationIndex}`,
      createdAt: now.toISOString(),
      source: 'all',
      imageUrl,
      videoUrl: null,
      drawingUrl: null,
      widthMeasure: null,
      lengthMeasure: null
    };
    
    // 6. Log measurement (this goes through worker pipeline)
    try {
      await addMeasurement(measurement);
    } catch (error) {
      console.error('Failed to log measurement:', error);
    }
    
    // 7. Add timelapse frame (10% of measurements)
    if (Math.random() < 0.1) {
      try {
        const timelapseFrame = await generateSyntheticImage('timelapse', operationIndex);
        const frameNumber = await addPOIFrameToTimelapse(timelapseFrame, measurement);
        
        if (frameNumber !== null) {
          setStats(prev => ({
            ...prev,
            timelapseFrames: prev.timelapseFrames + 1
          }));
        }
      } catch (error) {
        console.error('Failed to add timelapse frame:', error);
      }
    }
    
    // 8. Track operation latency
    const opEndTime = performance.now();
    const latency = opEndTime - opStartTime;
    latencySum.current += latency;
    latencyCount.current++;
    
    // 9. Update stats
    setStats(prev => ({
      measurementsLogged: prev.measurementsLogged + 1,
      timelapseFrames: prev.timelapseFrames,
      imagesCaptured: prev.imagesCaptured + (capturedImageThisCycle ? 1 : 0),
      gpsUpdates: prev.gpsUpdates + 1,
      currentMemoryMB: (performance as any).memory?.usedJSHeapSize 
        ? Math.round((performance as any).memory.usedJSHeapSize / 1048576)
        : 0,
      peakMemoryMB: Math.max(
        prev.peakMemoryMB,
        (performance as any).memory?.usedJSHeapSize 
          ? Math.round((performance as any).memory.usedJSHeapSize / 1048576)
          : 0
      ),
      avgLatencyMs: Math.round(latencySum.current / latencyCount.current),
      currentPOIType: poiType
    }));
  };
  
  const startStressTest = () => {
    setIsRunning(true);
    setProgress(0);
    setResult(null);
    setStats({
      measurementsLogged: 0,
      timelapseFrames: 0,
      imagesCaptured: 0,
      gpsUpdates: 0,
      currentMemoryMB: 0,
      peakMemoryMB: 0,
      avgLatencyMs: 0,
      currentPOIType: 'wire'
    });
    
    // Reset refs
    testSurveyIdRef.current = `stress-test-${Date.now()}`;
    startTimeRef.current = Date.now();
    operationCountRef.current = 0;
    latencySum.current = 0;
    latencyCount.current = 0;
    groundReferenceRef.current = null;
    
    // Reset GPS track
    gpsTrackRef.current = {
      latitude: 45.5017,
      longitude: -73.5673,
      altitude: 50,
      heading: 90,
      speed: 50
    };
    
    const intervalMs = 1000 / TARGET_RATE; // 200ms for 5 ops/sec
    
    intervalRef.current = setInterval(async () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      
      if (elapsed >= TEST_DURATION_SECONDS) {
        stopStressTest();
        return;
      }
      
      setProgress((elapsed / TEST_DURATION_SECONDS) * 100);
      
      // Perform complete field operation
      await performFieldOperation(operationCountRef.current);
      operationCountRef.current++;
    }, intervalMs);
  };
  
  const stopStressTest = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsRunning(false);
    
    const duration = (Date.now() - startTimeRef.current) / 1000;
    const expectedOperations = operationCountRef.current;
    
    // Wait for pipeline to flush
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    try {
      // Count recorded measurements in legacy DB
      const { openSurveyDB } = await import('@/lib/survey/db');
      const db = await openSurveyDB();
      
      const tx = db.transaction('measurements', 'readonly');
      const store = tx.objectStore('measurements');
      const all = await store.getAll();
      
      const stressTestRecords = all.filter((r: Measurement) => 
        r.user_id === testSurveyIdRef.current
      );
      const recordedMeasurements = stressTestRecords.length;
      
      // Calculate result
      const result: StressTestResult = {
        expectedOperations,
        recordedMeasurements,
        timelapseFrames: stats.timelapseFrames,
        imagesCaptured: stats.imagesCaptured,
        gpsUpdates: stats.gpsUpdates,
        droppedOperations: Math.max(0, expectedOperations - recordedMeasurements),
        duration,
        avgOperationTime: latencyCount.current > 0 ? latencySum.current / latencyCount.current : 0,
        peakMemory: stats.peakMemoryMB,
        success: recordedMeasurements >= expectedOperations * 0.98 // 98% success rate acceptable
      };
      
      setResult(result);
    } catch (error) {
      console.error('Failed to validate stress test:', error);
    }
  };
  
  const clearStressTestData = async () => {
    if (!confirm('Clear all stress test data from databases?')) return;
    
    try {
      // Clear from legacy DB
      const { openSurveyDB } = await import('@/lib/survey/db');
      const db = await openSurveyDB();
      
      const tx = db.transaction('measurements', 'readwrite');
      const store = tx.objectStore('measurements');
      const all = await store.getAll();
      
      for (const record of all) {
        if (record.user_id.startsWith('stress-test-')) {
          await store.delete(record.id);
        }
      }
      
      await tx.done;
      
      // Clear from new DB
      const { openDB } = await import('idb');
      const db2 = await openDB('measurepro-v2', 1);
      
      const tx2 = db2.transaction('poiEvents', 'readwrite');
      const store2 = tx2.objectStore('poiEvents');
      const all2 = await store2.getAll();
      
      for (const record of all2) {
        if (record.surveyId && record.surveyId.startsWith('stress-test-')) {
          await store2.delete(record.id);
        }
      }
      
      await tx2.done;
      
      setResult(null);
      setStats({
        measurementsLogged: 0,
        timelapseFrames: 0,
        imagesCaptured: 0,
        gpsUpdates: 0,
        currentMemoryMB: 0,
        peakMemoryMB: 0,
        avgLatencyMs: 0,
        currentPOIType: 'wire'
      });
      
      alert('Stress test data cleared from all databases');
    } catch (error) {
      console.error('Failed to clear stress test data:', error);
      alert('Error clearing data: ' + (error as Error).message);
    }
  };
  
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="w-8 h-8" />
              Comprehensive Stress Test
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Real field operations at {STRESS_MULTIPLIER}x rate ({TARGET_RATE} ops/sec) for {TEST_DURATION_SECONDS}s
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Simulates: GPS tracking • Laser measurements • Ground reference • Image capture (100%) • Timelapse frames • Multi-POI types
            </p>
          </div>
          
          <div className="flex gap-2">
            {!isRunning ? (
              <Button onClick={startStressTest} data-testid="button-start-stress">
                <Play className="w-4 h-4 mr-2" />
                Start Test
              </Button>
            ) : (
              <Button onClick={stopStressTest} variant="destructive" data-testid="button-stop-stress">
                <Square className="w-4 h-4 mr-2" />
                Stop Test
              </Button>
            )}
            
            <Button onClick={clearStressTestData} variant="outline" data-testid="button-clear-stress">
              Clear Data
            </Button>
          </div>
        </div>
        
        {/* Progress Bar */}
        {isRunning && (
          <Card className="p-6">
            <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Progress: {progress.toFixed(1)}% • Current POI: {stats.currentPOIType.toUpperCase()}
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
              <div 
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </Card>
        )}
        
        {/* Live Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-blue-500" />
              <div className="text-sm text-gray-600 dark:text-gray-400">Measurements</div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.measurementsLogged}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">POI logs written</div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Film className="w-4 h-4 text-purple-500" />
              <div className="text-sm text-gray-600 dark:text-gray-400">Timelapse</div>
            </div>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.timelapseFrames}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Frames buffered</div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-4 h-4 text-green-500" />
              <div className="text-sm text-gray-600 dark:text-gray-400">Images</div>
            </div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.imagesCaptured}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Photos captured</div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Camera className="w-4 h-4 text-orange-500" />
              <div className="text-sm text-gray-600 dark:text-gray-400">Avg Latency</div>
            </div>
            <div className={`text-3xl font-bold ${stats.avgLatencyMs > 100 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {stats.avgLatencyMs}ms
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Per operation</div>
          </Card>
        </div>
        
        {/* Memory & Performance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Current Memory</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.currentMemoryMB} MB</div>
          </Card>
          
          <Card className="p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Peak Memory</div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.peakMemoryMB} MB</div>
          </Card>
          
          <Card className="p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">GPS Updates</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.gpsUpdates}</div>
          </Card>
        </div>
        
        {/* Test Results */}
        {result && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              {result.success ? (
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              )}
              
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {result.success ? '✅ TEST PASSED' : '❌ TEST FAILED'}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Duration: {result.duration.toFixed(1)}s • Avg: {result.avgOperationTime.toFixed(1)}ms/op
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Expected Ops</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{result.expectedOperations}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Recorded</div>
                <div className={`text-2xl font-bold ${result.recordedMeasurements >= result.expectedOperations * 0.98 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {result.recordedMeasurements}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Dropped</div>
                <div className={`text-2xl font-bold ${result.droppedOperations === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {result.droppedOperations}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Peak Memory</div>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{result.peakMemory} MB</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Timelapse Frames</div>
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{result.timelapseFrames}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Images Captured</div>
                <div className="text-xl font-bold text-green-600 dark:text-green-400">{result.imagesCaptured}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">GPS Updates</div>
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{result.gpsUpdates}</div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
