'use client';

/**
 * LazyDemoSection - Lazy Loading Wrapper for Demo Section
 *
 * This component implements lazy loading for the demo section using:
 * 1. Next.js dynamic() for code splitting
 * 2. Intersection Observer for visibility detection
 * 3. Error Boundary for graceful error handling
 *
 * The demo section is only loaded when it becomes visible (or is about to
 * become visible) in the viewport, avoiding blocking the initial page render.
 *
 * Requirements: 5.1, 5.5, 5.6
 * - 5.1: Demo_Section SHALL lazy-load to avoid blocking initial page render
 * - 5.5: Demo_Section SHALL not significantly impact the landing page's LCP
 * - 5.6: IF the demo fails to load, THEN THE Landing_Page SHALL display a static fallback
 */

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import DemoSkeleton from './DemoSkeleton';
import DemoErrorBoundary from './DemoErrorBoundary';

// ============================================================================
// Dynamic Import with Code Splitting
// ============================================================================

/**
 * Dynamically import the DemoSection component with code splitting.
 * This ensures the demo section code is not included in the initial bundle.
 */
const DemoSection = dynamic(
  () => import('./Section.Demo').then((mod) => mod.default),
  {
    loading: () => <DemoSkeleton />,
    ssr: false, // Disable SSR for the demo section to improve initial load
  }
);

// ============================================================================
// Types
// ============================================================================

interface LazyDemoSectionProps {
  /** Optional additional CSS classes */
  className?: string;
  /** Root margin for Intersection Observer (default: '200px' - preload when 200px away) */
  rootMargin?: string;
  /** Threshold for Intersection Observer (default: 0 - trigger as soon as any part is visible) */
  threshold?: number;
  /** Whether to disable lazy loading and load immediately (for testing) */
  disableLazyLoad?: boolean;
  /** Callback when the demo section becomes visible */
  onVisible?: () => void;
  /** Callback when the demo section starts loading */
  onLoadStart?: () => void;
  /** Callback when the demo section finishes loading */
  onLoadComplete?: () => void;
}

// ============================================================================
// Custom Hook: useIntersectionObserver
// ============================================================================

/**
 * useIntersectionObserver
 *
 * Custom hook that uses Intersection Observer API to detect when an element
 * enters the viewport.
 *
 * @param options - Intersection Observer options
 * @returns [ref, isIntersecting] - Ref to attach to element and visibility state
 */
function useIntersectionObserver(options: {
  rootMargin?: string;
  threshold?: number;
  enabled?: boolean;
}): [React.RefObject<HTMLDivElement | null>, boolean] {
  const { rootMargin = '200px', threshold = 0, enabled = true } = options;
  const ref = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsIntersecting(true);
      return;
    }

    const element = ref.current;
    if (!element) return;

    // Check if Intersection Observer is supported
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: load immediately if not supported
      setIsIntersecting(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsIntersecting(true);
            // Once visible, we don't need to observe anymore
            observer.unobserve(element);
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold, enabled]);

  return [ref, isIntersecting];
}

// ============================================================================
// Main LazyDemoSection Component
// ============================================================================

/**
 * LazyDemoSection
 *
 * Wrapper component that implements lazy loading for the demo section.
 * Uses Intersection Observer to detect when the section is about to enter
 * the viewport, then dynamically loads the actual demo section.
 *
 * Features:
 * - Code splitting via Next.js dynamic()
 * - Viewport detection via Intersection Observer
 * - Skeleton placeholder while loading
 * - Preloading when 200px away from viewport (configurable)
 * - Fallback for browsers without Intersection Observer support
 */
export default function LazyDemoSection({
  className = '',
  rootMargin = '200px',
  threshold = 0,
  disableLazyLoad = false,
  onVisible,
  onLoadStart,
  onLoadComplete,
}: LazyDemoSectionProps) {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Use Intersection Observer to detect visibility
  const [containerRef, isVisible] = useIntersectionObserver({
    rootMargin,
    threshold,
    enabled: !disableLazyLoad,
  });

  // Track when the section becomes visible
  useEffect(() => {
    if (isVisible && !hasLoaded) {
      onVisible?.();
      setIsLoading(true);
      onLoadStart?.();
    }
  }, [isVisible, hasLoaded, onVisible, onLoadStart]);

  // Handle load complete
  const handleLoadComplete = useCallback(() => {
    setHasLoaded(true);
    setIsLoading(false);
    onLoadComplete?.();
  }, [onLoadComplete]);

  // Effect to simulate load complete after component mounts
  // In reality, the dynamic import handles this, but we track it for callbacks
  useEffect(() => {
    if (isVisible && isLoading) {
      // The dynamic import will show the skeleton until loaded
      // We consider it "loaded" once the component renders
      const timer = setTimeout(() => {
        handleLoadComplete();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isVisible, isLoading, handleLoadComplete]);

  return (
    <div
      ref={containerRef}
      className={className}
      data-testid="lazy-demo-section"
      data-visible={isVisible}
      data-loaded={hasLoaded}
    >
      {isVisible ? (
        // Error Boundary wraps Suspense as per design document
        // Requirement 5.6: Display static fallback if demo fails to load
        <DemoErrorBoundary showRetry>
          <Suspense fallback={<DemoSkeleton />}>
            <DemoSection />
          </Suspense>
        </DemoErrorBoundary>
      ) : (
        <DemoSkeleton />
      )}
    </div>
  );
}

// ============================================================================
// Named Exports
// ============================================================================

export { LazyDemoSection, useIntersectionObserver };
export type { LazyDemoSectionProps };
