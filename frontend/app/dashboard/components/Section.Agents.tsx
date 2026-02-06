"use client";

/**
 * AgentsSection Component
 *
 * Main container for the Multi-Agent Dashboard section.
 * Provides views for:
 * - Agent grid with status monitoring (Mastra & Strands support)
 * - Agent type badges (mastra/strands/claude/custom)
 * - Real-time SSE updates
 * - Workflow execution progress view
 * - Manual task creation form
 * - Agent type and status filtering
 * - Expandable agent logs view
 * - Manager chat interface
 * - Task management
 * - Activity stream
 *
 * Connects to MCP Task Server for real-time agent monitoring.
 *
 * @module Section.Agents
 */

import { useState, useMemo, useCallback } from 'react';
import { useHandedness } from '../contexts/HandednessContext';
import type {
  Agent,
  AgentTask,
  AgentActivity,
  AgentRole,
  AgentStatus,
  AgentType,
  AgentLog,
  AgentInteraction,
  AgentInstruction,
  WorkflowExecution,
  WorkflowStep,
  TaskPriority,
} from '../types/agent.types';
import {
  ROLE_CONFIG,
  STATUS_CONFIG,
  TASK_STATUS_CONFIG,
  PRIORITY_CONFIG,
  AGENT_TYPE_CONFIG,
  WORKFLOW_STEP_STATUS_CONFIG,
  LOG_LEVEL_CONFIG,
} from '../types/agent.types';
import AgentCard from './Widget.AgentCard';
import { AgentTooltip, useAgentTooltip, TasksProvider } from './Widget.AgentTooltip';
import ManagerChatModal from './Modal.ManagerChat';
import MultiAgentConfigModal from './Modal.MultiAgentConfig';
import AgentPanels from './View.AgentPanels';
import AgentActivityPanel from './Widget.AgentActivityPanel';
import InstructionFlow from './Widget.InstructionFlow';
import { useMultiAgentServerContext } from '../contexts/MultiAgentServerContext';
import type { DashboardStats, ConnectionState } from '../hooks/useMultiAgentServer';

type ViewMode = 'grid' | 'list' | 'kanban' | 'panels';
type FilterRole = AgentRole | 'all';
type FilterStatus = AgentStatus | 'all';
type FilterAgentType = AgentType | 'all';

interface AgentsSectionProps {
  /** Callback when settings is requested */
  onOpenSettings?: () => void;
}

/**
 * Connection indicator component
 */
