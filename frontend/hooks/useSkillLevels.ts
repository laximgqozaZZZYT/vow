"use client";

/**
 * useSkillLevels Hook
 * 
 * Custom hook for fetching and managing tag-based skill levels.
 * 
 * @module useSkillLevels
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Backend API endpoint
const API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_SLACK_API_URL || '';

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
 * State for the skill levels hook
 */
export interface SkillLevelsState {
  skillLevels: SkillLevel[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Return type for the useSkillLevels hook
 */
export interface UseSkillLevelsReturn {
  skillLevels: SkillLevel[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching tag-based skill levels
 * 
 * @param userId - The user ID to fetch skill levels for
 * @returns Skill levels data and loading state
 */
export function useSkillLevels(userId: string | null): UseSkillLevelsReturn {
  const [state, setState] = useState<SkillLevelsState>({
    skillLevels: [],
    isLoading: false,
    error: null,
  });

  const fetchSkillLevels = useCallback(async () => {
    if (!userId) {
      setState({ skillLevels: [], isLoading: false, error: null });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('認証が必要です');
      }

      const response = await fetch(`${API_URL}/api/users/${userId}/skill-levels`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'スキルレベルの取得に失敗しました');
      }

      const data = await response.json();

      setState({
        skillLevels: data.skillLevels || [],
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'エラーが発生しました';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [userId]);

  useEffect(() => {
    fetchSkillLevels();
  }, [fetchSkillLevels]);

  return {
    skillLevels: state.skillLevels,
    isLoading: state.isLoading,
    error: state.error,
    refetch: fetchSkillLevels,
  };
}

export default useSkillLevels;
