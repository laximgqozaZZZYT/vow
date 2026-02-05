/**
 * AI Assistant Mode Hook
 *
 * Manages the AI assistant mode state for switching between
 * coach and manager modes, with persistence to local storage.
 */

import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';

/**
 * AI Assistant mode type
 * - 'coach': Supportive guidance mode
 * - 'manager': Direct management mode
 */
export type AIAssistantMode = 'coach' | 'manager';

/**
 * Return type for useAIAssistantMode hook
 */
export interface UseAIAssistantModeReturn {
  /** Current assistant mode */
  mode: AIAssistantMode;
  /** Set mode directly */
  setMode: (mode: AIAssistantMode) => void;
  /** Toggle between coach and manager modes */
  toggleMode: () => void;
  /** Whether the assistant is in coach mode */
  isCoachMode: boolean;
  /** Whether the assistant is in manager mode */
  isManagerMode: boolean;
}

/** Local storage key for AI assistant mode preference */
export const STORAGE_KEY = 'ai-assistant-mode';

/** Default assistant mode */
export const DEFAULT_MODE: AIAssistantMode = 'coach';

/**
 * Valid assistant modes for validation
 */
const VALID_MODES: readonly AIAssistantMode[] = ['coach', 'manager'] as const;

/**
 * Validates if a value is a valid AIAssistantMode
 */
export function isValidAIAssistantMode(value: unknown): value is AIAssistantMode {
  return typeof value === 'string' && VALID_MODES.includes(value as AIAssistantMode);
}

/**
 * Custom hook for managing AI assistant mode
 *
 * Provides:
 * - Mode state with local storage persistence
 * - Toggle function for switching between modes
 * - Direct setter for programmatic mode changes
 * - Convenience boolean flags for mode checking
 *
 * @param defaultMode - Default mode to use if no stored preference exists
 * @returns Mode management object
 *
 * @example
 * ```tsx
 * function AIAssistant() {
 *   const { mode, toggleMode, isCoachMode } = useAIAssistantMode();
 *
 *   return (
 *     <div>
 *       <button onClick={toggleMode}>
 *         {isCoachMode ? 'Switch to Manager' : 'Switch to Coach'}
 *       </button>
 *       {isCoachMode ? <CoachMode /> : <ManagerMode />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAIAssistantMode(
  defaultMode: AIAssistantMode = DEFAULT_MODE
): UseAIAssistantModeReturn {
  const { value, setValue } = useLocalStorage<string>(STORAGE_KEY, {
    defaultValue: defaultMode,
  });

  // Validate and normalize the stored value
  const mode: AIAssistantMode = useMemo(() => {
    if (isValidAIAssistantMode(value)) {
      return value;
    }
    // If stored value is invalid, return default
    return defaultMode;
  }, [value, defaultMode]);

  /**
   * Set mode directly
   * Only accepts valid assistant modes
   */
  const setMode = useCallback((newMode: AIAssistantMode) => {
    if (isValidAIAssistantMode(newMode)) {
      setValue(newMode);
    }
  }, [setValue]);

  /**
   * Toggle between coach and manager modes
   */
  const toggleMode = useCallback(() => {
    setValue((current) => {
      const currentMode = isValidAIAssistantMode(current) ? current : defaultMode;
      return currentMode === 'coach' ? 'manager' : 'coach';
    });
  }, [setValue, defaultMode]);

  // Convenience boolean flags
  const isCoachMode = mode === 'coach';
  const isManagerMode = mode === 'manager';

  return {
    mode,
    setMode,
    toggleMode,
    isCoachMode,
    isManagerMode,
  };
}

export default useAIAssistantMode;
