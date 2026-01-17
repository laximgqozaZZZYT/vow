/**
 * useMobileInteractions Hook
 * 
 * Manages mobile-specific interactions for the mindmap, including:
 * - Bottom menu for node actions
 * - Touch event handling
 * - Mobile-specific gestures
 * 
 * @example
 * const {
 *   mobileBottomMenu,
 *   showBottomMenu,
 *   hideBottomMenu,
 *   handleMenuAction,
 *   isMobile
 * } = useMobileInteractions({ nodes, setNodes, setEdges, ... });
 */

import { useState, useCallback, useEffect } from 'react';
import { Node, Edge } from 'reactflow';
import { CustomNodeData, MobileBottomMenu, ConnectionMode, ModalState } from '../types/mindmap.types';
import { setNodeEditing, removeNodesByIds } from '../../../lib/mindmap';
import { removeEdgesByNodes } from '../../../lib/mindmap';

/** Initial mobile bottom menu state */
const INITIAL_MENU_STATE: MobileBottomMenu = {
  nodeId: '',
  nodeName: '',
  isVisible: false,
};

/** Menu action types */
export type MenuAction = 'edit' | 'connect' | 'habit' | 'goal' | 'delete';

/** Hook configuration options */
export interface UseMobileInteractionsOptions {
  /** Current nodes in the mindmap */
  nodes: Node<CustomNodeData>[];
  /** Function to update nodes */
  setNodes: React.Dispatch<React.SetStateAction<Node<CustomNodeData>[]>>;
  /** Current edges in the mindmap */
  edges: Edge[];
  /** Function to update edges */
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  /** Function to start connection mode */
  startConnection: (nodeId: string, handleId?: string | null) => void;
  /** Function to open modal */
  openModal: (type: 'habit' | 'goal', nodeId: string, nodeName: string) => void;
  /** Callback when changes are made */
  onChangesMade?: () => void;
  /** Whether edit mode is active */
  isEditMode?: boolean;
}

/** Return type for the hook */
export interface UseMobileInteractionsReturn {
  /** Current mobile bottom menu state */
  mobileBottomMenu: MobileBottomMenu;
  /** Show the bottom menu for a node */
  showBottomMenu: (nodeId: string, nodeName: string) => void;
  /** Hide the bottom menu */
  hideBottomMenu: () => void;
  /** Handle a menu action */
  handleMenuAction: (action: MenuAction) => void;
  /** Whether the device is mobile */
  isMobile: boolean;
  /** Set mobile bottom menu state directly */
  setMobileBottomMenu: React.Dispatch<React.SetStateAction<MobileBottomMenu>>;
}

/**
 * Detects if the current device is mobile.
 */
function detectMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768 ||
    'ontouchstart' in window
  );
}

/**
 * Custom hook for managing mobile interactions in the mindmap.
 * 
 * @param options - Hook configuration options
 * @returns Mobile interaction state and control functions
 */
export function useMobileInteractions(options: UseMobileInteractionsOptions): UseMobileInteractionsReturn {
  const {
    nodes,
    setNodes,
    edges,
    setEdges,
    startConnection,
    openModal,
    onChangesMade,
    isEditMode = true,
  } = options;

  const [mobileBottomMenu, setMobileBottomMenu] = useState<MobileBottomMenu>(INITIAL_MENU_STATE);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(detectMobileDevice());
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  /**
   * Shows the bottom menu for a specific node.
   * 
   * @param nodeId - ID of the node
   * @param nodeName - Name/label of the node
   */
  const showBottomMenu = useCallback((nodeId: string, nodeName: string) => {
    if (!isEditMode) return;
    
    setMobileBottomMenu({
      nodeId,
      nodeName,
      isVisible: true,
    });
  }, [isEditMode]);

  /**
   * Hides the bottom menu.
   */
  const hideBottomMenu = useCallback(() => {
    setMobileBottomMenu(INITIAL_MENU_STATE);
  }, []);

  /**
   * Handles a menu action for the currently selected node.
   * 
   * @param action - The action to perform
   */
  const handleMenuAction = useCallback((action: MenuAction) => {
    const { nodeId, nodeName } = mobileBottomMenu;
    const node = nodes.find((n) => n.id === nodeId);

    if (!node) {
      hideBottomMenu();
      return;
    }

    switch (action) {
      case 'edit':
        // Set node to editing mode
        setNodes((nds) => setNodeEditing(nds, nodeId));
        break;

      case 'connect':
        // Start connection mode
        startConnection(nodeId);
        break;

      case 'habit':
        // Open habit modal
        openModal('habit', nodeId, node.data.label);
        break;

      case 'goal':
        // Open goal modal
        openModal('goal', nodeId, node.data.label);
        break;

      case 'delete':
        // Delete the node and its edges
        setNodes((nds) => removeNodesByIds(nds, [nodeId]));
        setEdges((eds) => removeEdgesByNodes([nodeId], eds));
        if (onChangesMade) {
          onChangesMade();
        }
        break;
    }

    // Close the menu after action
    hideBottomMenu();
  }, [
    mobileBottomMenu,
    nodes,
    setNodes,
    setEdges,
    startConnection,
    openModal,
    onChangesMade,
    hideBottomMenu,
  ]);

  // Set up mobile event listeners
  useEffect(() => {
    if (!isMobile) return;

    /**
     * Handles the custom event to show mobile bottom menu.
     */
    const handleShowMobileBottomMenu = (event: Event) => {
      const customEvent = event as CustomEvent<{ nodeId: string; nodeName: string }>;
      const { nodeId, nodeName } = customEvent.detail;
      showBottomMenu(nodeId, nodeName);
    };

    window.addEventListener('showMobileBottomMenu', handleShowMobileBottomMenu);

    return () => {
      window.removeEventListener('showMobileBottomMenu', handleShowMobileBottomMenu);
    };
  }, [isMobile, showBottomMenu]);

  return {
    mobileBottomMenu,
    showBottomMenu,
    hideBottomMenu,
    handleMenuAction,
    isMobile,
    setMobileBottomMenu,
  };
}

export default useMobileInteractions;
