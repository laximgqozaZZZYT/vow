'use client';

/**
 * DemoErrorBoundary - Error Boundary for Demo Section
 *
 * This component catches JavaScript errors in the demo section's child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the entire page.
 *
 * Requirements: 5.6
 * - IF the demo fails to load, THEN THE Landing_Page SHALL display a static fallback image or placeholder
 *
 * Design Reference:
 * ```typescript
 * // Suspense境界とエラーバウンダリを使用
 * <ErrorBoundary fallback={<DemoFallback />}>
 *   <Suspense fallback={<DemoSkeleton />}>
 *     <DemoSection />
 *   </Suspense>
 * </ErrorBoundary>
 * ```
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import DemoFallback from './DemoFallback';

// ============================================================================
// Types
// ============================================================================

interface DemoErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Custom fallback component (optional, defaults to DemoFallback) */
  fallback?: ReactNode;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to show retry functionality */
  showRetry?: boolean;
}

interface DemoErrorBoundaryState {
  /** Whether an error has been caught */
  hasError: boolean;
  /** The caught error */
  error: Error | null;
  /** Unique key to force remount on retry */
  retryKey: number;
}

// ============================================================================
// Error Logging Utility
// ============================================================================

/**
 * Log error to console and potentially to external service
 * In production, this could send errors to a monitoring service
 */
function logDemoError(error: Error, errorInfo: ErrorInfo): void {
  // Log to console in development
  console.error('[DemoErrorBoundary] Error caught:', error);
  console.error('[DemoErrorBoundary] Component stack:', errorInfo.componentStack);

  // In production, you might want to send this to an error tracking service
  // Example: Sentry, LogRocket, etc.
  // if (process.env.NODE_ENV === 'production') {
  //   errorTrackingService.captureException(error, { extra: errorInfo });
  // }
}

// ============================================================================
// Main DemoErrorBoundary Component
// ============================================================================

/**
 * DemoErrorBoundary
 *
 * React Error Boundary class component that catches errors in the demo section.
 * When an error occurs:
 * 1. Logs the error for debugging
 * 2. Displays a static fallback UI
 * 3. Optionally provides retry functionality
 *
 * Usage:
 * ```tsx
 * <DemoErrorBoundary>
 *   <Suspense fallback={<DemoSkeleton />}>
 *     <DemoSection />
 *   </Suspense>
 * </DemoErrorBoundary>
 * ```
 *
 * Requirements: 5.6
 */
class DemoErrorBoundary extends Component<DemoErrorBoundaryProps, DemoErrorBoundaryState> {
  constructor(props: DemoErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryKey: 0,
    };
  }

  /**
   * Static method to derive state from error
   * Called when an error is thrown in a descendant component
   */
  static getDerivedStateFromError(error: Error): Partial<DemoErrorBoundaryState> {
    // Update state so the next render shows the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Lifecycle method called after an error is caught
   * Used for logging and side effects
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error
    logDemoError(error, errorInfo);

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  /**
   * Handle retry - reset error state and increment key to force remount
   */
  handleRetry = (): void => {
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      retryKey: prevState.retryKey + 1,
    }));
  };

  render(): ReactNode {
    const { children, fallback, showRetry = true } = this.props;
    const { hasError, error, retryKey } = this.state;

    if (hasError) {
      // If a custom fallback is provided, use it
      if (fallback) {
        return fallback;
      }

      // Otherwise, use the default DemoFallback component
      return (
        <DemoFallback
          error={error}
          onRetry={showRetry ? this.handleRetry : undefined}
          showRetry={showRetry}
        />
      );
    }

    // Use key to force remount on retry
    return <div key={retryKey}>{children}</div>;
  }
}

// ============================================================================
// Functional Wrapper (Optional)
// ============================================================================

/**
 * DemoErrorBoundaryWrapper
 *
 * A functional component wrapper that provides a more React-hooks-friendly API.
 * Useful when you need to use hooks alongside the error boundary.
 */
interface DemoErrorBoundaryWrapperProps extends DemoErrorBoundaryProps {
  /** Optional additional CSS classes for the wrapper */
  className?: string;
}

function DemoErrorBoundaryWrapper({
  children,
  className,
  ...props
}: DemoErrorBoundaryWrapperProps): ReactNode {
  return (
    <div className={className}>
      <DemoErrorBoundary {...props}>{children}</DemoErrorBoundary>
    </div>
  );
}

// ============================================================================
// Named Exports
// ============================================================================

export default DemoErrorBoundary;
export { DemoErrorBoundary, DemoErrorBoundaryWrapper, logDemoError };
export type { DemoErrorBoundaryProps, DemoErrorBoundaryState };
