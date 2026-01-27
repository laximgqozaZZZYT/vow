"use client";

/**
 * useHabitInventory Hook
 * 
 * Custom hook for managing habit inventory assessment state.
 * Handles batch assessment logic with rate limiting (1 per 2 seconds).
 * Supports cancellation and resumption.
 * 
 * @module useHabitInventory
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6, 3.7
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { QuotaStatus } from '../app/dashboard/components/Widget.QuotaStatus';
import type { InventorySummaryData } from '../app/dashboard/components/Modal.InventorySummary';

// =============================================================================
// Types
// =============================================================================

export interface UnassessedHabit {
  id: string;
  name: string;
  frequency?: string;
  workload_per_count?: number;
  workload_unit?: string | null;
}

export interface AssessmentResult {
  habitId: string;
  habitName: string;
  level: number;
  levelTier: string;
  firewallTriggered: boolean;
  voiQuestions?: { factId: string; question: string }[];
}

export interface InventoryState {
  /** Whether the inventory is currently running */
  isRunning: boolean;
  /** Current inventory session ID */
  inventoryId: string | null;
  /** List of habits to assess */
  habits: UnassessedHabit[];
  /** Total number of habits */
  totalCount: number;
  /** Number of completed assessments */
  completedCount: number;
  /** Number of habits pending data (firewall triggered) */
  pendingDataCount: number;
  /** Currently assessing habit */
  currentHabit: UnassessedHabit | null;
  /** Assessment results */
  results: AssessmentResult[];
  /** Habits that need more data */
  pendingDataHabits: { id: string; name: string }[];
  /** Error message if any */
  error: string | null;
  /** Whether the inventory is complete */
  isComplete: boolean;
}

export interface UseHabitInventoryOptions {
  /** API base URL */
  apiBaseUrl?: string;
  /** Rate limit delay in milliseconds (default: 2000) */
  rateLimitMs?: number;
  /** Callback when inventory completes */
  onComplete?: (summary: InventorySummaryData) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
}

export interface UseHabitInventoryReturn {
  /** Current inventory state */
  state: InventoryState;
  /** Quota status */
  quotaStatus: QuotaStatus | null;
  /** Loading state for initial data fetch */
  loading: boolean;
  /** Fetch unassessed habits */
  fetchUnassessedHabits: () => Promise<void>;
  /** Start the inventory assessment */
  startInventory: (selectedHabitIds?: string[]) => Promise<void>;
  /** Cancel the inventory (saves progress) */
  cancelInventory: () => void;
  /** Get summary data */
  getSummary: () => InventorySummaryData | null;
  /** Reset the inventory state */
  reset: () => void;
}

// =============================================================================
// Initial State
// =============================================================================

const initialState: InventoryState = {
  isRunning: false,
  inventoryId: null,
  habits: [],
  totalCount: 0,
  completedCount: 0,
  pendingDataCount: 0,
  currentHabit: null,
  results: [],
  pendingDataHabits: [],
  error: null,
  isComplete: false,
};

// =============================================================================
// Hook Implementation
// =============================================================================

