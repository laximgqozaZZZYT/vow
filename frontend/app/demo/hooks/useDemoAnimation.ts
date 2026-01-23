'use client';

/**
 * Demo Animation Hook
 *
 * Manages animation step state, play/pause/resume controls, and loop processing
 * for the landing page demo section. Respects prefers-reduced-motion media query.
 *
 * Requirements: 4.1, 4.5
 * - 4.1: Auto-play showing typical user interactions when demo section is visible
 * - 4.5: Loop smoothly after completing all demonstration sequences
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * Animation step definition
 * Defines a single step in the demo animation sequence
 */
export interface AnimationStep {
  /** Unique identifier for the step */
  id: string;
  /** Type of animation action */
  type: 'highlight' | 'click' | 'input' | 'scroll' | 'wait';
  /** CSS selector or element ID to target */
  target?: string;
  /** Duration in milliseconds */
  duration: number;
  /** Human-readable description of the step */
  description: string;
  /** Optional action to execute when step starts */
  action?: () => void;
}

/**
 * Animation state returned by the hook
 */
export interface AnimationState {
  /** Current step index in the sequence */
  currentStep: number;
  /** Whether animation is currently playing */
  isPlaying: boolean;
  /** Whether animation is paused */
  isPaused: boolean;
  /** Currently highlighted element selector */
  highlightedElement: string | null;
  /** Current cursor position for animation */
  cursorPosition: { x: number; y: number } | null;
  /** Whether user prefers reduced motion */
  prefersReducedMotion: boolean;
  /** Total number of steps */
  totalSteps: number;
  /** Current step data */
  currentStepData: AnimationStep | null;
}

/**
 * Animation controls returned by the hook
 */
export interface AnimationControls {
  /** Start or resume the animation */
  play: () => void;
  /** Pause the animation */
  pause: () => void;
  /** Resume from paused state */
  resume: () => void;
  /** Reset animation to beginning */
  reset: () => void;
  /** Go to a specific step */
  goToStep: (stepIndex: number) => void;
  /** Skip to next step */
  nextStep: () => void;
  /** Go to previous step */
  prevStep: () => void;
}

/**
 * Options for the useDemoAnimation hook
 */
export interface UseDemoAnimationOptions {
  /** Animation steps to execute */
  steps: AnimationStep[];
  /** Whether to auto-play when visible (default: true) */
  autoPlay?: boolean;
  /** Whether to loop the animation (default: true) */
  loop?: boolean;
  /** Delay before starting loop (default: 1000ms) */
  loopDelay?: number;
  /** Callback when animation completes a full cycle */
  onComplete?: () => void;
  /** Callback when step changes */
  onStepChange?: (step: number, stepData: AnimationStep) => void;
}

/**
 * Return type for the useDemoAnimation hook
 */
export interface UseDemoAnimationReturn {
  /** Current animation state */
  state: AnimationState;
  /** Animation control functions */
  controls: AnimationControls;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * useDemoAnimation
 *
 * Custom hook for managing demo animation sequences with play/pause/resume
 * controls and smooth loop transitions.
 *
 * @param options - Configuration options for the animation
 * @returns Animation state and control functions
 *
 * @example
 * ```tsx
 * const { state, controls } = useDemoAnimation({
 *   steps: animationSteps,
 *   autoPlay: true,
 *   loop: true,
 *   onStepChange: (step, data) => console.log(`Step ${step}: ${data.description}`),
 * });
 *
 * // Use controls
 * controls.play();
 * controls.pause();
 * controls.reset();
 * ```
 */
export function useDemoAnimation(options: UseDemoAnimationOptions): UseDemoAnimationReturn {
  const {
    steps,
    autoPlay = true,
    loop = true,
    loopDelay = 1000,
    onComplete,
    onStepChange,
  } = options;

  // ============================================================================
  // State
  // ============================================================================

  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highlightedElement, setHighlightedElement] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    // Initialize with current preference if available
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  // ============================================================================
  // Refs
  // ============================================================================

