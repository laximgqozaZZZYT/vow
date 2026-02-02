"use client";

/**
 * AgentTooltip Widget
 *
 * Displays detailed agent information in a tooltip on hover (desktop)
 * or tap (mobile). Shows current task, progress, and quick actions.
 *
 * @module Widget.AgentTooltip
 */

import { useState, useEffect, useRef, useCallback, memo, createContext, useContext } from 'react';
import type { Agent, AgentTask } from '../types/agent.types';
import { ROLE_CONFIG, STATUS_CONFIG, TASK_STATUS_CONFIG } from '../types/agent.types';

// Context for sharing tasks data with tooltip
const TasksContext = createContext<AgentTask[]>([]);

export function TasksProvider({ tasks, children }: { tasks: AgentTask[]; children: React.ReactNode }) {
  return <TasksContext.Provider value={tasks}>{children}</TasksContext.Provider>;
}

function useTasks(): AgentTask[] {
  return useContext(TasksContext);
}

export interface AgentTooltipProps {
  /** The agent to display information for */
  agent: Agent;
  /** Whether the tooltip is visible */
  visible: boolean;
  /** Anchor element position for positioning */
  anchorRect: DOMRect | null;
  /** Callback when View Details is clicked */
  onViewDetails?: () => void;
  /** Callback when Send Message is clicked */
  onSendMessage?: () => void;
  /** Callback to close the tooltip */
  onClose?: () => void;
}

/**
 * Format time from ISO string to display format (HH:MM)
 */
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate progress percentage for a task
 * Based on task status - in production could use actual progress data
 */
function getTaskProgress(task: AgentTask | null): number {
  if (!task) return 0;
  switch (task.status) {
    case 'pending':
      return 0;
    case 'assigned':
      return 10;
    case 'in_progress':
      return 50; // Would come from actual task progress in production
    case 'completed':
      return 100;
    case 'failed':
      return 0;
    default:
      return 0;
  }
}

/**
 * Get task details from tasks array
 */
function getTaskDetails(taskId: string | null, tasks: AgentTask[]): AgentTask | null {
  if (!taskId) return null;
  return tasks.find(t => t.id === taskId) || null;
}

/**
 * Progress Bar Component
 */
function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground w-9 text-right">
        {progress}%
      </span>
    </div>
  );
}

/**
 * Quick Action Button Component
 */
function QuickActionButton({
  onClick,
  children,
  variant = 'default',
}: {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'primary';
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`
        flex-1 px-3 py-1.5
        text-xs font-medium
        rounded-md
        transition-colors
        ${
          variant === 'primary'
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
        }
      `}
    >
      {children}
    </button>
  );
}

/**
 * AgentTooltip Component
 */
