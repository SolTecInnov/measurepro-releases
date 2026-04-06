import { getCurrentUser } from './firebase';

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
      // Fallback: forward caller abort into our controller
      signal.addEventListener('abort', () => controller.abort(), { once: true });
      combined = controller.signal;
    }
  } else {
    combined = controller.signal;
  }

  return { signal: combined, cleanup: () => clearTimeout(timeoutId) };
}

/** Get the Authorization header for the current Firebase user */
export async function getAuthHeader(): Promise<Record<string, string>> {
  const fbUser = getCurrentUser();
  if (!fbUser) return {};
  try {
    const token = await fbUser.getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

import { API_BASE_URL } from './config/environment';

/** Authenticated fetch — attaches Firebase ID token to every request */
export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const auth = await getAuthHeader();
  const { signal, cleanup } = withTimeout(options.signal as AbortSignal | undefined);
  const resolvedUrl = url.startsWith('/') && API_BASE_URL ? `${API_BASE_URL}${url}` : url;

  try {
    return await fetch(resolvedUrl, {
      ...options,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...auth,
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Server unreachable — please check your connection');
    }
    throw err;
  } finally {
    cleanup();
  }
}

/** Authenticated API request — throws on non-2xx responses */
export async function authedRequest<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await authedFetch(url, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Request failed: ${res.status}`);
  return json as T;
}
