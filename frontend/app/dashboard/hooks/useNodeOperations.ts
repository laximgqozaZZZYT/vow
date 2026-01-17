/**
 * useNodeOperations Hook
 * 
 * Provides CRUD operations for mindmap nodes with proper state management.
 * Handles node creation, updates, deletion, and type changes.
 * 
 * @example
 * const {
 *   createNode,
 *   updateNode,
 *   deleteNode,
 *   deleteSelectedNodes,
 *   setNodeType,
 *   setNodeEditing
 * } = useNodeOperations({ nodes, setNodes, edges, setEdges, ... });
 */

import { useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import { CustomNodeData } from '../types/mindmap.types';
import {
  createNodeAtPosition,
  updateNodeInArray,
  setNodeEditing as setNodeEditingUtil,
  clearAllEditing,
  removeNodesByIds,
  type NodeType,
  type Position,
  type UpdateNodeParams,
} from '../../../lib/mindmap';
import {
  removeEdgesByNodes,
  updateEdgeStylesBySource,
} from '../../../lib/mindmap';

/** Hook configuration options */
export interface UseNodeOperationsOptions {
  /** Current nodes in the mindmap */
  nodes: Node<CustomNodeData>[];
  /** Function to update nodes */
  setNodes: React.Dispatch<React.SetStateAction<Node<CustomNodeData>[]>>;
  /** Current edges in the mindmap */
  edges: Edge[];
  /** Function to update edges */
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  /** Callback when changes are made */
  onChangesMade?: () => void;
  /** Whether edit mode is active */
  isEditMode?: boolean;
}

/** Node creation options */
export interface CreateNodeOptions {
  position: Position;
  label?: string;
  nodeType?: NodeType;
  habitId?: string;
  goalId?: string;
  startEditing?: boolean;
}

/** Return type for the hook */
export interface UseNodeOperationsReturn {
  /** Create a new node */
  createNode: (options: CreateNodeOptions) => Node<CustomNodeData>;
  /** Update a node's properties */
  updateNode: (nodeId: string, updates: UpdateNodeParams) => void;
  /** Delete a single node */
  deleteNode: (nodeId: string) => void;
  /** Delete multiple nodes */
  deleteNodes: (nodeIds: string[]) => void;
  /** Delete selected nodes */
  deleteSelectedNodes: (selectedNodes: Node<CustomNodeData>[]) => void;
  /** Set a node's type (default, habit, goal) */
  setNodeType: (nodeId: string, nodeType: NodeType, entityId?: string) => void;
  /** Set a node to editing mode */
  setNodeEditing: (nodeId: string) => void;
  /** Clear editing mode from all nodes */
  clearEditing: () => void;
}

/**
 * Custom hook for managing node operations in the mindmap.
 * 
 * @param options - Hook configuration options
 * @returns Node operation functions
 */
export function useNodeOperations(options: UseNodeOperationsOptions): UseNodeOperationsReturn {
  const {
    nodes,
    setNodes,
    edges,
    setEdges,
    onChangesMade,
    isEditMode = true,
  } = options;

  /**
   * Creates a new node at the specified position.
   * 
   * @param options - Node creation options
   * @returns The created node
   */
  const createNode = useCallback((createOptions: CreateNodeOptions): Node<CustomNodeData> => {
    if (!isEditMode) {
      throw new Error('Cannot create node in view mode');
    }

    const {
      position,
      label = 'New Node',
      nodeType = 'default',
      habitId,
      goalId,
      startEditing = false,
    } = createOptions;

    const newNode = createNodeAtPosition({
      position,
      label,
      nodeType,
      habitId,
      goalId,
    });

    // If startEditing is true, set the node to editing mode
    if (startEditing) {
      newNode.data.isEditing = true;
    }

    setNodes((nds) => {
      // Clear editing from other nodes if this one starts editing
      const updatedNodes = startEditing ? clearAllEditing(nds) : nds;
      return [...updatedNodes, newNode];
    });

    if (onChangesMade) {
      onChangesMade();
    }

    return newNode;
  }, [isEditMode, setNodes, onChangesMade]);

  /**
   * Updates a node's properties.
   * 
   * @param nodeId - ID of the node to update
   * @param updates - Properties to update
   */
  const updateNode = useCallback((nodeId: string, updates: UpdateNodeParams) => {
    setNodes((nds) => updateNodeInArray(nds, nodeId, updates));

    if (onChangesMade) {
      onChangesMade();
    }
  }, [setNodes, onChangesMade]);

  /**
   * Deletes a single node and its connected edges.
   * 
   * @param nodeId - ID of the node to delete
   */
  const deleteNode = useCallback((nodeId: string) => {
    if (!isEditMode) return;

    setNodes((nds) => removeNodesByIds(nds, [nodeId]));
    setEdges((eds) => removeEdgesByNodes([nodeId], eds));

    if (onChangesMade) {
      onChangesMade();
    }
  }, [isEditMode, setNodes, setEdges, onChangesMade]);

  /**
   * Deletes multiple nodes and their connected edges.
   * 
   * @param nodeIds - IDs of the nodes to delete
   */
  const deleteNodes = useCallback((nodeIds: string[]) => {
    if (!isEditMode || nodeIds.length === 0) return;

    setNodes((nds) => removeNodesByIds(nds, nodeIds));
    setEdges((eds) => removeEdgesByNodes(nodeIds, eds));

    if (onChangesMade) {
      onChangesMade();
    }
  }, [isEditMode, setNodes, setEdges, onChangesMade]);

  /**
   * Deletes selected nodes.
   * 
   * @param selectedNodes - Array of selected nodes
   */
  const deleteSelectedNodes = useCallback((selectedNodes: Node<CustomNodeData>[]) => {
    if (!isEditMode || selectedNodes.length === 0) return;

    const nodeIds = selectedNodes.map((node) => node.id);
    deleteNodes(nodeIds);
  }, [isEditMode, deleteNodes]);

  /**
   * Sets a node's type and updates connected edges.
   * 
   * @param nodeId - ID of the node
   * @param nodeType - New node type
   * @param entityId - Optional habit or goal ID
   */
  const setNodeType = useCallback((
    nodeId: string,
    nodeType: NodeType,
    entityId?: string
  ) => {
    // Update the node
    const updates: UpdateNodeParams = { nodeType };
    
    if (nodeType === 'habit' && entityId) {
      updates.habitId = entityId;
    } else if (nodeType === 'goal' && entityId) {
      updates.goalId = entityId;
    }

    setNodes((nds) => updateNodeInArray(nds, nodeId, updates));

    // Update connected edges to reflect the new node type
    setEdges((eds) => updateEdgeStylesBySource(nodeId, nodeType, eds));

    if (onChangesMade) {
      onChangesMade();
    }
  }, [setNodes, setEdges, onChangesMade]);

  /**
   * Sets a node to editing mode and clears editing from other nodes.
   * 
   * @param nodeId - ID of the node to edit
   */
  const setNodeEditingFn = useCallback((nodeId: string) => {
    setNodes((nds) => setNodeEditingUtil(nds, nodeId));
  }, [setNodes]);

  /**
   * Clears editing mode from all nodes.
   */
  const clearEditing = useCallback(() => {
    setNodes((nds) => clearAllEditing(nds));
  }, [setNodes]);

  return {
    createNode,
    updateNode,
    deleteNode,
    deleteNodes,
    deleteSelectedNodes,
    setNodeType,
    setNodeEditing: setNodeEditingFn,
    clearEditing,
  };
}

export default useNodeOperations;
