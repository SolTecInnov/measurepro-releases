export interface Detection {
  id: string;
  objectClass: string;
  confidence: number;
  boundingBox: {
    x: number; // Normalized 0-1
    y: number; // Normalized 0-1
    width: number; // Normalized 0-1
    height: number; // Normalized 0-1
  };
  timestamp: number;
  metadata?: {
    distance?: number;
    height?: number;
    clearance?: number;
  };
}

export class MockDetectionGenerator {
  private intervalId: number | null = null;
  private isRunning = false;
  private detectionCount = 0;
  
  constructor(
    private enabledClasses: string[],
    private detectionInterval: number = 3000, // Default 3 seconds
    private onDetection?: (detection: Detection) => void
  ) {}
  
  start(): void {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    this.detectionCount = 0;
    
    // Generate first detection immediately
    this.generateDetection();
    
    // Then generate at intervals
    this.intervalId = window.setInterval(() => {
      this.generateDetection();
    }, this.detectionInterval);
  }
  
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
  }
  
  isActive(): boolean {
    return this.isRunning;
  }
  
  updateEnabledClasses(enabledClasses: string[]): void {
    this.enabledClasses = enabledClasses;
  }
  
  updateInterval(interval: number): void {
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      this.stop();
    }
    
    this.detectionInterval = interval;
    
    if (wasRunning) {
      this.start();
    }
  }
  
  private generateDetection(): void {
    if (this.enabledClasses.length === 0) {
      return;
    }
    
    // Randomly select an enabled class
    const randomClass = this.enabledClasses[
      Math.floor(Math.random() * this.enabledClasses.length)
    ];
    
    // Generate realistic confidence (usually high, but occasionally lower)
    const confidence = 0.5 + Math.random() * 0.48; // 0.5 to 0.98
    
    // Generate realistic bounding box
    const boundingBox = this.generateRealisticBoundingBox(randomClass);
    
    // Generate mock distance/height for overhead objects
    const metadata = this.generateMetadata(randomClass);
    
    const detection: Detection = {
      id: `mock_${Date.now()}_${this.detectionCount}`,
      objectClass: randomClass,
      confidence,
      boundingBox,
      timestamp: Date.now(),
      metadata,
    };
    
    this.detectionCount++;
    
    if (this.onDetection) {
      this.onDetection(detection);
    }
  }
  
  private generateRealisticBoundingBox(objectClass: string): Detection['boundingBox'] {
    // Different object types have different typical bounding box characteristics
    const boxPresets: Record<string, { minW: number; maxW: number; minH: number; maxH: number; yRange: [number, number] }> = {
      // Overhead infrastructure (typically in upper portion of frame)
      bridge: { minW: 0.4, maxW: 0.9, minH: 0.1, maxH: 0.25, yRange: [0.0, 0.3] },
      overpass: { minW: 0.5, maxW: 0.95, minH: 0.15, maxH: 0.3, yRange: [0.0, 0.25] },
      walkway_overhead: { minW: 0.3, maxW: 0.7, minH: 0.1, maxH: 0.2, yRange: [0.05, 0.35] },
      
      // Vegetation (can be anywhere but typically mid to upper frame)
      tree_branch: { minW: 0.2, maxW: 0.5, minH: 0.15, maxH: 0.35, yRange: [0.1, 0.5] },
      tree_full: { minW: 0.3, maxW: 0.6, minH: 0.3, maxH: 0.6, yRange: [0.0, 0.4] },
      vegetation_low: { minW: 0.25, maxW: 0.55, minH: 0.2, maxH: 0.4, yRange: [0.3, 0.7] },
      
      // Electrical (typically mid to upper frame)
      power_line_high_voltage: { minW: 0.5, maxW: 0.9, minH: 0.02, maxH: 0.08, yRange: [0.1, 0.4] },
      power_line_medium_voltage: { minW: 0.4, maxW: 0.85, minH: 0.02, maxH: 0.08, yRange: [0.15, 0.45] },
      power_line_low_voltage: { minW: 0.3, maxW: 0.7, minH: 0.02, maxH: 0.06, yRange: [0.2, 0.5] },
      electrical_wire: { minW: 0.2, maxW: 0.6, minH: 0.01, maxH: 0.05, yRange: [0.2, 0.6] },
      utility_pole: { minW: 0.05, maxW: 0.15, minH: 0.3, maxH: 0.7, yRange: [0.1, 0.5] },
      transformer: { minW: 0.08, maxW: 0.2, minH: 0.1, maxH: 0.25, yRange: [0.2, 0.5] },
    };
    
    const preset = boxPresets[objectClass] || {
      minW: 0.15,
      maxW: 0.5,
      minH: 0.15,
      maxH: 0.4,
      yRange: [0.2, 0.7] as [number, number],
    };
    
    // Generate random dimensions within preset ranges
    const width = preset.minW + Math.random() * (preset.maxW - preset.minW);
    const height = preset.minH + Math.random() * (preset.maxH - preset.minH);
    
    // Generate position (ensuring box stays within frame)
    const x = Math.random() * (1 - width);
    const yMin = preset.yRange[0];
    const yMax = Math.min(preset.yRange[1], 1 - height);
    const y = yMin + Math.random() * (yMax - yMin);
    
    return { x, y, width, height };
  }
  
  private generateMetadata(objectClass: string): Detection['metadata'] {
    // Only generate clearance data for overhead objects
    const overheadClasses = [
      'bridge',
      'overpass',
      'walkway_overhead',
      'tree_branch',
      'tree_full',
      'power_line_high_voltage',
      'power_line_medium_voltage',
      'power_line_low_voltage',
      'electrical_wire',
    ];
    
    if (!overheadClasses.includes(objectClass)) {
      return undefined;
    }
    
    // Generate realistic clearance measurements (in meters)
    // Most overhead objects are 4-6 meters high
    // Critical: below 4.0m
    // Warning: 4.0m - 4.2m
    // Safe: above 4.2m
    
    const clearanceRanges: Record<string, [number, number]> = {
      bridge: [4.5, 6.5],
      overpass: [4.8, 7.0],
      walkway_overhead: [3.5, 5.0],
      tree_branch: [3.0, 6.0],
      tree_full: [4.0, 8.0],
      power_line_high_voltage: [6.0, 12.0],
      power_line_medium_voltage: [5.0, 10.0],
      power_line_low_voltage: [4.5, 8.0],
      electrical_wire: [4.0, 7.0],
    };
    
    const range = clearanceRanges[objectClass] || [4.0, 6.0];
    const height = range[0] + Math.random() * (range[1] - range[0]);
    
    // Distance is typically height + some angle variation
    const distance = height * (1 + Math.random() * 0.3);
    
    return {
      distance: parseFloat(distance.toFixed(2)),
      height: parseFloat(height.toFixed(2)),
      clearance: parseFloat(height.toFixed(2)),
    };
  }
  
  // Generate a single manual detection (for testing)
  generateManualDetection(objectClass?: string): Detection {
    const classToUse =
      objectClass && this.enabledClasses.includes(objectClass)
        ? objectClass
        : this.enabledClasses[Math.floor(Math.random() * this.enabledClasses.length)];
    
    const confidence = 0.6 + Math.random() * 0.38;
    const boundingBox = this.generateRealisticBoundingBox(classToUse);
    const metadata = this.generateMetadata(classToUse);
    
    const detection: Detection = {
      id: `mock_manual_${Date.now()}`,
      objectClass: classToUse,
      confidence,
      boundingBox,
      timestamp: Date.now(),
      metadata,
    };
    
    this.detectionCount++;
    
    return detection;
  }
}
