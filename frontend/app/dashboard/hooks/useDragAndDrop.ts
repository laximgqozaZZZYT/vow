import { useState, useRef, useCallback, useEffect } from 'react';
import type { Goal, Habit } from '../types';

interface DragItem {
  type: 'goal' | 'habit';
  id: string;
  data: Goal | Habit;
}

interface DropTarget {
  type: 'goal' | 'root';
  id: string | null;
}

interface UseDragAndDropProps {
  goals: Goal[];
  habits: Habit[];
  onMoveGoal: (goalId: string, newParentId: string | null) => void;
  onMoveHabit: (habitId: string, newGoalId: string) => void;
}

export function useDragAndDrop({
  goals,
  habits,
  onMoveGoal,
  onMoveHabit
}: UseDragAndDropProps) {
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // タッチデバイス用の状態
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const pendingItemRef = useRef<DragItem | null>(null);
  const touchPosRef = useRef<{ x: number; y: number } | null>(null);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      if (dragPreviewRef.current && document.body.contains(dragPreviewRef.current)) {
        document.body.removeChild(dragPreviewRef.current);
      }
    };
  }, []);

  // ドラッグプレビューを作成
  const createDragPreview = useCallback((item: DragItem, x: number, y: number) => {
    // 既存のプレビューを削除
    if (dragPreviewRef.current && document.body.contains(dragPreviewRef.current)) {
      document.body.removeChild(dragPreviewRef.current);
    }
    
    const preview = document.createElement('div');
    preview.className = 'drag-preview';
    preview.style.cssText = `
      position: fixed;
      z-index: 9999;
      background: var(--color-card, white);
      border: 2px solid var(--color-primary, #3b82f6);
      border-radius: 8px;
      padding: 8px 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      pointer-events: none;
      font-size: 14px;
      max-width: 200px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      left: ${x - 50}px;
      top: ${y - 25}px;
    `;
    
    const icon = item.type === 'goal' ? '🎯' : '📄';
    preview.innerHTML = `<span style="margin-right: 8px;">${icon}</span>${item.data.name}`;
    
    document.body.appendChild(preview);
    dragPreviewRef.current = preview;
  }, []);

  // ドラッグ開始
  const handleDragStart = useCallback((item: DragItem, event?: React.DragEvent) => {
    setDraggedItem(item);
    setIsDragging(true);
    
    if (event) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/json', JSON.stringify(item));
      
      // カスタムドラッグイメージを設定
      const dragImage = document.createElement('div');
      dragImage.className = 'drag-preview';
      dragImage.style.cssText = `
        position: absolute;
        top: -1000px;
        background: var(--color-card, white);
        border: 2px solid var(--color-primary, #3b82f6);
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 14px;
      `;
      const icon = item.type === 'goal' ? '🎯' : '📄';
      dragImage.innerHTML = `<span style="margin-right: 8px;">${icon}</span>${item.data.name}`;
      document.body.appendChild(dragImage);
      event.dataTransfer.setDragImage(dragImage, 50, 25);
      
      // 次のフレームで削除
      requestAnimationFrame(() => {
        if (document.body.contains(dragImage)) {
          document.body.removeChild(dragImage);
        }
      });
    }
  }, []);

  // ドラッグ終了
  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDropTarget(null);
    setIsDragging(false);
    pendingItemRef.current = null;
    touchPosRef.current = null;
    
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    // ドラッグプレビューを削除
    if (dragPreviewRef.current && document.body.contains(dragPreviewRef.current)) {
      document.body.removeChild(dragPreviewRef.current);
      dragPreviewRef.current = null;
    }
  }, []);

  // ドロップ処理
  const handleDrop = useCallback((target: DropTarget, event?: React.DragEvent) => {
    event?.preventDefault();
    
    if (!draggedItem) return;

    // 自分自身にドロップする場合は何もしない
    if (draggedItem.type === 'goal' && target.type === 'goal' && draggedItem.id === target.id) {
      handleDragEnd();
      return;
    }

    // 循環参照をチェック
    if (draggedItem.type === 'goal' && target.type === 'goal') {
      const isDescendant = checkIfDescendant(target.id!, draggedItem.id, goals);
      if (isDescendant) {
        handleDragEnd();
        return;
      }
    }

    // 移動処理
    if (draggedItem.type === 'goal') {
      const newParentId = target.type === 'goal' ? target.id : null;
      onMoveGoal(draggedItem.id, newParentId);
    } else if (draggedItem.type === 'habit' && target.type === 'goal' && target.id) {
      onMoveHabit(draggedItem.id, target.id);
    }

    handleDragEnd();
  }, [draggedItem, goals, onMoveGoal, onMoveHabit, handleDragEnd]);

  // ドラッグオーバー処理
  const handleDragOver = useCallback((target: DropTarget, event?: React.DragEvent) => {
    event?.preventDefault();
    
    // Habitはrootにドロップできない
    if (draggedItem?.type === 'habit' && target.type === 'root') {
      return;
    }
    
    setDropTarget(target);
  }, [draggedItem]);

  // タッチ開始
  const handleTouchStart = useCallback((item: DragItem, event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchPosRef.current = { x: touch.clientX, y: touch.clientY };
    pendingItemRef.current = item;
    
    // 既存のタイマーをクリア
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    
    // 長押し検出のためのタイマー
    longPressTimerRef.current = setTimeout(() => {
      const currentItem = pendingItemRef.current;
      const currentPos = touchPosRef.current;
      
      if (currentItem && currentPos) {
        setDraggedItem(currentItem);
        setIsDragging(true);
        createDragPreview(currentItem, currentPos.x, currentPos.y);
        
        // 触覚フィードバック
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }
    }, 400);
  }, [createDragPreview]);

  // タッチ移動
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    const startPos = touchPosRef.current;
    
    // ドラッグ開始前に移動した場合、長押しをキャンセル
    if (!isDragging && startPos) {
      const dx = Math.abs(touch.clientX - startPos.x);
      const dy = Math.abs(touch.clientY - startPos.y);
      if (dx > 10 || dy > 10) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        pendingItemRef.current = null;
        return;
      }
    }
    
    if (!isDragging || !dragPreviewRef.current) return;
    
    event.preventDefault();
    
    // ドラッグプレビューの位置を更新
    dragPreviewRef.current.style.left = `${touch.clientX - 50}px`;
    dragPreviewRef.current.style.top = `${touch.clientY - 25}px`;
    
    // ドロップターゲットを検出
    // プレビューを一時的に非表示にして下の要素を検出
    dragPreviewRef.current.style.display = 'none';
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    dragPreviewRef.current.style.display = '';
    
    const dropElement = elementBelow?.closest('[data-drop-target]');
    
    if (dropElement) {
      const targetType = dropElement.getAttribute('data-drop-target-type') as 'goal' | 'root';
      const targetId = dropElement.getAttribute('data-drop-target-id');
      
      // Habitはrootにドロップできない
      if (draggedItem?.type === 'habit' && targetType === 'root') {
        setDropTarget(null);
      } else {
        setDropTarget({ type: targetType, id: targetId });
      }
    } else {
      setDropTarget(null);
    }
  }, [isDragging, draggedItem]);

  // タッチ終了
  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    // 長押しタイマーをクリア
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    if (!isDragging) {
      pendingItemRef.current = null;
      touchPosRef.current = null;
      return;
    }
    
    if (dropTarget) {
      handleDrop(dropTarget);
    } else {
      handleDragEnd();
    }
  }, [isDragging, dropTarget, handleDrop, handleDragEnd]);

  return {
    draggedItem,
    dropTarget,
    isDragging,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    handleDragOver,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  };
}

// 循環参照チェック用のヘルパー関数
function checkIfDescendant(parentId: string, childId: string, goals: Goal[]): boolean {
  const goalsById = Object.fromEntries(goals.map(g => [g.id, g]));
  
  let current = goalsById[parentId];
  while (current && current.parentId) {
    if (current.parentId === childId) {
      return true;
    }
    current = goalsById[current.parentId];
  }
  
  return false;
}