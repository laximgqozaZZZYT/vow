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
        // For start->complete flow, use basePerCount - paused
        const increment = Math.max(0, basePerCount - paused);
        const prev = habit.count ?? 0;
        const newCount = prev + increment;
        const total = (habit as any).workloadTotal ?? habit.must ?? 0;

        debug.log('[handleComplete] Start->Complete flow:', {
          increment,
          prev,
          newCount,
          total,
          willBeCompleted: total > 0 ? (newCount >= total) : true
        });

        // update habit
        setHabits(s => s.map(h => h.id === habitId ? ({ 
          ...h, 
          count: newCount, 
          completed: total > 0 ? (newCount >= total) : true, 
          lastCompletedAt: now, 
          updatedAt: now 
        }) : h));

        const durationSeconds = Math.max(0, Math.floor((Date.now() - new Date(start.ts).getTime()) / 1000));
        (async () => {
          try {
            const idx = activities.findIndex(a => a.habitId === habitId && a.kind === 'start' && a.timestamp === start.ts);
            if (idx !== -1) {
              const old = activities[idx];
              const prevCountVal = (typeof old.prevCount === 'number') ? old.prevCount : (typeof old.newCount === 'number' ? old.newCount : (habit.count ?? 0));
              const updatedAct: Activity = { ...old, kind: 'complete', amount: increment, prevCount: prevCountVal, newCount, durationSeconds };
              const isTemporaryActivity = old.id.startsWith('a') && /^a\d+$/.test(old.id); // matches pattern like 'a1234567890'
              if (old.id && !isTemporaryActivity) {
                const u = await api.updateActivity(old.id, updatedAct);
                setActivities(acts => { const copy = [...acts]; const i = copy.findIndex(x => x.id === old.id); if (i !== -1) { copy[i] = u } return copy });
              } else {
                const created = await api.createActivity({ kind: 'complete', habitId, habitName: habit.name, timestamp: now, amount: increment, prevCount: prev, newCount, durationSeconds });
                setActivities(acts => { const copy = acts.filter(a => !(a.habitId === habitId && a.kind === 'start' && a.timestamp === start.ts)); return [created, ...copy] });
              }
            } else {
              const created = await api.createActivity({ kind: 'complete', habitId, habitName: habit.name, timestamp: now, amount: increment, prevCount: prev, newCount, durationSeconds });
              setActivities(acts => [created, ...acts]);
            }
          } catch (e) { 
            console.error(e);
          } finally {
            // 処理完了後にロックを解除
            setProcessingActions(prev => {
              const next = new Set(prev);
              next.delete(actionKey);
              return next;
            });
          }
        })();
        // clear start timer and state
        const to = start.timeoutId;
        if (typeof to === 'number') clearTimeout(to);
        setStarts(s => { const c = { ...s }; delete c[habitId]; return c; });
        // clear pausedLoads for this habit (we consumed it)
        setPausedLoads(s => { const c = { ...s }; delete c[habitId]; return c; });
        return;
      }

      // no start: create a standalone complete activity
      // For standalone complete, use custom amount if provided, otherwise use basePerCount
      const increment = amount ?? basePerCount;
      const prev = habit.count ?? 0;
      const newCount = prev + increment;
      const total = (habit as any).workloadTotal ?? habit.must ?? 0;

      debug.log('[handleComplete] Standalone complete flow:', {
        increment,
        prev,
        newCount,
        total,
        willBeCompleted: total > 0 ? (newCount >= total) : true
      });

      // update habit
      setHabits(s => s.map(h => h.id === habitId ? ({ 
        ...h, 
        count: newCount, 
        completed: total > 0 ? (newCount >= total) : true, 
        lastCompletedAt: now, 
        updatedAt: now 
      }) : h));

      // Persist the completion so it survives reload.
      (async () => {
        try {
          const created = await api.createActivity({ kind: 'complete', habitId, habitName: habit.name, timestamp: now, amount: increment, prevCount: prev, newCount });
          setActivities(a => [created, ...a]);
        } catch (e) {
          console.error(e);
          // fallback to local
          setActivities(a => [{ id: `a${Date.now()}`, kind: 'complete', habitId, habitName: habit.name, timestamp: now, amount: increment, prevCount: prev, newCount }, ...a]);
        } finally {
          // 処理完了後にロックを解除
          setProcessingActions(prev => {
            const next = new Set(prev);
            next.delete(actionKey);
            return next;
          });
        }
      })();
      // clear pausedLoads for this habit (standalone complete doesn't use paused loads)
      setPausedLoads(s => { const c = { ...s }; delete c[habitId]; return c; });
    } catch (error) {
      console.error('[handleComplete] Error:', error);
      // エラー時もロックを解除
      setProcessingActions(prev => {
        const next = new Set(prev);
        next.delete(actionKey);
        return next;
      });
    }
  }

  function handleStart(habitId: string) {
    // 重複実行防止
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
        // 処理完了後にロックを解除
        setProcessingActions(prev => {
          const next = new Set(prev);
          next.delete(actionKey);
          return next;
        });
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
        } finally {
          // 処理完了後にロックを解除
          setProcessingActions(prev => {
            const next = new Set(prev);
            next.delete(actionKey);
            return next;
          });
        }
      })();
    } catch (error) {
      console.error('[handleStart] Error:', error);
      // エラー時もロックを解除
      setProcessingActions(prev => {
        const next = new Set(prev);
        next.delete(actionKey);
        return next;
      });
    }
  }

  function handlePause(habitId: string) {
    // 重複実行防止
    const actionKey = `pause-${habitId}`;
    if (processingActions.has(actionKey)) {
      debug.log('[handlePause] Already processing, skipping:', habitId);
      return;
    }
    
    setProcessingActions(prev => new Set(prev).add(actionKey));
    
    try {
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
        } finally {
          // 処理完了後にロックを解除
          setProcessingActions(prev => {
            const next = new Set(prev);
            next.delete(actionKey);
            return next;
          });
        }
      })();
    } catch (error) {
      console.error('[handlePause] Error:', error);
      // エラー時もロックを解除
      setProcessingActions(prev => {
        const next = new Set(prev);
        next.delete(actionKey);
        return next;
      });
    }
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
      
      // Get all activities for this habit and sort them by timestamp (oldest first for calculation)
      const habitActivities = copy
        .filter(a => a.habitId === updated.habitId)
        .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
      
      debug.log('[propagateActivityChanges] Recalculating counts for habit activities:', {
        habitId: updated.habitId,
        activities: habitActivities.map(a => ({ 
          id: a.id, 
          timestamp: a.timestamp, 
          kind: a.kind, 
          amount: a.amount,
          oldPrevCount: a.prevCount,
          oldNewCount: a.newCount
        }))
      });
      
      // Recalculate counts for all activities in chronological order
      let runningCount = 0;
      for (let i = 0; i < habitActivities.length; i++) {
        const a = habitActivities[i];
        const originalIdx = copy.findIndex(x => x.id === a.id);
        
        if (a.kind === 'pause') {
          // pause doesn't change counts but stores paused load
          copy[originalIdx].prevCount = runningCount;
          copy[originalIdx].newCount = runningCount;
        } else if (a.kind === 'complete') {
          const per = (habits.find(h => h.id === a.habitId) as any)?.workloadPerCount ?? 1;
          // if a has amount specified, use it; else use per
          const amt = (typeof a.amount === 'number' ? a.amount : per);
          copy[originalIdx].prevCount = runningCount;
          copy[originalIdx].newCount = runningCount + amt;
          runningCount += amt;
        } else if (a.kind === 'start') {
          copy[originalIdx].prevCount = runningCount;
          copy[originalIdx].newCount = runningCount;
        } else if (a.kind === 'skip') {
          copy[originalIdx].prevCount = runningCount;
          copy[originalIdx].newCount = runningCount;
        }
      }
      
      // Update the habit's stored count to the final running count
      if (habitActivities.length > 0) {
        debug.log('[propagateActivityChanges] Updating habit count:', {
          habitId: updated.habitId,
          finalCount: runningCount,
          activities: habitActivities.map(x => ({ kind: x.kind, amount: x.amount, newCount: copy.find(c => c.id === x.id)?.newCount }))
        });
        
        setHabits(hs => hs.map(h => {
          if (h.id !== updated.habitId) return h;
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