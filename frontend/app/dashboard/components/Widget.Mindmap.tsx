import React, { useState, useCallback, useRef } from "react"
import ReactFlow, {
  Node,
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  Connection,
  NodeMouseHandler,
  OnSelectionChangeParams,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  Handle,
  Position,
  NodeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { GoalModal } from './Modal.Goal'
import { HabitModal } from './Modal.Habit'

// デバイス判定ユーティリティ
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768) ||
         ('ontouchstart' in window);
};

// テスト用のハンドラーを組み込み
if (typeof window !== 'undefined') {
  // テストハンドラーの初期化
  class MindmapTestHandler {
    constructor() {
      this.setupMessageListener();
    }

    setupMessageListener() {
      window.addEventListener('message', (event) => {
        const data = event.data;

        switch (data.type) {
          case 'CHECK_EDITING_STATE':
            this.handleCheckEditingState(data.testType);
            break;
        }
      });
    }

    sendMessage(type: string, data: any = {}) {
      try {
        window.parent.postMessage({
          type: type,
          ...data,
          timestamp: Date.now()
        }, '*');
      } catch (error) {
        console.error('Failed to send message to parent:', error);
      }
    }

    handleCheckEditingState(testType: string) {
      const input = document.querySelector('input.mindmap-text-input') as HTMLInputElement;
      const isEditing = !!input && (input as any).offsetParent !== null;
      
      this.sendMessage('EDITING_STATE_RESULT', {
        isEditing: isEditing,
        testType: testType,
        nodeId: '1',
        hasInput: !!input,
        inputVisible: input ? (input as any).offsetParent !== null : false
      });
    }

    findNode(nodeId: string) {
      // data-idでノードを探す
      let node = document.querySelector(`[data-id="${nodeId}"]`) ||
                document.querySelector(`[data-testid="mindmap-node-${nodeId}"]`);
      
      if (!node) {
        // React Flowのノードを探す
        const reactFlowNodes = document.querySelectorAll('[class*="react-flow__node"]');
        for (let reactNode of reactFlowNodes) {
          if (reactNode.textContent?.includes('Central Idea') && nodeId === '1') {
            node = reactNode;
            break;
          }
        }
      }
      
      return node;
    }
  }

  // テストハンドラーを初期化
  if (!(window as any).mindmapTestHandler) {
    (window as any).mindmapTestHandler = new MindmapTestHandler();
  }
}

interface MindmapProps {
  onClose: () => void;
  onRegisterAsHabit: (data: any) => void;
  onRegisterAsGoal: (data: any) => void;
  goals?: { id: string; name: string }[];
  mindmap?: any; // 既存のMindmapデータ（編集時）
  onSave?: (mindmapData: any) => void; // 保存コールバック
}

interface ContextMenu {
  id: string;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}

interface MobileBottomMenu {
  nodeId: string;
  nodeName: string;
  isVisible: boolean;
}

interface ConnectionMode {
  isActive: boolean;
  sourceNodeId: string | null;
  sourceHandleId: string | null;
}

interface ModalState {
  habitModal: boolean;
  goalModal: boolean;
  selectedNodeName: string;
  selectedNodeId: string;
}

// Custom Node Types
interface CustomNodeData {
  label: string;
  isEditing?: boolean;
  nodeType?: 'default' | 'habit' | 'goal';
}

