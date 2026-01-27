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
