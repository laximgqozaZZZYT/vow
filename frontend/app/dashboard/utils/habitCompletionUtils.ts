import type { Activity, Habit } from '../types';

/**
 * 指定されたHabitの累積Load Countを計算する
 * 
 * kindが'complete'のActivityのamountのみを合計します。
 * amountがnull/undefinedの場合は0として扱います。
 * 
 * @param habitId - 対象HabitのID
 * @param activities - 全Activityの配列
 * @returns 累積Load Count
 * 
 * @example
 * ```typescript
 * const activities = [
 *   { id: '1', habitId: 'habit-1', kind: 'complete', amount: 10, ... },
 *   { id: '2', habitId: 'habit-1', kind: 'complete', amount: 5, ... },
 *   { id: '3', habitId: 'habit-1', kind: 'start', amount: 3, ... }, // 除外される
 *   { id: '4', habitId: 'habit-2', kind: 'complete', amount: 20, ... }, // 別のhabit
 * ];
 * const count = calculateCumulativeLoadCount('habit-1', activities);
 * // count === 15 (10 + 5)
 * ```
 */
export function calculateCumulativeLoadCount(
  habitId: string,
  activities: Activity[]
): number {
  return activities
    .filter(
      (activity) =>
        activity.habitId === habitId && activity.kind === 'complete'
    )
    .reduce((sum, activity) => sum + (activity.amount ?? 0), 0);
}


/**
 * Habitが累積完了状態かどうかを判定する
 * 
 * 以下の条件をすべて満たす場合にtrueを返します:
 * - workloadTotalEndが正の数として設定されている
 * - 累積Load Countがworkload TotalEnd以上
 * 
 * @param habit - 対象Habit
 * @param activities - 全Activityの配列
 * @returns 累積完了状態の場合true
 * 
 * @example
 * ```typescript
 * const habit = { id: 'habit-1', workloadTotalEnd: 100, ... };
 * const activities = [
 *   { id: '1', habitId: 'habit-1', kind: 'complete', amount: 60, ... },
 *   { id: '2', habitId: 'habit-1', kind: 'complete', amount: 50, ... },
 * ];
 * const isCompleted = isHabitCumulativelyCompleted(habit, activities);
 * // isCompleted === true (累積Load Count 110 >= workloadTotalEnd 100)
 * ```
 * 
 * @example
 * ```typescript
 * // workloadTotalEndが設定されていない場合
 * const habit = { id: 'habit-1', ... }; // workloadTotalEnd undefined
 * const isCompleted = isHabitCumulativelyCompleted(habit, activities);
 * // isCompleted === false
 * ```
 * 
 * @example
 * ```typescript
 * // workloadTotalEndが0以下の場合
 * const habit = { id: 'habit-1', workloadTotalEnd: 0, ... };
 * const isCompleted = isHabitCumulativelyCompleted(habit, activities);
 * // isCompleted === false
 * ```
 */
export function isHabitCumulativelyCompleted(
  habit: Habit,
  activities: Activity[]
): boolean {
  // Requirements 2.2: workloadTotalEndが設定されていない場合はfalse
  if (habit.workloadTotalEnd === undefined || habit.workloadTotalEnd === null) {
    return false;
  }

  // Requirements 2.3: workloadTotalEndが0以下の場合はfalse
  if (habit.workloadTotalEnd <= 0) {
    return false;
  }

  // Requirements 2.1: 累積Load CountがworkloadTotalEnd以上の場合はtrue
  const cumulativeLoadCount = calculateCumulativeLoadCount(habit.id, activities);
  return cumulativeLoadCount >= habit.workloadTotalEnd;
}
