'use client';

/**
 * useInteractionPause Hook
 *
 * Manages pause/resume behavior for demo animations based on user interactions.
 * Pauses animation immediately on hover/touch and resumes after a 3-second delay
 * when the user stops interacting.
 *
 * Requirements: 4.7, 4.8
 * - 4.7: Animation SHALL pause when the user hovers over or touches the demo section
 * - 4.8: When the user stops interacting, animation SHALL resume after a 3-second delay
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * State returned by the useInteractionPause hook
 */
export interface InteractionPauseState {
  /** Whether the animation is currently paused due to user interaction */
  isPaused: boolean;
  /** Whether the user is currently hovering over the element */
  isHovering: boolean;
  /** Whether the user is currently touching the element */
  isTouching: boolean;
  /** Whether the resume timer is active (counting down to resume) */
  isResumeTimerActive: boolean;
  /** Time remaining until resume (in milliseconds) */
  timeUntilResume: number;
}

/**
 * Event handlers returned by the useInteractionPause hook
 */
export interface InteractionPauseHandlers {
  /** Handler for mouse enter event */
  onMouseEnter: () => void;
  /** Handler for mouse leave event */
  onMouseLeave: () => void;
  /** Handler for touch start event */
  onTouchStart: () => void;
  /** Handler for touch end event */
  onTouchEnd: () => void;
  /** Handler for touch cancel event */
  onTouchCancel: () => void;
  /** Manual pause function */
  pause: () => void;
  /** Manual resume function (bypasses delay) */
  resumeImmediately: () => void;
  /** Cancel the resume timer */
  cancelResumeTimer: () => void;
}

/**
 * Options for the useInteractionPause hook
 */