  /** Timer reference for step transitions */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Reference to track if component is mounted */
  const isMountedRef = useRef(true);
  /** Reference to track remaining time when paused */
  const remainingTimeRef = useRef<number>(0);
  /** Reference to track when current step started */
  const stepStartTimeRef = useRef<number>(0);
  /** Reference to callbacks to avoid stale closures */
  const callbacksRef = useRef({ onComplete, onStepChange });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = { onComplete, onStepChange };
  }, [onComplete, onStepChange]);

  // ============================================================================
  // Reduced Motion Detection
  // ============================================================================

  useEffect(() => {
    // Server-side rendering guard
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
      // If reduced motion is enabled, stop animation
      if (event.matches) {
        setIsPlaying(false);
        setIsPaused(false);
        clearTimer();
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Clear the current timer
   */
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /**
   * Get the current step data
   */
  const getCurrentStepData = useCallback((): AnimationStep | null => {
    if (currentStep >= 0 && currentStep < steps.length) {
      return steps[currentStep];
    }
    return null;
  }, [currentStep, steps]);

  /**
   * Update visual state based on current step
   */
  const updateVisualState = useCallback((stepData: AnimationStep | null) => {
    if (!stepData) {
      setHighlightedElement(null);
      setCursorPosition(null);
      return;
    }

    // Update highlighted element for highlight and click types
    if (stepData.type === 'highlight' || stepData.type === 'click') {
      setHighlightedElement(stepData.target || null);
    } else {
      setHighlightedElement(null);
    }

    // Update cursor position if target exists
    if (stepData.target && typeof window !== 'undefined') {
      const element = document.querySelector(stepData.target);
      if (element) {
        const rect = element.getBoundingClientRect();
        setCursorPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }
    } else {
      setCursorPosition(null);
    }
  }, []);

  /**
   * Execute the current step's action
   */
  const executeStepAction = useCallback((stepData: AnimationStep) => {
    if (stepData.action) {
      try {
        stepData.action();
      } catch (error) {
        console.error('Demo animation step action error:', error);
      }
    }
  }, []);

  /**
   * Advance to the next step
   */
  const advanceStep = useCallback(() => {
    if (!isMountedRef.current) return;

    const nextStepIndex = currentStep + 1;

    if (nextStepIndex >= steps.length) {
      // Animation sequence complete
      if (callbacksRef.current.onComplete) {
        callbacksRef.current.onComplete();
      }

      if (loop) {
        // Loop back to beginning with delay
        timerRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;
          setCurrentStep(0);
          remainingTimeRef.current = 0;
          stepStartTimeRef.current = Date.now();
        }, loopDelay);
      } else {
        // Stop animation
        setIsPlaying(false);
        setIsPaused(false);
        setHighlightedElement(null);
        setCursorPosition(null);
      }
    } else {
      // Move to next step
      setCurrentStep(nextStepIndex);
      remainingTimeRef.current = 0;
      stepStartTimeRef.current = Date.now();
    }
  }, [currentStep, steps.length, loop, loopDelay]);

  /**
   * Schedule the next step transition
   */
  const scheduleNextStep = useCallback((duration: number) => {
    clearTimer();
    stepStartTimeRef.current = Date.now();
    remainingTimeRef.current = duration;

    timerRef.current = setTimeout(() => {
      advanceStep();
    }, duration);
  }, [clearTimer, advanceStep]);

  // ============================================================================
  // Step Execution Effect
  // ============================================================================

  useEffect(() => {
    if (!isPlaying || isPaused || prefersReducedMotion) {
      return;
    }

    const stepData = getCurrentStepData();
    if (!stepData) {
      return;
    }

    // Update visual state
    updateVisualState(stepData);

    // Execute step action
    executeStepAction(stepData);

    // Notify step change
    if (callbacksRef.current.onStepChange) {
      callbacksRef.current.onStepChange(currentStep, stepData);
    }

    // Schedule next step
    const duration = remainingTimeRef.current > 0 ? remainingTimeRef.current : stepData.duration;
    scheduleNextStep(duration);

    return () => {
      clearTimer();
    };
  }, [
    currentStep,
    isPlaying,
    isPaused,
    prefersReducedMotion,
    getCurrentStepData,
    updateVisualState,
    executeStepAction,
    scheduleNextStep,
    clearTimer,
  ]);

  // ============================================================================
  // Cleanup Effect
  // ============================================================================

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  // ============================================================================
  // Auto-play Effect
  // ============================================================================

  useEffect(() => {
    if (autoPlay && !prefersReducedMotion && steps.length > 0) {
      setIsPlaying(true);
    }
  }, [autoPlay, prefersReducedMotion, steps.length]);

  // ============================================================================
  // Control Functions
  // ============================================================================

  /**
   * Start or resume the animation
   */
  const play = useCallback(() => {
    if (prefersReducedMotion) {
      return; // Don't play if reduced motion is preferred
    }

    if (isPaused) {
      // Resume from paused state
      setIsPaused(false);
      setIsPlaying(true);
    } else if (!isPlaying) {
      // Start fresh
      setIsPlaying(true);
      setIsPaused(false);
    }
  }, [prefersReducedMotion, isPaused, isPlaying]);

  /**
   * Pause the animation
   */
  const pause = useCallback(() => {
    if (!isPlaying || isPaused) {
      return;
    }

    // Calculate remaining time for current step
    const elapsed = Date.now() - stepStartTimeRef.current;
    const stepData = getCurrentStepData();
    if (stepData) {
      remainingTimeRef.current = Math.max(0, stepData.duration - elapsed);
    }

    clearTimer();
    setIsPaused(true);
  }, [isPlaying, isPaused, getCurrentStepData, clearTimer]);

  /**
   * Resume from paused state
   */
  const resume = useCallback(() => {
    if (!isPaused) {
      return;
    }

    setIsPaused(false);
    // The effect will handle resuming with remaining time
  }, [isPaused]);

  /**
   * Reset animation to beginning
   */
  const reset = useCallback(() => {
    clearTimer();
    setCurrentStep(0);
    setIsPlaying(false);
    setIsPaused(false);
    setHighlightedElement(null);
    setCursorPosition(null);
    remainingTimeRef.current = 0;
    stepStartTimeRef.current = 0;
  }, [clearTimer]);

  /**
   * Go to a specific step
   */
  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex < 0 || stepIndex >= steps.length) {
      return;
    }

    clearTimer();
    setCurrentStep(stepIndex);
    remainingTimeRef.current = 0;
    stepStartTimeRef.current = Date.now();

    // Update visual state immediately
    const stepData = steps[stepIndex];
    updateVisualState(stepData);
  }, [steps, clearTimer, updateVisualState]);

  /**
   * Skip to next step
   */
  const nextStep = useCallback(() => {
    const nextIndex = (currentStep + 1) % steps.length;
    goToStep(nextIndex);
  }, [currentStep, steps.length, goToStep]);

  /**
   * Go to previous step
   */
  const prevStep = useCallback(() => {
    const prevIndex = currentStep === 0 ? steps.length - 1 : currentStep - 1;
    goToStep(prevIndex);
  }, [currentStep, steps.length, goToStep]);

  // ============================================================================
  // Return Value
  // ============================================================================

  const state: AnimationState = {
    currentStep,
    isPlaying,
    isPaused,
    highlightedElement,
    cursorPosition,
    prefersReducedMotion,
    totalSteps: steps.length,
    currentStepData: getCurrentStepData(),
  };

  const controls: AnimationControls = {
    play,
    pause,
    resume,
    reset,
    goToStep,
    nextStep,
    prevStep,
  };

  return { state, controls };
}

// ============================================================================
// Exports
// ============================================================================

export default useDemoAnimation;
