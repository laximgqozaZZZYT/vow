'use client';

/**
 * DemoSkeleton - Loading Placeholder for Demo Section
 *
 * This component displays a skeleton/placeholder while the demo section
 * is being lazy-loaded. It mimics the structure of the actual demo section
 * to provide a smooth loading experience.
 *
 * Requirements: 5.1, 5.5
 * - 5.1: Demo_Section SHALL lazy-load to avoid blocking initial page render
 * - 5.5: Demo_Section SHALL not significantly impact the landing page's LCP
 */

import React from 'react';

// ============================================================================
// Types
// ============================================================================

interface DemoSkeletonProps {
  /** Optional additional CSS classes */
  className?: string;
}

// ============================================================================
// Skeleton Components
// ============================================================================

/**
 * SkeletonPulse - Animated skeleton element
 */
function SkeletonPulse({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-muted rounded-md ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * SkeletonCard - Card-like skeleton element
 */
function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-lg p-4 ${className}`}>
      <SkeletonPulse className="h-4 w-1/3 mb-3" />
      <SkeletonPulse className="h-3 w-full mb-2" />
      <SkeletonPulse className="h-3 w-2/3" />
    </div>
  );
}

/**
 * SkeletonSection - Section-like skeleton element
 */
function SkeletonSection({ title, children }: { title?: boolean; children?: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      {title && <SkeletonPulse className="h-5 w-1/4 mb-4" />}
      {children}
    </div>
  );
}

// ============================================================================
// Main DemoSkeleton Component
// ============================================================================

/**
 * DemoSkeleton
 *
 * Displays a loading placeholder that mimics the demo section structure.
 * Uses skeleton animations to indicate loading state.
 */
export default function DemoSkeleton({ className = '' }: DemoSkeletonProps) {
  return (
    <section
      className={`w-full py-12 px-4 sm:px-6 lg:px-8 ${className}`}
      aria-label="ダッシュボードプレビューを読み込み中"
      aria-busy="true"
    >
      {/* Section Title Skeleton */}
      <div className="text-center mb-8">
        <SkeletonPulse className="h-8 w-64 mx-auto mb-2" />
        <SkeletonPulse className="h-4 w-48 mx-auto" />
      </div>

      {/* Demo Frame Container Skeleton */}
      <div
        className="
          mx-auto
          rounded-xl
          border-2 border-border
          bg-card
          shadow-lg
          overflow-hidden
          relative
          w-full
        "
      >
        {/* Demo Label Badge Skeleton */}
        <div className="absolute top-4 left-4 z-10">
          <SkeletonPulse className="h-6 w-12 rounded-full" />
        </div>

        {/* Scaled Dashboard Container Skeleton */}
        <div className="p-6 pt-16 space-y-6">
          {/* Next Section Skeleton */}
          <SkeletonSection title>
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </SkeletonSection>

          {/* Stickies Section Skeleton */}
          <SkeletonSection title>
            <div className="grid grid-cols-2 gap-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </SkeletonSection>

          {/* Calendar Section Skeleton */}
          <SkeletonSection title>
            <div className="space-y-2">
              <div className="flex justify-between mb-4">
                <SkeletonPulse className="h-8 w-24" />
                <SkeletonPulse className="h-8 w-32" />
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                  <SkeletonPulse key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          </SkeletonSection>

          {/* Statistics Section Skeleton */}
          <SkeletonSection title>
            <div className="grid grid-cols-3 gap-4">
              <SkeletonPulse className="h-20" />
              <SkeletonPulse className="h-20" />
              <SkeletonPulse className="h-20" />
            </div>
          </SkeletonSection>
        </div>

        {/* Loading Indicator */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">
              デモを読み込み中...
            </span>
          </div>
        </div>
      </div>

      {/* Interaction Hint Skeleton */}
      <div className="text-center mt-4">
        <SkeletonPulse className="h-3 w-56 mx-auto" />
      </div>

      {/* Call to Action Skeleton */}
      <div className="text-center mt-4">
        <SkeletonPulse className="h-3 w-48 mx-auto" />
      </div>
    </section>
  );
}

// ============================================================================
// Named Exports
// ============================================================================

export { DemoSkeleton, SkeletonPulse, SkeletonCard, SkeletonSection };
export type { DemoSkeletonProps };
