/**
 * Modal.LevelSuggestions
 *
 * Modal for displaying and managing pending level suggestions.
 * Users can accept or dismiss suggestions from this modal.
 *
 * Requirements: 17.5
 * - Display pending level suggestions
 * - Allow accepting or dismissing suggestions
 * - Show suggestion details (current level, target level, reason)
 */

'use client';

import React, { useState } from 'react';

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

interface ModalLevelSuggestionsProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** List of pending suggestions */
  suggestions: LevelSuggestion[];
  /** API base URL */
  apiBaseUrl?: string;
  /** Access token for API calls */
  accessToken?: string;
  /** Callback when a suggestion is accepted */
  onAccept?: (suggestion: LevelSuggestion) => void;
  /** Callback when a suggestion is dismissed */
  onDismiss?: (suggestion: LevelSuggestion) => void;
  /** Callback to refresh suggestions */
  onRefresh?: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getLevelTierColor(level: number): string {
  if (level < 50) return 'bg-success text-success-foreground';
  if (level < 100) return 'bg-primary text-primary-foreground';
  if (level < 150) return 'bg-warning text-warning-foreground';
  return 'bg-destructive text-destructive-foreground';
}

function getLevelTierName(level: number): string {
  if (level < 50) return 'beginner';
  if (level < 100) return 'intermediate';
  if (level < 150) return 'advanced';
  return 'expert';
}


// =============================================================================
// Component
// =============================================================================

export function ModalLevelSuggestions({
  isOpen,
  onClose,
  suggestions,
  apiBaseUrl,
  accessToken,
  onAccept,
  onDismiss,
  onRefresh,
}: ModalLevelSuggestionsProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAccept = async (suggestion: LevelSuggestion) => {
    if (!apiBaseUrl || !accessToken) return;

    setProcessingId(suggestion.id);
    setError(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/suggestions/${suggestion.id}/accept`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to accept suggestion');
      }

      if (onAccept) onAccept(suggestion);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDismiss = async (suggestion: LevelSuggestion) => {
    if (!apiBaseUrl || !accessToken) return;

    setProcessingId(suggestion.id);
    setError(null);

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/suggestions/${suggestion.id}/dismiss`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to dismiss suggestion');
      }

      if (onDismiss) onDismiss(suggestion);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="suggestions-modal-title"
    >
      <div
        className="w-full max-w-lg mx-4 p-6 bg-card rounded-xl shadow-lg max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 id="suggestions-modal-title" className="text-h3 font-semibold text-foreground">
            レベル調整の提案
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Suggestions list */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {suggestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              現在、レベル調整の提案はありません。
            </div>
          ) : (
            suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                isProcessing={processingId === suggestion.id}
                onAccept={() => handleAccept(suggestion)}
                onDismiss={() => handleDismiss(suggestion)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}


// =============================================================================
// Suggestion Card Component
// =============================================================================

interface SuggestionCardProps {
  suggestion: LevelSuggestion;
  isProcessing: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

function SuggestionCard({ suggestion, isProcessing, onAccept, onDismiss }: SuggestionCardProps) {
  const isLevelUp = suggestion.suggestionType === 'level_up';
  const levelDelta = suggestion.targetLevel - suggestion.currentLevel;

  return (
    <div className="p-4 bg-muted/50 border border-border rounded-lg">
      {/* Header with habit name and type badge */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium text-foreground">{suggestion.habitName}</h3>
          <span
            className={`
              inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium
              ${isLevelUp ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}
            `}
          >
            {isLevelUp ? (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                レベルアップ
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                ベビーステップ
              </>
            )}
          </span>
        </div>
      </div>

      {/* Level change visualization */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-sm font-medium ${getLevelTierColor(suggestion.currentLevel)}`}>
            Lv.{suggestion.currentLevel}
          </span>
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <span className={`px-2 py-1 rounded text-sm font-medium ${getLevelTierColor(suggestion.targetLevel)}`}>
            Lv.{suggestion.targetLevel}
          </span>
        </div>
        <span className={`text-sm font-medium ${levelDelta > 0 ? 'text-success' : 'text-warning'}`}>
          ({levelDelta > 0 ? '+' : ''}{levelDelta})
        </span>
      </div>

      {/* Reason */}
      <p className="text-sm text-muted-foreground mb-4">{suggestion.reason}</p>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onAccept}
          disabled={isProcessing}
          className={`
            flex-1 px-4 py-2
            bg-primary text-primary-foreground
            rounded-md shadow-sm
            hover:opacity-90
            focus-visible:outline-2 focus-visible:outline-primary
            transition-opacity
            disabled:opacity-50 disabled:cursor-not-allowed
            min-h-[44px]
          `}
        >
          {isProcessing ? '処理中...' : '適用する'}
        </button>
        <button
          onClick={onDismiss}
          disabled={isProcessing}
          className={`
            px-4 py-2
            bg-muted text-muted-foreground
            border border-border
            rounded-md
            hover:bg-muted/80
            focus-visible:outline-2 focus-visible:outline-border
            transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            min-h-[44px]
          `}
        >
          却下
        </button>
      </div>
    </div>
  );
}

export default ModalLevelSuggestions;
