import { RoadBoundaryData, Point, PolynomialCoefficients } from './roadDetection';
import { CalibrationData } from '@/types/calibration';

/**
 * Complete turn analysis result
 */
export interface TurnAnalysis {
  radius: number; // meters
  angle: number; // degrees
  direction: 'left' | 'right' | 'straight';
  type: 'sharp' | 'moderate' | 'gentle' | 'straight';
  curvatureProfile: number[]; // curvature along path
  vanishingPoint: Point | null;
}

/**
 * Configuration for turn detection
 */
export interface TurnDetectorConfig {
  sharpTurnRadius: number; // meters
  moderateTurnRadius: number; // meters
  gentleTurnRadius: number; // meters
  straightThreshold: number; // curvature threshold for straight road
  samplingPoints: number; // number of points to sample along curve
  pixelsToMeters: number; // conversion factor (default, overridden by calibration)
}

const DEFAULT_CONFIG: TurnDetectorConfig = {
  sharpTurnRadius: 15, // < 15m is sharp turn
  moderateTurnRadius: 30, // 15-30m is moderate turn
  gentleTurnRadius: 60, // 30-60m is gentle turn, > 60m is straight
  straightThreshold: 0.001, // curvature < 0.001 is considered straight
  samplingPoints: 20,
  pixelsToMeters: 0.01, // default conversion (will be calibrated)
};

/**
 * TurnDetector class for analyzing road curvature and turn characteristics
 */
export class TurnDetector {
  private config: TurnDetectorConfig;
  private calibration: CalibrationData | null;
  private debug: boolean;

  /**
   * Create a new TurnDetector instance
   * @param calibration - Optional camera calibration data for pixel-to-meter conversion
   * @param config - Optional configuration overrides
   * @param debug - Enable debug mode for logging
   */
  constructor(
    calibration: CalibrationData | null = null,
    config: Partial<TurnDetectorConfig> = {},
    debug = false
  ) {
    this.calibration = calibration;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.debug = debug;
  }

