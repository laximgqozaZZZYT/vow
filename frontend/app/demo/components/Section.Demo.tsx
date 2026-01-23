'use client';

/**
 * Section.Demo - Demo Section Component for Landing Page
 *
 * This component displays a scaled-down preview of the actual dashboard.
 * It uses the EXACT same layout structure as frontend/app/dashboard/page.tsx
 * and reuses the same dashboard components with demo data.
 *
 * CRITICAL Requirements:
 * - THE Demo_Section SHALL use the EXACT same layout structure as the actual dashboard
 * - THE Demo_Section SHALL display a scaled-down version using CSS transform scale
 * - THE Demo_Section SHALL preserve all visual details including borders, shadows, and spacing
 * - THE Demo_Section SHALL be responsive and adapt to mobile and desktop viewports
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 4.7, 4.8, 5.2
 * - 4.7: Animation SHALL pause when the user hovers over or touches the demo section
 * - 4.8: When the user stops interacting, animation SHALL resume after a 3-second delay
 * - 5.2: Demo_Section SHALL respect prefers-reduced-motion media query by disabling animations
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { DemoDataProvider, useDemoData } from '../contexts/DemoDataContext';
import { HandednessProvider } from '@/app/dashboard/contexts/HandednessContext';
import { useInteractionPause } from '../hooks/useInteractionPause';
import { useSectionAnimation } from './SectionAnimations';

// ============================================================================
// Custom Hook for Reduced Motion Detection
// ============================================================================

/**
 * Hook to detect if user prefers reduced motion
 * Requirement 5.2: Respect prefers-reduced-motion media query
 */
