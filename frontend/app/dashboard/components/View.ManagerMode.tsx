"use client";

/**
 * ManagerModeView Component
 *
 * TASK-2.1: Manager mode display component for the multi-agent dashboard.
 * TASK-2.4: Template-based task creation flow with agent targeting.
 *
 * Features:
 * - Agent Status Bar (Widget.AgentStatusBar)
 * - Group Chat Timeline placeholder (TASK-3.1)
 * - Template Selector (Widget.TemplateSelector)
 * - Disconnected state UI
 * - Responsive layout
 * - Japanese/English locale support
 * - Template-based task creation with agent targeting
 * - Task creation feedback notifications
 *
 * @module View.ManagerMode
 */

import { memo, useCallback, useState } from 'react';
import type { Agent, AgentActivity, TaskPriority, AgentRole } from '../types/agent.types';
import type { TaskTemplate, AgentRole as TemplateAgentRole } from '../types/template.types';
import { AgentStatusBar } from './Widget.AgentStatusBar';
import { TemplateSelector } from './Widget.TemplateSelector';
import { fillTemplate } from '../data/taskTemplates';

// ============================================================================
// Types
// ============================================================================

/**
 * Task creation parameters passed to onCreateTask callback
 */
export interface TaskCreateParams {
  title: string;
  description: string;
  priority: TaskPriority;
  tags: string[];
  assignTo?: string;
}

/**
 * Task creation feedback message
 */
