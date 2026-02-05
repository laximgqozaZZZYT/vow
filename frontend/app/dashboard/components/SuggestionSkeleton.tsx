/**
 * SuggestionSkeleton Component
 *
 * Skeleton loader displayed while suggestions are being generated.
 * Provides visual feedback during AI processing.
 *
 * @module components/SuggestionSkeleton
 */

'use client';

import React from 'react';

export interface SuggestionSkeletonProps {
  /** Number of skeleton items to display */
  count?: number;
  /** Optional className for container */
  className?: string;
  /** Whether to show in compact mode */
  compact?: boolean;
}

/**
 * Skeleton loader for suggestion cards
 */
export const SuggestionSkeleton: React.FC<SuggestionSkeletonProps> = ({
  count = 3,
  className = '',
  compact = false,
}) => {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="Loading suggestions">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} compact={compact} delay={i * 100} />
      ))}
      <span className="sr-only">Loading suggestions...</span>
    </div>
  );
};

interface SkeletonCardProps {
  compact?: boolean;
  delay?: number;
}

const SkeletonCard: React.FC<SkeletonCardProps> = ({ compact = false, delay = 0 }) => {
  const baseClasses = `
    rounded-lg border border-gray-200 dark:border-gray-700
    bg-gray-50 dark:bg-gray-800/50
    animate-pulse
  `;

  const animationStyle = {
    animationDelay: `${delay}ms`,
  };

  if (compact) {
    return (
      <div className={`${baseClasses} p-3`} style={animationStyle}>
        <div className="flex items-center gap-3">
          {/* Icon placeholder */}
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />

          {/* Content placeholder */}
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>

          {/* Action buttons placeholder */}
          <div className="flex gap-2">
            <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${baseClasses} p-4`} style={animationStyle}>
      {/* Header with icon and title */}
      <div className="flex items-start gap-3 mb-3">
        {/* Type icon placeholder */}
        <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex-shrink-0" />

        <div className="flex-1 space-y-2">
          {/* Title placeholder */}
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          {/* Category/difficulty badge placeholder */}
          <div className="flex gap-2">
            <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
          </div>
        </div>
      </div>

      {/* Description placeholder */}
      <div className="space-y-2 mb-4">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      </div>

      {/* Action buttons placeholder */}
      <div className="flex gap-2 justify-end">
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </div>
  );
};

/**
 * Inline skeleton for use within message bubbles
 */
export const SuggestionSkeletonInline: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="flex gap-2 flex-wrap animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-full"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
};

/**
 * Single large skeleton for detailed view
 */
export const SuggestionSkeletonLarge: React.FC = () => {
  return (
    <div
      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-6 animate-pulse"
      role="status"
      aria-label="Loading suggestion details"
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 space-y-2">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          <div className="flex gap-2">
            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-3 mb-6">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
      </div>

      {/* Additional info section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 justify-end">
        <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div className="h-10 w-28 bg-gray-300 dark:bg-gray-600 rounded-lg" />
      </div>

      <span className="sr-only">Loading suggestion details...</span>
    </div>
  );
};

export default SuggestionSkeleton;