  /**
   * Analyze turn characteristics from road boundary data
   * @param boundaries - Detected road boundary data
   * @returns Complete turn analysis
   */
  public analyzeTurn(boundaries: RoadBoundaryData): TurnAnalysis {
    try {
      // Check if we have valid boundary data
      if (boundaries.confidence < 0.3) {
        return this.getDefaultAnalysis();
      }

      // Calculate curvature profile along the centerline
      const curvatureProfile = this.calculateCurvatureProfile(boundaries);
      
      // Estimate effective turn radius
      const radius = this.estimateTurnRadius(boundaries);
      
      // Determine turn direction
      const direction = this.determineTurnDirection(
        boundaries.leftPolynomial,
        boundaries.rightPolynomial
      );
      
      // Classify turn type based on radius
      const type = this.classifyTurnType(radius);
      
      // Estimate turn angle
      const angle = this.estimateTurnAngle(boundaries, radius);
      
      // Detect vanishing point for perspective
      const vanishingPoint = this.detectVanishingPoint(boundaries);
      
      return {
        radius,
        angle,
        direction,
        type,
        curvatureProfile,
        vanishingPoint,
      };
    } catch (error) {
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Calculate curvature at a specific point using polynomial coefficients
   * Formula: k = |f''(x)| / (1 + f'(x)²)^(3/2)
   * @param poly - Polynomial coefficients
   * @param x - Point at which to calculate curvature
   * @returns Curvature value (1/radius)
   */
  public calculateCurvature(poly: PolynomialCoefficients, x: number): number {
    try {
      // Check if polynomial is valid
      if (!poly.coefficients || poly.coefficients.every(c => c === 0)) {
        return 0;
      }

      // Create polynomial function: f(x) = a*x^2 + b*x + c (for degree 2)
      // For general polynomial: f(x) = Σ(coefficients[i] * x^i)
      
      // First derivative: f'(x) = 2*a*x + b (for degree 2)
      // For general: f'(x) = Σ(i * coefficients[i] * x^(i-1))
      let firstDerivative = 0;
      for (let i = 1; i <= poly.degree; i++) {
        firstDerivative += i * poly.coefficients[i] * Math.pow(x, i - 1);
      }
      
      // Second derivative: f''(x) = 2*a (for degree 2)
      // For general: f''(x) = Σ(i * (i-1) * coefficients[i] * x^(i-2))
      let secondDerivative = 0;
      for (let i = 2; i <= poly.degree; i++) {
        secondDerivative += i * (i - 1) * poly.coefficients[i] * Math.pow(x, i - 2);
      }
      
      // Apply curvature formula
      const numerator = Math.abs(secondDerivative);
      const denominator = Math.pow(1 + firstDerivative * firstDerivative, 1.5);
      
      if (denominator === 0) {
        return 0;
      }
      
      const curvature = numerator / denominator;
      
      return curvature;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Estimate effective turn radius from road boundaries
   * @param boundaries - Road boundary data
   * @returns Turn radius in meters
   */
  public estimateTurnRadius(boundaries: RoadBoundaryData): number {
    try {
      // Calculate average curvature along the centerline polynomial
      const centerPolynomial = this.calculateCenterlinePolynomial(
        boundaries.leftPolynomial,
        boundaries.rightPolynomial
      );
      
      // Sample curvature at multiple points
      const minY = Math.min(
        ...boundaries.leftBoundary.map(p => p.y),
        ...boundaries.rightBoundary.map(p => p.y)
      );
      const maxY = Math.max(
        ...boundaries.leftBoundary.map(p => p.y),
        ...boundaries.rightBoundary.map(p => p.y)
      );
      
      const yRange = maxY - minY;
      const curvatures: number[] = [];
      
      for (let i = 0; i < this.config.samplingPoints; i++) {
        const y = minY + (yRange * i) / (this.config.samplingPoints - 1);
        const curvature = this.calculateCurvature(centerPolynomial, y);
        if (curvature > 0) {
          curvatures.push(curvature);
        }
      }
      
      // Calculate average curvature
      const avgCurvature = curvatures.length > 0
        ? curvatures.reduce((sum, c) => sum + c, 0) / curvatures.length
        : 0;
      
      // Convert curvature to radius
      // radius = 1 / curvature (in pixels)
      if (avgCurvature < this.config.straightThreshold) {
        return Infinity; // Straight road
      }
      
      const radiusPixels = 1 / avgCurvature;
      
      // Convert pixels to meters using calibration or default
      const radiusMeters = radiusPixels * this.getPixelsToMetersConversion();
      
      return radiusMeters;
    } catch (error) {
      return Infinity;
    }
  }

  /**
   * Detect vanishing point from road boundary lines
   * @param boundaries - Road boundary data
   * @returns Vanishing point coordinates or null if not found
   */
  public detectVanishingPoint(boundaries: RoadBoundaryData): Point | null {
    try {
      // Check if we have enough boundary points
      if (boundaries.leftBoundary.length < 2 || boundaries.rightBoundary.length < 2) {
        return null;
      }

      // Use the upper portion of the boundaries (far end)
      const leftTop = boundaries.leftBoundary
        .sort((a, b) => a.y - b.y)
        .slice(0, Math.min(5, boundaries.leftBoundary.length));
      
      const rightTop = boundaries.rightBoundary
        .sort((a, b) => a.y - b.y)
        .slice(0, Math.min(5, boundaries.rightBoundary.length));
      
      if (leftTop.length < 2 || rightTop.length < 2) {
        return null;
      }
      
      // Fit lines to the top portions
      const leftLine = this.fitLine(leftTop);
      const rightLine = this.fitLine(rightTop);
      
      if (!leftLine || !rightLine) {
        return null;
      }
      
      // Find intersection point
      const intersection = this.lineIntersection(
        leftLine.slope,
        leftLine.intercept,
        rightLine.slope,
        rightLine.intercept
      );
      
      return intersection;
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate curvature profile along the road
   * @private
   */
  private calculateCurvatureProfile(boundaries: RoadBoundaryData): number[] {
    const centerPolynomial = this.calculateCenterlinePolynomial(
      boundaries.leftPolynomial,
      boundaries.rightPolynomial
    );
    
    const minY = Math.min(
      ...boundaries.leftBoundary.map(p => p.y),
      ...boundaries.rightBoundary.map(p => p.y)
    );
    const maxY = Math.max(
      ...boundaries.leftBoundary.map(p => p.y),
      ...boundaries.rightBoundary.map(p => p.y)
    );
    
    const yRange = maxY - minY;
    const profile: number[] = [];
    
    for (let i = 0; i < this.config.samplingPoints; i++) {
      const y = minY + (yRange * i) / (this.config.samplingPoints - 1);
      const curvature = this.calculateCurvature(centerPolynomial, y);
      profile.push(curvature);
    }
    
    return profile;
  }

  /**
   * Calculate centerline polynomial from left and right boundaries
   * @private
   */
  private calculateCenterlinePolynomial(
    left: PolynomialCoefficients,
    right: PolynomialCoefficients
  ): PolynomialCoefficients {
    // Average the coefficients
    const degree = Math.max(left.degree, right.degree);
    const coefficients: number[] = [];
    
    for (let i = 0; i <= degree; i++) {
      const leftCoeff = i < left.coefficients.length ? left.coefficients[i] : 0;
      const rightCoeff = i < right.coefficients.length ? right.coefficients[i] : 0;
      coefficients.push((leftCoeff + rightCoeff) / 2);
    }
    
    return { degree, coefficients };
  }

  /**
   * Determine turn direction from boundary polynomials
   * @private
   */
  private determineTurnDirection(
    left: PolynomialCoefficients,
    right: PolynomialCoefficients
  ): 'left' | 'right' | 'straight' {
    // Use the second-degree coefficient to determine direction
    // Positive indicates right turn, negative indicates left turn
    const centerPoly = this.calculateCenterlinePolynomial(left, right);
    
    if (centerPoly.degree < 2) {
      return 'straight';
    }
    
    const secondOrderCoeff = centerPoly.coefficients[2];
    
    if (Math.abs(secondOrderCoeff) < 0.0001) {
      return 'straight';
    }
    
    return secondOrderCoeff > 0 ? 'right' : 'left';
  }

  /**
   * Classify turn type based on radius
   * @private
   */
  private classifyTurnType(radius: number): 'sharp' | 'moderate' | 'gentle' | 'straight' {
    if (!isFinite(radius) || radius > this.config.gentleTurnRadius) {
      return 'straight';
    } else if (radius < this.config.sharpTurnRadius) {
      return 'sharp';
    } else if (radius < this.config.moderateTurnRadius) {
      return 'moderate';
    } else {
      return 'gentle';
    }
  }

  /**
   * Estimate turn angle from boundaries
   * @private
   */
  private estimateTurnAngle(boundaries: RoadBoundaryData, radius: number): number {
    if (!isFinite(radius) || radius === 0) {
      return 0;
    }

    // Estimate arc length from boundary points
    const centerline = this.calculateCenterlinePoints(boundaries);
    const arcLength = this.calculatePathLength(centerline);
    
    // Convert to meters
    const arcLengthMeters = arcLength * this.getPixelsToMetersConversion();
    
    // Calculate angle: angle = arcLength / radius (in radians)
    const angleRadians = arcLengthMeters / radius;
    const angleDegrees = (angleRadians * 180) / Math.PI;
    
    return Math.min(angleDegrees, 90); // Cap at 90 degrees
  }

  /**
   * Calculate centerline points from boundaries
   * @private
   */
  private calculateCenterlinePoints(boundaries: RoadBoundaryData): Point[] {
    const points: Point[] = [];
    const maxLength = Math.max(
      boundaries.leftBoundary.length,
      boundaries.rightBoundary.length
    );
    
    for (let i = 0; i < maxLength; i++) {
      const leftIdx = Math.min(i, boundaries.leftBoundary.length - 1);
      const rightIdx = Math.min(i, boundaries.rightBoundary.length - 1);
      
      const left = boundaries.leftBoundary[leftIdx];
      const right = boundaries.rightBoundary[rightIdx];
      
      if (left && right) {
        points.push({
          x: (left.x + right.x) / 2,
          y: (left.y + right.y) / 2,
        });
      }
    }
    
    return points;
  }

  /**
   * Calculate path length from points
   * @private
   */
  private calculatePathLength(points: Point[]): number {
    let length = 0;
    
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    
    return length;
  }

  /**
   * Fit a line to points using least squares
   * @private
   */
  private fitLine(points: Point[]): { slope: number; intercept: number } | null {
    if (points.length < 2) {
      return null;
    }

    const n = points.length;
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  }

  /**
   * Find intersection of two lines
   * @private
   */
  private lineIntersection(
    slope1: number,
    intercept1: number,
    slope2: number,
    intercept2: number
  ): Point | null {
    // Check for parallel lines
    if (Math.abs(slope1 - slope2) < 0.001) {
      return null;
    }

    // y = slope1 * x + intercept1
    // y = slope2 * x + intercept2
    // slope1 * x + intercept1 = slope2 * x + intercept2
    // x = (intercept2 - intercept1) / (slope1 - slope2)
    
    const x = (intercept2 - intercept1) / (slope1 - slope2);
    const y = slope1 * x + intercept1;
    
    return { x, y };
  }

  /**
   * Get pixels to meters conversion factor
   * @private
   */
  private getPixelsToMetersConversion(): number {
    if (this.calibration?.focalLength) {
      // Use calibration data for more accurate conversion
      // This is a simplified conversion; real implementation would use
      // actual camera parameters and distance estimation
      return this.config.pixelsToMeters;
    }
    return this.config.pixelsToMeters;
  }

  /**
   * Get default analysis for error cases
   * @private
   */
  private getDefaultAnalysis(): TurnAnalysis {
    return {
      radius: Infinity,
      angle: 0,
      direction: 'straight',
      type: 'straight',
      curvatureProfile: [],
      vanishingPoint: null,
    };
  }

  /**
   * Update calibration data
   */
  public setCalibration(calibration: CalibrationData): void {
    this.calibration = calibration;
  }

  /**
   * Update configuration
   */
  public setConfig(config: Partial<TurnDetectorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
