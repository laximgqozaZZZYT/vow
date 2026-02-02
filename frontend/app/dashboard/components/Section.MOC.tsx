/**
 * Section.MOC - Multi-agent Orchestration Center
 *
 * AI Agents Hub with group chat as the main view.
 * Tabs: Chat, Tasks, Agents, History
 *
 * @module Section.MOC
 */

'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useMultiAgentServer, type ServerConnection } from '../hooks/useMultiAgentServer';
import { useMastraAgent, type MastraMessage } from '../hooks/useMastraAgent';
import { useMultiAgentChat, type AgentChatResponse, type MultiAgentMessage } from '../hooks/useMultiAgentChat';
import type { Goal, Habit } from '../types';

// Tab types
type TabId = 'chat' | 'tasks' | 'agents' | 'history';

interface TabConfig {
  id: TabId;
  label: string;
  labelJa: string;
  icon: string;
  badge?: number;
}

const TABS: TabConfig[] = [
  { id: 'chat', label: 'Chat', labelJa: 'チャット', icon: '💬' },
  { id: 'tasks', label: 'Tasks', labelJa: 'タスク', icon: '📋' },
  { id: 'agents', label: 'Agents', labelJa: 'エージェント', icon: '🤖' },
  { id: 'history', label: 'History', labelJa: '履歴', icon: '📜' },
];

// Message types for group chat
export interface GroupChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'user' | 'agent' | 'coach' | 'system';
  senderRole?: string;
  senderIcon?: string;
  content: string;
  timestamp: Date;
  taskId?: string;
  taskTitle?: string;
  suggestion?: {
    type: 'habit' | 'goal';
    data: Record<string, unknown>;
    actions: Array<{ id: string; label: string; variant: 'primary' | 'secondary' | 'ghost' }>;
  };
}

interface MOCSectionProps {
  goals?: Goal[];
  habits?: Habit[];
  onHabitCreated?: (habit: Habit) => void;
  onGoalCreated?: (goal: Goal) => void;
  locale?: 'ja' | 'en';
  authToken?: string;
}

// Suggestion state management
type SuggestionStatus = 'pending' | 'accepted' | 'snoozed' | 'dismissed' | 'loading' | 'error';

interface SuggestionState {
  status: SuggestionStatus;
  error?: string;
}

// Snoozed suggestion for later review
interface SnoozedSuggestion {
  id: string;
  messageId: string;
  type: 'habit' | 'goal';
  data: Record<string, unknown>;
  snoozedAt: Date;
}

// Task with extended info for detail view
interface TaskWithDetail {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
  serverId?: string;
}

// History filter options
type HistoryFilter = 'all' | 'user' | 'coach' | 'agent' | 'system';

// Multi-agent response aggregation
interface AgentResponse {
  agentId: string;
  agentName: string;
  agentRole: string;
  response: string;
  status: 'pending' | 'complete' | 'error';
  timestamp: Date;
}

interface AggregationSession {
  id: string;
  userQuery: string;
  responses: AgentResponse[];
  status: 'collecting' | 'summarizing' | 'complete' | 'error';
  summary?: string;
  startedAt: Date;
}

// Agent role icons
const ROLE_ICONS: Record<string, string> = {
  manager: '👔',
  developer: '💻',
  reviewer: '🔍',
  tester: '🧪',
  architect: '🏗️',
  devops: '🔧',
  analyst: '📊',
  coach: '🤖',
  user: '👤',
  system: '⚙️',
};

