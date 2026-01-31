"use client";

/**
 * AgentPane Widget
 *
 * Individual pane in the tmux-style panel view.
 * Shows agent header, current task, and real-time logs.
 *
 * @module Widget.AgentPane
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { Agent, AgentLog } from '../types/agent.types';
import { ROLE_CONFIG, STATUS_CONFIG, LOG_LEVEL_CONFIG } from '../types/agent.types';

interface AgentPaneProps {
  agent: Agent | null;
  logs: AgentLog[];
  isMaximized?: boolean;
  onMaximize?: () => void;
  onMinimize?: () => void;
  currentTaskTitle?: string;
  /** Callback for header mouse enter - for tooltip display */
  onHeaderMouseEnter?: (agent: Agent, element: HTMLElement) => void;
  /** Callback for header mouse leave - for tooltip hide */
  onHeaderMouseLeave?: () => void;
  /** Callback for header tap - for mobile tooltip toggle */
  onHeaderTap?: (agent: Agent, element: HTMLElement) => void;
}

/**
 * Log Entry Component
 */
function LogEntry({ log }: { log: AgentLog }) {
  const config = LOG_LEVEL_CONFIG[log.level];
  const time = new Date(log.timestamp);
  const timeStr = time.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div className={`font-mono text-xs leading-relaxed ${config.color}`}>
      <span className="text-gray-500">[{timeStr}]</span>
      <span className={`mx-1 ${config.bgColor} px-1 rounded`}>
        {config.icon}
      </span>
      <span>{log.message}</span>
      {log.details && (
        <div className="ml-16 text-gray-500 text-[10px]">{log.details}</div>
      )}
    </div>
  );
}

/**
 * Empty Pane Component
 */
function EmptyPane() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-black/20">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-30 mb-2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
      <span className="text-xs opacity-50">No agent assigned</span>
    </div>
  );
}

/**
 * AgentPane Component
 */
export default function AgentPane({
  agent,
  logs,
  isMaximized = false,
  onMaximize,
  onMinimize,
  currentTaskTitle,
  onHeaderMouseEnter,
  onHeaderMouseLeave,
  onHeaderTap,
}: AgentPaneProps) {
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Handle header hover for tooltip
  const handleHeaderMouseEnter = useCallback(() => {
    if (onHeaderMouseEnter && agent && headerRef.current) {
      onHeaderMouseEnter(agent, headerRef.current);
    }
  }, [agent, onHeaderMouseEnter]);

  // Handle header tap for mobile tooltip
  const handleHeaderTouchEnd = useCallback((e: React.TouchEvent) => {
    if (onHeaderTap && agent && headerRef.current) {
      e.preventDefault();
      onHeaderTap(agent, headerRef.current);
    }
  }, [agent, onHeaderTap]);

  // Filter logs for this agent
  const agentLogs = useMemo(() => {
    if (!agent) return [];
    return logs
      .filter((log) => log.agentId === agent.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [agent, logs]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [agentLogs, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = () => {
    if (!logsContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    setAutoScroll(isAtBottom);
  };

  if (!agent) {
    return (
      <div className="h-full border border-gray-700 rounded bg-gray-900">
        <EmptyPane />
      </div>
    );
  }

  const roleConfig = ROLE_CONFIG[agent.role];
  const statusConfig = STATUS_CONFIG[agent.status];

  return (
    <div className={`
      h-full flex flex-col
      border border-gray-700 rounded
      bg-gray-900 text-gray-100
      overflow-hidden
      ${isMaximized ? 'fixed inset-4 z-50' : ''}
    `}>
      {/* Header */}
      <div
        ref={headerRef}
        onMouseEnter={handleHeaderMouseEnter}
        onMouseLeave={onHeaderMouseLeave}
        onTouchEnd={handleHeaderTouchEnd}
        className="flex items-center justify-between px-2 py-1.5 bg-gray-800 border-b border-gray-700 shrink-0 cursor-pointer hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm">{roleConfig.icon}</span>
          <span className="font-medium text-sm truncate">{agent.name}</span>
          <span className={`text-xs ${roleConfig.color}`}>{roleConfig.labelJa}</span>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.bgColor} ${agent.status === 'busy' ? 'animate-pulse' : ''}`} />
            <span className={`text-[10px] ${statusConfig.color}`}>{statusConfig.labelJa}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isMaximized ? (
            <button
              onClick={onMinimize}
              className="p-1 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-gray-200"
              title="Minimize"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 14 10 14 10 20" />
                <polyline points="20 10 14 10 14 4" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onMaximize}
              className="p-1 hover:bg-gray-700 rounded transition-colors text-gray-400 hover:text-gray-200"
              title="Maximize"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Current Task */}
      {agent.currentTaskId && (
        <div className="px-2 py-1 bg-yellow-500/10 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-yellow-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span className="truncate">{currentTaskTitle || 'Working on task...'}</span>
          </div>
        </div>
      )}

      {/* Logs Content */}
      <div
        ref={logsContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 space-y-1 bg-black/30"
      >
        {agentLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-xs">
            No logs yet...
          </div>
        ) : (
          agentLogs.map((log) => <LogEntry key={log.id} log={log} />)
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-2 py-1 bg-gray-800 border-t border-gray-700 text-[10px] text-gray-500 shrink-0">
        <span>{agent.machineName}</span>
        <span>{agentLogs.length} logs</span>
      </div>
    </div>
  );
}
