/**
 * useConnectionHandlers Hook
 * 
 * Handles all connection-related events for the mindmap.
 * Extracts connection logic from the main component for better maintainability.
 */

import { useCallback, RefObject } from 'react';
import { Connection, Edge, Node, addEdge } from 'reactflow';
import { getEdgeStyle } from '../../../lib/mindmap.utils';
import {
  createEdge,
  validateGoalConnection,
  constrainPositionToViewport,
  type NodeType,
} from '../../../lib/mindmap';
import type { Goal, Habit } from '../types';

/** Connection mode state */
interface ConnectionModeState {
  isActive: boolean;
  sourceNodeId: string | null;
  sourceHandleId: string | null;
}

/** Props for the hook */
interface UseConnectionHandlersProps {
  /** All nodes in the mindmap */
  nodes: Node[];
  /** All edges in the mindmap */
  edges: Edge[];
  /** Setter for edges */
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  /** Current connection mode state */
  connectionMode: ConnectionModeState;
  /** Start a new connection */
  startConnection: (nodeId: string, handleId?: string) => void;
  /** End the current connection */
  endConnection: () => void;
  /** Whether connection is active */
  isConnectionActive: boolean;
  /** Execute connection to target node */
  executeConnection: (targetNodeId: string) => void;
  /** Create a new node */
  createNode: (params: { position: { x: number; y: number }; startEditing: boolean }) => Node;
  /** Set node to editing mode */
  setNodeEditing: (nodeId: string) => void;
  /** Open goal modal */
  openGoalModal: (nodeId: string, nodeName: string, options?: { parentGoalId?: string }) => void;
  /** Open habit modal */
  openHabitModal: (nodeId: string, nodeName: string, options?: { relatedHabitIds?: string[] }) => void;
  /** Show toast message */
  showToast: (config: { message: string; duration?: number }) => void;
  /** Mark changes as unsaved */
  markChanges: () => void;
  /** All goals */
  goals: Array<{ id: string; name: string }>;
  /** All habits */
  habits: Array<{ id: string; name: string }> | undefined;
  /** Whether device is mobile */
  isMobile: boolean;
  /** React Flow project function */
  project: (position: { x: number; y: number }) => { x: number; y: number };
  /** Get current viewport */
  getViewport: () => { x: number; y: number; zoom: number };
  /** Reference to the ReactFlow wrapper element */
  reactFlowWrapper: RefObject<HTMLDivElement | null>;
}

/** Return type for the hook */
interface UseConnectionHandlersReturn {
  /** Handle connection creation */
  onConnect: (params: Connection) => void;
  /** Handle connection start */
  onConnectStart: (event: React.MouseEvent | React.TouchEvent, params: { nodeId: string; handleId?: string }) => void;
  /** Handle connection end */
  onConnectEnd: (event: MouseEvent | TouchEvent) => void;
  /** Handle mobile node tap during connection mode */
  handleMobileNodeTap: (nodeId: string) => void;
  /** Handle pane click for mobile connection mode */
  handlePaneClick: (event: React.MouseEvent) => void;
}

/**
 * Custom hook for handling connection events.
 * 
 * @param props - Hook configuration
 * @returns Connection event handlers
 */
