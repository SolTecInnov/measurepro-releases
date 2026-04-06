import { CalibrationData } from '@/types/calibration';
import { isOpenCVReady } from '@/lib/opencv/opencv-init';
import * as math from 'mathjs';

/**
 * Represents a 2D point in pixel or real-world coordinates
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Polynomial coefficients for road boundary curves
 */
export interface PolynomialCoefficients {
  degree: number;
  coefficients: number[]; // [a, b, c] for quadratic (y = ax² + bx + c)
}

/**
 * Complete road boundary detection result
 */
export interface RoadBoundaryData {
  leftBoundary: Point[];
  rightBoundary: Point[];
  leftPolynomial: PolynomialCoefficients;
  rightPolynomial: PolynomialCoefficients;
  confidence: number; // 0-1
}

/**
 * Configuration options for road detection
 */
export interface RoadDetectionConfig {
  cannyThreshold1: number;
  cannyThreshold2: number;
  houghThreshold: number;
  minLineLength: number;
  maxLineGap: number;
  polynomialDegree: number;
  downsampleFactor: number;
}

const DEFAULT_CONFIG: RoadDetectionConfig = {
  cannyThreshold1: 50,
  cannyThreshold2: 150,
  houghThreshold: 50,
  minLineLength: 50,
  maxLineGap: 10,
  polynomialDegree: 2,
  downsampleFactor: 2,
};

/**
 * RoadDetector class for detecting and analyzing road boundaries
 * using OpenCV.js image processing techniques
 */
export class RoadDetector {
  private config: RoadDetectionConfig;
  /** Camera calibration data - reserved for future perspective correction features */
  private _calibration: CalibrationData | null;
  private debug: boolean;

  /**
   * Create a new RoadDetector instance
   * @param calibration - Optional camera calibration data for perspective correction
   * @param config - Optional configuration overrides
   * @param debug - Enable debug mode for visualization
   */
  constructor(
    calibration: CalibrationData | null = null,
    config: Partial<RoadDetectionConfig> = {},
    debug = false
  ) {
    this._calibration = calibration;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.debug = debug;
  }

  /**
   * Get camera calibration data
   * @returns Current calibration data or null
   */
  public getCalibration(): CalibrationData | null {
    return this._calibration;
  }

  /**
   * Detect road boundaries from camera image
   * @param imageData - Input image data from camera
   * @returns Road boundary data with left/right boundaries and polynomials
   */
  public detectRoadBoundaries(imageData: ImageData): RoadBoundaryData {
    if (!isOpenCVReady()) {
      return this.getEmptyBoundaryData();
    }

    try {
      const cv = window.cv;
      
      // Convert ImageData to OpenCV Mat
      const src = cv.matFromImageData(imageData);
      
      // Downsample for performance
      const downsampled = new cv.Mat();
      const scale = 1 / this.config.downsampleFactor;
      cv.resize(src, downsampled, new cv.Size(0, 0), scale, scale, cv.INTER_LINEAR);
      
      // Convert to grayscale
      const gray = new cv.Mat();
      cv.cvtColor(downsampled, gray, cv.COLOR_RGBA2GRAY);
      
      // Apply Gaussian blur to reduce noise
      const blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
      
      // Apply Canny edge detection
      const edges = new cv.Mat();
      cv.Canny(
        blurred,
        edges,
        this.config.cannyThreshold1,
        this.config.cannyThreshold2
      );
      
      // Define ROI (Region of Interest) - focus on bottom half of image
      const roi = edges.roi(
        new cv.Rect(
          0,
          Math.floor(edges.rows * 0.4),
          edges.cols,
          Math.floor(edges.rows * 0.6)
        )
      );
      
      // Detect lines using Hough transform
      const lines = new cv.Mat();
      cv.HoughLinesP(
        roi,
        lines,
        1,
        Math.PI / 180,
        this.config.houghThreshold,
        this.config.minLineLength,
        this.config.maxLineGap
      );
      
      // Separate and merge lines into left and right boundaries
      const { leftPoints, rightPoints } = this.separateLeftRightLines(
        lines,
        downsampled.cols,
        downsampled.rows
      );
      
      // Scale points back to original image size
      const leftBoundary = leftPoints.map(p => ({
        x: p.x * this.config.downsampleFactor,
        y: (p.y + Math.floor(edges.rows * 0.4)) * this.config.downsampleFactor,
      }));
      
      const rightBoundary = rightPoints.map(p => ({
        x: p.x * this.config.downsampleFactor,
        y: (p.y + Math.floor(edges.rows * 0.4)) * this.config.downsampleFactor,
      }));
      
      // Smooth boundaries
      const [smoothedLeft, smoothedRight] = this.smoothBoundaries([
        leftBoundary,
        rightBoundary,
      ]);
      
      // Fit polynomial curves
      const leftPolynomial = this.fitPolynomialCurve(smoothedLeft);
      const rightPolynomial = this.fitPolynomialCurve(smoothedRight);
      
      // Calculate confidence based on number of detected points
      const confidence = this.calculateConfidence(smoothedLeft, smoothedRight);
      
      // Cleanup OpenCV Mats
      src.delete();
      downsampled.delete();
      gray.delete();
      blurred.delete();
      edges.delete();
      roi.delete();
      lines.delete();
      
      return {
        leftBoundary: smoothedLeft,
        rightBoundary: smoothedRight,
        leftPolynomial,
        rightPolynomial,
        confidence,
      };
    } catch (error) {
      return this.getEmptyBoundaryData();
    }
  }