export interface UseInteractionPauseOptions {
  /** Delay before resuming animation after interaction ends (default: 3000ms) */
  resumeDelay?: number;
  /** Callback when animation is paused */
  onPause?: () => void;
  /** Callback when animation is resumed */
  onResume?: () => void;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Return type for the useInteractionPause hook
 */
export interface UseInteractionPauseReturn {
  /** Current interaction state */
  state: InteractionPauseState;
  /** Event handlers to attach to the target element */
  handlers: InteractionPauseHandlers;
}

// ============================================================================
// Constants
// ============================================================================

/** Default resume delay in milliseconds (3 seconds as per requirement 4.8) */
const DEFAULT_RESUME_DELAY = 3000;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * useInteractionPause
 *
 * Custom hook for managing animation pause/resume based on user interactions.
 * Implements the following behavior:
 * - Pauses immediately when user hovers or touches the element
 * - Resumes after a 3-second delay when interaction ends
 * - Cancels resume timer if user interacts again before delay completes
 *
 * @param options - Configuration options
 * @returns Interaction state and event handlers
 *
 * @example
 * ```tsx
 * const { state, handlers } = useInteractionPause({
 *   resumeDelay: 3000,
 *   onPause: () => console.log('Paused'),
 *   onResume: () => console.log('Resumed'),
 * });
 *
 * return (
 *   <div
 *     onMouseEnter={handlers.onMouseEnter}
 *     onMouseLeave={handlers.onMouseLeave}
 *     onTouchStart={handlers.onTouchStart}
 *     onTouchEnd={handlers.onTouchEnd}
 *   >
 *     {state.isPaused ? 'Paused' : 'Playing'}
 *   </div>
 * );
 * ```
 */
export function useInteractionPause(
  options: UseInteractionPauseOptions = {}
): UseInteractionPauseReturn {
  const {
    resumeDelay = DEFAULT_RESUME_DELAY,
    onPause,
    onResume,
    enabled = true,
  } = options;

  // ============================================================================
  // State
  // ============================================================================

  const [isHovering, setIsHovering] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [isResumeTimerActive, setIsResumeTimerActive] = useState(false);
  const [timeUntilResume, setTimeUntilResume] = useState(0);

  // ============================================================================
  // Refs
  // ============================================================================

  /** Timer reference for resume delay */
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Interval reference for countdown display */
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Reference to track when resume timer started */
  const timerStartTimeRef = useRef<number>(0);
  /** Reference to callbacks to avoid stale closures */
  const callbacksRef = useRef({ onPause, onResume });
  /** Reference to track if component is mounted */
  const isMountedRef = useRef(true);

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = { onPause, onResume };
  }, [onPause, onResume]);

  // ============================================================================
  // Derived State
  // ============================================================================

  /** Animation is paused when user is hovering, touching, or resume timer is active */
  const isPaused = enabled && (isHovering || isTouching || isResumeTimerActive);

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Clear the resume timer and countdown interval
   */
  const clearTimers = useCallback(() => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setIsResumeTimerActive(false);
    setTimeUntilResume(0);
  }, []);

  /**
   * Start the resume timer with countdown
   */
  const startResumeTimer = useCallback(() => {
    if (!isMountedRef.current) return;

    // Clear any existing timers
    clearTimers();

    // Start the resume timer
    setIsResumeTimerActive(true);
    setTimeUntilResume(resumeDelay);
    timerStartTimeRef.current = Date.now();

    // Set up countdown interval for UI feedback
    countdownIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;

      const elapsed = Date.now() - timerStartTimeRef.current;
      const remaining = Math.max(0, resumeDelay - elapsed);
      setTimeUntilResume(remaining);

      if (remaining <= 0) {
        clearInterval(countdownIntervalRef.current!);
        countdownIntervalRef.current = null;
      }
    }, 100);

    // Set up the actual resume timer
    resumeTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;

      clearTimers();
      // Call onResume callback
      if (callbacksRef.current.onResume) {
        callbacksRef.current.onResume();
      }
    }, resumeDelay);
  }, [resumeDelay, clearTimers]);

  /**
   * Handle interaction start (hover or touch)
   */
  const handleInteractionStart = useCallback(() => {
    if (!enabled) return;

    // Clear any pending resume timer
    clearTimers();

    // Call onPause callback if this is the first interaction
    if (!isHovering && !isTouching && callbacksRef.current.onPause) {
      callbacksRef.current.onPause();
    }
  }, [enabled, isHovering, isTouching, clearTimers]);

  /**
   * Handle interaction end (mouse leave or touch end)
   */
  const handleInteractionEnd = useCallback(() => {
    if (!enabled) return;

    // Start the resume timer
    startResumeTimer();
  }, [enabled, startResumeTimer]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle mouse enter event
   */
  const onMouseEnter = useCallback(() => {
    handleInteractionStart();
    setIsHovering(true);
  }, [handleInteractionStart]);

  /**
   * Handle mouse leave event
   */
  const onMouseLeave = useCallback(() => {
    setIsHovering(false);
    // Only start resume timer if not touching
    if (!isTouching) {
      handleInteractionEnd();
    }
  }, [isTouching, handleInteractionEnd]);

  /**
   * Handle touch start event
   */
  const onTouchStart = useCallback(() => {
    handleInteractionStart();
    setIsTouching(true);
  }, [handleInteractionStart]);

  /**
   * Handle touch end event
   */
  const onTouchEnd = useCallback(() => {
    setIsTouching(false);
    // Only start resume timer if not hovering
    if (!isHovering) {
      handleInteractionEnd();
    }
  }, [isHovering, handleInteractionEnd]);

  /**
   * Handle touch cancel event
   */
  const onTouchCancel = useCallback(() => {
    setIsTouching(false);
    // Only start resume timer if not hovering
    if (!isHovering) {
      handleInteractionEnd();
    }
  }, [isHovering, handleInteractionEnd]);

  /**
   * Manual pause function
   */
  const pause = useCallback(() => {
    handleInteractionStart();
    setIsHovering(true); // Use hovering state to maintain pause
  }, [handleInteractionStart]);

  /**
   * Manual resume function (bypasses delay)
   */
  const resumeImmediately = useCallback(() => {
    clearTimers();
    setIsHovering(false);
    setIsTouching(false);
    if (callbacksRef.current.onResume) {
      callbacksRef.current.onResume();
    }
  }, [clearTimers]);

  /**
   * Cancel the resume timer (keeps paused state)
   */
  const cancelResumeTimer = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  // ============================================================================
  // Cleanup Effect
  // ============================================================================

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  // ============================================================================
  // Return Value
  // ============================================================================

  const state: InteractionPauseState = {
    isPaused,
    isHovering,
    isTouching,
    isResumeTimerActive,
    timeUntilResume,
  };

  const handlers: InteractionPauseHandlers = {
    onMouseEnter,
    onMouseLeave,
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
    pause,
    resumeImmediately,
    cancelResumeTimer,
  };

  return { state, handlers };
}

// ============================================================================
// Exports
// ============================================================================

export default useInteractionPause;