interface TaskFeedback {
  type: 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine the target agent for task assignment
 * TASK-2.4: Agent targeting logic
 *
 * Priority:
 * 1. Selected agent (if any)
 * 2. Agent matching template's requiredAgentRole (idle preferred)
 * 3. Manager fallback (if template allows)
 * 4. undefined (task will be unassigned)
 */
function determineTargetAgent(
  template: TaskTemplate,
  selectedAgentId: string | undefined,
  agents: Agent[]
): { agentId: string | undefined; reason: 'selected' | 'role_match' | 'fallback_manager' | 'none' } {
  // 1. Selected agent has highest priority
  if (selectedAgentId) {
    return { agentId: selectedAgentId, reason: 'selected' };
  }

  // 2. Find agent matching requiredAgentRole
  if (template.requiredAgentRole) {
    // Map template AgentRole to agent.types AgentRole (they should match)
    const requiredRole = template.requiredAgentRole as AgentRole;

    // Prefer idle agents
    const idleRoleAgent = agents.find(
      (a) => a.role === requiredRole && a.status === 'idle'
    );
    if (idleRoleAgent) {
      return { agentId: idleRoleAgent.id, reason: 'role_match' };
    }

    // Accept busy agent as fallback
    const busyRoleAgent = agents.find(
      (a) => a.role === requiredRole && a.status === 'busy'
    );
    if (busyRoleAgent) {
      return { agentId: busyRoleAgent.id, reason: 'role_match' };
    }
  }

  // 3. Fallback to manager if template allows
  if (template.fallbackToManager) {
    const manager = agents.find(
      (a) => a.role === 'manager' && a.status !== 'offline'
    );
    if (manager) {
      return { agentId: manager.id, reason: 'fallback_manager' };
    }
  }

  // 4. No suitable agent found
  return { agentId: undefined, reason: 'none' };
}

export interface ManagerModeViewProps {
  agents: Agent[];
  activities: AgentActivity[];
  onCreateTask: (task: TaskCreateParams) => void;
  onSelectAgent: (agentId: string) => void;
  selectedAgentId?: string;
  connectionState: 'connected' | 'connecting' | 'disconnected' | 'error';
  locale?: 'ja' | 'en';
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Disconnected State Component
 */
function DisconnectedState({
  connectionState,
  locale,
}: {
  connectionState: 'disconnected' | 'connecting' | 'error';
  locale: 'ja' | 'en';
}) {
  const labels = {
    ja: {
      disconnected: {
        title: 'MCP Server\u306B\u672A\u63A5\u7D9A',
        message: '\u30B5\u30FC\u30D0\u30FC\u8A2D\u5B9A\u304B\u3089MCP Task Server\u306B\u63A5\u7D9A\u3057\u3066\u304F\u3060\u3055\u3044',
      },
      connecting: {
        title: '\u63A5\u7D9A\u4E2D...',
        message: 'MCP Server\u306B\u63A5\u7D9A\u3057\u3066\u3044\u307E\u3059',
      },
      error: {
        title: '\u63A5\u7D9A\u30A8\u30E9\u30FC',
        message: '\u30B5\u30FC\u30D0\u30FC\u3078\u306E\u63A5\u7D9A\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002\u8A2D\u5B9A\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002',
      },
    },
    en: {
      disconnected: {
        title: 'Not Connected to MCP Server',
        message: 'Please connect to an MCP Task Server from server settings',
      },
      connecting: {
        title: 'Connecting...',
        message: 'Connecting to MCP Server',
      },
      error: {
        title: 'Connection Error',
        message: 'Failed to connect to server. Please check your settings.',
      },
    },
  };

  const t = labels[locale][connectionState];

  const icons: Record<typeof connectionState, string> = {
    disconnected: '\u{1F50C}', // plug
    connecting: '\u{23F3}',    // hourglass
    error: '\u{26A0}\u{FE0F}', // warning
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="text-5xl mb-4" role="img" aria-hidden="true">
        {icons[connectionState]}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {t.title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-md">
        {t.message}
      </p>
      {connectionState === 'connecting' && (
        <div className="mt-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

/**
 * Group Chat Timeline Placeholder Component (TASK-3.1)
 */
function GroupChatTimelinePlaceholder({
  activities,
  locale,
}: {
  activities: AgentActivity[];
  locale: 'ja' | 'en';
}) {
  const labels = {
    ja: {
      title: 'Group Chat Timeline',
      placeholder: '\u30E1\u30C3\u30BB\u30FC\u30B8\u304C\u3053\u3053\u306B\u8868\u793A\u3055\u308C\u307E\u3059',
      noActivity: '\u307E\u3060\u30A2\u30AF\u30C6\u30A3\u30D3\u30C6\u30A3\u304C\u3042\u308A\u307E\u305B\u3093',
    },
    en: {
      title: 'Group Chat Timeline',
      placeholder: 'Messages will appear here',
      noActivity: 'No activity yet',
    },
  };

  const t = labels[locale];

  // Format activity time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString(locale === 'ja' ? 'ja-JP' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get event icon
  const getEventIcon = (eventType: AgentActivity['eventType']) => {
    switch (eventType) {
      case 'task_started':
        return '\u25B6\u{FE0F}';
      case 'task_completed':
        return '\u2705';
      case 'task_failed':
        return '\u274C';
      case 'agent_registered':
        return '\u2795';
      case 'agent_status_changed':
        return '\u{1F504}';
      case 'task_created':
        return '\u{1F4DD}';
      case 'task_assigned':
        return '\u{1F4CB}';
      default:
        return '\u{1F4AC}';
    }
  };

  return (
    <div className="bg-muted/30 rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/50">
        <h3 className="text-sm font-medium text-foreground">{t.title}</h3>
      </div>

      {/* Timeline Content */}
      <div className="min-h-[200px] max-h-[400px] overflow-y-auto p-4">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[180px] text-muted-foreground">
            <div className="text-3xl mb-2">{"\u{1F4AC}"}</div>
            <p className="text-sm">{t.placeholder}</p>
            <p className="text-xs mt-1">{t.noActivity}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.slice(0, 20).map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                <span className="text-lg shrink-0" role="img" aria-hidden="true">
                  {getEventIcon(activity.eventType)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">
                      {activity.agentName || 'System'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {activity.eventType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {activity.taskTitle && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      &quot;{activity.taskTitle}&quot;
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatTime(activity.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Feedback Toast Component
 */
function FeedbackToast({
  feedback,
  locale,
  onDismiss,
}: {
  feedback: TaskFeedback;
  locale: 'ja' | 'en';
  onDismiss: () => void;
}) {
  const icons: Record<TaskFeedback['type'], string> = {
    success: '\u2705',  // checkmark
    warning: '\u26A0\uFE0F',  // warning
    error: '\u274C',  // cross
  };

  const bgColors: Record<TaskFeedback['type'], string> = {
    success: 'bg-green-500/10 border-green-500/30',
    warning: 'bg-yellow-500/10 border-yellow-500/30',
    error: 'bg-red-500/10 border-red-500/30',
  };

  const textColors: Record<TaskFeedback['type'], string> = {
    success: 'text-green-700 dark:text-green-300',
    warning: 'text-yellow-700 dark:text-yellow-300',
    error: 'text-red-700 dark:text-red-300',
  };

  return (
    <div
      className={`
        flex items-start gap-2 p-3 rounded-lg border
        ${bgColors[feedback.type]}
        animate-in slide-in-from-top-2 duration-200
      `}
      role="alert"
    >
      <span className="shrink-0" role="img" aria-hidden="true">
        {icons[feedback.type]}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${textColors[feedback.type]}`}>
          {feedback.message}
        </p>
        {feedback.details && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {feedback.details}
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={locale === 'ja' ? '\u9589\u3058\u308B' : 'Dismiss'}
      >
        <span aria-hidden="true">\u00D7</span>
      </button>
    </div>
  );
}

/**
 * Template Section Component
 * TASK-2.4: Template-based task creation with agent targeting
 */
function TemplateSection({
  onCreateTask,
  selectedAgentId,
  agents,
  locale,
  disabled,
}: {
  onCreateTask: (task: TaskCreateParams) => void;
  selectedAgentId?: string;
  agents: Agent[];
  locale: 'ja' | 'en';
  disabled: boolean;
}) {
  // Feedback state
  const [feedback, setFeedback] = useState<TaskFeedback | null>(null);

  // Auto-dismiss feedback after 5 seconds
  const showFeedback = useCallback((newFeedback: TaskFeedback) => {
    setFeedback(newFeedback);
    setTimeout(() => setFeedback(null), 5000);
  }, []);

  // Handle template selection with agent targeting
  const handleTemplateSelect = useCallback(
    (template: TaskTemplate, variables: Record<string, string | number>) => {
      try {
        // Apply fillTemplate to get title and description
        const filled = fillTemplate(template, variables);

        // Determine target agent using the targeting logic
        const { agentId, reason } = determineTargetAgent(template, selectedAgentId, agents);

        // Get agent name for feedback
        const targetAgent = agentId ? agents.find((a) => a.id === agentId) : null;
        const targetAgentName = targetAgent?.name;

        // Create task params
        const taskParams: TaskCreateParams = {
          title: filled.title,
          description: filled.description,
          priority: template.defaultPriority,
          tags: template.defaultTags,
          assignTo: agentId,
        };

        // Call onCreateTask
        onCreateTask(taskParams);

        // Show success feedback with agent assignment info
        const feedbackMessages = {
          ja: {
            success: '\u30BF\u30B9\u30AF\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F',
            assigned_selected: `\u9078\u629E\u3057\u305F\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u300C${targetAgentName}\u300D\u306B\u5272\u308A\u5F53\u3066\u307E\u3057\u305F`,
            assigned_role: `${template.requiredAgentRole}\u30ED\u30FC\u30EB\u306E\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u300C${targetAgentName}\u300D\u306B\u5272\u308A\u5F53\u3066\u307E\u3057\u305F`,
            assigned_manager: `\u30DE\u30CD\u30FC\u30B8\u30E3\u30FC\u300C${targetAgentName}\u300D\u306B\u30D5\u30A9\u30FC\u30EB\u30D0\u30C3\u30AF\u3057\u307E\u3057\u305F`,
            unassigned: '\u5272\u308A\u5F53\u3066\u306A\u3057\u3067\u4F5C\u6210\u3057\u307E\u3057\u305F',
            no_agent_warning: '\u9069\u5207\u306A\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F',
          },
          en: {
            success: 'Task created successfully',
            assigned_selected: `Assigned to selected agent "${targetAgentName}"`,
            assigned_role: `Assigned to ${template.requiredAgentRole} agent "${targetAgentName}"`,
            assigned_manager: `Fallback to manager "${targetAgentName}"`,
            unassigned: 'Created without assignment',
            no_agent_warning: 'No suitable agent found',
          },
        };

        const t = feedbackMessages[locale];
        let details: string;
        let feedbackType: TaskFeedback['type'] = 'success';

        switch (reason) {
          case 'selected':
            details = t.assigned_selected;
            break;
          case 'role_match':
            details = t.assigned_role;
            break;
          case 'fallback_manager':
            details = t.assigned_manager;
            feedbackType = 'warning';
            break;
          case 'none':
            details = template.requiredAgentRole ? t.no_agent_warning : t.unassigned;
            feedbackType = template.requiredAgentRole ? 'warning' : 'success';
            break;
        }

        showFeedback({
          type: feedbackType,
          message: t.success,
          details,
        });

      } catch (error) {
        console.error('[ManagerModeView] Failed to create task from template:', error);

        // Show error feedback
        const errorMessage = error instanceof Error ? error.message : String(error);
        showFeedback({
          type: 'error',
          message: locale === 'ja' ? '\u30BF\u30B9\u30AF\u4F5C\u6210\u306B\u5931\u6557\u3057\u307E\u3057\u305F' : 'Failed to create task',
          details: errorMessage,
        });
      }
    },
    [onCreateTask, selectedAgentId, agents, locale, showFeedback]
  );

  // Dismiss feedback
  const handleDismissFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  return (
    <div className="space-y-3">
      {/* Feedback Toast */}
      {feedback && (
        <FeedbackToast
          feedback={feedback}
          locale={locale}
          onDismiss={handleDismissFeedback}
        />
      )}

      {/* Template Selector */}
      <div className="bg-muted/30 rounded-lg border border-border p-4">
        <TemplateSelector
          onSelect={handleTemplateSelect}
          locale={locale}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ManagerModeView Component
 *
 * Main manager mode display with:
 * - Agent Status Bar showing all agents
 * - Group Chat Timeline (placeholder for TASK-3.1)
 * - Template Selector for quick task creation
 * - Disconnected state when MCP is not connected
 */
function ManagerModeViewComponent({
  agents,
  activities,
  onCreateTask,
  onSelectAgent,
  selectedAgentId,
  connectionState,
  locale = 'ja',
}: ManagerModeViewProps) {
  // Check if connected
  const isConnected = connectionState === 'connected';

  // If not connected, show disconnected state
  if (!isConnected) {
    return (
      <div className="flex flex-col h-full">
        <DisconnectedState connectionState={connectionState} locale={locale} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Agent Status Bar */}
      <div className="bg-muted/30 rounded-lg border border-border p-4">
        <AgentStatusBar
          agents={agents}
          onSelectAgent={onSelectAgent}
          selectedAgentId={selectedAgentId}
          locale={locale}
        />
      </div>

      {/* Group Chat Timeline */}
      <div className="flex-1 min-h-0">
        <GroupChatTimelinePlaceholder
          activities={activities}
          locale={locale}
        />
      </div>

      {/* Template Selector */}
      <TemplateSection
        onCreateTask={onCreateTask}
        selectedAgentId={selectedAgentId}
        agents={agents}
        locale={locale}
        disabled={!isConnected}
      />
    </div>
  );
}

export const ManagerModeView = memo(ManagerModeViewComponent);
export default ManagerModeView;
