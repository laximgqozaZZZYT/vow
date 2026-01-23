'use client';

/**
 * SectionAnimations - Mini animations for each demo section
 *
 * Provides subtle, looping animations for each section to draw attention
 * and demonstrate interactivity without being distracting.
 */

import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

interface AnimationState {
  isActive: boolean;
  step: number;
}

interface SectionAnimationProps {
  /** Whether animations are enabled */
  enabled?: boolean;
  /** Animation speed multiplier (default: 1) */
  speed?: number;
  /** Whether to respect reduced motion preference */
  respectReducedMotion?: boolean;
}

// ============================================================================
// Custom Hook for Section Animations
// ============================================================================

/**
 * useSectionAnimation
 *
 * Hook that manages animation state for a section with automatic cycling.
 */
export function useSectionAnimation(
  totalSteps: number,
  intervalMs: number = 2000,
  enabled: boolean = true
): AnimationState & { nextStep: () => void; reset: () => void } {
  const [state, setState] = useState<AnimationState>({
    isActive: enabled,
    step: 0,
  });

  const nextStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: (prev.step + 1) % totalSteps,
    }));
  }, [totalSteps]);

  const reset = useCallback(() => {
    setState({ isActive: enabled, step: 0 });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setState((prev) => ({ ...prev, isActive: false }));
      return;
    }

    setState((prev) => ({ ...prev, isActive: true }));
    const interval = setInterval(nextStep, intervalMs);
    return () => clearInterval(interval);
  }, [enabled, intervalMs, nextStep]);

  return { ...state, nextStep, reset };
}

// ============================================================================
// Progress Bar Animation Component
// ============================================================================

interface AnimatedProgressBarProps {
  /** Target progress percentage (0-100) */
  targetProgress: number;
  /** Animation duration in ms */
  duration?: number;
  /** Color class for the progress bar */
  colorClass?: string;
  /** Whether animation is enabled */
  enabled?: boolean;
}

export function AnimatedProgressBar({
  targetProgress,
  duration = 1500,
  colorClass = 'bg-primary',
  enabled = true,
}: AnimatedProgressBarProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setProgress(targetProgress);
      return;
    }

    // Animate from 0 to target
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progressRatio = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progressRatio, 3);
      setProgress(eased * targetProgress);

      if (progressRatio < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [targetProgress, duration, enabled]);

  return (
    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all ${colorClass}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ============================================================================
// Pulse Animation Component
// ============================================================================

interface PulseAnimationProps {
  children: React.ReactNode;
  /** Whether to show pulse effect */
  active?: boolean;
  /** Pulse color class */
  colorClass?: string;
}

export function PulseAnimation({
  children,
  active = false,
  colorClass = 'ring-primary/50',
}: PulseAnimationProps) {
  return (
    <div className="relative">
      {active && (
        <div
          className={`absolute inset-0 rounded-lg ring-2 ${colorClass} animate-ping opacity-75`}
          style={{ animationDuration: '1.5s' }}
        />
      )}
      {children}
    </div>
  );
}

// ============================================================================
// Highlight Animation Component
// ============================================================================

interface HighlightAnimationProps {
  children: React.ReactNode;
  /** Whether highlight is active */
  active?: boolean;
  /** Highlight color */
  color?: string;
}

export function HighlightAnimation({
  children,
  active = false,
  color = 'rgba(59, 130, 246, 0.1)',
}: HighlightAnimationProps) {
  return (
    <div
      className="relative transition-all duration-300"
      style={{
        backgroundColor: active ? color : 'transparent',
        borderRadius: '8px',
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Counter Animation Component
// ============================================================================

interface AnimatedCounterProps {
  /** Target value */
  target: number;
  /** Animation duration in ms */
  duration?: number;
  /** Suffix text (e.g., '%', '日') */
  suffix?: string;
  /** Whether animation is enabled */
  enabled?: boolean;
}

export function AnimatedCounter({
  target,
  duration = 1500,
  suffix = '',
  enabled = true,
}: AnimatedCounterProps) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }

    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progressRatio = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progressRatio, 3);
      setValue(Math.round(eased * target));

      if (progressRatio < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration, enabled]);

  return (
    <span className="tabular-nums">
      {value}
      {suffix}
    </span>
  );
}

// ============================================================================
// Typing Animation Component
// ============================================================================

interface TypingAnimationProps {
  /** Text to type */
  text: string;
  /** Typing speed in ms per character */
  speed?: number;
  /** Whether animation is enabled */
  enabled?: boolean;
  /** Callback when typing is complete */
  onComplete?: () => void;
}

export function TypingAnimation({
  text,
  speed = 50,
  enabled = true,
  onComplete,
}: TypingAnimationProps) {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDisplayText(text);
      setIsComplete(true);
      return;
    }

    setDisplayText('');
    setIsComplete(false);
    let index = 0;

    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        setIsComplete(true);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, enabled, onComplete]);

  return (
    <span>
      {displayText}
      {!isComplete && <span className="animate-pulse">|</span>}
    </span>
  );
}

