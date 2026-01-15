import GoalTree from './Widget.GoalTree';
import type { DashboardSidebarProps, Goal, Habit, Activity } from '../types';
import { useHandedness } from '../contexts/HandednessContext';

interface DashboardSidebarExtendedProps extends DashboardSidebarProps {
  goals: Goal[];
  habits: Habit[];
  activities: Activity[]; // 追加
  selectedGoal: string | null;
  onGoalSelect: (goalId: string | null) => void;
  onGoalEdit: (goalId: string) => void;
  onHabitEdit: (habitId: string) => void;
  onHabitAction: (habitId: string, action: 'start' | 'complete' | 'pause') => void;
  onMoveGoal: (goalId: string, newParentId: string | null) => void;
  onMoveHabit: (habitId: string, newGoalId: string) => void;
  onNewMindmap: () => void;
  onManageTags: () => void;
  mindmaps?: any[];
  selectedMindmap?: any;
  onMindmapSelect?: (mindmap: any) => void;
  onMindmapDelete?: (mindmapId: string) => void;
}

export default function DashboardSidebar({ 
  isVisible, 
  onClose, 
  onNewGoal, 
  onNewHabit,
  goals,
  habits,
  activities, // 追加
  selectedGoal,
  onGoalSelect,
  onGoalEdit,
  onHabitEdit,
  onHabitAction,
  onMoveGoal,
  onMoveHabit,
  onNewMindmap,
  onManageTags,
  mindmaps = [],
  selectedMindmap,
  onMindmapSelect,
  onMindmapDelete
}: DashboardSidebarExtendedProps) {
  const { isLeftHanded } = useHandedness();
  
  if (!isVisible) return null;

  const sidePosition = isLeftHanded ? 'right-0' : 'left-0';
  const borderSide = isLeftHanded ? 'border-l' : 'border-r';

  return (
    <>
      {/* Mobile overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-30 lg:hidden"
        onClick={onClose}
      />
      
      <aside className={`fixed ${sidePosition} top-14 w-80 max-w-[85vw] h-[calc(100vh-3.5rem)] ${borderSide} border-zinc-200 bg-white dark:bg-[#071013] z-40 lg:w-80 flex flex-col`}>
        <div className="flex-shrink-0 p-3 pb-0">
          <div className="mb-3 flex items-center justify-between">
            <div className={`flex items-center gap-2 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
              <button onClick={onClose} className="text-sm text-zinc-500 lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center">✕</button>
            </div>
          </div>

          {/* ドラッグ&ドロップのヘルプテキスト */}
          <div className="mb-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            💡 ドラッグ&ドロップでGoal・Habitを移動できます
            <br />
            📱 スマホ: 長押し→スライドで移動
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-3">
          <GoalTree
            goals={goals}
            habits={habits}
            activities={activities}
            selectedGoal={selectedGoal}
            onGoalSelect={onGoalSelect}
            onGoalEdit={onGoalEdit}
            onHabitEdit={onHabitEdit}
            onHabitAction={onHabitAction}
            onMoveGoal={onMoveGoal}
            onMoveHabit={onMoveHabit}
          />

          {/* Mindmaps Section */}
          {mindmaps.length > 0 && (
            <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                🧠 Saved Mindmaps
              </h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {mindmaps.map((mindmap) => (
                  <div
                    key={mindmap.id}
                    className={`group flex items-center justify-between p-2 rounded text-sm cursor-pointer transition-colors ${
                      selectedMindmap?.id === mindmap.id
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <div
                      className="flex-1 truncate"
                      onClick={() => onMindmapSelect?.(mindmap)}
                      title={mindmap.name}
                    >
                      {mindmap.name}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete mindmap "${mindmap.name}"?`)) {
                          onMindmapDelete?.(mindmap.id);
                        }
                      }}
                      className="ml-2 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      title="Delete mindmap"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-col gap-2 p-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <button
            className={`rounded border px-3 py-2 text-sm ${isLeftHanded ? 'text-left' : ''}`}
            onClick={onNewGoal}
          >
            + New Goal
          </button>
          <button
            className={`rounded bg-blue-600 px-3 py-2 text-sm text-white ${isLeftHanded ? 'text-left' : ''}`}
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              onNewHabit({ date: today });
            }}
          >
            + New Habit
          </button>
          <button
            className={`rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 ${isLeftHanded ? 'text-left' : ''}`}
            onClick={onNewMindmap}
          >
            + New Map
          </button>
          <button
            className={`rounded bg-purple-600 px-3 py-2 text-sm text-white hover:bg-purple-700 ${isLeftHanded ? 'text-left' : ''}`}
            onClick={onManageTags}
          >
            Manage Tags
          </button>
        </div>
      </aside>
    </>
  );
}