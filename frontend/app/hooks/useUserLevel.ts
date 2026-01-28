'use client';

/**
 * useUserLevel Hook
 * 
 * ユーザーの総合レベル情報を取得するカスタムフック
 * 
 * Features:
 * - ユーザーレベル、ティア、経験値の取得
 * - 習慣継続力とレジリエンススコアの取得
 * - ローディング状態とエラーハンドリング
 * 
 * @module useUserLevel
 * 
 * Validates: Requirements 9.1, 12.1
 */

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

export type UserLevelTier = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface UserLevelData {
  userId: string;
  overallLevel: number;
  overallTier: UserLevelTier;
  habitContinuityPower: number;
  resilienceScore: number;
  totalExperiencePoints: number;
  lastCalculatedAt: string | null;
}

interface UseUserLevelResult {
  userLevel: UserLevelData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * ユーザーレベル情報を取得するフック
 * @param userId - ユーザーID
 */
export function useUserLevel(userId: string | null): UseUserLevelResult {
  const [userLevel, setUserLevel] = useState<UserLevelData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserLevel = useCallback(async () => {
    if (!userId) {
      setUserLevel(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // api.get() returns parsed JSON directly and throws ApiError on error
      const data = await api.get(`/api/users/${userId}/level`);
      setUserLevel(data);
    } catch (err: any) {
      // Check if it's a 404 error (user level not set yet) or 401 (not authenticated)
      if (err?.status === 404 || err?.status === 401) {
        // ユーザーレベルが未設定または認証エラーの場合はデフォルト値を設定
        // 401は認証待ちの正常な状態なのでログを出さない
        setUserLevel({
          userId,
          overallLevel: 0,
          overallTier: 'beginner',
          habitContinuityPower: 0,
          resilienceScore: 50,
          totalExperiencePoints: 0,
          lastCalculatedAt: null,
        });
      } else {
        console.error('[useUserLevel] Error fetching user level:', err);
        setError(err?.message || 'ユーザーレベルの取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUserLevel();
  }, [fetchUserLevel]);

  return {
    userLevel,
    isLoading,
    error,
    refetch: fetchUserLevel,
  };
}

/**
 * ティアに応じた色を取得
 */
export function getUserLevelTierColors(tier: UserLevelTier): {
  bg: string;
  text: string;
  border: string;
  label: string;
  labelJa: string;
} {
  switch (tier) {
    case 'beginner':
      return {
        bg: 'bg-green-500/20',
        text: 'text-green-700 dark:text-green-400',
        border: 'border-green-500/30',
        label: 'Beginner',
        labelJa: '初級',
      };
    case 'intermediate':
      return {
        bg: 'bg-blue-500/20',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-500/30',
        label: 'Intermediate',
        labelJa: '中級',
      };
    case 'advanced':
      return {
        bg: 'bg-orange-500/20',
        text: 'text-orange-700 dark:text-orange-400',
        border: 'border-orange-500/30',
        label: 'Advanced',
        labelJa: '上級',
      };
    case 'expert':
      return {
        bg: 'bg-red-500/20',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-500/30',
        label: 'Expert',
        labelJa: '達人',
      };
  }
}

export default useUserLevel;
