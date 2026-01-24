/**
 * Token Usage Hook
 * 
 * Provides token usage information for the current user.
 * This is a convenience wrapper around useSubscription for components
 * that only need token usage data.
 * 
 * Requirements: 5.5, 5.11
 */

import { useSubscription, type TokenUsageInfo } from './useSubscription';

interface UseTokenUsageReturn {
  tokenUsage: TokenUsageInfo | null;
  loading: boolean;
  error: string | null;
  isPremium: boolean;
  refresh: () => Promise<void>;
}

export function useTokenUsage(): UseTokenUsageReturn {
  const {
    tokenUsage,
    loading,
    error,
    isPremium,
    refreshStatus,
  } = useSubscription();

  return {
    tokenUsage,
    loading,
    error,
    isPremium,
    refresh: refreshStatus,
  };
}

export default useTokenUsage;
export type { TokenUsageInfo };
