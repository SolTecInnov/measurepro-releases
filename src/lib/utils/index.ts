// Note: errorHandler.ts is excluded from client-side exports as it uses Node.js fs module
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes
 * @param inputs - Class values to merge
 * @returns Merged class string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Utility function to safely parse a value as a number
 * @param value - The value to parse
 * @param defaultValue - Default value to return if parsing fails
 * @returns The parsed number or default value
 */
export function safeParseNumber(value: unknown, defaultValue: number = 0): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  
  if (typeof value === 'number') {
    return isNaN(value) ? defaultValue : value;
  }
  
  if (typeof value === 'string') {
    // Remove any non-numeric characters except decimal point and minus sign
    const cleanedValue = value.replace(/[^\d.-]/g, '');
    const parsedValue = parseFloat(cleanedValue);
    return isNaN(parsedValue) ? defaultValue : parsedValue;
  }
  
  return defaultValue;
}

/**
 * Utility function to handle errors in async functions
 * @param fn - The async function to execute
 * @param errorHandler - Optional custom error handler
 * @returns A promise that resolves to the result or rejects with the error
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorHandler?: (error: Error) => void
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (errorHandler) {
      errorHandler(error as Error);
    }
    throw error;
  }
}

/**
 * Utility function to debounce function calls
 * @param fn - The function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | null = null;
  
  return function(...args: Parameters<T>): void {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = window.setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Utility function to throttle function calls
 * @param fn - The function to throttle
 * @param limit - Minimum time between calls in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: number | null = null;
  
  return function(...args: Parameters<T>): void {
    const now = Date.now();
    
    if (now - lastCall >= limit) {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      lastCall = now;
      fn(...args);
    } else if (timeoutId === null) {
      timeoutId = window.setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, limit - (now - lastCall));
    }
  };
}

/**
 * Format bytes to human-readable string
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human-readable string
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "1h 23m 45s")
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  const s = seconds % 60;
  const m = minutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${m}m ${s}s`;
  } else if (minutes > 0) {
    return `${m}m ${s}s`;
  } else {
    return `${s}s`;
  }
}