// ============================================================================
// Checkmark Animation Component
// ============================================================================

interface CheckmarkAnimationProps {
  /** Whether to show the checkmark */
  show?: boolean;
  /** Size in pixels */
  size?: number;
  /** Color class */
  colorClass?: string;
}

export function CheckmarkAnimation({
  show = false,
  size = 24,
  colorClass = 'text-success',
}: CheckmarkAnimationProps) {
  return (
    <div
      className={`transition-all duration-300 ${colorClass}`}
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'scale(1)' : 'scale(0)',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M20 6L9 17l-5-5"
          className={show ? 'animate-draw-check' : ''}
          style={{
            strokeDasharray: 30,
            strokeDashoffset: show ? 0 : 30,
            transition: 'stroke-dashoffset 0.3s ease-out',
          }}
        />
      </svg>
    </div>
  );
}

// ============================================================================
// Slide In Animation Component
// ============================================================================

interface SlideInAnimationProps {
  children: React.ReactNode;
  /** Direction to slide from */
  direction?: 'left' | 'right' | 'top' | 'bottom';
  /** Whether animation is active */
  active?: boolean;
  /** Delay before animation starts */
  delay?: number;
}

export function SlideInAnimation({
  children,
  direction = 'bottom',
  active = true,
  delay = 0,
}: SlideInAnimationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (active) {
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [active, delay]);

  const transforms = {
    left: 'translateX(-20px)',
    right: 'translateX(20px)',
    top: 'translateY(-20px)',
    bottom: 'translateY(20px)',
  };

  return (
    <div
      className="transition-all duration-500 ease-out"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translate(0)' : transforms[direction],
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Demo Section Animation Wrapper
// ============================================================================

interface DemoSectionAnimationWrapperProps {
  children: React.ReactNode;
  /** Section identifier */
  sectionId: string;
  /** Whether animations are enabled */
  enabled?: boolean;
  /** Current animation step (0-based) */
  currentStep?: number;
  /** Total animation steps */
  totalSteps?: number;
}

export function DemoSectionAnimationWrapper({
  children,
  sectionId,
  enabled = true,
  currentStep = 0,
  totalSteps = 3,
}: DemoSectionAnimationWrapperProps) {
  const isHighlighted = enabled && currentStep % totalSteps === 0;

  return (
    <div
      id={`demo-${sectionId}`}
      className={`
        relative
        transition-all duration-500
        ${isHighlighted ? 'ring-2 ring-primary/30 rounded-lg' : ''}
      `}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default {
  useSectionAnimation,
  AnimatedProgressBar,
  PulseAnimation,
  HighlightAnimation,
  AnimatedCounter,
  TypingAnimation,
  CheckmarkAnimation,
  SlideInAnimation,
  DemoSectionAnimationWrapper,
};
