'use client';

/**
 * AI Suggestion History Widget
 * 
 * Displays past AI suggestions (habits and goals) that users can reference.
 * Premium Pro feature.
 * 
 * @validates Requirements: AI suggestion history viewing
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface SuggestionHistoryItem {
  id: string;
  suggestionType: 'habit' | 'goal';
  suggestionData: {
    name?: string;
    type?: 'do' | 'avoid';
    frequency?: string;
    reason?: string;
    description?: string;
    [key: string]: unknown;
  };
  status: 'pending' | 'accepted' | 'dismissed';
  createdAt: string;
  goalId?: string;
}

interface SuggestionHistoryProps {
  onSelectSuggestion?: (suggestion: SuggestionHistoryItem) => void;
  onClose?: () => void;
}

export function SuggestionHistory({ onSelectSuggestion, onClose }: SuggestionHistoryProps) {
  const [suggestions, setSuggestions] = useState<SuggestionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'habit' | 'goal'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'dismissed'>('all');

  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_SLACK_API_URL;

  const fetchHistory = useCallback(async () => {
    if (!apiUrl) return;

    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('認証が必要です');
        return;
      }

      const params = new URLSearchParams();
      if (filter !== 'all') params.append('type', filter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('limit', '50');

      const response = await fetch(`${apiUrl}/api/ai/suggestion-history?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        throw new Error('履歴の取得に失敗しました');
      }

      const data = await response.json();
      setSuggestions(data.suggestions.map((s: any) => ({
        id: s.id,
        suggestionType: s.suggestion_type,
        suggestionData: s.suggestion_data,
        status: s.status,
        createdAt: s.created_at,
        goalId: s.goal_id,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, filter, statusFilter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const updateStatus = async (id: string, status: 'accepted' | 'dismissed') => {
    if (!apiUrl) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await fetch(`${apiUrl}/api/ai/suggestion-history/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      setSuggestions(prev => prev.map(s => 
        s.id === id ? { ...s, status } : s
      ));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <span className="px-2 py-0.5 text-xs bg-success/20 text-success rounded">採用済み</span>;
      case 'dismissed':
        return <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded">却下</span>;
      default:
        return <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded">保留中</span>;
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <span>📋</span>
          <span>AI提案履歴</span>
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 px-4 py-2 border-b border-border bg-muted/30">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="text-xs px-2 py-1 rounded border border-input bg-background"
        >
          <option value="all">すべて</option>
          <option value="habit">Habit</option>
          <option value="goal">Goal</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="text-xs px-2 py-1 rounded border border-input bg-background"
        >
          <option value="all">全ステータス</option>
          <option value="pending">保留中</option>
          <option value="accepted">採用済み</option>
          <option value="dismissed">却下</option>
        </select>
      </div>

      {/* Content */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
            読み込み中...
          </div>
        ) : error ? (
          <div className="p-4 text-center text-destructive">{error}</div>
        ) : suggestions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <div className="text-3xl mb-2">📭</div>
            <p>提案履歴がありません</p>
            <p className="text-xs mt-1">AI Coachで提案を受けると、ここに履歴が表示されます</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">
                        {suggestion.suggestionType === 'habit' ? '🔄' : '🎯'}
                      </span>
                      <span className="font-medium text-sm truncate">
                        {suggestion.suggestionData.name || '名称なし'}
                      </span>
                      {getStatusBadge(suggestion.status)}
                    </div>
                    {suggestion.suggestionData.reason && (
                      <p className="text-xs text-muted-foreground line-clamp-2 ml-6">
                        💡 {suggestion.suggestionData.reason}
                      </p>
                    )}
                    <div className="text-xs text-muted-foreground mt-1 ml-6">
                      {formatDate(suggestion.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {suggestion.status === 'pending' && (
                      <>
                        <button
                          onClick={() => onSelectSuggestion?.(suggestion)}
                          className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90"
                        >
                          採用
                        </button>
                        <button
                          onClick={() => updateStatus(suggestion.id, 'dismissed')}
                          className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted rounded"
                        >
                          却下
                        </button>
                      </>
                    )}
                    {suggestion.status !== 'pending' && onSelectSuggestion && (
                      <button
                        onClick={() => onSelectSuggestion(suggestion)}
                        className="px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded"
                      >
                        再利用
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SuggestionHistory;
