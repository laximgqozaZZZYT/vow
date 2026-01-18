"use client";

import { useState } from 'react';
import api from '../../../lib/api';
import { debug } from '../../../lib/debug';
import type { Goal, Habit, Activity, HabitInitial, RecurringRequest, CreateHabitPayload } from '../types';

interface UseEventHandlersProps {
  habits: Habit[];
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
  goals: Goal[];
  activities: Activity[];
  setActivities: React.Dispatch<React.SetStateAction<Activity[]>>;
}

interface RecurringConfirmation {
  habitId: string;
  habitName: string;
  originalTime: string;
  newTime: string;
  originalEndTime?: string;
  newEndTime?: string;
  date: string;
  timingIndex?: number;
  updated: { start?: string; end?: string; timingIndex?: number };
}

/** Parse ISO datetime to local date and time */
function parseIsoToLocal(iso: string): { date: string; time?: string } {
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const time = iso.length > 10 
    ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : undefined;
  return { date, time };
}

/** Build update payload for habit */
function buildHabitUpdatePayload(
  newDue: string | undefined,
  newTime: string | undefined,
  newEnd: string | undefined,
  timingIndex: number | undefined
): Partial<Habit> & { timingIndex?: number } {
  const payload: Partial<Habit> & { timingIndex?: number } = {};
  if (newDue !== undefined) payload.dueDate = newDue;
  if (newTime !== undefined) payload.time = newTime;
  if (newEnd !== undefined) payload.endTime = newEnd;
  if (typeof timingIndex === 'number') payload.timingIndex = timingIndex;
  return payload;
}

