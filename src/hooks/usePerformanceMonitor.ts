import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  getStorageHealthTracker, 
  type StorageHealthStatus 
} from '../lib/survey/storageHealth';

export interface PerformanceMetrics {
  // Main thread
  mainThreadLoad: number; // 0-100%
  fps: number; // frames per second
  
  // Memory
  memoryUsageMB: number;
  memoryLimitMB: number;
  memoryPercent: number;
  
  // Worker health
  workerStatus: 'healthy' | 'degraded' | 'critical' | 'unknown';
  workerBufferUsage: number; // 0-100%
  workerBufferSize: number; // actual number of buffered items
  
  // Database
  indexedDBLatency: number; // ms
  
  // POI performance
  lastPOICreationTime: number; // ms
  poisCreatedThisSession: number; // total POIs created since page load
  
  // Storage health (ACK-based tracking)
  storageHealth: StorageHealthStatus;
  pendingWrites: number;
  lastSuccessfulWriteAt: number | null;
  lastCheckpointAt: number | null;
  degradedMode: boolean;
  degradedModeReason: string | null;
  
  // Overall health
  systemHealth: 'healthy' | 'warning' | 'critical';
}

export interface PerformanceWarning {
  type: 'main_thread' | 'worker' | 'memory' | 'database' | 'fps';
  severity: 'warning' | 'critical';
  message: string;
  recommendation: string;
}

const THRESHOLDS = {
  mainThread: {
    warning: 60, // 60% load
    critical: 80  // 80% load
  },
  fps: {
    warning: 45,  // Below 45 FPS
    critical: 30  // Below 30 FPS
  },
  memory: {
    warning: 70,  // 70% of available memory
    critical: 85  // 85% of available memory
  },
  workerBuffer: {
    warning: 60,  // 60% buffer full
    critical: 80  // 80% buffer full
  },
  indexedDB: {
    warning: 50,  // 50ms latency
    critical: 100 // 100ms latency
  }
};

