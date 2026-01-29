"use client";

/**
 * useXPRecovery Hook
 * 
 * Custom hook for managing XP recovery/recalculation functionality.
 * Handles API calls to recalculate user experience points from past activities.
 * 
 * @module useXPRecovery
 * 
 * Validates: Requirements 5.3, 5.4
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Backend API endpoint
const API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_SLACK_API_URL || '';

// =============================================================================
// Types
// =============================================================================

/**
 * Skill level information for a tag
 */
export interface SkillLevel {
  tagId: string;
  tagName: string;
  tagColor: string;
  totalXP: number;
  activityCount: number;
  level: number;
}

/**
 * Response from the XP recalculation API
 * Based on design.md UserRecalculateResponse interface
 */
export interface XPRecoveryResult {
  success: boolean;
  totalXPAwarded: number;
  activitiesProcessed: number;
  skipped: number;
  newLevel?: number;
  levelChange?: {
    oldLevel: number;
    newLevel: number;
  };
  skillLevels?: SkillLevel[];
  errors: Array<{
    activityId: string;
    message: string;
  }>;
}

/**
 * State for the XP recovery hook
 */
export interface XPRecoveryState {
  /** Whether a recalculation is in progress */
  isLoading: boolean;
  /** Error message if the recalculation failed */
  error: string | null;
  /** Result of the last successful recalculation */
  result: XPRecoveryResult | null;
}

/**
 * Return type for the useXPRecovery hook
 */
export interface UseXPRecoveryReturn {
  /** Current state of the XP recovery operation */
  state: XPRecoveryState;
  /** Whether a recalculation is in progress */
  isLoading: boolean;
  /** Error message if the recalculation failed */
  error: string | null;
  /** Result of the last successful recalculation */
  result: XPRecoveryResult | null;
  /** Trigger XP recalculation for the specified user */
  recalculateXP: (userId: string) => Promise<XPRecoveryResult | null>;
  /** Reset the state to initial values */
  reset: () => void;
}

// =============================================================================
// Initial State
// =============================================================================

const initialState: XPRecoveryState = {
  isLoading: false,
  error: null,
  result: null,
};

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for managing XP recovery/recalculation
 * 
 * @example
 * ```tsx
 * const { recalculateXP, isLoading, error, result } = useXPRecovery();
 * 
 * const handleRecalculate = async () => {
 *   const result = await recalculateXP(userId);
 *   if (result?.success) {
 *     console.log(`Awarded ${result.totalXPAwarded} XP`);
 *   }
 * };
 * ```
 */
export function useXPRecovery(): UseXPRecoveryReturn {
  const [state, setState] = useState<XPRecoveryState>(initialState);

  /**
   * Get authentication headers with Supabase JWT token
   */
  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }
    
    // Try to get session, refresh if needed
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Failed to get session:', error);
      throw new Error('セッションの取得に失敗しました。再度ログインしてください。');
    }
    
    if (!session?.access_token) {
      // Try to refresh the session
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session?.access_token) {
        console.error('Failed to refresh session:', refreshError);
        throw new Error('認証が必要です。再度ログインしてください。');
      }
      
      return {
        'Authorization': `Bearer ${refreshData.session.access_token}`,
        'Content-Type': 'application/json',
      };
    }
    
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  /**
   * Trigger XP recalculation for the specified user
   * 
   * @param userId - The ID of the user to recalculate XP for
   * @returns The recalculation result, or null if an error occurred
   * 
   * Validates: Requirements 5.3 (API call), 5.4 (loading state)
   */
  const recalculateXP = useCallback(async (userId: string): Promise<XPRecoveryResult | null> => {
    // Set loading state (Requirement 5.4)
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

    try {
      const headers = await getAuthHeaders();
      
      // Call POST /api/users/:id/recalculate-xp (Requirement 5.3)
      const response = await fetch(`${API_URL}/api/users/${userId}/recalculate-xp`, {
        method: 'POST',
        headers,
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Handle error responses
        const errorData = await response.json().catch(() => ({}));
        
        // Map HTTP status codes to Japanese error messages (Requirement 5.6)
        let errorMessage: string;
        switch (response.status) {
          case 401:
            errorMessage = '認証が必要です';
            break;
          case 403:
            errorMessage = 'この操作を実行する権限がありません';
            break;
          case 404:
            errorMessage = 'ユーザーが見つかりません';
            break;
          case 500:
            errorMessage = errorData.message || '経験値の再計算に失敗しました';
            break;
          default:
            errorMessage = errorData.message || '予期しないエラーが発生しました';
        }

        setState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
          result: null,
        }));

        return null;
      }

      const result: XPRecoveryResult = await response.json();

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: null,
        result,
      }));

      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle network errors, timeouts, or other exceptions
      let errorMessage: string;
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          // Timeout - but processing may have completed on server
          errorMessage = '処理がタイムアウトしました。ページを再読み込みして結果を確認してください。';
        } else if (error.message === 'Failed to fetch') {
          // Network error or CORS issue - processing may have completed
          errorMessage = '通信エラーが発生しました。処理は完了している可能性があります。ページを再読み込みして確認してください。';
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = '経験値の再計算中にエラーが発生しました';
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        result: null,
      }));

      return null;
    }
  }, [getAuthHeaders]);

  /**
   * Reset the state to initial values
   */
  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    state,
    isLoading: state.isLoading,
    error: state.error,
    result: state.result,
    recalculateXP,
    reset,
  };
}

export default useXPRecovery;
