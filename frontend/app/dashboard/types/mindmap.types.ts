import { Node } from 'reactflow';

// Mindmap Props
export interface MindmapProps {
  onClose: () => void;
  onRegisterAsHabit: (data: any) => Promise<any>;
  onRegisterAsGoal: (data: any) => Promise<any>;
  goals?: { id: string; name: string }[];
  habits?: { id: string; name: string }[];
  mindmap?: any;
  onSave?: (mindmapData: any) => void;
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
