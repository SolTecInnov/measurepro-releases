import { CapturedCalibrationImage, CalibrationSettings } from '@/types/calibration';

export interface CalibrationResult {
  success: boolean;
  cameraMatrix: number[][] | null;
  distortionCoeffs: number[] | null;
  focalLength: { x: number; y: number } | null;
  principalPoint: { x: number; y: number } | null;
  reprojectionError: number | null;
  quality: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR';
  message: string;
}

export async function calculateCameraCalibration(
  capturedImages: CapturedCalibrationImage[],
  settings: CalibrationSettings,
  imageWidth: number,
  imageHeight: number
): Promise<CalibrationResult> {
  try {
    if (capturedImages.length < settings.minCaptures) {
      return {
        success: false,
        cameraMatrix: null,
        distortionCoeffs: null,
        focalLength: null,
        principalPoint: null,
        reprojectionError: null,
        quality: 'POOR',
        message: `Need at least ${settings.minCaptures} images. Currently have ${capturedImages.length}.`
      };
    }

    const cv = window.cv;
    if (!cv) {
      throw new Error('OpenCV.js not initialized');
    }

    const objectPointsVec = new cv.MatVector();
    const imagePointsVec = new cv.MatVector();

    for (let i = 0; i < capturedImages.length; i++) {
      const objPts = [];
      
      for (let row = 0; row < settings.patternSize.height; row++) {
        for (let col = 0; col < settings.patternSize.width; col++) {
          objPts.push(col * settings.squareSize);
          objPts.push(row * settings.squareSize);
          objPts.push(0);
        }
      }
      
      const objMat = cv.matFromArray(
        settings.patternSize.height * settings.patternSize.width,
        1,
        cv.CV_32FC3,
        objPts
      );
      objectPointsVec.push_back(objMat);
      
      const imgPts = capturedImages[i].corners.flat();
      const imgMat = cv.matFromArray(
        settings.patternSize.height * settings.patternSize.width,
        1,
        cv.CV_32FC2,
        imgPts
      );
      imagePointsVec.push_back(imgMat);
      
      objMat.delete();
      imgMat.delete();
    }

    const imageSize = new cv.Size(imageWidth, imageHeight);
    const cameraMatrix = new cv.Mat();
    const distCoeffs = new cv.Mat();
    const rvecs = new cv.MatVector();
    const tvecs = new cv.MatVector();

    const reprojectionError = cv.calibrateCamera(
      objectPointsVec,
      imagePointsVec,
      imageSize,
      cameraMatrix,
      distCoeffs,
      rvecs,
      tvecs,
      0
    );

    const fx = cameraMatrix.doubleAt(0, 0);
    const fy = cameraMatrix.doubleAt(1, 1);
    const cx = cameraMatrix.doubleAt(0, 2);
    const cy = cameraMatrix.doubleAt(1, 2);

    const cameraMatrixArray = [
      [cameraMatrix.doubleAt(0, 0), cameraMatrix.doubleAt(0, 1), cameraMatrix.doubleAt(0, 2)],
      [cameraMatrix.doubleAt(1, 0), cameraMatrix.doubleAt(1, 1), cameraMatrix.doubleAt(1, 2)],
      [cameraMatrix.doubleAt(2, 0), cameraMatrix.doubleAt(2, 1), cameraMatrix.doubleAt(2, 2)]
    ];

    const distCoeffsArray = [];
    for (let i = 0; i < distCoeffs.rows; i++) {
      distCoeffsArray.push(distCoeffs.doubleAt(i, 0));
    }

    let quality: 'EXCELLENT' | 'GOOD' | 'NEEDS_IMPROVEMENT' | 'POOR';
    if (reprojectionError < 0.5) {
      quality = 'EXCELLENT';
    } else if (reprojectionError < 1.0) {
      quality = 'GOOD';
    } else if (reprojectionError < 2.0) {
      quality = 'NEEDS_IMPROVEMENT';
    } else {
      quality = 'POOR';
    }

    objectPointsVec.delete();
    imagePointsVec.delete();
    cameraMatrix.delete();
    distCoeffs.delete();
    rvecs.delete();
    tvecs.delete();

    return {
      success: true,
      cameraMatrix: cameraMatrixArray,
      distortionCoeffs: distCoeffsArray,
      focalLength: { x: fx, y: fy },
      principalPoint: { x: cx, y: cy },
      reprojectionError,
      quality,
      message: `Calibration successful! Quality: ${quality} (error: ${reprojectionError.toFixed(3)})`
    };

  } catch (error) {
    return {
      success: false,
      cameraMatrix: null,
      distortionCoeffs: null,
      focalLength: null,
      principalPoint: null,
      reprojectionError: null,
      quality: 'POOR',
      message: `Calibration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export async function captureCalibrationImage(
  videoElement: HTMLVideoElement,
  settings: CalibrationSettings
): Promise<{ success: boolean; corners: number[][]; message: string; imageData?: string }> {
  try {
    const cv = window.cv;
    if (!cv) {
      throw new Error('OpenCV.js not initialized');
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    
    ctx.drawImage(videoElement, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.95);

    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    const patternSize = new cv.Size(settings.patternSize.width, settings.patternSize.height);
    const corners = new cv.Mat();
    const found = cv.findChessboardCorners(
      gray,
      patternSize,
      corners,
      cv.CALIB_CB_ADAPTIVE_THRESH + cv.CALIB_CB_NORMALIZE_IMAGE
    );

    if (!found) {
      src.delete();
      gray.delete();
      corners.delete();
      return {
        success: false,
        corners: [],
        message: 'No chessboard pattern detected. Ensure pattern is fully visible and well-lit.'
      };
    }

    const criteria = new cv.TermCriteria(
      cv.TERM_CRITERIA_EPS + cv.TERM_CRITERIA_MAX_ITER,
      30,
      0.001
    );
    cv.cornerSubPix(gray, corners, new cv.Size(11, 11), new cv.Size(-1, -1), criteria);

    cv.drawChessboardCorners(src, patternSize, corners, found);
    cv.imshow(canvas, src);

    const cornerArray: number[][] = [];
    for (let i = 0; i < corners.rows; i++) {
      cornerArray.push([
        corners.floatAt(i, 0),
        corners.floatAt(i, 1)
      ]);
    }

    src.delete();
    gray.delete();
    corners.delete();

    return {
      success: true,
      corners: cornerArray,
      message: `Successfully detected ${cornerArray.length} corners`,
      imageData
    };

  } catch (error) {
    return {
      success: false,
      corners: [],
      message: `Detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