function AgentTooltipComponent({
  agent,
  visible,
  anchorRect,
  onViewDetails,
  onSendMessage,
  onClose,
}: AgentTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [isPositioned, setIsPositioned] = useState(false);

  // Calculate position to ensure tooltip stays within viewport
  const calculatePosition = useCallback(() => {
    if (!anchorRect || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 8;

    // Default: position below and to the right of the anchor
    let top = anchorRect.bottom + padding;
    let left = anchorRect.left;

    // Adjust if tooltip would go off the right edge
    if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding;
    }

    // Adjust if tooltip would go off the left edge
    if (left < padding) {
      left = padding;
    }

    // Adjust if tooltip would go off the bottom edge
    if (top + tooltipRect.height > viewportHeight - padding) {
      // Try positioning above the anchor
      top = anchorRect.top - tooltipRect.height - padding;

      // If still off-screen, position at top of viewport
      if (top < padding) {
        top = padding;
      }
    }

    setPosition({ top, left });
    setIsPositioned(true);
  }, [anchorRect]);

  // Calculate position when visible or anchor changes
  useEffect(() => {
    if (visible && anchorRect) {
      // Wait for the tooltip to render before calculating position
      requestAnimationFrame(() => {
        calculatePosition();
      });
    } else {
      setIsPositioned(false);
    }
  }, [visible, anchorRect, calculatePosition]);

  // Handle click outside to close tooltip (for mobile)
  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };

    // Use a small delay to prevent immediate close on mobile tap
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [visible, onClose]);

  // Handle window resize
  useEffect(() => {
    if (!visible) return;

    const handleResize = () => {
      calculatePosition();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [visible, calculatePosition]);

  // Get tasks from context
  const tasks = useTasks();

  if (!visible) return null;

  const roleConfig = ROLE_CONFIG[agent.role];
  const statusConfig = STATUS_CONFIG[agent.status];
  const currentTask = getTaskDetails(agent.currentTaskId, tasks);
  const progress = getTaskProgress(currentTask);

  return (
    <div
      ref={tooltipRef}
      className={`
        fixed z-50
        w-64
        bg-card border border-border
        rounded-lg shadow-xl
        overflow-hidden
        transition-opacity duration-150
        ${isPositioned ? 'opacity-100' : 'opacity-0'}
      `}
      style={{
        top: position.top,
        left: position.left,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-lg">{roleConfig.icon}</span>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{agent.name}</h4>
            <div className="flex items-center gap-2 text-xs">
              <span className={roleConfig.color}>{roleConfig.labelJa}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${statusConfig.bgColor} ${agent.status === 'busy' ? 'animate-pulse' : ''}`} />
            <span className={`text-xs ${statusConfig.color}`}>{statusConfig.labelJa}</span>
          </div>
        </div>
      </div>

      {/* Task Info */}
      <div className="px-3 py-2.5 border-b border-border">
        <div className="text-xs text-muted-foreground mb-1.5">Current Task:</div>
        {currentTask ? (
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground line-clamp-2">
              &ldquo;{currentTask.title}&rdquo;
            </div>
            <ProgressBar progress={progress} />
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Started: {formatTime(currentTask.createdAt)}</span>
              </div>
            </div>
            {currentTask.tags.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                  <polyline points="13 2 13 9 20 9" />
                </svg>
                <span className="truncate">
                  Files: {currentTask.tags.slice(0, 2).join(', ')}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic">
            No active task
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="px-3 py-2.5 bg-muted/20">
        <div className="text-xs text-muted-foreground mb-2">Quick Actions:</div>
        <div className="flex gap-2">
          <QuickActionButton onClick={onViewDetails}>
            View Details
          </QuickActionButton>
          <QuickActionButton onClick={onSendMessage} variant="primary">
            Send Message
          </QuickActionButton>
        </div>
      </div>
    </div>
  );
}

export const AgentTooltip = memo(AgentTooltipComponent);
export default AgentTooltip;

/**
 * Hook for managing tooltip state
 */
export function useAgentTooltip() {
  const [isVisible, setIsVisible] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMobileRef = useRef(false);

  // Detect mobile
  useEffect(() => {
    isMobileRef.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  const showTooltip = useCallback((agent: Agent, element: HTMLElement) => {
    // Clear any pending hide
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }

    // If it's the same agent, just show
    if (selectedAgent?.id === agent.id && isVisible) {
      return;
    }

    setSelectedAgent(agent);
    setAnchorRect(element.getBoundingClientRect());
    setIsVisible(true);
  }, [selectedAgent, isVisible]);

  const hideTooltip = useCallback(() => {
    setIsVisible(false);
  }, []);

  const handleMouseEnter = useCallback((agent: Agent, element: HTMLElement) => {
    if (isMobileRef.current) return;

    // Add a small delay before showing
    hoverTimeoutRef.current = setTimeout(() => {
      showTooltip(agent, element);
    }, 200);
  }, [showTooltip]);

  const handleMouseLeave = useCallback(() => {
    if (isMobileRef.current) return;

    // Clear pending show
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Add a small delay before hiding
    leaveTimeoutRef.current = setTimeout(() => {
      hideTooltip();
    }, 100);
  }, [hideTooltip]);

  const handleTap = useCallback((agent: Agent, element: HTMLElement) => {
    if (!isMobileRef.current) return;

    // Toggle tooltip on tap
    if (selectedAgent?.id === agent.id && isVisible) {
      hideTooltip();
    } else {
      showTooltip(agent, element);
    }
  }, [selectedAgent, isVisible, showTooltip, hideTooltip]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    };
  }, []);

  return {
    isVisible,
    anchorRect,
    selectedAgent,
    showTooltip,
    hideTooltip,
    handleMouseEnter,
    handleMouseLeave,
    handleTap,
  };
}