export function MOCSection({
  goals = [],
  habits = [],
  onHabitCreated,
  onGoalCreated,
  locale = 'ja',
  authToken,
}: MOCSectionProps) {
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>('manager'); // Manager is the default entry point

  // Suggestion states for tracking action status
  const [suggestionStates, setSuggestionStates] = useState<Record<string, SuggestionState>>({});
  const [snoozedSuggestions, setSnoozedSuggestions] = useState<SnoozedSuggestion[]>([]);

  // Task detail view state
  const [selectedTask, setSelectedTask] = useState<TaskWithDetail | null>(null);

  // History filter state
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historySearch, setHistorySearch] = useState('');

  // Multi-agent aggregation state
  const [aggregationSession, setAggregationSession] = useState<AggregationSession | null>(null);

  // Multi-agent server hook
  const server = useMultiAgentServer({ authToken });

  // Available agents for selection (AI Coach + connected MCP agents)
  interface SelectableAgent {
    id: string;
    name: string;
    role: string;
    icon: string;
    type: 'coach' | 'mcp-agent';
    serverId?: string;
    status?: string;
  }

  const availableAgents = useMemo((): SelectableAgent[] => {
    const agents: SelectableAgent[] = [
      // Manager is the top-level orchestrator (always available)
      {
        id: 'manager',
        name: locale === 'ja' ? 'マネージャー' : 'Manager',
        role: 'Manager',
        icon: ROLE_ICONS.manager,
        type: 'coach', // Uses the coach AI but acts as manager
      },
      // AI Coach is a callable sub-agent
      {
        id: 'coach',
        name: 'AI Coach',
        role: 'Coach',
        icon: ROLE_ICONS.coach,
        type: 'coach',
      },
    ];

    // Add connected MCP agents
    server.agents.forEach(agent => {
      agents.push({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        icon: ROLE_ICONS[agent.role.toLowerCase()] || ROLE_ICONS.developer,
        type: 'mcp-agent',
        serverId: agent.serverId,
        status: agent.status,
      });
    });

    // Add broadcast option if there are multiple agents
    if (agents.length > 2) {
      agents.push({
        id: 'broadcast',
        name: locale === 'ja' ? '全員' : 'Everyone',
        role: 'Broadcast',
        icon: '📢',
        type: 'mcp-agent',
      });
    }

    return agents;
  }, [server.agents, locale]);

  // Mastra agent hook for AI Coach
  const coachAgent = useMastraAgent({
    authToken,
    enableStreaming: true,
  });

  // Multi-agent chat hook for Manager mode
  const multiAgentChat = useMultiAgentChat({
    authToken,
    enableStreaming: true,
    locale,
    onAgentResponse: (response) => {
      // Add individual agent response to messages
      const agentMessage: GroupChatMessage = {
        id: `agent-${response.agentId}-${Date.now()}`,
        senderId: response.agentId,
        senderName: response.agentName,
        senderType: 'agent',
        senderRole: getAgentRole(response.agentId),
        senderIcon: getAgentIcon(response.agentId),
        content: response.content,
        timestamp: response.timestamp,
      };
      setMessages(prev => [...prev, agentMessage]);
    },
    onSummary: (summary) => {
      // Add manager summary to messages
      const summaryMessage: GroupChatMessage = {
        id: `manager-summary-${Date.now()}`,
        senderId: 'manager',
        senderName: locale === 'ja' ? 'マネージャー' : 'Manager',
        senderType: 'agent',
        senderRole: 'Manager',
        senderIcon: ROLE_ICONS.manager,
        content: summary,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, summaryMessage]);
    },
    onError: (error) => {
      console.error('Multi-agent chat error:', error);
    },
  });

  // Helper to get agent role from ID
  const getAgentRole = (agentId: string): string => {
    const roleMap: Record<string, string> = {
      'habit-coach': 'Habit Coach',
      'goal-planner': 'Goal Planner',
      'progress-tracker': 'Progress Tracker',
      'manager': 'Manager',
    };
    return roleMap[agentId] || 'Specialist';
  };

  // Helper to get agent icon from ID
  const getAgentIcon = (agentId: string): string => {
    const iconMap: Record<string, string> = {
      'habit-coach': '🎯',
      'goal-planner': '📋',
      'progress-tracker': '📊',
      'manager': '👔',
    };
    return iconMap[agentId] || '🤖';
  };

  // Connection status
  const isConnected = useMemo(() => {
    const connections = Array.from(server.connections.values());
    return connections.some(c => c.connectionState === 'connected');
  }, [server.connections]);

  const connectedAgentCount = useMemo(() => {
    const connections = Array.from(server.connections.values());
    return connections.reduce((sum, c) => sum + (c.agents?.length || 0), 0);
  }, [server.connections]);

  // Convert agent activities to chat messages
  useEffect(() => {
    const connections = Array.from(server.connections.values());
    connections.forEach(conn => {
      conn.activities?.forEach(activity => {
        const existingMsg = messages.find(m => m.id === `activity-${activity.id}`);
        if (!existingMsg) {
          // Determine role from agent name
          const agentNameLower = (activity.agentName || '').toLowerCase();
          let role = 'Developer';
          if (agentNameLower.includes('manager')) role = 'Manager';
          else if (agentNameLower.includes('reviewer')) role = 'Reviewer';
          else if (agentNameLower.includes('tester')) role = 'Tester';
          else if (agentNameLower.includes('architect')) role = 'Architect';
          else if (agentNameLower.includes('devops')) role = 'DevOps';
          else if (agentNameLower.includes('analyst')) role = 'Analyst';

          const newMessage: GroupChatMessage = {
            id: `activity-${activity.id}`,
            senderId: activity.agentId || 'system',
            senderName: activity.agentName || 'System',
            senderType: activity.agentId ? 'agent' : 'system',
            senderRole: activity.agentId ? role : undefined,
            senderIcon: ROLE_ICONS[role.toLowerCase()] || ROLE_ICONS.developer,
            content: formatActivityContent(activity),
            timestamp: new Date(activity.createdAt),
            taskId: activity.taskId,
            taskTitle: activity.taskTitle,
          };
          setMessages(prev => [...prev, newMessage]);
        }
      });
    });
  }, [server.connections, messages]);

  // Handle sending message
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim()) return;

    // Find selected agent info
    const targetAgent = availableAgents.find(a => a.id === selectedAgent);

    const userMessage: GroupChatMessage = {
      id: `user-${Date.now()}`,
      senderId: 'user',
      senderName: 'You',
      senderType: 'user',
      senderIcon: ROLE_ICONS.user,
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = inputValue;
    setInputValue('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    if (selectedAgent === 'manager') {
      // Manager orchestrates multiple Mastra agents using the new multi-agent API
      const sessionId = `agg-${Date.now()}`;

      // Show "collecting responses" message
      setMessages(prev => [...prev, {
        id: `manager-collecting-${sessionId}`,
        senderId: 'manager',
        senderName: locale === 'ja' ? 'マネージャー' : 'Manager',
        senderType: 'agent',
        senderRole: 'Manager',
        senderIcon: ROLE_ICONS.manager,
        content: locale === 'ja'
          ? '📡 Mastraマルチエージェントに問い合わせ中...'
          : '📡 Querying Mastra multi-agent system...',
        timestamp: new Date(),
      }]);

      // Initialize aggregation session for UI tracking
      const newSession: AggregationSession = {
        id: sessionId,
        userQuery: messageText,
        responses: [
          { agentId: 'habit-coach', agentName: 'Habit Coach', agentRole: 'Habit Coach', response: '', status: 'pending', timestamp: new Date() },
          { agentId: 'goal-planner', agentName: 'Goal Planner', agentRole: 'Goal Planner', response: '', status: 'pending', timestamp: new Date() },
          { agentId: 'progress-tracker', agentName: 'Progress Tracker', agentRole: 'Progress Tracker', response: '', status: 'pending', timestamp: new Date() },
        ],
        status: 'collecting',
        startedAt: new Date(),
      };
      setAggregationSession(newSession);

      try {
        // Use the new multi-agent chat API
        await multiAgentChat.sendMessage(messageText);

        // Update session status when complete
        setAggregationSession(prev => prev ? { ...prev, status: 'complete' } : null);
      } catch (error) {
        console.error('Failed to query multi-agent system:', error);
        setAggregationSession(prev => prev ? { ...prev, status: 'error' } : null);
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          senderId: 'system',
          senderName: 'System',
          senderType: 'system',
          senderIcon: ROLE_ICONS.system,
          content: locale === 'ja' ? '❌ マルチエージェントへの問い合わせに失敗しました' : '❌ Failed to query multi-agent system',
          timestamp: new Date(),
        }]);
      }
    } else if (selectedAgent === 'coach' || targetAgent?.type === 'coach') {
      // Send to AI Coach (habit/goal specialist)
      try {
        await coachAgent.sendMessage(messageText);
      } catch (error) {
        console.error('Failed to send message to coach:', error);
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          senderId: 'system',
          senderName: 'System',
          senderType: 'system',
          senderIcon: ROLE_ICONS.system,
          content: locale === 'ja' ? '❌ コーチへのメッセージ送信に失敗しました' : '❌ Failed to send message to coach',
          timestamp: new Date(),
        }]);
      }
    } else if (selectedAgent === 'broadcast') {
      // Broadcast to all MCP agents - create unassigned task
      const enabledServers = server.config.servers.filter(s => s.enabled);
      if (enabledServers.length > 0) {
        try {
          const task = await server.createTask(enabledServers[0].id, {
            title: messageText.slice(0, 100),
            description: messageText,
            priority: 'normal',
          });

          if (task) {
            setMessages(prev => [...prev, {
              id: `task-broadcast-${Date.now()}`,
              senderId: 'system',
              senderName: 'System',
              senderType: 'system',
              senderIcon: '📢',
              content: locale === 'ja'
                ? `📋 タスクを作成しました（エージェントが自動的に引き受けます）`
                : `📋 Task created (agents will pick it up)`,
              timestamp: new Date(),
              taskId: task.id,
              taskTitle: task.title,
            }]);
          }
        } catch (error) {
          console.error('Failed to broadcast task:', error);
          setMessages(prev => [...prev, {
            id: `error-${Date.now()}`,
            senderId: 'system',
            senderName: 'System',
            senderType: 'system',
            senderIcon: ROLE_ICONS.system,
            content: locale === 'ja' ? '❌ タスクの作成に失敗しました' : '❌ Failed to create task',
            timestamp: new Date(),
          }]);
        }
      }
    } else if (targetAgent?.type === 'mcp-agent' && targetAgent.serverId) {
      // Send to specific MCP agent (create task and assign)
      try {
        const task = await server.createTask(targetAgent.serverId, {
          title: messageText.slice(0, 100),
          description: messageText,
          priority: 'normal',
        });

        if (task) {
          // Assign task to specific agent
          await server.assignTask(targetAgent.serverId, task.id, targetAgent.id);

          // Add confirmation message
          setMessages(prev => [...prev, {
            id: `task-created-${Date.now()}`,
            senderId: 'system',
            senderName: 'System',
            senderType: 'system',
            senderIcon: ROLE_ICONS.system,
            content: locale === 'ja'
              ? `📋 タスクを ${targetAgent.name} に割り当てました`
              : `📋 Task assigned to ${targetAgent.name}`,
            timestamp: new Date(),
            taskId: task.id,
            taskTitle: task.title,
          }]);
        }
      } catch (error) {
        console.error('Failed to create/assign task:', error);
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          senderId: 'system',
          senderName: 'System',
          senderType: 'system',
          senderIcon: ROLE_ICONS.system,
          content: locale === 'ja' ? '❌ タスクの作成に失敗しました' : '❌ Failed to create task',
          timestamp: new Date(),
        }]);
      }
    } else {
      // No valid target - show error
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderType: 'system',
        senderIcon: ROLE_ICONS.system,
        content: locale === 'ja' ? '⚠️ エージェントが選択されていません' : '⚠️ No agent selected',
        timestamp: new Date(),
      }]);
    }
  }, [inputValue, selectedAgent, availableAgents, coachAgent, multiAgentChat, server, locale]);

  // Convert coach/manager messages to group chat format and update aggregation
  useEffect(() => {
    coachAgent.messages.forEach(msg => {
      if (msg.role === 'assistant') {
        const existingMsg = messages.find(m => m.id === `ai-${msg.id}`);
        if (!existingMsg) {
          // Determine if this was a manager or coach response based on the preceding user message
          const userMsgIndex = coachAgent.messages.findIndex(m => m.id === msg.id) - 1;
          const precedingUserMsg = userMsgIndex >= 0 ? coachAgent.messages[userMsgIndex] : null;
          const isManagerMode = precedingUserMsg?.content?.startsWith('[Manager Mode]');

          // If in aggregation mode, update the session instead of adding individual message
          if (isManagerMode && aggregationSession && aggregationSession.status === 'collecting') {
            setAggregationSession(prev => {
              if (!prev) return null;
              const updatedResponses = prev.responses.map(r =>
                r.agentId === 'coach'
                  ? { ...r, status: 'complete' as const, response: msg.content, timestamp: new Date() }
                  : r
              );

              // Check if all responses are collected
              const allComplete = updatedResponses.every(r => r.status === 'complete' || r.status === 'error');

              if (allComplete) {
                // Generate summary
                const successfulResponses = updatedResponses.filter(r => r.status === 'complete' && r.response);
                const summary = generateManagerSummary(prev.userQuery, successfulResponses, locale);

                // Add the summary message
                setMessages(prevMsgs => [...prevMsgs, {
                  id: `manager-summary-${prev.id}`,
                  senderId: 'manager',
                  senderName: locale === 'ja' ? 'マネージャー' : 'Manager',
                  senderType: 'agent',
                  senderRole: 'Manager',
                  senderIcon: ROLE_ICONS.manager,
                  content: summary,
                  timestamp: new Date(),
                  suggestion: msg.toolCalls?.length ? parseSuggestion(msg) : undefined,
                }]);

                return { ...prev, responses: updatedResponses, status: 'complete', summary };
              }

              return { ...prev, responses: updatedResponses };
            });
          } else {
            // Normal mode: add message directly
            const newMessage: GroupChatMessage = {
              id: `ai-${msg.id}`,
              senderId: isManagerMode ? 'manager' : 'coach',
              senderName: isManagerMode ? (locale === 'ja' ? 'マネージャー' : 'Manager') : 'AI Coach',
              senderType: isManagerMode ? 'agent' : 'coach',
              senderRole: isManagerMode ? 'Manager' : 'Coach',
              senderIcon: isManagerMode ? ROLE_ICONS.manager : ROLE_ICONS.coach,
              content: msg.content,
              timestamp: msg.timestamp || new Date(),
              suggestion: msg.toolCalls?.length ? parseSuggestion(msg) : undefined,
            };
            setMessages(prev => [...prev, newMessage]);
          }
        }
      }
    });
  }, [coachAgent.messages, messages, locale, aggregationSession]);

  // Quick actions
  const quickActions = [
    { id: 'status', label: '📊 Status', command: '現在のステータスを教えて' },
    { id: 'tasks', label: '📋 Tasks', command: '進行中のタスクを確認して' },
    { id: 'advice', label: '💡 Advice', command: '習慣について提案して' },
    { id: 'analyze', label: '📈 Analyze', command: '習慣の達成率を分析して' },
  ];

  const handleQuickAction = (command: string) => {
    setInputValue(command);
  };

  // Handle suggestion actions (accept, snooze, dismiss)
  const handleSuggestionAction = useCallback(async (
    messageId: string,
    actionId: string,
    suggestion: NonNullable<GroupChatMessage['suggestion']>
  ) => {
    // Update state to loading
    setSuggestionStates(prev => ({
      ...prev,
      [messageId]: { status: 'loading' },
    }));

    try {
      if (actionId === 'accept') {
        // Create habit or goal based on suggestion type
        if (suggestion.type === 'habit') {
          const habitData = {
            name: (suggestion.data.name as string) || 'New Habit',
            goalId: (suggestion.data.goalId as string) || goals[0]?.id || '',
            type: (suggestion.data.type as 'do' | 'avoid') || 'do',
            duration: suggestion.data.duration as number | undefined,
            notes: suggestion.data.reason as string | undefined,
          };

          // Import and call API
          const { createHabit } = await import('@/lib/api');
          const newHabit = await createHabit(habitData);

          if (newHabit && onHabitCreated) {
            onHabitCreated(newHabit as Habit);
          }

          // Add success message
          setMessages(prev => [...prev, {
            id: `system-${Date.now()}`,
            senderId: 'system',
            senderName: 'System',
            senderType: 'system',
            senderIcon: ROLE_ICONS.system,
            content: locale === 'ja'
              ? `✅ 習慣「${habitData.name}」を作成しました`
              : `✅ Created habit "${habitData.name}"`,
            timestamp: new Date(),
          }]);
        } else {
          // Create goal
          const goalData = {
            name: (suggestion.data.name as string) || 'New Goal',
            details: suggestion.data.reason as string | undefined,
            dueDate: suggestion.data.dueDate as string | undefined,
          };

          const { createGoal } = await import('@/lib/api');
          const newGoal = await createGoal(goalData);

          if (newGoal && onGoalCreated) {
            onGoalCreated(newGoal as Goal);
          }

          // Add success message
          setMessages(prev => [...prev, {
            id: `system-${Date.now()}`,
            senderId: 'system',
            senderName: 'System',
            senderType: 'system',
            senderIcon: ROLE_ICONS.system,
            content: locale === 'ja'
              ? `✅ 目標「${goalData.name}」を作成しました`
              : `✅ Created goal "${goalData.name}"`,
            timestamp: new Date(),
          }]);
        }

        setSuggestionStates(prev => ({
          ...prev,
          [messageId]: { status: 'accepted' },
        }));

      } else if (actionId === 'snooze') {
        // Save to snoozed suggestions for later
        const snoozedItem: SnoozedSuggestion = {
          id: `snoozed-${Date.now()}`,
          messageId,
          type: suggestion.type,
          data: suggestion.data,
          snoozedAt: new Date(),
        };

        setSnoozedSuggestions(prev => [...prev, snoozedItem]);

        // Add system message
        setMessages(prev => [...prev, {
          id: `system-${Date.now()}`,
          senderId: 'system',
          senderName: 'System',
          senderType: 'system',
          senderIcon: ROLE_ICONS.system,
          content: locale === 'ja'
            ? '⏭️ 提案を後で確認リストに追加しました'
            : '⏭️ Added suggestion to review later list',
          timestamp: new Date(),
        }]);

        setSuggestionStates(prev => ({
          ...prev,
          [messageId]: { status: 'snoozed' },
        }));

      } else if (actionId === 'dismiss') {
        // Just mark as dismissed
        setSuggestionStates(prev => ({
          ...prev,
          [messageId]: { status: 'dismissed' },
        }));

        // Add system message
        setMessages(prev => [...prev, {
          id: `system-${Date.now()}`,
          senderId: 'system',
          senderName: 'System',
          senderType: 'system',
          senderIcon: ROLE_ICONS.system,
          content: locale === 'ja'
            ? '❌ 提案を非表示にしました'
            : '❌ Dismissed suggestion',
          timestamp: new Date(),
        }]);
      }
    } catch (error) {
      console.error('Failed to process suggestion action:', error);
      setSuggestionStates(prev => ({
        ...prev,
        [messageId]: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }));

      // Add error message
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderType: 'system',
        senderIcon: ROLE_ICONS.system,
        content: locale === 'ja'
          ? '❌ 提案の処理に失敗しました'
          : '❌ Failed to process suggestion',
        timestamp: new Date(),
      }]);
    }
  }, [goals, locale, onHabitCreated, onGoalCreated]);

  // Handle task status change
  const handleTaskStatusChange = useCallback(async (
    task: TaskWithDetail,
    newStatus: string
  ) => {
    if (!task.serverId) return;

    try {
      // Note: This would need the actual API endpoint for updating task status
      // For now, show a message and refresh data
      setMessages(prev => [...prev, {
        id: `system-${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderType: 'system',
        senderIcon: ROLE_ICONS.system,
        content: locale === 'ja'
          ? `📋 タスク「${task.title}」のステータスを ${newStatus} に変更しました`
          : `📋 Changed task "${task.title}" status to ${newStatus}`,
        timestamp: new Date(),
      }]);

      // Refresh data
      await server.refreshData();
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  }, [server, locale]);

  // Handle retry for failed messages
  const handleRetry = useCallback(() => {
    if (coachAgent.error) {
      coachAgent.retry();
    }
  }, [coachAgent]);

  // Tab badges
  const tabsWithBadges = TABS.map(tab => ({
    ...tab,
    badge: tab.id === 'tasks'
      ? Array.from(server.connections.values()).reduce((sum, c) => sum + (c.tasks?.filter(t => t.status === 'in_progress').length || 0), 0)
      : tab.id === 'agents'
      ? connectedAgentCount
      : undefined,
  }));

  // Reference for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Reference for textarea (to reset height after sending)
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <section className="flex flex-col h-full rounded-lg border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header - Minimal and clean */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-sm shadow-sm">
            🤖
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {locale === 'ja' ? 'MOCセンター' : 'MOC Center'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={`inline-flex items-center gap-1 ${isConnected ? 'text-green-600 dark:text-green-400' : ''}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
                {isConnected ? 'Connected' : 'Offline'}
              </span>
              <span>•</span>
              <span>{connectedAgentCount + 2} agents</span>
            </div>
          </div>
        </div>
        {/* Settings button - placeholder for future config modal */}
        <button
          onClick={() => console.log('Settings clicked - config modal not yet implemented')}
          className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          title={locale === 'ja' ? '設定' : 'Settings'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* Tab Bar - Sleek design */}
      <div className="flex px-2 py-1 gap-1 border-b border-border bg-muted/30">
        {tabsWithBadges.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <span className="text-sm">{tab.icon}</span>
            <span>{locale === 'ja' ? tab.labelJa : tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full flex items-center justify-center ${
                activeTab === tab.id
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-primary/10 text-primary'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main Content Area - flex container for proper layout */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeTab === 'chat' ? (
          <>
            {/* Chat Messages - Scrollable area */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <GroupChatView
                messages={messages}
                isLoading={coachAgent.isStreaming}
                locale={locale}
                messagesEndRef={messagesEndRef}
                suggestionStates={suggestionStates}
                onSuggestionAction={handleSuggestionAction}
                error={coachAgent.error}
                onRetry={handleRetry}
              />
            </div>

            {/* Fixed Input Area at Bottom - flex-shrink-0 to prevent shrinking */}
            <div
              className="flex-shrink-0 border-t border-border bg-card"
              style={{
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }}
            >
              {/* Quick Actions - only when no messages */}
              {messages.length === 0 && (
                <div className="px-4 pt-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    {locale === 'ja' ? 'クイックアクション' : 'Quick Actions'}
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {quickActions.map(action => (
                      <button
                        key={action.id}
                        onClick={() => handleQuickAction(action.command)}
                        className="flex-shrink-0 px-3 py-2 text-sm bg-muted border border-border rounded-xl hover:bg-muted/80 text-foreground transition-all hover:shadow-sm"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Agent Selector Pills */}
              <div className="px-4 pt-2">
                <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
                  {availableAgents.map(agent => {
                    const isSelected = selectedAgent === agent.id;
                    const isOffline = agent.status === 'offline';

                    return (
                      <button
                        key={agent.id}
                        onClick={() => setSelectedAgent(agent.id)}
                        disabled={isOffline}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all flex-shrink-0 ${
                          isSelected
                            ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30 ring-offset-1 ring-offset-background scale-105'
                            : isOffline
                            ? 'bg-muted text-muted-foreground/50 cursor-not-allowed opacity-60'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:scale-102'
                        }`}
                      >
                        <span className={isSelected ? 'animate-pulse' : ''}>{agent.icon}</span>
                        <span className="max-w-[80px] truncate">{agent.name}</span>
                        {agent.type === 'mcp-agent' && agent.id !== 'broadcast' && (
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            agent.status === 'idle' ? 'bg-green-400' :
                            agent.status === 'busy' ? 'bg-yellow-400 animate-pulse' :
                            'bg-muted-foreground'
                          }`} />
                        )}
                        {isOffline && (
                          <span className="text-[10px] text-muted-foreground/70">offline</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Input Container */}
              <div className="px-4 pb-3 md:pb-4">
                <div className="relative flex items-end gap-2 p-2 bg-muted rounded-2xl border border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  {/* Text Input */}
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      // Auto-resize
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`${availableAgents.find(a => a.id === selectedAgent)?.name || 'Manager'} ${locale === 'ja' ? 'にメッセージ...' : '- Message...'}`}
                    rows={1}
                    className="flex-1 px-3 py-2 bg-transparent text-sm text-foreground placeholder-muted-foreground focus:outline-none resize-none max-h-[120px]"
                    style={{ minHeight: '40px' }}
                  />

                  {/* Send Button */}
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || coachAgent.isStreaming}
                    className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      inputValue.trim() && !coachAgent.isStreaming
                        ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    {coachAgent.isStreaming ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Keyboard hint - hidden on mobile */}
                <p className="hidden md:block text-[10px] text-muted-foreground mt-1.5 text-center">
                  {locale === 'ja' ? 'Enter で送信 • Shift+Enter で改行' : 'Enter to send • Shift+Enter for new line'}
                </p>
              </div>

              {/* Mobile bottom spacer - accounts for bottom nav bar (approx 70px) */}
              <div className="block md:hidden h-[70px]" />
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'tasks' && (
              <TaskListView
                connections={server.connections}
                locale={locale}
                onStatusChange={handleTaskStatusChange}
              />
            )}
            {activeTab === 'agents' && (
              <AgentListView
                connections={server.connections}
                locale={locale}
                onSelectAgent={(agentId) => {
                  setSelectedAgent(agentId);
                  setActiveTab('chat');
                }}
                selectedAgentId={selectedAgent}
              />
            )}
            {activeTab === 'history' && (
              <HistoryView
                messages={messages}
                locale={locale}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// Helper functions
function formatActivityContent(activity: { eventType: string; details?: Record<string, unknown> }): string {
  const details = activity.details || {};
  switch (activity.eventType) {
    case 'task_created':
      return `📋 タスク作成: ${details.title || 'New Task'}`;
    case 'task_started':
      return `▶️ タスク開始: ${details.title || 'Task'}`;
    case 'task_completed':
      return `✅ タスク完了: ${details.title || 'Task'}`;
    case 'agent_registered':
      return `🤖 エージェント登録: ${details.name || 'Agent'}`;
    case 'agent_status_changed':
      return `📊 ステータス変更: ${details.status || 'unknown'}`;
    default:
      return `📝 ${activity.eventType}`;
  }
}

function parseSuggestion(msg: MastraMessage): GroupChatMessage['suggestion'] | undefined {
  // Parse tool calls for suggestions
  if (!msg.toolCalls?.length) return undefined;

  const suggestionCall = msg.toolCalls.find(tc =>
    tc.toolName === 'suggest_goals' || tc.toolName === 'create_habit_suggestion'
  );

  if (!suggestionCall) return undefined;

  return {
    type: suggestionCall.toolName === 'suggest_goals' ? 'goal' : 'habit',
    data: suggestionCall.input as Record<string, unknown>,
    actions: [
      { id: 'accept', label: '✅ 採用', variant: 'primary' },
      { id: 'snooze', label: '⏭️ 後で', variant: 'secondary' },
      { id: 'dismiss', label: '❌ 不要', variant: 'ghost' },
    ],
  };
}

/**
 * Generate a Manager summary from multiple agent responses
 */
function generateManagerSummary(
  userQuery: string,
  responses: AgentResponse[],
  locale: 'ja' | 'en'
): string {
  if (responses.length === 0) {
    return locale === 'ja'
      ? '❌ エージェントからの応答がありませんでした。'
      : '❌ No responses received from agents.';
  }

  if (responses.length === 1) {
    // Single response - just pass through with attribution
    const r = responses[0];
    return locale === 'ja'
      ? `📋 **${r.agentName}からの回答:**\n\n${r.response}`
      : `📋 **Response from ${r.agentName}:**\n\n${r.response}`;
  }

  // Multiple responses - create a summary
  const header = locale === 'ja'
    ? `📋 **${responses.length}人のエージェントからの回答をまとめました:**\n\n`
    : `📋 **Summary from ${responses.length} agents:**\n\n`;

  const responseBlocks = responses.map((r) => {
    const roleIcon = ROLE_ICONS[r.agentRole.toLowerCase()] || '🤖';
    return locale === 'ja'
      ? `**${roleIcon} ${r.agentName}:**\n${r.response}`
      : `**${roleIcon} ${r.agentName}:**\n${r.response}`;
  }).join('\n\n---\n\n');

  // Add a synthesis section
  const synthesis = locale === 'ja'
    ? '\n\n**💡 総括:** 上記のエージェントからの情報を参考に、ご質問にお答えしました。追加の質問があればお知らせください。'
    : '\n\n**💡 Synthesis:** The above responses from our agents address your query. Let me know if you have any follow-up questions.';

  return header + responseBlocks + synthesis;
}

// Sub-components

interface GroupChatViewProps {
  messages: GroupChatMessage[];
  isLoading: boolean;
  locale: 'ja' | 'en';
  messagesEndRef?: React.RefObject<HTMLDivElement | null>;
  suggestionStates?: Record<string, SuggestionState>;
  onSuggestionAction?: (messageId: string, actionId: string, suggestion: NonNullable<GroupChatMessage['suggestion']>) => void;
  error?: Error | null;
  onRetry?: () => void;
}

function GroupChatView({ messages, isLoading, locale, messagesEndRef, suggestionStates, onSuggestionAction, error, onRetry }: GroupChatViewProps) {
  return (
    <div className="flex flex-col min-h-full p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <div className="text-center max-w-md px-6">
            {/* Welcome illustration */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <span className="text-4xl">💬</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {locale === 'ja' ? 'MOCセンターへようこそ' : 'Welcome to MOC Center'}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {locale === 'ja'
                ? 'マネージャーやAIコーチと会話して、習慣の管理やタスクの実行をサポートしてもらいましょう。'
                : 'Chat with Manager or AI Coach to get help with habit management and task execution.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium">
                👔 {locale === 'ja' ? 'マネージャー' : 'Manager'}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                🤖 AI Coach
              </span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {messages.map((msg, index) => (
            <ChatMessageBubble
              key={msg.id}
              message={msg}
              locale={locale}
              isFirstInGroup={index === 0 || messages[index - 1]?.senderId !== msg.senderId}
              isLastInGroup={index === messages.length - 1 || messages[index + 1]?.senderId !== msg.senderId}
              suggestionState={suggestionStates?.[msg.id]}
              onSuggestionAction={onSuggestionAction}
            />
          ))}
        </>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-lg shadow-md flex-shrink-0">
            🤖
          </div>
          <div className="flex items-center gap-2 px-4 py-3 bg-muted rounded-2xl rounded-tl-sm">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm text-muted-foreground ml-2">
              {locale === 'ja' ? '考え中...' : 'Thinking...'}
            </span>
          </div>
        </div>
      )}

      {/* Error indicator with retry button */}
      {error && !isLoading && (
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white text-lg shadow-md flex-shrink-0">
            ⚠️
          </div>
          <div className="flex flex-col gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl rounded-tl-sm max-w-[70%]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-red-700 dark:text-red-300">
                {error.message.includes('API_KEY_REQUIRED') || error.message.includes('APIキーが設定されていません')
                  ? (locale === 'ja' ? 'APIキーの設定が必要です' : 'API key configuration required')
                  : (locale === 'ja' ? 'エラーが発生しました' : 'An error occurred')}
              </span>
            </div>
            <p className="text-xs text-red-600 dark:text-red-400">
              {error.message.includes('API_KEY_REQUIRED') || error.message.includes('APIキーが設定されていません')
                ? (locale === 'ja'
                    ? 'MOC機能を使用するには、設定画面でOpenAI APIキーを登録するか、有料プランにご加入ください。'
                    : 'To use MOC features, please set up your OpenAI API key in settings or subscribe to a premium plan.')
                : error.message}
            </p>
            {(error.message.includes('API_KEY_REQUIRED') || error.message.includes('APIキーが設定されていません')) ? (
              <a
                href="/settings"
                className="self-start flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {locale === 'ja' ? '設定画面を開く' : 'Open Settings'}
              </a>
            ) : onRetry && (
              <button
                onClick={onRetry}
                className="self-start flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-100 dark:bg-red-800/50 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {locale === 'ja' ? '再試行' : 'Retry'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
}

interface ChatMessageBubbleProps {
  message: GroupChatMessage;
  locale: 'ja' | 'en';
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  suggestionState?: SuggestionState;
  onSuggestionAction?: (messageId: string, actionId: string, suggestion: NonNullable<GroupChatMessage['suggestion']>) => void;
}

function ChatMessageBubble({ message, locale, isFirstInGroup = true, isLastInGroup = true, suggestionState, onSuggestionAction }: ChatMessageBubbleProps) {
  const isUser = message.senderType === 'user';

  // Sender type specific styling with gradients
  const senderStyles = {
    user: {
      avatar: 'bg-gradient-to-br from-blue-500 to-blue-600',
      bubble: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white',
      name: 'text-blue-600 dark:text-blue-400',
    },
    coach: {
      avatar: 'bg-gradient-to-br from-purple-500 to-indigo-600',
      bubble: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm border border-gray-100 dark:border-gray-700',
      name: 'text-purple-600 dark:text-purple-400',
    },
    agent: {
      avatar: 'bg-gradient-to-br from-amber-500 to-orange-500',
      bubble: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm border border-gray-100 dark:border-gray-700',
      name: 'text-amber-600 dark:text-amber-400',
    },
    system: {
      avatar: 'bg-gray-400',
      bubble: 'bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 text-center italic',
      name: 'text-gray-500 dark:text-gray-400',
    },
  };

  const styles = senderStyles[message.senderType] || senderStyles.agent;

  // Role badge colors with better contrast
  const roleBadgeColors: Record<string, string> = {
    manager: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    developer: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    reviewer: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    tester: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    architect: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    devops: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    analyst: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    coach: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  };

  // System messages are displayed differently
  if (message.senderType === 'system') {
    return (
      <div className="flex justify-center my-2">
        <div className={`px-4 py-2 rounded-full ${styles.bubble} text-xs`}>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} ${!isLastInGroup ? 'mb-1' : ''}`}>
      {/* Avatar - only show for first message in group */}
      {isFirstInGroup ? (
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg text-white shadow-md ${styles.avatar}`}>
          {message.senderIcon || (isUser ? '👤' : '🤖')}
        </div>
      ) : (
        <div className="w-10 flex-shrink-0" /> /* Spacer */
      )}

      {/* Message Content */}
      <div className={`flex flex-col max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Sender Info - only show for first message in group */}
        {isFirstInGroup && (
          <div className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : ''}`}>
            <span className={`text-xs font-semibold ${styles.name}`}>
              {message.senderName}
            </span>
            {message.senderRole && message.senderType !== 'user' && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${roleBadgeColors[message.senderRole.toLowerCase()] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                {message.senderRole}
              </span>
            )}
          </div>
        )}

        {/* Message Bubble */}
        <div className={`px-4 py-2.5 ${styles.bubble} ${
          isUser
            ? `rounded-2xl ${isFirstInGroup ? 'rounded-tr-md' : ''} ${isLastInGroup ? '' : 'rounded-br-md'}`
            : `rounded-2xl ${isFirstInGroup ? 'rounded-tl-md' : ''} ${isLastInGroup ? '' : 'rounded-bl-md'}`
        }`}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
        </div>

        {/* Task reference */}
        {message.taskId && isLastInGroup && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
            <span>📋</span>
            <span>{message.taskTitle || message.taskId}</span>
          </div>
        )}

        {/* Timestamp - only show for last message in group */}
        {isLastInGroup && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
            {formatTime(message.timestamp)}
          </span>
        )}

        {/* Suggestion Card */}
        {message.suggestion && (
          <SuggestionCard
            messageId={message.id}
            suggestion={message.suggestion}
            locale={locale}
            state={suggestionState}
            onAction={onSuggestionAction}
          />
        )}
      </div>
    </div>
  );
}

interface SuggestionCardProps {
  messageId: string;
  suggestion: NonNullable<GroupChatMessage['suggestion']>;
  locale: 'ja' | 'en';
  state?: SuggestionState;
  onAction?: (messageId: string, actionId: string, suggestion: NonNullable<GroupChatMessage['suggestion']>) => void;
}

function SuggestionCard({ messageId, suggestion, locale, state, onAction }: SuggestionCardProps) {
  const data = suggestion.data;
  const isHabit = suggestion.type === 'habit';
  const status = state?.status || 'pending';

  // If already processed, show status
  if (status === 'accepted' || status === 'snoozed' || status === 'dismissed') {
    const statusIcons = {
      accepted: '✅',
      snoozed: '⏭️',
      dismissed: '❌',
    };
    const statusLabels = {
      accepted: locale === 'ja' ? '採用済み' : 'Accepted',
      snoozed: locale === 'ja' ? '後で確認' : 'Snoozed',
      dismissed: locale === 'ja' ? '不要' : 'Dismissed',
    };
    const statusColors = {
      accepted: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      snoozed: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
      dismissed: 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60',
    };

    return (
      <div className={`mt-2 p-3 rounded-lg shadow-sm max-w-sm border ${statusColors[status]}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{statusIcons[status]}</span>
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {(data.name as string) || (locale === 'ja' ? '提案' : 'Suggestion')}
            </span>
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
              {statusLabels[status]}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 p-3 bg-card border border-border rounded-lg shadow-sm max-w-sm">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-lg">{isHabit ? '📝' : '🎯'}</span>
        <div>
          <h4 className="font-medium text-foreground">
            {(data.name as string) || (locale === 'ja' ? '提案' : 'Suggestion')}
          </h4>
          {typeof data.frequency === 'string' && data.frequency && (
            <p className="text-xs text-muted-foreground">
              {locale === 'ja' ? '頻度' : 'Frequency'}: {data.frequency}
            </p>
          )}
        </div>
      </div>
      {typeof data.reason === 'string' && data.reason && (
        <p className="text-sm text-muted-foreground mb-3">
          {'💡 '}{data.reason}
        </p>
      )}

      {/* Error message */}
      {status === 'error' && state?.error && (
        <p className="text-xs text-red-600 dark:text-red-400 mb-2">
          ⚠️ {state.error}
        </p>
      )}

      <div className="flex gap-2">
        {suggestion.actions.map(action => (
          <button
            key={action.id}
            onClick={() => onAction?.(messageId, action.id, suggestion)}
            disabled={status === 'loading'}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              action.variant === 'primary'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : action.variant === 'secondary'
                ? 'bg-muted text-foreground hover:bg-muted/80'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {status === 'loading' && action.variant === 'primary' ? (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {locale === 'ja' ? '処理中...' : 'Processing...'}
              </span>
            ) : (
              action.label
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TaskListViewProps {
  connections: Map<string, ServerConnection>;
  locale: 'ja' | 'en';
  onTaskClick?: (task: TaskWithDetail) => void;
  onStatusChange?: (task: TaskWithDetail, newStatus: string) => void;
}

function TaskListView({ connections, locale, onTaskClick, onStatusChange }: TaskListViewProps) {
  const [selectedTask, setSelectedTask] = useState<TaskWithDetail | null>(null);

  // Convert connection tasks to TaskWithDetail format
  const allTasks: TaskWithDetail[] = [];
  connections.forEach((conn, serverId) => {
    conn.tasks.forEach(t => {
      allTasks.push({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assignedTo: t.assignedTo || undefined,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        serverId,
      });
    });
  });

  const inProgress = allTasks.filter(t => t.status === 'in_progress');
  const pending = allTasks.filter(t => t.status === 'pending');
  const completed = allTasks.filter(t => t.status === 'completed').slice(0, 5);

  const handleTaskClick = (task: TaskWithDetail) => {
    setSelectedTask(task);
    onTaskClick?.(task);
  };

  const handleCloseModal = () => {
    setSelectedTask(null);
  };

  const handleStatusChange = (newStatus: string) => {
    if (selectedTask) {
      onStatusChange?.(selectedTask, newStatus);
      setSelectedTask(null);
    }
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* In Progress */}
      <TaskSection
        title={locale === 'ja' ? '🔄 進行中' : '🔄 In Progress'}
        tasks={inProgress}
        locale={locale}
        onTaskClick={handleTaskClick}
      />

      {/* Pending */}
      <TaskSection
        title={locale === 'ja' ? '⏳ 待機中' : '⏳ Pending'}
        tasks={pending}
        locale={locale}
        onTaskClick={handleTaskClick}
      />

      {/* Completed */}
      <TaskSection
        title={locale === 'ja' ? '✅ 完了 (最近)' : '✅ Completed (Recent)'}
        tasks={completed}
        locale={locale}
        onTaskClick={handleTaskClick}
      />

      {allTasks.length === 0 && (
        <div className="text-center text-muted-foreground py-8">
          <span className="text-3xl mb-2 block">📋</span>
          <p>{locale === 'ja' ? 'タスクはありません' : 'No tasks'}</p>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          locale={locale}
          onClose={handleCloseModal}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

interface TaskSectionProps {
  title: string;
  tasks: TaskWithDetail[];
  locale: 'ja' | 'en';
  onTaskClick?: (task: TaskWithDetail) => void;
}

function TaskSection({ title, tasks, locale, onTaskClick }: TaskSectionProps) {
  if (tasks.length === 0) return null;

  const priorityColors: Record<string, string> = {
    urgent: 'text-red-600 dark:text-red-400',
    high: 'text-orange-600 dark:text-orange-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    low: 'text-gray-600 dark:text-gray-400',
  };

  const priorityBgColors: Record<string, string> = {
    urgent: 'bg-red-100 dark:bg-red-900/20',
    high: 'bg-orange-100 dark:bg-orange-900/20',
    medium: 'bg-yellow-100 dark:bg-yellow-900/20',
    low: 'bg-gray-100 dark:bg-gray-800/50',
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-2">
        {title} ({tasks.length})
      </h3>
      <div className="space-y-2">
        {tasks.map(task => (
          <div
            key={task.id}
            onClick={() => onTaskClick?.(task)}
            className="p-3 bg-muted rounded-lg border border-border cursor-pointer hover:bg-muted/80 hover:border-primary/50 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground group-hover:text-primary transition-colors">{task.title}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${priorityBgColors[task.priority] || priorityBgColors.medium} ${priorityColors[task.priority] || priorityColors.medium}`}>
                {task.priority}
              </span>
            </div>
            {task.assignedTo && (
              <p className="text-xs text-muted-foreground mt-1">
                {locale === 'ja' ? '担当' : 'Assigned'}: {task.assignedTo}
              </p>
            )}
            {/* Click hint */}
            <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {locale === 'ja' ? '詳細を見る' : 'View details'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Task Detail Modal Component
interface TaskDetailModalProps {
  task: TaskWithDetail;
  locale: 'ja' | 'en';
  onClose: () => void;
  onStatusChange?: (newStatus: string) => void;
}

function TaskDetailModal({ task, locale, onClose, onStatusChange }: TaskDetailModalProps) {
  const [newStatus, setNewStatus] = useState(task.status);

  const statusOptions = [
    { value: 'pending', label: locale === 'ja' ? '待機中' : 'Pending', icon: '⏳' },
    { value: 'in_progress', label: locale === 'ja' ? '進行中' : 'In Progress', icon: '🔄' },
    { value: 'completed', label: locale === 'ja' ? '完了' : 'Completed', icon: '✅' },
    { value: 'cancelled', label: locale === 'ja' ? 'キャンセル' : 'Cancelled', icon: '❌' },
  ];

  const priorityLabels: Record<string, { ja: string; en: string }> = {
    urgent: { ja: '緊急', en: 'Urgent' },
    high: { ja: '高', en: 'High' },
    medium: { ja: '中', en: 'Medium' },
    low: { ja: '低', en: 'Low' },
  };

  const handleSave = () => {
    if (newStatus !== task.status) {
      onStatusChange?.(newStatus);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">
            {locale === 'ja' ? 'タスク詳細' : 'Task Details'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {locale === 'ja' ? 'タイトル' : 'Title'}
            </label>
            <p className="mt-1 text-foreground font-medium">{task.title}</p>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {locale === 'ja' ? '説明' : 'Description'}
              </label>
              <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
            </div>
          )}

          {/* Status Selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {locale === 'ja' ? 'ステータス' : 'Status'}
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setNewStatus(option.value)}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-sm transition-all ${
                    newStatus === option.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted text-muted-foreground hover:border-primary/50 hover:bg-muted/80'
                  }`}
                >
                  <span>{option.icon}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Meta Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {locale === 'ja' ? '優先度' : 'Priority'}
              </label>
              <p className="mt-1 text-sm text-foreground">
                {priorityLabels[task.priority]?.[locale] || task.priority}
              </p>
            </div>
            {task.assignedTo && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {locale === 'ja' ? '担当者' : 'Assigned To'}
                </label>
                <p className="mt-1 text-sm text-foreground">{task.assignedTo}</p>
              </div>
            )}
          </div>

          {/* Timestamps */}
          {task.createdAt && (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {locale === 'ja' ? '作成日時' : 'Created'}
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(task.createdAt).toLocaleString(locale === 'ja' ? 'ja-JP' : 'en-US')}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {locale === 'ja' ? 'キャンセル' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={newStatus === task.status}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {locale === 'ja' ? '保存' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AgentListViewProps {
  connections: Map<string, ServerConnection>;
  locale: 'ja' | 'en';
  onSelectAgent?: (agentId: string) => void;
  selectedAgentId?: string;
}

function AgentListView({ connections, locale, onSelectAgent, selectedAgentId }: AgentListViewProps) {
  const allAgents = Array.from(connections.values()).flatMap(c => c.agents || []);
  const allTasks = Array.from(connections.values()).flatMap(c => c.tasks || []);

  // Get current task for an agent
  const getAgentCurrentTask = (agentId: string) => {
    return allTasks.find(t => t.assignedTo === agentId && t.status === 'in_progress');
  };

  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['manager']));

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const statusColors: Record<string, string> = {
    idle: 'bg-green-500',
    busy: 'bg-yellow-500',
    offline: 'bg-gray-400',
  };

  const statusLabels: Record<string, { ja: string; en: string }> = {
    idle: { ja: '待機中', en: 'Idle' },
    busy: { ja: '処理中', en: 'Busy' },
    offline: { ja: 'オフライン', en: 'Offline' },
  };

  // Agent tooltip component
  const AgentTooltip = ({ agentId, agentName, status, currentTask }: {
    agentId: string;
    agentName: string;
    status: string;
    currentTask?: { id: string; title: string } | null;
  }) => (
    <div className="absolute z-50 left-full ml-2 top-0 w-64 p-3 bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-xl border border-gray-700 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${statusColors[status.toLowerCase()] || statusColors.offline}`} />
        <span className="font-medium">{agentName}</span>
      </div>
      <div className="space-y-1 text-gray-300">
        <p><span className="text-gray-500">{locale === 'ja' ? 'ステータス' : 'Status'}:</span> {statusLabels[status.toLowerCase()]?.[locale] || status}</p>
        {currentTask ? (
          <p><span className="text-gray-500">{locale === 'ja' ? '実行中タスク' : 'Current Task'}:</span> {currentTask.title}</p>
        ) : (
          <p className="text-gray-500 italic">{locale === 'ja' ? 'タスクなし' : 'No active task'}</p>
        )}
      </div>
      {/* Arrow */}
      <div className="absolute left-0 top-3 -translate-x-full">
        <div className="border-8 border-transparent border-r-gray-900 dark:border-r-gray-800" />
      </div>
    </div>
  );

  // Tree node component
  const TreeNode = ({
    id,
    name,
    role,
    icon,
    status,
    gradient,
    children,
    level = 0,
    description,
    badge,
  }: {
    id: string;
    name: string;
    role: string;
    icon: string;
    status: string;
    gradient: string;
    children?: React.ReactNode;
    level?: number;
    description?: string;
    badge?: { text: string; color: string };
  }) => {
    const isExpanded = expandedNodes.has(id);
    const isSelected = selectedAgentId === id;
    const hasChildren = !!children;
    const currentTask = getAgentCurrentTask(id);
    const isHovered = hoveredAgent === id;

    return (
      <div className="relative">
        {/* Connection line */}
        {level > 0 && (
          <div
            className="absolute left-6 -top-3 w-px h-3 bg-gray-300 dark:bg-gray-600"
            style={{ marginLeft: (level - 1) * 24 }}
          />
        )}

        <div
          className="relative"
          style={{ marginLeft: level * 24 }}
        >
          {/* Horizontal connector */}
          {level > 0 && (
            <div className="absolute left-0 top-6 w-4 h-px bg-gray-300 dark:bg-gray-600 -translate-x-4" />
          )}

          <div
            className={`relative flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
              isSelected
                ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            onClick={() => onSelectAgent?.(id)}
            onMouseEnter={() => setHoveredAgent(id)}
            onMouseLeave={() => setHoveredAgent(null)}
          >
            {/* Expand/collapse button */}
            {hasChildren && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleNode(id); }}
                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            {!hasChildren && <div className="w-5" />}

            {/* Avatar */}
            <div className={`relative w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-lg shadow-md flex-shrink-0`}>
              {icon}
              {/* Status indicator */}
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${statusColors[status.toLowerCase()] || statusColors.offline}`} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900 dark:text-white truncate">{name}</h4>
                {badge && (
                  <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${badge.color}`}>
                    {badge.text}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {description || role}
              </p>
              {currentTask && (
                <p className="text-xs text-blue-600 dark:text-blue-400 truncate mt-0.5">
                  🔄 {currentTask.title}
                </p>
              )}
            </div>

            {/* Selection indicator */}
            {isSelected && (
              <span className="text-blue-500 text-lg">✓</span>
            )}

            {/* Tooltip */}
            {isHovered && (
              <AgentTooltip
                agentId={id}
                agentName={name}
                status={status}
                currentTask={currentTask}
              />
            )}
          </div>

          {/* Children */}
          {hasChildren && isExpanded && (
            <div className="relative mt-1">
              {/* Vertical connector line */}
              <div
                className="absolute left-6 top-0 w-px bg-gray-300 dark:bg-gray-600"
                style={{ height: 'calc(100% - 12px)' }}
              />
              {children}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 overflow-y-auto h-full">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        {locale === 'ja' ? 'エージェントツリー' : 'Agent Tree'}
      </h3>

      {/* Tree Structure */}
      <div className="space-y-1">
        {/* Manager - Root Node */}
        <TreeNode
          id="manager"
          name={locale === 'ja' ? 'マネージャー' : 'Manager'}
          role="Manager"
          icon="👔"
          status="idle"
          gradient="from-amber-500 to-orange-500"
          description={locale === 'ja' ? 'タスク管理・エージェント統括' : 'Task & Agent Orchestration'}
          badge={{ text: locale === 'ja' ? '統括' : 'Lead', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' }}
        >
          {/* AI Coach - Child of Manager */}
          <TreeNode
            id="coach"
            name="AI Coach"
            role="Coach"
            icon="🤖"
            status="idle"
            gradient="from-purple-500 to-indigo-500"
            level={1}
            description={locale === 'ja' ? '習慣・目標のアドバイザー' : 'Habit & Goal Advisor'}
            badge={{ text: locale === 'ja' ? '常駐' : 'On', color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' }}
          />

          {/* MCP Agents - Children of Manager */}
          {allAgents.map(agent => {
            const roleGradients: Record<string, string> = {
              manager: 'from-amber-500 to-orange-500',
              developer: 'from-blue-500 to-cyan-500',
              reviewer: 'from-purple-500 to-pink-500',
              tester: 'from-green-500 to-emerald-500',
              architect: 'from-indigo-500 to-violet-500',
              devops: 'from-orange-500 to-red-500',
              analyst: 'from-cyan-500 to-teal-500',
              coach: 'from-purple-500 to-indigo-500',
            };

            return (
              <TreeNode
                key={agent.id}
                id={agent.id}
                name={agent.name}
                role={agent.role}
                icon={ROLE_ICONS[agent.role.toLowerCase()] || '🤖'}
                status={agent.status}
                gradient={roleGradients[agent.role.toLowerCase()] || 'from-gray-500 to-gray-600'}
                level={1}
              />
            );
          })}
        </TreeNode>
      </div>

      {/* Empty state for MCP agents */}
      {allAgents.length === 0 && (
        <div className="mt-4 text-center text-muted-foreground py-6 border-2 border-dashed border-border rounded-lg">
          <span className="text-2xl mb-2 block">🔌</span>
          <p className="text-sm font-medium">{locale === 'ja' ? 'MCPエージェント未接続' : 'No MCP agents connected'}</p>
          <p className="text-xs mt-1">{locale === 'ja' ? '設定からMCPサーバーに接続' : 'Connect via settings'}</p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-border">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          {locale === 'ja' ? 'ステータス凡例' : 'Status Legend'}
        </h4>
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-muted-foreground">{locale === 'ja' ? '待機中' : 'Idle'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground">{locale === 'ja' ? '処理中' : 'Busy'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />
            <span className="text-muted-foreground">{locale === 'ja' ? 'オフライン' : 'Offline'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface HistoryViewProps {
  messages: GroupChatMessage[];
  locale: 'ja' | 'en';
}

function HistoryView({ messages, locale }: HistoryViewProps) {
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>('all');
  const [activeSearch, setActiveSearch] = useState('');

  const filterOpts: { value: HistoryFilter; label: string; icon: string }[] = [
    { value: 'all', label: locale === 'ja' ? 'すべて' : 'All', icon: '📋' },
    { value: 'user', label: locale === 'ja' ? 'ユーザー' : 'User', icon: '👤' },
    { value: 'coach', label: locale === 'ja' ? 'コーチ' : 'Coach', icon: '🤖' },
    { value: 'agent', label: locale === 'ja' ? 'エージェント' : 'Agent', icon: '👔' },
    { value: 'system', label: locale === 'ja' ? 'システム' : 'System', icon: '⚙️' },
  ];

  const filteredMsgs = useMemo(() => {
    let result = messages;
    if (activeFilter !== 'all') result = result.filter(m => m.senderType === activeFilter);
    if (activeSearch.trim()) {
      const q = activeSearch.toLowerCase();
      result = result.filter(m => m.content.toLowerCase().includes(q) || m.senderName.toLowerCase().includes(q));
    }
    return result;
  }, [messages, activeFilter, activeSearch]);

  const groupedByDate = filteredMsgs.reduce((acc, msg) => {
    const dateKey = msg.timestamp.toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(msg);
    return acc;
  }, {} as Record<string, GroupChatMessage[]>);

  const dates = Object.keys(groupedByDate).reverse();
  const counts = useMemo(() => ({ all: messages.length, user: messages.filter(m => m.senderType === 'user').length, coach: messages.filter(m => m.senderType === 'coach').length, agent: messages.filter(m => m.senderType === 'agent').length, system: messages.filter(m => m.senderType === 'system').length }), [messages]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border space-y-3 flex-shrink-0">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" value={activeSearch} onChange={e => setActiveSearch(e.target.value)} placeholder={locale === 'ja' ? 'メッセージを検索...' : 'Search messages...'} className="w-full pl-10 pr-4 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          {activeSearch && <button onClick={() => setActiveSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {filterOpts.map(o => (<button key={o.value} onClick={() => setActiveFilter(o.value)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium flex-shrink-0 ${activeFilter === o.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}><span>{o.icon}</span><span>{o.label}</span>{counts[o.value] > 0 && <span className={`min-w-[18px] h-[18px] px-1 text-[10px] rounded-full flex items-center justify-center ${activeFilter === o.value ? 'bg-primary-foreground/20' : 'bg-primary/10 text-primary'}`}>{counts[o.value]}</span>}</button>))}
        </div>
      </div>
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {dates.map(date => (<div key={date}><h3 className="text-sm font-medium text-muted-foreground mb-2 sticky top-0 bg-card/80 backdrop-blur-sm py-1">📅 {date}</h3><div className="space-y-2">{groupedByDate[date].map(msg => (<div key={msg.id} className="p-3 bg-muted rounded-lg border border-border hover:border-primary/30"><div className="flex items-center gap-2 mb-1"><span>{msg.senderIcon || '💬'}</span><span className="text-sm font-medium text-foreground">{msg.senderName}</span><span className={`text-[10px] px-1.5 py-0.5 rounded ${msg.senderType === 'user' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : msg.senderType === 'coach' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : msg.senderType === 'agent' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>{msg.senderType}</span><span className="text-xs text-muted-foreground ml-auto">{formatTime(msg.timestamp)}</span></div><p className="text-sm text-muted-foreground line-clamp-2">{msg.content}</p>{msg.taskId && <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/70"><span>📋</span><span>{msg.taskTitle || msg.taskId}</span></div>}</div>))}</div></div>))}
        {filteredMsgs.length === 0 && messages.length > 0 && <div className="text-center text-muted-foreground py-8"><span className="text-3xl mb-2 block">🔍</span><p>{locale === 'ja' ? '該当なし' : 'No matches'}</p><button onClick={() => { setActiveFilter('all'); setActiveSearch(''); }} className="mt-2 text-sm text-primary hover:underline">{locale === 'ja' ? 'リセット' : 'Reset'}</button></div>}
        {messages.length === 0 && <div className="text-center text-muted-foreground py-8"><span className="text-3xl mb-2 block">📜</span><p>{locale === 'ja' ? '履歴はありません' : 'No history'}</p></div>}
      </div>
      {filteredMsgs.length > 0 && <div className="px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">{filteredMsgs.length} {locale === 'ja' ? '件' : 'msgs'}{(activeFilter !== 'all' || activeSearch) && ` (${locale === 'ja' ? 'フィルター中' : 'filtered'})`}</div>}
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

export default MOCSection;
