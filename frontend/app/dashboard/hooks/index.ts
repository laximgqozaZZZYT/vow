/**
 * Dashboard Hooks
 * 
 * Re-exports all custom hooks for the dashboard.
 */

// Mindmap state management
export { useMindmapState } from './useMindmapState';
export { useEditableMindmapState } from './useEditableMindmapState';

// Connection handling
export { useConnectionMode } from './useConnectionMode';
export { useConnectionHandlers } from './useConnectionHandlers';

// Node operations
export { useNodeOperations } from './useNodeOperations';

// Mobile interactions
export { useMobileInteractions } from './useMobileInteractions';

// Modal management
export { useMindmapModals } from './useMindmapModals';
export { useModalHandlers } from './useModalHandlers';

// Event handling
export { useMindmapEvents } from './useMindmapEvents';

// Persistence
export { useMindmapPersistence } from './useMindmapPersistence';

// Board layout
export { useBoardLayout, type LayoutMode, type UseBoardLayoutReturn, STORAGE_KEY, DEFAULT_MODE, isValidLayoutMode } from './useBoardLayout';

// Kanban drag and drop
export { 
  useKanbanDragDrop, 
  type HabitStatus, 
  type UseKanbanDragDropProps, 
  type UseKanbanDragDropReturn 
} from './useKanbanDragDrop';

// Mobile swipe navigation
export {
  useMobileSwipe,
  type UseMobileSwipeProps,
  type UseMobileSwipeReturn
} from './useMobileSwipe';

// Habit subtasks management
export {
  useHabitSubtasks,
  buildSubtasksByHabitMap,
  type UseHabitSubtasksOptions,
  type HabitSubtasksMap,
  type UseHabitSubtasksReturn
} from './useHabitSubtasks';

// Expanded habits state management
export {
  useExpandedHabits,
  loadExpandedState,
  saveExpandedState,
  EXPANDED_HABITS_KEY,
  type ExpandedHabitsState,
  type UseExpandedHabitsReturn
} from './useExpandedHabits';

// AI Assistant mode
export {
  useAIAssistantMode,
  isValidAIAssistantMode,
  STORAGE_KEY as AI_ASSISTANT_MODE_STORAGE_KEY,
  DEFAULT_MODE as AI_ASSISTANT_DEFAULT_MODE,
  type AIAssistantMode,
  type UseAIAssistantModeReturn
} from './useAIAssistantMode';

// Suggestion management (ISS-20260204-017)
export {
  useSnoozedSuggestions,
  formatRemainingTime,
  type SnoozedSuggestion,
  type SuggestionToSnooze,
  type UseSnoozedSuggestionsReturn
} from './useSnoozedSuggestions';

export {
  useSuggestionHistory,
  formatHistoryDate,
  getStatusLabel,
  getStatusLabelJa,
  type SuggestionHistoryStatus,
  type SuggestionHistoryItem,
  type SuggestionHistoryFilter,
  type SuggestionForHistory,
  type UseSuggestionHistoryReturn
} from './useSuggestionHistory';

export {
  useBulkSelection,
  useBulkSelectionIds,
  type Selectable,
  type UseBulkSelectionReturn
} from './useBulkSelection';