  /**
   * Fit a polynomial curve to a set of boundary points
   * @param points - Array of boundary points
   * @returns Polynomial coefficients
   */
  public fitPolynomialCurve(points: Point[]): PolynomialCoefficients {
    if (points.length < 3) {
      return {
        degree: this.config.polynomialDegree,
        coefficients: Array(this.config.polynomialDegree + 1).fill(0),
      };
    }

    try {
      // Extract x and y coordinates
      const xValues = points.map(p => p.x);
      const yValues = points.map(p => p.y);
      
      // Fit x as a function of y (x = f(y)) since road lines are more vertical
      // Using least squares method: (V^T * V)^-1 * V^T * x
      // where V is the Vandermonde matrix
      
      const n = yValues.length;
      const degree = this.config.polynomialDegree;
      
      // Build Vandermonde matrix
      const V: number[][] = [];
      for (let i = 0; i < n; i++) {
        const row: number[] = [];
        for (let j = 0; j <= degree; j++) {
          row.push(Math.pow(yValues[i], j));
        }
        V.push(row);
      }
      
      // Solve using least squares
      const Vt = math.transpose(V);
      const VtV = math.multiply(Vt, V) as number[][];
      const VtVinv = math.inv(VtV) as number[][];
      const Vtx = math.multiply(Vt, xValues) as number[];
      const coefficients = math.multiply(VtVinv, Vtx) as number[];
      
      return {
        degree: this.config.polynomialDegree,
        coefficients: Array.isArray(coefficients) ? coefficients : [coefficients],
      };
    } catch (error) {
      return {
        degree: this.config.polynomialDegree,
        coefficients: Array(this.config.polynomialDegree + 1).fill(0),
      };
    }
  }

  /**
   * Smooth road boundaries using Gaussian smoothing and outlier removal
   * @param boundaries - Array of boundary point arrays [left, right]
   * @returns Smoothed boundary arrays
   */
  public smoothBoundaries(boundaries: Point[][]): Point[][] {
    return boundaries.map(boundary => {
      if (boundary.length < 3) {
        return boundary;
      }

      try {
        // Remove outliers using statistical methods
        const cleaned = this.removeOutliers(boundary);
        
        // Apply simple moving average smoothing
        const windowSize = Math.min(5, Math.floor(cleaned.length / 3));
        if (windowSize < 2) {
          return cleaned;
        }
        
        const smoothed: Point[] = [];
        for (let i = 0; i < cleaned.length; i++) {
          const start = Math.max(0, i - Math.floor(windowSize / 2));
          const end = Math.min(cleaned.length, i + Math.ceil(windowSize / 2));
          const window = cleaned.slice(start, end);
          
          const avgX = window.reduce((sum, p) => sum + p.x, 0) / window.length;
          const avgY = window.reduce((sum, p) => sum + p.y, 0) / window.length;
          
          smoothed.push({ x: avgX, y: avgY });
        }
        
        return smoothed;
      } catch (error) {
        return boundary;
      }
    });
  }

