/**
 * Widget.LevelSuggestionBadge
 *
 * Displays a notification badge for pending level suggestions.
 * Shows count of pending suggestions and links to suggestions page.
 *
 * Requirements: 17.5
 * - Check for pending level_suggestions on login
 * - Display count in dashboard
 * - Link to suggestions page
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';

// =============================================================================
// Types
// =============================================================================

interface LevelSuggestion {
  id: string;
  habitId: string;
  habitName: string;
  suggestionType: 'level_up' | 'level_down';
  currentLevel: number;
  targetLevel: number;
  proposedChanges: Record<string, unknown>;
  reason: string;
  detectedAt: string;
  status: string;
}

interface LevelSuggestionBadgeProps {
  /** Callback when badge is clicked */
  onClick?: () => void;
  /** Callback when suggestions are loaded */
  onSuggestionsLoaded?: (suggestions: LevelSuggestion[]) => void;
  /** API base URL */
  apiBaseUrl?: string;
  /** Access token for API calls */
  accessToken?: string;
  /** Whether to show as compact badge only */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function LevelSuggestionBadge({
  onClick,
  onSuggestionsLoaded,
  apiBaseUrl,
  accessToken,
  compact = false,
  className = '',
}: LevelSuggestionBadgeProps) {
  const [count, setCount] = useState<number>(0);
  const [suggestions, setSuggestions] = useState<LevelSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  // Fetch pending suggestions count
  const fetchSuggestions = useCallback(async () => {
    if (!apiBaseUrl || !accessToken) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${apiBaseUrl}/api/suggestions/pending`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const data = await response.json();
      setCount(data.count || 0);
      setSuggestions(data.suggestions || []);
      
      if (onSuggestionsLoaded) {
        onSuggestionsLoaded(data.suggestions || []);
      }
    } catch (err) {
      console.error('Error fetching level suggestions:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, accessToken, onSuggestionsLoaded]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Don't render if no suggestions or loading
  if (loading || count === 0) {
    return null;
  }

  // Compact badge only (for header/sidebar)
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`
          relative inline-flex items-center justify-center
          min-w-[20px] h-5 px-1.5
          bg-warning text-warning-foreground
          text-xs font-medium
          rounded-full
          hover:opacity-90
          transition-opacity
          ${className}
        `}
        title={`レベル調整の提案があります (${count}件)`}
        aria-label={`${count}件のレベル調整提案`}
      >
        {count}
      </button>
    );
  }

  // Full notification banner
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2
        px-4 py-2
        bg-warning/10 border border-warning/30
        text-warning-foreground
        rounded-lg
        hover:bg-warning/20
        transition-colors
        ${className}
      `}
      aria-label={`${count}件のレベル調整提案を表示`}
    >
      {/* Bell icon */}
      <svg
        className="w-5 h-5 text-warning"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      {/* Message */}
      <span className="text-sm font-medium">
        レベル調整の提案があります ({count}件)
      </span>

      {/* Arrow icon */}
      <svg
        className="w-4 h-4 ml-auto"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </button>
  );
}

export default LevelSuggestionBadge;