export function useHabitInventory(options: UseHabitInventoryOptions = {}): UseHabitInventoryReturn {
  const {
    apiBaseUrl = '/api',
    rateLimitMs = 2000,
    onComplete,
    onError,
  } = options;

  const [state, setState] = useState<InventoryState>(initialState);
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(false);

  // Refs for managing async operations
  const abortControllerRef = useRef<AbortController | null>(null);
  const isRunningRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Fetch unassessed habits from the API
   */
  const fetchUnassessedHabits = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/level/inventory/unassessed`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch unassessed habits');
      }

      const data = await response.json();

      setState(prev => ({
        ...prev,
        habits: data.habits ?? [],
        totalCount: data.totalCount ?? 0,
      }));

      setQuotaStatus(data.quotaStatus ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: message }));
      onError?.(message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, onError]);

  /**
   * Assess a single habit
   */
  const assessHabit = useCallback(async (
    inventoryId: string,
    habit: UnassessedHabit,
    signal: AbortSignal
  ): Promise<AssessmentResult | null> => {
    try {
      const response = await fetch(`${apiBaseUrl}/level/inventory/${inventoryId}/assess-next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ habitId: habit.id }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error === 'QUOTA_EXCEEDED') {
          throw new Error('QUOTA_EXCEEDED');
        }
        throw new Error(errorData.message || 'Assessment failed');
      }

      const data = await response.json();

      if (data.success) {
        return {
          habitId: data.habitId,
          habitName: data.habitName,
          level: data.level,
          levelTier: data.levelTier,
          firewallTriggered: data.firewallTriggered,
          voiQuestions: data.voiQuestions,
        };
      } else if (data.status === 'pending_data') {
        // Firewall triggered - mark as pending data
        return {
          habitId: habit.id,
          habitName: habit.name,
          level: 0,
          levelTier: 'unknown',
          firewallTriggered: true,
          voiQuestions: data.voiQuestions,
        };
      }

      return null;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }, [apiBaseUrl]);

  /**
   * Start the inventory assessment
   */
  const startInventory = useCallback(async (selectedHabitIds?: string[]) => {
    // Abort any existing operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);
    isRunningRef.current = true;

    try {
      // Start inventory session
      const startResponse = await fetch(`${apiBaseUrl}/level/inventory/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ habitIds: selectedHabitIds }),
        signal,
      });

      if (!startResponse.ok) {
        const errorData = await startResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to start inventory');
      }

      const startData = await startResponse.json();

      const inventoryId = startData.inventoryId;
      const habitsToAssess: UnassessedHabit[] = startData.habits ?? [];

      setState(prev => ({
        ...prev,
        isRunning: true,
        inventoryId,
        habits: habitsToAssess,
        totalCount: habitsToAssess.length,
        completedCount: 0,
        pendingDataCount: 0,
        results: [],
        pendingDataHabits: [],
        error: null,
        isComplete: false,
      }));

      setQuotaStatus(startData.quotaStatus ?? null);
      setLoading(false);

      // Process each habit with rate limiting
      const results: AssessmentResult[] = [];
      const pendingDataHabits: { id: string; name: string }[] = [];

      for (let i = 0; i < habitsToAssess.length; i++) {
        // Check if cancelled
        if (!isRunningRef.current || signal.aborted) {
          break;
        }

        const habit = habitsToAssess[i];

        // Update current habit
        setState(prev => ({
          ...prev,
          currentHabit: habit,
        }));

        try {
          const result = await assessHabit(inventoryId, habit, signal);

          if (result) {
            if (result.firewallTriggered) {
              pendingDataHabits.push({ id: habit.id, name: habit.name });
              setState(prev => ({
                ...prev,
                pendingDataCount: prev.pendingDataCount + 1,
                pendingDataHabits: [...prev.pendingDataHabits, { id: habit.id, name: habit.name }],
              }));
            } else {
              results.push(result);
              setState(prev => ({
                ...prev,
                completedCount: prev.completedCount + 1,
                results: [...prev.results, result],
              }));
            }
          }
        } catch (error) {
          if ((error as Error).message === 'QUOTA_EXCEEDED') {
            setState(prev => ({
              ...prev,
              error: '評価回数の上限に達しました',
              isRunning: false,
            }));
            onError?.('評価回数の上限に達しました');
            break;
          }
          // Continue with next habit on other errors
          console.error(`Failed to assess habit ${habit.id}:`, error);
        }

        // Rate limiting - wait 2 seconds before next assessment
        if (i < habitsToAssess.length - 1 && isRunningRef.current) {
          await new Promise(resolve => setTimeout(resolve, rateLimitMs));
        }
      }

      // Mark as complete
      if (isRunningRef.current) {
        const summary = calculateSummary(results, pendingDataHabits);
        
        setState(prev => ({
          ...prev,
          isRunning: false,
          currentHabit: null,
          isComplete: true,
        }));

        onComplete?.(summary);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({
          ...prev,
          isRunning: false,
          error: message,
        }));
        onError?.(message);
      }
    } finally {
      isRunningRef.current = false;
      setLoading(false);
    }
  }, [apiBaseUrl, assessHabit, rateLimitMs, onComplete, onError]);

  /**
   * Cancel the inventory
   */
  const cancelInventory = useCallback(() => {
    isRunningRef.current = false;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setState(prev => ({
      ...prev,
      isRunning: false,
      currentHabit: null,
    }));
  }, []);

  /**
   * Calculate summary from results
   */
  const calculateSummary = (
    results: AssessmentResult[],
    pendingDataHabits: { id: string; name: string }[]
  ): InventorySummaryData => {
    const distribution = {
      beginner: 0,
      intermediate: 0,
      advanced: 0,
      expert: 0,
    };

    let totalLevel = 0;

    for (const result of results) {
      if (result.levelTier in distribution) {
        distribution[result.levelTier as keyof typeof distribution]++;
      }
      totalLevel += result.level;
    }

    const averageLevel = results.length > 0 ? Math.round(totalLevel / results.length) : 0;

    return {
      totalAssessed: results.length,
      pendingData: pendingDataHabits.length,
      distribution,
      averageLevel,
      assessedHabits: results.map(r => ({
        id: r.habitId,
        name: r.habitName,
        level: r.level,
        levelTier: r.levelTier,
      })),
      pendingDataHabits,
    };
  };

  /**
   * Get current summary
   */
  const getSummary = useCallback((): InventorySummaryData | null => {
    if (state.results.length === 0 && state.pendingDataHabits.length === 0) {
      return null;
    }
    return calculateSummary(state.results, state.pendingDataHabits);
  }, [state.results, state.pendingDataHabits]);

  /**
   * Reset the inventory state
   */
  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    isRunningRef.current = false;
    setState(initialState);
  }, []);

  return {
    state,
    quotaStatus,
    loading,
    fetchUnassessedHabits,
    startInventory,
    cancelInventory,
    getSummary,
    reset,
  };
}

export default useHabitInventory;
