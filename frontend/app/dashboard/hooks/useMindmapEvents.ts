/**
 * useMindmapEvents Hook
 * 
 * Manages event listener registration and cleanup for the mindmap.
 * Handles keyboard shortcuts, custom events, and window events.
 * 
 * @example
 * useMindmapEvents({
 *   onDeleteKey: handleDelete,
 *   onEscapeKey: handleEscape,
 *   isEditMode: true,
 *   isAnyNodeEditing: false
 * });
 */

import { useEffect, useCallback, useRef } from 'react';
import { Node } from 'reactflow';
import { CustomNodeData, ConnectionMode } from '../types/mindmap.types';

/** Event handler map */
export interface EventHandlers {
  /** Handler for node change events */
  onNodeChanged?: () => void;
  /** Handler for long press start */
  onLongPressStart?: () => void;
  /** Handler for long press end */
  onLongPressEnd?: () => void;
  /** Handler for mobile bottom menu show */
  onShowMobileBottomMenu?: (nodeId: string, nodeName: string) => void;
  /** Handler for mobile connection start */
  onStartMobileConnection?: (sourceNodeId: string, sourceHandleId?: string) => void;
  /** Handler for connection mode state request */
  onGetConnectionModeState?: () => ConnectionMode;
  /** Handler for execute connection */
  onExecuteConnection?: (targetNodeId: string) => void;
  /** Handler for touch end on pane */
  onTouchEndOnPane?: (clientX: number, clientY: number, sourceNodeId: string, sourceHandleId?: string) => void;
}

/** Hook configuration options */
export interface UseMindmapEventsOptions {
  /** Whether the device is mobile */
  isMobile: boolean;
  /** Whether edit mode is active */
  isEditMode: boolean;
  /** Whether any node is currently being edited */
  isAnyNodeEditing: boolean;
  /** Selected nodes for keyboard operations */
  selectedNodes: Node<CustomNodeData>[];
  /** Current connection mode state */
  connectionMode: ConnectionMode;
  /** Event handlers */
  handlers: EventHandlers;
  /** Handler for delete key */
  onDeleteKey?: () => void;
  /** Handler for escape key */
  onEscapeKey?: () => void;
}

/** Keyboard event handler options */
export interface KeyboardHandlerOptions {
  isEditMode: boolean;
  isAnyNodeEditing: boolean;
  hasSelectedNodes: boolean;
  onDeleteKey?: () => void;
  onEscapeKey?: () => void;
}

/**
 * Creates a keyboard event handler with the specified options.
 * 
 * @param options - Handler options
 * @returns Keyboard event handler function
 */
function createKeyboardHandler(options: KeyboardHandlerOptions) {
  const { isEditMode, isAnyNodeEditing, hasSelectedNodes, onDeleteKey, onEscapeKey } = options;

  return (event: KeyboardEvent) => {
    // Don't handle keyboard shortcuts while editing text
    if (isAnyNodeEditing) {
      return;
    }

    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        // Only handle delete in edit mode with selected nodes
        if (isEditMode && hasSelectedNodes && onDeleteKey) {
          event.preventDefault();
          onDeleteKey();
        }
        break;

      case 'Escape':
        if (onEscapeKey) {
          onEscapeKey();
        }
        break;
    }
  };
}

/**
 * Custom hook for managing mindmap event listeners.
 * 
 * @param options - Hook configuration options
 */
