import { useState, useCallback, useMemo } from 'react';
import { Node, useNodesState, useEdgesState } from 'reactflow';
import { 
  CustomNodeData, 
  MobileBottomMenu, 
  ConnectionMode, 
  ModalState,
  Language,
  MindmapData
} from '../types/mindmap.types';
import { convertNodesToReactFlow, convertEdgesToReactFlow } from '../../../lib/mindmap.utils';

/** Goal reference for mindmap */
interface GoalRef {
  id: string;
  name: string;
}

export const useMindmapState = (mindmap: MindmapData | undefined, goals: GoalRef[]) => {
  // データベースから取得したノードをReact Flow形式に変換
  const convertedNodes = useMemo(() => {
    return convertNodesToReactFlow(mindmap?.nodes ?? []);
  }, [mindmap?.nodes]);

  // データベースから取得したエッジをReact Flow形式に変換
  const convertedEdges = useMemo(() => {
    return convertEdgesToReactFlow(mindmap?.edges ?? [], convertedNodes);
  }, [mindmap?.edges, convertedNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNodeData>(convertedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(convertedEdges);
  const [selectedNodes, setSelectedNodes] = useState<Node<CustomNodeData>[]>([]);
  const [mobileBottomMenu, setMobileBottomMenu] = useState<MobileBottomMenu>({
    nodeId: '',
    nodeName: '',
    isVisible: false
  });
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>({
    isActive: false,
    sourceNodeId: null,
    sourceHandleId: null
  });
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showCoachMark, setShowCoachMark] = useState(false);
  
  // language: 'ja' or 'en'
  const [lang, setLang] = useState<Language>(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.language && navigator.language.startsWith('en') ? 'en' : 'ja';
    }
    return 'ja';
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLongPressMode, setIsLongPressMode] = useState(false);
  const [connectionStartInfo, setConnectionStartInfo] = useState<{nodeId: string, handleId?: string} | null>(null);
  const [modalState, setModalState] = useState<ModalState>({
    habitModal: false,
    goalModal: false,
    selectedNodeName: '',
    selectedNodeId: ''
  });
  const [mindmapName, setMindmapName] = useState(mindmap?.name || 'Untitled Mindmap');
  const [showNameEditor, setShowNameEditor] = useState(false);
  const [isEditMode, setIsEditMode] = useState(true); // 編集モード・閲覧モード（既定値: 編集モード）

  return {
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    selectedNodes,
    setSelectedNodes,
    mobileBottomMenu,
    setMobileBottomMenu,
    connectionMode,
    setConnectionMode,
    showSaveDialog,
    setShowSaveDialog,
    showCoachMark,
    setShowCoachMark,
    lang,
    setLang,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    isLongPressMode,
    setIsLongPressMode,
    connectionStartInfo,
    setConnectionStartInfo,
    modalState,
    setModalState,
    mindmapName,
    setMindmapName,
    showNameEditor,
    setShowNameEditor,
    isEditMode,
    setIsEditMode,
  };
};
