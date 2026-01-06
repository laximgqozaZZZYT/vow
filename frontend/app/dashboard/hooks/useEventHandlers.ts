"use client";

import { useState } from 'react';
import api from '../../../lib/api';
import type { Goal, Habit, Activity, HabitInitial, RecurringRequest, CreateHabitPayload } from '../types';

interface UseEventHandlersProps {
  habits: Habit[];
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
  goals: Goal[];
  activities: Activity[];
  setActivities: React.Dispatch<React.SetStateAction<Activity[]>>;
}

export function useEventHandlers({ habits, setHabits, goals, activities, setActivities }: UseEventHandlersProps) {
  const [recurringRequest, setRecurringRequest] = useState<RecurringRequest | null>(null);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [newHabitInitial, setNewHabitInitial] = useState<HabitInitial | null>(null);
  const [newHabitInitialType, setNewHabitInitialType] = useState<"do" | "avoid" | undefined>(undefined);

  const selectedHabit = habits.find((h) => h.id === selectedHabitId) ?? null;

  // Update habit when calendar event is moved/resized
  async function handleEventChange(
    habitId: string,
    updated: { start?: string; end?: string; timingIndex?: number }
  ) {
    const startIso = updated.start;
    const endIso = updated.end;
    
    // Convert UTC datetime to local date and time
    let newDue: string | undefined;
    let newTime: string | undefined;
    let newEnd: string | undefined;
    
    if (startIso) {
      const startDate = new Date(startIso);
      // Use local date (not UTC date)
      newDue = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      
      if (startIso.length > 10) {
        // Use local time (not UTC time)
        newTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
      }
    }
    
    if (endIso && endIso.length > 10) {
      const endDate = new Date(endIso);
      // Use local time (not UTC time)
      newEnd = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
    }
    
    const timingIndex = typeof updated.timingIndex === 'number' ? updated.timingIndex : undefined;

    console.log('[EventHandlers] handleEventChange called:', { 
      habitId, 
      startIso, 
      endIso, 
      newDue, 
      newTime, 
      newEnd, 
      timingIndex,
      'startDate (local)': startIso ? new Date(startIso).toString() : 'N/A',
      'endDate (local)': endIso ? new Date(endIso).toString() : 'N/A'
    });

    const prev = habits.find(h => h.id === habitId);
    if (!prev) {
      console.log('[EventHandlers] Habit not found:', habitId);
      return;
    }

    console.log('[EventHandlers] Found habit:', {
      id: prev.id,
      name: prev.name,
      dueDate: prev.dueDate,
      time: (prev as any).time,
      endTime: (prev as any).endTime,
      timings: (prev as any).timings
    });

    // Build the update payload - match backend expectations
    const payload: any = {};
    
    // Always include the basic fields
    if (newDue !== undefined) payload.dueDate = newDue;
    if (newTime !== undefined) payload.time = newTime;
    if (newEnd !== undefined) payload.endTime = newEnd;
    
    // Include timingIndex if specified - backend will handle timings update
    if (typeof timingIndex === 'number') {
      payload.timingIndex = timingIndex;
      console.log('[EventHandlers] Including timingIndex in payload:', timingIndex);
    }

    console.log('[EventHandlers] Final update payload before API call:', payload);
    console.log('[EventHandlers] Payload types:', {
      dueDate: typeof payload.dueDate,
      time: typeof payload.time,
      endTime: typeof payload.endTime,
      timingIndex: typeof payload.timingIndex
    });

    // Optimistic UI update
    setHabits((s) => s.map(h => {
      if (h.id !== habitId) return h;
      const now = new Date().toISOString();
      const next: any = {
        ...h,
        updatedAt: now,
      };

      // Update basic fields
      if (newDue !== undefined) next.dueDate = newDue;
      if (newTime !== undefined) next.time = newTime;
      if (newEnd !== undefined) next.endTime = newEnd;

      // Update timings if timingIndex is specified
      if (typeof timingIndex === 'number') {
        const timings = Array.isArray((h as any).timings) ? (h as any).timings : [];
        console.log('[EventHandlers] Current timings for optimistic update:', timings);
        
        if (timings[timingIndex]) {
          const updatedTimings = [...timings];
          const timing = { ...updatedTimings[timingIndex] };
          
          // Update the specific timing entry
          if (newDue) timing.date = newDue;
          if (newTime !== undefined) timing.start = newTime;
          if (newEnd !== undefined) timing.end = newEnd;
          
          updatedTimings[timingIndex] = timing;
          next.timings = updatedTimings;
          
          console.log('[EventHandlers] Optimistically updated timings:', updatedTimings);
        } else {
          console.warn('[EventHandlers] Timing index out of bounds for optimistic update:', timingIndex, 'in', timings);
        }
      }

      console.log('[EventHandlers] Optimistic update result:', next);
      return next;
    }));

    // Persist to backend
    try {
      console.log('[EventHandlers] Sending API request to update habit...');
      const saved = await api.updateHabit(habitId, payload);
      console.log('[EventHandlers] API response received successfully:', saved);
      console.log('[EventHandlers] API response timings:', (saved as any).timings);
      
      // Always use the API response to ensure consistency
      setHabits((s) => s.map(h => {
        if (h.id === habitId) {
          console.log('[EventHandlers] Updating habit state with API response');
          return saved;
        }
        return h;
      }));
    } catch (e) {
      console.error('[EventHandlers] API request failed:', e);
      // revert to previous state if persistence fails
      setHabits((s) => s.map(h => h.id === habitId ? prev : h));
    }
  }

  async function createHabit(payload: CreateHabitPayload) {
    try {
      const h = await api.createHabit(payload);
      setHabits((s) => [...s, h]);
    } catch (e) { 
      console.error(e);
    }
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
    createHabit
  };
}