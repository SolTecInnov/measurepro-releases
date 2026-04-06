import type { Detection } from '../mockDetection';

export type ModelLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface TensorFlowDetectorConfig {
  minConfidence?: number;
  maxDetections?: number;
  backend?: 'webgl' | 'cpu' | 'wasm';
}

type TensorFlowModule = typeof import('@tensorflow/tfjs');
type CocoSsdModule = typeof import('@tensorflow-models/coco-ssd');

let tfModule: TensorFlowModule | null = null;
let cocoSsdModule: CocoSsdModule | null = null;

async function loadTensorFlowModules(): Promise<{ tf: TensorFlowModule; cocoSsd: CocoSsdModule }> {
  if (tfModule && cocoSsdModule) {
    return { tf: tfModule, cocoSsd: cocoSsdModule };
  }

  const [tf, cocoSsd] = await Promise.all([
    import('@tensorflow/tfjs'),
    import('@tensorflow-models/coco-ssd')
  ]);

  tfModule = tf;
  cocoSsdModule = cocoSsd;

  return { tf, cocoSsd };
}

const COCO_TO_MEASUREPRO_MAPPING: Record<string, string> = {
  person: 'pedestrian',
  bicycle: 'vehicle',
  car: 'vehicle',
  motorcycle: 'vehicle',
  airplane: 'other_overhead',
  bus: 'vehicle',
  train: 'vehicle',
  truck: 'vehicle',
  boat: 'vehicle',
  'traffic light': 'traffic_light',
  'fire hydrant': 'pole',
  'stop sign': 'sign',
  'parking meter': 'sign',
  bench: 'infrastructure',
  bird: 'bird',
  cat: 'animal',
  dog: 'animal',
  horse: 'animal',
  sheep: 'animal',
  cow: 'animal',
  elephant: 'animal',
  bear: 'animal',
  zebra: 'animal',
  giraffe: 'animal',
  backpack: 'other_overhead',
  umbrella: 'other_overhead',
  handbag: 'other_overhead',
  tie: 'other_overhead',
  suitcase: 'other_overhead',
  frisbee: 'other_overhead',
  skis: 'other_overhead',
  snowboard: 'other_overhead',
  'sports ball': 'other_overhead',
  kite: 'other_overhead',
  'baseball bat': 'other_overhead',
  'baseball glove': 'other_overhead',
  skateboard: 'other_overhead',
  surfboard: 'other_overhead',
  'tennis racket': 'other_overhead',
  bottle: 'other_overhead',
  'wine glass': 'other_overhead',
  cup: 'other_overhead',
  fork: 'other_overhead',
  knife: 'other_overhead',
  spoon: 'other_overhead',
  bowl: 'other_overhead',
  banana: 'vegetation_low',
  apple: 'vegetation_low',
  sandwich: 'other_overhead',
  orange: 'vegetation_low',
  broccoli: 'vegetation_low',
  carrot: 'vegetation_low',
  'hot dog': 'other_overhead',
  pizza: 'other_overhead',
  donut: 'other_overhead',
  cake: 'other_overhead',
  chair: 'infrastructure',
  couch: 'infrastructure',
  'potted plant': 'vegetation_low',
  bed: 'infrastructure',
  'dining table': 'infrastructure',
  toilet: 'infrastructure',
  tv: 'other_overhead',
  laptop: 'other_overhead',
  mouse: 'other_overhead',
  remote: 'other_overhead',
  keyboard: 'other_overhead',
  'cell phone': 'other_overhead',
  microwave: 'other_overhead',
  oven: 'other_overhead',
  toaster: 'other_overhead',
  sink: 'infrastructure',
  refrigerator: 'other_overhead',
  book: 'other_overhead',
  clock: 'other_overhead',
  vase: 'vegetation_low',
  scissors: 'other_overhead',
  'teddy bear': 'other_overhead',
  'hair drier': 'other_overhead',
  toothbrush: 'other_overhead',
};

export class TensorFlowDetector {
  private model: any | null = null;
  private status: ModelLoadStatus = 'idle';
  private errorMessage: string | null = null;
  private isProcessing = false;
  private lastDetectionTime = 0;
  private detectionThrottleMs: number;
  private config: TensorFlowDetectorConfig;

  constructor(config: TensorFlowDetectorConfig = {}) {
    this.config = {
      minConfidence: config.minConfidence ?? 0.5,
      maxDetections: config.maxDetections ?? 20,
      backend: config.backend ?? 'webgl',
    };
    
    this.detectionThrottleMs = 333;
  }

  async initialize(): Promise<void> {
    if (this.status === 'loaded' || this.status === 'loading') {
      return;
    }

    try {
      this.status = 'loading';
      this.errorMessage = null;
      
      const { tf, cocoSsd } = await loadTensorFlowModules();
      
      await tf.setBackend(this.config.backend!);
      await tf.ready();
      
      this.model = await cocoSsd.load({
        base: 'lite_mobilenet_v2',
      });
      
      this.status = 'loaded';
      
    } catch (error) {
      this.status = 'error';
      this.errorMessage = error instanceof Error ? error.message : String(error);
      
      if (this.config.backend === 'webgl') {
        try {
          this.config.backend = 'cpu';
          const { tf, cocoSsd } = await loadTensorFlowModules();
          await tf.setBackend('cpu');
          await tf.ready();
          
          this.model = await cocoSsd.load({
            base: 'lite_mobilenet_v2',
          });
          
          this.status = 'loaded';
          this.errorMessage = null;
        } catch (fallbackError) {
          this.status = 'error';
          this.errorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          throw fallbackError;
        }
      } else {
        throw error;
      }
    }
  }

