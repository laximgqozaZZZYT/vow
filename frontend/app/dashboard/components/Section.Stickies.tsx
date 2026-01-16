import { useState } from 'react';
import type { Sticky } from '../types/index';
import { useHandedness } from '../contexts/HandednessContext';

interface StickiesSectionProps {
  stickies: Sticky[];
  onStickyCreate: () => void;
  onStickyEdit: (stickyId: string) => void;
  onStickyComplete: (stickyId: string) => void;
  onStickyDelete: (stickyId: string) => void;
  onStickyNameChange: (stickyId: string, name: string) => void;
}

export default function StickiesSection({
  stickies,
  onStickyCreate,
  onStickyEdit,
  onStickyComplete,
  onStickyDelete,
  onStickyNameChange
}: StickiesSectionProps) {
  const { isLeftHanded } = useHandedness();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleNameClick = (sticky: Sticky) => {
    // 名前をクリックしたら編集モードに入る
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
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent, stickyId: string) => {
    if (touchStart === null) return;
    
    const currentTouch = e.touches[0].clientX;
    const diff = touchStart - currentTouch;
    
    // スワイプ距離が50px以上で完了扱い
    if (Math.abs(diff) > 50) {
      setSwipedId(stickyId);
    }
  };

  const handleTouchEnd = (stickyId: string) => {
    if (swipedId === stickyId) {
      onStickyComplete(stickyId);
      setSwipedId(null);
    }
    setTouchStart(null);
  };

  const incompletedStickies = stickies.filter(s => !s.completed);
  const completedStickies = stickies.filter(s => s.completed);

  return (
    <section className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4 sm:p-6">
      <div className={`flex items-center ${isLeftHanded ? 'justify-end' : 'justify-between'} mb-3`}>
        <h2 className="text-lg font-semibold">Sticky'n</h2>
        <button
          onClick={onStickyCreate}
          className="ml-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold transition-colors"
          title="Add Sticky'n"
        >
          +
        </button>
      </div>

      {incompletedStickies.length === 0 && completedStickies.length === 0 ? (
        <div className="text-sm text-muted-foreground">No Sticky'n items yet</div>
      ) : (
        <div className="space-y-2">
          {/* 未完了のSticky'n */}
          {incompletedStickies.map((sticky) => (
            <div
              key={sticky.id}
              className={`flex items-center gap-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-yellow-50 dark:bg-yellow-900/20 transition-transform ${
                swipedId === sticky.id ? 'translate-x-[-100%] opacity-50' : ''
              } ${isLeftHanded ? 'flex-row-reverse' : ''}`}
              onTouchStart={(e) => handleTouchStart(e, sticky.id)}
              onTouchMove={(e) => handleTouchMove(e, sticky.id)}
              onTouchEnd={() => handleTouchEnd(sticky.id)}
            >
              {/* チェックボックス */}
              <input
                type="checkbox"
                checked={false}
                onChange={() => onStickyComplete(sticky.id)}
                className="w-5 h-5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />

              {/* 名前 */}
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
                    className="w-full px-2 py-1 text-sm border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800"
                  />
                ) : (
                  <div
                    onClick={() => handleNameClick(sticky)}
                    className="text-sm text-zinc-800 dark:text-zinc-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {sticky.name || 'New Sticky\'n'}
                  </div>
                )}
                {sticky.description && (
                  <div className="text-xs text-zinc-500 mt-1 truncate">
                    {sticky.description}
                  </div>
                )}
              </div>

              {/* アクションボタン */}
              <div className={`flex gap-1 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
                <button
                  onClick={() => onStickyEdit(sticky.id)}
                  className="px-2 py-1 text-xs bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 rounded transition-colors"
                  title="Edit"
                >
                  Edit
                </button>
                <button
                  onClick={() => onStickyDelete(sticky.id)}
                  className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded transition-colors"
                  title="Delete"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {/* 完了済みのSticky'n */}
          {completedStickies.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <div className="text-xs text-zinc-500 mb-2">Completed</div>
              {completedStickies.map((sticky) => (
                <div
                  key={sticky.id}
                  className={`flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 opacity-60 ${isLeftHanded ? 'flex-row-reverse' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={() => onStickyComplete(sticky.id)}
                    className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0 text-sm line-through text-zinc-500">
                    {sticky.name || 'Unnamed'}
                  </div>
                  <button
                    onClick={() => onStickyDelete(sticky.id)}
                    className="px-2 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded transition-colors"
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
