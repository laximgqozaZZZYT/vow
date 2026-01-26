/**
 * Board Layout Hook
 * 
 * Manages the layout mode state for the Board section, providing
 * toggle functionality and persistence to local storage.
 * 
 * **Validates: Requirements 1.1, 1.3, 1.4, 1.5**
 * - 1.1: Board_Section SHALL display the Detailed_Layout (Kanban_Board) by default
 * - 1.3: Clicking the layout toggle SHALL switch to the other Layout_Mode without page reload
 * - 1.4: Board_Section SHALL persist the user's Layout_Mode preference in local storage
 * - 1.5: Board_Section loads with a saved preference SHALL display the saved Layout_Mode
 */

import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';

/**
 * Layout mode type for the Board section
 * - 'simple': List view similar to original NextSection
 * - 'detailed': Kanban board view with three columns
 * - 'gantt': Gantt chart view with timeline
 */
export type LayoutMode = 'simple' | 'detailed' | 'gantt';

/**
 * Return type for useBoardLayout hook
 */
export interface UseBoardLayoutReturn {
  /** Current layout mode */
  layoutMode: LayoutMode;
  /** Set layout mode directly */
  setLayoutMode: (mode: LayoutMode) => void;
  /** Toggle between simple and detailed layout modes */
  toggleLayoutMode: () => void;
  /** Whether the layout is in detailed (Kanban) mode */
  isDetailedMode: boolean;
  /** Whether the layout is in simple (list) mode */
  isSimpleMode: boolean;
  /** Whether the layout is in gantt chart mode */
  isGanttMode: boolean;
  /** Loading state (true during SSR) */
  loading: boolean;
}

/** Local storage key for board layout preference */
export const STORAGE_KEY = 'board-layout-mode';

/** Default layout mode - detailed (Kanban) as per requirement 1.1 */
export const DEFAULT_MODE: LayoutMode = 'detailed';

/**
 * Valid layout modes for validation
 */
const VALID_MODES: readonly LayoutMode[] = ['simple', 'detailed', 'gantt'] as const;

/**
 * Validates if a value is a valid LayoutMode
 */
export function isValidLayoutMode(value: unknown): value is LayoutMode {
  return typeof value === 'string' && VALID_MODES.includes(value as LayoutMode);
}

/**
 * Custom hook for managing Board section layout mode
 * 
 * Provides:
 * - Layout mode state with local storage persistence
 * - Toggle function for switching between modes
 * - Direct setter for programmatic mode changes
 * - Convenience boolean flags for mode checking
 * 
 * @returns Layout management object
 * 
 * @example
 * ```tsx
 * function BoardSection() {
 *   const { layoutMode, toggleLayoutMode, isDetailedMode } = useBoardLayout();
 *   
 *   return (
 *     <div>
 *       <button onClick={toggleLayoutMode}>
 *         {isDetailedMode ? 'Switch to Simple' : 'Switch to Detailed'}
 *       </button>
 *       {isDetailedMode ? <KanbanLayout /> : <SimpleLayout />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useBoardLayout(): UseBoardLayoutReturn {
  const { value, setValue, loading } = useLocalStorage<string>(STORAGE_KEY, {
    defaultValue: DEFAULT_MODE,
  });

  // Validate and normalize the stored value
  const layoutMode: LayoutMode = useMemo(() => {
    if (isValidLayoutMode(value)) {
      return value;
    }
    // If stored value is invalid, return default
    return DEFAULT_MODE;
  }, [value]);

  /**
   * Set layout mode directly
   * Only accepts valid layout modes
   */
  const setLayoutMode = useCallback((mode: LayoutMode) => {
    if (isValidLayoutMode(mode)) {
      setValue(mode);
    }
  }, [setValue]);

  /**
   * Toggle between simple, detailed, and gantt layout modes
   * Requirement 1.3: Switch without page reload
   */
  const toggleLayoutMode = useCallback(() => {
    setValue((current) => {
      const currentMode = isValidLayoutMode(current) ? current : DEFAULT_MODE;
      // Cycle: detailed -> simple -> gantt -> detailed
      if (currentMode === 'detailed') return 'simple';
      if (currentMode === 'simple') return 'gantt';
      return 'detailed';
    });
  }, [setValue]);

  // Convenience boolean flags
  const isDetailedMode = layoutMode === 'detailed';
  const isSimpleMode = layoutMode === 'simple';
  const isGanttMode = layoutMode === 'gantt';

  return {
    layoutMode,
    setLayoutMode,
    toggleLayoutMode,
    isDetailedMode,
    isSimpleMode,
    isGanttMode,
    loading,
  };
}

export default useBoardLayout;
