/**
 * Node Operations Utility Functions
 * 
 * This module provides pure functions for creating, updating, and validating mindmap nodes.
 * All functions are designed to be side-effect free and easily testable.
 */

import { Node, Edge } from 'reactflow';
import { CustomNodeData } from '../../app/dashboard/types/mindmap.types';

/** Node type options */
export type NodeType = 'default' | 'habit' | 'goal';

/** Position coordinates */
export interface Position {
  x: number;
  y: number;
}

/** Node creation parameters */
export interface CreateNodeParams {
  position: Position;
  label?: string;
  nodeType?: NodeType;
  habitId?: string;
  goalId?: string;
}

/** Node update parameters */
export interface UpdateNodeParams {
  label?: string;
  isEditing?: boolean;
  nodeType?: NodeType;
  habitId?: string;
  goalId?: string;
}

/** Validation result */
export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Creates a new mindmap node at the specified position.
 * 
 * @param params - Node creation parameters
 * @returns A new React Flow node
 * 
 * @example
 * const node = createNodeAtPosition({
 *   position: { x: 100, y: 200 },
 *   label: 'My Node',
 *   nodeType: 'habit'
 * });
 */
export function createNodeAtPosition(params: CreateNodeParams): Node<CustomNodeData> {
  const {
    position,
    label = 'New Node',
    nodeType = 'default',
    habitId,
    goalId,
  } = params;

  const nodeId = `node-${Date.now()}`;

  return {
    id: nodeId,
    position: { x: position.x, y: position.y },
    data: {
      label,
      isEditing: false,
      nodeType,
      ...(habitId && { habitId }),
      ...(goalId && { goalId }),
    },
    type: 'mindmapNode',
  };
}

/**
 * Updates node properties immutably.
 * 
 * @param node - The node to update
 * @param updates - Properties to update
 * @returns A new node with updated properties
 * 
 * @example
 * const updatedNode = updateNodeProperties(node, { label: 'Updated Label' });
 */
export function updateNodeProperties(
  node: Node<CustomNodeData>,
  updates: UpdateNodeParams
): Node<CustomNodeData> {
  return {
    ...node,
    data: {
      ...node.data,
      ...updates,
    },
  };
}

/**
 * Updates a specific node in an array of nodes.
 * 
 * @param nodes - Array of nodes
 * @param nodeId - ID of the node to update
 * @param updates - Properties to update
 * @returns New array with the updated node
 */
export function updateNodeInArray(
  nodes: Node<CustomNodeData>[],
  nodeId: string,
  updates: UpdateNodeParams
): Node<CustomNodeData>[] {
  return nodes.map((node) =>
    node.id === nodeId ? updateNodeProperties(node, updates) : node
  );
}

/**
 * Sets a node to editing mode and clears editing from all other nodes.
 * 
 * @param nodes - Array of nodes
 * @param nodeId - ID of the node to set to editing mode
 * @returns New array with updated editing states
 */
export function setNodeEditing(
  nodes: Node<CustomNodeData>[],
  nodeId: string
): Node<CustomNodeData>[] {
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      isEditing: node.id === nodeId,
    },
  }));
}

/**
 * Clears editing mode from all nodes.
 * 
 * @param nodes - Array of nodes
 * @returns New array with all nodes not in editing mode
 */
export function clearAllEditing(
  nodes: Node<CustomNodeData>[]
): Node<CustomNodeData>[] {
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      isEditing: false,
    },
  }));
}

/**
 * Finds a node by ID.
 * 
 * @param nodes - Array of nodes
 * @param nodeId - ID of the node to find
 * @returns The found node or undefined
 */
export function findNodeById(
  nodes: Node<CustomNodeData>[],
  nodeId: string
): Node<CustomNodeData> | undefined {
  return nodes.find((node) => node.id === nodeId);
}

/**
 * Validates if a goal connection is allowed.
 * A node can only have one goal connection.
 * 
 * @param targetNodeId - ID of the target node
 * @param edges - Current edges
 * @param nodes - Current nodes
 * @returns Validation result with message if invalid
 */
export function validateGoalConnection(
  targetNodeId: string,
  edges: Edge[],
  nodes: Node<CustomNodeData>[]
): ValidationResult {
  // Check if target node already has a goal connection
  const hasGoalConnection = edges.some((edge) => {
    // Check if target is already connected to a goal as target
    if (edge.target === targetNodeId && edge.data?.sourceNodeType === 'goal') {
      return true;
    }
    // Check if target is already connected to a goal as source
    if (edge.source === targetNodeId) {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (sourceNode?.data.nodeType === 'goal') {
        return true;
      }
    }
    return false;
  });

  if (hasGoalConnection) {
    return {
      valid: false,
      message: 'このノードは既に別のGoalと結線されています',
    };
  }

  return { valid: true };
}

/**
 * Validates node data structure.
 * 
 * @param data - Data to validate
 * @returns Validated CustomNodeData or null if invalid
 */
export function validateNodeData(data: unknown): CustomNodeData | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Label is required and must be a string
  if (typeof obj.label !== 'string') {
    return null;
  }

  // Validate nodeType if present
  const validNodeTypes: NodeType[] = ['default', 'habit', 'goal'];
  if (obj.nodeType !== undefined && !validNodeTypes.includes(obj.nodeType as NodeType)) {
    return null;
  }

  return {
    label: obj.label,
    isEditing: typeof obj.isEditing === 'boolean' ? obj.isEditing : false,
    nodeType: (obj.nodeType as NodeType) || 'default',
    ...(typeof obj.habitId === 'string' && { habitId: obj.habitId }),
    ...(typeof obj.goalId === 'string' && { goalId: obj.goalId }),
  };
}

/**
 * Checks if any node is currently in editing mode.
 * 
 * @param nodes - Array of nodes
 * @returns True if any node is being edited
 */
export function isAnyNodeEditing(nodes: Node<CustomNodeData>[]): boolean {
  return nodes.some((node) => node.data.isEditing);
}

/**
 * Filters nodes by type.
 * 
 * @param nodes - Array of nodes
 * @param nodeType - Type to filter by
 * @returns Filtered array of nodes
 */
export function filterNodesByType(
  nodes: Node<CustomNodeData>[],
  nodeType: NodeType
): Node<CustomNodeData>[] {
  return nodes.filter((node) => node.data.nodeType === nodeType);
}

/**
 * Removes nodes by IDs.
 * 
 * @param nodes - Array of nodes
 * @param nodeIds - IDs of nodes to remove
 * @returns New array without the specified nodes
 */
export function removeNodesByIds(
  nodes: Node<CustomNodeData>[],
  nodeIds: string[]
): Node<CustomNodeData>[] {
  const idsSet = new Set(nodeIds);
  return nodes.filter((node) => !idsSet.has(node.id));
}
