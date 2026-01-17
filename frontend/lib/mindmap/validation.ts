/**
 * Validation Utility Functions
 * 
 * This module provides validation functions for mindmap data structures.
 * All functions return detailed validation results with error messages.
 */

import { Node, Edge } from 'reactflow';
import { CustomNodeData } from '../../app/dashboard/types/mindmap.types';
import { NodeType } from './node-operations';

/** Validation result with optional error message */
export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/** Mindmap data structure for serialization */
export interface MindmapData {
  id?: string;
  name: string;
  nodes: SerializedNode[];
  edges: SerializedEdge[];
}

/** Serialized node structure */
export interface SerializedNode {
  id: string;
  label: string;
  x: number;
  y: number;
  nodeType: NodeType;
  habitId?: string;
  goalId?: string;
}

/** Serialized edge structure */
export interface SerializedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: {
    sourceNodeType?: NodeType;
  };
}

/**
 * Validates a node label.
 * 
 * @param label - Label to validate
 * @returns Validation result
 */
export function validateNodeLabel(label: unknown): ValidationResult {
  if (typeof label !== 'string') {
    return {
      valid: false,
      message: 'ノードのラベルは文字列である必要があります',
    };
  }

  if (label.trim().length === 0) {
    return {
      valid: false,
      message: 'ノードのラベルは空にできません',
    };
  }

  if (label.length > 200) {
    return {
      valid: false,
      message: 'ノードのラベルは200文字以内にしてください',
    };
  }

  return { valid: true };
}

/**
 * Validates a node type.
 * 
 * @param nodeType - Node type to validate
 * @returns Validation result
 */