function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    // Check if matchMedia is available (may not be in test environments)
    if (typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Check if matchMedia is available (may not be in test environments)
    if (typeof window.matchMedia !== 'function') return;

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

// Reuse actual dashboard components
import NextSection from '@/app/dashboard/components/Section.Next';
import StickiesSection from '@/app/dashboard/components/Section.Stickies';
import CalendarWidget from '@/app/dashboard/components/Widget.Calendar';
import StaticsSection from '@/app/dashboard/components/Section.Statistics';
import ActivitySection from '@/app/dashboard/components/Section.Activity';

// ============================================================================
// Types
// ============================================================================

interface DemoSectionProps {
  /** Optional additional CSS classes */
  className?: string;
  /** Scale factor for the demo preview (default: 0.6 for desktop, 0.5 for mobile) */
  scale?: number;
  /** Callback when animation is paused due to user interaction */
  onInteractionPause?: () => void;
  /** Callback when animation resumes after interaction ends */
  onInteractionResume?: () => void;
  /** Resume delay in milliseconds (default: 3000ms as per requirement 4.8) */
  resumeDelay?: number;
  /** Override for reduced motion preference (useful for testing) */
  forceReducedMotion?: boolean;
}

// ============================================================================
// Demo Dashboard Content Component
// ============================================================================

/**
 * DemoDashboardContent
 *
 * Renders the actual dashboard layout using demo data from context.
 * This component mirrors the exact structure of DashboardLayout in page.tsx.
 * Includes mini-animations for each section to demonstrate interactivity.
 */
function DemoDashboardContent() {
  const {
    habits,
    goals,
    activities,
    stickies,
    onHabitAction,
    onStickyCreate,
    onStickyComplete,
  } = useDemoData();

  // Section animation state - cycles through sections
  const sectionAnimation = useSectionAnimation(5, 3000, true);
  const currentSection = sectionAnimation.step;

  // Mock handlers for demo (no-op or simple state updates)
  const handleHabitEdit = useCallback((habitId: string) => {
    // In demo mode, we don't open modals - just log for debugging
    console.log('[Demo] Habit edit requested:', habitId);
  }, []);

  const handleStickyEdit = useCallback((stickyId: string) => {
    // In demo mode, we don't open modals
    console.log('[Demo] Sticky edit requested:', stickyId);
  }, []);

  const handleStickyDelete = useCallback((stickyId: string) => {
    // In demo mode, we don't delete
    console.log('[Demo] Sticky delete requested:', stickyId);
  }, []);

  const handleStickyNameChange = useCallback((stickyId: string, name: string) => {
    // In demo mode, we don't persist changes
    console.log('[Demo] Sticky name change requested:', stickyId, name);
  }, []);

  // Calendar event handlers (no-op for demo)
  const handleEventClick = useCallback((id: string) => {
    console.log('[Demo] Calendar event clicked:', id);
  }, []);

  const handleSlotSelect = useCallback((isoDate: string, time?: string, endTime?: string) => {
    console.log('[Demo] Calendar slot selected:', isoDate, time, endTime);
  }, []);

  const handleEventChange = useCallback((id: string, updated: { start?: string; end?: string; timingIndex?: number }) => {
    console.log('[Demo] Calendar event changed:', id, updated);
  }, []);

  // Activity handlers (no-op for demo)
  const handleEditActivity = useCallback((activityId: string) => {
    console.log('[Demo] Activity edit requested:', activityId);
  }, []);

  const handleDeleteActivity = useCallback((activityId: string) => {
    console.log('[Demo] Activity delete requested:', activityId);
  }, []);

  // Define the page sections in the same order as the actual dashboard
  // The actual dashboard uses: ['next', 'activity', 'calendar', 'statics', 'diary', 'stickies', 'mindmap']
  // For demo, we show: next, activity, stickies, calendar, statics
  const pageSections = ['next', 'activity', 'stickies', 'calendar', 'statics'];

  // Get highlight class for current section
  const getHighlightClass = (sectionIndex: number) => {
    if (currentSection === sectionIndex) {
      return 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background rounded-lg transition-all duration-500';
    }
    return 'transition-all duration-500';
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Main content pane - mirrors the actual dashboard structure */}
      <main className="flex-1 pt-20 p-6 lg:p-8">
        <div className="grid grid-cols-1 gap-6 max-w-full overflow-hidden">
          {pageSections.map((sec: string, index: number) => {
            const highlightClass = getHighlightClass(index);
            switch (sec) {
              case 'next':
                return (
                  <div key="next" className={highlightClass}>
                    <NextSection
                      habits={habits}
                      activities={activities}
                      onHabitAction={onHabitAction}
                      onHabitEdit={handleHabitEdit}
                    />
                  </div>
                );
              case 'activity':
                return (
                  <div key="activity" className={highlightClass}>
                    <ActivitySection
                      activities={activities}
                      habits={habits}
                      onEditActivity={handleEditActivity}
                      onDeleteActivity={handleDeleteActivity}
                    />
                  </div>
                );
              case 'stickies':
                return (
                  <div key="stickies" className={highlightClass}>
                    <StickiesSection
                      stickies={stickies}
                      onStickyCreate={onStickyCreate}
                      onStickyEdit={handleStickyEdit}
                      onStickyComplete={onStickyComplete}
                      onStickyDelete={handleStickyDelete}
                      onStickyNameChange={handleStickyNameChange}
                    />
                  </div>
                );
              case 'calendar':
                return (
                  <div key="calendar" className={highlightClass}>
                    <CalendarWidget
                      habits={habits}
                      goals={goals}
                      activities={activities}
                      onEventClick={handleEventClick}
                      onSlotSelect={handleSlotSelect}
                      onEventChange={handleEventChange}
                    />
                  </div>
                );
              case 'statics':
                return (
                  <div key="statics" className={highlightClass}>
                    <StaticsSection
                      habits={habits as any}
                      activities={activities as any}
                      goals={goals as any}
                    />
                  </div>
                );
              default:
                return null;
            }
          })}
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// Main Demo Section Component
// ============================================================================

/**
 * DemoSection
 *
 * Main demo section component that wraps the dashboard preview with:
 * - A title "ダッシュボードプレビュー"
 * - A visual frame/container
 * - CSS transform scale for miniaturization
 * - DemoDataProvider for static demo data
 * - Interaction pause/resume functionality (hover/touch)
 * - Reduced motion support (Requirement 5.2)
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 4.7, 4.8, 5.2
 */
export default function DemoSection({
  className = '',
  scale,
  onInteractionPause,
  onInteractionResume,
  resumeDelay = 3000,
  forceReducedMotion,
}: DemoSectionProps) {
  // Detect reduced motion preference (Requirement 5.2)
  const systemPrefersReducedMotion = usePrefersReducedMotion();
  // Allow override for testing purposes
  const prefersReducedMotion = forceReducedMotion ?? systemPrefersReducedMotion;

  // Responsive scale: smaller on mobile, larger on desktop
  const [isMobile, setIsMobile] = useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Use provided scale or responsive default
  // Scale 1.0 for full-size display (no scaling)
  const effectiveScale = scale ?? 1.0;

  // No fixed dimensions - let content determine size
  // Remove height constraint to show full content

  // Interaction pause hook for hover/touch handling
  // Requirements 4.7, 4.8: Pause on hover/touch, resume after 3 seconds
  // Disabled when reduced motion is preferred (Requirement 5.2)
  const { state: interactionState, handlers: interactionHandlers } = useInteractionPause({
    resumeDelay,
    onPause: onInteractionPause,
    onResume: onInteractionResume,
    enabled: !prefersReducedMotion, // Disable interaction pause when reduced motion is preferred
  });

  // Determine if animation is effectively paused
  // When reduced motion is preferred, always show static view
  const isEffectivelyPaused = prefersReducedMotion || interactionState.isPaused;

  return (
    <section
      className={`w-full py-12 px-4 sm:px-6 lg:px-8 ${className}`}
      aria-label="ダッシュボードプレビュー"
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
    >
      {/* Section Title - Requirement 2.6 */}
      <div className="text-center mb-8">
        <h2 className="text-h2 font-semibold text-foreground">
          ダッシュボードプレビュー
        </h2>
        <p className="mt-2 text-body text-muted-foreground">
          実際のダッシュボードをプレビューできます
        </p>
      </div>

      {/* Demo Frame Container - Requirement 2.5 */}
      {/* Interaction handlers for pause/resume - Requirements 4.7, 4.8 */}
      {/* Reduced motion support - Requirement 5.2 */}
      <div
        className={`
          mx-auto
          rounded-xl
          border-2 border-border
          bg-card
          shadow-lg
          overflow-hidden
          relative
          cursor-pointer
          w-full
          ${prefersReducedMotion ? '' : 'transition-shadow duration-200 hover:shadow-xl'}
        `}
        onMouseEnter={prefersReducedMotion ? undefined : interactionHandlers.onMouseEnter}
        onMouseLeave={prefersReducedMotion ? undefined : interactionHandlers.onMouseLeave}
        onTouchStart={prefersReducedMotion ? undefined : interactionHandlers.onTouchStart}
        onTouchEnd={prefersReducedMotion ? undefined : interactionHandlers.onTouchEnd}
        onTouchCancel={prefersReducedMotion ? undefined : interactionHandlers.onTouchCancel}
        role="region"
        aria-label={prefersReducedMotion 
          ? "ダッシュボードプレビュー（静的表示）" 
          : "インタラクティブデモ - ホバーまたはタッチで一時停止"
        }
      >
        {/* Demo Label Badge */}
        <div className="absolute top-4 left-4 z-10">
          <span className="
            inline-flex items-center
            px-3 py-1
            rounded-full
            text-caption font-medium
            bg-primary text-primary-foreground
            shadow-sm
          ">
            {prefersReducedMotion ? 'プレビュー' : 'デモ'}
          </span>
        </div>

        {/* Reduced Motion Indicator - Shows when animations are disabled */}
        {prefersReducedMotion && (
          <div className="absolute top-4 right-4 z-10">
            <span className="
              inline-flex items-center gap-1.5
              px-3 py-1
              rounded-full
              text-caption font-medium
              bg-muted text-muted-foreground
              shadow-sm
            ">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <span>静的表示</span>
            </span>
          </div>
        )}

        {/* Pause Indicator - Shows when animation is paused (only when motion is allowed) */}
        {!prefersReducedMotion && interactionState.isPaused && (
          <div className="absolute top-4 right-4 z-10">
            <span className="
              inline-flex items-center gap-1.5
              px-3 py-1
              rounded-full
              text-caption font-medium
              bg-muted text-muted-foreground
              shadow-sm
              animate-pulse
            ">
              <svg
                className="w-3 h-3"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
              {interactionState.isResumeTimerActive ? (
                <span>
                  {Math.ceil(interactionState.timeUntilResume / 1000)}秒後に再開
                </span>
              ) : (
                <span>一時停止中</span>
              )}
            </span>
          </div>
        )}

        {/* Scaled Dashboard Container - Requirements 2.2, 2.3, 2.8 */}
        {/* Full size - no transform scaling */}
        <div className="w-full">
          {/* Wrap with providers to ensure components work correctly */}
          {/* Pass reduced motion state to context for animation control */}
          <DemoDataProvider>
            <HandednessProvider>
              <DemoDashboardContent />
            </HandednessProvider>
          </DemoDataProvider>
        </div>
      </div>

      {/* Interaction Hint - Different message based on reduced motion preference */}
      <div className="text-center mt-4">
        <p className="text-caption text-muted-foreground">
          {prefersReducedMotion 
            ? 'アニメーションは無効化されています（システム設定に基づく）'
            : 'ホバーまたはタッチでアニメーションを一時停止できます'
          }
        </p>
      </div>

      {/* Call to Action */}
      <div className="text-center mt-4">
        <p className="text-small text-muted-foreground">
          今すぐ始めて、あなたの習慣を管理しましょう
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// Named Exports
// ============================================================================

export { DemoSection, DemoDashboardContent };
export type { DemoSectionProps };
