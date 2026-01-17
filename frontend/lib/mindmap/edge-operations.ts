/**
 * Edge Operations Utility Functions
 * 
 * This module provides pure functions for creating, querying, and managing mindmap edges.
 * All functions are designed to be side-effect free and easily testable.
 */

import { Edge } from 'reactflow';
import { NodeType } from './node-operations';

/** Edge style configuration */
export interface EdgeStyle {
  stroke: string;
  strokeWidth: number;
}

/** Edge data structure */
export interface EdgeData {
  sourceNodeType: NodeType;
}

/** Edge creation parameters */
export interface CreateEdgeParams {
  sourceId: string;
  targetId: string;
  sourceNodeType: NodeType;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/** Edge color constants */
export const EDGE_COLORS = {
  default: '#3b82f6', // blue-500
  habit: '#10b981',   // green-500
  goal: '#a855f7',    // purple-500
} as const;

/**
 * Gets the edge style based on the source node type.
 * 
 * @param nodeType - Type of the source node
 * @returns Edge style configuration
 * 
 * @example
 * const style = getEdgeStyleByNodeType('habit');
 * // Returns: { stroke: '#10b981', strokeWidth: 2 }
 */
export function getEdgeStyleByNodeType(nodeType: NodeType): EdgeStyle {
  const color = EDGE_COLORS[nodeType] || EDGE_COLORS.default;
  return {
    stroke: color,
    strokeWidth: 2,
  };
}

/**
 * Creates a new edge between two nodes.
 * 
 * @param params - Edge creation parameters
 * @returns A new React Flow edge
 * 
 * @example
 * const edge = createEdge({
 *   sourceId: 'node-1',
 *   targetId: 'node-2',
 *   sourceNodeType: 'habit'
 * });
 */
export function createEdge(params: CreateEdgeParams): Edge<EdgeData> {
  const {
    sourceId,
    targetId,
    sourceNodeType,
    sourceHandle = null,
    targetHandle = null,
  } = params;

  const style = getEdgeStyleByNodeType(sourceNodeType);

  return {
    id: `edge-${sourceId}-${targetId}`,
    source: sourceId,
    target: targetId,
    sourceHandle,
    targetHandle,
    style,
    data: { sourceNodeType },
  };
}

/**
 * Gets all edges connected to a specific node (as source or target).
 * 
 * @param nodeId - ID of the node
 * @param edges - Array of edges
 * @returns Array of edges connected to the node
 */
export function getEdgesByNode(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter(
    (edge) => edge.source === nodeId || edge.target === nodeId
  );
}

/**
 * Gets edges where the specified node is the source.
 * 
 * @param nodeId - ID of the source node
 * @param edges - Array of edges
 * @returns Array of edges from the node
 */
export function getOutgoingEdges(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter((edge) => edge.source === nodeId);
}

/**
 * Gets edges where the specified node is the target.
 * 
 * @param nodeId - ID of the target node
 * @param edges - Array of edges
 * @returns Array of edges to the node
 */
export function getIncomingEdges(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter((edge) => edge.target === nodeId);
}

/**
 * Removes all edges connected to specified nodes.
 * 
 * @param nodeIds - IDs of nodes whose edges should be removed
 * @param edges - Array of edges
 * @returns New array without edges connected to the specified nodes
 */
export function removeEdgesByNodes(nodeIds: string[], edges: Edge[]): Edge[] {
  const idsSet = new Set(nodeIds);
  return edges.filter(
    (edge) => !idsSet.has(edge.source) && !idsSet.has(edge.target)
  );
}

/**
 * Removes a specific edge by ID.
 * 
 * @param edgeId - ID of the edge to remove
 * @param edges - Array of edges
 * @returns New array without the specified edge
 */
export function removeEdgeById(edgeId: string, edges: Edge[]): Edge[] {
  return edges.filter((edge) => edge.id !== edgeId);
}

/**
 * Updates the style of edges from a specific source node.
 * Used when a node's type changes (e.g., becomes a habit or goal).
 * 
 * @param sourceNodeId - ID of the source node
 * @param newNodeType - New type of the source node
 * @param edges - Array of edges
 * @returns New array with updated edge styles
 */
export function updateEdgeStylesBySource(
  sourceNodeId: string,
  newNodeType: NodeType,
  edges: Edge[]
): Edge[] {
  const newStyle = getEdgeStyleByNodeType(newNodeType);

  return edges.map((edge) => {
    if (edge.source === sourceNodeId) {
      return {
        ...edge,
        style: newStyle,
        data: { ...edge.data, sourceNodeType: newNodeType },
      };
    }
    return edge;
  });
}

/**
 * Checks if an edge exists between two nodes.
 * 
 * @param sourceId - ID of the source node
 * @param targetId - ID of the target node
 * @param edges - Array of edges
 * @returns True if an edge exists between the nodes
 */
export function edgeExists(
  sourceId: string,
  targetId: string,
  edges: Edge[]
): boolean {
  return edges.some(
    (edge) => edge.source === sourceId && edge.target === targetId
  );
}

/**
 * Gets the count of edges by source node type.
 * 
 * @param edges - Array of edges
 * @returns Object with counts by node type
 */
export function countEdgesByType(edges: Edge[]): Record<NodeType, number> {
  const counts: Record<NodeType, number> = {
    default: 0,
    habit: 0,
    goal: 0,
  };

  edges.forEach((edge) => {
    const nodeType = (edge.data as EdgeData)?.sourceNodeType || 'default';
    counts[nodeType]++;
  });

  return counts;
}

/**
 * Finds edges that connect to goal-type nodes.
 * 
 * @param edges - Array of edges
 * @returns Array of edges from goal nodes
 */
export function getGoalEdges(edges: Edge[]): Edge[] {
  return edges.filter(
    (edge) => (edge.data as EdgeData)?.sourceNodeType === 'goal'
  );
}

/**
 * Finds edges that connect to habit-type nodes.
 * 
 * @param edges - Array of edges
 * @returns Array of edges from habit nodes
 */
export function getHabitEdges(edges: Edge[]): Edge[] {
  return edges.filter(
    (edge) => (edge.data as EdgeData)?.sourceNodeType === 'habit'
  );
}
