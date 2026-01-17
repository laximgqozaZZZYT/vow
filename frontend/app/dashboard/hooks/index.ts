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
export type { MindmapSaveData } from './useMindmapPersistence';