export function useMindmapEvents(options: UseMindmapEventsOptions): void {
  const {
    isMobile,
    isEditMode,
    isAnyNodeEditing,
    selectedNodes,
    connectionMode,
    handlers,
    onDeleteKey,
    onEscapeKey,
  } = options;

  // Use ref to store connection mode for event handlers
  const connectionModeRef = useRef(connectionMode);
  connectionModeRef.current = connectionMode;

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = createKeyboardHandler({
      isEditMode,
      isAnyNodeEditing,
      hasSelectedNodes: selectedNodes.length > 0,
      onDeleteKey,
      onEscapeKey,
    });

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEditMode, isAnyNodeEditing, selectedNodes.length, onDeleteKey, onEscapeKey]);

  // Node change event listener
  useEffect(() => {
    if (!handlers.onNodeChanged) return;

    const handleNodeChanged = () => {
      handlers.onNodeChanged?.();
    };

    window.addEventListener('nodeChanged', handleNodeChanged);

    return () => {
      window.removeEventListener('nodeChanged', handleNodeChanged);
    };
  }, [handlers.onNodeChanged]);

  // Long press event listeners
  useEffect(() => {
    if (!handlers.onLongPressStart && !handlers.onLongPressEnd) return;

    const handleLongPressStart = () => {
      handlers.onLongPressStart?.();
    };

    const handleLongPressEnd = () => {
      handlers.onLongPressEnd?.();
    };

    window.addEventListener('longPressStart', handleLongPressStart);
    window.addEventListener('longPressEnd', handleLongPressEnd);

    return () => {
      window.removeEventListener('longPressStart', handleLongPressStart);
      window.removeEventListener('longPressEnd', handleLongPressEnd);
    };
  }, [handlers.onLongPressStart, handlers.onLongPressEnd]);

  // Mobile-specific event listeners
  useEffect(() => {
    if (!isMobile) return;

    // Show mobile bottom menu
    const handleShowMobileBottomMenu = (event: Event) => {
      const customEvent = event as CustomEvent<{ nodeId: string; nodeName: string }>;
      handlers.onShowMobileBottomMenu?.(
        customEvent.detail.nodeId,
        customEvent.detail.nodeName
      );
    };

    // Start mobile connection
    const handleStartMobileConnection = (event: Event) => {
      const customEvent = event as CustomEvent<{ sourceNodeId: string; sourceHandleId?: string }>;
      handlers.onStartMobileConnection?.(
        customEvent.detail.sourceNodeId,
        customEvent.detail.sourceHandleId
      );
    };

    // Get connection mode state
    const handleGetConnectionModeState = () => {
      const state = handlers.onGetConnectionModeState?.() || connectionModeRef.current;
      const stateEvent = new CustomEvent('connectionModeStateResponse', {
        detail: {
          isActive: state.isActive,
          sourceNodeId: state.sourceNodeId,
          sourceHandleId: state.sourceHandleId,
        },
      });
      window.dispatchEvent(stateEvent);
    };

    // Execute connection
    const handleExecuteConnection = (event: Event) => {
      const customEvent = event as CustomEvent<{ targetNodeId: string }>;
      handlers.onExecuteConnection?.(customEvent.detail.targetNodeId);
    };

    // Touch end on pane
    const handleTouchEndOnPane = (event: Event) => {
      const customEvent = event as CustomEvent<{
        clientX: number;
        clientY: number;
        sourceNodeId: string;
        sourceHandleId?: string;
      }>;
      handlers.onTouchEndOnPane?.(
        customEvent.detail.clientX,
        customEvent.detail.clientY,
        customEvent.detail.sourceNodeId,
        customEvent.detail.sourceHandleId
      );
    };

    // Register all mobile event listeners
    window.addEventListener('showMobileBottomMenu', handleShowMobileBottomMenu);
    window.addEventListener('startMobileConnection', handleStartMobileConnection);
    window.addEventListener('getConnectionModeState', handleGetConnectionModeState);
    window.addEventListener('executeConnection', handleExecuteConnection);
    window.addEventListener('handleTouchEndOnPane', handleTouchEndOnPane);

    return () => {
      window.removeEventListener('showMobileBottomMenu', handleShowMobileBottomMenu);
      window.removeEventListener('startMobileConnection', handleStartMobileConnection);
      window.removeEventListener('getConnectionModeState', handleGetConnectionModeState);
      window.removeEventListener('executeConnection', handleExecuteConnection);
      window.removeEventListener('handleTouchEndOnPane', handleTouchEndOnPane);
    };
  }, [isMobile, handlers]);
}

export default useMindmapEvents;
