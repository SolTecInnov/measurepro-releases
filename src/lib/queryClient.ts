import { QueryClient } from '@tanstack/react-query';
import { getAuthHeader } from './authedFetch';
import { API_BASE_URL } from './config/environment';

/**
 * Recursively convert Firestore Timestamp objects ({_seconds, _nanoseconds})
 * to ISO strings. Prevents React error #31 ("Objects are not valid as a React child")
 * when Firestore data is rendered directly in JSX.
 */
export function sanitizeTimestamps(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  // Firestore Timestamp — has _seconds and _nanoseconds
  if (typeof obj._seconds === 'number' && typeof obj._nanoseconds === 'number') {
    return new Date(obj._seconds * 1000 + obj._nanoseconds / 1e6).toISOString();
  }
  // Firestore Timestamp from client SDK — has toDate()
  if (typeof obj.toDate === 'function') {
    try { return obj.toDate().toISOString(); } catch { return String(obj); }
  }
  if (Array.isArray(obj)) return obj.map(sanitizeTimestamps);
  // Recursively sanitize object fields
  const entries = Object.entries(obj);
  if (entries.length === 0) return null;
  const result: Record<string, any> = {};
  for (const [key, value] of entries) {
    result[key] = sanitizeTimestamps(value);
  }
  return result;
}

/**
 * Make any value safe to render as a React child.
 * Strings, numbers, booleans, null, undefined → pass through.
 * Objects → JSON.stringify. Arrays → map and safe-ify each element.
 * This prevents React error #31 ("Objects are not valid as a React child").
 */
export function safeRender(value: any): string | number | boolean | null | undefined {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'object') {
    // Firestore Timestamp
    if (value._seconds !== undefined) return new Date(value._seconds * 1000).toISOString();
    if (typeof value.toDate === 'function') try { return value.toDate().toISOString(); } catch { return String(value); }
    return JSON.stringify(value);
  }
  return String(value);
}

const REQUEST_TIMEOUT_MS = 15_000;

/** Combine an optional caller-supplied AbortSignal with a timeout signal */
function withTimeout(signal?: AbortSignal | null): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let combined: AbortSignal;
  if (signal) {
    if (typeof AbortSignal.any === 'function') {
      combined = AbortSignal.any([signal, controller.signal]);
    } else {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
      combined = controller.signal;
    }
  } else {
    combined = controller.signal;
  }

  return { signal: combined, cleanup: () => clearTimeout(timeoutId) };
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const { signal, cleanup } = withTimeout(options.signal as AbortSignal | undefined);

  // In Electron, relative /api/... URLs need the production server base
  const resolvedUrl = url.startsWith('/') && API_BASE_URL
    ? `${API_BASE_URL}${url}`
    : url;

  try {
    return await fetch(resolvedUrl, { ...options, signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Server unreachable — please check your connection');
    }
    throw err;
  } finally {
    cleanup();
  }
}

// Helper function for API requests
export async function apiRequest<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  let body = options?.body;
  
  // Only stringify if body is an object (not already a string or FormData)
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    body = JSON.stringify(body);
  }
  
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    body,
  });

  if (!response.ok) {
    // Guard: don't try to parse HTML as JSON (404 pages, server errors)
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    throw new Error(`Server error ${response.status}: ${url}`);
  }

  // Guard: only parse JSON responses
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error(`Non-JSON response from ${url}`);
  }
  const data = await response.json();
  return data;
}

// Create a query client instance
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const url = queryKey[0] as string;
        const authHeader = await getAuthHeader().catch(() => ({}));
        const response = await apiRequest<any>(url, { headers: authHeader });
        
        // If response has a success property, unwrap the data
        if (response && typeof response === 'object' && 'success' in response) {
          // Return the data from common response patterns
          if ('pricing' in response) return response.pricing;
          if ('terms' in response) return response.terms;
          if ('data' in response) return response.data;
          // If no specific data property, return the whole response minus success
          const { success, ...data } = response;
          return Object.keys(data).length === 1 ? Object.values(data)[0] : data;
        }
        
        return response;
      },
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});
