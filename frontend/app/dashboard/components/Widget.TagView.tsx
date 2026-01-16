import { useState, useMemo } from 'react';
import type { Habit, Tag, Activity } from '../types';
import './HabitNameScroll.css';

// JST日付範囲でのActivity集計関数
function calculateDailyWorkload(habitId: string, activities: Activity[]): number {
  const now = new Date();
  const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
  
  const todayStartJST = new Date(jstTime);
  todayStartJST.setHours(0, 0, 0, 0);
  
  const todayEndJST = new Date(jstTime);
  todayEndJST.setHours(23, 59, 59, 999);
  
  const todayActivities = activities.filter(activity => {
    if (activity.habitId !== habitId || !activity.timestamp) return false;
    
    const activityTime = new Date(activity.timestamp);
    const activityJST = new Date(activityTime.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
    
    return activityJST >= todayStartJST && activityJST <= todayEndJST;
  });
  
  return todayActivities
    .filter(activity => activity.kind === 'complete')
    .reduce((sum, activity) => sum + (activity.amount || 1), 0);
}

// JST日次ベースでのHabit完了判定
function isHabitCompletedToday(habit: Habit, activities: Activity[]): boolean {
  if (!habit.active || habit.type !== 'do') return false;
  
  const totalCount = (habit as any).workloadTotal || habit.must || 1;
  const currentCount = calculateDailyWorkload(habit.id, activities);
  
  return currentCount >= totalCount;
}

interface TagViewProps {
  habits: Habit[];
  activities: Activity[];
  onHabitEdit: (habitId: string) => void;
  onHabitAction: (habitId: string, action: 'start' | 'complete' | 'pause', amount?: number) => void;
}

export default function TagView({ 
  habits,
  activities,
  onHabitEdit,
  onHabitAction
}: TagViewProps) {
  const [openTags, setOpenTags] = useState<Record<string, boolean>>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  // Habitをタグでグループ化
  const habitsByTag = useMemo(() => {
    const grouped: Record<string, Habit[]> = {
      'untagged': [] // タグなしのHabit用
    };

    habits.forEach(habit => {
      if (!habit.tags || habit.tags.length === 0) {
        grouped['untagged'].push(habit);
      } else {
        habit.tags.forEach(tag => {
          if (!grouped[tag.id]) {
            grouped[tag.id] = [];
          }
          grouped[tag.id].push(habit);
        });
      }
    });

    return grouped;
  }, [habits]);

  // タグ情報を収集（重複排除）
  const allTags = useMemo(() => {
    const tagMap = new Map<string, Tag>();
    habits.forEach(habit => {
      habit.tags?.forEach(tag => {
        if (!tagMap.has(tag.id)) {
          tagMap.set(tag.id, tag);
        }
      });
    });
    return Array.from(tagMap.values());
  }, [habits]);

  const toggleTag = (tagId: string) => {
    setOpenTags(prev => ({ ...prev, [tagId]: !prev[tagId] }));
  };

  const getInputValue = (habitId: string) => {
    if (inputValues[habitId] !== undefined) {
      return inputValues[habitId];
    }
    const habit = habits.find(h => h.id === habitId);
    const workloadPerCount = (habit as any)?.workloadPerCount ?? 1;
    return String(workloadPerCount);
  };

  const setInputValue = (habitId: string, value: string) => {
    setInputValues(prev => ({ ...prev, [habitId]: value }));
  };

  const handleCompleteWithAmount = (habitId: string) => {
    const amount = parseFloat(getInputValue(habitId)) || 1;
    onHabitAction(habitId, 'complete', amount);
  };

  const renderHabitActions = (h: Habit) => (
    <div className="flex items-center gap-1.5 shrink-0">
      <input
        type="number"
        min="0"
        step="0.1"
        value={getInputValue(h.id)}
        onChange={(e) => setInputValue(h.id, e.target.value)}
        className="w-10 sm:w-12 text-xs text-center bg-zinc-100 dark:bg-zinc-800 border-0 rounded px-1 py-1 sm:py-0.5 focus:ring-1 focus:ring-blue-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        onClick={(e) => e.stopPropagation()}
      />
      <span className="text-xs text-zinc-500 hidden sm:inline w-16 text-left truncate" title={(h as any)?.workloadUnit || 'units'}>
        {(h as any)?.workloadUnit || 'units'}
      </span>
      <button
        title="Complete"
        onClick={(e) => { e.stopPropagation(); handleCompleteWithAmount(h.id) }}
        className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded px-2 py-1 text-xs font-medium transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
      >
        ✓
      </button>
    </div>
  );

  const renderHabit = (habit: Habit) => {
    const isCompleted = isHabitCompletedToday(habit, activities);
    
    return (
      <div
        key={habit.id}
        onClick={() => onHabitEdit(habit.id)}
        className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm ${
          (isCompleted || !habit.active) ? 'line-through text-zinc-400' : 'text-zinc-700 dark:text-zinc-200'
        } hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="shrink-0">📄</span>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="habit-name-scroll min-w-0 overflow-hidden">
              <span className="habit-name-text inline-block whitespace-nowrap">{habit.name}</span>
            </div>
            {(habit as any)?.workloadUnit && (
              <span className="text-xs text-zinc-500 truncate">
                Target: {(habit as any)?.workloadPerCount || 1} {(habit as any)?.workloadUnit}
              </span>
            )}
          </div>
        </div>
        {renderHabitActions(habit)}
      </div>
    );
  };

  return (
    <nav className="space-y-2">
      {/* タグ付きHabit */}
      {allTags.map(tag => {
        const tagHabits = habitsByTag[tag.id] || [];
        const isOpen = openTags[tag.id];
        
        return (
          <div key={tag.id}>
            <div 
              className="flex items-center justify-between cursor-pointer rounded px-3 py-2 hover:bg-zinc-100 dark:hover:bg-white/5"
              onClick={() => toggleTag(tag.id)}
            >
              <div className="flex items-center gap-2">
                <button className="inline-block w-3">{isOpen ? '▾' : '▸'}</button>
                <div className="flex items-center gap-2">
                  {tag.color && (
                    <span 
                      className="inline-block w-3 h-3 rounded-full" 
                      style={{ backgroundColor: tag.color }}
                    />
                  )}
                  <span className="text-sm font-medium">{tag.name}</span>
                </div>
              </div>
              <span className="text-xs text-zinc-500">{tagHabits.length}</span>
            </div>
            
            {isOpen && (
              <div className="ml-6 mt-1 flex flex-col gap-1">
                {tagHabits.length > 0 ? (
                  tagHabits.map(renderHabit)
                ) : (
                  <div className="px-2 py-1 text-xs text-zinc-500">(no habits)</div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* タグなしHabit */}
      {habitsByTag['untagged'] && habitsByTag['untagged'].length > 0 && (
        <div>
          <div 
            className="flex items-center justify-between cursor-pointer rounded px-3 py-2 hover:bg-zinc-100 dark:hover:bg-white/5"
            onClick={() => toggleTag('untagged')}
          >
            <div className="flex items-center gap-2">
              <button className="inline-block w-3">{openTags['untagged'] ? '▾' : '▸'}</button>
              <span className="text-sm font-medium text-zinc-500">Untagged</span>
            </div>
            <span className="text-xs text-zinc-500">{habitsByTag['untagged'].length}</span>
          </div>
          
          {openTags['untagged'] && (
            <div className="ml-6 mt-1 flex flex-col gap-1">
              {habitsByTag['untagged'].map(renderHabit)}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
