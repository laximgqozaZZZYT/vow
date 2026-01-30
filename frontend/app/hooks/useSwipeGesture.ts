'use client';

/**
 * useSwipeGesture Hook
 * 
 * スワイプジェスチャーによるタブナビゲーションを実現するカスタムフック
 * 
 * Features:
 * - タッチイベントハンドラー（onTouchStart, onTouchMove, onTouchEnd）
 * - スワイプ閾値（50px）による誤操作防止
 * - スワイプ方向と速度の計算
 * - 境界条件の処理（最初/最後のタブ）
 * - 斜めスワイプの無視（水平移動 > 垂直移動の場合のみ発火）
 * - 視覚フィードバック用のオフセット値
 * 
 * @module useSwipeGesture
 * 
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.6
 */

import { useState, useCallback, useRef } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';

/** Default swipe threshold in pixels */
const DEFAULT_THRESHOLD = 50;

/** Default velocity threshold (px/ms) */
const DEFAULT_VELOCITY_THRESHOLD = 0.3;

/** Debounce time in milliseconds to prevent rapid swipes */
const DEBOUNCE_TIME = 300;

/**
 * Configuration for swipe gesture behavior
 */
export interface SwipeConfig {
  /** Minimum swipe distance to trigger navigation (px) - default: 50 */
  threshold?: number;
  /** Minimum velocity to trigger navigation (px/ms) - default: 0.3 */
  velocityThreshold?: number;
  /** Callback when user swipes left (navigate to next tab) */
  onSwipeLeft: () => void;
  /** Callback when user swipes right (navigate to previous tab) */
  onSwipeRight: () => void;
  /** Whether swiping left is disabled (e.g., at last tab) */
  disableSwipeLeft?: boolean;
  /** Whether swiping right is disabled (e.g., at first tab) */
  disableSwipeRight?: boolean;
}

/**
 * Internal state for tracking swipe gesture
 */
interface SwipeState {
  /** Starting X coordinate of touch */
  startX: number;
  /** Starting Y coordinate of touch */
  startY: number;
  /** Current X coordinate during swipe */
  currentX: number;
  /** Whether a swipe gesture is in progress */
  isDragging: boolean;
  /** Timestamp when touch started (for velocity calculation) */
  startTime: number;
}

/**
 * Return type for useSwipeGesture hook
 */
export interface UseSwipeGestureReturn {
  /** Touch event handlers to spread onto a container element */
  handlers: {
    onTouchStart: (e: ReactTouchEvent) => void;
    onTouchMove: (e: ReactTouchEvent) => void;
    onTouchEnd: (e: ReactTouchEvent) => void;
  };
  /** Current swipe offset in pixels (for visual feedback during swipe) */
  offset: number;
  /** Whether a swipe gesture is currently in progress */
  isDragging: boolean;
}

/**
 * Initial swipe state
 */
const initialState: SwipeState = {
  startX: 0,
  startY: 0,
  currentX: 0,
  isDragging: false,
  startTime: 0,
};

/**
 * Custom hook for handling swipe gestures for tab navigation
 * 
 * Provides:
 * - Touch event handlers for swipe detection
 * - Offset value for visual feedback during swipe
 * - Configurable threshold and velocity settings
 * - Boundary condition handling
 * - Diagonal swipe filtering (only horizontal swipes trigger navigation)
 * 
 * @param config - Swipe configuration including callbacks and thresholds
 * @returns Touch event handlers and current swipe offset
 * 
 * @example
 * ```tsx
 * const { handlers, offset, isDragging } = useSwipeGesture({
 *   onSwipeLeft: () => goToNextTab(),
 *   onSwipeRight: () => goToPreviousTab(),
 *   disableSwipeLeft: isLastTab,
 *   disableSwipeRight: isFirstTab,
 * });
 * 
 * return (
 *   <div 
 *     {...handlers}
 *     style={{ transform: `translateX(${offset}px)` }}
 *   >
 *     {tabContent}
 *   </div>
 * );
 * ```
 */
