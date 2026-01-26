import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Props for useMobileSwipe hook
 */
export interface UseMobileSwipeProps {
  /** Total number of columns to navigate between */
  totalColumns: number;
  /** Callback when column changes */
  onColumnChange?: (index: number) => void;
}

/**
 * Return type for useMobileSwipe hook
 */
export interface UseMobileSwipeReturn {
  /** Current column index (0-based) */
  currentColumnIndex: number;
  /** Ref to attach to the swipeable container */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Handle touch start event */
  handleTouchStart: (event: React.TouchEvent) => void;
  /** Handle touch move event */
  handleTouchMove: (event: React.TouchEvent) => void;
  /** Handle touch end event */
  handleTouchEnd: () => void;
  /** Programmatically navigate to a specific column */
  goToColumn: (index: number) => void;
}

/** Minimum swipe distance in pixels to trigger column change */
const SWIPE_THRESHOLD = 50;

/** Maximum vertical movement allowed during horizontal swipe */
const VERTICAL_THRESHOLD = 30;

/**
 * Check if user prefers reduced motion
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Custom hook for mobile swipe navigation between Kanban columns
 * 
 * Provides touch gesture handling for horizontal swipe navigation:
 * - Left swipe → next column
 * - Right swipe → previous column
 * - Prevents vertical scroll interference during horizontal swipe
 * - Respects prefers-reduced-motion setting
 * 
 * @param props - Hook configuration
 * @returns Swipe state and handlers
 * 
 * @example
 * ```tsx
 * const {
 *   currentColumnIndex,
 *   containerRef,
 *   handleTouchStart,
 *   handleTouchMove,
 *   handleTouchEnd,
 *   goToColumn,
 * } = useMobileSwipe({ totalColumns: 3, onColumnChange: handleColumnChange });
 * 
 * return (
 *   <div
 *     ref={containerRef}
 *     onTouchStart={handleTouchStart}
 *     onTouchMove={handleTouchMove}
 *     onTouchEnd={handleTouchEnd}
 *   >
 *     {columns}
 *   </div>
 * );
 * ```
 * 
 * **Validates: Requirements 5.1, 5.2, 5.3**
 */
export function useMobileSwipe({
  totalColumns,
  onColumnChange
}: UseMobileSwipeProps): UseMobileSwipeReturn {
  // Current column index state
  const [currentColumnIndex, setCurrentColumnIndex] = useState(0);
  
  // Container ref for scroll manipulation
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Touch tracking refs
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const isSwipingRef = useRef(false);
  const hasMovedRef = useRef(false);

  /**
   * Clamp a value between min and max
   */
  const clamp = useCallback((value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
  }, []);

  /**
   * Navigate to a specific column index
   * Bounds the index between 0 and totalColumns-1
   */
  const goToColumn = useCallback((index: number) => {
    const clampedIndex = clamp(index, 0, totalColumns - 1);
    
    if (clampedIndex !== currentColumnIndex) {
      setCurrentColumnIndex(clampedIndex);
      onColumnChange?.(clampedIndex);
      
      // Scroll the container to show the target column
      if (containerRef.current) {
        const container = containerRef.current;
        // Get the actual column element to scroll to
        const columns = container.querySelectorAll('[class*="snap-center"]');
        const targetColumn = columns[clampedIndex] as HTMLElement;
        
        if (targetColumn) {
          // Use smooth scroll unless user prefers reduced motion
          if (prefersReducedMotion()) {
            targetColumn.scrollIntoView({ inline: 'center', block: 'nearest' });
          } else {
            targetColumn.scrollIntoView({ 
              inline: 'center', 
              block: 'nearest',
              behavior: 'smooth' 
            });
          }
        }
      }
    }
  }, [currentColumnIndex, totalColumns, onColumnChange, clamp]);

  /**
   * Handle touch start event
   * Records the starting position for swipe detection
   */
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    lastTouchRef.current = null;
    isSwipingRef.current = false;
    hasMovedRef.current = false;
  }, []);

  /**
   * Handle touch move event
   * Detects horizontal swipe and prevents vertical scroll interference
   */
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    
    const touch = event.touches[0];
    lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
    
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    
    hasMovedRef.current = true;
    
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    
    // Determine if this is a horizontal swipe
    // Only consider it a horizontal swipe if horizontal movement > vertical movement
    // and vertical movement is within threshold
    if (!isSwipingRef.current && absX > 10) {
      if (absX > absY && absY < VERTICAL_THRESHOLD) {
        isSwipingRef.current = true;
      }
    }
    
    // Prevent vertical scrolling during horizontal swipe
    if (isSwipingRef.current) {
      event.preventDefault();
    }
  }, []);

  /**
   * Handle touch end event
   * Determines swipe direction and updates column index
   */
  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !hasMovedRef.current) {
      touchStartRef.current = null;
      lastTouchRef.current = null;
      isSwipingRef.current = false;
      hasMovedRef.current = false;
      return;
    }
    
    if (!isSwipingRef.current || !lastTouchRef.current) {
      touchStartRef.current = null;
      lastTouchRef.current = null;
      isSwipingRef.current = false;
      hasMovedRef.current = false;
      return;
    }
    
    const deltaX = lastTouchRef.current.x - touchStartRef.current.x;
    
    // Check if swipe distance exceeds threshold
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
      if (deltaX < 0) {
        // Left swipe → next column
        goToColumn(currentColumnIndex + 1);
      } else {
        // Right swipe → previous column
        goToColumn(currentColumnIndex - 1);
      }
    }
    
    // Reset state
    touchStartRef.current = null;
    lastTouchRef.current = null;
    isSwipingRef.current = false;
    hasMovedRef.current = false;
  }, [currentColumnIndex, goToColumn]);

  // Sync scroll position when currentColumnIndex changes externally
  useEffect(() => {
    if (containerRef.current && totalColumns > 0) {
      const container = containerRef.current;
      const columns = container.querySelectorAll('[class*="snap-center"]');
      const targetColumn = columns[currentColumnIndex] as HTMLElement;
      
      if (targetColumn) {
        // Use scrollIntoView for more reliable positioning with snap-center
        if (prefersReducedMotion()) {
          targetColumn.scrollIntoView({ inline: 'center', block: 'nearest' });
        } else {
          targetColumn.scrollIntoView({ 
            inline: 'center', 
            block: 'nearest',
            behavior: 'smooth' 
          });
        }
      }
    }
  }, [currentColumnIndex, totalColumns]);

  return {
    currentColumnIndex,
    containerRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    goToColumn
  };
}

export default useMobileSwipe;
