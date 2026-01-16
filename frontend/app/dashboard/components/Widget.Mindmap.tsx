import React, { useCallback, useRef, useEffect } from "react"
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Connection,
  OnSelectionChangeParams,
  ReactFlowProvider,
  useReactFlow,
  Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { GoalModal } from './Modal.Goal'
import { HabitModal } from './Modal.Habit'
import { ToastProvider, useToast } from './ToastManager'
import { customNodeTypes } from './Mindmap.Node'
import { useMindmapState } from '../hooks/useMindmapState'
import { MindmapProps } from '../types/mindmap.types'
import { 
  isMobileDevice, 
  getEdgeStyle, 
  calculateNewNodePosition,
  calculateContextMenuPosition 
} from '../../../lib/mindmap.utils'
import { getTranslation } from '../../../lib/mindmap.i18n'
import { initializeMindmapTestHandler } from '../../../lib/mindmap.test-handler'
import { debug } from '../../../lib/debug'

// テストハンドラーの初期化
if (typeof window !== 'undefined') {
  initializeMindmapTestHandler();
}

function MindmapFlow({ onClose, onRegisterAsHabit, onRegisterAsGoal, goals = [], mindmap, onSave }: MindmapProps) {
  const state = useMindmapState(mindmap, goals);
  const {
    nodes, setNodes, onNodesChange,
    edges, setEdges, onEdgesChange,
    selectedNodes, setSelectedNodes,
    contextMenu, setContextMenu,
    mobileBottomMenu, setMobileBottomMenu,
    connectionMode, setConnectionMode,
    showSaveDialog, setShowSaveDialog,
    showCoachMark, setShowCoachMark,
    lang, setLang,
    hasUnsavedChanges, setHasUnsavedChanges,
    isLongPressMode, setIsLongPressMode,
    connectionStartInfo, setConnectionStartInfo,
    modalState, setModalState,
    mindmapName, setMindmapName,
    showNameEditor, setShowNameEditor,
    isEditMode, setIsEditMode,
  } = state;

  const t = getTranslation(lang);
  const toastCtx = (() => {
    try {
      return useToast()
    } catch (e) {
      return null
    }
  })();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project, getViewport, zoomIn, zoomOut, fitView } = useReactFlow();
  const isMobile = isMobileDevice();

  // 編集モードの状態をグローバルに設定（カスタムノードから参照するため）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__mindmapEditMode = isEditMode;
    }
  }, [isEditMode]);
  
  // 初回オンボーディング（簡易 coach-mark）
  useEffect(() => {
    try {
      const seen = typeof window !== 'undefined' && window.localStorage.getItem('mindmap_coach_seen');
      if (!seen) {
        setShowCoachMark(true);
      }
    } catch (e) {
      // ignore
    }
  }, []);

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
    const sourceNode = nodes.find(n => n.id === connectionMode.sourceNodeId);
    const nodeType = sourceNode?.data.nodeType || 'default';
    const edgeStyle = getEdgeStyle(nodeType);
    
    const newEdge = {
      id: `edge-${connectionMode.sourceNodeId}-${nodeId}`,
      source: connectionMode.sourceNodeId!,
      target: nodeId,
      sourceHandle: connectionMode.sourceHandleId,
      targetHandle: null,
      style: edgeStyle,
      data: { sourceNodeType: nodeType }
    };

    setEdges((eds) => eds.concat(newEdge));
    setHasUnsavedChanges(true);
    addLog(`Mobile connection created: ${connectionMode.sourceNodeId} (${nodeType}) -> ${nodeId}`);

    // 結線モードを終了
    setConnectionMode({
      isActive: false,
      sourceNodeId: null,
      sourceHandleId: null
    });
  }, [connectionMode, setEdges, addLog, nodes]);

  // ノードやエッジの変更を検出して未保存フラグを設定
  useEffect(() => {
    const handleNodeChanged = () => {
      setHasUnsavedChanges(true);
    };
    
    window.addEventListener('nodeChanged', handleNodeChanged);
    
    return () => {
      window.removeEventListener('nodeChanged', handleNodeChanged);
    };
  }, [addLog]);

  // 長押しモードの状態を監視
  useEffect(() => {
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
  useEffect(() => {
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

    // 結線モードの状態を返すハンドラー
    const handleGetConnectionModeState = (event: Event) => {
      const stateEvent = new CustomEvent('connectionModeStateResponse', {
        detail: {
          isActive: connectionMode.isActive,
          sourceNodeId: connectionMode.sourceNodeId,
          sourceHandleId: connectionMode.sourceHandleId
        }
      });
      window.dispatchEvent(stateEvent);
    };

    // 結線実行ハンドラー
    const handleExecuteConnection = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { targetNodeId } = customEvent.detail;
      if (connectionMode.isActive) {
        debug.log(`Executing connection: ${connectionMode.sourceNodeId} -> ${targetNodeId}`);
        handleMobileNodeTap(targetNodeId);
      }
    };

    window.addEventListener('showMobileBottomMenu', handleShowMobileBottomMenu as EventListener);
    window.addEventListener('startMobileConnection', handleStartMobileConnection as EventListener);
    window.addEventListener('getConnectionModeState', handleGetConnectionModeState as EventListener);
    window.addEventListener('executeConnection', handleExecuteConnection as EventListener);

    return () => {
      window.removeEventListener('showMobileBottomMenu', handleShowMobileBottomMenu as EventListener);
      window.removeEventListener('startMobileConnection', handleStartMobileConnection as EventListener);
      window.removeEventListener('getConnectionModeState', handleGetConnectionModeState as EventListener);
      window.removeEventListener('executeConnection', handleExecuteConnection as EventListener);
    };
  }, [isMobile, addLog, connectionMode, handleMobileNodeTap]);

  // モーダルが開いた時に名前フィールドを自動設定するためのエフェクト
  useEffect(() => {
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
        debug.log(`Connection mode activated for node: ${nodeId}`);
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

  const onConnect = useCallback(
    (params: Connection) => {
      // ソースノードのnodeTypeを取得してエッジのスタイルを設定
      const sourceNode = nodes.find(n => n.id === params.source);
      const nodeType = sourceNode?.data.nodeType || 'default';
      const edgeStyle = getEdgeStyle(nodeType);
      
      const newEdge = {
        ...params,
        style: edgeStyle,
        animated: false,
        data: { sourceNodeType: nodeType }
      };
      
      setEdges((eds) => addEdge(newEdge, eds));
      setHasUnsavedChanges(true);
      addLog(`Connection created: ${params.source} (${nodeType}) -> ${params.target}`);
      // 接続が成功したら開始情報をクリア
      setConnectionStartInfo(null);
    },
    [setEdges, addLog, nodes]
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
        const newNode = {
          id: newNodeId,
          position,
          data: { label: 'New Node', isEditing: false, nodeType: 'default' as const },
          type: 'mindmapNode',
        };

        // ノードを追加
        setNodes((nds) => nds.concat(newNode));

        // 接続を作成（ソースノードのnodeTypeに応じたスタイルを設定）
        const sourceNode = nodes.find(n => n.id === connectionStartInfo.nodeId);
        const nodeType = sourceNode?.data.nodeType || 'default';
        const edgeStyle = getEdgeStyle(nodeType);
        
        const newEdge = {
          id: `edge-${connectionStartInfo.nodeId}-${newNodeId}`,
          source: connectionStartInfo.nodeId,
          target: newNodeId,
          sourceHandle: connectionStartInfo.handleId || null,
          targetHandle: null,
          style: edgeStyle,
          data: { sourceNodeType: nodeType }
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
    [project, setNodes, setEdges, addLog, connectionStartInfo, getViewport, isMobile, nodes]
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: any) => {
      // モバイルでは右クリックメニューを無効化（ボトムメニューを使用）
      if (isMobile) return;
      
      event.preventDefault();
      event.stopPropagation();
      
      console.log('[Mindmap] Right-click on node:', node.id, 'nodeType:', node.data.nodeType);
      addLog(`Node ${node.id} right-clicked`);
      
      // 選択されていないノードを右クリックした場合、そのノードを選択
      const clickedNode = nodes.find(n => n.id === node.id);
      if (clickedNode && !selectedNodes.some(selectedNode => selectedNode.id === node.id)) {
        setSelectedNodes([clickedNode]);
      }

      const { top, left } = calculateContextMenuPosition(event.clientX, event.clientY);

      console.log('[Mindmap] Context menu position:', { top, left, clickX: event.clientX, clickY: event.clientY });

      setContextMenu({
        id: node.id,
        top,
        left,
        right: undefined,
        bottom: undefined,
      });
    },
    [addLog, nodes, selectedNodes, isMobile]
  );

  const addNodeAtCenter = useCallback(() => {
    if (!isEditMode) return; // 閲覧モードでは何もしない
    
    addLog('+ button clicked - creating new node');
    
    const viewport = getViewport();
    const position = calculateNewNodePosition(viewport, isMobile);

    const newNode = {
      id: `node-${Date.now()}`,
      position,
      data: { label: 'New Node', isEditing: false, nodeType: 'default' as const },
      type: 'mindmapNode',
    };

    addLog(`New node created with ID: ${newNode.id} at position (${Math.round(position.x)}, ${Math.round(position.y)})`);
    setNodes((nds) => nds.concat(newNode));
    setHasUnsavedChanges(true);
  }, [getViewport, setNodes, addLog, isMobile, isEditMode]);

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
          targetHandle: edge.targetHandle,
          data: edge.data // sourceNodeTypeを保存
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
    setSelectedNodes(nodes as any);
  }, []);

  const deleteSelectedNodes = useCallback(() => {
    if (!isEditMode) return; // 閲覧モードでは何もしない
    const selectedNodeIds = selectedNodes.map(node => node.id);
    setNodes((nds) => nds.filter((node) => !selectedNodeIds.includes(node.id)));
    setEdges((eds) => eds.filter((edge) => 
      !selectedNodeIds.includes(edge.source) && !selectedNodeIds.includes(edge.target)
    ));
  }, [selectedNodes, setNodes, setEdges, isEditMode]);

  const clearAllConnections = useCallback(() => {
    if (!isEditMode) return; // 閲覧モードでは何もしない
    setEdges([]);
  }, [setEdges, isEditMode]);

  const handleEditText = useCallback(() => {
    if (!isEditMode) return; // 閲覧モードでは何もしない
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
  }, [contextMenu, addLog, setNodes, isEditMode]);

  const handleRegisterAsHabit = useCallback(() => {
    if (!isEditMode) return; // 閲覧モードでは何もしない
    if (contextMenu) {
      const node = nodes.find(n => n.id === contextMenu.id);
      if (node) {
        if (node.data.nodeType === 'habit') {
          addLog(`Opening Habit edit modal for node: "${node.data.label}"`);
        }
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
  }, [contextMenu, nodes, addLog, isEditMode]);

  const handleRegisterAsGoal = useCallback(() => {
    if (!isEditMode) return; // 閲覧モードでは何もしない
    if (contextMenu) {
      const node = nodes.find(n => n.id === contextMenu.id);
      if (node) {
        if (node.data.nodeType === 'goal') {
          addLog(`Opening Goal edit modal for node: "${node.data.label}"`);
        }
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
  }, [contextMenu, nodes, addLog, isEditMode]);

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
    
    // このノードから出ているエッジの色を更新
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.source === selectedNodeId) {
          return {
            ...edge,
            style: { stroke: '#10b981', strokeWidth: 2 }, // green-500
            data: { sourceNodeType: 'habit' }
          };
        }
        return edge;
      })
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
  }, [modalState, setNodes, setEdges, onRegisterAsHabit, addLog]);

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
    
    // このノードから出ているエッジの色を更新
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.source === selectedNodeId) {
          return {
            ...edge,
            style: { stroke: '#a855f7', strokeWidth: 2 }, // purple-500
            data: { sourceNodeType: 'goal' }
          };
        }
        return edge;
      })
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
  }, [modalState, setNodes, setEdges, onRegisterAsGoal, addLog]);

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
    if (!isEditMode) return; // 閲覧モードでは何もしない
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
  }, [contextMenu, selectedNodes, setNodes, setEdges, isEditMode]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // テキスト編集中の場合はキーボードショートカットを無効化
      const isAnyNodeEditing = nodes.some(node => node.data.isEditing);
      if (isAnyNodeEditing) {
        return; // 編集中は何もしない
      }
      
      // 閲覧モードでは削除操作を無効化
      if (!isEditMode && (event.key === 'Delete' || event.key === 'Backspace')) {
        return;
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
  }, [selectedNodes, deleteSelectedNodes, nodes, isEditMode]);

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
      {/* Header - モバイル対応（折返し表示） */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 z-10 gap-2">
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
          {/* 編集/参照モード切替: 削除 (UI不要のため) */}
          <button
            onClick={async () => {
              await handleSave();
              if (toastCtx) {
                toastCtx.showToast({ message: t('saved'), duration: 1500 })
              }
            }}
            title={t('save')}
            aria-label={t('save')}
            className="px-2 py-1 sm:px-4 sm:py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm sm:text-base whitespace-nowrap"
          >
            {t('save')}
          </button>
          <button
            onClick={handleClose}
            title={t('close')}
            aria-label={t('close')}
            className="px-2 py-1 sm:px-4 sm:py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm sm:text-base whitespace-nowrap"
          >
            {t('close')}
          </button>
          {/* 言語切替 */}
          <div className="ml-2 flex items-center gap-1">
            <button
              onClick={() => setLang(lang === 'ja' ? 'en' : 'ja')}
              title="Toggle language"
              aria-label="Toggle language"
              className="px-2 py-1 bg-transparent text-sm text-gray-700 dark:text-gray-200 border border-gray-300 rounded hover:bg-gray-100 whitespace-nowrap"
            >
              {lang === 'ja' ? 'EN' : '日本語'}
            </button>
          </div>
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
          onNodesChange={isEditMode ? onNodesChange : undefined}
          onEdgesChange={isEditMode ? onEdgesChange : undefined}
          onConnect={isEditMode ? onConnect : undefined}
          onConnectStart={isEditMode ? (onConnectStart as any) : undefined}
          onConnectEnd={isEditMode ? (onConnectEnd as any) : undefined}
          onNodeContextMenu={isEditMode ? onNodeContextMenu : undefined}
          onSelectionChange={onSelectionChange}
          onNodeClick={isMobile ? (event, node) => {
            if (connectionMode.isActive) {
              handleMobileNodeTap(node.id);
            }
          } : undefined}
          nodeTypes={customNodeTypes}
          nodesDraggable={isEditMode}
          nodesConnectable={isEditMode}
          elementsSelectable={isEditMode}
          selectNodesOnDrag={isEditMode}
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
                title={t('zoom_in')}
              >
                ＋
              </button>
              <button
                onClick={() => fitView()}
                className={`${isMobile ? 'w-12 h-12' : 'w-10 h-10'} bg-gray-600 hover:bg-gray-700 text-white rounded shadow-lg flex items-center justify-center ${isMobile ? 'text-sm' : 'text-xs'} transition-colors`}
                title={t('fit_view')}
              >
                ⌂
              </button>
              <button
                onClick={() => zoomOut()}
                className={`${isMobile ? 'w-12 h-12' : 'w-10 h-10'} bg-gray-600 hover:bg-gray-700 text-white rounded shadow-lg flex items-center justify-center text-lg transition-colors`}
                title={t('zoom_out')}
              >
                －
              </button>
            </div>
            
            {/* Action Buttons - 編集モードでのみ表示 */}
            {isEditMode && (
              <div className="flex flex-col gap-2 mt-2">
                <button
                  onClick={addNodeAtCenter}
                  className={`${isMobile ? 'w-14 h-14' : 'w-12 h-12'} bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-xl font-bold transition-colors`}
                  title={t('add_node')}
                >
                  ＋
                </button>
                <button
                  onClick={clearAllConnections}
                  className={`${isMobile ? 'w-14 h-14' : 'w-12 h-12'} bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg flex items-center justify-center text-lg transition-colors`}
                  title={t('clear_connections')}
                >
                  ✂
                </button>
                {selectedNodes.length > 0 && (
                  <button
                    onClick={deleteSelectedNodes}
                    className={`${isMobile ? 'w-14 h-14' : 'w-12 h-12'} bg-orange-600 hover:bg-orange-700 text-white rounded-full shadow-lg flex items-center justify-center text-lg transition-colors`}
                    title={t('delete_node')}
                  >
                    🗑️
                  </button>
                )}
              </div>
            )}
          </Panel>
          
          {/* Edge Legend - 右上に凡例を追加 */}
          <Panel position="top-right" className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 m-2 sm:m-4 border border-gray-200 dark:border-gray-700">
            <div className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-300">
              {t('edge_colors')}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-blue-500"></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {t('default')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-green-500"></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {t('habit')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-purple-500"></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {t('goal')}
                </span>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Save Confirmation Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              {t('save_changes_title')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('save_changes_desc')}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelClose}
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleCloseWithoutSaving}
                className="inline-flex items-center justify-center rounded-md bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
              >
                {t('dont_save')}
              </button>
              <button
                onClick={handleSaveAndClose}
                className="inline-flex items-center justify-center rounded-md bg-success text-success-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success"
              >
                {t('save_and_close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu - PC only（編集モードでのみ表示） */}
      {!isMobile && isEditMode && contextMenu && (() => {
        const node = nodes.find(n => n.id === contextMenu.id);
        const nodeType = node?.data.nodeType;
        console.log('[Mindmap] Rendering context menu for node:', contextMenu.id, 'nodeType:', nodeType, 'position:', { top: contextMenu.top, left: contextMenu.left });
        
        return (
          <div
            className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-2 z-[60] min-w-[220px]"
            style={{
              top: contextMenu.top !== undefined ? `${contextMenu.top}px` : undefined,
              left: contextMenu.left !== undefined ? `${contextMenu.left}px` : undefined,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* テキスト編集 */}
            <button
              onClick={handleEditText}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <span>✏️</span>
              {t('edit_text')}
            </button>
            
            <hr className="my-1 border-gray-600" />
            
            {/* 編集オプション（ノードタイプに応じて表示） */}
            {(() => {
              if (nodeType === 'habit') {
                // Habitノードの場合
                return (
                  <button
                    onClick={handleRegisterAsHabit}
                    className="w-full px-4 py-2 text-left text-sm text-green-400 hover:bg-gray-700 hover:text-green-300 flex items-center gap-2 transition-colors"
                  >
                    <span>📝</span>
                    <span>{t('edit_habit')}</span>
                  </button>
                );
              } else if (nodeType === 'goal') {
                // Goalノードの場合
                return (
                  <button
                    onClick={handleRegisterAsGoal}
                    className="w-full px-4 py-2 text-left text-sm text-purple-400 hover:bg-gray-700 hover:text-purple-300 flex items-center gap-2 transition-colors"
                  >
                    <span>📝</span>
                    <span>{t('edit_goal')}</span>
                  </button>
                );
              } else {
                // 通常ノードの場合は登録オプションを表示
                return (
                  <>
                    <button
                      onClick={handleRegisterAsHabit}
                      className="w-full px-4 py-2 text-left text-sm text-green-400 hover:bg-gray-700 hover:text-green-300 flex items-center gap-2 transition-colors"
                    >
                      <span>🔄</span>
                      <span>{t('register_habit')}</span>
                    </button>
                    <button
                      onClick={handleRegisterAsGoal}
                      >
                      className="w-full px-4 py-2 text-left text-sm text-purple-400 hover:bg-gray-700 hover:text-purple-300 flex items-center gap-2 transition-colors"
                      <span>🎯</span>
                      <span>{t('register_goal')}</span>
                    </button>
                  </>
                );
              }
            })()}
            
            <hr className="my-1 border-gray-600" />
            
            {/* 削除 */}
            <button
              onClick={handleDeleteNode}
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 flex items-center gap-2 transition-colors"
            >
              <span>🗑️</span>
              <span>
                {selectedNodes.some(node => node.id === contextMenu.id) && selectedNodes.length > 1
                  ? `${t('delete_node')} (${selectedNodes.length})`
                  : t('delete_node')
                }
              </span>
            </button>
          </div>
        );
      })()}

      {/* Mobile Bottom Menu - 結線オプションを追加（編集モードでのみ表示） */}
      {isMobile && isEditMode && mobileBottomMenu.isVisible && (
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
                <span className="text-sm">{t('edit_text')}</span>
              </button>
              <button
                onClick={() => handleMobileMenuAction('connect')}
                className="flex flex-col items-center justify-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400"
              >
                <span className="text-2xl mb-1">🔗</span>
                <span className="text-sm">{t('connect')}</span>
              </button>
              <button
                onClick={() => handleMobileMenuAction('habit')}
                className="flex flex-col items-center justify-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400"
              >
                <span className="text-2xl mb-1">🔄</span>
                <span className="text-sm">
                  {(() => {
                    const node = nodes.find(n => n.id === mobileBottomMenu.nodeId);
                    if (node?.data.nodeType === 'habit') {
                      return t('edit_habit');
                    }
                    return t('as_habit');
                  })()}
                </span>
              </button>
              <button
                onClick={() => handleMobileMenuAction('goal')}
                className="flex flex-col items-center justify-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400"
              >
                <span className="text-2xl mb-1">🎯</span>
                <span className="text-sm">
                  {(() => {
                    const node = nodes.find(n => n.id === mobileBottomMenu.nodeId);
                    if (node?.data.nodeType === 'goal') {
                      return t('edit_goal');
                    }
                    return t('as_goal');
                  })()}
                </span>
              </button>
            </div>
            <button
              onClick={() => handleMobileMenuAction('delete')}
              className="w-full p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 mb-3"
            >
              <span className="text-xl mr-2">🗑️</span>
              {t('delete_node')}
            </button>
            <button
              onClick={() => setMobileBottomMenu({ nodeId: '', nodeName: '', isVisible: false })}
              className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400"
            >
              {t('cancel')}
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
              {t('connection_mode_title')}
            </div>
            <div className="text-sm mb-2 opacity-90">
              {t('connection_mode_source')}: {nodes.find(n => n.id === connectionMode.sourceNodeId)?.data.label || 'Unknown'}
            </div>
            <div className="text-sm mb-4 opacity-90">
              {t('connection_mode_desc')}
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
                  debug.log('Connection mode cancelled');
                }}
                className="px-6 py-2 bg-white/20 text-white rounded-lg font-medium border border-white/30 hover:bg-white/30 transition-colors"
              >
                {t('cancel')}
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

      {/* Coach-mark（初回のみ） */}
      {showCoachMark && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-lg">
          <div className="text-lg font-semibold mb-2">{t('coach_title')}</div>
          <div className="text-sm text-gray-700 dark:text-gray-300 mb-3">
            {t('coach_desc')}
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => {
                try { window.localStorage.setItem('mindmap_coach_seen', '1'); } catch (e) {}
                setShowCoachMark(false);
              }}
              className="px-3 py-1 bg-blue-600 text-white rounded"
            >
              {t('got_it')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WidgetMindmap(props: MindmapProps) {
  return (
    <ToastProvider>
      <ReactFlowProvider>
        <MindmapFlow {...props} />
      </ReactFlowProvider>
    </ToastProvider>
  );
}