  /**
   * Separate detected lines into left and right road boundaries
   * @private
   */
  private separateLeftRightLines(
    lines: any,
    imageWidth: number,
    _imageHeight: number
  ): { leftPoints: Point[]; rightPoints: Point[] } {
    const leftPoints: Point[] = [];
    const rightPoints: Point[] = [];
    const centerX = imageWidth / 2;

    for (let i = 0; i < lines.rows; i++) {
      const x1 = lines.data32S[i * 4];
      const y1 = lines.data32S[i * 4 + 1];
      const x2 = lines.data32S[i * 4 + 2];
      const y2 = lines.data32S[i * 4 + 3];
      
      // Calculate slope
      const slope = (y2 - y1) / (x2 - x1);
      
      // Filter out horizontal lines
      if (Math.abs(slope) < 0.3) {
        continue;
      }
      
      // Classify as left or right based on position and slope
      const midX = (x1 + x2) / 2;
      
      if (midX < centerX && slope < 0) {
        // Left boundary (negative slope on left side)
        leftPoints.push({ x: x1, y: y1 });
        leftPoints.push({ x: x2, y: y2 });
      } else if (midX > centerX && slope > 0) {
        // Right boundary (positive slope on right side)
        rightPoints.push({ x: x1, y: y1 });
        rightPoints.push({ x: x2, y: y2 });
      }
    }

    return { leftPoints, rightPoints };
  }

  /**
   * Remove outlier points using statistical methods (IQR method)
   * @private
   */
  private removeOutliers(points: Point[]): Point[] {
    if (points.length < 4) {
      return points;
    }

    // Calculate statistics for x coordinates
    const xValues = points.map(p => p.x).sort((a, b) => a - b);
    const q1 = xValues[Math.floor(xValues.length * 0.25)];
    const q3 = xValues[Math.floor(xValues.length * 0.75)];
    const iqr = q3 - q1;
    const xMin = q1 - 1.5 * iqr;
    const xMax = q3 + 1.5 * iqr;

    // Filter outliers
    return points.filter(p => p.x >= xMin && p.x <= xMax);
  }

  /**
   * Calculate confidence score based on detected boundary quality
   * @private
   */
  private calculateConfidence(leftBoundary: Point[], rightBoundary: Point[]): number {
    const totalPoints = leftBoundary.length + rightBoundary.length;
    
    if (totalPoints === 0) {
      return 0;
    }
    
    // Confidence based on number of points detected
    const pointsScore = Math.min(totalPoints / 100, 1.0);
    
    // Check if both boundaries are detected
    const balanceScore = leftBoundary.length > 0 && rightBoundary.length > 0 ? 1.0 : 0.5;
    
    return pointsScore * balanceScore;
  }

  /**
   * Get empty boundary data for error cases
   * @private
   */
  private getEmptyBoundaryData(): RoadBoundaryData {
    return {
      leftBoundary: [],
      rightBoundary: [],
      leftPolynomial: {
        degree: this.config.polynomialDegree,
        coefficients: Array(this.config.polynomialDegree + 1).fill(0),
      },
      rightPolynomial: {
        degree: this.config.polynomialDegree,
        coefficients: Array(this.config.polynomialDegree + 1).fill(0),
      },
      confidence: 0,
    };
  }

  /**
   * Update calibration data
   */
  public setCalibration(calibration: CalibrationData): void {
    this._calibration = calibration;
  }

  /**
   * Update configuration
   */
  public setConfig(config: Partial<RoadDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
