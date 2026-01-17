import { Node } from 'reactflow';
import { CustomNodeData } from '../app/dashboard/types/mindmap.types';

// デバイス判定ユーティリティ
export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768) ||
         ('ontouchstart' in window);
};

// ノードタイプに応じたスタイルを取得
export const getNodeTypeStyles = (nodeType: 'default' | 'habit' | 'goal' | undefined, selected: boolean) => {
  switch (nodeType) {
    case 'habit':
      return {
        borderColor: 'border-green-500',
        ringColor: 'ring-green-300',
        bgColor: 'bg-green-50',
        hoverColor: 'hover:border-green-600'
      };
    case 'goal':
      return {
        borderColor: 'border-purple-500',
        ringColor: 'ring-purple-300',
        bgColor: 'bg-purple-50',
        hoverColor: 'hover:border-purple-600'
      };
    default:
      return {
        borderColor: selected ? 'border-blue-500' : 'border-gray-300',
        ringColor: 'ring-blue-300',
        bgColor: 'bg-white',
        hoverColor: 'hover:border-blue-400'
      };
  }
};

// エッジのスタイルを取得
export const getEdgeStyle = (nodeType: 'default' | 'habit' | 'goal' | undefined) => {
  switch (nodeType) {
    case 'habit':
      return { stroke: '#10b981', strokeWidth: 2 }; // green-500
    case 'goal':
      return { stroke: '#a855f7', strokeWidth: 2 }; // purple-500
    default:
      return { stroke: '#3b82f6', strokeWidth: 2 }; // blue-500
  }
};

// データベースから取得したノードをReact Flow形式に変換
export const convertNodesToReactFlow = (mindmapNodes: any[]): Node<CustomNodeData>[] => {
  if (!mindmapNodes || !Array.isArray(mindmapNodes)) {
    return [{
      id: '1',
      position: { x: 400, y: 300 },
      data: { label: 'Central Idea', isEditing: false, nodeType: 'default' },
      type: 'mindmapNode',
    }];
  }

  return mindmapNodes.map((node: any) => ({
    id: node.id,
    position: { x: node.x || node.position?.x || 0, y: node.y || node.position?.y || 0 },
    data: { 
      label: node.text || node.label || 'Node', 
      isEditing: false, 
      nodeType: node.nodeType || node.node_type || 'default',
      // habitIdとgoalIdを保存
      habitId: node.habitId || node.habit_id,
      goalId: node.goalId || node.goal_id
    },
    type: 'mindmapNode',
  }));
};

// データベースから取得したエッジをReact Flow形式に変換
export const convertEdgesToReactFlow = (mindmapEdges: any[], nodes: Node<CustomNodeData>[]) => {
  if (!mindmapEdges || !Array.isArray(mindmapEdges)) {
    return [];
  }

  return mindmapEdges.map((edge: any) => {
    const sourceNode = nodes.find((n: Node<CustomNodeData>) => n.id === (edge.source || edge.fromNodeId || edge.from_node_id));
    const nodeType = sourceNode?.data.nodeType || edge.data?.sourceNodeType || 'default';
    const edgeStyle = getEdgeStyle(nodeType);
    
    return {
      id: edge.id,
      source: edge.source || edge.fromNodeId || edge.from_node_id,
      target: edge.target || edge.toNodeId || edge.to_node_id,
      sourceHandle: edge.sourceHandle || edge.source_handle,
      targetHandle: edge.targetHandle || edge.target_handle,
      style: edgeStyle,
      data: { sourceNodeType: nodeType }
    };
  });
};

// 新しいノードの位置を計算
export const calculateNewNodePosition = (viewport: any, isMobile: boolean) => {
  let position;
  
  if (isMobile) {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const headerHeight = 60;
    
    position = {
      x: (-viewport.x + screenWidth / 2) / viewport.zoom - 60,
      y: (-viewport.y + (screenHeight - headerHeight) / 2) / viewport.zoom - 30,
    };
  } else {
    position = {
      x: -viewport.x + window.innerWidth / 2 / viewport.zoom - 60,
      y: -viewport.y + window.innerHeight / 2 / viewport.zoom - 30,
    };
  }

  // 位置が極端に外れていないかチェック
  const minX = (-viewport.x - 200) / viewport.zoom;
  const maxX = (-viewport.x + window.innerWidth + 200) / viewport.zoom;
  const minY = (-viewport.y - 200) / viewport.zoom;
  const maxY = (-viewport.y + window.innerHeight + 200) / viewport.zoom;
  
  position.x = Math.max(minX, Math.min(maxX, position.x));
  position.y = Math.max(minY, Math.min(maxY, position.y));

  return position;
};
