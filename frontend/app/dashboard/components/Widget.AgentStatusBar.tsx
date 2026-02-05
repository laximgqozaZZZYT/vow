"use client";

/**
 * AgentStatusBar Widget
 *
 * TASK-2.1: Displays agent status summary and individual agent cards
 *
 * Features:
 * - Agent count summary (total, idle, busy)
 * - Clickable agent cards with role icons and status
 * - Selected agent highlighting
 * - Responsive layout
 * - Japanese/English locale support
 *
 * @module Widget.AgentStatusBar
 */

import { useMemo, memo, useCallback } from 'react';
import type { Agent } from '../types/agent.types';
import { ROLE_CONFIG, STATUS_CONFIG } from '../types/agent.types';

// ============================================================================
// Types
// ============================================================================

export interface AgentStatusBarProps {
  agents: Agent[];
  onSelectAgent: (agentId: string) => void;
  selectedAgentId?: string;
  locale?: 'ja' | 'en';
}

interface AgentStatusSummary {
  total: number;
  idle: number;
  busy: number;
  offline: number;
}

interface AgentCardMiniProps {
  agent: Agent;
  isSelected: boolean;
  locale: 'ja' | 'en';
  onClick: () => void;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Summary Stats Component
 */
function SummaryStats({
  summary,
  locale,
}: {
  summary: AgentStatusSummary;
  locale: 'ja' | 'en';
}) {
  const labels = {
    ja: {
      agents: 'Agents',
      total: 'total',
      idle: 'idle',
      busy: 'busy',
    },
    en: {
      agents: 'Agents',
      total: 'total',
      idle: 'idle',
      busy: 'busy',
    },
  };

  const t = labels[locale];

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
      <span className="font-medium text-foreground">{t.agents}:</span>
      <span>{summary.total} {t.total}</span>
      <span className="text-green-500">({summary.idle} {t.idle})</span>
      <span className="text-yellow-500">({summary.busy} {t.busy})</span>
    </div>
  );
}

/**
 * Mini Agent Card Component
 */
const AgentCardMini = memo(function AgentCardMini({
  agent,
  isSelected,
  locale,
  onClick,
}: AgentCardMiniProps) {
  const roleConfig = ROLE_CONFIG[agent.role];
  const statusConfig = STATUS_CONFIG[agent.status];
  const statusLabel = locale === 'ja' ? statusConfig.labelJa : statusConfig.label;

  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center
        p-2 min-w-[80px] min-h-[72px]
        bg-card border rounded-lg
        transition-all duration-150
        focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2
        ${isSelected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/30'
          : 'border-border hover:border-primary/50 hover:bg-muted/50'
        }
        ${agent.status === 'offline' ? 'opacity-60' : ''}
      `}
      title={agent.name}
    >
      {/* Role Icon */}
      <span className="text-xl mb-0.5" role="img" aria-label={roleConfig.label}>
        {roleConfig.icon}
      </span>

      {/* Role Label */}
      <span className={`text-xs font-medium truncate max-w-[72px] ${roleConfig.color}`}>
        {locale === 'ja' ? roleConfig.labelJa : roleConfig.label}
      </span>

      {/* Status */}
      <div className="flex items-center gap-1 mt-0.5">
        <div
          className={`w-1.5 h-1.5 rounded-full ${statusConfig.bgColor} ${agent.status === 'busy' ? 'animate-pulse' : ''}`}
        />
        <span className={`text-[10px] ${statusConfig.color}`}>
          {statusLabel}
        </span>
      </div>
    </button>
  );
});

// ============================================================================
// Main Component
// ============================================================================

/**
 * AgentStatusBar Component
 *
 * Displays a summary of agents and clickable mini-cards for each agent.
 */
function AgentStatusBarComponent({
  agents,
  onSelectAgent,
  selectedAgentId,
  locale = 'ja',
}: AgentStatusBarProps) {
  // Calculate summary stats
  const summary = useMemo<AgentStatusSummary>(() => {
    return agents.reduce(
      (acc, agent) => {
        acc.total++;
        if (agent.status === 'idle') acc.idle++;
        else if (agent.status === 'busy') acc.busy++;
        else if (agent.status === 'offline') acc.offline++;
        return acc;
      },
      { total: 0, idle: 0, busy: 0, offline: 0 }
    );
  }, [agents]);

  // Handle agent selection
  const handleAgentClick = useCallback(
    (agentId: string) => {
      onSelectAgent(agentId);
    },
    [onSelectAgent]
  );

  return (
    <div className="space-y-2">
      {/* Summary Stats */}
      <SummaryStats summary={summary} locale={locale} />

      {/* Agent Cards Grid */}
      <div className="flex flex-wrap gap-2">
        {agents.map((agent) => (
          <AgentCardMini
            key={agent.id}
            agent={agent}
            isSelected={agent.id === selectedAgentId}
            locale={locale}
            onClick={() => handleAgentClick(agent.id)}
          />
        ))}
      </div>

      {/* Empty State */}
      {agents.length === 0 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          {locale === 'ja'
            ? 'No agents available'
            : 'No agents available'}
        </div>
      )}
    </div>
  );
}

export const AgentStatusBar = memo(AgentStatusBarComponent);
export default AgentStatusBar;
