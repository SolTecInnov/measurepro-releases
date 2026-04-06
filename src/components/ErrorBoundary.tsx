import { Component, ErrorInfo, ReactNode } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimer: NodeJS.Timeout | null = null;
  private errorTimestamps: number[] = [];
  private readonly ERROR_WINDOW_MS = 5000; // 5 seconds
  private readonly MAX_ERRORS_IN_WINDOW = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Check if this is an offline-related error (network failures should not crash the app)
    const isOffline = !navigator.onLine;
    const isNetworkError = error.message?.includes('network') || 
                           error.message?.includes('Network') ||
                           error.message?.includes('fetch') ||
                           error.message?.includes('Failed to fetch') ||
                           (error as any).code === 'auth/network-request-failed';
    
    // If offline or network error, handle gracefully without triggering reload loop
    if (isOffline || isNetworkError) {
      console.warn('⚠️ Network/offline error caught:', error.message);
      
      // Don't show error toast for expected offline errors
      if (!isOffline) {
        toast.warning('Network issue detected', {
          description: 'Some features may be limited. Working in offline mode.',
          duration: 3000,
        });
      }
      
      // Don't escalate offline errors - reset error state so app continues
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
      return;
    }
    
    // *** CRITICAL DEBUG OUTPUT - DO NOT REMOVE ***
    console.error('❌ ErrorBoundary caught error:', error);
    console.error('📋 Error Stack:', error.stack);
    console.error('🧩 Component Stack:', errorInfo.componentStack);
    console.error('📄 Error Info:', errorInfo);

    // Track error timestamp for time-window analysis
    const now = Date.now();
    this.errorTimestamps.push(now);

    // Remove timestamps older than the window
    this.errorTimestamps = this.errorTimestamps.filter(
      timestamp => now - timestamp < this.ERROR_WINDOW_MS
    );

    const errorsInWindow = this.errorTimestamps.length;

    // Update state with new error count
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // Show toast notification
    toast.error('Application Error', {
      description: error.message || 'An unexpected error occurred',
      duration: 5000,
    });

    // Auto-recovery: If 3+ errors occurred within 5-second window AND we're online, reload
    // Don't reload when offline - it won't help and creates a frustrating loop
    if (errorsInWindow >= this.MAX_ERRORS_IN_WINDOW && navigator.onLine) {
      toast.error('Multiple errors detected', {
        description: `${errorsInWindow} errors in ${this.ERROR_WINDOW_MS / 1000} seconds. Reloading in 5 seconds...`,
        duration: 5000,
      });

      // Schedule full page reload as last resort
      this.resetTimer = setTimeout(() => {
        window.location.reload();
      }, 5000);
    }

    // Log to external service (if configured)
    this.logErrorToService(error, errorInfo);
  }

  componentWillUnmount() {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // In production, send to monitoring service (Sentry, LogRocket, etc.)
    try {
      // For now, just log to console with structured format
      const errorReport = {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href,
      };
      
      console.error('Error Report:', JSON.stringify(errorReport, null, 2));
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  }

  private handleReset = () => {
    // Clear error state, reset timer, and clear error history
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    this.errorTimestamps = [];

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-8 w-8" />
              <h1 className="text-2xl font-bold">Application Error</h1>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground">
                The application encountered an unexpected error. This has been logged for investigation.
              </p>

              {this.state.error && (
                <details className="mt-4" open>
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                    Technical Details (Stack Trace)
                  </summary>
                  <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-60">
                    <strong>Error:</strong> {this.state.error.toString()}
                    {'\n\n'}
                    <strong>Stack Trace:</strong>
                    {'\n'}
                    {this.state.error.stack || 'No stack trace available'}
                    {'\n\n'}
                    <strong>Component Stack:</strong>
                    {this.state.errorInfo?.componentStack || 'No component stack available'}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="flex-1"
                data-testid="button-error-reset"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button
                onClick={this.handleReload}
                className="flex-1"
                data-testid="button-error-reload"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload App
              </Button>
            </div>

            {this.state.errorCount >= 2 && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-sm">
                <p className="text-yellow-600 dark:text-yellow-400">
                  ⚠️ Multiple errors detected ({this.state.errorCount} total). 
                  If this persists, try clearing your browser cache or contact support.
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