export const usePerformanceMonitor = (enabled: boolean = true) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    mainThreadLoad: 0,
    fps: 60,
    memoryUsageMB: 0,
    memoryLimitMB: 0,
    memoryPercent: 0,
    workerStatus: 'unknown',
    workerBufferUsage: 0,
    workerBufferSize: 0,
    indexedDBLatency: 0,
    lastPOICreationTime: 0,
    poisCreatedThisSession: 0,
    storageHealth: 'healthy',
    pendingWrites: 0,
    lastSuccessfulWriteAt: null,
    lastCheckpointAt: null,
    degradedMode: false,
    degradedModeReason: null,
    systemHealth: 'healthy'
  });
  
  const [warnings, setWarnings] = useState<PerformanceWarning[]>([]);
  
  // FPS tracking
  const fpsRef = useRef<number>(60);
  const frameCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(performance.now());
  const rafIdRef = useRef<number>();
  
  // Main thread load tracking
  const mainThreadLoadRef = useRef<number>(0);
  
  // Worker message listener
  useEffect(() => {
    if (!enabled) return;
    
    const handleWorkerMessage = (event: MessageEvent) => {
      const { type, data } = event.data;
      
      if (type === 'WORKER_HEALTH') {
        setMetrics(prev => ({
          ...prev,
          workerStatus: data.status,
          workerBufferUsage: data.bufferUsage,
          workerBufferSize: data.bufferSize
        }));
      }
      
      if (type === 'POI_CREATION_TIME') {
        setMetrics(prev => ({
          ...prev,
          lastPOICreationTime: data.duration,
          poisCreatedThisSession: prev.poisCreatedThisSession + 1
        }));
      }
      
      if (type === 'INDEXEDDB_LATENCY') {
        setMetrics(prev => ({
          ...prev,
          indexedDBLatency: data.latency
        }));
      }
    };
    
    // Listen for worker messages (measurement logger worker will post these)
    window.addEventListener('message', handleWorkerMessage);
    
    return () => {
      window.removeEventListener('message', handleWorkerMessage);
    };
  }, [enabled]);
  
  // Storage health subscription (ACK-based tracking)
  useEffect(() => {
    if (!enabled) return;
    
    const tracker = getStorageHealthTracker();
    
    const unsubscribe = tracker.subscribe((health, status) => {
      setMetrics(prev => ({
        ...prev,
        storageHealth: status,
        pendingWrites: health.pendingWrites,
        lastSuccessfulWriteAt: health.lastSuccessfulWriteAt,
        lastCheckpointAt: health.lastCheckpointAt,
        degradedMode: health.degradedMode,
        degradedModeReason: health.degradedModeReason
      }));
    });
    
    return () => {
      unsubscribe();
    };
  }, [enabled]);
  
  // FPS Counter
  useEffect(() => {
    if (!enabled) return;
    
    const measureFPS = () => {
      frameCountRef.current++;
      const now = performance.now();
      const delta = now - lastFpsTimeRef.current;
      
      if (delta >= 1000) { // Calculate FPS every second
        fpsRef.current = Math.round((frameCountRef.current * 1000) / delta);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
        
        setMetrics(prev => ({ ...prev, fps: fpsRef.current }));
      }
      
      rafIdRef.current = requestAnimationFrame(measureFPS);
    };
    
    rafIdRef.current = requestAnimationFrame(measureFPS);
    
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [enabled]);
  
  // Main Thread Load (using requestIdleCallback)
  useEffect(() => {
    if (!enabled) return;
    if (typeof requestIdleCallback === 'undefined') return;
    
    let timeoutId: number;
    let isRunning = true;
    const samples: number[] = [];
    
    const measureLoad = () => {
      if (!isRunning) return;
      
      requestIdleCallback((deadline) => {
        if (!isRunning) return;
        
        const idleTime = deadline.timeRemaining();
        
        // Only count as busy if idle time is very low (< 10ms)
        // This reduces false positives from normal browser scheduling
        const isBusy = idleTime < 10;
        samples.push(isBusy ? 1 : 0);
        
        // Keep only last 10 samples (1 second worth at 100ms intervals)
        if (samples.length > 10) {
          samples.shift();
        }
        
        // Calculate load as percentage of busy samples
        if (samples.length >= 5) { // Wait for at least 5 samples
          const busyCount = samples.filter(s => s === 1).length;
          const loadPercent = Math.round((busyCount / samples.length) * 100);
          mainThreadLoadRef.current = loadPercent;
          
          setMetrics(prev => ({ ...prev, mainThreadLoad: mainThreadLoadRef.current }));
        }
        
        // Schedule next measurement (reduced frequency: 200ms instead of 100ms)
        timeoutId = window.setTimeout(() => measureLoad(), 200);
      }, { timeout: 500 }); // Add timeout to prevent indefinite waiting
    };
    
    measureLoad();
    
    return () => {
      isRunning = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [enabled]);
  
  // Memory Usage
  useEffect(() => {
    if (!enabled) return;
    
    const measureMemory = () => {
      // Chrome/Edge support performance.memory
      const memory = (performance as any).memory;
      if (memory) {
        const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
        const percent = Math.round((usedMB / limitMB) * 100);
        
        setMetrics(prev => ({
          ...prev,
          memoryUsageMB: usedMB,
          memoryLimitMB: limitMB,
          memoryPercent: percent
        }));
      }
    };
    
    measureMemory();
    const interval = setInterval(measureMemory, 2000); // Check every 2 seconds
    
    return () => clearInterval(interval);
  }, [enabled]);
  
  // Calculate overall system health and generate warnings
  useEffect(() => {
    if (!enabled) return;
    
    const newWarnings: PerformanceWarning[] = [];
    let health: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    // Main thread warnings
    if (metrics.mainThreadLoad >= THRESHOLDS.mainThread.critical) {
      health = 'critical';
      newWarnings.push({
        type: 'main_thread',
        severity: 'critical',
        message: `Main thread overloaded (${metrics.mainThreadLoad}%)`,
        recommendation: 'Consider pausing survey to allow system to catch up'
      });
    } else if (metrics.mainThreadLoad >= THRESHOLDS.mainThread.warning && health === 'healthy') {
      health = 'warning';
      newWarnings.push({
        type: 'main_thread',
        severity: 'warning',
        message: `High main thread load (${metrics.mainThreadLoad}%)`,
        recommendation: 'Reduce logging frequency or close unused browser tabs'
      });
    }
    
    // FPS warnings
    if (metrics.fps <= THRESHOLDS.fps.critical) {
      health = 'critical';
      newWarnings.push({
        type: 'fps',
        severity: 'critical',
        message: `Very low frame rate (${metrics.fps} FPS)`,
        recommendation: 'UI responsiveness severely degraded - pause survey'
      });
    } else if (metrics.fps <= THRESHOLDS.fps.warning && health === 'healthy') {
      health = 'warning';
      newWarnings.push({
        type: 'fps',
        severity: 'warning',
        message: `Low frame rate (${metrics.fps} FPS)`,
        recommendation: 'Close other applications to free up resources'
      });
    }
    
    // Memory warnings
    if (metrics.memoryPercent >= THRESHOLDS.memory.critical) {
      health = 'critical';
      newWarnings.push({
        type: 'memory',
        severity: 'critical',
        message: `Critical memory usage (${metrics.memoryPercent}%)`,
        recommendation: 'Restart MeasurePRO to free memory'
      });
    } else if (metrics.memoryPercent >= THRESHOLDS.memory.warning && health === 'healthy') {
      health = 'warning';
      newWarnings.push({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage (${metrics.memoryUsageMB} MB)`,
        recommendation: 'Close unused browser tabs'
      });
    }
    
    // Worker buffer warnings
    if (metrics.workerBufferUsage >= THRESHOLDS.workerBuffer.critical) {
      health = 'critical';
      newWarnings.push({
        type: 'worker',
        severity: 'critical',
        message: `Worker buffer critical (${metrics.workerBufferUsage}%)`,
        recommendation: 'Slow down logging rate - system cannot keep up'
      });
    } else if (metrics.workerBufferUsage >= THRESHOLDS.workerBuffer.warning && health === 'healthy') {
      health = 'warning';
      newWarnings.push({
        type: 'worker',
        severity: 'warning',
        message: `Worker buffer filling (${metrics.workerBufferUsage}%)`,
        recommendation: 'System catching up - consider brief pause'
      });
    }
    
    // IndexedDB latency warnings
    if (metrics.indexedDBLatency >= THRESHOLDS.indexedDB.critical) {
      health = 'critical';
      newWarnings.push({
        type: 'database',
        severity: 'critical',
        message: `Database very slow (${metrics.indexedDBLatency}ms)`,
        recommendation: 'Database performance degraded - pause logging'
      });
    } else if (metrics.indexedDBLatency >= THRESHOLDS.indexedDB.warning && health === 'healthy') {
      health = 'warning';
      newWarnings.push({
        type: 'database',
        severity: 'warning',
        message: `Database latency high (${metrics.indexedDBLatency}ms)`,
        recommendation: 'Database under load - monitor performance'
      });
    }
    
    setWarnings(newWarnings);
    setMetrics(prev => ({ ...prev, systemHealth: health }));
  }, [enabled, metrics.mainThreadLoad, metrics.fps, metrics.memoryPercent, metrics.workerBufferUsage, metrics.indexedDBLatency]);
  
  const recordPOICreationTime = useCallback((duration: number) => {
    setMetrics(prev => ({ ...prev, lastPOICreationTime: duration }));
  }, []);
  
  return {
    metrics,
    warnings,
    recordPOICreationTime,
    enabled
  };
};