  async detect(
    video: HTMLVideoElement,
    roiConfig?: {
      enabled: boolean;
      x: number;
      y: number;
      width: number;
      height: number;
    },
    classFilters?: {
      enabledCategories?: string[];
      ignoreClasses?: string[];
      minConfidenceByClass?: Record<string, number>;
    }
  ): Promise<Detection[]> {
    if (!this.model) {
      return [];
    }

    if (this.status !== 'loaded') {
      return [];
    }

    if (!video.videoWidth || !video.videoHeight) {
      return [];
    }

    const now = Date.now();
    if (now - this.lastDetectionTime < this.detectionThrottleMs) {
      return [];
    }

    if (this.isProcessing) {
      return [];
    }

    try {
      this.isProcessing = true;
      this.lastDetectionTime = now;

      // Determine what to pass to the model
      let detectionInput: HTMLVideoElement | HTMLCanvasElement = video;
      let roiOffset = { x: 0, y: 0 };

      if (roiConfig?.enabled && roiConfig.width > 0 && roiConfig.height > 0) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
        } else {
          const roiX = Math.floor(roiConfig.x * video.videoWidth);
          const roiY = Math.floor(roiConfig.y * video.videoHeight);
          const roiWidth = Math.floor(roiConfig.width * video.videoWidth);
          const roiHeight = Math.floor(roiConfig.height * video.videoHeight);
          
          canvas.width = roiWidth;
          canvas.height = roiHeight;
          
          ctx.drawImage(
            video,
            roiX, roiY, roiWidth, roiHeight,
            0, 0, roiWidth, roiHeight
          );
          
          detectionInput = canvas;
          roiOffset = { x: roiX, y: roiY };
        }
      }

      // Note: COCO-SSD manages its own tensor memory, no need for tf.tidy()
      const predictions = await this.model.detect(detectionInput, this.config.maxDetections);

      const detections: Detection[] = predictions
        .filter((pred: any) => {
          // 1. Base confidence filter
          if (pred.score < this.config.minConfidence!) {
            return false;
          }
          
          // 2. Map COCO class to MeasurePRO class
          const cocoClass = pred.class;
          const measureProClass = COCO_TO_MEASUREPRO_MAPPING[cocoClass] || 'other_overhead';
          
          // 3. Apply class filters if provided
          if (classFilters) {
            // Skip if class is in ignore list
            if (classFilters.ignoreClasses && classFilters.ignoreClasses.includes(measureProClass)) {
              return false;
            }
            
            // Check per-class confidence threshold
            if (classFilters.minConfidenceByClass) {
              const classMinConfidence = classFilters.minConfidenceByClass[measureProClass];
              if (classMinConfidence !== undefined && pred.score < classMinConfidence) {
                return false;
              }
            }
          }
          
          return true;
        })
        .map((pred: any, index: number) => {
          const cocoClass = pred.class;
          const measureProClass = COCO_TO_MEASUREPRO_MAPPING[cocoClass] || 'other_overhead';
          
          const [x, y, width, height] = pred.bbox;
          
          const adjustedX = x + roiOffset.x;
          const adjustedY = y + roiOffset.y;
          
          const normalizedBox = {
            x: adjustedX / video.videoWidth,
            y: adjustedY / video.videoHeight,
            width: width / video.videoWidth,
            height: height / video.videoHeight,
          };

          const detection: Detection = {
            id: `tf_${Date.now()}_${index}`,
            objectClass: measureProClass,
            confidence: pred.score,
            boundingBox: normalizedBox,
            timestamp: Date.now(),
            metadata: this.calculateMetadata(normalizedBox, measureProClass),
          };

          return detection;
        });

      return detections;

    } catch (error) {
      return [];
    } finally {
      this.isProcessing = false;
    }
  }

  private calculateMetadata(boundingBox: Detection['boundingBox'], objectClass: string): Detection['metadata'] {
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
      'traffic_light',
      'other_overhead',
    ];

    if (!overheadClasses.includes(objectClass)) {
      return undefined;
    }

    const centerY = boundingBox.y + boundingBox.height / 2;
    
    const estimatedHeight = 4.0 + (1.0 - centerY) * 4.0;
    const estimatedDistance = estimatedHeight * 1.2;
    
    return {
      distance: parseFloat(estimatedDistance.toFixed(2)),
      height: parseFloat(estimatedHeight.toFixed(2)),
      clearance: parseFloat(estimatedHeight.toFixed(2)),
    };
  }

  setDetectionThrottle(fps: number): void {
    this.detectionThrottleMs = Math.max(100, 1000 / fps);
  }

  getStatus(): ModelLoadStatus {
    return this.status;
  }

  getErrorMessage(): string | null {
    return this.errorMessage;
  }

  isReady(): boolean {
    return this.status === 'loaded' && this.model !== null;
  }

  dispose(): void {
    if (this.model) {
      this.model = null;
    }
    
    this.status = 'idle';
    this.errorMessage = null;
    this.isProcessing = false;
  }

  async getMemoryInfo() {
    if (!tfModule) {
      const { tf } = await loadTensorFlowModules();
      return tf.memory();
    }
    return tfModule.memory();
  }
}
