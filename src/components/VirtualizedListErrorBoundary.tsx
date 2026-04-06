import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface VirtualizedListErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface VirtualizedListErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
  lastErrorTime: number;
}

/**
 * Production-grade error boundary for virtualized lists.
 * 
 * Provides:
 * - Graceful error handling with user-friendly fallback UI
 * - Auto-recovery after brief delay
 * - Error tracking to prevent infinite error loops
 * - Customizable fallback and error handlers
 * 
 * Usage:
 * ```tsx
 * <VirtualizedListErrorBoundary>
 *   <YourVirtualizedList />
 * </VirtualizedListErrorBoundary>
 * ```
 */
class VirtualizedListErrorBoundary extends React.Component<
  VirtualizedListErrorBoundaryProps,
  VirtualizedListErrorBoundaryState
> {
  constructor(props: VirtualizedListErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
      lastErrorTime: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<VirtualizedListErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const now = Date.now();
    const timeSinceLastError = now - this.state.lastErrorTime;
    
    // Track error frequency (reset count if >5 seconds since last error)
    const newErrorCount = timeSinceLastError > 5000 ? 1 : this.state.errorCount + 1;
    
    this.setState({
      errorCount: newErrorCount,
      lastErrorTime: now,
    });

    // Log to console in dev mode
    if (import.meta.env.DEV) {
      console.error('[VirtualizedListErrorBoundary] Caught error:', error);
      console.error('[VirtualizedListErrorBoundary] Error info:', errorInfo);
      console.error('[VirtualizedListErrorBoundary] Component stack:', errorInfo.componentStack);
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Auto-recovery: reset error state after 3 seconds (unless error loop detected)
    if (newErrorCount < 3) {
      setTimeout(() => {
        this.setState({
          hasError: false,
          error: null,
        });
      }, 3000);
    }
  }

  handleManualReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorCount: 0,
      lastErrorTime: 0,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      const isErrorLoop = this.state.errorCount >= 3;

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-800 rounded-lg border border-red-500/30">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <h3 className="text-xl font-semibold text-red-500">
              {isErrorLoop ? 'Persistent Error Detected' : 'List Rendering Error'}
            </h3>
          </div>
          
          <p className="text-gray-300 text-center mb-4 max-w-md">
            {isErrorLoop ? (
              <>
                The list encountered multiple errors and cannot recover automatically.
                Please refresh the page or contact support if the problem persists.
              </>
            ) : (
              <>
                The virtualized list encountered an error while rendering.
                {this.state.errorCount === 1 ? ' The system will attempt to recover automatically.' : ''}
              </>
            )}
          </p>

          {import.meta.env.DEV && this.state.error && (
            <details className="mt-4 p-4 bg-gray-900 rounded border border-gray-700 w-full max-w-2xl">
              <summary className="cursor-pointer text-sm font-mono text-gray-400 hover:text-gray-200">
                Error Details (Dev Mode)
              </summary>
              <pre className="mt-2 text-xs text-red-400 overflow-auto max-h-64">
                {this.state.error.toString()}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}

          {!isErrorLoop && (
            <div className="flex gap-3 mt-4">
              <button
                onClick={this.handleManualReset}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                data-testid="button-retry-virtualized-list"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Now
              </button>
            </div>
          )}

          {isErrorLoop && (
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
              data-testid="button-reload-page"
            >
              Reload Page
            </button>
          )}

          <p className="text-xs text-gray-500 mt-6">
            Error #{this.state.errorCount} • Last occurred: {new Date(this.state.lastErrorTime).toLocaleTimeString()}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default VirtualizedListErrorBoundary;
