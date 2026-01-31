"use client";

/**
 * AgentCard Widget
 *
 * Displays individual agent information in various layouts:
 * - default: Card view with full details
 * - compact: Smaller card for Kanban columns
 * - list: Horizontal row for list view
 *
 * Supports tooltip display on hover (desktop) or tap (mobile).
 *
 * @module Widget.AgentCard
 */

import { useRef, useCallback } from 'react';
import type { Agent } from '../types/agent.types';
import { ROLE_CONFIG, STATUS_CONFIG } from '../types/agent.types';

export interface AgentCardProps {
  agent: Agent;
  variant?: 'default' | 'compact' | 'list';
  onClick?: () => void;
  /** Callback for mouse enter - for tooltip display */
  onMouseEnter?: (agent: Agent, element: HTMLElement) => void;
  /** Callback for mouse leave - for tooltip hide */
  onMouseLeave?: () => void;
  /** Callback for tap - for mobile tooltip toggle */
  onTap?: (agent: Agent, element: HTMLElement) => void;
  /** Callback when View Details is clicked */
  onViewDetails?: (agent: Agent) => void;
  /** Callback when Send Message is clicked */
  onSendMessage?: (agent: Agent) => void;
}

/**
 * Status Indicator Component
 */
function StatusIndicator({ status }: { status: Agent['status'] }) {
  const config = STATUS_CONFIG[status];
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${config.bgColor} ${status === 'busy' ? 'animate-pulse' : ''}`} />
      <span className={`text-xs ${config.color}`}>{config.labelJa}</span>
    </div>
  );
}

/**
 * Role Badge Component
 */
function RoleBadge({ role }: { role: Agent['role'] }) {
  const config = ROLE_CONFIG[role];
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${config.color}`}>
      <span>{config.icon}</span>
      <span>{config.labelJa}</span>
    </span>
  );
}

/**
 * Capability Tags Component
 */
function CapabilityTags({ capabilities, limit = 3 }: { capabilities: string[]; limit?: number }) {
  const displayTags = capabilities.slice(0, limit);
  const remaining = capabilities.length - limit;

  return (
    <div className="flex flex-wrap gap-1">
      {displayTags.map((cap) => (
        <span
          key={cap}
          className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground"
        >
          {cap}
        </span>
      ))}
      {remaining > 0 && (
        <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">
          +{remaining}
        </span>
      )}
    </div>
  );
}

/**
 * Time Ago Component
 */
function TimeAgo({ dateStr }: { dateStr: string }) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  let text: string;
  if (diffMins < 1) text = 'just now';
  else if (diffMins < 60) text = `${diffMins}m ago`;
  else {
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) text = `${diffHours}h ago`;
    else text = date.toLocaleDateString();
  }

  return <span className="text-[10px] text-muted-foreground">{text}</span>;
}

/**
 * Default Card Variant
 */