export function validateNodeType(nodeType: unknown): ValidationResult {
  const validTypes: NodeType[] = ['default', 'habit', 'goal'];

  if (nodeType === undefined || nodeType === null) {
    return { valid: true }; // Default will be used
  }

  if (!validTypes.includes(nodeType as NodeType)) {
    return {
      valid: false,
      message: `無効なノードタイプです: ${nodeType}。有効な値: ${validTypes.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Validates a position object.
 * 
 * @param position - Position to validate
 * @returns Validation result
 */
export function validatePosition(position: unknown): ValidationResult {
  if (!position || typeof position !== 'object') {
    return {
      valid: false,
      message: '位置情報が無効です',
    };
  }

  const pos = position as Record<string, unknown>;

  if (typeof pos.x !== 'number' || typeof pos.y !== 'number') {
    return {
      valid: false,
      message: '位置のx, yは数値である必要があります',
    };
  }

  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
    return {
      valid: false,
      message: '位置の値が無効です（無限大またはNaN）',
    };
  }

  return { valid: true };
}

/**
 * Validates a complete node structure.
 * 
 * @param node - Node to validate
 * @returns Validation result
 */
export function validateNode(node: unknown): ValidationResult {
  if (!node || typeof node !== 'object') {
    return {
      valid: false,
      message: 'ノードデータが無効です',
    };
  }

  const n = node as Record<string, unknown>;

  // Validate ID
  if (typeof n.id !== 'string' || n.id.trim().length === 0) {
    return {
      valid: false,
      message: 'ノードIDが無効です',
    };
  }

  // Validate position
  const positionResult = validatePosition(n.position);
  if (!positionResult.valid) {
    return positionResult;
  }

  // Validate data
  if (!n.data || typeof n.data !== 'object') {
    return {
      valid: false,
      message: 'ノードデータが無効です',
    };
  }

  const data = n.data as Record<string, unknown>;

  // Validate label
  const labelResult = validateNodeLabel(data.label);
  if (!labelResult.valid) {
    return labelResult;
  }

  // Validate node type
  const typeResult = validateNodeType(data.nodeType);
  if (!typeResult.valid) {
    return typeResult;
  }

  return { valid: true };
}

/**
 * Validates an edge structure.
 * 
 * @param edge - Edge to validate
 * @param nodeIds - Set of valid node IDs
 * @returns Validation result
 */
export function validateEdge(edge: unknown, nodeIds: Set<string>): ValidationResult {
  if (!edge || typeof edge !== 'object') {
    return {
      valid: false,
      message: 'エッジデータが無効です',
    };
  }

  const e = edge as Record<string, unknown>;

  // Validate ID
  if (typeof e.id !== 'string' || e.id.trim().length === 0) {
    return {
      valid: false,
      message: 'エッジIDが無効です',
    };
  }

  // Validate source
  if (typeof e.source !== 'string') {
    return {
      valid: false,
      message: 'エッジのソースが無効です',
    };
  }

  if (!nodeIds.has(e.source)) {
    return {
      valid: false,
      message: `エッジのソースノードが存在しません: ${e.source}`,
    };
  }

  // Validate target
  if (typeof e.target !== 'string') {
    return {
      valid: false,
      message: 'エッジのターゲットが無効です',
    };
  }

  if (!nodeIds.has(e.target)) {
    return {
      valid: false,
      message: `エッジのターゲットノードが存在しません: ${e.target}`,
    };
  }

  // Self-loop check
  if (e.source === e.target) {
    return {
      valid: false,
      message: 'ノードは自分自身に接続できません',
    };
  }

  return { valid: true };
}

/**
 * Validates a complete mindmap data structure.
 * 
 * @param data - Mindmap data to validate
 * @returns Validation result
 */
export function validateMindmapData(data: unknown): ValidationResult {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      message: 'マインドマップデータが無効です',
    };
  }

  const mindmap = data as Record<string, unknown>;

  // Validate name
  if (typeof mindmap.name !== 'string' || mindmap.name.trim().length === 0) {
    return {
      valid: false,
      message: 'マインドマップ名が無効です',
    };
  }

  // Validate nodes array
  if (!Array.isArray(mindmap.nodes)) {
    return {
      valid: false,
      message: 'ノード配列が無効です',
    };
  }

  // Collect node IDs and validate each node
  const nodeIds = new Set<string>();
  for (const node of mindmap.nodes) {
    const nodeResult = validateSerializedNode(node);
    if (!nodeResult.valid) {
      return nodeResult;
    }
    const n = node as SerializedNode;
    if (nodeIds.has(n.id)) {
      return {
        valid: false,
        message: `重複したノードIDがあります: ${n.id}`,
      };
    }
    nodeIds.add(n.id);
  }

  // Validate edges array
  if (!Array.isArray(mindmap.edges)) {
    return {
      valid: false,
      message: 'エッジ配列が無効です',
    };
  }

  // Validate each edge
  for (const edge of mindmap.edges) {
    const edgeResult = validateSerializedEdge(edge, nodeIds);
    if (!edgeResult.valid) {
      return edgeResult;
    }
  }

  return { valid: true };
}

/**
 * Validates a serialized node structure.
 * 
 * @param node - Serialized node to validate
 * @returns Validation result
 */
export function validateSerializedNode(node: unknown): ValidationResult {
  if (!node || typeof node !== 'object') {
    return {
      valid: false,
      message: 'シリアライズされたノードが無効です',
    };
  }

  const n = node as Record<string, unknown>;

  // Validate ID
  if (typeof n.id !== 'string' || n.id.trim().length === 0) {
    return {
      valid: false,
      message: 'ノードIDが無効です',
    };
  }

  // Validate label
  const labelResult = validateNodeLabel(n.label);
  if (!labelResult.valid) {
    return labelResult;
  }

  // Validate coordinates
  if (typeof n.x !== 'number' || !Number.isFinite(n.x)) {
    return {
      valid: false,
      message: 'ノードのX座標が無効です',
    };
  }

  if (typeof n.y !== 'number' || !Number.isFinite(n.y)) {
    return {
      valid: false,
      message: 'ノードのY座標が無効です',
    };
  }

  // Validate node type
  const typeResult = validateNodeType(n.nodeType);
  if (!typeResult.valid) {
    return typeResult;
  }

  return { valid: true };
}

/**
 * Validates a serialized edge structure.
 * 
 * @param edge - Serialized edge to validate
 * @param nodeIds - Set of valid node IDs
 * @returns Validation result
 */
export function validateSerializedEdge(edge: unknown, nodeIds: Set<string>): ValidationResult {
  if (!edge || typeof edge !== 'object') {
    return {
      valid: false,
      message: 'シリアライズされたエッジが無効です',
    };
  }

  const e = edge as Record<string, unknown>;

  // Validate ID
  if (typeof e.id !== 'string' || e.id.trim().length === 0) {
    return {
      valid: false,
      message: 'エッジIDが無効です',
    };
  }

  // Validate source
  if (typeof e.source !== 'string') {
    return {
      valid: false,
      message: 'エッジのソースが無効です',
    };
  }

  if (!nodeIds.has(e.source)) {
    return {
      valid: false,
      message: `エッジのソースノードが存在しません: ${e.source}`,
    };
  }

  // Validate target
  if (typeof e.target !== 'string') {
    return {
      valid: false,
      message: 'エッジのターゲットが無効です',
    };
  }

  if (!nodeIds.has(e.target)) {
    return {
      valid: false,
      message: `エッジのターゲットノードが存在しません: ${e.target}`,
    };
  }

  return { valid: true };
}

/**
 * Validates goal connection rules.
 * A node can only have one goal connection.
 * 
 * @param targetNodeId - ID of the target node
 * @param edges - Current edges
 * @param nodes - Current nodes
 * @returns Validation result
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
