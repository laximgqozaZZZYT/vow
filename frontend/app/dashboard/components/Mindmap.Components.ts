/**
 * Mindmap UI Components
 * 
 * Re-exports all mindmap-related UI components for easy importing.
 * 
 * @example
 * import {
 *   MindmapHeader,
 *   MindmapControls,
 *   EdgeLegend,
 *   ConnectionModeOverlay,
 *   MobileBottomMenu,
 *   SaveDialog,
 *   CoachMark
 * } from './Mindmap.Components';
 */

// Header component
export { MindmapHeader, type MindmapHeaderProps } from './Mindmap.Header';

// Controls and legend
export { 
  MindmapControls, 
  EdgeLegend, 
  type MindmapControlsProps, 
  type EdgeLegendProps 
} from './Mindmap.Controls';

// Connection mode overlay
export { 
  ConnectionModeOverlay, 
  type ConnectionModeOverlayProps 
} from './Mindmap.ConnectionOverlay';

// Mobile bottom menu
export { 
  MobileBottomMenu, 
  type MobileBottomMenuProps, 
  type MenuAction 
} from './Mindmap.MobileMenu';

// Save dialog
export { SaveDialog, type SaveDialogProps } from './Mindmap.SaveDialog';

// Coach mark
export { 
  CoachMark, 
  hasSeenCoachMark, 
  markCoachMarkSeen, 
  type CoachMarkProps 
} from './Mindmap.CoachMark';
