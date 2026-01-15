/**
 * Scroll Reveal Animation Hook
 * 
 * Implements scroll-triggered fade-in animations using the Intersection Observer API.
 * Respects user preferences for reduced motion and provides flexible configuration
 * for animation triggering behavior.
 * 
 * Requirements: 6.1, 6.4, 6.5
 */

import { useEffect, useRef, useState } from 'react';

export interface UseScrollRevealOptions {
  /**
   * Percentage of element visibility required to trigger animation (0.0 to 1.0)
   * @default 0.1
   */
  threshold?: number;
  
  /**
   * Margin around the root element for intersection calculation
   * Format: "top right bottom left" (e.g., "0px 0px -100px 0px")
   * @default "0px 0px -100px 0px"
   */
  rootMargin?: string;
  
  /**
   * Whether animation should trigger only once or every time element enters viewport
   * @default true
   */
  triggerOnce?: boolean;
}

export interface UseScrollRevealReturn {
  /**
   * Ref to attach to the element that should be observed
   */
  ref: React.RefObject<HTMLElement>;
  
  /**
   * Whether the element is currently visible in the viewport
   */
  isVisible: boolean;
}

/**
 * Custom hook for scroll-triggered reveal animations
 * 
 * Uses Intersection Observer API to detect when elements enter the viewport
 * and triggers animations accordingly. Automatically respects user's motion
 * preferences via prefers-reduced-motion media query.
 * 
 * @param options - Configuration options for scroll reveal behavior
 * @returns Object containing ref to attach to element and visibility state
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { ref, isVisible } = useScrollReveal({ threshold: 0.2 });
 *   
 *   return (
 *     <div 
 *       ref={ref}
 *       className={`transition-opacity duration-500 ${
 *         isVisible ? 'opacity-100' : 'opacity-0'
 *       }`}
 *     >
 *       Content that fades in on scroll
 *     </div>
 *   );
 * }
 * ```
 */
export function useScrollReveal(
  options: UseScrollRevealOptions = {}
): UseScrollRevealReturn {
  const {
    threshold = 0.1,
    rootMargin = '0px 0px -100px 0px',
    triggerOnce = true,
  } = options;

  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    // Server-side rendering guard
    if (typeof window === 'undefined') {
      return;
    }

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    // If user prefers reduced motion, immediately set visible to skip animations
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const element = ref.current;
    if (!element) {
      return;
    }

    // Check if element is initially visible in viewport
    // If so, don't animate it (Requirement 6.4)
    const rect = element.getBoundingClientRect();
    const isInitiallyVisible = 
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth);

    if (isInitiallyVisible) {
      setIsVisible(true);
      setHasTriggered(true);
      return;
    }

    // Create Intersection Observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            
            if (triggerOnce) {
              setHasTriggered(true);
            }
          } else if (!triggerOnce && hasTriggered) {
            // Only reset visibility if triggerOnce is false
            setIsVisible(false);
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);

    // Cleanup observer on unmount
    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [threshold, rootMargin, triggerOnce, hasTriggered]);

  return { ref, isVisible };
}
