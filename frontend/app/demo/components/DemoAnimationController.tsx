'use client';

/**
 * DemoAnimationController Component
 *
 * Controls the animation sequence for the landing page demo section.
 * Defines animation steps and manages transitions between them.
 *
 * Requirements: 4.2, 4.3, 4.4
 * - 4.2: Demonstrate habit completion flow (clicking complete button)
 * - 4.3: Demonstrate sticky note creation and editing
 * - 4.4: Demonstrate calendar navigation (switching between day/week views)
 */

import React, { useEffect, useCallback, useMemo } from 'react';
import { useDemoAnimation, type AnimationStep } from '../hooks/useDemoAnimation';
import { useDemoData } from '../contexts/DemoDataContext';

// ============================================================================
// Types
// ============================================================================

export interface DemoAnimationControllerProps {
  /** Animation steps to execute */
  steps: AnimationStep[];
  /** Callback when step changes */
  onStepChange: (step: number) => void;
  /** Callback when animation completes a full cycle */
  onComplete: () => void;
  /** Whether animation is paused (e.g., user hovering) */
  isPaused: boolean;
}

// ============================================================================
// Animation Sequence Definition
// ============================================================================

/**
 * Default animation sequence for the demo
 * Demonstrates: habit completion, sticky creation, calendar navigation
 *
 * Sequence:
 * 1. Highlight NextSection
 * 2. Move to complete button
 * 3. Click complete button (habit completion flow)
 * 4. Wait
 * 5. Highlight StickiesSection
 * 6. Click add sticky button
 * 7. Wait
 * 8. Highlight CalendarSection
 * 9. Click week view button
 * 10. Wait (before loop)
 */
export function createDemoAnimationSequence(
  onHabitComplete: () => void,
  onStickyCreate: () => void,
  onCalendarViewChange: () => void
): AnimationStep[] {
  return [
    // Step 1: Highlight NextSection - Requirement 4.2
    {
      id: 'highlight-next-section',
      type: 'highlight',
      target: '#demo-next-section',
      duration: 1500,
      description: 'Nextセクションをハイライト',
    },
    // Step 2: Move to complete button - Requirement 4.2
    {
      id: 'move-to-complete-button',
      type: 'highlight',
      target: '#demo-habit-1-complete',
      duration: 1000,
      description: '完了ボタンに移動',
    },
    // Step 3: Click complete button - Requirement 4.2
    {
      id: 'click-complete-button',
      type: 'click',
      target: '#demo-habit-1-complete',
      duration: 500,
      description: '完了ボタンをクリック',
      action: onHabitComplete,
    },
    // Step 4: Wait after habit completion
    {
      id: 'wait-after-complete',
      type: 'wait',
      duration: 1000,
      description: '完了後の待機',
    },
    // Step 5: Highlight StickiesSection - Requirement 4.3
    {
      id: 'highlight-stickies-section',
      type: 'highlight',
      target: '#demo-stickies-section',
      duration: 1500,
      description: "Sticky'nセクションをハイライト",
    },
    // Step 6: Click add sticky button - Requirement 4.3
    {
      id: 'click-add-sticky',
      type: 'click',
      target: '#demo-add-sticky',
      duration: 500,
      description: '付箋追加ボタンをクリック',
      action: onStickyCreate,
    },
    // Step 7: Wait after sticky creation
    {
      id: 'wait-after-sticky',
      type: 'wait',
      duration: 1500,
      description: '付箋追加後の待機',
    },
    // Step 8: Highlight CalendarSection - Requirement 4.4
    {
      id: 'highlight-calendar',
      type: 'highlight',
      target: '#demo-calendar-section',
      duration: 1500,
      description: 'カレンダーセクションをハイライト',
    },
    // Step 9: Click week view button - Requirement 4.4
    {
      id: 'click-week-view',
      type: 'click',
      target: '#demo-calendar-week-btn',
      duration: 500,
      description: '週表示ボタンをクリック',
      action: onCalendarViewChange,
    },
    // Step 10: Wait before loop
    {
      id: 'wait-end',
      type: 'wait',
      duration: 2000,
      description: 'ループ前の待機',
    },
  ];
}

/**
 * Default animation sequence without actions (for external use)
 */
export const defaultAnimationSequence: AnimationStep[] = [
  {
    id: 'highlight-next-section',
    type: 'highlight',
    target: '#demo-next-section',
    duration: 1500,
    description: 'Nextセクションをハイライト',
  },
  {
    id: 'move-to-complete-button',
    type: 'highlight',
    target: '#demo-habit-1-complete',
    duration: 1000,
    description: '完了ボタンに移動',
  },
  {
    id: 'click-complete-button',
    type: 'click',
    target: '#demo-habit-1-complete',
    duration: 500,
    description: '完了ボタンをクリック',
  },
  {
    id: 'wait-after-complete',
    type: 'wait',
    duration: 1000,
    description: '完了後の待機',
  },
  {
    id: 'highlight-stickies-section',
    type: 'highlight',
    target: '#demo-stickies-section',
    duration: 1500,
    description: "Sticky'nセクションをハイライト",
  },
  {
    id: 'click-add-sticky',
    type: 'click',
    target: '#demo-add-sticky',
    duration: 500,
    description: '付箋追加ボタンをクリック',
  },
  {
    id: 'wait-after-sticky',
    type: 'wait',
    duration: 1500,
    description: '付箋追加後の待機',
  },
  {
    id: 'highlight-calendar',
    type: 'highlight',
    target: '#demo-calendar-section',
    duration: 1500,
    description: 'カレンダーセクションをハイライト',
  },
  {
    id: 'click-week-view',
    type: 'click',
    target: '#demo-calendar-week-btn',
    duration: 500,
    description: '週表示ボタンをクリック',
  },
  {
    id: 'wait-end',
    type: 'wait',
    duration: 2000,
    description: 'ループ前の待機',
  },
];

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * DemoAnimationController
 *
 * Controls the animation sequence for the demo section.
 * Uses the useDemoAnimation hook for state management and
 * integrates with DemoDataContext for executing demo actions.
 *
 * @param props - Component props
 * @returns React component (renders null - controller only)
 */
