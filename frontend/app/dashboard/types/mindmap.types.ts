import { Node, Edge } from 'reactflow';
import type { MindmapNode, MindmapConnection } from './index';

/** Data for registering a node as a habit (from Mindmap component) */
export interface RegisterHabitData {
  nodeId?: string;
  name: string;
  goalId?: string;
  relatedHabitIds?: string[];
  type?: 'do' | 'avoid';
  must?: number;
}

/** Data for registering a node as a goal (from Mindmap component) */
export interface RegisterGoalData {
  nodeId?: string;
  name: string;
  parentGoalId?: string;
  parentId?: string | null;
  details?: string;
  dueDate?: string;
}

/** Mindmap data structure from database */
export interface MindmapData {
  id: string;
  name: string;
  description?: string;
  nodes?: MindmapNode[];
  edges?: MindmapConnection[];
  createdAt?: string;
  updatedAt?: string;
}

/** Mindmap save payload */
export interface MindmapSavePayload {
  id?: string;
  name: string;
  description?: string;
  nodes: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    nodeType?: 'default' | 'habit' | 'goal';
    width?: number;
    height?: number;
    color?: string;
    goalId?: string | null;
    habitId?: string | null;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    data?: Record<string, unknown>;
  }>;
}

// Mindmap Props
export interface MindmapProps {
  onClose: () => void;
  onRegisterAsHabit: (data: RegisterHabitData) => Promise<{ id: string; name: string } | null>;
  onRegisterAsGoal: (data: RegisterGoalData) => Promise<{ id: string; name: string } | null>;
  goals?: { id: string; name: string }[];
  habits?: { id: string; name: string }[];
  mindmap?: MindmapData;
  onSave?: (mindmapData: MindmapSavePayload) => void;
}

// Mobile Bottom Menu
export interface MobileBottomMenu {
  nodeId: string;
  nodeName: string;
  isVisible: boolean;
}

// Connection Mode
export interface ConnectionMode {
  isActive: boolean;
  sourceNodeId: string | null;
  sourceHandleId: string | null;
}

// Modal State
export interface ModalState {
  habitModal: boolean;
  goalModal: boolean;
  selectedNodeName: string;
  selectedNodeId: string;
}

// Custom Node Data
export interface CustomNodeData {
  label: string;
  isEditing?: boolean;
  nodeType?: 'default' | 'habit' | 'goal';
  habitId?: string;
  goalId?: string;
}

// Node Type Styles
export interface NodeTypeStyles {
  borderColor: string;
  ringColor: string;
  bgColor: string;
  hoverColor: string;
}

// Connection Start Info
export interface ConnectionStartInfo {
  nodeId: string;
  handleId?: string;
}

// Language Type
export type Language = 'ja' | 'en';