function DefaultCard({
  agent,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onTap,
  onViewDetails,
  onSendMessage,
}: Omit<AgentCardProps, 'variant'>) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (onMouseEnter && cardRef.current) {
      onMouseEnter(agent, cardRef.current);
    }
  }, [agent, onMouseEnter]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    // Only trigger tap if it wasn't a scroll
    if (onTap && cardRef.current) {
      e.preventDefault();
      onTap(agent, cardRef.current);
    }
  }, [agent, onTap]);

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onMouseLeave}
      onTouchEnd={handleTouchEnd}
      className={`
        relative
        bg-card border border-border rounded-lg p-3
        hover:border-primary/50 hover:shadow-md
        transition-all duration-150
        ${onClick ? 'cursor-pointer' : ''}
        ${agent.status === 'offline' ? 'opacity-60' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{ROLE_CONFIG[agent.role].icon}</span>
            <h3 className="font-medium text-sm truncate">{agent.name}</h3>
          </div>
          <RoleBadge role={agent.role} />
        </div>
        <StatusIndicator status={agent.status} />
      </div>

      {/* Machine Info */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <span className="truncate">{agent.machineName}</span>
      </div>

      {/* Current Task */}
      {agent.currentTaskId && (
        <div className="flex items-center gap-1 text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-1 rounded mb-2">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span className="truncate">Working on task...</span>
        </div>
      )}

      {/* Capabilities */}
      <CapabilityTags capabilities={agent.capabilities} />

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
        <TimeAgo dateStr={agent.lastHeartbeat} />
        <div className="flex items-center gap-1">
          <button
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="View Details"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails?.(agent);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
          <button
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Send Message"
            onClick={(e) => {
              e.stopPropagation();
              onSendMessage?.(agent);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact Card Variant (for Kanban)
 */
function CompactCard({
  agent,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onTap,
}: Omit<AgentCardProps, 'variant' | 'onViewDetails' | 'onSendMessage'>) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (onMouseEnter && cardRef.current) {
      onMouseEnter(agent, cardRef.current);
    }
  }, [agent, onMouseEnter]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (onTap && cardRef.current) {
      e.preventDefault();
      onTap(agent, cardRef.current);
    }
  }, [agent, onTap]);

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onMouseLeave}
      onTouchEnd={handleTouchEnd}
      className={`
        bg-card border border-border rounded-md p-2
        hover:border-primary/50
        transition-all duration-150
        ${onClick ? 'cursor-pointer' : ''}
        ${agent.status === 'offline' ? 'opacity-60' : ''}
      `}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm">{ROLE_CONFIG[agent.role].icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-xs truncate">{agent.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">{agent.machineName}</div>
        </div>
        <div className={`w-2 h-2 rounded-full ${STATUS_CONFIG[agent.status].bgColor}`} />
      </div>
      {agent.currentTaskId && (
        <div className="mt-1.5 text-[10px] text-yellow-600 dark:text-yellow-400 truncate">
          Working...
        </div>
      )}
    </div>
  );
}

/**
 * List Row Variant
 */
function ListCard({
  agent,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onTap,
  onViewDetails,
}: Omit<AgentCardProps, 'variant' | 'onSendMessage'>) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (onMouseEnter && cardRef.current) {
      onMouseEnter(agent, cardRef.current);
    }
  }, [agent, onMouseEnter]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (onTap && cardRef.current) {
      e.preventDefault();
      onTap(agent, cardRef.current);
    }
  }, [agent, onTap]);

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={onMouseLeave}
      onTouchEnd={handleTouchEnd}
      className={`
        flex items-center gap-3 p-3
        bg-card border border-border rounded-lg
        hover:border-primary/50 hover:bg-muted/50
        transition-all duration-150
        ${onClick ? 'cursor-pointer' : ''}
        ${agent.status === 'offline' ? 'opacity-60' : ''}
      `}
    >
      {/* Icon & Name */}
      <div className="flex items-center gap-2 min-w-[140px]">
        <span className="text-lg">{ROLE_CONFIG[agent.role].icon}</span>
        <div>
          <div className="font-medium text-sm">{agent.name}</div>
          <RoleBadge role={agent.role} />
        </div>
      </div>

      {/* Status */}
      <div className="min-w-[80px]">
        <StatusIndicator status={agent.status} />
      </div>

      {/* Machine */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-[100px]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <span className="truncate">{agent.machineName}</span>
      </div>

      {/* Capabilities */}
      <div className="flex-1 hidden sm:block">
        <CapabilityTags capabilities={agent.capabilities} limit={4} />
      </div>

      {/* Current Task */}
      <div className="min-w-[100px] text-right">
        {agent.currentTaskId ? (
          <span className="text-xs text-yellow-600 dark:text-yellow-400">Working...</span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </div>

      {/* Last Seen */}
      <div className="min-w-[60px] text-right">
        <TimeAgo dateStr={agent.lastHeartbeat} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="View Details"
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails?.(agent);
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * AgentCard Component
 */
export default function AgentCard({
  agent,
  variant = 'default',
  onClick,
  onMouseEnter,
  onMouseLeave,
  onTap,
  onViewDetails,
  onSendMessage,
}: AgentCardProps) {
  switch (variant) {
    case 'compact':
      return (
        <CompactCard
          agent={agent}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onTap={onTap}
        />
      );
    case 'list':
      return (
        <ListCard
          agent={agent}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onTap={onTap}
          onViewDetails={onViewDetails}
        />
      );
    default:
      return (
        <DefaultCard
          agent={agent}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onTap={onTap}
          onViewDetails={onViewDetails}
          onSendMessage={onSendMessage}
        />
      );
  }
}
