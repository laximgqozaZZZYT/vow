'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabaseDirectClient } from '../../../lib/supabase-direct';
import type {
  SkillSet,
  SkillSetStatus,
  SkillSetStickyItem,
  SkillSetGoalItem,
  SkillSetHabitItem,
  SkillSetExecutionResult,
  CreateSkillSetPayload,
  UpdateSkillSetPayload,
  Note,
} from '../types';

// ============================================================================
// Snake-case to camelCase transform
// ============================================================================

interface NoteRaw {
  id: string;
  title: string;
  content: string | null;
  owner_type: string;
  owner_id: string;
  created_at: string;
  updated_at: string | null;
}

interface SkillSetStickyRaw {
  id?: string;
  sticky_id: string;
  display_order?: number;
  sticky?: Record<string, unknown> | null;
}

interface SkillSetGoalRaw {
  id?: string;
  goal_id: string;
  goal?: Record<string, unknown> | null;
}

interface SkillSetHabitRaw {
  id?: string;
  habit_id: string;
  habit?: Record<string, unknown> | null;
}

interface SkillSetRaw {
  id: string;
  name: string;
  description?: string | null;
  note_id?: string | null;
  note?: NoteRaw | null;
  status: SkillSetStatus;
  execution_result?: Record<string, unknown> | null;
  last_executed_at?: string | null;
  display_order: number;
  owner_type: string;
  owner_id: string;
  created_at: string;
  updated_at: string | null;
  skill_set_stickies?: SkillSetStickyRaw[];
  skill_set_goals?: SkillSetGoalRaw[];
  skill_set_habits?: SkillSetHabitRaw[];
}

function transformNote(raw: NoteRaw): Note {
  return {
    id: raw.id,
    title: raw.title,
    content: raw.content ?? '',
    ownerType: raw.owner_type,
    ownerId: raw.owner_id,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at ?? raw.created_at,
  };
}

function transformSkillSet(raw: SkillSetRaw): SkillSet {
  const stickies: SkillSetStickyItem[] = (raw.skill_set_stickies ?? []).map((s) => ({
    id: s.id ?? s.sticky_id,
    stickyId: s.sticky_id,
    displayOrder: s.display_order ?? 0,
    sticky: s.sticky as SkillSetStickyItem['sticky'],
  }));

  const goals: SkillSetGoalItem[] = (raw.skill_set_goals ?? []).map((g) => ({
    id: g.id ?? g.goal_id,
    goalId: g.goal_id,
    goal: g.goal as SkillSetGoalItem['goal'],
  }));

  const habits: SkillSetHabitItem[] = (raw.skill_set_habits ?? []).map((h) => ({
    id: h.id ?? h.habit_id,
    habitId: h.habit_id,
    habit: h.habit as SkillSetHabitItem['habit'],
  }));

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? undefined,
    noteId: raw.note_id ?? undefined,
    note: raw.note ? transformNote(raw.note) : undefined,
    status: raw.status,
    executionResult: raw.execution_result as SkillSetExecutionResult | undefined,
    lastExecutedAt: raw.last_executed_at ?? undefined,
    displayOrder: raw.display_order,
    ownerType: raw.owner_type,
    ownerId: raw.owner_id,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at ?? raw.created_at,
    stickies,
    goals,
    habits,
  };
}

// ============================================================================
// Types
// ============================================================================

export interface UseSkillSetsReturn {
  skillSets: SkillSet[];
  loading: boolean;
  error: Error | null;
  createSkillSet: (payload: CreateSkillSetPayload) => Promise<SkillSet>;
  updateSkillSet: (id: string, payload: UpdateSkillSetPayload) => Promise<void>;
  deleteSkillSet: (id: string) => Promise<void>;
  changeStatus: (id: string, status: SkillSetStatus) => Promise<void>;
  refresh: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export function useSkillSets(options: { authToken?: string | null }): UseSkillSetsReturn {
  const [skillSets, setSkillSets] = useState<SkillSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await supabaseDirectClient.getSkillSets();
      if (!mountedRef.current) return;

      setSkillSets((res || []).map(transformSkillSet));
    } catch (err) {
      if (!mountedRef.current) return;
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      console.error('[useSkillSets] Failed to fetch skill sets:', e);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  const createSkillSet = useCallback(async (payload: CreateSkillSetPayload): Promise<SkillSet> => {
    setError(null);

    try {
      const res = await supabaseDirectClient.createSkillSet(payload);
      if (!res) {
        throw new Error('No skill set returned');
      }

      const skillSet = transformSkillSet(res);

      if (mountedRef.current) {
        setSkillSets((prev) => [...prev, skillSet]);
      }

      return skillSet;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (mountedRef.current) {
        setError(e);
      }
      console.error('[useSkillSets] Failed to create skill set:', e);
      throw e;
    }
  }, []);

  const updateSkillSet = useCallback(async (id: string, payload: UpdateSkillSetPayload): Promise<void> => {
    setError(null);

    const previousSkillSets = skillSets;

    // Optimistic update (simple fields only)
    setSkillSets((prev) =>
      prev.map((ss) =>
        ss.id === id
          ? {
              ...ss,
              ...(payload.name !== undefined && { name: payload.name }),
              ...(payload.description !== undefined && { description: payload.description }),
              ...(payload.status !== undefined && { status: payload.status }),
              ...(payload.displayOrder !== undefined && { displayOrder: payload.displayOrder }),
              ...(payload.noteId !== undefined && { noteId: payload.noteId ?? undefined }),
              updatedAt: new Date().toISOString(),
            }
          : ss
      )
    );

    try {
      const res = await supabaseDirectClient.updateSkillSet(id, payload);
      // Replace with full response (includes updated relations)
      if (res && mountedRef.current) {
        const updated = transformSkillSet(res);
        setSkillSets((prev) =>
          prev.map((ss) => (ss.id === id ? updated : ss))
        );
      }
    } catch (err) {
      if (mountedRef.current) {
        setSkillSets(previousSkillSets);
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        console.error('[useSkillSets] Failed to update skill set:', e);
      }
      throw err;
    }
  }, [skillSets]);

  const deleteSkillSet = useCallback(async (id: string): Promise<void> => {
    setError(null);

    const previousSkillSets = skillSets;

    setSkillSets((prev) => prev.filter((ss) => ss.id !== id));

    try {
      await supabaseDirectClient.deleteSkillSet(id);
    } catch (err) {
      if (mountedRef.current) {
        setSkillSets(previousSkillSets);
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        console.error('[useSkillSets] Failed to delete skill set:', e);
      }
      throw err;
    }
  }, [skillSets]);

  const changeStatus = useCallback(async (id: string, status: SkillSetStatus): Promise<void> => {
    setError(null);

    const previousSkillSets = skillSets;

    setSkillSets((prev) =>
      prev.map((ss) =>
        ss.id === id
          ? { ...ss, status, updatedAt: new Date().toISOString() }
          : ss
      )
    );

    try {
      await supabaseDirectClient.updateSkillSetStatus(id, status);
    } catch (err) {
      if (mountedRef.current) {
        setSkillSets(previousSkillSets);
        const msg = err instanceof Error ? err.message
          : (typeof err === 'object' && err !== null && 'message' in err)
            ? String((err as { message: unknown }).message)
            : String(err);
        const e = new Error(msg);
        setError(e);
        console.error('[useSkillSets] Failed to change status:', msg, err);
      }
      throw err;
    }
  }, [skillSets]);

  return {
    skillSets,
    loading,
    error,
    createSkillSet,
    updateSkillSet,
    deleteSkillSet,
    changeStatus,
    refresh,
  };
}

export default useSkillSets;
