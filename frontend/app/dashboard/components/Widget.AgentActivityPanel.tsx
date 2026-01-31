"use client";

/**
 * Agent Activity Panel Component
 *
 * A collapsible panel that displays real-time agent interactions in chronological order.
 * Features:
 * - Collapsible/expandable panel
 * - Filter by agent and interaction type
 * - Auto-scroll to latest activity
 * - Resizable height via drag
 * - Mobile-responsive (slide up from bottom)
 *
 * @module Widget.AgentActivityPanel
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { AgentInteraction, InteractionType } from '../types/agent.types';
import { INTERACTION_TYPE_CONFIG } from '../types/agent.types';

interface AgentActivityPanelProps {
  /** List of agent interactions to display */
  interactions: AgentInteraction[];
  /** Whether the panel is expanded */
  isExpanded: boolean;
  /** Callback when panel expansion state changes */
  onToggleExpanded: () => void;
  /** Panel height in pixels (when expanded) */
  panelHeight: number;
  /** Callback when panel height changes via drag */
  onHeightChange: (height: number) => void;
  /** Minimum panel height */
  minHeight?: number;
  /** Maximum panel height */
  maxHeight?: number;
}

/**
 * Format timestamp to display time
 */
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Get unique agents from interactions
 */
function getUniqueAgents(interactions: AgentInteraction[]): { id: string; name: string }[] {
  const agentMap = new Map<string, string>();

  interactions.forEach((interaction) => {
    if (!agentMap.has(interaction.fromAgent)) {
      agentMap.set(interaction.fromAgent, interaction.fromAgentName);
    }
    if (interaction.toAgent && !agentMap.has(interaction.toAgent)) {
      agentMap.set(interaction.toAgent, interaction.toAgentName!);
    }
  });

  return Array.from(agentMap.entries()).map(([id, name]) => ({ id, name }));
}

/**
 * Interaction Item Component
 */
function InteractionItem({ interaction }: { interaction: AgentInteraction }) {
  const config = INTERACTION_TYPE_CONFIG[interaction.type];

  const getDirectionDisplay = () => {
    if (interaction.toAgent) {
      return (
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">{interaction.fromAgentName}</span>
          <span className="mx-1">{config.icon}</span>
          <span className="font-medium text-foreground">{interaction.toAgentName}</span>
        </span>
      );
    }
    return (
      <span className="font-medium text-foreground">{interaction.fromAgentName}</span>
    );
  };

  return (
    <div
      className={`
        flex items-start gap-2 p-2 rounded-md
        hover:bg-muted/50 transition-colors
        border-l-2
        ${interaction.type === 'instruction' ? 'border-l-purple-500' : ''}
        ${interaction.type === 'report' ? 'border-l-blue-500' : ''}
        ${interaction.type === 'question' ? 'border-l-yellow-500' : ''}
        ${interaction.type === 'response' ? 'border-l-green-500' : ''}
      `}
    >
      {/* Time */}
      <span className="text-xs text-muted-foreground shrink-0 w-12 pt-0.5">
        {formatTime(interaction.timestamp)}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs mb-0.5">
          {getDirectionDisplay()}
          <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${config.bgColor} ${config.color}`}>
            {config.labelJa}
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {interaction.content}
        </p>
      </div>
    </div>
  );
}

/**
 * Agent Activity Panel Component
 */
export default function AgentActivityPanel({
  interactions,
  isExpanded,
  onToggleExpanded,
  panelHeight,
  onHeightChange,
  minHeight = 150,
  maxHeight = 400,
}: AgentActivityPanelProps) {
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<InteractionType | 'all'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(0);

  // Get unique agents for filter dropdown
  const uniqueAgents = useMemo(() => getUniqueAgents(interactions), [interactions]);

  // Filter interactions
  const filteredInteractions = useMemo(() => {
    return interactions
      .filter((interaction) => {
        // Agent filter
        if (agentFilter !== 'all') {
          if (interaction.fromAgent !== agentFilter && interaction.toAgent !== agentFilter) {
            return false;
          }
        }

        // Type filter
        if (typeFilter !== 'all' && interaction.type !== typeFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [interactions, agentFilter, typeFilter]);

  // Auto-scroll to bottom when new interactions arrive
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current && isExpanded) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [filteredInteractions, autoScroll, isExpanded]);

  // Handle scroll to detect manual scrolling
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    if (isAtBottom !== autoScroll) {
      setAutoScroll(isAtBottom);
    }
  }, [autoScroll]);

  // Drag handlers for resizing
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartHeight.current = panelHeight;
  }, [panelHeight]);

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = dragStartY.current - clientY;
    const newHeight = Math.min(maxHeight, Math.max(minHeight, dragStartHeight.current + deltaY));

    onHeightChange(newHeight);
  }, [isDragging, maxHeight, minHeight, onHeightChange]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove drag event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  return (
    <div
      className={`
        border-t border-border bg-card
        transition-all duration-300 ease-in-out
        ${isDragging ? 'select-none' : ''}
      `}
      style={{ height: isExpanded ? panelHeight : 40 }}
    >
      {/* Drag Handle */}
      {isExpanded && (
        <div
          className="
            h-2 w-full cursor-ns-resize
            flex items-center justify-center
            hover:bg-muted/50 active:bg-muted
            transition-colors
          "
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <div className="w-12 h-1 rounded-full bg-muted-foreground/30" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleExpanded}
            className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
            <span>Agent Activity Feed</span>
          </button>

          {/* Activity count badge */}
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {filteredInteractions.length}
          </span>
        </div>

        {/* Filters (only show when expanded) */}
        {isExpanded && (
          <div className="flex items-center gap-2">
            {/* Agent filter */}
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="text-xs bg-muted border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Agents</option>
              {uniqueAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>

            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as InteractionType | 'all')}
              className="text-xs bg-muted border border-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Types</option>
              {(Object.keys(INTERACTION_TYPE_CONFIG) as InteractionType[]).map((type) => (
                <option key={type} value={type}>
                  {INTERACTION_TYPE_CONFIG[type].labelJa}
                </option>
              ))}
            </select>

            {/* Auto-scroll indicator */}
            <button
              onClick={() => {
                setAutoScroll(true);
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                }
              }}
              className={`
                p-1 rounded transition-colors
                ${autoScroll
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }
              `}
              title={autoScroll ? 'Auto-scroll enabled' : 'Click to enable auto-scroll'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="overflow-y-auto p-2 space-y-1"
          style={{ height: panelHeight - 48 - 8 }} // 48 = header height, 8 = drag handle
        >
          {filteredInteractions.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No activity to display
            </div>
          ) : (
            filteredInteractions.map((interaction) => (
              <InteractionItem key={interaction.id} interaction={interaction} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
