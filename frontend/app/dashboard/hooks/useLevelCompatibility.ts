"use client";

/**
 * useLevelCompatibility Hook
 * 
 * Provides level compatibility checking for habit creation.
 * Calls the backend API to check if a proposed habit level is compatible
 * with the user's current level.
 * 
 * @module useLevelCompatibility
 * 
 * Validates: Requirements 3.1, 3.2
 */

import { useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { debug } from '../../../lib/debug';

export type MismatchSeverity = 'none' | 'mild' | 'moderate' | 'severe';

export interface LevelMismatchResult {
  isMismatch: boolean;
  userLevel: number;
  habitLevel: number;
  levelGap: number;
  severity: MismatchSeverity;
  recommendation: 'proceed' | 'suggest_baby_steps' | 'strongly_suggest_baby_steps';
}

export interface BabyStepPlan {
  targetLevel: number;
  name: string;
  changes: Array<{
    variableId: string;
    variableName: string;
    variableNameJa: string;
    currentValue: string;
    newValue: string;
    pointsReduced: number;
  }>;
  workloadChanges: {
    workloadPerCount?: { old: number; new: number; changePercent: number };
    frequency?: { old: string; new: string };
    duration?: { old: number; new: number };
    targetCount?: { old: number; new: number };
  };
  explanation: string;
  estimatedDifficulty: string;
}

export interface LevelCompatibilityResponse {
  mismatch: LevelMismatchResult;
  babyStepPlans?: {
    lv50: BabyStepPlan;
    lv10: BabyStepPlan & {
      minimalHabit?: {
        cue: string;
        action: string;
        stopCondition: string;
        fallback: string;
        estimatedDuration: number;
      };
    };
  };
}

interface UseLevelCompatibilityReturn {
  /** Check level compatibility for a proposed habit */
  checkCompatibility: (proposedLevel: number, habitName?: string) => Promise<LevelCompatibilityResponse | null>;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Last compatibility result */
  result: LevelCompatibilityResponse | null;
  /** Clear the result */
  clearResult: () => void;
}

/**
 * Estimate habit level from workload settings
 * This is a client-side estimation for quick feedback
 */
export function estimateLevelFromWorkload(params: {
  workloadPerCount?: number;
  workloadTotal?: number;
  frequency?: string; // 'Daily', 'Weekly', 'Monthly'
  duration?: number; // minutes
}): number {
  const { workloadPerCount = 1, workloadTotal = 1, frequency = 'Daily', duration = 30 } = params;
  
  // Base level calculation (simplified THLI-24 estimation)
  let level = 0;
  
  // Frequency contribution (⑱ variable)
  switch (frequency) {
    case 'Daily': level += 30; break;
    case 'Weekly': level += 15; break;
    case 'Monthly': level += 5; break;
    default: level += 20;
  }
  
  // Duration contribution (⑲ variable)
  if (duration <= 5) level += 5;
  else if (duration <= 15) level += 15;
  else if (duration <= 30) level += 25;
  else if (duration <= 60) level += 40;
  else level += 60;
  
  // Workload contribution (⑳ variable)
  const totalLoad = workloadPerCount * workloadTotal;
  if (totalLoad <= 1) level += 5;
  else if (totalLoad <= 3) level += 15;
  else if (totalLoad <= 5) level += 25;
  else if (totalLoad <= 10) level += 40;
  else level += 60;
  
  return Math.min(199, Math.max(0, level));
}

/**
 * Hook for checking level compatibility
 */
export function useLevelCompatibility(): UseLevelCompatibilityReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LevelCompatibilityResponse | null>(null);

  const checkCompatibility = useCallback(async (
    proposedLevel: number,
    habitName?: string
  ): Promise<LevelCompatibilityResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get current user
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        // Guest mode - use local storage for user level
        const guestUserLevel = localStorage.getItem('guest-user-level');
        const userLevel = guestUserLevel ? parseInt(guestUserLevel, 10) : 0;
        
        // Calculate mismatch locally for guest users
        const levelGap = proposedLevel - userLevel;
        const isMismatch = levelGap > 50;
        
        let severity: MismatchSeverity = 'none';
        let recommendation: 'proceed' | 'suggest_baby_steps' | 'strongly_suggest_baby_steps' = 'proceed';
        
        if (levelGap >= 100) {
          severity = 'severe';
          recommendation = 'strongly_suggest_baby_steps';
        } else if (levelGap >= 76) {
          severity = 'moderate';
          recommendation = 'suggest_baby_steps';
        } else if (levelGap >= 50) {
          severity = 'mild';
          recommendation = 'suggest_baby_steps';
        }
        
        const localResult: LevelCompatibilityResponse = {
          mismatch: {
            isMismatch,
            userLevel,
            habitLevel: proposedLevel,
            levelGap,
            severity,
            recommendation,
          },
        };
        
        setResult(localResult);
        debug.log('[useLevelCompatibility] Guest mode result:', localResult);
        return localResult;
      }

      // Authenticated user - call backend API
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
      if (!backendUrl) {
        throw new Error('Backend API URL not configured');
      }

      const response = await fetch(
        `${backendUrl}/api/users/${session.user.id}/check-habit-compatibility`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            proposedLevel,
            habitName,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data: LevelCompatibilityResponse = await response.json();
      setResult(data);
      debug.log('[useLevelCompatibility] API result:', data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      debug.error('[useLevelCompatibility] Error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    checkCompatibility,
    isLoading,
    error,
    result,
    clearResult,
  };
}

/**
 * Hook for acknowledging level mismatch when creating a habit
 */
export function useAcknowledgeMismatch() {
  const [isLoading, setIsLoading] = useState(false);

  const acknowledgeMismatch = useCallback(async (
    habitId: string,
    levelGap: number
  ): Promise<boolean> => {
    setIsLoading(true);

    try {
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        // Guest mode - update local storage
        const guestHabits = JSON.parse(localStorage.getItem('guest-habits') || '[]');
        const habitIndex = guestHabits.findIndex((h: any) => h.id === habitId);
        
        if (habitIndex !== -1) {
          guestHabits[habitIndex] = {
            ...guestHabits[habitIndex],
            mismatchAcknowledged: true,
            mismatchAcknowledgedAt: new Date().toISOString(),
            originalLevelGap: levelGap,
          };
          localStorage.setItem('guest-habits', JSON.stringify(guestHabits));
        }
        
        return true;
      }

      // Authenticated user - update via Supabase
      const { error } = await supabase
        .from('habits')
        .update({
          mismatch_acknowledged: true,
          mismatch_acknowledged_at: new Date().toISOString(),
          original_level_gap: levelGap,
        })
        .eq('id', habitId)
        .eq('owner_id', session.user.id);

      if (error) {
        throw error;
      }

      return true;
    } catch (err) {
      debug.error('[useAcknowledgeMismatch] Error:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { acknowledgeMismatch, isLoading };
}

export default useLevelCompatibility;
