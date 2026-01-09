// Update GoalTree to accept habits prop
import GoalTree from './Widget.GoalTree';
import type { DashboardSidebarProps, Goal, Habit } from '../types';

interface DashboardSidebarExtendedProps extends DashboardSidebarProps {
  goals: Goal[];
  habits: Habit[];
  selectedGoal: string | null;
  onGoalSelect: (goalId: string | null) => void;
  onGoalEdit: (goalId: string) => void;
  onHabitEdit: (habitId: string) => void;
  onHabitAction: (habitId: string, action: 'start' | 'complete' | 'pause') => void;
}

export default function DashboardSidebar({ 
  isVisible, 
  onClose, 
  onNewGoal, 
  onNewHabit,
  goals,
  habits,
  selectedGoal,
  onGoalSelect,
  onGoalEdit,
  onHabitEdit,
  onHabitAction
}: DashboardSidebarExtendedProps) {
  if (!isVisible) return null;

  return (
    <>
      {/* Mobile overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-30 lg:hidden"
        onClick={onClose}
      />
      
      <aside className="fixed left-0 top-14 w-80 max-w-[85vw] h-[calc(100vh-3.5rem)] border-r border-zinc-200 bg-white dark:bg-[#071013] p-3 z-40 lg:w-80">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-sm text-zinc-500 lg:hidden">✕</button>
          </div>
        </div>

        <GoalTree
          goals={goals}
          habits={habits}
          selectedGoal={selectedGoal}
          onGoalSelect={onGoalSelect}
          onGoalEdit={onGoalEdit}
          onHabitEdit={onHabitEdit}
          onHabitAction={onHabitAction}
        />

        <div className="mt-auto flex flex-col sm:flex-row gap-2 pt-4">
          <button
            className="flex-1 rounded border px-3 py-2 text-sm"
            onClick={onNewGoal}
          >
            + New Goal
          </button>
          <button
            className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm text-white"
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              onNewHabit({ date: today });
            }}
          >
            + New Habit
          </button>
        </div>
      </aside>
    </>
  );
}