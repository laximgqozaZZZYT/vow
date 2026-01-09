import { useState, useRef, useCallback } from 'react';
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
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);

  // ドラッグ開始
  const handleDragStart = useCallback((item: DragItem, event?: React.DragEvent) => {
    setDraggedItem(item);
    setIsDragging(true);
    
    if (event) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/json', JSON.stringify(item));
    }
  }, []);

  // ドラッグ終了
  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDropTarget(null);
    setIsDragging(false);
    setTouchStartPos(null);
    
    // ドラッグプレビューを削除
    if (dragPreviewRef.current) {
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
    } else if (draggedItem.type === 'habit' && target.type === 'goal') {
      onMoveHabit(draggedItem.id, target.id!);
    }

    handleDragEnd();
  }, [draggedItem, goals, onMoveGoal, onMoveHabit, handleDragEnd]);

  // ドラッグオーバー処理
  const handleDragOver = useCallback((target: DropTarget, event?: React.DragEvent) => {
    event?.preventDefault();
    setDropTarget(target);
  }, []);

  // タッチ開始
  const handleTouchStart = useCallback((item: DragItem, event: React.TouchEvent) => {
    const touch = event.touches[0];
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });
    
    // 長押し検出のためのタイマー
    const longPressTimer = setTimeout(() => {
      if (touchStartPos) {
        handleDragStart(item);
        createDragPreview(item, touch.clientX, touch.clientY);
        
        // 触覚フィードバック（対応デバイスのみ）
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }
    }, 500); // 500ms長押しでドラッグ開始
    
    // タイマーをクリアするためのクリーンアップ
    const cleanup = () => {
      clearTimeout(longPressTimer);
      setTouchStartPos(null);
    };
    
    // タッチが移動したり終了したりした場合はタイマーをクリア
    const handleTouchMoveOrEnd = () => {
      cleanup();
      document.removeEventListener('touchmove', handleTouchMoveOrEnd);
      document.removeEventListener('touchend', handleTouchMoveOrEnd);
    };
    
    document.addEventListener('touchmove', handleTouchMoveOrEnd);
    document.addEventListener('touchend', handleTouchMoveOrEnd);
  }, [touchStartPos, handleDragStart]);

  // タッチ移動
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (!isDragging || !dragPreviewRef.current) return;
    
    event.preventDefault();
    const touch = event.touches[0];
    
    // ドラッグプレビューの位置を更新
    dragPreviewRef.current.style.left = `${touch.clientX - 50}px`;
    dragPreviewRef.current.style.top = `${touch.clientY - 25}px`;
    
    // ドロップターゲットを検出
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropElement = elementBelow?.closest('[data-drop-target]');
    
    if (dropElement) {
      const targetType = dropElement.getAttribute('data-drop-target-type') as 'goal' | 'root';
      const targetId = dropElement.getAttribute('data-drop-target-id');
      setDropTarget({ type: targetType, id: targetId });
    } else {
      setDropTarget(null);
    }
  }, [isDragging]);

  // タッチ終了
  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (!isDragging) {
      setTouchStartPos(null);
      return;
    }
    
    const touch = event.changedTouches[0];
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropElement = elementBelow?.closest('[data-drop-target]');
    
    if (dropElement && dropTarget) {
      handleDrop(dropTarget);
    } else {
      handleDragEnd();
    }
  }, [isDragging, dropTarget, handleDrop, handleDragEnd]);

  // ドラッグプレビューを作成
  const createDragPreview = useCallback((item: DragItem, x: number, y: number) => {
    const preview = document.createElement('div');
    preview.className = 'drag-preview fixed z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 shadow-lg pointer-events-none';
    preview.style.left = `${x - 50}px`;
    preview.style.top = `${y - 25}px`;
    
    // アイコンとテキストを追加
    const icon = item.type === 'goal' ? '🎯' : '📄';
    preview.innerHTML = `<span style="margin-right: 8px;">${icon}</span>${item.data.name}`;
    
    document.body.appendChild(preview);
    dragPreviewRef.current = preview;
  }, []);

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