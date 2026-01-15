import { useMemo } from 'react';
import { debug } from '../../../lib/debug';
import type { ActivitySectionProps, Habit, Activity } from '../types';
import { useHandedness } from '../contexts/HandednessContext';

interface HabitProgress {
  habitId: string;
  habitName: string;
  currentCount: number;
  totalCount: number;
  progressRate: number;
  completed: boolean;
}

// JST日付範囲でのActivity集計関数
function calculateDailyWorkload(habitId: string, activities: Activity[]): number {
  // JST (UTC+9) での現在時刻を取得
  const now = new Date();
  const jstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
  
  // JST での今日の開始時刻 (0:00 JST) と終了時刻 (23:59:59 JST)
  const todayStartJST = new Date(jstTime);
  todayStartJST.setHours(0, 0, 0, 0);
  
  const todayEndJST = new Date(jstTime);
  todayEndJST.setHours(23, 59, 59, 999);
  
  debug.log('[calculateDailyWorkload] JST range:', {
    habitId,
    todayStartJST: todayStartJST.toISOString(),
    todayEndJST: todayEndJST.toISOString(),
    currentJST: jstTime.toISOString()
  });
  
  // 今日のJST範囲内のActivityをフィルタリング
  const todayActivities = activities.filter(activity => {
    if (activity.habitId !== habitId || !activity.timestamp) return false;
    
    const activityTime = new Date(activity.timestamp);
    const activityJST = new Date(activityTime.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
    
    return activityJST >= todayStartJST && activityJST <= todayEndJST;
  });
  
  debug.log('[calculateDailyWorkload] Today activities for habit:', habitId, todayActivities);
  
  // completeタイプのActivityのamount合計を計算
  const totalWorkload = todayActivities
    .filter(activity => activity.kind === 'complete')
    .reduce((sum, activity) => {
      const amount = activity.amount || 1; // デフォルト値は1
      debug.log('[calculateDailyWorkload] Adding amount:', amount, 'from activity:', activity.id);
      return sum + amount;
    }, 0);
  
  debug.log('[calculateDailyWorkload] Total workload for habit:', habitId, 'is:', totalWorkload);
  return totalWorkload;
}

export default function ActivitySection({ 
  activities, 
  onEditActivity, 
  onDeleteActivity, 
  habits 
}: ActivitySectionProps) {
  const { isLeftHanded } = useHandedness();
  
  // 各Habitの日次進捗率を計算（JST 0:00-23:59のActivity集計ベース）
  const habitProgress = useMemo((): HabitProgress[] => {
    const progressMap = new Map<string, HabitProgress>();
    
    // 全てのHabitを初期化
    habits.forEach(habit => {
      if (habit.active && habit.type === 'do') {
        const totalCount = (habit as any).workloadTotal || habit.must || 1;
        
        // JST 0:00-23:59の同一Habitに関するworkload合計を計算
        const currentCount = calculateDailyWorkload(habit.id, activities);
        
        const progressRate = totalCount > 0 ? Math.min((currentCount / totalCount) * 100, 100) : 0;
        
        // 完了判定もJST日次ベースで行う
        const completed = currentCount >= totalCount;
        
        progressMap.set(habit.id, {
          habitId: habit.id,
          habitName: habit.name,
          currentCount,
          totalCount,
          progressRate,
          completed
        });
      }
    });
    
    return Array.from(progressMap.values()).sort((a, b) => a.habitName.localeCompare(b.habitName));
  }, [habits, activities]); // activitiesも依存関係に追加

  return (
    <section className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4 sm:p-6 mt-4">
      <h2 className={`mb-3 text-lg font-semibold ${isLeftHanded ? 'text-right' : ''}`}>Daily Progress</h2>
      <div className="">
        {/* Fixed-height scrollable container */}
        <div className="h-56 overflow-y-auto space-y-3 pr-2">
          {habitProgress.length === 0 && (
            <div className="text-xs text-zinc-500">No active habits to track.</div>
          )}
          {habitProgress.map(progress => (
            <div key={progress.habitId} className="space-y-1">
              {/* Habit名と進捗率 */}
              <div className={`flex items-center ${isLeftHanded ? 'flex-row-reverse' : 'justify-between'}`}>
                <div className={`text-sm font-medium ${
                  progress.completed ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-zinc-100'
                }`}>
                  {progress.habitName}
                </div>
                <div className="text-xs text-zinc-500 tabular-nums">
                  {progress.currentCount}/{progress.totalCount} ({Math.round(progress.progressRate)}%)
                </div>
              </div>
              
              {/* 進捗バー */}
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    progress.completed 
                      ? 'bg-green-500' 
                      : progress.progressRate >= 100 
                        ? 'bg-green-500' 
                        : progress.progressRate >= 75 
                          ? 'bg-blue-500' 
                          : progress.progressRate >= 50 
                            ? 'bg-yellow-500' 
                            : 'bg-red-400'
                  }`}
                  style={{ width: `${Math.min(progress.progressRate, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* タイムライン表示は折りたたみ可能にする */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200">
          Activity Timeline
        </summary>
        <div className="mt-2 h-40 overflow-y-auto space-y-2 pr-2 border-t border-zinc-200 dark:border-zinc-700 pt-2">
          {activities.length === 0 && <div className="text-xs text-zinc-500">No activity yet.</div>}
          {[...activities].sort((a,b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 10).map(act => (
            <div key={act.id} className={`flex items-center rounded px-2 py-1 hover:bg-zinc-100 dark:hover:bg-white/5 text-xs ${isLeftHanded ? 'flex-row-reverse' : 'justify-between'}`}>
              <div>
                <div className="text-zinc-500">{act.timestamp ? new Date(act.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : 'No timestamp'}</div>
                <div className="text-zinc-700 dark:text-zinc-300">
                  {act.habitName} — {act.kind === 'start' ? 'started' : act.kind === 'complete' ? 'completed' : act.kind === 'pause' ? 'paused' : 'skipped'}
                  {act.kind === 'complete' && act.amount && ` (${act.amount})`}
                </div>
              </div>
              <div className={`flex items-center gap-1 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
                <button className="text-xs text-blue-600 hover:underline" onClick={() => onEditActivity(act.id)}>Edit</button>
                <button className="text-xs text-red-600 hover:underline" onClick={() => onDeleteActivity(act.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}