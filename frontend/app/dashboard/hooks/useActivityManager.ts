import { useState } from 'react';
import api from '../../../lib/api';
import { debug } from '../../../lib/debug';
import type { Activity, Habit } from '../types';

interface UseActivityManagerProps {
  habits: Habit[];
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
  activities: Activity[];
  setActivities: React.Dispatch<React.SetStateAction<Activity[]>>;
}

interface UseActivityManagerReturn {
  starts: Record<string, { ts: string; timeoutId?: number }>;
  pausedLoads: Record<string, number>;
  openActivityModal: boolean;
  editingActivityId: string | null;
  handleComplete: (habitId: string, amount?: number) => void;
  handleStart: (habitId: string) => void;
  handlePause: (habitId: string) => void;
  openEditActivity: (activityId: string) => void;
  propagateActivityChanges: (updated: Activity) => void;
  handleDeleteActivity: (activityId: string) => void;
  setEditingActivityId: React.Dispatch<React.SetStateAction<string | null>>;
  setOpenActivityModal: React.Dispatch<React.SetStateAction<boolean>>;
}

/** Check if activity ID is a temporary local ID */
function isTemporaryActivityId(id: string): boolean {
  return id.startsWith('a') && /^a\d+$/.test(id);
}

/** Calculate new count and completion status */
function calculateHabitProgress(
  habit: Habit,
  increment: number
): { newCount: number; completed: boolean } {
  const prev = habit.count ?? 0;
  const newCount = prev + increment;
  const total = (habit as any).workloadTotal ?? habit.must ?? 0;
  const completed = total > 0 ? (newCount >= total) : true;
  return { newCount, completed };
}

/** Update habit state with new count */
function updateHabitWithCount(
  habits: Habit[],
  habitId: string,
  newCount: number,
  completed: boolean,
  now: string
): Habit[] {
  return habits.map(h => h.id === habitId ? ({
    ...h,
    count: newCount,
    completed,
    lastCompletedAt: now,
    updatedAt: now
  }) : h);
}

