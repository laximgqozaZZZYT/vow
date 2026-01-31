"use client";

/**
 * AgentsSection Component
 *
 * Main container for the Multi-Agent Dashboard section.
 * Provides views for:
 * - Agent grid with status monitoring
 * - Manager chat interface
 * - Task management
 * - Activity stream
 *
 * Connects to MCP Task Server for real-time agent monitoring.
 *
 * @module Section.Agents
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useHandedness } from '../contexts/HandednessContext';
import type { Agent, AgentTask, AgentActivity, AgentRole, AgentStatus } from '../types/agent.types';
import { ROLE_CONFIG, STATUS_CONFIG, TASK_STATUS_CONFIG, PRIORITY_CONFIG } from '../types/agent.types';
import {
  MOCK_AGENTS,
  MOCK_TASKS,
  MOCK_ACTIVITIES,
  MOCK_DASHBOARD_STATS,
  MOCK_AGENT_LOGS,
  MOCK_INTERACTIONS,
  MOCK_INSTRUCTIONS,
} from '../mocks/mockAgentData';
import AgentCard from './Widget.AgentCard';
import { AgentTooltip, useAgentTooltip } from './Widget.AgentTooltip';
import ManagerChatModal from './Modal.ManagerChat';
import MultiAgentConfigModal from './Modal.MultiAgentConfig';
import AgentPanels from './View.AgentPanels';
import AgentActivityPanel from './Widget.AgentActivityPanel';
import InstructionFlow from './Widget.InstructionFlow';
import { useMultiAgentServer, type DashboardStats, type ConnectionState } from '../hooks/useMultiAgentServer';

type ViewMode = 'grid' | 'list' | 'kanban' | 'panels';
type FilterRole = AgentRole | 'all';
type FilterStatus = AgentStatus | 'all';

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
}: {
  stats: DashboardStats | typeof MOCK_DASHBOARD_STATS | null;
  connectionState: ConnectionState;
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
 * Filter Controls Component
 */
