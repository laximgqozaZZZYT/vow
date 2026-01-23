'use client';

/**
 * DemoOverlay Component
 *
 * Displays visual indicators for the demo animation including:
 * - Animated cursor that moves to target positions
 * - Highlight effects (glow, border, pulse) around highlighted elements
 *
 * Requirements: 4.6
 * - Include visual indicators (e.g., cursor animation, highlight effects)
 *   to show where interactions occur
 *
 * Accessibility:
 * - Respects prefers-reduced-motion by disabling animations
 * - Uses design system colors and shadows
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface DemoOverlayProps {
  /** Current cursor position (null to hide cursor) */
  cursorPosition: { x: number; y: number } | null;
  /** CSS selector of the currently highlighted element (null to hide highlight) */
  highlightedElement: string | null;
  /** Whether the overlay is visible */
  isVisible: boolean;
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// ============================================================================
// Custom Hook for Reduced Motion Detection
// ============================================================================

/**
 * Hook to detect if user prefers reduced motion
 */
function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * DemoOverlay
 *
 * Renders an overlay with animated cursor and highlight effects
 * to indicate where interactions occur during the demo animation.
 *
 * @param props - Component props
 * @returns React component
 */
export function DemoOverlay({
  cursorPosition,
  highlightedElement,
  isVisible,
}: DemoOverlayProps): React.ReactElement | null {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const [smoothCursorPosition, setSmoothCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // ============================================================================
  // Highlight Element Tracking
  // ============================================================================

  /**
   * Update highlight rectangle based on the highlighted element
   */
  const updateHighlightRect = useCallback(() => {
    if (!highlightedElement || typeof window === 'undefined') {
      setHighlightRect(null);
      return;
    }

    const element = document.querySelector(highlightedElement);
    if (!element) {
      setHighlightRect(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    // Add padding around the element for the highlight effect
    const padding = 8;
    setHighlightRect({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });
  }, [highlightedElement]);

  // Update highlight rect when element changes or on scroll/resize
  useEffect(() => {
    updateHighlightRect();

    // Update on scroll and resize
    const handleUpdate = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(updateHighlightRect);
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updateHighlightRect]);

  // ============================================================================
  // Smooth Cursor Animation
  // ============================================================================

  /**
   * Smoothly animate cursor to target position
   */
  useEffect(() => {
    if (!cursorPosition) {
      setSmoothCursorPosition(null);
      return;
    }

    // If reduced motion is preferred, snap to position immediately
    if (prefersReducedMotion) {
      setSmoothCursorPosition(cursorPosition);
      return;
    }

    // Initialize position if not set
    if (!smoothCursorPosition) {
      setSmoothCursorPosition(cursorPosition);
      return;
    }

    // Animate to new position
    const startPosition = { ...smoothCursorPosition };
    const targetPosition = cursorPosition;
    const duration = 300; // ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const newX = startPosition.x + (targetPosition.x - startPosition.x) * easeOut;
      const newY = startPosition.y + (targetPosition.y - startPosition.y) * easeOut;

      setSmoothCursorPosition({ x: newX, y: newY });

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [cursorPosition, prefersReducedMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================================
  // Render
  // ============================================================================

  // Don't render if not visible or if reduced motion and no static indicators needed
  if (!isVisible) {
    return null;
  }

  // For reduced motion, show static indicators without animation
  const showCursor = smoothCursorPosition !== null;
  const showHighlight = highlightRect !== null;

  if (!showCursor && !showHighlight) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50"
      aria-hidden="true"
      role="presentation"
    >
      {/* Highlight Effect */}
      {showHighlight && highlightRect && (
        <div
          className={`
            absolute
            border-2 border-primary
            rounded-lg
            ${prefersReducedMotion ? '' : 'transition-all duration-300 ease-out'}
          `}
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
            boxShadow: prefersReducedMotion
              ? '0 0 0 4px rgba(var(--color-primary-rgb, 59, 130, 246), 0.2)'
              : '0 0 0 4px rgba(var(--color-primary-rgb, 59, 130, 246), 0.3), 0 0 20px rgba(var(--color-primary-rgb, 59, 130, 246), 0.4)',
          }}
        >
          {/* Pulse animation ring (only when motion is allowed) */}
          {!prefersReducedMotion && (
            <div
              className="absolute inset-0 rounded-lg border-2 border-primary animate-ping opacity-75"
              style={{
                animationDuration: '1.5s',
              }}
            />
          )}
        </div>
      )}

      {/* Animated Cursor */}
      {showCursor && smoothCursorPosition && (
        <div
          className={`
            absolute
            ${prefersReducedMotion ? '' : 'transition-opacity duration-200'}
          `}
          style={{
            left: smoothCursorPosition.x,
            top: smoothCursorPosition.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Cursor Icon */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-lg"
          >
            {/* Cursor pointer shape */}
            <path
              d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.86a.5.5 0 0 0-.85.35Z"
              fill="hsl(var(--primary))"
              stroke="hsl(var(--primary-foreground))"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {/* Click ripple effect (only when motion is allowed) */}
          {!prefersReducedMotion && (
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <div
                className="w-8 h-8 rounded-full bg-primary/30 animate-ping"
                style={{
                  animationDuration: '1s',
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default DemoOverlay;
export type { HighlightRect };
