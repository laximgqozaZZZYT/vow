/**
 * Mindmap Utilities
 * 
 * This module exports all mindmap-related utility functions.
 * Import from this file for a clean API.
 * 
 * @example
 * import { createNodeAtPosition, createEdge, validateMindmapData } from '@/lib/mindmap';
 */

// Node operations
export {
  createNodeAtPosition,
  updateNodeProperties,
  updateNodeInArray,
  setNodeEditing,
  clearAllEditing,
  findNodeById,
  validateGoalConnection as validateGoalConnectionForNode,
  validateNodeData,
  isAnyNodeEditing,
  filterNodesByType,
  removeNodesByIds,
  type NodeType,
  type Position,
  type CreateNodeParams,
  type UpdateNodeParams,
  type ValidationResult as NodeValidationResult,
} from './node-operations';

// Edge operations
export {
  getEdgeStyleByNodeType,
  createEdge,
  getEdgesByNode,
  getOutgoingEdges,
  getIncomingEdges,
  removeEdgesByNodes,
  removeEdgeById,
  updateEdgeStylesBySource,
  edgeExists,
  countEdgesByType,
  getGoalEdges,
  getHabitEdges,
  EDGE_COLORS,
  type EdgeStyle,
  type EdgeData,
  type CreateEdgeParams,
} from './edge-operations';

// Position utilities
export {
  calculateCenterPosition,
  calculateViewportBounds,
  constrainPositionToBounds,
  constrainPositionToViewport,
  clientToFlowPosition,
  calculateNewNodePosition,
  isPositionVisible,
  calculateDistance,
  calculateMidpoint,
  type Viewport,
  type Bounds,
  type ScreenDimensions,
} from './position-utils';

// Validation utilities
export {
  validateNodeLabel,
  validateNodeType,
  validatePosition,
  validateNode,
  validateEdge,
  validateMindmapData,
  validateSerializedNode,
  validateSerializedEdge,
  validateGoalConnection,
  type ValidationResult,
  type MindmapData,
  type SerializedNode,
  type SerializedEdge,
} from './validation';
