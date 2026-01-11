import { useState } from 'react';
import api from '../../../lib/api';
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
  handleComplete: (habitId: string) => void;
  handleStart: (habitId: string) => void;
  handlePause: (habitId: string) => void;
  openEditActivity: (activityId: string) => void;
  propagateActivityChanges: (updated: Activity) => void;
  handleDeleteActivity: (activityId: string) => void;
  setEditingActivityId: React.Dispatch<React.SetStateAction<string | null>>;
  setOpenActivityModal: React.Dispatch<React.SetStateAction<boolean>>;
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

  function handleComplete(habitId: string) {
    const now = new Date().toISOString();
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    
    const basePerCount = (habit as any).workloadPerCount ?? 1;
    const paused = pausedLoads[habitId] ?? 0;
    // amount to add for this completion = basePerCount - paused (but at least 0)
    const increment = Math.max(0, basePerCount - paused);
    const prev = habit.count ?? 0;
    const newCount = prev + increment;
    const total = (habit as any).workloadTotal ?? habit.must ?? 0;

    // update habit
    setHabits(s => s.map(h => h.id === habitId ? ({ 
      ...h, 
      count: newCount, 
      completed: total > 0 ? (newCount >= total) : true, 
      lastCompletedAt: now, 
      updatedAt: now 
    }) : h));

    // if there's a start recorded for this habit, convert that start to a complete with duration
    const start = starts[habitId];
    if (start) {
      const durationSeconds = Math.max(0, Math.floor((Date.now() - new Date(start.ts).getTime()) / 1000));
      (async () => {
        const idx = activities.findIndex(a => a.habitId === habitId && a.kind === 'start' && a.timestamp === start.ts);
        if (idx !== -1) {
          const old = activities[idx];
          const prevCountVal = (typeof old.prevCount === 'number') ? old.prevCount : (typeof old.newCount === 'number' ? old.newCount : (habit.count ?? 0));
          const updatedAct: Activity = { ...old, kind: 'complete', amount: increment, prevCount: prevCountVal, newCount, durationSeconds };
          try {
            const isTemporaryActivity = old.id.startsWith('a') && /^a\d+$/.test(old.id); // matches pattern like 'a1234567890'
            if (old.id && !isTemporaryActivity) {
              const u = await api.updateActivity(old.id, updatedAct);
              setActivities(acts => { const copy = [...acts]; const i = copy.findIndex(x => x.id === old.id); if (i !== -1) { copy[i] = u } return copy });
            } else {
              const created = await api.createActivity({ kind: 'complete', habitId, habitName: habit.name, timestamp: now, amount: increment, prevCount: prev, newCount, durationSeconds });
              setActivities(acts => { const copy = acts.filter(a => !(a.habitId === habitId && a.kind === 'start' && a.timestamp === start.ts)); return [created, ...copy] });
            }
          } catch (e) { console.error(e) }
        } else {
          try {
            const created = await api.createActivity({ kind: 'complete', habitId, habitName: habit.name, timestamp: now, amount: increment, prevCount: prev, newCount, durationSeconds });
            setActivities(acts => [created, ...acts]);
          } catch (e) { console.error(e) }
        }
      })();
      // clear start timer and state
      const to = start.timeoutId;
      if (typeof to === 'number') clearTimeout(to);
      setStarts(s => { const c = { ...s }; delete c[habitId]; return c; });
      return;
    }

    // no start: create a standalone complete activity
    // Persist the completion so it survives reload.
    (async () => {
      try {
        const created = await api.createActivity({ kind: 'complete', habitId, habitName: habit.name, timestamp: now, amount: increment, prevCount: prev, newCount });
        setActivities(a => [created, ...a]);
      } catch (e) {
        console.error(e);
        // fallback to local
        setActivities(a => [{ id: `a${Date.now()}`, kind: 'complete', habitId, habitName: habit.name, timestamp: now, amount: increment, prevCount: prev, newCount }, ...a]);
      }
    })();
    // clear pausedLoads for this habit (we consumed it)
    setPausedLoads(s => { const c = { ...s }; delete c[habitId]; return c; });
  }

  function handleStart(habitId: string) {
    const now = new Date().toISOString();
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    // if already started, treat as complete
    if (starts[habitId]) {
      handleComplete(habitId);
      return;
    }
    // schedule skip after 24h
    const timeoutId = window.setTimeout(() => {
      setStarts(s => {
        if (!s[habitId]) return s;
        const ts = new Date().toISOString();
        // Persist skip; fall back to local if backend is unreachable.
        (async () => {
          try {
            const created = await api.createActivity({ kind: 'skip', habitId, habitName: habit.name, timestamp: ts });
            setActivities(a => [created, ...a]);
          } catch (e) {
            console.error(e);
            setActivities(a => [{ id: `a${Date.now()}`, kind: 'skip', habitId, habitName: habit.name, timestamp: ts }, ...a]);
          }
        })();
        const copy = { ...s }; delete copy[habitId]; return copy;
      });
    }, 24 * 60 * 60 * 1000);

    setStarts(s => ({ ...s, [habitId]: { ts: now, timeoutId } }));
    (async () => {
      try {
        const created = await api.createActivity({ kind: 'start', habitId, habitName: habit.name, timestamp: now, prevCount: habit.count ?? 0, newCount: habit.count ?? 0 });
        setActivities(a => [created, ...a]);
      } catch (e) {
        // fallback to local
        setActivities(a => [{ id: `a${Date.now()}`, kind: 'start', habitId, habitName: habit.name, timestamp: now, prevCount: habit.count ?? 0, newCount: habit.count ?? 0 }, ...a]);
      }
    })();
  }

  function handlePause(habitId: string) {
    // open Activity modal in pause mode
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    const now = new Date().toISOString();
    const localId = `a${Date.now()}`;
    const placeholder: Activity = { id: localId, kind: 'pause', habitId, habitName: habit.name, timestamp: now, amount: 0, prevCount: habit.count ?? 0, newCount: habit.count ?? 0 };
    // Create the pause on backend first so any edits persist across reload.
    (async () => {
      try {
        const created = await api.createActivity({ kind: 'pause', habitId, habitName: habit.name, timestamp: now, amount: 0, prevCount: habit.count ?? 0, newCount: habit.count ?? 0 });
        setActivities(a => [created, ...a]);
        setEditingActivityId(created.id);
        setOpenActivityModal(true);
      } catch (e) {
        console.error(e);
        // fallback to local placeholder
        setActivities(a => [placeholder, ...a]);
        setEditingActivityId(localId);
        setOpenActivityModal(true);
      }
    })();
  }

  function openEditActivity(activityId: string) {
    setEditingActivityId(activityId);
    setOpenActivityModal(true);
  }

  function propagateActivityChanges(updated: Activity) {
    // Persist the activity update to backend if it's not a temporary local activity
    const isTemporaryActivity = updated.id.startsWith('a') && /^a\d+$/.test(updated.id); // matches pattern like 'a1234567890'
    if (!isTemporaryActivity) {
      (async () => {
        try {
          // Ensure we have the correct counts before saving
          const activityToSave = { ...updated };
          
          // If this is a complete activity, recalculate newCount based on amount
          if (updated.kind === 'complete' && updated.habitId) {
            const habit = habits.find(h => h.id === updated.habitId);
            if (habit) {
              const basePerCount = (habit as any).workloadPerCount ?? 1;
              const prevCount = updated.prevCount ?? habit.count ?? 0;
              
              // If amount is provided, use it; otherwise use basePerCount
              const amount = typeof updated.amount === 'number' ? updated.amount : basePerCount;
              activityToSave.newCount = prevCount + amount;
            }
          }
          
          await api.updateActivity(updated.id, activityToSave);
        } catch (e) {
          console.error('[propagateActivityChanges] Failed to update activity in backend:', e);
        }
      })();
    }

    // update the specific activity
    setActivities(prev => {
      const idx = prev.findIndex(a => a.id === updated.id);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = updated;
      // propagate to subsequent activities for the same habit: adjust their prevCount/newCount and duration if needed
      // We'll recompute counts for following activities by replaying from the first activity's prevCount
      let baseCount = updated.prevCount ?? 0;
      for (let i = idx; i < copy.length; i++) {
        const a = copy[i];
        if (a.habitId !== updated.habitId) continue;
        if (i === idx) {
          // already set
          baseCount = (typeof a.newCount === 'number') ? a.newCount : baseCount;
          continue;
        }
        // recompute this activity based on its kind and amount
        if (a.kind === 'pause') {
          // pause doesn't change counts but stores paused load
          // keep prevCount as baseCount
          a.prevCount = baseCount;
          a.newCount = baseCount;
        } else if (a.kind === 'complete') {
          const per = (habits.find(h => h.id === a.habitId) as any)?.workloadPerCount ?? 1;
          // if a has amount specified, use it; else use per
          const amt = (typeof a.amount === 'number' ? a.amount : per);
          a.prevCount = baseCount;
          a.newCount = baseCount + amt;
          baseCount = (typeof a.newCount === 'number') ? a.newCount : baseCount;
        } else if (a.kind === 'start') {
          a.prevCount = baseCount;
          a.newCount = baseCount;
        } else if (a.kind === 'skip') {
          a.prevCount = baseCount;
          a.newCount = baseCount;
        }
      }
      // after propagation, update the habit's stored count to the most recent newCount for this habit (if any)
      const mostRecent = copy.find(x => x.habitId === updated.habitId && typeof x.newCount === 'number');
      if (typeof mostRecent?.newCount === 'number') {
        setHabits(hs => hs.map(h => h.id === updated.habitId ? { ...h, count: mostRecent.newCount, updatedAt: new Date().toISOString() } : h));
      }

      // if the updated activity was a pause, update pausedLoads for that habit
      if (updated.kind === 'pause' && updated.habitId) {
        setPausedLoads(s => ({ ...s, [updated.habitId!]: updated.amount ?? 0 }));
      }

      return copy;
    });
  }

  function handleDeleteActivity(activityId: string) {
    const act = activities.find(a => a.id === activityId);
    if (!act) {
      return;
    }
    
    const prevCount = act.prevCount ?? 0;
    
    // rollback habit count to prevCount and adjust completed flag
    setHabits(s => s.map(h => {
      if (h.id !== act.habitId) return h;
      const total = (h as any).workloadTotal ?? h.must ?? 0;
      const completed = (total > 0) ? (prevCount >= total) : false;
      return { ...h, count: prevCount, completed, updatedAt: new Date().toISOString() };
    }));
    
    // remove activity from local state first
    setActivities(s => {
      const filtered = s.filter(a => a.id !== activityId);
      return filtered;
    });
    
    // delete on backend - check for temporary activity patterns
    const isTemporaryActivity = activityId.startsWith('a') && /^a\d+$/.test(activityId); // matches pattern like 'a1234567890'
    if (!isTemporaryActivity) {
      (async () => { 
        try { 
          await api.deleteActivity(activityId);
        } catch(e) { 
          console.error('[handleDeleteActivity] Failed to delete from backend:', e);
          // If backend deletion fails, we should probably restore the local state
          // But for now, just log the error
        } 
      })();
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