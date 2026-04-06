import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
  error?: Error;
}

const MAX_CHUNK_RELOADS = 2;
const CHUNK_RELOAD_COUNT_KEY = 'lazy_chunk_reload_count';

function canReloadForChunk(): boolean {
  try {
    const count = parseInt(sessionStorage.getItem(CHUNK_RELOAD_COUNT_KEY) || '0', 10);
    return count < MAX_CHUNK_RELOADS;
  } catch {
    return true;
  }
}

function markChunkReload(): void {
  try {
    const count = parseInt(sessionStorage.getItem(CHUNK_RELOAD_COUNT_KEY) || '0', 10);
    sessionStorage.setItem(CHUNK_RELOAD_COUNT_KEY, String(count + 1));
  } catch {}
}

async function clearCachesAndReload() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
  } catch {}
  try { sessionStorage.clear(); } catch {}
  const url = new URL(window.location.href);
  url.searchParams.set('_cb', Date.now().toString());
  window.location.replace(url.toString());
}

/**
 * Error Boundary to handle lazy-load chunk errors and unexpected React errors.
 * - Chunk errors (failed import): auto-reload up to MAX_CHUNK_RELOADS times with cache clear
 * - Other errors: show a recovery screen (never auto-spin forever)
 */
export class LazyLoadErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const isChunkError =
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed') ||
      error.message.includes('error loading dynamically imported module') ||
      error.message.includes('ChunkLoadError') ||
      error.message.includes('Loading chunk');
    return { hasError: true, isChunkError, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const isChunkError =
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed') ||
      error.message.includes('error loading dynamically imported module') ||
      error.message.includes('ChunkLoadError') ||
      error.message.includes('Loading chunk');

    if (isChunkError) {
      if (canReloadForChunk()) {
        markChunkReload();
        console.warn('🔄 Stale deployment error detected, clearing cache and reloading...', error.message);
        clearCachesAndReload();
      } else {
        console.warn('⚠️ Chunk reload limit reached — showing manual recovery screen');
      }
    } else {
      console.error('Error caught by LazyLoadErrorBoundary:', error.message, errorInfo);
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.state.isChunkError && canReloadForChunk()) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Refreshing application...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4 text-red-500">Application Error</h1>
          <p className="text-gray-400 mb-6">
            {this.state.isChunkError
              ? 'Failed to load a required module. This usually means the app was just updated.'
              : 'An unexpected error occurred while loading the application.'}
          </p>
          {this.state.error && (
            <div className="bg-gray-800 p-3 rounded mb-4 text-left">
              <pre className="text-xs text-red-400 whitespace-pre-wrap">{String(this.state.error)}</pre>
            </div>
          )}
          <div className="space-y-3">
            <button
              onClick={clearCachesAndReload}
              className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 rounded font-medium"
            >
              Clear Cache &amp; Reload
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              Try Normal Reload
            </button>
          </div>
          <p className="text-gray-500 text-xs mt-4">
            If this persists, try: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
          </p>
        </div>
      </div>
    );
  }
}