export function useEventHandlers({ habits, setHabits, goals, activities, setActivities }: UseEventHandlersProps) {
  const [recurringRequest, setRecurringRequest] = useState<RecurringRequest | null>(null);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [newHabitInitial, setNewHabitInitial] = useState<HabitInitial | null>(null);
  const [newHabitInitialType, setNewHabitInitialType] = useState<"do" | "avoid" | undefined>(undefined);
  const [recurringConfirmation, setRecurringConfirmation] = useState<RecurringConfirmation | null>(null);

  const selectedHabit = habits.find((h) => h.id === selectedHabitId) ?? null;

  // Update habit when calendar event is moved/resized
  async function handleEventChange(
    habitId: string,
    updated: { start?: string; end?: string; timingIndex?: number }
  ) {
    const { newDue, newTime, newEnd, timingIndex } = parseEventUpdate(updated);

    debug.log('[EventHandlers] handleEventChange called:', { 
      habitId, startIso: updated.start, endIso: updated.end, 
      newDue, newTime, newEnd, timingIndex
    });

    const prev = habits.find(h => h.id === habitId);
    if (!prev) {
      debug.log('[EventHandlers] Habit not found:', habitId);
      return;
    }

    const payload = buildHabitUpdatePayload(newDue, newTime, newEnd, timingIndex);
    debug.log('[EventHandlers] Final update payload:', payload);

    // Optimistic UI update
    setHabits(s => applyOptimisticUpdate(s, habitId, newDue, newTime, newEnd, timingIndex));

    // Persist to backend
    await persistHabitUpdate(habitId, payload, prev);
  }

  /** Parse event update to local date/time values */
  function parseEventUpdate(updated: { start?: string; end?: string; timingIndex?: number }) {
    let newDue: string | undefined;
    let newTime: string | undefined;
    let newEnd: string | undefined;
    
    if (updated.start) {
      const parsed = parseIsoToLocal(updated.start);
      newDue = parsed.date;
      newTime = parsed.time;
    }
    
    if (updated.end && updated.end.length > 10) {
      const parsed = parseIsoToLocal(updated.end);
      newEnd = parsed.time;
    }
    
    return { newDue, newTime, newEnd, timingIndex: updated.timingIndex };
  }

  /** Apply optimistic update to habits state */
  function applyOptimisticUpdate(
    habits: Habit[],
    habitId: string,
    newDue: string | undefined,
    newTime: string | undefined,
    newEnd: string | undefined,
    timingIndex: number | undefined
  ): Habit[] {
    return habits.map(h => {
      if (h.id !== habitId) return h;
      
      const now = new Date().toISOString();
      const next: Habit = { ...h, updatedAt: now };

      if (newDue !== undefined) next.dueDate = newDue;
      if (newTime !== undefined) next.time = newTime;
      if (newEnd !== undefined) next.endTime = newEnd;

      if (typeof timingIndex === 'number') {
        next.timings = updateTimingAtIndex(h.timings, timingIndex, newDue, newTime, newEnd);
      }

      return next;
    });
  }

  /** Update a specific timing entry */
  function updateTimingAtIndex(
    timings: any[] | undefined,
    index: number,
    newDue: string | undefined,
    newTime: string | undefined,
    newEnd: string | undefined
  ): any[] {
    const arr = Array.isArray(timings) ? [...timings] : [];
    if (!arr[index]) return arr;
    
    const timing = { ...arr[index] };
    if (newDue) timing.date = newDue;
    if (newTime !== undefined) timing.start = newTime;
    if (newEnd !== undefined) timing.end = newEnd;
    arr[index] = timing;
    
    return arr;
  }

  /** Persist habit update to backend */
  async function persistHabitUpdate(
    habitId: string,
    payload: Partial<Habit> & { timingIndex?: number },
    prev: Habit
  ) {
    try {
      debug.log('[EventHandlers] Sending API request...');
      const saved = await api.updateHabit(habitId, payload);
      debug.log('[EventHandlers] API response:', saved);
      
      setHabits(s => s.map(h => h.id === habitId ? saved : h));
    } catch (e) {
      console.error('[EventHandlers] API request failed:', e);
      setHabits(s => s.map(h => h.id === habitId ? prev : h));
    }
  }

  // Handle recurring habit confirmation
  async function handleRecurringConfirmation(action: 'updateTiming' | 'createException') {
    if (!recurringConfirmation) return;

    const { habitId, updated, timingIndex, date, newTime, newEndTime } = recurringConfirmation;
    
    try {
      if (action === 'updateTiming') {
        // Update the timing pattern itself
        debug.log('[EventHandlers] Updating timing pattern for recurring habit');
        await handleEventChange(habitId, updated);
      } else {
        // Create exception for this specific date
        debug.log('[EventHandlers] Creating exception for specific date');
        
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;

        // Add new Date timing for this specific date
        const currentTimings = Array.isArray((habit as any).timings) ? (habit as any).timings : [];
        const newTiming = {
          type: 'Date',
          date: date,
          start: newTime,
          end: newEndTime
        };

        // Add outdate entry to exclude the original timing for this date
        const currentOutdates = Array.isArray((habit as any).outdates) ? (habit as any).outdates : [];
        const originalTiming = typeof timingIndex === 'number' ? currentTimings[timingIndex] : null;
        
        let newOutdate = null;
        if (originalTiming) {
          newOutdate = {
            type: 'A Day',
            date: date,
            start: originalTiming.start,
            end: originalTiming.end
          };
        }

        const payload: Partial<Habit> = {
          timings: [...currentTimings, newTiming],
          outdates: newOutdate ? [...currentOutdates, newOutdate] : currentOutdates
        };

        debug.log('[EventHandlers] Creating exception with payload:', payload);
        const saved = await api.updateHabit(habitId, payload);
        setHabits((s) => s.map(h => h.id === habitId ? saved : h));
      }
    } catch (e) {
      console.error('[EventHandlers] Failed to handle recurring confirmation:', e);
    } finally {
      setRecurringConfirmation(null);
    }
  }

  function cancelRecurringConfirmation() {
    setRecurringConfirmation(null);
  }

  async function createHabit(payload: CreateHabitPayload) {
    debug.log('[useEventHandlers] createHabit called with payload:', payload);
    try {
      debug.log('[useEventHandlers] Calling api.createHabit...');
      const h = await api.createHabit(payload);
      debug.log('[useEventHandlers] api.createHabit success:', h);
      setHabits((s) => [...s, h]);
      debug.log('[useEventHandlers] Habit added to state');
      return h; // 作成されたHabitを返す
    } catch (e) { 
      console.error('[useEventHandlers] createHabit error:', e);
      console.error('[useEventHandlers] Error details:', {
        name: (e as any)?.name,
        message: (e as any)?.message,
        stack: (e as any)?.stack
      });
      throw e; // エラーを再スローして呼び出し元で処理できるようにする
    }
  }

  // Handle recurring habit time change request
  function handleRecurringHabitRequest(
    habitId: string,
    updated: { start?: string; end?: string; timingIndex?: number }
  ) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const startIso = updated.start;
    const endIso = updated.end;
    
    // Convert UTC datetime to local date and time
    let date: string = '';
    let newTime: string = '';
    let newEndTime: string | undefined;
    let originalTime: string = '';
    let originalEndTime: string | undefined;
    
    if (startIso) {
      const startDate = new Date(startIso);
      date = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      newTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
    }
    
    if (endIso) {
      const endDate = new Date(endIso);
      newEndTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
    }

    // Get original time from timing or habit
    const timings = (habit as any).timings ?? [];
    if (typeof updated.timingIndex === 'number' && timings[updated.timingIndex]) {
      const timing = timings[updated.timingIndex];
      originalTime = timing.start || '';
      originalEndTime = timing.end;
    } else {
      originalTime = (habit as any).time || '';
      originalEndTime = (habit as any).endTime;
    }

    setRecurringConfirmation({
      habitId,
      habitName: habit.name,
      originalTime,
      newTime,
      originalEndTime,
      newEndTime,
      date,
      timingIndex: updated.timingIndex,
      updated
    });
  }

  return {
    recurringRequest,
    setRecurringRequest,
    selectedHabitId,
    setSelectedHabitId,
    newHabitInitial,
    setNewHabitInitial,
    newHabitInitialType,
    setNewHabitInitialType,
    selectedHabit,
    handleEventChange,
    createHabit,
    recurringConfirmation,
    handleRecurringConfirmation,
    cancelRecurringConfirmation,
    handleRecurringHabitRequest
  };
}