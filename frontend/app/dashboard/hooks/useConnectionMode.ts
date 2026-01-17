/**
 * useConnectionMode Hook
 * 
 * Manages the connection mode state for creating edges between nodes.
 * Handles both desktop drag-and-drop and mobile tap-to-connect interactions.
 * 
 * @example
 * const {
 *   connectionMode,
 *   startConnection,
 *   endConnection,
 *   executeConnection,
 *   isConnectionActive
 * } = useConnectionMode({ nodes, edges, setEdges, goals, onShowToast });
 */

import { useState, useCallback, useMemo } from 'react';
import { Node, Edge } from 'reactflow';
import { CustomNodeData, ConnectionMode } from '../types/mindmap.types';
import { 
  createEdge, 
  validateGoalConnection,
  type NodeType 
} from '../../../lib/mindmap';

/** Initial connection mode state */
const INITIAL_CONNECTION_MODE: ConnectionMode = {
  isActive: false,
  sourceNodeId: null,
  sourceHandleId: null,
};

/** Toast message configuration */
interface ToastConfig {
  message: string;
  duration?: number;
}

/** Hook configuration options */
export interface UseConnectionModeOptions {
  /** Current nodes in the mindmap */
  nodes: Node<CustomNodeData>[];
  /** Current edges in the mindmap */
  edges: Edge[];
  /** Function to update edges */
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  /** Goals for validation */
  goals?: { id: string; name: string }[];
  /** Callback to show toast messages */
  onShowToast?: (config: ToastConfig) => void;
  /** Callback when changes are made */
  onChangesMade?: () => void;
}

/** Return type for the hook */
export interface UseConnectionModeReturn {
  /** Current connection mode state */
  connectionMode: ConnectionMode;
  /** Start a new connection from a node */
  startConnection: (nodeId: string, handleId?: string | null) => void;
  /** End/cancel the current connection */
  endConnection: () => void;
  /** Execute a connection to a target node */
  executeConnection: (targetNodeId: string) => boolean;
  /** Check if connection mode is active */
  isConnectionActive: boolean;
  /** Get the source node of the current connection */
  sourceNode: Node<CustomNodeData> | undefined;
  /** Set connection mode directly (for external control) */
  setConnectionMode: React.Dispatch<React.SetStateAction<ConnectionMode>>;
}

/**
 * Custom hook for managing connection mode in the mindmap.
 * 
 * @param options - Hook configuration options
 * @returns Connection mode state and control functions
 */
export function useConnectionMode(options: UseConnectionModeOptions): UseConnectionModeReturn {
  const { 
    nodes, 
    edges, 
    setEdges, 
    goals = [], 
    onShowToast,
    onChangesMade,
  } = options;

  const [connectionMode, setConnectionMode] = useState<ConnectionMode>(INITIAL_CONNECTION_MODE);

  /**
   * Gets the source node of the current connection.
   */
  const sourceNode = useMemo(() => {
    if (!connectionMode.sourceNodeId) return undefined;
    return nodes.find((n) => n.id === connectionMode.sourceNodeId);
  }, [nodes, connectionMode.sourceNodeId]);

  /**
   * Starts a new connection from a node.
   * 
   * @param nodeId - ID of the source node
   * @param handleId - Optional handle ID for the connection
   */
  const startConnection = useCallback((nodeId: string, handleId?: string | null) => {
    setConnectionMode({
      isActive: true,
      sourceNodeId: nodeId,
      sourceHandleId: handleId ?? null,
    });
  }, []);

  /**
   * Ends/cancels the current connection.
   */
  const endConnection = useCallback(() => {
    setConnectionMode(INITIAL_CONNECTION_MODE);
  }, []);

  /**
   * Executes a connection to a target node.
   * Validates the connection and creates the edge if valid.
   * 
   * @param targetNodeId - ID of the target node
   * @returns True if the connection was successful
   */
  const executeConnection = useCallback((targetNodeId: string): boolean => {
    if (!connectionMode.isActive || !connectionMode.sourceNodeId) {
      return false;
    }

    // Don't connect to self
    if (connectionMode.sourceNodeId === targetNodeId) {
      endConnection();
      return false;
    }

    const sourceNodeData = sourceNode;
    const nodeType: NodeType = sourceNodeData?.data.nodeType || 'default';

    // Validate goal connections
    if (nodeType === 'goal') {
      const validation = validateGoalConnection(targetNodeId, edges, nodes);
      if (!validation.valid) {
        if (onShowToast && validation.message) {
          onShowToast({ message: validation.message, duration: 2000 });
        }
        endConnection();
        return false;
      }
    }

    // Create the new edge
    const newEdge = createEdge({
      sourceId: connectionMode.sourceNodeId,
      targetId: targetNodeId,
      sourceNodeType: nodeType,
      sourceHandle: connectionMode.sourceHandleId,
    });

    setEdges((eds) => [...eds, newEdge]);
    
    if (onChangesMade) {
      onChangesMade();
    }

    endConnection();
    return true;
  }, [
    connectionMode,
    sourceNode,
    edges,
    nodes,
    setEdges,
    onShowToast,
    onChangesMade,
    endConnection,
  ]);

  return {
    connectionMode,
    startConnection,
    endConnection,
    executeConnection,
    isConnectionActive: connectionMode.isActive,
    sourceNode,
    setConnectionMode,
  };
}

export default useConnectionMode;
