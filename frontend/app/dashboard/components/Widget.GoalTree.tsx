import { useState, useMemo } from 'react';
import type { Goal, Habit, Activity } from '../types';
import { useDragAndDrop } from '../hooks/useDragAndDrop';
import './DragAndDrop.css';
import './HabitNameScroll.css';

// JST日付範囲でのActivity集計関数（Section.Activity.tsxと同じ）
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

interface GoalTreeProps {
  goals: Goal[];
  habits: Habit[];
  activities: Activity[]; // 追加
  selectedGoal: string | null;
  onGoalSelect: (goalId: string | null) => void;
  onGoalEdit: (goalId: string) => void;
  onHabitEdit: (habitId: string) => void;
  onHabitAction: (habitId: string, action: 'start' | 'complete' | 'pause', amount?: number) => void;
  onMoveGoal: (goalId: string, newParentId: string | null) => void;
  onMoveHabit: (habitId: string, newGoalId: string) => void;
}

interface GoalNodeProps {
  goal: Goal;
  depth?: number;
  habits: Habit[];
  activities: Activity[]; // 追加
  selectedGoal: string | null;
  openGoals: Record<string, boolean>;
  onlyHabit: Record<string, boolean>;
  goalsById: Record<string, Goal>;
  onToggleGoal: (id: string) => void;
  onGoalSelect: (goalId: string) => void;
  onGoalEdit: (goalId: string) => void;
  onHabitEdit: (habitId: string) => void;
  onHabitAction: (habitId: string, action: 'start' | 'complete' | 'pause', amount?: number) => void;
  onSetOnlyHabitFor: (goalId: string, value: boolean) => void;
  childrenOf: (id: string) => Goal[];
  effectiveOnlyHabit: (goalId: string) => boolean;
  effectiveGoalCompleted: (goalId: string) => boolean;
  isDescendantOf: (childGoalId: string, ancestorGoalId: string) => boolean;
  // ドラッグ&ドロップ関連
  draggedItem: any;
  dropTarget: any;
  isDragging: boolean;
  onDragStart: (item: any, event?: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (target: any, event?: React.DragEvent) => void;
  onDragOver: (target: any, event?: React.DragEvent) => void;
  onTouchStart: (item: any, event: React.TouchEvent) => void;
  onTouchMove: (event: React.TouchEvent) => void;
  onTouchEnd: (event: React.TouchEvent) => void;
}

function GoalNode({ 
  goal, 
  depth = 1, 
  habits,
  activities, // 追加
  selectedGoal,
  openGoals,
  onlyHabit,
  goalsById,
  onToggleGoal,
  onGoalSelect,
  onGoalEdit,
  onHabitEdit,
  onHabitAction,
  onSetOnlyHabitFor,
  childrenOf,
  effectiveOnlyHabit,
  effectiveGoalCompleted,
  isDescendantOf,
  draggedItem,
  dropTarget,
  isDragging,
  onDragStart,
  onDragEnd,
  onDrop,
  onDragOver,
  onTouchStart,
  onTouchMove,
  onTouchEnd
}: GoalNodeProps) {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  
  const isOpen = !!openGoals[goal.id];
  const kids = childrenOf(goal.id);
  const myHabits = habits.filter(h => h.goalId === goal.id);
  const goalCompleted = effectiveGoalCompleted(goal.id);

  // ドロップターゲットかどうかを判定
  const isDropTarget = dropTarget?.type === 'goal' && dropTarget?.id === goal.id;
  const isDraggedItem = draggedItem?.type === 'goal' && draggedItem?.id === goal.id;

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

  return (
    <div key={goal.id}>
      <div 
        className={`flex items-center justify-between cursor-pointer rounded px-3 py-2 hover:bg-zinc-100 dark:hover:bg-white/5 draggable ${
          selectedGoal === goal.id ? 'bg-zinc-100 dark:bg-white/5' : ''
        } ${isDropTarget ? 'drop-target' : ''} ${
          isDraggedItem ? 'dragging' : ''
        }`}
        draggable={!isDragging}
        data-drop-target="true"
        data-drop-target-type="goal"
        data-drop-target-id={goal.id}
        onDragStart={(e) => onDragStart({ type: 'goal', id: goal.id, data: goal }, e)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          onDragOver({ type: 'goal', id: goal.id });
        }}
        onDrop={(e) => onDrop({ type: 'goal', id: goal.id }, e)}
        onTouchStart={(e) => onTouchStart({ type: 'goal', id: goal.id, data: goal }, e)}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex items-center gap-2">
          <button onClick={() => { onToggleGoal(goal.id); onGoalSelect(goal.id); }} className="inline-block w-3">{isOpen ? '▾' : '▸'}</button>
          <button onClick={() => onGoalEdit(goal.id)} className={`text-sm font-medium text-left ${goalCompleted ? 'line-through text-zinc-400' : ''}`}>{goal.name}</button>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={!!onlyHabit[goal.id]}
              onChange={(e) => { e.stopPropagation(); onSetOnlyHabitFor(goal.id, e.target.checked) }}
            />
            <span>Only Habit</span>
          </label>
        </div>
      </div>

      {isOpen && (
        <div className={`ml-6 mt-1 flex flex-col gap-1 ${depth >= 3 ? 'mb-2' : ''}`}>
          {effectiveOnlyHabit(goal.id) ? (
            // show all habits under this goal regardless of depth
            (() => {
              const nestedHabits = habits.filter(h => isDescendantOf(h.goalId, goal.id))
              return nestedHabits.length > 0 ? nestedHabits.map(h => {
                const isHabitDropTarget = dropTarget?.type === 'goal' && dropTarget?.id === goal.id && draggedItem?.type === 'habit';
                const isDraggedHabit = draggedItem?.type === 'habit' && draggedItem?.id === h.id;
                
                return (
                  <div
                    key={h.id}
                    onClick={() => { onGoalSelect(goal.id); onHabitEdit(h.id); }}
                    className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm draggable ${
                      (isHabitCompletedToday(h, activities) || goalCompleted || !h.active) ? 'line-through text-zinc-400' : 'text-zinc-700 dark:text-zinc-200'
                    } hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer ${
                      isDraggedHabit ? 'dragging' : ''
                    }`}
                    draggable={!isDragging}
                    onDragStart={(e) => onDragStart({ type: 'habit', id: h.id, data: h }, e)}
                    onDragEnd={onDragEnd}
                    onTouchStart={(e) => onTouchStart({ type: 'habit', id: h.id, data: h }, e)}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="shrink-0">📄</span>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="habit-name-scroll min-w-0 overflow-hidden">
                          <span className="habit-name-text inline-block whitespace-nowrap">{h.name}</span>
                        </div>
                        {(h as any)?.workloadUnit && (
                          <span className="text-xs text-zinc-500 truncate">
                            Target: {(h as any)?.workloadPerCount || 1} {(h as any)?.workloadUnit}
                          </span>
                        )}
                      </div>
                    </div>
                    {renderHabitActions(h)}
                  </div>
                );
              }) : <div className="px-2 py-1 text-xs text-zinc-500">(no habits)</div>
            })()
          ) : (
            <>
              {myHabits.map(h => {
                const isDraggedHabit = draggedItem?.type === 'habit' && draggedItem?.id === h.id;
                
                return (
                  <div
                    key={h.id}
                    onClick={() => { onGoalSelect(goal.id); onHabitEdit(h.id); }}
                    className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm draggable ${
                      (isHabitCompletedToday(h, activities) || goalCompleted || !h.active) ? 'line-through text-zinc-400' : 'text-zinc-700 dark:text-zinc-200'
                    } hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer ${
                      isDraggedHabit ? 'dragging' : ''
                    }`}
                    draggable={!isDragging}
                    onDragStart={(e) => onDragStart({ type: 'habit', id: h.id, data: h }, e)}
                    onDragEnd={onDragEnd}
                    onTouchStart={(e) => onTouchStart({ type: 'habit', id: h.id, data: h }, e)}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="shrink-0">📄</span>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="habit-name-scroll min-w-0 overflow-hidden">
                          <span className="habit-name-text inline-block whitespace-nowrap">{h.name}</span>
                        </div>
                        {(h as any)?.workloadUnit && (
                          <span className="text-xs text-zinc-500 truncate">
                            Target: {(h as any)?.workloadPerCount || 1} {(h as any)?.workloadUnit}
                          </span>
                        )}
                      </div>
                    </div>
                    {renderHabitActions(h)}
                  </div>
                );
              })}

              {myHabits.length === 0 && (
                <div className="px-2 py-1 text-xs text-zinc-500">(no habits)</div>
              )}

              {/* render child goals recursively up to depth 3 */}
              {kids.map(k => (
                depth < 3 ? (
                  <div key={k.id} className="ml-2 mt-1">
                    <GoalNode 
                      goal={k} 
                      depth={depth + 1}
                      habits={habits}
                      activities={activities}
                      selectedGoal={selectedGoal}
                      openGoals={openGoals}
                      onlyHabit={onlyHabit}
                      goalsById={goalsById}
                      onToggleGoal={onToggleGoal}
                      onGoalSelect={onGoalSelect}
                      onGoalEdit={onGoalEdit}
                      onHabitEdit={onHabitEdit}
                      onHabitAction={onHabitAction}
                      onSetOnlyHabitFor={onSetOnlyHabitFor}
                      childrenOf={childrenOf}
                      effectiveOnlyHabit={effectiveOnlyHabit}
                      effectiveGoalCompleted={effectiveGoalCompleted}
                      isDescendantOf={isDescendantOf}
                      draggedItem={draggedItem}
                      dropTarget={dropTarget}
                      isDragging={isDragging}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onDrop={onDrop}
                      onDragOver={onDragOver}
                      onTouchStart={onTouchStart}
                      onTouchMove={onTouchMove}
                      onTouchEnd={onTouchEnd}
                    />
                  </div>
                ) : (
                  <div key={k.id} className="ml-4 mt-1">
                    <div className="flex items-center justify-between rounded px-2 py-1 text-sm">
                      <div className="flex items-center gap-2"><span className="text-sm">{k.name}</span></div>
                      <div className="text-xs text-zinc-500">{habits.filter(h => h.goalId === k.id).length}</div>
                    </div>
                  </div>
                )
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function GoalTree({ 
  goals, 
  habits,
  activities, // 追加
  selectedGoal, 
  onGoalSelect, 
  onGoalEdit, 
  onHabitEdit,
  onHabitAction,
  onMoveGoal,
  onMoveHabit
}: GoalTreeProps) {
  const [openGoals, setOpenGoals] = useState<Record<string, boolean>>({});
  const [onlyHabit, setOnlyHabit] = useState<Record<string, boolean>>({});

  // ドラッグ&ドロップ機能を初期化
  const {
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
  } = useDragAndDrop({
    goals,
    habits,
    onMoveGoal,
    onMoveHabit
  });

  // Goal hierarchy helpers
  const goalsById = useMemo(() => Object.fromEntries(goals.map(g => [g.id, g])), [goals]);
  const rootGoals = useMemo(() => goals.filter(g => !g.parentId), [goals]);
  
  function childrenOf(id: string) {
    return goals.filter(g => g.parentId === id);
  }

  function toggleGoal(id: string) {
    setOpenGoals((s) => ({ ...s, [id]: !s[id] }));
  }

  function setOnlyHabitFor(goalId: string, value: boolean) {
    setOnlyHabit(s => ({ ...s, [goalId]: value }));
  }

  // determine effective OnlyHabit for a goal: check the goal itself, then walk up to parents; default false
  function effectiveOnlyHabit(goalId: string) {
    let g: Goal | undefined = goalsById[goalId];
    while (g) {
      if (onlyHabit[g.id] !== undefined) return onlyHabit[g.id];
      g = g.parentId ? goalsById[g.parentId] : undefined;
    }
    return false;
  }

  // determine effective completion for a goal: if the goal or any ancestor is completed
  function effectiveGoalCompleted(goalId: string) {
    let g: Goal | undefined = goalsById[goalId];
    while (g) {
      if (g.isCompleted) return true;
      g = g.parentId ? goalsById[g.parentId] : undefined;
    }
    return false;
  }

  // helper: is goalA a descendant of goalB (including equality)
  function isDescendantOf(childGoalId: string, ancestorGoalId: string) {
    if (!childGoalId) return false;
    if (childGoalId === ancestorGoalId) return true;
    let g: Goal | undefined = goalsById[childGoalId];
    while (g && g.parentId) {
      if (g.parentId === ancestorGoalId) return true;
      g = goalsById[g.parentId];
    }
    return false;
  }

  return (
    <nav 
      className={`space-y-2 ${dropTarget?.type === 'root' ? 'drop-target' : ''}`}
      data-drop-target="true"
      data-drop-target-type="root"
      data-drop-target-id={null}
      onDragOver={(e) => {
        e.preventDefault();
        handleDragOver({ type: 'root', id: null });
      }}
      onDrop={(e) => handleDrop({ type: 'root', id: null }, e)}
    >
      {rootGoals.map((c) => (
        <GoalNode 
          key={c.id} 
          goal={c} 
          depth={1}
          habits={habits}
          activities={activities}
          selectedGoal={selectedGoal}
          openGoals={openGoals}
          onlyHabit={onlyHabit}
          goalsById={goalsById}
          onToggleGoal={toggleGoal}
          onGoalSelect={onGoalSelect}
          onGoalEdit={onGoalEdit}
          onHabitEdit={onHabitEdit}
          onHabitAction={onHabitAction}
          onSetOnlyHabitFor={setOnlyHabitFor}
          childrenOf={childrenOf}
          effectiveOnlyHabit={effectiveOnlyHabit}
          effectiveGoalCompleted={effectiveGoalCompleted}
          isDescendantOf={isDescendantOf}
          draggedItem={draggedItem}
          dropTarget={dropTarget}
          isDragging={isDragging}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      ))}
    </nav>
  );
}