export function DemoAnimationController({
  steps,
  onStepChange,
  onComplete,
  isPaused,
}: DemoAnimationControllerProps): React.ReactElement | null {
  // Get demo data context for executing actions
  const { setAnimationState } = useDemoData();

  // Initialize animation hook
  const { state, controls } = useDemoAnimation({
    steps,
    autoPlay: true,
    loop: true,
    loopDelay: 1000,
    onComplete,
    onStepChange: (step, stepData) => {
      onStepChange(step);
      // Update animation state in context
      setAnimationState((prev) => ({
        ...prev,
        currentStep: step,
        highlightedElement: stepData.target || null,
      }));
    },
  });

  // Handle pause state changes
  useEffect(() => {
    if (isPaused && state.isPlaying && !state.isPaused) {
      controls.pause();
      setAnimationState((prev) => ({
        ...prev,
        isPaused: true,
      }));
    } else if (!isPaused && state.isPaused) {
      controls.resume();
      setAnimationState((prev) => ({
        ...prev,
        isPaused: false,
      }));
    }
  }, [isPaused, state.isPlaying, state.isPaused, controls, setAnimationState]);

  // Sync animation state with context
  useEffect(() => {
    setAnimationState((prev) => ({
      ...prev,
      isPlaying: state.isPlaying,
      isPaused: state.isPaused,
      highlightedElement: state.highlightedElement,
      cursorPosition: state.cursorPosition,
    }));
  }, [
    state.isPlaying,
    state.isPaused,
    state.highlightedElement,
    state.cursorPosition,
    setAnimationState,
  ]);

  // This component doesn't render anything visible
  // It only controls the animation state
  return null;
}

// ============================================================================
// Hook for using animation controller with context
// ============================================================================

export interface UseDemoAnimationControllerOptions {
  /** Whether animation is paused */
  isPaused?: boolean;
  /** Callback when step changes */
  onStepChange?: (step: number) => void;
  /** Callback when animation completes */
  onComplete?: () => void;
}

/**
 * useDemoAnimationController
 *
 * Hook that provides animation control integrated with DemoDataContext.
 * Creates animation steps with actions that update demo data.
 *
 * @param options - Configuration options
 * @returns Animation state and controls
 */
export function useDemoAnimationController(options: UseDemoAnimationControllerOptions = {}) {
  const {
    isPaused = false,
    onStepChange: externalOnStepChange,
    onComplete: externalOnComplete,
  } = options;

  // Get demo data context
  const {
    habits,
    onHabitAction,
    onStickyCreate,
    setAnimationState,
    resetDemoData,
  } = useDemoData();

  // Create action handlers
  const handleHabitComplete = useCallback(() => {
    // Complete the first habit
    const firstHabit = habits[0];
    if (firstHabit) {
      onHabitAction(firstHabit.id, 'complete');
    }
  }, [habits, onHabitAction]);

  const handleStickyCreate = useCallback(() => {
    onStickyCreate();
  }, [onStickyCreate]);

  const handleCalendarViewChange = useCallback(() => {
    // Calendar view change is handled by the CalendarWidget internally
    // This is a visual-only action in the demo
    console.log('[Demo] Calendar view change triggered');
  }, []);

  // Create animation steps with actions
  const animationSteps = useMemo(
    () =>
      createDemoAnimationSequence(
        handleHabitComplete,
        handleStickyCreate,
        handleCalendarViewChange
      ),
    [handleHabitComplete, handleStickyCreate, handleCalendarViewChange]
  );

  // Handle step change
  const handleStepChange = useCallback(
    (step: number, stepData: AnimationStep) => {
      setAnimationState((prev) => ({
        ...prev,
        currentStep: step,
        highlightedElement: stepData.target || null,
      }));
      externalOnStepChange?.(step);
    },
    [setAnimationState, externalOnStepChange]
  );

  // Handle animation complete
  const handleComplete = useCallback(() => {
    // Reset demo data for next loop
    resetDemoData();
    externalOnComplete?.();
  }, [resetDemoData, externalOnComplete]);

  // Initialize animation hook
  const { state, controls } = useDemoAnimation({
    steps: animationSteps,
    autoPlay: !isPaused,
    loop: true,
    loopDelay: 1000,
    onComplete: handleComplete,
    onStepChange: handleStepChange,
  });

  // Handle external pause state
  useEffect(() => {
    if (isPaused && state.isPlaying && !state.isPaused) {
      controls.pause();
    } else if (!isPaused && state.isPaused) {
      controls.resume();
    }
  }, [isPaused, state.isPlaying, state.isPaused, controls]);

  // Sync state with context
  useEffect(() => {
    setAnimationState((prev) => ({
      ...prev,
      isPlaying: state.isPlaying,
      isPaused: state.isPaused,
      highlightedElement: state.highlightedElement,
      cursorPosition: state.cursorPosition,
    }));
  }, [
    state.isPlaying,
    state.isPaused,
    state.highlightedElement,
    state.cursorPosition,
    setAnimationState,
  ]);

  return {
    state,
    controls,
    steps: animationSteps,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default DemoAnimationController;
export type { AnimationStep };
