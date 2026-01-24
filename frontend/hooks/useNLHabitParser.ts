/**
 * NL Habit Parser Hook
 * 
 * Provides natural language parsing for habit creation.
 * 
 * Requirements: 3.1, 3.5
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Backend API endpoint
const API_URL = process.env.NEXT_PUBLIC_SLACK_API_URL || '';

// Parsed habit data structure
export interface ParsedHabitData {
  name: string;
  type: 'do' | 'avoid';
  frequency?: 'daily' | 'weekly' | 'monthly';
  triggerTime?: string;
  duration?: number;
  goalId?: string;
  confidence: number;
}

// Parse context for better results
export interface ParseContext {
  existingHabits?: string[];
  existingGoals?: string[];
}

// API response structure
interface ParseHabitResponse {
  parsed: ParsedHabitData;
  tokensUsed: number;
  remainingTokens: number;
}

interface UseNLHabitParserReturn {
  parsedData: ParsedHabitData | null;
  loading: boolean;
  error: string | null;
  tokensUsed: number;
  remainingTokens: number;
  parseHabit: (text: string, context?: ParseContext) => Promise<ParsedHabitData | null>;
  clearResult: () => void;
}

export function useNLHabitParser(): UseNLHabitParserReturn {
  const [parsedData, setParsedData] = useState<ParsedHabitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [remainingTokens, setRemainingTokens] = useState(0);

  /**
   * Get authentication headers with Supabase JWT token
   */
  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  /**
   * Parse natural language text into habit data
   */
  const parseHabit = useCallback(async (
    text: string,
    context?: ParseContext
  ): Promise<ParsedHabitData | null> => {
    try {
      setLoading(true);
      setError(null);
      setParsedData(null);

      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/ai/parse-habit`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          text,
          context,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        
        // Handle specific error codes
        if (response.status === 402) {
          throw new Error('この機能はPremiumプランでのみ利用可能です');
        }
        if (response.status === 429) {
          throw new Error('今月のトークン上限に達しました');
        }
        
        throw new Error(data.error || 'Failed to parse habit');
      }

      const data: ParseHabitResponse = await response.json();
      
      setParsedData(data.parsed);
      setTokensUsed(data.tokensUsed);
      setRemainingTokens(data.remainingTokens);
      
      return data.parsed;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  /**
   * Clear the current result
   */
  const clearResult = useCallback(() => {
    setParsedData(null);
    setError(null);
    setTokensUsed(0);
  }, []);

  return {
    parsedData,
    loading,
    error,
    tokensUsed,
    remainingTokens,
    parseHabit,
    clearResult,
  };
}

export default useNLHabitParser;
