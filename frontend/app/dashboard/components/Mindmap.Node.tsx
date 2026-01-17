import React, { useState, useCallback, useRef } from "react";
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { CustomNodeData } from '../types/mindmap.types';
import { isMobileDevice, getNodeTypeStyles } from '../../../lib/mindmap.utils';
import { debug } from '../../../lib/debug';

// Custom Mindmap Node Component
// This is a fully custom node that replaces React Flow's default nodes
// Features: Double-click editing, Long-press dragging, Custom styling, Mobile touch support
export function MindmapNode({ id, data, selected }: NodeProps<CustomNodeData>) {
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
    
    // 編集モードでない場合は編集を開始しない
    if (typeof window !== 'undefined' && !(window as any).__mindmapEditMode) {
      return;
    }
    
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
    
    // 編集モードでない場合はメニューを表示しない
    if (typeof window !== 'undefined' && !(window as any).__mindmapEditMode) {
      return;
    }
    
    e.stopPropagation();
    
    // 結線モードの状態を直接チェック（グローバル状態から）
    const connectionModeCheckEvent = new CustomEvent('getConnectionModeState');
    let currentConnectionMode = { isActive: false, sourceNodeId: null };
    
    const stateHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      currentConnectionMode = customEvent.detail;
    };
    
    window.addEventListener('connectionModeStateResponse', stateHandler as EventListener);
    window.dispatchEvent(connectionModeCheckEvent);
    
    // 少し待ってから状態をチェック
    setTimeout(() => {
      window.removeEventListener('connectionModeStateResponse', stateHandler as EventListener);
      
      if (currentConnectionMode.isActive) {
        // 結線モードが有効な場合は結線処理を実行
        debug.log(`Connection mode active: connecting node ${currentConnectionMode.sourceNodeId} to ${id}`);
        const connectionEvent = new CustomEvent('executeConnection', {
          detail: { targetNodeId: id }
        });
        window.dispatchEvent(connectionEvent);
      } else {
        // 結線モードでない場合はボトムメニューを表示
        const event = new CustomEvent('showMobileBottomMenu', {
          detail: {
            nodeId: id,
            nodeName: data.label
          }
        });
        window.dispatchEvent(event);
      }
    }, 5);
  }, [isMobile, isEditing, id, data.label]);

  // ハンドルのタッチ開始処理（ドラッグ&ドロップ用）
  const handleHandleTouchStart = useCallback((e: React.TouchEvent, position: string) => {
    if (!isMobile) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    // タッチ開始位置を記録
    const touch = e.touches[0];
    const startPos = { x: touch.clientX, y: touch.clientY };
    
    // ハンドルのドラッグ開始情報を保存
    (window as any).__handleDragInfo = {
      isDragging: false,
      startPos,
      sourceNodeId: id,
      sourceHandleId: position,
      hasMoved: false
    };
    
    debug.log(`Handle touch started from node ${id}, handle ${position}`);
  }, [isMobile, id]);

  // ハンドルのタッチ移動処理
  const handleHandleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    
    const dragInfo = (window as any).__handleDragInfo;
    if (!dragInfo) return;
    
    e.preventDefault(); // スクロールを防止
    
    const touch = e.touches[0];
    const currentPos = { x: touch.clientX, y: touch.clientY };
    const distance = Math.sqrt(
      Math.pow(currentPos.x - dragInfo.startPos.x, 2) +
      Math.pow(currentPos.y - dragInfo.startPos.y, 2)
    );
    
    // 10px以上移動したらドラッグと判定
    if (distance > 10 && !dragInfo.isDragging) {
      dragInfo.isDragging = true;
      dragInfo.hasMoved = true;
      
      // React Flowの接続開始イベントを発火
      const connectStartEvent = new CustomEvent('handleDragStart', {
        detail: {
          nodeId: dragInfo.sourceNodeId,
          handleId: dragInfo.sourceHandleId
        }
      });
      window.dispatchEvent(connectStartEvent);
      
      debug.log(`Handle drag started from node ${dragInfo.sourceNodeId}`);
    }
    
    // ドラッグ中の位置を更新（視覚的フィードバック用）
    if (dragInfo.isDragging) {
      dragInfo.currentPos = currentPos;
    }
  }, [isMobile]);

  // ハンドルのタッチ終了処理
  const handleHandleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    
    const dragInfo = (window as any).__handleDragInfo;
    if (!dragInfo) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    const touch = e.changedTouches[0];
    
    if (dragInfo.hasMoved && dragInfo.isDragging) {
      // ドラッグ終了位置でReact Flowの接続終了イベントを発火
      const connectEndEvent = new CustomEvent('handleDragEnd', {
        detail: {
          clientX: touch.clientX,
          clientY: touch.clientY,
          sourceNodeId: dragInfo.sourceNodeId,
          sourceHandleId: dragInfo.sourceHandleId
        }
      });
      window.dispatchEvent(connectEndEvent);
      
      debug.log(`Handle drag ended at (${touch.clientX}, ${touch.clientY})`);
    } else {
      // 移動していない場合は従来の結線モード（タップ操作）
      const event = new CustomEvent('startMobileConnection', {
        detail: {
          sourceNodeId: dragInfo.sourceNodeId,
          sourceHandleId: dragInfo.sourceHandleId
        }
      });
      window.dispatchEvent(event);
      
      debug.log(`Mobile connection started from node ${dragInfo.sourceNodeId}, handle ${dragInfo.sourceHandleId}`);
    }
    
    // クリーンアップ
    delete (window as any).__handleDragInfo;
  }, [isMobile]);

  // マウスリーブ処理
  const handleMouseLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

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

  const styles = getNodeTypeStyles(data.nodeType, selected);

  return (
    <div 
      ref={nodeRef}
      data-id={id}
      data-testid={`mindmap-node-${id}`}
      className={`mindmap-custom-node px-3 py-2 sm:px-4 sm:py-2 shadow-md rounded-md border-2 min-w-[100px] sm:min-w-[120px] transition-all duration-200 ${
        styles.bgColor
      } ${styles.borderColor} ${styles.hoverColor} ${
        isEditing ? `ring-2 ${styles.ringColor} cursor-text` : 'cursor-pointer'
      } ${
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
        className={`${isMobile ? 'w-16 h-16' : 'w-8 h-8'} bg-blue-500 border-3 border-white rounded-full shadow-lg hover:bg-blue-600 hover:scale-110 transition-all`} 
        style={{ 
          top: isMobile ? -32 : -16,
          zIndex: 10
        }}
        onTouchStart={isMobile ? (e) => handleHandleTouchStart(e, 'top') : undefined}
        onTouchMove={isMobile ? handleHandleTouchMove : undefined}
        onTouchEnd={isMobile ? handleHandleTouchEnd : undefined}
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className={`${isMobile ? 'w-16 h-16' : 'w-8 h-8'} bg-blue-500 border-3 border-white rounded-full shadow-lg hover:bg-blue-600 hover:scale-110 transition-all`} 
        style={{ 
          bottom: isMobile ? -32 : -16,
          zIndex: 10
        }}
        onTouchStart={isMobile ? (e) => handleHandleTouchStart(e, 'bottom') : undefined}
        onTouchMove={isMobile ? handleHandleTouchMove : undefined}
        onTouchEnd={isMobile ? handleHandleTouchEnd : undefined}
      />
      <Handle 
        type="target" 
        position={Position.Left} 
        className={`${isMobile ? 'w-16 h-16' : 'w-8 h-8'} bg-blue-500 border-3 border-white rounded-full shadow-lg hover:bg-blue-600 hover:scale-110 transition-all`} 
        style={{ 
          left: isMobile ? -32 : -16,
          zIndex: 10
        }}
        onTouchStart={isMobile ? (e) => handleHandleTouchStart(e, 'left') : undefined}
        onTouchMove={isMobile ? handleHandleTouchMove : undefined}
        onTouchEnd={isMobile ? handleHandleTouchEnd : undefined}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className={`${isMobile ? 'w-16 h-16' : 'w-8 h-8'} bg-blue-500 border-3 border-white rounded-full shadow-lg hover:bg-blue-600 hover:scale-110 transition-all`} 
        style={{ 
          right: isMobile ? -32 : -16,
          zIndex: 10
        }}
        onTouchStart={isMobile ? (e) => handleHandleTouchStart(e, 'right') : undefined}
        onTouchMove={isMobile ? handleHandleTouchMove : undefined}
        onTouchEnd={isMobile ? handleHandleTouchEnd : undefined}
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
export const customNodeTypes = {
  mindmapNode: MindmapNode,
};