// Custom Mindmap Node Component
// This is a fully custom node that replaces React Flow's default nodes
// Features: Double-click editing, Long-press dragging, Custom styling, Mobile touch support
function MindmapNode({ id, data, selected }: NodeProps<CustomNodeData>) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.label);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const { setNodes } = useReactFlow();
  const isMobile = isMobileDevice();

  // 編集状態の変化をログ出力
  React.useEffect(() => {
  }, [isEditing, id]);

  // Sync text with data.label when not editing
  React.useEffect(() => {
    if (!isEditing) {
      setText(data.label);
    }
  }, [data.label, isEditing]);

  const handleSubmit = useCallback(() => {
    const newText = text.trim() || 'New Node';
    
    // React Flowのノード更新を直接行う
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, label: newText, isEditing: false } }
          : node
      )
    );
    
    // 変更があったことを通知
    const changeEvent = new CustomEvent('nodeChanged');
    window.dispatchEvent(changeEvent);
    
    setIsEditing(false);
  }, [text, id, setNodes]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setText(data.label);
      // Escapeキーでも isEditing を false に設定
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, isEditing: false } }
            : node
        )
      );
      setIsEditing(false);
    }
  }, [handleSubmit, data.label, id, setNodes]);

  const handleInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.stopPropagation();
    // フォーカス時に全選択
    setTimeout(() => {
      e.target.select();
    }, 0);
  }, []);

  const handleBlur = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  // 長押し開始処理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditing) return;
    
    // イベントの伝播を停止してReact Flowのデフォルト動作を防ぐ
    e.stopPropagation();
    
    const startPos = { x: e.clientX, y: e.clientY };
    longPressStartRef.current = startPos;
    
    // 長押しタイマーを開始（300ms）
    longPressTimerRef.current = setTimeout(() => {
      setIsLongPressing(true);
      setIsDragging(true);
      // グローバルイベントを発火
      window.dispatchEvent(new CustomEvent('longPressStart'));
      
      // React Flowのノードを選択状態にする
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          selected: n.id === id
        }))
      );
    }, 300);
  }, [isEditing, id, setNodes]);

  // マウスアップ処理（長押し終了のみ）
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const wasLongPressing = isLongPressing;
    
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    if (wasLongPressing) {
      setIsLongPressing(false);
      setIsDragging(false);
      // グローバルイベントを発火
      window.dispatchEvent(new CustomEvent('longPressEnd'));
    }
    
    longPressStartRef.current = null;
  }, [isLongPressing, id]);

  // マウス移動処理
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!longPressStartRef.current || isEditing) return;
    
    const currentPos = { x: e.clientX, y: e.clientY };
    const distance = Math.sqrt(
      Math.pow(currentPos.x - longPressStartRef.current.x, 2) +
      Math.pow(currentPos.y - longPressStartRef.current.y, 2)
    );
    
    // 移動距離が5px以上の場合、長押しをキャンセル（より敏感に）
    if (distance > 5 && longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, [isEditing]);

  // ダブルクリック/ダブルタップで編集開始
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (isLongPressing || isDragging) return;
    
    e.stopPropagation();
    
    // 長押しタイマーをクリア（ダブルクリック優先）
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // React Flowのノード状態も更新（他のノードの編集を終了）
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, isEditing: true } }
          : { ...n, data: { ...n.data, isEditing: false } }
      )
    );
    
    setIsEditing(true);
    setText(data.label);
    
    // フォーカスを設定
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 50);
  }, [isLongPressing, isDragging, id, data.label, setNodes, isMobile]);

  // モバイル用のタップハンドラー
  const handleMobileTap = useCallback((e: React.MouseEvent) => {
    if (!isMobile || isEditing) return;
    
    e.stopPropagation();
    
    // 結線モードが有効な場合は結線処理を優先
    const connectionModeEvent = new CustomEvent('checkConnectionMode', {
      detail: { nodeId: id }
    });
    window.dispatchEvent(connectionModeEvent);
    
    // 結線モードでない場合のみボトムメニューを表示
    setTimeout(() => {
      const event = new CustomEvent('showMobileBottomMenu', {
        detail: {
          nodeId: id,
          nodeName: data.label
        }
      });
      window.dispatchEvent(event);
    }, 10);
  }, [isMobile, isEditing, id, data.label]);

  // ハンドルクリック/タップ処理（結線用）
  const handleHandleClick = useCallback((e: React.MouseEvent, position: string) => {
    if (!isMobile) return; // PC では従来のドラッグ操作を使用
    
    e.stopPropagation();
    e.preventDefault();
    
    // モバイル用の結線モードを開始するイベントを発火
    const event = new CustomEvent('startMobileConnection', {
      detail: {
        sourceNodeId: id,
        sourceHandleId: position
      }
    });
    window.dispatchEvent(event);
    
    // ログ出力
    console.log(`Mobile connection started from node ${id}, handle ${position}`);
  }, [isMobile, id]);

  // マウスリーブ処理
  const handleMouseLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // ノードタイプに応じたスタイルを取得
  const getNodeTypeStyles = useCallback(() => {
    const nodeType = data.nodeType || 'default';
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
  }, [data.nodeType, selected]);

  // タッチイベント用のハンドラー
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile || isEditing) return;
    
    const touch = e.touches[0];
    const mouseEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      stopPropagation: () => e.stopPropagation(),
      preventDefault: () => e.preventDefault()
    } as React.MouseEvent;
    
    handleMouseDown(mouseEvent);
  }, [isMobile, isEditing, handleMouseDown]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    
    const touch = e.changedTouches[0];
    const mouseEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      stopPropagation: () => e.stopPropagation(),
      preventDefault: () => e.preventDefault()
    } as React.MouseEvent;
    
    handleMouseUp(mouseEvent);
  }, [isMobile, handleMouseUp]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    
    const touch = e.touches[0];
    const mouseEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      stopPropagation: () => e.stopPropagation(),
      preventDefault: () => e.preventDefault()
    } as React.MouseEvent;
    
    handleMouseMove(mouseEvent);
  }, [isMobile, handleMouseMove]);

  return (
    <div 
      ref={nodeRef}
      data-id={id}
      data-testid={`mindmap-node-${id}`}
      className={`mindmap-custom-node px-3 py-2 sm:px-4 sm:py-2 shadow-md rounded-md border-2 min-w-[100px] sm:min-w-[120px] transition-all duration-200 ${
        (() => {
          const styles = getNodeTypeStyles();
          return `${styles.bgColor} ${styles.borderColor} ${styles.hoverColor}`;
        })()
      } ${isEditing ? `ring-2 ${getNodeTypeStyles().ringColor} cursor-text` : 'cursor-pointer'} ${
        isLongPressing ? 'ring-4 ring-yellow-300 scale-105 shadow-lg cursor-move' : ''
      } ${isDragging ? 'opacity-80' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={handleDoubleClick}
      onClick={isMobile ? handleMobileTap : undefined}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
      onTouchMove={isMobile ? handleTouchMove : undefined}

      style={{
        userSelect: isLongPressing ? 'none' : 'auto',
        pointerEvents: 'all'
      }}
    >
      {/* Connection Handles - モバイルでは大きめに、タップしやすく */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className={`${isMobile ? 'w-8 h-8' : 'w-3 h-3'} bg-blue-500 border-2 border-white rounded-full`} 
        style={{ 
          top: isMobile ? -16 : -6,
          zIndex: 10
        }}
        onClick={isMobile ? (e) => handleHandleClick(e, 'top') : undefined}
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className={`${isMobile ? 'w-8 h-8' : 'w-3 h-3'} bg-blue-500 border-2 border-white rounded-full`} 
        style={{ 
          bottom: isMobile ? -16 : -6,
          zIndex: 10
        }}
        onClick={isMobile ? (e) => handleHandleClick(e, 'bottom') : undefined}
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        className={`${isMobile ? 'w-8 h-8' : 'w-3 h-3'} bg-blue-500 border-2 border-white rounded-full`} 
        style={{ 
          left: isMobile ? -16 : -6,
          zIndex: 10
        }}
        onClick={isMobile ? (e) => handleHandleClick(e, 'left') : undefined}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className={`${isMobile ? 'w-8 h-8' : 'w-3 h-3'} bg-blue-500 border-2 border-white rounded-full`} 
        style={{ 
          right: isMobile ? -16 : -6,
          zIndex: 10
        }}
        onClick={isMobile ? (e) => handleHandleClick(e, 'right') : undefined}
      />
      
      {/* Node Content */}
      <div className="mindmap-node-content">
        {isEditing ? (
          <input
            ref={inputRef}
            value={text}
            defaultValue={data.label}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onFocus={handleInputFocus}
            className="w-full bg-white text-gray-900 border-none outline-none text-center text-sm sm:text-sm mindmap-text-input"
            style={{ 
              minWidth: '80px',
              color: '#000000',
              fontSize: isMobile ? '16px' : '14px', // モバイルでは16px以上でズーム防止
              lineHeight: '1.2'
            }}
            autoFocus
          />
        ) : (
          <div 
            className="text-center text-sm sm:text-sm text-gray-900 select-none mindmap-node-text"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              fontSize: isMobile ? '16px' : '14px', // モバイルでは16px以上でズーム防止
              lineHeight: '1.2',
              wordBreak: 'break-word' // 長いテキストの折り返し
            }}
          >
            {data.label}
          </div>
        )}
      </div>
    </div>
  );
}

// Custom Node Types Definition
const customNodeTypes = {
  mindmapNode: MindmapNode,
};

// Initial nodes with custom type
const initialNodes: Node<CustomNodeData>[] = [
  {
    id: '1',
    position: { x: 400, y: 300 },
    data: { label: 'Central Idea', isEditing: false, nodeType: 'default' },
    type: 'mindmapNode',
  },
];

function MindmapFlow({ onClose, onRegisterAsHabit, onRegisterAsGoal, goals = [], mindmap, onSave }: MindmapProps) {
  
  // データベースから取得したノードをReact Flow形式に変換
  const convertedNodes = React.useMemo(() => {
    
    if (mindmap?.nodes && Array.isArray(mindmap.nodes)) {
      const converted = mindmap.nodes.map((node: any) => ({
        id: node.id,
        position: { x: node.x || node.position?.x || 0, y: node.y || node.position?.y || 0 },
        data: { 
          label: node.text || node.label || 'Node', 
          isEditing: false, 
          nodeType: node.nodeType || node.node_type || 'default' 
        },
        type: 'mindmapNode',
      }));
      return converted;
    }
    return initialNodes;
  }, [mindmap?.nodes]);

  // データベースから取得したエッジをReact Flow形式に変換
  const convertedEdges = React.useMemo(() => {
    
    if (mindmap?.edges && Array.isArray(mindmap.edges)) {
      const converted = mindmap.edges.map((edge: any) => ({
        id: edge.id,
        source: edge.source || edge.fromNodeId || edge.from_node_id,
        target: edge.target || edge.toNodeId || edge.to_node_id,
        sourceHandle: edge.sourceHandle || edge.source_handle,
        targetHandle: edge.targetHandle || edge.target_handle,
      }));
      return converted;
    }
    return [];
  }, [mindmap?.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNodeData>(convertedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(convertedEdges);
  const [selectedNodes, setSelectedNodes] = useState<Node<CustomNodeData>[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
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
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project, getViewport, zoomIn, zoomOut, fitView } = useReactFlow();
  const isMobile = isMobileDevice();

  // ログを追加する関数（削除予定）
  const addLog = useCallback((message: string) => {
    // ログ機能を無効化
  }, []);

  // モバイル用結線処理
  const handleMobileNodeTap = useCallback((nodeId: string) => {
    if (!connectionMode.isActive) return;

    // 同じノードをタップした場合は結線モードをキャンセル
    if (connectionMode.sourceNodeId === nodeId) {
      setConnectionMode({
        isActive: false,
        sourceNodeId: null,
        sourceHandleId: null
      });
      addLog('Mobile connection mode cancelled');
      return;
    }

    // 結線を作成
    const newEdge = {
      id: `edge-${connectionMode.sourceNodeId}-${nodeId}`,
      source: connectionMode.sourceNodeId!,
      target: nodeId,
      sourceHandle: connectionMode.sourceHandleId,
      targetHandle: null,
    };

    setEdges((eds) => eds.concat(newEdge));
    setHasUnsavedChanges(true);
    addLog(`Mobile connection created: ${connectionMode.sourceNodeId} -> ${nodeId}`);

    // 結線モードを終了
    setConnectionMode({
      isActive: false,
      sourceNodeId: null,
      sourceHandleId: null
    });
  }, [connectionMode, setEdges, addLog]);

  // ノードやエッジの変更を検出して未保存フラグを設定
  React.useEffect(() => {
    const handleNodeChanged = () => {
      setHasUnsavedChanges(true);
    };
    
    window.addEventListener('nodeChanged', handleNodeChanged);
    
    return () => {
      window.removeEventListener('nodeChanged', handleNodeChanged);
    };
  }, [addLog]);

  // ノードやエッジの数が変わった時も未保存フラグを設定
  React.useEffect(() => {
    const initialNodeCount = convertedNodes.length;
    const initialEdgeCount = convertedEdges.length;
    
    if (nodes.length !== initialNodeCount || edges.length !== initialEdgeCount) {
      setHasUnsavedChanges(true);
    }
  }, [nodes.length, edges.length, convertedNodes.length, convertedEdges.length]);

  // 長押しモードの状態を監視
  React.useEffect(() => {
    const handleLongPressStart = () => {
      setIsLongPressMode(true);
    };
    
    const handleLongPressEnd = () => {
      setIsLongPressMode(false);
    };
    
    // カスタムイベントリスナーを追加
    window.addEventListener('longPressStart', handleLongPressStart);
    window.addEventListener('longPressEnd', handleLongPressEnd);
    
    return () => {
      window.removeEventListener('longPressStart', handleLongPressStart);
      window.removeEventListener('longPressEnd', handleLongPressEnd);
    };
  }, [addLog]);

  // モバイル用のイベントリスナー
  React.useEffect(() => {
    if (!isMobile) return;

    // モバイル用ボトムメニュー表示
    const handleShowMobileBottomMenu = (event: CustomEvent) => {
      const { nodeId, nodeName } = event.detail;
      setMobileBottomMenu({
        nodeId,
        nodeName,
        isVisible: true
      });
      addLog(`Mobile bottom menu opened for node: ${nodeName}`);
    };

    // モバイル用結線モード開始
    const handleStartMobileConnection = (event: CustomEvent) => {
      const { sourceNodeId, sourceHandleId } = event.detail;
      setConnectionMode({
        isActive: true,
        sourceNodeId,
        sourceHandleId
      });
      setMobileBottomMenu({ nodeId: '', nodeName: '', isVisible: false });
      addLog(`Mobile connection mode started from node: ${sourceNodeId}, handle: ${sourceHandleId}`);
    };

    // 結線モードのチェック処理
    const handleCheckConnectionMode = (event: CustomEvent) => {
      const { nodeId } = event.detail;
      
      if (connectionMode.isActive) {
        // 結線モードが有効な場合は結線処理を実行
        handleMobileNodeTap(nodeId);
        // ボトムメニューの表示をキャンセル
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('showMobileBottomMenu', handleShowMobileBottomMenu as EventListener);
    window.addEventListener('startMobileConnection', handleStartMobileConnection as EventListener);
    window.addEventListener('checkConnectionMode', handleCheckConnectionMode as EventListener);

    return () => {
      window.removeEventListener('showMobileBottomMenu', handleShowMobileBottomMenu as EventListener);
      window.removeEventListener('startMobileConnection', handleStartMobileConnection as EventListener);
      window.removeEventListener('checkConnectionMode', handleCheckConnectionMode as EventListener);
    };
  }, [isMobile, addLog, connectionMode, handleMobileNodeTap]);

  // モーダルが開いた時に名前フィールドを自動設定するためのエフェクト
  React.useEffect(() => {
    if (modalState.habitModal || modalState.goalModal) {
      // モーダルが開いた後、少し遅延してから名前フィールドを設定
      setTimeout(() => {
        const nameInput = document.querySelector('input[placeholder="Add title"], input[placeholder="Goal name"]') as HTMLInputElement;
        if (nameInput && modalState.selectedNodeName) {
          nameInput.value = modalState.selectedNodeName;
          nameInput.focus();
          nameInput.select();
        }
      }, 100);
    }
  }, [modalState.habitModal, modalState.goalModal, modalState.selectedNodeName]);

  const nodeTypes = customNodeTypes;



  // モバイル用ボトムメニューのハンドラー
  const handleMobileMenuAction = useCallback((action: string) => {
    const nodeId = mobileBottomMenu.nodeId;
    const node = nodes.find(n => n.id === nodeId);
    
    if (!node) return;

    switch (action) {
      case 'edit':
        addLog(`Mobile edit selected for node: ${nodeId}`);
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, isEditing: true } }
              : { ...n, data: { ...n.data, isEditing: false } }
          )
        );
        break;
      case 'connect':
        addLog(`Mobile connect mode started for node: ${nodeId}`);
        setConnectionMode({
          isActive: true,
          sourceNodeId: nodeId,
          sourceHandleId: null
        });
        // 結線モード開始のログを追加
        console.log(`Connection mode activated for node: ${nodeId}`);
        break;
      case 'habit':
        addLog(`Mobile habit registration for node: "${node.data.label}"`);
        setModalState({
          habitModal: true,
          goalModal: false,
          selectedNodeName: node.data.label,
          selectedNodeId: nodeId
        });
        break;
      case 'goal':
        addLog(`Mobile goal registration for node: "${node.data.label}"`);
        setModalState({
          habitModal: false,
          goalModal: true,
          selectedNodeName: node.data.label,
          selectedNodeId: nodeId
        });
        break;
      case 'delete':
        setNodes((nds) => nds.filter((n) => n.id !== nodeId));
        setEdges((eds) => eds.filter((edge) => 
          edge.source !== nodeId && edge.target !== nodeId
        ));
        setHasUnsavedChanges(true);
        addLog(`Mobile delete node: ${nodeId}`);
        break;
    }

    // メニューを閉じる
    setMobileBottomMenu({ nodeId: '', nodeName: '', isVisible: false });
  }, [mobileBottomMenu.nodeId, nodes, setNodes, setEdges, addLog]);

  // Listen for node label updates (simplified)
  React.useEffect(() => {
    // ノード変更通知の処理
    const handleNodeChanged = () => {
      setHasUnsavedChanges(true);
    };

    window.addEventListener('nodeChanged', handleNodeChanged as EventListener);
    
    return () => {
      window.removeEventListener('nodeChanged', handleNodeChanged as EventListener);
    };
  }, [addLog]);

  // Track changes for unsaved changes detection
  React.useEffect(() => {
    if (nodes.length > 1 || edges.length > 0 || nodes[0]?.data?.label !== 'Central Idea') {
      setHasUnsavedChanges(true);
    }
  }, [nodes, edges]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
      setHasUnsavedChanges(true);
      addLog(`Connection created: ${params.source} -> ${params.target}`);
      // 接続が成功したら開始情報をクリア
      setConnectionStartInfo(null);
    },
    [setEdges, addLog]
  );

  // 接続開始時の処理
  const onConnectStart = useCallback(
    (event: React.MouseEvent | React.TouchEvent, { nodeId, handleId }: { nodeId: string; handleId?: string }) => {
      setConnectionStartInfo({ nodeId, handleId });
      addLog(`Connection started from node: ${nodeId}, handle: ${handleId || 'default'}`);
    },
    [addLog]
  );

  // 結線終了時の処理（結線先が指定されなかった場合に新規ノード作成）
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      // 接続開始情報がない場合は何もしない
      if (!connectionStartInfo) {
        return;
      }
      
      const target = event.target as Element;
      const targetIsPane = target?.classList.contains('react-flow__pane');
      
      // 空白領域（react-flow__pane）にドロップされた場合
      if (targetIsPane && reactFlowWrapper.current) {
        // ドロップ位置を取得
        const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
        const clientX = 'clientX' in event ? event.clientX : event.touches[0].clientX;
        const clientY = 'clientY' in event ? event.clientY : event.touches[0].clientY;
        
        let position = project({
          x: clientX - reactFlowBounds.left,
          y: clientY - reactFlowBounds.top,
        });

        // モバイルでは位置を調整してより確実に画面内に配置
        if (isMobile) {
          const viewport = getViewport();
          const screenWidth = window.innerWidth;
          const screenHeight = window.innerHeight;
          
          // 画面端からの最小距離
          const margin = 100;
          const minX = (-viewport.x + margin) / viewport.zoom;
          const maxX = (-viewport.x + screenWidth - margin) / viewport.zoom;
          const minY = (-viewport.y + margin) / viewport.zoom;
          const maxY = (-viewport.y + screenHeight - margin) / viewport.zoom;
          
          position.x = Math.max(minX, Math.min(maxX, position.x));
          position.y = Math.max(minY, Math.min(maxY, position.y));
        }

        // 新しいノードを作成
        const newNodeId = `node-${Date.now()}`;
        const newNode: Node<CustomNodeData> = {
          id: newNodeId,
          position,
          data: { label: 'New Node', isEditing: false, nodeType: 'default' },
          type: 'mindmapNode',
        };

        // ノードを追加
        setNodes((nds) => nds.concat(newNode));

        // 接続を作成
        const newEdge = {
          id: `edge-${connectionStartInfo.nodeId}-${newNodeId}`,
          source: connectionStartInfo.nodeId,
          target: newNodeId,
          sourceHandle: connectionStartInfo.handleId || null,
          targetHandle: null,
        };

        setEdges((eds) => eds.concat(newEdge));
        setHasUnsavedChanges(true);
        
        addLog(`Auto-created node "${newNode.data.label}" at (${Math.round(position.x)}, ${Math.round(position.y)}) and connected from node ${connectionStartInfo.nodeId}`);
        
        // 新しく作成されたノードを編集モードにする
        setTimeout(() => {
          setNodes((nds) =>
            nds.map((n) =>
              n.id === newNodeId
                ? { ...n, data: { ...n.data, isEditing: true } }
                : { ...n, data: { ...n.data, isEditing: false } }
            )
          );
        }, 100);
      }
      
      // 接続開始情報をクリア
      setConnectionStartInfo(null);
    },
    [project, setNodes, setEdges, addLog, connectionStartInfo, getViewport, isMobile]
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node<CustomNodeData>) => {
      // モバイルでは右クリックメニューを無効化（ボトムメニューを使用）
      if (isMobile) return;
      
      event.preventDefault();
      event.stopPropagation();
      
      addLog(`Node ${node.id} right-clicked`);
      
      // 選択されていないノードを右クリックした場合、そのノードを選択
      const clickedNode = nodes.find(n => n.id === node.id);
      if (clickedNode && !selectedNodes.some(selectedNode => selectedNode.id === node.id)) {
        setSelectedNodes([clickedNode]);
      }

      const pane = reactFlowWrapper.current?.getBoundingClientRect();
      if (!pane) return;

      setContextMenu({
        id: node.id,
        top: event.clientY < pane.height - 200 ? event.clientY : undefined,
        left: event.clientX < pane.width - 200 ? event.clientX : undefined,
        right: event.clientX >= pane.width - 200 ? pane.width - event.clientX : undefined,
        bottom: event.clientY >= pane.height - 200 ? pane.height - event.clientY : undefined,
      });
    },
    [addLog, nodes, selectedNodes, isMobile]
  );

  const addNodeAtCenter = useCallback(() => {
    addLog('+ button clicked - creating new node');
    
    const viewport = getViewport();
    
    // モバイルとデスクトップで異なる位置計算
    let position;
    if (isMobile) {
      // モバイルでは画面中央により確実に配置
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const headerHeight = 60; // ヘッダーの高さを考慮
      
      position = {
        x: (-viewport.x + screenWidth / 2) / viewport.zoom - 60,
        y: (-viewport.y + (screenHeight - headerHeight) / 2) / viewport.zoom - 30,
      };
    } else {
      // デスクトップでは従来の方法
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

    const newNode: Node<CustomNodeData> = {
      id: `node-${Date.now()}`,
      position,
      data: { label: 'New Node', isEditing: false, nodeType: 'default' },
      type: 'mindmapNode',
    };

    addLog(`New node created with ID: ${newNode.id} at position (${Math.round(position.x)}, ${Math.round(position.y)})`);
    setNodes((nds) => nds.concat(newNode));
    setHasUnsavedChanges(true);
  }, [getViewport, setNodes, addLog, isMobile]);

  const handleSave = useCallback(async () => {
    try {
      const mindmapData = {
        id: mindmap?.id,
        name: mindmapName,
        nodes: nodes.map(node => ({
          id: node.id,
          label: node.data.label,
          x: node.position.x,
          y: node.position.y,
          nodeType: node.data.nodeType || 'default'
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle
        }))
      };

      if (onSave) {
        await onSave(mindmapData);
        setHasUnsavedChanges(false);
        addLog(`Mindmap "${mindmapName}" saved successfully`);
      } else {
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      addLog(`Failed to save mindmap: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [mindmap, mindmapName, nodes, edges, onSave, addLog]);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowSaveDialog(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  const handleSaveAndClose = useCallback(() => {
    handleSave();
    setShowSaveDialog(false);
    onClose();
  }, [handleSave, onClose]);

  const handleCloseWithoutSaving = useCallback(() => {
    setShowSaveDialog(false);
    onClose();
  }, [onClose]);

  const handleCancelClose = useCallback(() => {
    setShowSaveDialog(false);
  }, []);

  const onSelectionChange = useCallback(({ nodes }: OnSelectionChangeParams) => {
    setSelectedNodes(nodes as Node<CustomNodeData>[]);
  }, []);

  const deleteSelectedNodes = useCallback(() => {
    const selectedNodeIds = selectedNodes.map(node => node.id);
    setNodes((nds) => nds.filter((node) => !selectedNodeIds.includes(node.id)));
    setEdges((eds) => eds.filter((edge) => 
      !selectedNodeIds.includes(edge.source) && !selectedNodeIds.includes(edge.target)
    ));
  }, [selectedNodes, setNodes, setEdges]);

  const clearAllConnections = useCallback(() => {
    setEdges([]);
  }, [setEdges]);



  const handleEditText = useCallback(() => {
    if (contextMenu) {
      const nodeId = contextMenu.id;
      addLog(`Edit Text selected for node: ${nodeId}`);
      
      // 直接該当ノードの編集開始
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, isEditing: true } }
            : { ...n, data: { ...n.data, isEditing: false } }
        )
      );
    }
    setContextMenu(null);
  }, [contextMenu, addLog, setNodes]);

  const handleRegisterAsHabit = useCallback(() => {
    if (contextMenu) {
      const node = nodes.find(n => n.id === contextMenu.id);
      if (node) {
        addLog(`Opening Habit registration modal for node: "${node.data.label}"`);
        setModalState({
          habitModal: true,
          goalModal: false,
          selectedNodeName: node.data.label,
          selectedNodeId: contextMenu.id
        });
      }
    }
    setContextMenu(null);
  }, [contextMenu, nodes, addLog]);

  const handleRegisterAsGoal = useCallback(() => {
    if (contextMenu) {
      const node = nodes.find(n => n.id === contextMenu.id);
      if (node) {
        addLog(`Opening Goal registration modal for node: "${node.data.label}"`);
        setModalState({
          habitModal: false,
          goalModal: true,
          selectedNodeName: node.data.label,
          selectedNodeId: contextMenu.id
        });
      }
    }
    setContextMenu(null);
  }, [contextMenu, nodes, addLog]);

  const handleHabitCreate = useCallback((payload: any) => {
    const { selectedNodeId } = modalState;
    
    // ノードタイプをhabitに変更
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId
          ? { ...n, data: { ...n.data, nodeType: 'habit' } }
          : n
      )
    );
    
    // 親コンポーネントのコールバックを呼び出し
    onRegisterAsHabit(payload);
    addLog(`Habit "${payload.name}" registered successfully`);
    
    // モーダルを閉じる
    setModalState({
      habitModal: false,
      goalModal: false,
      selectedNodeName: '',
      selectedNodeId: ''
    });
  }, [modalState, setNodes, onRegisterAsHabit, addLog]);

  const handleGoalCreate = useCallback((payload: any) => {
    const { selectedNodeId } = modalState;
    
    // ノードタイプをgoalに変更
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId
          ? { ...n, data: { ...n.data, nodeType: 'goal' } }
          : n
      )
    );
    
    // 親コンポーネントのコールバックを呼び出し
    onRegisterAsGoal(payload);
    addLog(`Goal "${payload.name}" registered successfully`);
    
    // モーダルを閉じる
    setModalState({
      habitModal: false,
      goalModal: false,
      selectedNodeName: '',
      selectedNodeId: ''
    });
  }, [modalState, setNodes, onRegisterAsGoal, addLog]);

  const handleModalClose = useCallback(() => {
    setModalState({
      habitModal: false,
      goalModal: false,
      selectedNodeName: '',
      selectedNodeId: ''
    });
    addLog('Modal closed without registration');
  }, [addLog]);

  const handleDeleteNode = useCallback(() => {
    if (contextMenu) {
      const nodeToDelete = contextMenu.id;
      
      const nodesToDelete = selectedNodes.some(node => node.id === nodeToDelete)
        ? selectedNodes.map(node => node.id)
        : [nodeToDelete];
      
      setNodes((nds) => nds.filter((node) => !nodesToDelete.includes(node.id)));
      
      setEdges((eds) => eds.filter((edge) => 
        !nodesToDelete.includes(edge.source) && !nodesToDelete.includes(edge.target)
      ));
      
      setSelectedNodes([]);
    }
    setContextMenu(null);
  }, [contextMenu, selectedNodes, setNodes, setEdges]);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // テキスト編集中の場合はキーボードショートカットを無効化
      const isAnyNodeEditing = nodes.some(node => node.data.isEditing);
      if (isAnyNodeEditing) {
        return; // 編集中は何もしない
      }
      
      switch (event.key) {
        case 'Delete':
        case 'Backspace':
          if (selectedNodes.length > 0) {
            deleteSelectedNodes();
          }
          break;
        case 'Escape':
          setContextMenu(null);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodes, deleteSelectedNodes, nodes]);

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
      {/* Header - モバイル対応 */}
      <div className="flex items-center justify-between p-2 sm:p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 z-10">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          {showNameEditor ? (
            <input
              type="text"
              value={mindmapName}
              onChange={(e) => setMindmapName(e.target.value)}
              onBlur={() => setShowNameEditor(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setShowNameEditor(false);
                  setHasUnsavedChanges(true);
                }
                if (e.key === 'Escape') {
                  setMindmapName(mindmap?.name || 'Untitled Mindmap');
                  setShowNameEditor(false);
                }
              }}
              className="text-lg sm:text-xl font-semibold bg-transparent border-b-2 border-blue-500 focus:outline-none text-gray-900 dark:text-white flex-1 min-w-0"
              autoFocus
            />
          ) : (
            <h1 
              className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 truncate flex-1 min-w-0"
              onClick={() => setShowNameEditor(true)}
              title="Click to edit name"
            >
              {mindmapName} {hasUnsavedChanges && <span className="text-orange-500">*</span>}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button
            onClick={handleSave}
            className="px-2 py-1 sm:px-4 sm:py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm sm:text-base"
          >
            {isMobile ? '保存' : 'Save'}
          </button>
          <button
            onClick={handleClose}
            className="px-2 py-1 sm:px-4 sm:py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm sm:text-base"
          >
            {isMobile ? '閉じる' : 'Close'}
          </button>
        </div>
      </div>



      {/* React Flow Container */}
      <div 
        className="flex-1 h-full" 
        ref={reactFlowWrapper}
        onClick={() => setContextMenu(null)}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart as any}
          onConnectEnd={onConnectEnd as any}
          onNodeContextMenu={onNodeContextMenu}
          onSelectionChange={onSelectionChange}
          onNodeClick={isMobile ? (event, node) => {
            if (connectionMode.isActive) {
              handleMobileNodeTap(node.id);
            }
          } : undefined}
          nodeTypes={nodeTypes}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          selectNodesOnDrag={true}
          panOnDrag={isMobile ? [1] : [1, 2]} // モバイルでは左クリックのみでパン
          fitView
          attributionPosition="bottom-left"
          className="bg-gray-50 dark:bg-gray-800"
          minZoom={isMobile ? 0.3 : 0.5} // モバイルでより小さくズームアウト可能
          maxZoom={isMobile ? 2 : 4} // モバイルでズームイン制限
          onPaneClick={() => {
            setContextMenu(null);
            if (isMobile) {
              setMobileBottomMenu({ nodeId: '', nodeName: '', isVisible: false });
              if (connectionMode.isActive) {
                setConnectionMode({
                  isActive: false,
                  sourceNodeId: null,
                  sourceHandleId: null
                });
                addLog('Mobile connection mode cancelled by pane click');
              }
            }
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <Controls />
          
          {/* Custom Panels - モバイル対応 */}
          <Panel position="bottom-left" className="flex flex-col gap-2 m-2 sm:m-4">
            {/* Zoom Controls */}
            <div className="flex flex-col gap-1">
              <button
                onClick={() => zoomIn()}
                className={`${isMobile ? 'w-12 h-12' : 'w-10 h-10'} bg-gray-600 hover:bg-gray-700 text-white rounded shadow-lg flex items-center justify-center text-lg transition-colors`}
                title="Zoom In"
              >
                ＋
              </button>
              <button
                onClick={() => fitView()}
                className={`${isMobile ? 'w-12 h-12' : 'w-10 h-10'} bg-gray-600 hover:bg-gray-700 text-white rounded shadow-lg flex items-center justify-center ${isMobile ? 'text-sm' : 'text-xs'} transition-colors`}
                title="Fit View"
              >
                ⌂
              </button>
              <button
                onClick={() => zoomOut()}
                className={`${isMobile ? 'w-12 h-12' : 'w-10 h-10'} bg-gray-600 hover:bg-gray-700 text-white rounded shadow-lg flex items-center justify-center text-lg transition-colors`}
                title="Zoom Out"
              >
                －
              </button>
            </div>
            
            {/* Action Buttons */}
            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={addNodeAtCenter}
                className={`${isMobile ? 'w-14 h-14' : 'w-12 h-12'} bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-xl font-bold transition-colors`}
                title="Add Node"
              >
                ＋
              </button>
              <button
                onClick={clearAllConnections}
                className={`${isMobile ? 'w-14 h-14' : 'w-12 h-12'} bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg flex items-center justify-center text-lg transition-colors`}
                title="Clear All Connections"
              >
                ✂
              </button>
              {selectedNodes.length > 0 && (
                <button
                  onClick={deleteSelectedNodes}
                  className={`${isMobile ? 'w-14 h-14' : 'w-12 h-12'} bg-orange-600 hover:bg-orange-700 text-white rounded-full shadow-lg flex items-center justify-center text-lg transition-colors`}
                  title={`Delete Selected (${selectedNodes.length})`}
                >
                  🗑️
                </button>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Save Confirmation Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Save Changes?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You have unsaved changes. Do you want to save your mindmap before closing?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseWithoutSaving}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Don't Save
              </button>
              <button
                onClick={handleSaveAndClose}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu - PC only */}
      {!isMobile && contextMenu && (
        <div
          className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-2 z-50"
          style={{
            top: contextMenu.top,
            left: contextMenu.left,
            right: contextMenu.right,
            bottom: contextMenu.bottom,
          }}
        >
          <button
            onClick={handleEditText}
            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2 transition-colors"
          >
            <span>✏️</span>
            Edit Text
          </button>
          <hr className="my-1 border-gray-600" />
          <button
            onClick={handleRegisterAsHabit}
            className="w-full px-4 py-2 text-left text-sm text-green-400 hover:bg-gray-700 hover:text-green-300 flex items-center gap-2 transition-colors"
          >
            <span>🔄</span>
            Register as Habit
          </button>
          <button
            onClick={handleRegisterAsGoal}
            className="w-full px-4 py-2 text-left text-sm text-green-400 hover:bg-gray-700 hover:text-green-300 flex items-center gap-2 transition-colors"
          >
            <span>🎯</span>
            Register as Goal
          </button>
          <hr className="my-1 border-gray-600" />
          <button
            onClick={handleDeleteNode}
            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-900/30 hover:text-red-300 flex items-center gap-2 transition-colors"
          >
            <span>🗑️</span>
            {selectedNodes.some(node => node.id === contextMenu.id) && selectedNodes.length > 1
              ? `Delete Selected (${selectedNodes.length})`
              : 'Delete Node'
            }
          </button>
        </div>
      )}

      {/* Mobile Bottom Menu - 結線オプションを追加 */}
      {isMobile && mobileBottomMenu.isVisible && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 safe-area-pb">
          <div className="p-4">
            <div className="text-center text-sm text-gray-600 dark:text-gray-400 mb-4">
              {mobileBottomMenu.nodeName}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                onClick={() => handleMobileMenuAction('edit')}
                className="flex flex-col items-center justify-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400"
              >
                <span className="text-2xl mb-1">✏️</span>
                <span className="text-sm">Edit Text</span>
              </button>
              <button
                onClick={() => handleMobileMenuAction('connect')}
                className="flex flex-col items-center justify-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400"
              >
                <span className="text-2xl mb-1">🔗</span>
                <span className="text-sm">Connect</span>
              </button>
              <button
                onClick={() => handleMobileMenuAction('habit')}
                className="flex flex-col items-center justify-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400"
              >
                <span className="text-2xl mb-1">🔄</span>
                <span className="text-sm">As Habit</span>
              </button>
              <button
                onClick={() => handleMobileMenuAction('goal')}
                className="flex flex-col items-center justify-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400"
              >
                <span className="text-2xl mb-1">🎯</span>
                <span className="text-sm">As Goal</span>
              </button>
            </div>
            <button
              onClick={() => handleMobileMenuAction('delete')}
              className="w-full p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 mb-3"
            >
              <span className="text-xl mr-2">🗑️</span>
              Delete Node
            </button>
            <button
              onClick={() => setMobileBottomMenu({ nodeId: '', nodeName: '', isVisible: false })}
              className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Mobile Connection Mode Overlay - 改善版 */}
      {isMobile && connectionMode.isActive && (
        <div className="fixed top-16 left-2 right-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 rounded-xl shadow-lg z-40 border border-blue-500">
          <div className="text-center">
            <div className="text-lg font-bold mb-2 flex items-center justify-center">
              <span className="text-2xl mr-2">🔗</span>
              結線モード
            </div>
            <div className="text-sm mb-2 opacity-90">
              開始ノード: {nodes.find(n => n.id === connectionMode.sourceNodeId)?.data.label || 'Unknown'}
            </div>
            <div className="text-sm mb-4 opacity-90">
              接続したいノードをタップしてください
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  setConnectionMode({
                    isActive: false,
                    sourceNodeId: null,
                    sourceHandleId: null
                  });
                  addLog('Mobile connection mode cancelled');
                  console.log('Connection mode cancelled');
                }}
                className="px-6 py-2 bg-white/20 text-white rounded-lg font-medium border border-white/30 hover:bg-white/30 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Habit Registration Modal */}
      <HabitModal
        open={modalState.habitModal}
        onClose={handleModalClose}
        habit={null}
        initial={{ 
          date: new Date().toISOString().slice(0, 10),
          goalId: goals.length > 0 ? goals[0].id : undefined
        }}
        onCreate={(payload) => {
          // ノード名をHabit名として使用
          const updatedPayload = {
            ...payload,
            name: modalState.selectedNodeName || payload.name
          };
          handleHabitCreate(updatedPayload);
        }}
        categories={goals}
      />

      {/* Goal Registration Modal */}
      <GoalModal
        open={modalState.goalModal}
        onClose={handleModalClose}
        goal={null}
        onCreate={(payload) => {
          // ノード名をGoal名として使用
          const updatedPayload = {
            ...payload,
            name: modalState.selectedNodeName || payload.name
          };
          handleGoalCreate(updatedPayload);
        }}
        goals={goals}
      />
    </div>
  );
}

export default function WidgetMindmap(props: MindmapProps) {
  return (
    <ReactFlowProvider>
      <MindmapFlow {...props} />
    </ReactFlowProvider>
  );
}