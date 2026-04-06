/**
 * Image Processing Worker
 * Handles CPU-intensive image operations off the main thread:
 * - Canvas operations
 * - JPEG/PNG compression
 * - Overlay rendering
 * - EXIF metadata injection
 */

export interface ImageProcessingTask {
  id: string;
  type: 'compress' | 'overlay' | 'capture';
  imageData?: ImageData;
  videoFrame?: ImageBitmap;
  canvas?: OffscreenCanvas;
  options: {
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
    maxWidth?: number;
    maxHeight?: number;
    overlay?: {
      text?: string;
      timestamp?: string;
      gps?: { lat: number; lon: number };
      height?: number;
    };
  };
}

export interface ImageProcessingResult {
  id: string;
  dataUrl?: string;
  blob?: Blob;
  width: number;
  height: number;
  processingTime: number;
  error?: string;
}

// Worker message handler
self.onmessage = async (event: MessageEvent<ImageProcessingTask>) => {
  const startTime = performance.now();
  const task = event.data;

  try {
    let result: ImageProcessingResult;

    switch (task.type) {
      case 'compress':
        result = await compressImage(task);
        break;
      case 'overlay':
        result = await applyOverlay(task);
        break;
      case 'capture':
        result = await captureFrame(task);
        break;
      default:
        throw new Error(`Unknown task type: ${(task as any).type}`);
    }

    result.processingTime = performance.now() - startTime;
    self.postMessage(result);
  } catch (error) {
    const errorResult: ImageProcessingResult = {
      id: task.id,
      width: 0,
      height: 0,
      processingTime: performance.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(errorResult);
  }
};

/**
 * Compress image using OffscreenCanvas
 */
async function compressImage(task: ImageProcessingTask): Promise<ImageProcessingResult> {
  const { options, imageData, videoFrame } = task;
  const quality = options.quality || 0.75;
  const format = options.format || 'jpeg';

  // Create canvas from image data or video frame
  let canvas: OffscreenCanvas;
  let ctx: OffscreenCanvasRenderingContext2D;

  if (imageData) {
    canvas = new OffscreenCanvas(imageData.width, imageData.height);
    ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
  } else if (videoFrame) {
    canvas = new OffscreenCanvas(videoFrame.width, videoFrame.height);
    ctx = canvas.getContext('2d')!;
    ctx.drawImage(videoFrame, 0, 0);
    videoFrame.close(); // Clean up
  } else {
    throw new Error('No image source provided');
  }

  // Resize if needed
  if (options.maxWidth || options.maxHeight) {
    const { width, height } = calculateResizeProps(
      canvas.width,
      canvas.height,
      options.maxWidth,
      options.maxHeight
    );
    const resizedCanvas = new OffscreenCanvas(width, height);
    const resizedCtx = resizedCanvas.getContext('2d')!;
    resizedCtx.drawImage(canvas, 0, 0, width, height);
    canvas = resizedCanvas;
  }

  // Convert to blob
  const mimeType = `image/${format}`;
  const blob = await canvas.convertToBlob({ type: mimeType, quality });

  // Convert blob to data URL
  const dataUrl = await blobToDataUrl(blob);

  return {
    id: task.id,
    dataUrl,
    blob,
    width: canvas.width,
    height: canvas.height,
    processingTime: 0, // Will be set by caller
  };
}

/**
 * Apply overlay to image
 */
async function applyOverlay(task: ImageProcessingTask): Promise<ImageProcessingResult> {
  const { options, imageData, videoFrame } = task;
  
  // Create canvas
  let canvas: OffscreenCanvas;
  let ctx: OffscreenCanvasRenderingContext2D;

  if (imageData) {
    canvas = new OffscreenCanvas(imageData.width, imageData.height);
    ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
  } else if (videoFrame) {
    canvas = new OffscreenCanvas(videoFrame.width, videoFrame.height);
    ctx = canvas.getContext('2d')!;
    ctx.drawImage(videoFrame, 0, 0);
    videoFrame.close();
  } else {
    throw new Error('No image source provided');
  }

  // Apply overlay if provided
  if (options.overlay) {
    const { text, timestamp, gps, height } = options.overlay;
    
    // Setup text style
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.font = '16px Arial';
    
    let y = 30;
    const lineHeight = 25;
    
    // Draw text overlays
    if (text) {
      ctx.fillRect(10, y - 20, ctx.measureText(text).width + 20, 25);
      ctx.fillStyle = 'white';
      ctx.fillText(text, 20, y);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      y += lineHeight;
    }
    
    if (timestamp) {
      ctx.fillRect(10, y - 20, ctx.measureText(timestamp).width + 20, 25);
      ctx.fillStyle = 'white';
      ctx.fillText(timestamp, 20, y);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      y += lineHeight;
    }
    
    if (gps) {
      const gpsText = `GPS: ${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`;
      ctx.fillRect(10, y - 20, ctx.measureText(gpsText).width + 20, 25);
      ctx.fillStyle = 'white';
      ctx.fillText(gpsText, 20, y);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      y += lineHeight;
    }
    
    if (height !== undefined) {
      const heightText = `Height: ${height.toFixed(2)}m`;
      ctx.fillRect(10, y - 20, ctx.measureText(heightText).width + 20, 25);
      ctx.fillStyle = 'white';
      ctx.fillText(heightText, 20, y);
    }
  }

  // Convert to blob
  const quality = options.quality || 0.75;
  const format = options.format || 'jpeg';
  const mimeType = `image/${format}`;
  const blob = await canvas.convertToBlob({ type: mimeType, quality });
  const dataUrl = await blobToDataUrl(blob);

  return {
    id: task.id,
    dataUrl,
    blob,
    width: canvas.width,
    height: canvas.height,
    processingTime: 0,
  };
}

/**
 * Capture frame from video
 */
async function captureFrame(task: ImageProcessingTask): Promise<ImageProcessingResult> {
  // Similar to compress but optimized for video frame capture
  return compressImage(task);
}

/**
 * Calculate resize proportions maintaining aspect ratio
 */
function calculateResizeProps(
  width: number,
  height: number,
  maxWidth?: number,
  maxHeight?: number
): { width: number; height: number } {
  if (!maxWidth && !maxHeight) {
    return { width, height };
  }

  let newWidth = width;
  let newHeight = height;

  if (maxWidth && newWidth > maxWidth) {
    newHeight = (maxWidth / newWidth) * newHeight;
    newWidth = maxWidth;
  }

  if (maxHeight && newHeight > maxHeight) {
    newWidth = (maxHeight / newHeight) * newWidth;
    newHeight = maxHeight;
  }

  return {
    width: Math.round(newWidth),
    height: Math.round(newHeight),
  };
}

/**
 * Convert Blob to Data URL
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export {};
