import { useState, useMemo } from 'react';
import type { GoalTreeProps, Goal, Habit } from '../types';

interface GoalNodeProps {
  goal: Goal;
  depth?: number;
  habits: Habit[];
  selectedGoal: string | null;
  openGoals: Record<string, boolean>;
  onlyHabit: Record<string, boolean>;
  goalsById: Record<string, Goal>;
  onToggleGoal: (id: string) => void;
  onGoalSelect: (goalId: string) => void;
  onGoalEdit: (goalId: string) => void;
  onHabitEdit: (habitId: string) => void;
  onHabitAction: (habitId: string, action: 'start' | 'complete' | 'pause') => void;
  onSetOnlyHabitFor: (goalId: string, value: boolean) => void;
  childrenOf: (id: string) => Goal[];
  effectiveOnlyHabit: (goalId: string) => boolean;
  effectiveGoalCompleted: (goalId: string) => boolean;
  isDescendantOf: (childGoalId: string, ancestorGoalId: string) => boolean;
}

function GoalNode({ 
  goal, 
  depth = 1, 
  habits,
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
  isDescendantOf
}: GoalNodeProps) {
  const isOpen = !!openGoals[goal.id];
  const kids = childrenOf(goal.id);
  const myHabits = habits.filter(h => h.goalId === goal.id);
  const goalCompleted = effectiveGoalCompleted(goal.id);

  return (
    <div key={goal.id}>
      <div className={`flex items-center justify-between cursor-pointer rounded px-3 py-2 hover:bg-zinc-100 dark:hover:bg-white/5 ${selectedGoal === goal.id ? 'bg-zinc-100 dark:bg-white/5' : ''}`}>
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
              return nestedHabits.length > 0 ? nestedHabits.map(h => (
                <div
                  key={h.id}
                  onClick={() => { onGoalSelect(goal.id); onHabitEdit(h.id); }}
                  className={`flex items-center justify-between rounded px-2 py-1 text-sm ${(h.completed || goalCompleted || !h.active) ? 'line-through text-zinc-400' : 'text-zinc-700'} hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/5 cursor-pointer`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span>📄</span>
                    <span className="truncate">{h.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button title="Start" onClick={(e) => { e.stopPropagation(); onHabitAction(h.id, 'start') }} className="text-blue-600 hover:bg-blue-50 rounded px-2 py-1">▶️</button>
                    <button title="Pause" onClick={(e) => { e.stopPropagation(); onHabitAction(h.id, 'pause') }} className="text-amber-600 hover:bg-amber-50 rounded px-2 py-1">⏸️</button>
                    <button
                      title="Complete"
                      onClick={(e) => { e.stopPropagation(); onHabitAction(h.id, 'complete') }}
                      className="text-green-600 hover:bg-green-50 rounded px-2 py-1"
                    >
                      ✅
                    </button>
                  </div>
                </div>
              )) : <div className="px-2 py-1 text-xs text-zinc-500">(no habits)</div>
            })()
          ) : (
            <>
              {myHabits.map(h => (
                <div
                  key={h.id}
                  onClick={() => { onGoalSelect(goal.id); onHabitEdit(h.id); }}
                  className={`flex items-center justify-between rounded px-2 py-1 text-sm ${(h.completed || goalCompleted || !h.active) ? 'line-through text-zinc-400' : 'text-zinc-700'} hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/5 cursor-pointer`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span>📄</span>
                    <span className="truncate">{h.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button title="Start" onClick={(e) => { e.stopPropagation(); onHabitAction(h.id, 'start') }} className="text-blue-600 hover:bg-blue-50 rounded px-2 py-1">▶️</button>
                    <button title="Pause" onClick={(e) => { e.stopPropagation(); onHabitAction(h.id, 'pause') }} className="text-amber-600 hover:bg-amber-50 rounded px-2 py-1">⏸️</button>
                    <button title="Complete" onClick={(e) => { e.stopPropagation(); onHabitAction(h.id, 'complete') }} className="text-green-600 hover:bg-green-50 rounded px-2 py-1">✅</button>
                  </div>
                </div>
              ))}

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
  selectedGoal, 
  onGoalSelect, 
  onGoalEdit, 
  onHabitEdit,
  onHabitAction 
}: GoalTreeProps) {
  const [openGoals, setOpenGoals] = useState<Record<string, boolean>>({});
  const [onlyHabit, setOnlyHabit] = useState<Record<string, boolean>>({});

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
    <nav className="space-y-2">
      {rootGoals.map((c) => (
        <GoalNode 
          key={c.id} 
          goal={c} 
          depth={1}
          habits={habits}
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
        />
      ))}
    </nav>
  );
}