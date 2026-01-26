'use client';

/**
 * Coaching Widget
 *
 * Displays workload coaching proposals with accept/dismiss/snooze actions.
 *
 * Requirements: 10.4
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface CoachingProposal {
  id: string;
  habitId: string;
  habitName: string;
  type: 'workload_adjustment' | 'baby_step' | 'partial_recovery' | 'full_recovery';
  currentTargetCount: number;
  proposedTargetCount: number;
  workloadUnit: string | null;
  reason: string;
  message: string;
  expiresAt: string;
}

interface CoachingWidgetProps {
  onProposalApplied?: () => void;
}

export function CoachingWidget({ onProposalApplied }: CoachingWidgetProps) {
  const [proposals, setProposals] = useState<CoachingProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_SLACK_API_URL;

  const fetchProposals = useCallback(async () => {
    if (!apiUrl) return;

    try {
      setLoading(true);
      
      // Get session from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${apiUrl}/api/coaching/proposals`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch proposals');
      }

      const data = await response.json();
      setProposals(data.proposals || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch coaching proposals:', err);
      setError('コーチング提案の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const handleAction = async (proposalId: string, action: 'apply' | 'dismiss' | 'snooze') => {
    if (!apiUrl) return;

    try {
      setActionLoading(proposalId);
      
      // Get session from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('認証が必要です');
        return;
      }

      const response = await fetch(`${apiUrl}/api/coaching/${action}/${proposalId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} proposal`);
      }

      // Remove the proposal from the list
      setProposals(prev => prev.filter(p => p.id !== proposalId));

      if (action === 'apply' && onProposalApplied) {
        onProposalApplied();
      }
    } catch (err) {
      console.error(`Failed to ${action} proposal:`, err);
      setError('操作に失敗しました');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-card border border-border rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-muted rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-card border border-border rounded-lg">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (proposals.length === 0) {
    return null; // Don't show widget if no proposals
  }

  return (
    <div className="space-y-3">
      {proposals.map(proposal => (
        <div
          key={proposal.id}
          className="p-4 bg-card border border-border rounded-lg shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {proposal.type === 'workload_adjustment' && (
                <span className="text-xl">📉</span>
              )}
              {proposal.type === 'baby_step' && (
                <span className="text-xl">👶</span>
              )}
              {(proposal.type === 'partial_recovery' || proposal.type === 'full_recovery') && (
                <span className="text-xl">📈</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-foreground mb-1">
                {getProposalTitle(proposal.type)}
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                {proposal.message}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleAction(proposal.id, 'apply')}
                  disabled={actionLoading === proposal.id}
                  className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {actionLoading === proposal.id ? '処理中...' : '適用する'}
                </button>
                <button
                  onClick={() => handleAction(proposal.id, 'snooze')}
                  disabled={actionLoading === proposal.id}
                  className="px-3 py-1.5 text-xs font-medium bg-muted text-muted-foreground rounded-md hover:bg-muted/80 disabled:opacity-50 transition-colors"
                >
                  後で
                </button>
                <button
                  onClick={() => handleAction(proposal.id, 'dismiss')}
                  disabled={actionLoading === proposal.id}
                  className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                >
                  不要
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function getProposalTitle(type: CoachingProposal['type']): string {
  switch (type) {
    case 'workload_adjustment':
      return 'Workload調整の提案';
    case 'baby_step':
      return 'ベビーステップの提案';
    case 'partial_recovery':
      return '目標回復の提案';
    case 'full_recovery':
      return '完全回復の提案';
    default:
      return 'コーチング提案';
  }
}

export default CoachingWidget;