function ConnectionIndicator({
  state,
  onConfigClick,
}: {
  state: ConnectionState;
  onConfigClick: () => void;
}) {
  const stateConfig = {
    disconnected: { color: 'bg-gray-400', text: 'OFFLINE', textColor: 'text-gray-400' },
    connecting: { color: 'bg-yellow-400 animate-pulse', text: '接続中...', textColor: 'text-yellow-400' },
    connected: { color: 'bg-green-500', text: 'LIVE', textColor: 'text-green-500' },
    error: { color: 'bg-red-500', text: 'ERROR', textColor: 'text-red-500' },
  };

  const cfg = stateConfig[state];

  return (
    <button
      onClick={onConfigClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted transition-colors"
      title="サーバー設定"
    >
      <div className={`w-2 h-2 rounded-full ${cfg.color}`} />
      <span className={`text-xs font-medium ${cfg.textColor}`}>{cfg.text}</span>
    </button>
  );
}

/**
 * Dashboard Stats Bar Component
 */
function StatsBar({
  stats,
  connectionState,
  typeStats,
}: {
  stats: DashboardStats | null;
  connectionState: ConnectionState;
  typeStats?: Record<AgentType, number>;
}) {
  // Handle both real server stats and mock stats structure
  const agentStats = stats?.agents || { total: 0, idle: 0, busy: 0, offline: 0 };
  const taskStats = stats?.tasks || { total: 0, in_progress: 0, inProgress: 0 };
  const machineStats = (stats as any)?.machines || { total: 0, online: 0, totalCapacity: 0, usedCapacity: 0 };

  // Handle different property names
  const inProgress = (taskStats as any).in_progress ?? (taskStats as any).inProgress ?? 0;
  const machinesOnline = machineStats.online ?? 0;
  const machinesTotal = machineStats.total ?? 0;
  const capacity = machineStats.totalCapacity ?? machineStats.capacity ?? 0;
  const used = machineStats.usedCapacity ?? machineStats.used ?? 0;

  return (
    <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Agents:</span>
        <span className="font-medium">{agentStats.total}</span>
        <span className="text-green-500">({agentStats.idle} idle)</span>
        <span className="text-yellow-500">({agentStats.busy} busy)</span>
        <span className="text-gray-400">({agentStats.offline} offline)</span>
      </div>
      {typeStats && (typeStats.mastra > 0 || typeStats.strands > 0) && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Types:</span>
          {typeStats.mastra > 0 && (
            <span className="text-purple-500">
              <span className="font-bold">M</span> {typeStats.mastra}
            </span>
          )}
          {typeStats.strands > 0 && (
            <span className="text-cyan-500">
              <span className="font-bold">S</span> {typeStats.strands}
            </span>
          )}
          {typeStats.claude > 0 && (
            <span className="text-orange-500">
              <span className="font-bold">C</span> {typeStats.claude}
            </span>
          )}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Tasks:</span>
        <span className="font-medium">{taskStats.total}</span>
        <span className="text-blue-500">({inProgress} active)</span>
      </div>
      {machinesTotal > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Machines:</span>
          <span className="font-medium">{machinesOnline}/{machinesTotal}</span>
          {capacity > 0 && (
            <span className="text-muted-foreground">({used}/{capacity})</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * View Mode Toggle Component
 */
function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const modes: { value: ViewMode; icon: React.ReactNode; label: string }[] = [
    {
      value: 'grid',
      label: 'Grid',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      value: 'list',
      label: 'List',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      ),
    },
    {
      value: 'kanban',
      label: 'Kanban',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="5" height="18" rx="1" />
          <rect x="10" y="3" width="5" height="12" rx="1" />
          <rect x="17" y="3" width="5" height="15" rx="1" />
        </svg>
      ),
    },
    {
      value: 'panels',
      label: 'Panels',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="8" height="8" rx="1" />
          <rect x="13" y="3" width="8" height="8" rx="1" />
          <rect x="3" y="13" width="8" height="8" rx="1" />
          <rect x="13" y="13" width="8" height="8" rx="1" />
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex items-center border border-border rounded-md overflow-hidden">
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => onChange(m.value)}
          title={m.label}
          className={`
            flex items-center justify-center
            w-8 h-8
            transition-colors
            ${mode === m.value
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }
          `}
        >
          {m.icon}
        </button>
      ))}
    </div>
  );
}

/**
 * Agent Type Badge Component
 */
function AgentTypeBadge({ type, size = 'sm' }: { type?: AgentType; size?: 'xs' | 'sm' | 'md' }) {
  const agentType = type || 'custom';
  const config = AGENT_TYPE_CONFIG[agentType];

  const sizeClasses = {
    xs: 'text-[10px] px-1 py-0.5',
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 font-medium rounded border
        ${config.color} ${config.bgColor} ${sizeClasses[size]}
      `}
      title={config.label}
    >
      <span className="font-bold">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

/**
 * Workflow Progress Component
 */
function WorkflowProgressView({
  workflow,
  className = '',
}: {
  workflow: WorkflowExecution;
  className?: string;
}) {
  const completedSteps = workflow.steps.filter(s => s.status === 'completed').length;
  const totalSteps = workflow.steps.length;

  return (
    <div className={`bg-muted/30 rounded-lg p-3 border border-border ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{workflow.workflowName}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            workflow.status === 'running' ? 'bg-blue-500/10 text-blue-500' :
            workflow.status === 'completed' ? 'bg-green-500/10 text-green-500' :
            workflow.status === 'failed' ? 'bg-red-500/10 text-red-500' :
            'bg-gray-500/10 text-gray-500'
          }`}>
            {workflow.status}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {completedSteps}/{totalSteps} steps
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
        <div
          className={`h-full transition-all duration-300 ${
            workflow.status === 'failed' ? 'bg-red-500' :
            workflow.status === 'completed' ? 'bg-green-500' :
            'bg-blue-500'
          }`}
          style={{ width: `${workflow.progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-1">
        {workflow.steps.map((step) => {
          const stepConfig = WORKFLOW_STEP_STATUS_CONFIG[step.status];
          return (
            <div
              key={step.id}
              className={`flex items-center gap-2 text-xs py-1 px-2 rounded ${stepConfig.bgColor}`}
            >
              <span className={`font-mono ${stepConfig.color}`}>{stepConfig.icon}</span>
              <span className="flex-1 truncate">{step.name}</span>
              {step.status === 'running' && (
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              )}
              {step.error && (
                <span className="text-red-500 truncate max-w-[100px]" title={step.error}>
                  {step.error}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Agent Logs Panel Component
 */
function AgentLogsPanel({
  logs,
  agentId,
  isExpanded,
  onToggle,
}: {
  logs: AgentLog[];
  agentId?: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const filteredLogs = agentId
    ? logs.filter(l => l.agentId === agentId)
    : logs;

  const recentLogs = filteredLogs.slice(0, 50);

  return (
    <div className={`bg-muted/30 rounded-lg border border-border transition-all ${isExpanded ? 'p-3' : 'p-2'}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          Agent Logs ({recentLogs.length})
        </span>
        {!isExpanded && recentLogs.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Latest: {recentLogs[0]?.message.slice(0, 30)}...
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-1 max-h-64 overflow-y-auto font-mono text-xs">
          {recentLogs.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No logs available
            </div>
          ) : (
            recentLogs.map((log) => {
              const config = LOG_LEVEL_CONFIG[log.level];
              return (
                <div
                  key={log.id}
                  className={`flex items-start gap-2 px-2 py-1 rounded ${config.bgColor}`}
                >
                  <span className={`shrink-0 ${config.color}`}>[{config.icon}]</span>
                  <span className="text-muted-foreground shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="flex-1 break-words">{log.message}</span>
                  {log.details && (
                    <span className="text-muted-foreground shrink-0 truncate max-w-[100px]" title={log.details}>
                      {log.details}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Task Creation Form Component
 */
function TaskCreationForm({
  onCreateTask,
  agents,
  isOpen,
  onClose,
}: {
  onCreateTask: (task: Partial<AgentTask> & { assignTo?: string }) => Promise<AgentTask | null>;
  agents: Agent[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [assignTo, setAssignTo] = useState<string>('');
  const [tags, setTags] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const task = await onCreateTask({
        title: title.trim(),
        description: description.trim(),
        priority,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        assignTo: assignTo || undefined,
      });

      if (task) {
        setTitle('');
        setDescription('');
        setPriority('normal');
        setAssignTo('');
        setTags('');
        onClose();
      } else {
        setError('Failed to create task');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Create New Task</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task description"
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isSubmitting}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Assign To</label>
              <select
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isSubmitting}
              >
                <option value="">Unassigned</option>
                {agents.filter(a => a.status !== 'offline').map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="frontend, bug, urgent"
              className="w-full px-3 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-500">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Agent Metrics Display Component
 */
function AgentMetricsDisplay({ agent }: { agent: Agent }) {
  if (!agent.metrics) return null;

  const { tasksCompleted, tasksFailed, successRate, averageTaskDuration, uptime } = agent.metrics;

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  return (
    <div className="grid grid-cols-4 gap-2 text-xs">
      <div className="bg-muted/50 rounded p-1.5 text-center">
        <div className="text-muted-foreground">Completed</div>
        <div className="font-medium text-green-500">{tasksCompleted}</div>
      </div>
      <div className="bg-muted/50 rounded p-1.5 text-center">
        <div className="text-muted-foreground">Failed</div>
        <div className="font-medium text-red-500">{tasksFailed}</div>
      </div>
      <div className="bg-muted/50 rounded p-1.5 text-center">
        <div className="text-muted-foreground">Success</div>
        <div className="font-medium">{successRate.toFixed(0)}%</div>
      </div>
      <div className="bg-muted/50 rounded p-1.5 text-center">
        <div className="text-muted-foreground">Avg Time</div>
        <div className="font-medium">{formatDuration(averageTaskDuration)}</div>
      </div>
    </div>
  );
}

/**
 * Filter Controls Component
 */
function FilterControls({
  roleFilter,
  statusFilter,
  typeFilter,
  onRoleChange,
  onStatusChange,
  onTypeChange,
}: {
  roleFilter: FilterRole;
  statusFilter: FilterStatus;
  typeFilter: FilterAgentType;
  onRoleChange: (role: FilterRole) => void;
  onStatusChange: (status: FilterStatus) => void;
  onTypeChange: (type: FilterAgentType) => void;
}) {
  const roles: { value: FilterRole; label: string }[] = [
    { value: 'all', label: 'All Roles' },
    { value: 'manager', label: 'Manager' },
    { value: 'developer', label: 'Developer' },
    { value: 'reviewer', label: 'Reviewer' },
    { value: 'tester', label: 'Tester' },
    { value: 'architect', label: 'Architect' },
    { value: 'devops', label: 'DevOps' },
  ];

  const statuses: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: 'All Status' },
    { value: 'idle', label: 'Idle' },
    { value: 'busy', label: 'Busy' },
    { value: 'offline', label: 'Offline' },
  ];

  const types: { value: FilterAgentType; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'mastra', label: 'Mastra' },
    { value: 'strands', label: 'Strands' },
    { value: 'claude', label: 'Claude' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={typeFilter}
        onChange={(e) => onTypeChange(e.target.value as FilterAgentType)}
        className="text-xs bg-muted border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {types.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <select
        value={roleFilter}
        onChange={(e) => onRoleChange(e.target.value as FilterRole)}
        className="text-xs bg-muted border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {roles.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value as FilterStatus)}
        className="text-xs bg-muted border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {statuses.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * Chat Button Component
 */
function ChatButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="
        flex items-center gap-1.5
        px-3 py-1.5
        bg-primary text-primary-foreground
        hover:bg-primary/90
        rounded-md
        text-xs font-medium
        transition-colors
        shadow-sm
      "
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span>Chat</span>
    </button>
  );
}

/**
 * Activity Feed Component
 */
function ActivityFeed({ activities }: { activities: AgentActivity[] }) {
  const getEventConfig = (eventType: AgentActivity['eventType']) => {
    switch (eventType) {
      case 'task_started':
        return { icon: '▶️', label: 'started task', color: 'text-yellow-500' };
      case 'task_completed':
        return { icon: '✅', label: 'completed task', color: 'text-green-500' };
      case 'task_failed':
        return { icon: '❌', label: 'failed task', color: 'text-red-500' };
      case 'agent_registered':
        return { icon: '➕', label: 'registered', color: 'text-blue-500' };
      case 'agent_status_changed':
        return { icon: '🔄', label: 'status changed', color: 'text-purple-500' };
      case 'task_created':
        return { icon: '📝', label: 'task created', color: 'text-blue-500' };
      case 'task_assigned':
        return { icon: '📋', label: 'task assigned', color: 'text-cyan-500' };
      default:
        return { icon: '📋', label: eventType.replace(/_/g, ' '), color: 'text-gray-500' };
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">
        Recent Activity ({activities.length})
      </h3>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4">
            <div className="text-2xl mb-2">📡</div>
            <div>No activity yet</div>
            <div className="text-[10px] mt-1">Events will appear here when agents perform actions</div>
          </div>
        ) : (
          activities.slice(0, 10).map((activity) => {
            const eventConfig = getEventConfig(activity.eventType);
            return (
              <div
                key={activity.id}
                className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors text-xs"
              >
                <span className="shrink-0">{eventConfig.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-medium">{activity.agentName || 'System'}</span>
                    <span className={`${eventConfig.color}`}>{eventConfig.label}</span>
                  </div>
                  {activity.taskTitle && (
                    <div className="truncate text-muted-foreground mt-0.5">
                      "{activity.taskTitle}"
                    </div>
                  )}
                </div>
                <span className="text-muted-foreground shrink-0 text-[10px]">{formatTime(activity.createdAt)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Task List Component
 */
function TaskList({
  tasks,
  onTaskClick,
}: {
  tasks: AgentTask[];
  onTaskClick?: (task: AgentTask) => void;
}) {
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const assignedTasks = tasks.filter(t => t.status === 'assigned');
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed').slice(0, 3);

  const TaskItem = ({ task, className }: { task: AgentTask; className?: string }) => (
    <button
      onClick={() => onTaskClick?.(task)}
      className={`w-full text-left flex items-center gap-2 p-2 rounded-md transition-colors cursor-pointer hover:ring-1 hover:ring-primary/50 ${className}`}
    >
      <div className={`w-2 h-2 rounded-full shrink-0 ${TASK_STATUS_CONFIG[task.status].bgColor} ${task.status === 'in_progress' ? 'animate-pulse' : ''}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-medium truncate ${task.status === 'completed' ? 'line-through opacity-70' : ''}`}>
          {task.title}
        </div>
        {(task.assignedAgentName || task.assignedTo) && task.status !== 'completed' && (
          <div className="text-xs text-muted-foreground">
            → {task.assignedAgentName || task.assignedTo}
          </div>
        )}
      </div>
      {task.status !== 'completed' && (
        <span className={`text-xs shrink-0 ${PRIORITY_CONFIG[task.priority].color}`}>
          {task.priority}
        </span>
      )}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center justify-between">
        <span>Tasks ({tasks.length})</span>
        {tasks.length > 0 && (
          <span className="text-[10px] text-primary">Click to view chat</span>
        )}
      </h3>

      {/* In Progress */}
      {inProgressTasks.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-yellow-500 font-medium">🔄 In Progress ({inProgressTasks.length})</div>
          {inProgressTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              className="bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20"
            />
          ))}
        </div>
      )}

      {/* Assigned (waiting for agent to claim) */}
      {assignedTasks.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-blue-500 font-medium">📋 Assigned ({assignedTasks.length})</div>
          {assignedTasks.slice(0, 3).map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              className="bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20"
            />
          ))}
          {assignedTasks.length > 3 && (
            <div className="text-xs text-muted-foreground pl-4">
              +{assignedTasks.length - 3} more
            </div>
          )}
        </div>
      )}

      {/* Pending */}
      {pendingTasks.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-gray-500 font-medium">⏳ Pending ({pendingTasks.length})</div>
          {pendingTasks.slice(0, 3).map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              className="hover:bg-muted/50"
            />
          ))}
          {pendingTasks.length > 3 && (
            <div className="text-xs text-muted-foreground pl-4">
              +{pendingTasks.length - 3} more
            </div>
          )}
        </div>
      )}

      {/* Recent Completed */}
      {completedTasks.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-green-500 font-medium">✅ Recently Completed</div>
          {completedTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              className="bg-green-500/5 hover:bg-green-500/10"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="text-xs text-muted-foreground text-center py-4">
          No tasks yet
        </div>
      )}
    </div>
  );
}

/**
 * Kanban View Component
 */
function KanbanView({
  agents,
  tasks,
  onMouseEnter,
  onMouseLeave,
  onTap,
}: {
  agents: Agent[];
  tasks: AgentTask[];
  onMouseEnter?: (agent: Agent, element: HTMLElement) => void;
  onMouseLeave?: () => void;
  onTap?: (agent: Agent, element: HTMLElement) => void;
}) {
  const columns = [
    { id: 'idle', title: 'Idle', agents: agents.filter(a => a.status === 'idle') },
    { id: 'busy', title: 'Working', agents: agents.filter(a => a.status === 'busy') },
    { id: 'offline', title: 'Offline', agents: agents.filter(a => a.status === 'offline') },
  ];

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => (
        <div
          key={column.id}
          className="flex-1 min-w-[280px] bg-muted/30 rounded-lg p-3"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">{column.title}</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {column.agents.length}
            </span>
          </div>
          <div className="space-y-2">
            {column.agents.map((agent) => (
              <div key={agent.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <AgentTypeBadge type={agent.agentType} size="xs" />
                  {agent.currentTaskTitle && (
                    <span className="text-xs text-muted-foreground truncate">
                      {agent.currentTaskTitle}
                    </span>
                  )}
                </div>
                <AgentCard
                  agent={agent}
                  variant="compact"
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  onTap={onTap}
                />
                {agent.metrics && (
                  <AgentMetricsDisplay agent={agent} />
                )}
              </div>
            ))}
            {column.agents.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4">
                No agents
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * AgentsSection Component
 */
export default function AgentsSection({ onOpenSettings }: AgentsSectionProps) {
  const { isLeftHanded } = useHandedness();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [roleFilter, setRoleFilter] = useState<FilterRole>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [typeFilter, setTypeFilter] = useState<FilterAgentType>('all');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isActivityPanelExpanded, setIsActivityPanelExpanded] = useState(false);
  const [activityPanelHeight, setActivityPanelHeight] = useState(200);
  const [showInstructionFlow, setShowInstructionFlow] = useState(false);
  const [showLogsPanel, setShowLogsPanel] = useState(false);
  const [showTaskCreationForm, setShowTaskCreationForm] = useState(false);
  const [selectedAgentForLogs, setSelectedAgentForLogs] = useState<string | undefined>(undefined);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);

  // Tooltip hook for agent cards
  const tooltip = useAgentTooltip();

  // Multi-agent server from context (shared SSE connection)
  const server = useMultiAgentServerContext();

  // Use real data from server (empty arrays when disconnected)
  const isConnected = server.connectionState === 'connected';
  const agents: Agent[] = server.agents;
  const tasks: AgentTask[] = server.tasks;
  const activities: AgentActivity[] = server.activities;
  const stats: DashboardStats | null = server.stats;
  const logs: AgentLog[] = []; // TODO: Implement server-side logs endpoint
  const interactions: AgentInteraction[] = []; // TODO: Implement server-side interactions endpoint
  const instructions: AgentInstruction[] = []; // TODO: Implement server-side instructions endpoint

  // Wrapper for createTask that uses the first connected server
  const handleCreateTask = useCallback(async (task: Partial<AgentTask> & { assignTo?: string }) => {
    // Find first connected server
    const connectedServer = Array.from(server.connections.values())
      .find(c => c.connectionState === 'connected');

    if (!connectedServer) {
      console.error('[AgentsSection] No connected server to create task');
      return null;
    }

    return server.createTask(connectedServer.serverId, task);
  }, [server]);

  // Wrapper for assignTask that uses the first connected server
  const handleAssignTask = useCallback(async (taskId: string, agentId: string): Promise<boolean> => {
    // Find first connected server
    const connectedServer = Array.from(server.connections.values())
      .find(c => c.connectionState === 'connected');

    if (!connectedServer) {
      console.error('[AgentsSection] No connected server to assign task');
      return false;
    }

    return server.assignTask(connectedServer.serverId, taskId, agentId);
  }, [server]);

  // Tooltip action handlers
  const handleViewDetails = useCallback((agent: Agent) => {
    console.log('View details for agent:', agent.id);
    tooltip.hideTooltip();
  }, [tooltip]);

  const handleSendMessage = useCallback((agent: Agent) => {
    console.log('Send message to agent:', agent.id);
    tooltip.hideTooltip();
    setFocusTaskId(null);
    setIsChatOpen(true);
  }, [tooltip]);

  // Handle task click to open chat with focus on that task
  const handleTaskClick = useCallback((task: AgentTask) => {
    setFocusTaskId(task.id);
    setIsChatOpen(true);
  }, []);

  // Filter agents
  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      if (roleFilter !== 'all' && agent.role !== roleFilter) return false;
      if (statusFilter !== 'all' && agent.status !== statusFilter) return false;
      if (typeFilter !== 'all' && (agent.agentType || 'custom') !== typeFilter) return false;
      return true;
    });
  }, [agents, roleFilter, statusFilter, typeFilter]);

  // Get agents with active workflows
  const agentsWithWorkflows = useMemo(() => {
    return filteredAgents.filter(a => a.currentWorkflow && a.currentWorkflow.status === 'running');
  }, [filteredAgents]);

  // Agent type statistics
  const typeStats = useMemo(() => {
    const stats: Record<AgentType, number> = {
      mastra: 0,
      strands: 0,
      claude: 0,
      custom: 0,
    };
    agents.forEach(a => {
      const type = a.agentType || 'custom';
      stats[type]++;
    });
    return stats;
  }, [agents]);

  return (
    <TasksProvider tasks={tasks}>
    <section className="rounded-lg border border-border bg-card text-card-foreground shadow-sm flex flex-col min-h-0">
      {/* Header */}
      <div className={`sticky top-0 z-20 flex flex-col gap-3 p-4 sm:p-6 pb-3 bg-card border-b border-border`}>
        {/* Title Row */}
        <div className={`flex items-center justify-between ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>Agents</span>
            <ConnectionIndicator
              state={server.connectionState}
              onConfigClick={() => setIsConfigOpen(true)}
            />
          </h2>
          <div className={`flex items-center gap-2 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
            {isConnected && (
              <>
                {/* Create Task Button */}
                <button
                  onClick={() => setShowTaskCreationForm(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md text-xs font-medium transition-colors"
                  title="Create New Task"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span className="hidden sm:inline">New Task</span>
                </button>
                {/* Export Conversation History Button */}
                <button
                  onClick={() => {
                    const exportData = {
                      exportedAt: new Date().toISOString(),
                      agents: agents.map(a => ({
                        id: a.id,
                        name: a.name,
                        role: a.role,
                        status: a.status,
                        agentType: a.agentType,
                      })),
                      activities: activities.map(a => ({
                        id: a.id,
                        agentId: a.agentId,
                        agentName: a.agentName,
                        eventType: a.eventType,
                        taskId: a.taskId,
                        taskTitle: a.taskTitle,
                        details: a.details,
                        createdAt: a.createdAt,
                      })),
                      tasks: tasks.map(t => ({
                        id: t.id,
                        title: t.title,
                        description: t.description,
                        status: t.status,
                        priority: t.priority,
                        assignedTo: t.assignedTo,
                        assignedAgentName: t.assignedAgentName,
                        createdAt: t.createdAt,
                        updatedAt: t.updatedAt,
                        completedAt: t.completedAt,
                        tags: t.tags,
                      })),
                    };
                    const jsonString = JSON.stringify(exportData, null, 2);
                    const blob = new Blob([jsonString], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    const date = new Date().toISOString().split('T')[0];
                    link.href = url;
                    link.download = `agents-export-${date}.json`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted hover:bg-muted/80 rounded-md text-xs font-medium transition-colors text-muted-foreground hover:text-foreground"
                  title="Export Conversation History as JSON"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span className="hidden sm:inline">Export</span>
                </button>
                <button
                  onClick={() => server.refreshData()}
                  className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  title="Refresh Data"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 4v6h-6" />
                    <path d="M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                  </svg>
                </button>
              </>
            )}
            {/* Logs Toggle Button */}
            <button
              onClick={() => setShowLogsPanel(!showLogsPanel)}
              className={`p-2 rounded-md transition-colors ${
                showLogsPanel
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              title="Toggle Agent Logs"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </button>
            {/* Download MCP Server Button */}
            <a
              href="/downloads/vow-mcp-server-v2.0.0.zip"
              download
              className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Download MCP Server"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
            <ChatButton onClick={() => setIsChatOpen(true)} />
            <button
              onClick={() => setIsConfigOpen(true)}
              className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Server Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <StatsBar stats={stats} connectionState={server.connectionState} typeStats={typeStats} />

        {/* Controls Row */}
        <div className={`flex items-center justify-between gap-2 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
          <div className="flex items-center gap-2">
            <FilterControls
              roleFilter={roleFilter}
              statusFilter={statusFilter}
              typeFilter={typeFilter}
              onRoleChange={setRoleFilter}
              onStatusChange={setStatusFilter}
              onTypeChange={setTypeFilter}
            />
            {/* Instruction Flow Toggle */}
            <button
              onClick={() => setShowInstructionFlow(!showInstructionFlow)}
              className={`
                flex items-center gap-1.5
                px-2 py-1.5
                text-xs font-medium
                rounded-md
                border border-border
                transition-colors
                ${showInstructionFlow
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }
              `}
              title="Toggle Instruction Flow"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="5" r="3" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <circle cx="6" cy="19" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M12 12 L6 16" />
                <path d="M12 12 L18 16" />
              </svg>
              <span className="hidden sm:inline">Flow</span>
            </button>
          </div>
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 pt-3">
        {viewMode === 'panels' ? (
          <AgentPanels agents={filteredAgents} logs={logs} tasks={tasks} />
        ) : viewMode === 'kanban' ? (
          <KanbanView
            agents={filteredAgents}
            tasks={tasks}
            onMouseEnter={tooltip.handleMouseEnter}
            onMouseLeave={tooltip.handleMouseLeave}
            onTap={tooltip.handleTap}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {/* Active Workflows Section */}
            {agentsWithWorkflows.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  Active Workflows ({agentsWithWorkflows.length})
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {agentsWithWorkflows.map((agent) => (
                    <div key={agent.id} className="space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <AgentTypeBadge type={agent.agentType} size="xs" />
                        <span className="font-medium">{agent.name}</span>
                        {agent.currentTaskTitle && (
                          <span className="text-muted-foreground truncate">
                            - {agent.currentTaskTitle}
                          </span>
                        )}
                      </div>
                      {agent.currentWorkflow && (
                        <WorkflowProgressView workflow={agent.currentWorkflow} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent Logs Panel */}
            {showLogsPanel && (
              <AgentLogsPanel
                logs={logs}
                agentId={selectedAgentForLogs}
                isExpanded={true}
                onToggle={() => setShowLogsPanel(false)}
              />
            )}

            {/* Instruction Flow Diagram */}
            {showInstructionFlow && (
              <div className="bg-muted/30 rounded-lg p-3 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Instruction Flow</h3>
                  <button
                    onClick={() => setShowInstructionFlow(false)}
                    className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Close flow diagram"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="h-64 sm:h-80">
                  <InstructionFlow
                    agents={agents}
                    instructions={instructions}
                    className="h-full"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col lg:flex-row gap-4">
              {/* Agent Grid/List */}
              <div className="flex-1">
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filteredAgents.map((agent) => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        variant="default"
                        onMouseEnter={tooltip.handleMouseEnter}
                        onMouseLeave={tooltip.handleMouseLeave}
                        onTap={tooltip.handleTap}
                        onViewDetails={handleViewDetails}
                        onSendMessage={handleSendMessage}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAgents.map((agent) => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        variant="list"
                        onMouseEnter={tooltip.handleMouseEnter}
                        onMouseLeave={tooltip.handleMouseLeave}
                        onTap={tooltip.handleTap}
                        onViewDetails={handleViewDetails}
                        onSendMessage={handleSendMessage}
                      />
                    ))}
                  </div>
                )}
                {filteredAgents.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    {!isConnected ? (
                      <div className="space-y-3">
                        <div className="text-4xl">🔌</div>
                        <div className="font-medium">MCP Server に未接続</div>
                        <div className="text-sm">
                          設定ボタンからサーバーURLとトークンを設定して接続してください
                        </div>
                        <button
                          onClick={() => setIsConfigOpen(true)}
                          className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
                        >
                          サーバー設定を開く
                        </button>
                      </div>
                    ) : agents.length === 0 ? (
                      <div className="space-y-3">
                        <div className="text-4xl">🤖</div>
                        <div className="font-medium">エージェントが登録されていません</div>
                        <div className="text-sm">
                          Claude Code等からエージェントを登録してください
                        </div>
                      </div>
                    ) : (
                      'フィルター条件に一致するエージェントがありません'
                    )}
                  </div>
                )}
              </div>

              {/* Sidebar - Tasks & Activity */}
              <div className="lg:w-72 xl:w-80 space-y-4">
                <div className="bg-muted/30 rounded-lg p-3">
                  <TaskList tasks={tasks} onTaskClick={handleTaskClick} />
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <ActivityFeed activities={activities} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Agent Activity Panel */}
      <AgentActivityPanel
        interactions={interactions}
        isExpanded={isActivityPanelExpanded}
        onToggleExpanded={() => setIsActivityPanelExpanded(!isActivityPanelExpanded)}
        panelHeight={activityPanelHeight}
        onHeightChange={setActivityPanelHeight}
        minHeight={150}
        maxHeight={400}
      />

      {/* Manager Chat Modal - Unified group chat for all agents */}
      <ManagerChatModal
        isOpen={isChatOpen}
        onClose={() => {
          setIsChatOpen(false);
          setFocusTaskId(null);
        }}
        connectionState={server.connectionState}
        onCreateTask={handleCreateTask}
        onAssignTask={handleAssignTask}
        agents={agents}
        serverError={server.error}
        activities={activities}
        tasks={tasks}
        focusTaskId={focusTaskId}
      />

      {/* Agent Tooltip */}
      {tooltip.selectedAgent && (
        <AgentTooltip
          agent={tooltip.selectedAgent}
          visible={tooltip.isVisible}
          anchorRect={tooltip.anchorRect}
          onViewDetails={() => handleViewDetails(tooltip.selectedAgent!)}
          onSendMessage={() => handleSendMessage(tooltip.selectedAgent!)}
          onClose={tooltip.hideTooltip}
        />
      )}

      {/* Multi-Agent Config Modal */}
      <MultiAgentConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={server.config}
        onUpdateConfig={server.updateConfig}
        connections={server.connections}
        connectionState={server.connectionState}
        error={server.error}
        onAddServer={server.addServer}
        onUpdateServer={server.updateServer}
        onRemoveServer={server.removeServer}
        onConnectServer={server.connectServer}
        onDisconnectServer={server.disconnectServer}
        onConnectAllEnabled={server.connectAllEnabled}
        onDisconnectAll={server.disconnectAll}
      />

      {/* Task Creation Form Modal */}
      <TaskCreationForm
        isOpen={showTaskCreationForm}
        onClose={() => setShowTaskCreationForm(false)}
        onCreateTask={handleCreateTask}
        agents={agents}
      />
    </section>
    </TasksProvider>
  );
}
