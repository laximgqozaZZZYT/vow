import { useState, useRef, useEffect, useMemo } from 'react';
import type { Sticky } from '../types/index';
import { useHandedness } from '../contexts/HandednessContext';
import api from '../../../lib/api';

type GroupBy = 'none' | 'habit' | 'goal' | 'tag';

interface StickiesSectionProps {
  stickies: Sticky[];
  onStickyCreate: () => Promise<Sticky | void>;
  onStickyEdit: (stickyId: string) => void;
  onStickyComplete: (stickyId: string) => void;
  onStickyDelete: (stickyId: string) => void;
  onStickyNameChange: (stickyId: string, name: string) => void;
  onStickyUpdate?: () => void; // 関連更新後のコールバック
}

interface GroupedStickies {
  id: string;
  name: string;
  color?: string;
  stickies: Sticky[];
}

export default function StickiesSection({
  stickies,
  onStickyCreate,
  onStickyEdit,
  onStickyComplete,
  onStickyDelete,
  onStickyNameChange,
  onStickyUpdate
}: StickiesSectionProps) {
  const { isLeftHanded } = useHandedness();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [newStickyId, setNewStickyId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const stickyRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // ドラッグ&ドロップ状態
  const [draggedStickyId, setDraggedStickyId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  
  // モバイルロングプレス状態
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isDraggingMobile, setIsDraggingMobile] = useState(false);
  const [mobileDragPosition, setMobileDragPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (newStickyId) {
      const element = stickyRefs.current.get(newStickyId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('animate-highlight');
        setTimeout(() => {
          element.classList.remove('animate-highlight');
          setNewStickyId(null);
        }, 1500);
      }
    }
  }, [newStickyId, stickies]);

  const handleCreate = async () => {
    const result = await onStickyCreate();
    if (result && 'id' in result) {
      setNewStickyId(result.id);
    }
  };

  const handleNameClick = (sticky: Sticky) => {
    setEditingId(sticky.id);
    setEditingName(sticky.name || '');
  };

  const handleNameBlur = (stickyId: string) => {
    if (editingName.trim()) {
      onStickyNameChange(stickyId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleTouchStart = (e: React.TouchEvent, stickyId: string) => {
    if (groupBy === 'none') {
      // グループ化されていない場合は従来のスワイプ動作
      setTouchStart(e.touches[0].clientX);
      return;
    }
    
    // グループ化されている場合はロングプレスでドラッグ開始
    const touch = e.touches[0];
    const timer = setTimeout(() => {
      setDraggedStickyId(stickyId);
      setIsDraggingMobile(true);
      setMobileDragPosition({ x: touch.clientX, y: touch.clientY });
      // 振動フィードバック（対応デバイスのみ）
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500); // 500msロングプレス
    
    setLongPressTimer(timer);
  };

  const handleTouchMove = (e: React.TouchEvent, stickyId: string) => {
    if (isDraggingMobile && draggedStickyId === stickyId) {
      // ドラッグ中の位置更新
      const touch = e.touches[0];
      setMobileDragPosition({ x: touch.clientX, y: touch.clientY });
      
      // ドロップターゲットの検出
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const groupElement = element?.closest('[data-group-id]');
      if (groupElement) {
        const groupId = groupElement.getAttribute('data-group-id');
        setDragOverGroupId(groupId);
      } else {
        setDragOverGroupId(null);
      }
      
      e.preventDefault();
      return;
    }
    
    if (groupBy === 'none' && touchStart !== null) {
      // 従来のスワイプ動作
      const currentTouch = e.touches[0].clientX;
      const diff = touchStart - currentTouch;
      if (Math.abs(diff) > 50) {
        setSwipedId(stickyId);
      }
    }
    
    // ロングプレスタイマーをキャンセル（移動した場合）
    if (longPressTimer && !isDraggingMobile) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleTouchEnd = async (stickyId: string) => {
    // ロングプレスタイマーをクリア
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    if (isDraggingMobile && draggedStickyId === stickyId && dragOverGroupId) {
      // モバイルドラッグ&ドロップ完了
      await handleDrop(new Event('drop') as any, dragOverGroupId);
      setIsDraggingMobile(false);
      setMobileDragPosition(null);
      return;
    }
    
    if (swipedId === stickyId && groupBy === 'none') {
      // 従来のスワイプ完了動作
      onStickyComplete(stickyId);
      setSwipedId(null);
    }
    
    setTouchStart(null);
    setIsDraggingMobile(false);
    setMobileDragPosition(null);
    setDraggedStickyId(null);
    setDragOverGroupId(null);
  };

  // ドラッグ&ドロップハンドラー
  const handleDragStart = (e: React.DragEvent, stickyId: string) => {
    if (groupBy === 'none') return; // グループ化されていない場合は無効
    setDraggedStickyId(stickyId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, groupId: string) => {
    if (!draggedStickyId || groupBy === 'none') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverGroupId(groupId);
  };

  const handleDragLeave = () => {
    setDragOverGroupId(null);
  };

  const handleDrop = async (e: React.DragEvent | Event, targetGroupId: string) => {
    if ('preventDefault' in e) {
      e.preventDefault();
    }
    if (!draggedStickyId || groupBy === 'none') return;

    const sticky = stickies.find(s => s.id === draggedStickyId);
    if (!sticky) return;

    try {
      if (targetGroupId === 'ungrouped') {
        // 「その他」グループへの移動 = 関連を削除
        if (groupBy === 'habit' && sticky.habits) {
          for (const habit of sticky.habits) {
            await api.removeStickyHabit(draggedStickyId, habit.id);
          }
        } else if (groupBy === 'goal' && sticky.goals) {
          for (const goal of sticky.goals) {
            await api.removeStickyGoal(draggedStickyId, goal.id);
          }
        } else if (groupBy === 'tag' && sticky.tags) {
          for (const tag of sticky.tags) {
            await api.removeStickyTag(draggedStickyId, tag.id);
          }
        }
      } else {
        // 特定のグループへの移動 = 関連を追加
        if (groupBy === 'habit') {
          // 既存のHabit関連を削除
          if (sticky.habits) {
            for (const habit of sticky.habits) {
              await api.removeStickyHabit(draggedStickyId, habit.id);
            }
          }
          // 新しいHabit関連を追加
          await api.addStickyHabit(draggedStickyId, targetGroupId);
        } else if (groupBy === 'goal') {
          // 既存のGoal関連を削除
          if (sticky.goals) {
            for (const goal of sticky.goals) {
              await api.removeStickyGoal(draggedStickyId, goal.id);
            }
          }
          // 新しいGoal関連を追加
          await api.addStickyGoal(draggedStickyId, targetGroupId);
        } else if (groupBy === 'tag') {
          // 既存のTag関連を削除
          if (sticky.tags) {
            for (const tag of sticky.tags) {
              await api.removeStickyTag(draggedStickyId, tag.id);
            }
          }
          // 新しいTag関連を追加
          await api.addStickyTag(draggedStickyId, targetGroupId);
        }
      }

      // 状態をリセット
      setDraggedStickyId(null);
      setDragOverGroupId(null);

      // 親コンポーネントに更新を通知
      if (onStickyUpdate) {
        onStickyUpdate();
      }
    } catch (error) {
      console.error('Failed to update sticky relations:', error);
      alert('Failed to move sticky. Please try again.');
      setDraggedStickyId(null);
      setDragOverGroupId(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedStickyId(null);
    setDragOverGroupId(null);
  };

  const incompletedStickies = stickies.filter(s => !s.completed);
  const completedStickies = stickies.filter(s => s.completed);

  const groupedIncomplete = useMemo((): GroupedStickies[] => {
    if (groupBy === 'none') {
      return [{ id: 'all', name: '', stickies: incompletedStickies }];
    }

    const groups = new Map<string, GroupedStickies>();
    const ungrouped: Sticky[] = [];

    incompletedStickies.forEach(sticky => {
      let assigned = false;

      if (groupBy === 'habit' && sticky.habits && sticky.habits.length > 0) {
        sticky.habits.forEach(habit => {
          if (!groups.has(habit.id)) {
            groups.set(habit.id, { id: habit.id, name: habit.name, stickies: [] });
          }
          groups.get(habit.id)!.stickies.push(sticky);
          assigned = true;
        });
      } else if (groupBy === 'goal' && sticky.goals && sticky.goals.length > 0) {
        sticky.goals.forEach(goal => {
          if (!groups.has(goal.id)) {
            groups.set(goal.id, { id: goal.id, name: goal.name, stickies: [] });
          }
          groups.get(goal.id)!.stickies.push(sticky);
          assigned = true;
        });
      } else if (groupBy === 'tag' && sticky.tags && sticky.tags.length > 0) {
        sticky.tags.forEach(tag => {
          if (!groups.has(tag.id)) {
            groups.set(tag.id, { id: tag.id, name: tag.name, color: tag.color, stickies: [] });
          }
          groups.get(tag.id)!.stickies.push(sticky);
          assigned = true;
        });
      }

      if (!assigned) {
        ungrouped.push(sticky);
      }
    });

    const result = Array.from(groups.values());
    if (ungrouped.length > 0) {
      result.push({ id: 'ungrouped', name: 'その他', stickies: ungrouped });
    }
    return result;
  }, [incompletedStickies, groupBy]);

  const renderStickyItem = (sticky: Sticky, isCompleted: boolean = false) => (
    <div
      key={sticky.id}
      ref={(el) => {
        if (el) stickyRefs.current.set(sticky.id, el);
        else stickyRefs.current.delete(sticky.id);
      }}
      draggable={!isCompleted && groupBy !== 'none'}
      onDragStart={(e) => handleDragStart(e, sticky.id)}
      onDragEnd={handleDragEnd}
      className={`group flex items-start gap-3 p-3 rounded-lg transition-all duration-200 ${
        isCompleted 
          ? 'bg-zinc-800/50' 
          : 'bg-zinc-800 hover:bg-zinc-700/80'
      } ${swipedId === sticky.id ? 'translate-x-[-100%] opacity-50' : ''} ${
        isLeftHanded ? 'flex-row-reverse' : ''
      } ${newStickyId === sticky.id ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-zinc-900' : ''} ${
        draggedStickyId === sticky.id ? 'opacity-50 scale-95' : ''
      } ${
        groupBy !== 'none' && !isCompleted ? 'cursor-move touch-none' : ''
      }`}
      onTouchStart={(e) => !isCompleted && handleTouchStart(e, sticky.id)}
      onTouchMove={(e) => !isCompleted && handleTouchMove(e, sticky.id)}
      onTouchEnd={() => !isCompleted && handleTouchEnd(sticky.id)}
    >
      {/* チェックボックス */}
      <button
        onClick={() => onStickyComplete(sticky.id)}
        className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center transition-colors ${
          isCompleted
            ? 'bg-emerald-600 text-white'
            : 'bg-zinc-700 border-2 border-zinc-600 hover:border-emerald-500'
        }`}
        title={isCompleted ? '未完了に戻す' : '完了にする'}
      >
        {isCompleted && (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* コンテンツ */}
      <div className="flex-1 min-w-0">
        {editingId === sticky.id ? (
          <input
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={() => handleNameBlur(sticky.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameBlur(sticky.id);
              if (e.key === 'Escape') {
                setEditingId(null);
                setEditingName('');
              }
            }}
            autoFocus
            placeholder="Enter name..."
            className="w-full px-2 py-1 text-sm bg-zinc-700 border border-zinc-600 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-100"
          />
        ) : (
          <div
            onClick={() => !isCompleted && handleNameClick(sticky)}
            className={`text-sm leading-relaxed cursor-pointer ${
              isCompleted 
                ? 'line-through text-zinc-500' 
                : 'text-zinc-100 hover:text-white'
            }`}
          >
            {sticky.name || 'New Sticky\'n'}
          </div>
        )}
        {sticky.description && !isCompleted && (
          <div className="text-xs text-zinc-500 mt-1 line-clamp-2">
            {sticky.description}
          </div>
        )}
      </div>

      {/* アクションボタン */}
      <div className={`flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
        {!isCompleted && (
          <button
            onClick={() => onStickyEdit(sticky.id)}
            className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Edit
          </button>
        )}
        <button
          onClick={() => onStickyDelete(sticky.id)}
          className="px-2 py-1 text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );

  const renderGroupedSection = (group: GroupedStickies) => {
    if (group.id === 'all') {
      return (
        <div key="all" className="space-y-2">
          {group.stickies.map(sticky => renderStickyItem(sticky))}
        </div>
      );
    }

    const isDropTarget = dragOverGroupId === group.id;

    return (
      <div 
        key={group.id}
        data-group-id={group.id}
        className={`space-y-2 rounded-lg p-2 transition-all ${
          isDropTarget ? 'ring-2 ring-emerald-500 bg-emerald-500/10' : ''
        }`}
        onDragOver={(e) => handleDragOver(e, group.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, group.id)}
      >
        {/* グループヘッダー */}
        <div className="flex items-center gap-2 py-2 px-2">
          {group.color && (
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0" 
              style={{ backgroundColor: group.color }}
            />
          )}
          <span className="text-sm font-semibold text-zinc-200">
            {group.name}
          </span>
          <span className="text-xs text-zinc-500">
            ({group.stickies.length})
          </span>
          {isDropTarget && (
            <span className="text-xs text-emerald-500 ml-auto animate-pulse">
              📍 Drop here
            </span>
          )}
        </div>
        {/* グループ内のSticky */}
        <div className="space-y-2">
          {group.stickies.map(sticky => renderStickyItem(sticky))}
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 sm:p-5">
      {/* ヘッダー */}
      <div className={`flex items-center gap-3 mb-4 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
        <h2 className="text-base font-semibold text-zinc-100">Sticky&apos;n</h2>
        <div className="flex-1" />
        
        {/* グループ化セレクト */}
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          className="text-xs px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="none">グループなし</option>
          <option value="habit">Habitで分類</option>
          <option value="goal">Goalで分類</option>
          <option value="tag">Tagで分類</option>
        </select>

        {/* 追加ボタン */}
        <button
          onClick={handleCreate}
          className="w-7 h-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 hover:text-white transition-colors"
          title="Add Sticky'n"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* コンテンツ */}
      <div className="space-y-3">
        {incompletedStickies.length === 0 && completedStickies.length === 0 ? (
          <div className="text-sm text-zinc-500 py-8 text-center">
            No Sticky&apos;n items yet
          </div>
        ) : (
          <>
            {/* 未完了 */}
            {groupedIncomplete.map(group => renderGroupedSection(group))}

            {/* 完了済みセクション */}
            {completedStickies.length > 0 && (
              <div className="pt-3 border-t border-zinc-800">
                <button
                  onClick={() => setShowCompleted(!showCompleted)}
                  className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-400 transition-colors mb-2"
                >
                  <svg 
                    className={`w-3 h-3 transition-transform ${showCompleted ? 'rotate-90' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  完了済み ({completedStickies.length})
                </button>
                {showCompleted && (
                  <div className="space-y-2">
                    {completedStickies.map((sticky) => renderStickyItem(sticky, true))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes highlight {
          0%, 100% { box-shadow: 0 0 0 0 transparent; }
          50% { box-shadow: 0 0 0 4px rgb(16 185 129 / 0.5); }
        }
        :global(.animate-highlight) {
          animation: highlight 0.75s ease-in-out 2;
        }
      `}</style>
    </section>
  );
}