export function useActivityManager({
  habits,
  setHabits,
  activities,
  setActivities
}: UseActivityManagerProps): UseActivityManagerReturn {
  const [starts, setStarts] = useState<Record<string, { ts: string; timeoutId?: number }>>({});
  const [pausedLoads, setPausedLoads] = useState<Record<string, number>>({});
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [openActivityModal, setOpenActivityModal] = useState(false);
  
  // 重複実行防止のための状態
  const [processingActions, setProcessingActions] = useState<Set<string>>(new Set());

  function handleComplete(habitId: string, amount?: number) {
    // 重複実行防止
    const actionKey = `complete-${habitId}`;
    if (processingActions.has(actionKey)) {
      debug.log('[handleComplete] Already processing, skipping:', habitId);
      return;
    }
    
    setProcessingActions(prev => new Set(prev).add(actionKey));
    
    try {
      const now = new Date().toISOString();
      const habit = habits.find(h => h.id === habitId);
      if (!habit) return;
      
      debug.log('[handleComplete] Before completion:', {
        habitId,
        habitName: habit.name,
        currentCount: habit.count,
        workloadTotal: (habit as any).workloadTotal,
        must: habit.must,
        completed: habit.completed,
        pausedLoads: pausedLoads[habitId],
        customAmount: amount
      });
      
      const basePerCount = amount ?? (habit as any).workloadPerCount ?? 1;
      const paused = pausedLoads[habitId] ?? 0;
      
      // if there's a start recorded for this habit, convert that start to a complete with duration
      const start = starts[habitId];
      if (start) {
        handleStartToComplete(habitId, habit, start, basePerCount, paused, now, actionKey);
        return;
      }

      // no start: create a standalone complete activity
      handleStandaloneComplete(habitId, habit, amount, basePerCount, now, actionKey);
    } catch (error) {
      console.error('[handleComplete] Error:', error);
      releaseActionLock(actionKey);
    }
  }

  /** Handle completion when there's an active start */
  function handleStartToComplete(
    habitId: string,
    habit: Habit,
    start: { ts: string; timeoutId?: number },
    basePerCount: number,
    paused: number,
    now: string,
    actionKey: string
  ) {
    const increment = Math.max(0, basePerCount - paused);
    const { newCount, completed } = calculateHabitProgress(habit, increment);
    const prev = habit.count ?? 0;
    const total = (habit as any).workloadTotal ?? habit.must ?? 0;

    debug.log('[handleComplete] Start->Complete flow:', {
      increment, prev, newCount, total,
      willBeCompleted: total > 0 ? (newCount >= total) : true
    });

    setHabits(s => updateHabitWithCount(s, habitId, newCount, completed, now));

    const durationSeconds = Math.max(0, Math.floor((Date.now() - new Date(start.ts).getTime()) / 1000));
    persistStartToComplete(habitId, habit, start, increment, prev, newCount, durationSeconds, now, actionKey);

    // clear start timer and state
    if (typeof start.timeoutId === 'number') clearTimeout(start.timeoutId);
    setStarts(s => { const c = { ...s }; delete c[habitId]; return c; });
    setPausedLoads(s => { const c = { ...s }; delete c[habitId]; return c; });
  }

  /** Persist start-to-complete activity to backend */
  async function persistStartToComplete(
    habitId: string,
    habit: Habit,
    start: { ts: string },
    increment: number,
    prev: number,
    newCount: number,
    durationSeconds: number,
    now: string,
    actionKey: string
  ) {
    try {
      const idx = activities.findIndex(a => a.habitId === habitId && a.kind === 'start' && a.timestamp === start.ts);
      if (idx !== -1) {
        const old = activities[idx];
        const prevCountVal = (typeof old.prevCount === 'number') ? old.prevCount : (typeof old.newCount === 'number' ? old.newCount : (habit.count ?? 0));
        const updatedAct: Activity = { ...old, kind: 'complete', amount: increment, prevCount: prevCountVal, newCount, durationSeconds };
        
        if (old.id && !isTemporaryActivityId(old.id)) {
          const u = await api.updateActivity(old.id, updatedAct);
          setActivities(acts => { const copy = [...acts]; const i = copy.findIndex(x => x.id === old.id); if (i !== -1) { copy[i] = u } return copy });
        } else {
          const created = await api.createActivity({ kind: 'complete', habitId, habitName: habit.name, timestamp: now, amount: increment, prevCount: prev, newCount, durationSeconds });
          setActivities(acts => acts.filter(a => !(a.habitId === habitId && a.kind === 'start' && a.timestamp === start.ts)).concat([created]));
        }
      } else {
        const created = await api.createActivity({ kind: 'complete', habitId, habitName: habit.name, timestamp: now, amount: increment, prevCount: prev, newCount, durationSeconds });
        setActivities(acts => [created, ...acts]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      releaseActionLock(actionKey);
    }
  }

  /** Handle standalone complete (no active start) */
  function handleStandaloneComplete(
    habitId: string,
    habit: Habit,
    amount: number | undefined,
    basePerCount: number,
    now: string,
    actionKey: string
  ) {
    const increment = amount ?? basePerCount;
    const { newCount, completed } = calculateHabitProgress(habit, increment);
    const prev = habit.count ?? 0;
    const total = (habit as any).workloadTotal ?? habit.must ?? 0;

    debug.log('[handleComplete] Standalone complete flow:', {
      increment, prev, newCount, total,
      willBeCompleted: total > 0 ? (newCount >= total) : true
    });

    setHabits(s => updateHabitWithCount(s, habitId, newCount, completed, now));
    persistStandaloneComplete(habitId, habit, increment, prev, newCount, now, actionKey);
    setPausedLoads(s => { const c = { ...s }; delete c[habitId]; return c; });
  }

  /** Persist standalone complete activity to backend */
  async function persistStandaloneComplete(
    habitId: string,
    habit: Habit,
    increment: number,
    prev: number,
    newCount: number,
    now: string,
    actionKey: string
  ) {
    try {
      const created = await api.createActivity({ kind: 'complete', habitId, habitName: habit.name, timestamp: now, amount: increment, prevCount: prev, newCount });
      setActivities(a => [created, ...a]);
    } catch (e) {
      console.error(e);
      setActivities(a => [{ id: `a${Date.now()}`, kind: 'complete', habitId, habitName: habit.name, timestamp: now, amount: increment, prevCount: prev, newCount }, ...a]);
    } finally {
      releaseActionLock(actionKey);
    }
  }

  /** Release action lock */
  function releaseActionLock(actionKey: string) {
    setProcessingActions(prev => {
      const next = new Set(prev);
      next.delete(actionKey);
      return next;
    });
  }

  function handleStart(habitId: string) {
    const actionKey = `start-${habitId}`;
    if (processingActions.has(actionKey)) {
      debug.log('[handleStart] Already processing, skipping:', habitId);
      return;
    }
    
    setProcessingActions(prev => new Set(prev).add(actionKey));
    
    try {
      const now = new Date().toISOString();
      const habit = habits.find(h => h.id === habitId);
      if (!habit) return;
      
      // if already started, treat as complete
      if (starts[habitId]) {
        releaseActionLock(actionKey);
        handleComplete(habitId);
        return;
      }
      
      // schedule skip after 24h
      const timeoutId = scheduleAutoSkip(habitId, habit);
      setStarts(s => ({ ...s, [habitId]: { ts: now, timeoutId } }));
      persistStartActivity(habitId, habit, now, actionKey);
    } catch (error) {
      console.error('[handleStart] Error:', error);
      releaseActionLock(actionKey);
    }
  }

  /** Schedule automatic skip after 24 hours */
  function scheduleAutoSkip(habitId: string, habit: Habit): number {
    return window.setTimeout(() => {
      setStarts(s => {
        if (!s[habitId]) return s;
        const ts = new Date().toISOString();
        persistSkipActivity(habitId, habit, ts);
        const copy = { ...s }; delete copy[habitId]; return copy;
      });
    }, 24 * 60 * 60 * 1000);
  }

  /** Persist skip activity to backend */
  async function persistSkipActivity(habitId: string, habit: Habit, ts: string) {
    try {
      const created = await api.createActivity({ kind: 'skip', habitId, habitName: habit.name, timestamp: ts });
      setActivities(a => [created, ...a]);
    } catch (e) {
      console.error(e);
      setActivities(a => [{ id: `a${Date.now()}`, kind: 'skip', habitId, habitName: habit.name, timestamp: ts }, ...a]);
    }
  }

  /** Persist start activity to backend */
  async function persistStartActivity(habitId: string, habit: Habit, now: string, actionKey: string) {
    try {
      const created = await api.createActivity({ kind: 'start', habitId, habitName: habit.name, timestamp: now, prevCount: habit.count ?? 0, newCount: habit.count ?? 0 });
      setActivities(a => [created, ...a]);
    } catch (e) {
      setActivities(a => [{ id: `a${Date.now()}`, kind: 'start', habitId, habitName: habit.name, timestamp: now, prevCount: habit.count ?? 0, newCount: habit.count ?? 0 }, ...a]);
    } finally {
      releaseActionLock(actionKey);
    }
  }

  function handlePause(habitId: string) {
    const actionKey = `pause-${habitId}`;
    if (processingActions.has(actionKey)) {
      debug.log('[handlePause] Already processing, skipping:', habitId);
      return;
    }
    
    setProcessingActions(prev => new Set(prev).add(actionKey));
    
    try {
      const habit = habits.find(h => h.id === habitId);
      if (!habit) return;
      
      const now = new Date().toISOString();
      persistPauseActivity(habitId, habit, now, actionKey);
    } catch (error) {
      console.error('[handlePause] Error:', error);
      releaseActionLock(actionKey);
    }
  }

  /** Persist pause activity to backend and open modal */
  async function persistPauseActivity(habitId: string, habit: Habit, now: string, actionKey: string) {
    const localId = `a${Date.now()}`;
    const placeholder: Activity = { 
      id: localId, 
      kind: 'pause', 
      habitId, 
      habitName: habit.name, 
      timestamp: now, 
      amount: 0, 
      prevCount: habit.count ?? 0, 
      newCount: habit.count ?? 0 
    };
    
    try {
      const created = await api.createActivity({ 
        kind: 'pause', 
        habitId, 
        habitName: habit.name, 
        timestamp: now, 
        amount: 0, 
        prevCount: habit.count ?? 0, 
        newCount: habit.count ?? 0 
      });
      setActivities(a => [created, ...a]);
      setEditingActivityId(created.id);
      setOpenActivityModal(true);
    } catch (e) {
      console.error(e);
      setActivities(a => [placeholder, ...a]);
      setEditingActivityId(localId);
      setOpenActivityModal(true);
    } finally {
      releaseActionLock(actionKey);
    }
  }

  function openEditActivity(activityId: string) {
    setEditingActivityId(activityId);
    setOpenActivityModal(true);
  }

  function propagateActivityChanges(updated: Activity) {
    // Persist the activity update to backend if it's not a temporary local activity
    if (!isTemporaryActivityId(updated.id)) {
      persistActivityUpdate(updated);
    }

    // update the specific activity and recalculate counts
    setActivities(prev => recalculateActivityCounts(prev, updated));
  }

  /** Persist activity update to backend */
  async function persistActivityUpdate(updated: Activity) {
    try {
      const activityToSave = prepareActivityForSave(updated);
      await api.updateActivity(updated.id, activityToSave);
    } catch (e) {
      console.error('[propagateActivityChanges] Failed to update activity in backend:', e);
    }
  }

  /** Prepare activity for saving with correct counts */
  function prepareActivityForSave(updated: Activity): Activity {
    const activityToSave = { ...updated };
    
    if (updated.kind === 'complete' && updated.habitId) {
      const habit = habits.find(h => h.id === updated.habitId);
      if (habit) {
        const basePerCount = (habit as any).workloadPerCount ?? 1;
        const prevCount = updated.prevCount ?? habit.count ?? 0;
        const amount = typeof updated.amount === 'number' ? updated.amount : basePerCount;
        activityToSave.newCount = prevCount + amount;
      }
    }
    
    return activityToSave;
  }

  /** Recalculate activity counts for a habit */
  function recalculateActivityCounts(activities: Activity[], updated: Activity): Activity[] {
    const idx = activities.findIndex(a => a.id === updated.id);
    if (idx === -1) return activities;
    
    const copy = [...activities];
    copy[idx] = updated;
    
    // Get all activities for this habit and sort by timestamp
    const habitActivities = copy
      .filter(a => a.habitId === updated.habitId)
      .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    
    debug.log('[propagateActivityChanges] Recalculating counts for habit activities:', {
      habitId: updated.habitId,
      activities: habitActivities.map(a => ({ 
        id: a.id, timestamp: a.timestamp, kind: a.kind, amount: a.amount,
        oldPrevCount: a.prevCount, oldNewCount: a.newCount
      }))
    });
    
    // Recalculate counts in chronological order
    let runningCount = 0;
    for (const a of habitActivities) {
      const originalIdx = copy.findIndex(x => x.id === a.id);
      runningCount = updateActivityCount(copy, originalIdx, a, runningCount);
    }
    
    // Update the habit's stored count
    if (habitActivities.length > 0) {
      updateHabitCount(updated.habitId!, runningCount, habitActivities, copy);
    }

    // Update pausedLoads if this was a pause activity
    if (updated.kind === 'pause' && updated.habitId) {
      setPausedLoads(s => ({ ...s, [updated.habitId!]: updated.amount ?? 0 }));
    }

    return copy;
  }

  /** Update a single activity's count based on its kind */
  function updateActivityCount(
    activities: Activity[],
    idx: number,
    activity: Activity,
    runningCount: number
  ): number {
    if (activity.kind === 'pause') {
      activities[idx].prevCount = runningCount;
      activities[idx].newCount = runningCount;
      return runningCount;
    } else if (activity.kind === 'complete') {
      const per = (habits.find(h => h.id === activity.habitId) as any)?.workloadPerCount ?? 1;
      const amt = typeof activity.amount === 'number' ? activity.amount : per;
      activities[idx].prevCount = runningCount;
      activities[idx].newCount = runningCount + amt;
      return runningCount + amt;
    } else {
      // start or skip
      activities[idx].prevCount = runningCount;
      activities[idx].newCount = runningCount;
      return runningCount;
    }
  }

  /** Update habit count based on final running count */
  function updateHabitCount(
    habitId: string,
    runningCount: number,
    habitActivities: Activity[],
    activities: Activity[]
  ) {
    debug.log('[propagateActivityChanges] Updating habit count:', {
      habitId,
      finalCount: runningCount,
      activities: habitActivities.map(x => ({ 
        kind: x.kind, 
        amount: x.amount, 
        newCount: activities.find(c => c.id === x.id)?.newCount 
      }))
    });
    
    setHabits(hs => hs.map(h => {
      if (h.id !== habitId) return h;
      const total = (h as any).workloadTotal ?? h.must ?? 0;
      const completed = total > 0 ? (runningCount >= total) : true;
      
      debug.log('[propagateActivityChanges] Habit update:', {
        habitName: h.name,
        oldCount: h.count,
        newCount: runningCount,
        total,
        oldCompleted: h.completed,
        newCompleted: completed
      });
      
      return { ...h, count: runningCount, completed, updatedAt: new Date().toISOString() };
    }));
  }

  function handleDeleteActivity(activityId: string) {
    const act = activities.find(a => a.id === activityId);
    if (!act) return;
    
    const prevCount = act.prevCount ?? 0;
    
    // rollback habit count
    rollbackHabitCount(act.habitId!, prevCount);
    
    // remove activity from local state
    setActivities(s => s.filter(a => a.id !== activityId));
    
    // delete on backend
    if (!isTemporaryActivityId(activityId)) {
      deleteActivityFromBackend(activityId);
    }
  }

  /** Rollback habit count to previous value */
  function rollbackHabitCount(habitId: string, prevCount: number) {
    setHabits(s => s.map(h => {
      if (h.id !== habitId) return h;
      const total = (h as any).workloadTotal ?? h.must ?? 0;
      const completed = (total > 0) ? (prevCount >= total) : false;
      return { ...h, count: prevCount, completed, updatedAt: new Date().toISOString() };
    }));
  }

  /** Delete activity from backend */
  async function deleteActivityFromBackend(activityId: string) {
    try {
      await api.deleteActivity(activityId);
    } catch (e) {
      console.error('[handleDeleteActivity] Failed to delete from backend:', e);
    }
  }

  return {
    starts,
    pausedLoads,
    openActivityModal,
    editingActivityId,
    handleComplete,
    handleStart,
    handlePause,
    openEditActivity,
    propagateActivityChanges,
    handleDeleteActivity,
    setEditingActivityId,
    setOpenActivityModal
  };
}