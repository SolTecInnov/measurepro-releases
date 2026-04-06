let openCVInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

export async function initializeOpenCV(): Promise<boolean> {
  if (openCVInitialized) {
    return true;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = new Promise<boolean>((resolve) => {
    if (window.cv && window.cv.Mat) {
      openCVInitialized = true;
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    
    script.onload = () => {
      if (window.cv && typeof window.cv.onRuntimeInitialized !== 'undefined') {
        window.cv.onRuntimeInitialized = () => {
          openCVInitialized = true;
          resolve(true);
        };
      } else {
        openCVInitialized = true;
        resolve(true);
      }
    };

    script.onerror = () => {
      resolve(false);
    };

    document.head.appendChild(script);
  });

  return initializationPromise;
}

export function isOpenCVReady(): boolean {
  return openCVInitialized && window.cv && window.cv.Mat;
}