export function useSwipeGesture(config: SwipeConfig): UseSwipeGestureReturn {
  const {
    threshold = DEFAULT_THRESHOLD,
    velocityThreshold = DEFAULT_VELOCITY_THRESHOLD,
    onSwipeLeft,
    onSwipeRight,
    disableSwipeLeft = false,
    disableSwipeRight = false,
  } = config;

  const [state, setState] = useState<SwipeState>(initialState);
  const [offset, setOffset] = useState(0);
  
  // Ref to track if we should ignore vertical scrolling
  const isHorizontalSwipe = useRef<boolean | null>(null);
  
  // Ref for debouncing rapid swipes
  const lastSwipeTime = useRef<number>(0);

  /**
   * Handle touch start event
   * Records the starting position and time of the touch
   */
  const onTouchStart = useCallback((e: ReactTouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;

    isHorizontalSwipe.current = null; // Reset direction detection
    
    setState({
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      isDragging: true,
      startTime: Date.now(),
    });
    setOffset(0);
  }, []);

  /**
   * Handle touch move event
   * Updates the current position and calculates offset for visual feedback
   */
  const onTouchMove = useCallback((e: ReactTouchEvent) => {
    if (!state.isDragging) return;

    const touch = e.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - state.startX;
    const deltaY = touch.clientY - state.startY;

    // Determine if this is a horizontal or vertical swipe on first significant movement
    if (isHorizontalSwipe.current === null) {
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      
      // Only decide direction after some movement
      if (absDeltaX > 10 || absDeltaY > 10) {
        isHorizontalSwipe.current = absDeltaX > absDeltaY;
      }
    }

    // If this is a vertical swipe, don't update offset (allow scrolling)
    if (isHorizontalSwipe.current === false) {
      return;
    }

    // Update current position
    setState(prev => ({
      ...prev,
      currentX: touch.clientX,
    }));

    // Calculate offset for visual feedback
    // Limit offset based on disabled directions
    let newOffset = deltaX;
    
    // If swiping left (negative offset) is disabled, don't allow negative offset
    if (disableSwipeLeft && newOffset < 0) {
      newOffset = 0;
    }
    
    // If swiping right (positive offset) is disabled, don't allow positive offset
    if (disableSwipeRight && newOffset > 0) {
      newOffset = 0;
    }

    setOffset(newOffset);
  }, [state.isDragging, state.startX, state.startY, disableSwipeLeft, disableSwipeRight]);

  /**
   * Handle touch end event
   * Determines if the swipe meets threshold requirements and triggers navigation
   */
  const onTouchEnd = useCallback(() => {
    if (!state.isDragging) return;

    const deltaX = state.currentX - state.startX;
    const absDeltaX = Math.abs(deltaX);
    const duration = Date.now() - state.startTime;
    const velocity = duration > 0 ? absDeltaX / duration : 0;

    // Check debounce
    const now = Date.now();
    const timeSinceLastSwipe = now - lastSwipeTime.current;
    const isDebounced = timeSinceLastSwipe < DEBOUNCE_TIME;

    // Determine if swipe should trigger navigation
    // Must be a horizontal swipe and meet threshold OR velocity requirements
    const meetsThreshold = absDeltaX >= threshold;
    const meetsVelocity = velocity >= velocityThreshold && absDeltaX >= threshold / 2;
    const shouldNavigate = isHorizontalSwipe.current === true && 
                          (meetsThreshold || meetsVelocity) && 
                          !isDebounced;

    if (shouldNavigate) {
      lastSwipeTime.current = now;
      
      if (deltaX < 0 && !disableSwipeLeft) {
        // Swiped left -> navigate to next tab
        onSwipeLeft();
      } else if (deltaX > 0 && !disableSwipeRight) {
        // Swiped right -> navigate to previous tab
        onSwipeRight();
      }
    }

    // Reset state
    setState(initialState);
    setOffset(0);
    isHorizontalSwipe.current = null;
  }, [
    state.isDragging,
    state.currentX,
    state.startX,
    state.startTime,
    threshold,
    velocityThreshold,
    disableSwipeLeft,
    disableSwipeRight,
    onSwipeLeft,
    onSwipeRight,
  ]);

  return {
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    offset,
    isDragging: state.isDragging,
  };
}

export default useSwipeGesture;