export function useConnectionHandlers({
  nodes,
  edges,
  setEdges,
  connectionMode,
  startConnection,
  endConnection,
  isConnectionActive,
  executeConnection,
  createNode,
  setNodeEditing,
  openGoalModal,
  openHabitModal,
  showToast,
  markChanges,
  goals,
  habits,
  isMobile,
  project,
  getViewport,
  reactFlowWrapper,
}: UseConnectionHandlersProps): UseConnectionHandlersReturn {
  
  /**
   * Handles connection creation between two existing nodes.
   */
  const onConnect = useCallback((params: Connection) => {
    const sourceNode = nodes.find(n => n.id === params.source);
    const nodeType: NodeType = sourceNode?.data.nodeType || 'default';

    // Validate goal connections
    if (nodeType === 'goal' && params.target) {
      const validation = validateGoalConnection(params.target, edges, nodes);
      if (!validation.valid) {
        showToast({ message: validation.message || 'Connection not allowed', duration: 2000 });
        return;
      }
    }

    const edgeStyle = getEdgeStyle(nodeType);
    const newEdge = {
      ...params,
      style: edgeStyle,
      animated: false,
      data: { sourceNodeType: nodeType },
    };

    setEdges((eds) => addEdge(newEdge, eds));
    markChanges();
  }, [nodes, edges, setEdges, markChanges, showToast]);

  /**
   * Handles connection start event.
   */
  const onConnectStart = useCallback(
    (_event: React.MouseEvent | React.TouchEvent, { nodeId, handleId }: { nodeId: string; handleId?: string }) => {
      startConnection(nodeId, handleId);
    },
    [startConnection]
  );

  /**
   * Creates a new node and edge when connection is dropped on empty space.
   */
  const createNodeFromConnection = useCallback((
    position: { x: number; y: number },
    sourceNodeId: string,
    sourceHandleId: string | null
  ) => {
    // Create new node
    const newNode = createNode({
      position,
      startEditing: false,
    });

    // Get source node info
    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    const nodeType: NodeType = sourceNode?.data.nodeType || 'default';

    // Create edge
    const newEdge = createEdge({
      sourceId: sourceNodeId,
      targetId: newNode.id,
      sourceNodeType: nodeType,
      sourceHandle: sourceHandleId,
    });

    setEdges((eds) => [...eds, newEdge]);

    // Open modal based on source node type
    if (nodeType === 'goal') {
      const sourceGoalId = (sourceNode?.data as any)?.goalId ||
        goals.find(g => g.name === sourceNode?.data.label)?.id;
      openGoalModal(newNode.id, 'New Goal', { parentGoalId: sourceGoalId });
    } else if (nodeType === 'habit') {
      const sourceHabitId = (sourceNode?.data as any)?.habitId ||
        habits?.find(h => h.name === sourceNode?.data.label)?.id;
      openHabitModal(newNode.id, 'New Habit', { relatedHabitIds: sourceHabitId ? [sourceHabitId] : undefined });
    } else {
      // Set to editing mode for default nodes
      setTimeout(() => setNodeEditing(newNode.id), 100);
    }

    return newNode;
  }, [nodes, createNode, setEdges, goals, habits, openGoalModal, openHabitModal, setNodeEditing]);

  /**
   * Handles connection end - creates new node if dropped on empty space.
   */
  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    if (!connectionMode.sourceNodeId) return;

    const target = event.target as Element;
    const targetIsPane = target?.classList.contains('react-flow__pane');

    if (targetIsPane && reactFlowWrapper.current) {
      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const clientX = 'clientX' in event ? event.clientX : event.touches[0].clientX;
      const clientY = 'clientY' in event ? event.clientY : event.touches[0].clientY;

      let position = project({
        x: clientX - reactFlowBounds.left,
        y: clientY - reactFlowBounds.top,
      });

      // Constrain position on mobile
      if (isMobile) {
        const viewport = getViewport();
        position = constrainPositionToViewport(position, viewport, 100);
      }

      createNodeFromConnection(
        position,
        connectionMode.sourceNodeId,
        connectionMode.sourceHandleId
      );
    }

    endConnection();
  }, [
    connectionMode,
    project,
    isMobile,
    getViewport,
    createNodeFromConnection,
    endConnection,
    reactFlowWrapper,
  ]);

  /**
   * Handles mobile node tap for connection mode.
   */
  const handleMobileNodeTap = useCallback((nodeId: string) => {
    if (!isConnectionActive) return;
    executeConnection(nodeId);
  }, [isConnectionActive, executeConnection]);

  /**
   * Handles pane click for mobile connection mode.
   */
  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    if (!isMobile || !isConnectionActive || !reactFlowWrapper.current) return;

    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    let position = project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });

    const viewport = getViewport();
    position = constrainPositionToViewport(position, viewport, 100);

    createNodeFromConnection(
      position,
      connectionMode.sourceNodeId!,
      connectionMode.sourceHandleId
    );

    endConnection();
  }, [
    isMobile,
    isConnectionActive,
    project,
    getViewport,
    createNodeFromConnection,
    connectionMode,
    endConnection,
    reactFlowWrapper,
  ]);

  return {
    onConnect,
    onConnectStart,
    onConnectEnd,
    handleMobileNodeTap,
    handlePaneClick,
  };
}