function FilterControls({
  roleFilter,
  statusFilter,
  onRoleChange,
  onStatusChange,
}: {
  roleFilter: FilterRole;
  statusFilter: FilterStatus;
  onRoleChange: (role: FilterRole) => void;
  onStatusChange: (status: FilterStatus) => void;
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

  return (
    <div className="flex items-center gap-2">
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
  const getEventIcon = (eventType: AgentActivity['eventType']) => {
    switch (eventType) {
      case 'task_started':
        return '▶️';
      case 'task_completed':
        return '✅';
      case 'task_failed':
        return '❌';
      case 'agent_registered':
        return '➕';
      case 'agent_status_changed':
        return '🔄';
      default:
        return '📋';
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
      <h3 className="text-sm font-medium text-muted-foreground">Recent Activity</h3>
      <div className="space-y-1">
        {activities.slice(0, 5).map((activity) => (
          <div
            key={activity.id}
            className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors text-xs"
          >
            <span className="shrink-0">{getEventIcon(activity.eventType)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-medium">{activity.agentName}</span>
                {activity.taskTitle && (
                  <>
                    <span className="text-muted-foreground">-</span>
                    <span className="truncate text-muted-foreground">{activity.taskTitle}</span>
                  </>
                )}
              </div>
            </div>
            <span className="text-muted-foreground shrink-0">{formatTime(activity.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Task List Component
 */
function TaskList({ tasks }: { tasks: AgentTask[] }) {
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const pendingTasks = tasks.filter(t => t.status === 'pending');

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Active Tasks</h3>

      {/* In Progress */}
      {inProgressTasks.length > 0 && (
        <div className="space-y-1">
          {inProgressTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20"
            >
              <div className={`w-2 h-2 rounded-full ${TASK_STATUS_CONFIG[task.status].bgColor}`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{task.title}</div>
                <div className="text-xs text-muted-foreground">
                  {task.assignedAgentName && `Assigned to ${task.assignedAgentName}`}
                </div>
              </div>
              <span className={`text-xs ${PRIORITY_CONFIG[task.priority].color}`}>
                {task.priority}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pending */}
      {pendingTasks.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Pending ({pendingTasks.length})</div>
          {pendingTasks.slice(0, 3).map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
            >
              <div className={`w-2 h-2 rounded-full ${TASK_STATUS_CONFIG[task.status].bgColor}`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs truncate">{task.title}</div>
              </div>
              <span className={`text-xs ${PRIORITY_CONFIG[task.priority].color}`}>
                {task.priority}
              </span>
            </div>
          ))}
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
              <AgentCard
                key={agent.id}
                agent={agent}
                variant="compact"
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onTap={onTap}
              />
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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isActivityPanelExpanded, setIsActivityPanelExpanded] = useState(false);
  const [activityPanelHeight, setActivityPanelHeight] = useState(200);
  const [showInstructionFlow, setShowInstructionFlow] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Get auth token from Supabase session
  useEffect(() => {
    const getAuthToken = async () => {
      try {
        const { supabase } = await import('../../../lib/supabaseClient');
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          setAuthToken(session?.access_token ?? null);
        }
      } catch (e) {
        console.error('[AgentsSection] Failed to get auth token:', e);
      }
    };
    getAuthToken();
  }, []);

  // Tooltip hook for agent cards
  const tooltip = useAgentTooltip();

  // Multi-agent server hook with auth token for DynamoDB config storage
  const server = useMultiAgentServer({ authToken });

  // Use real data when connected, otherwise mock data
  const isConnected = server.connectionState === 'connected';
  const agents = isConnected ? server.agents : MOCK_AGENTS;
  const tasks = isConnected ? server.tasks : MOCK_TASKS;
  const activities = isConnected ? server.activities : MOCK_ACTIVITIES;
  const stats = isConnected ? server.stats : MOCK_DASHBOARD_STATS;
  const logs = MOCK_AGENT_LOGS; // Logs still from mock (server doesn't provide these yet)
  const interactions = MOCK_INTERACTIONS; // Interactions still from mock
  const instructions = MOCK_INSTRUCTIONS; // Instructions still from mock

  // Tooltip action handlers
  const handleViewDetails = useCallback((agent: Agent) => {
    console.log('View details for agent:', agent.id);
    tooltip.hideTooltip();
  }, [tooltip]);

  const handleSendMessage = useCallback((agent: Agent) => {
    console.log('Send message to agent:', agent.id);
    tooltip.hideTooltip();
    setIsChatOpen(true);
  }, [tooltip]);

  // Filter agents
  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      if (roleFilter !== 'all' && agent.role !== roleFilter) return false;
      if (statusFilter !== 'all' && agent.status !== statusFilter) return false;
      return true;
    });
  }, [agents, roleFilter, statusFilter]);

  return (
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
            )}
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
        <StatsBar stats={stats} connectionState={server.connectionState} />

        {/* Controls Row */}
        <div className={`flex items-center justify-between gap-2 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
          <div className="flex items-center gap-2">
            <FilterControls
              roleFilter={roleFilter}
              statusFilter={statusFilter}
              onRoleChange={setRoleFilter}
              onStatusChange={setStatusFilter}
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
                  <div className="text-center py-8 text-muted-foreground">
                    No agents match the selected filters
                  </div>
                )}
              </div>

              {/* Sidebar - Tasks & Activity */}
              <div className="lg:w-72 xl:w-80 space-y-4">
                <div className="bg-muted/30 rounded-lg p-3">
                  <TaskList tasks={tasks} />
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

      {/* Manager Chat Modal */}
      <ManagerChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        connectionState={server.connectionState}
        onCreateTask={server.createTask}
        serverError={server.error}
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
        connectionState={server.connectionState}
        error={server.error}
        onConnect={server.connect}
        onDisconnect={server.disconnect}
      />
    </section>
  );
}
