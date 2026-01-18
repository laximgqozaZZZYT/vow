import { useState, useMemo } from 'react';
import api from '../../../lib/api';
import type { Goal, Habit } from '../types';

interface UseGoalManagerProps {
  goals: Goal[];
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  habits: Habit[];
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
  selectedGoal: string | null;
  setSelectedGoal: React.Dispatch<React.SetStateAction<string | null>>;
  editingGoalId: string | null;
  setEditingGoalId: React.Dispatch<React.SetStateAction<string | null>>;
}

interface UseGoalManagerReturn {
  goalsById: Record<string, Goal>;
  editingGoal: Goal | null;
  createGoal: (payload: { name: string; details?: string; dueDate?: string; parentId?: string | null }) => Promise<void>;
  updateGoal: (updated: Partial<Goal> & { id: string }) => void;
  deleteGoal: (id: string) => void;
  completeGoalCascade: (goalId: string) => Promise<void>;
  setGoalParent: (goalId: string, parentId: string | null) => void;
  mergeGoals: (sourceId: string, targetId: string) => void;
  collectGoalSubtreeIds: (rootId: string) => string[];
}

export function useGoalManager({
  goals,
  setGoals,
  habits,
  setHabits,
  selectedGoal,
  setSelectedGoal,
  editingGoalId,
  setEditingGoalId
}: UseGoalManagerProps): UseGoalManagerReturn {
  
  // Goal hierarchy helpers
  const goalsById = useMemo(() => Object.fromEntries(goals.map(g => [g.id, g])), [goals]);
  
  const editingGoal = goals.find(g => g.id === editingGoalId) ?? null;

  async function createGoal(payload: { name: string; details?: string; dueDate?: string; parentId?: string | null }) {
    try {
      const g = await api.createGoal(payload);
      setGoals((s) => [...s, g]);
      setSelectedGoal(g.id);
      return g; // 作成されたGoalを返す
    } catch (e) { 
      console.error(e);
      return null;
    }
  }

  function setGoalParent(goalId: string, parentId: string | null) {
    setGoals((s) => s.map(g => g.id === goalId ? { ...g, parentId } : g));
  }

  function mergeGoals(sourceId: string, targetId: string) {
    // Move every habit from source to target, then remove source
    setHabits((s) => s.map(h => h.goalId === sourceId ? { ...h, goalId: targetId } : h));
    setGoals((s) => s.filter(g => g.id !== sourceId));
    if (selectedGoal === sourceId) setSelectedGoal(targetId);
  }

  // Accept partial updates (createdAt/updatedAt may be omitted by the modal)
  function updateGoal(updated: Partial<Goal> & { id: string }) {
    setGoals((s) => s.map(g => g.id === updated.id ? { ...g, ...updated, updatedAt: new Date().toISOString() } : g));
    // persist
    (async () => { 
      try { 
        await api.updateGoal(updated.id, updated);
      } catch(e) { 
        console.error(e);
      }
    })();
  }

  function deleteGoal(id: string) {
    // remove the goal and any child goals (simple approach: filter by id)
    setGoals((s) => s.filter(g => g.id !== id));
    // also reassign or remove habits under that goal: here we remove habits belonging to that goal
    setHabits((s) => s.filter(h => h.goalId !== id));
    (async () => { 
      try { 
        await api.deleteGoal(id);
      } catch (e) { 
        console.error(e);
      }
    })();
    if (selectedGoal === id) setSelectedGoal(null);
    if (editingGoalId === id) setEditingGoalId(null);
  }

  // Collect descendant goal ids including self.
  function collectGoalSubtreeIds(rootId: string) {
    const ids: string[] = [];
    const stack: string[] = [rootId];
    const seen = new Set<string>();
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      for (const g of goals) {
        if (g.parentId === id) stack.push(g.id);
      }
    }
    return ids;
  }

  async function completeGoalCascade(goalId: string) {
    // Optimistically update local state first.
    const subtree = new Set(collectGoalSubtreeIds(goalId));
    const now = new Date().toISOString();
    setGoals((s) => s.map(g => subtree.has(g.id) ? { ...g, isCompleted: true, updatedAt: now } : g));
    // Treat descendant habits as "not to be done": inactive + completed.
    setHabits((s) => s.map(h => subtree.has(h.goalId) ? { ...h, active: false, completed: true, updatedAt: now } : h));

    // Persist
    try {
      await api.updateGoal(goalId, { isCompleted: true, cascade: true });
    } catch (e) {
      // Surface backend error details to make debugging actionable.
      const err = e as Error & { url?: string; status?: number; body?: unknown };
      const details = {
        name: err?.name,
        message: err?.message ?? String(err),
        url: err?.url,
        status: err?.status,
        body: err?.body,
        keys: err && typeof err === 'object' ? Object.keys(err) : undefined,
      };
      console.error('[completeGoalCascade] error', details);
      // If persistence fails, we keep optimistic state; user can refresh.
    }
  }

  return {
    goalsById,
    editingGoal,
    createGoal,
    updateGoal,
    deleteGoal,
    completeGoalCascade,
    setGoalParent,
    mergeGoals,
    collectGoalSubtreeIds
  };
}