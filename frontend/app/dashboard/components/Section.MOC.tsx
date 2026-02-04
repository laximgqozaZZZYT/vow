/**
 * Section.MOC - Multi-agent Orchestration Center
 *
 * AI Agents Hub with group chat as the main view.
 * Tabs: Chat, Tasks, Agents, History
 *
 * @module Section.MOC
 */

'use client';

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useMultiAgentServer, type ServerConnection } from '../hooks/useMultiAgentServer';
import { useMastraAgent, type MastraMessage } from '../hooks/useMastraAgent';
import { useMcpChat } from '../hooks/useMcpChat';
import type { Goal, Habit, Sticky, Tag } from '../types';
import type { ChatAgentSettings, McpServer } from '../types/agent.types';
import api from '../../../lib/api';
import { HabitModal } from './Modal.Habit';
import { GoalModal } from './Modal.Goal';
import { StickyModal } from './Modal.Sticky';
import { AgentDetailModal, BUILTIN_AGENTS, ROLE_ICONS as AGENT_ROLE_ICONS, type AgentConfig } from './Modal.AgentDetail';
import { IssueModal, type ConversationData, type ConversationMessage } from './Modal.Issue';
import ReactMarkdown from 'react-markdown';

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
/** Button type for suggestions */
export type SuggestionButtonType = 'habit' | 'goal' | 'stickyn' | 'reply';

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
    /** Button type determines which modal to open */
    suggestionType?: SuggestionButtonType;
    data: Record<string, unknown>;
    actions: Array<{ id: string; label: string; variant: 'primary' | 'secondary' | 'ghost' }>;
  };
  /** Multiple suggestions from tool calls - all items should be displayed as buttons */
  suggestions?: Array<{
    type: 'habit' | 'goal';
    /** Button type determines which modal to open */
    suggestionType?: SuggestionButtonType;
    data: Record<string, unknown>;
    actions: Array<{ id: string; label: string; variant: 'primary' | 'secondary' | 'ghost' }>;
  }>;
  /** Quick reply buttons for category selection etc. */
  quickReplies?: Array<{
    id: string;
    label: string;
    value: string;
    icon?: string;
  }>;
  /** Selection type for quick replies (habit_category, goal_category, or difficulty) */
  selectionType?: 'habit_category' | 'goal_category' | 'difficulty';
  /** Follow-up action buttons (more specific, easier, harder, improvement-related) */
  followUpActions?: Array<{
    id: string;
    label: string;
    action: 'more_specific' | 'easier' | 'harder' | 'different' | 'more_suggestions' | 'different_habit';
    category?: string;
  }>;
}

interface MOCSectionProps {
  goals?: Goal[];
  habits?: Habit[];
  stickies?: Sticky[];
  tags?: Tag[];
  onHabitCreated?: (habit: Habit) => void;
  onGoalCreated?: (goal: Goal) => void;
  onStickyCreated?: (sticky: Sticky) => void;
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
  stickies = [],
  tags = [],
  onHabitCreated,
  onGoalCreated,
  onStickyCreated,
  locale = 'ja',
  authToken,
}: MOCSectionProps) {
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  // selectedAgent state removed - manager-only mode is now default

  // Suggestion states for tracking action status
  const [suggestionStates, setSuggestionStates] = useState<Record<string, SuggestionState>>({});
  const [snoozedSuggestions, setSnoozedSuggestions] = useState<SnoozedSuggestion[]>([]);

  // Task detail view state
  const [selectedTask, setSelectedTask] = useState<TaskWithDetail | null>(null);

  // History filter state
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historySearch, setHistorySearch] = useState('');

  // Multi-agent aggregation state
  // aggregationSession removed - using simple mastraAgent approach

  // Modal states for creating habits/goals from suggestions
  const [habitModalOpen, setHabitModalOpen] = useState(false);
  const [habitModalInitial, setHabitModalInitial] = useState<{
    name?: string;
    type?: 'do' | 'avoid';
    goalId?: string;
  } | undefined>(undefined);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalModalInitial, setGoalModalInitial] = useState<{
    name?: string;
    parentId?: string | null;
  } | undefined>(undefined);

  // Sticky modal states for creating stickies from suggestions
  const [stickyModalOpen, setStickyModalOpen] = useState(false);
  const [stickyModalInitial, setStickyModalInitial] = useState<Sticky | null>(null);

  // Agent detail modal state
  const [agentDetailModalOpen, setAgentDetailModalOpen] = useState(false);
  const [selectedAgentForDetail, setSelectedAgentForDetail] = useState<AgentConfig | null>(null);
  const [agentDetailModalMode, setAgentDetailModalMode] = useState<'view' | 'edit' | 'create'>('view');

  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Issue modal state
  const [showIssueModal, setShowIssueModal] = useState(false);

  // Custom agents state with localStorage persistence
  const [customAgents, setCustomAgents] = useState<AgentConfig[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem('vow_custom_agents');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist custom agents to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vow_custom_agents', JSON.stringify(customAgents));
    }
  }, [customAgents]);

  // Track if initial suggestions have been shown
  const [hasShownInitialSuggestions, setHasShownInitialSuggestions] = useState(false);

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

  // Mastra agent hook - default AI chat
  const mastraAgent = useMastraAgent({
    authToken,
    enableStreaming: true,
  });

  // Get the selected MCP server for chat
  const selectedMcpServer = useMemo(() => {
    const settings = server.chatAgentSettings;
    console.log('[MOC] Resolving MCP server:', {
      useMcpAgent: settings.useMcpAgent,
      mcpServerId: settings.mcpServerId,
      availableServers: server.config.servers.map(s => ({
        id: s.id,
        name: s.name,
        url: s.serverUrl,
        // Show token debug info to track synchronization
        tokenMatch: s.serverToken === 'mcp-multi-agent-token-f75a6267',
        tokenPreview: s.serverToken ? `${s.serverToken.slice(0, 8)}...` : 'none',
      })),
      connections: Array.from(server.connections.entries()).map(([id, conn]) => ({
        id,
        state: conn.connectionState,
      })),
    });

    if (!settings.useMcpAgent) return null;

    // If specific server is selected
    if (settings.mcpServerId) {
      const found = server.config.servers.find(s => s.id === settings.mcpServerId);
      console.log('[MOC] Found server by ID:', found?.name, found?.serverUrl);
      return found || null;
    }

    // Auto-select first connected server
    const connectedServerIds = Array.from(server.connections.entries())
      .filter(([_, conn]) => conn.connectionState === 'connected')
      .map(([id]) => id);

    console.log('[MOC] Connected server IDs:', connectedServerIds);

    if (connectedServerIds.length > 0) {
      return server.config.servers.find(s => s.id === connectedServerIds[0]) || null;
    }

    return null;
  }, [server.chatAgentSettings, server.config.servers, server.connections]);

  // Get the selected MCP agent ID
  const selectedMcpAgentId = useMemo(() => {
    const settings = server.chatAgentSettings;
    if (!settings.useMcpAgent || !selectedMcpServer) return undefined;

    // If specific agent is selected
    if (settings.mcpAgentId) {
      return settings.mcpAgentId;
    }

    // Auto-select first available agent on the selected server
    const serverAgents = server.agents.filter(a => a.serverId === selectedMcpServer.id);
    return serverAgents[0]?.id;
  }, [server.chatAgentSettings, selectedMcpServer, server.agents]);

  // MCP chat hook - no automatic fallback, let user see errors and retry
  const mcpChat = useMcpChat({
    server: selectedMcpServer,
    agentId: selectedMcpAgentId,
    settings: server.chatAgentSettings,
    enableStreaming: true,
    // Don't use onFallback - it causes permanent switch to OpenAI
    // Instead, show errors to user and let them retry
    onError: (error) => {
      console.error('[MOCSection] MCP chat error:', error);
    },
  });

  // Determine which agent to use for chat
  // Simple logic: use MCP if enabled and server is available
  const shouldUseMcpAgent = useMemo(() => {
    const settings = server.chatAgentSettings;
    const result = settings.useMcpAgent && selectedMcpServer !== null;

    // Debug logging
    console.log('[MOC] Agent routing check:', {
      useMcpAgent: settings.useMcpAgent,
      hasSelectedMcpServer: !!selectedMcpServer,
      selectedMcpServerUrl: selectedMcpServer?.serverUrl,
      result,
    });

    return result;
  }, [server.chatAgentSettings, selectedMcpServer]);

  // Get the active chat agent (either mastraAgent or mcpChat)
  const activeAgent = shouldUseMcpAgent ? mcpChat : mastraAgent;

  // Log which agent is active
  console.log('[MOC] Active agent:', shouldUseMcpAgent ? 'MCP Chat (Claude Code)' : 'Mastra (OpenAI)');

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

  // Handle sending message - use active agent (MCP or Mastra based on settings)
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || activeAgent.isStreaming) return;

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

    try {
      // Use active agent (MCP or Mastra based on settings)
      console.log(`[MOCSection] Sending message via ${shouldUseMcpAgent ? 'MCP agent' : 'Mastra agent'}`);
      await activeAgent.sendMessage(messageText);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderType: 'system',
        senderIcon: ROLE_ICONS.system,
        content: locale === 'ja' ? '❌ AIへの問い合わせに失敗しました' : '❌ Failed to query AI',
        timestamp: new Date(),
      }]);
    }
  }, [inputValue, activeAgent, shouldUseMcpAgent, locale]);

  // Convert active agent messages to group chat format with suggestion support
  // Using a single batch update to avoid race conditions with multiple setMessages calls
  useEffect(() => {
    console.log('[MOC useEffect] Processing activeAgent.messages:', {
      agentType: shouldUseMcpAgent ? 'MCP' : 'Mastra',
      count: activeAgent.messages.length,
      messages: activeAgent.messages.map(m => ({
        id: m.id,
        role: m.role,
        status: m.status,
        hasToolCalls: !!m.toolCalls?.length,
        toolCallCount: m.toolCalls?.length ?? 0,
        toolNames: m.toolCalls?.map(tc => tc.toolName) ?? [],
      })),
    });

    // Collect all updates in a single batch to avoid race conditions
    setMessages(prev => {
      const updated = [...prev];
      let hasChanges = false;

      activeAgent.messages.forEach(msg => {
        // Process assistant messages (streaming or complete)
        if (msg.role === 'assistant' && (msg.content || msg.status === 'streaming')) {
          const messageId = `ai-${msg.id}`;

          // Only parse toolCalls when message is complete (toolCalls are added in 'complete' event)
          const isComplete = msg.status === 'complete';
          const suggestions = isComplete && msg.toolCalls?.length ? parseSuggestions(msg) : undefined;
          const quickRepliesResult = isComplete && msg.toolCalls?.length ? parseQuickReplies(msg) : undefined;
          const quickReplies = quickRepliesResult?.quickReplies;
          const selectionType = quickRepliesResult?.selectionType;
          const followUpActions = isComplete && msg.toolCalls?.length ? parseFollowUpActions(msg) : undefined;

          // Debug logging for toolCalls and suggestions
          if (isComplete && msg.toolCalls?.length) {
            console.log('[MOC] Message complete with toolCalls:', {
              messageId: msg.id,
              toolCallCount: msg.toolCalls.length,
              toolNames: msg.toolCalls.map(tc => tc.toolName),
              toolOutputs: msg.toolCalls.map(tc => ({ name: tc.toolName, output: tc.output })),
              parsedSuggestions: suggestions,
              parsedQuickReplies: quickReplies,
              parsedFollowUpActions: followUpActions,
            });
          }

          const existingIdx = updated.findIndex(m => m.id === messageId);

          if (existingIdx === -1) {
            // Add new message (may be streaming or complete)
            hasChanges = true;
            updated.push({
              id: messageId,
              senderId: 'ai',
              senderName: 'AI',
              senderType: 'coach' as const,
              senderRole: 'Coach',
              senderIcon: '🤖',
              content: msg.content || '',
              timestamp: msg.timestamp || new Date(),
              suggestions,
              suggestion: suggestions?.[0],
              quickReplies,
              selectionType,
              followUpActions,
            });
          } else {
            const existingMsg = updated[existingIdx];

            // Check if update is needed
            const hasNewSuggestions = suggestions && suggestions.length > 0 &&
              (!existingMsg.suggestions || existingMsg.suggestions.length === 0);
            const hasNewQuickReplies = quickReplies && quickReplies.length > 0 &&
              (!existingMsg.quickReplies || existingMsg.quickReplies.length === 0);
            const hasNewFollowUpActions = followUpActions && followUpActions.length > 0 &&
              (!existingMsg.followUpActions || existingMsg.followUpActions.length === 0);
            const contentChanged = existingMsg.content !== msg.content;

            console.log('[MOC] Update check for message:', {
              messageId,
              isComplete,
              hasNewSuggestions,
              suggestionsCount: suggestions?.length ?? 0,
              existingSuggestionsCount: existingMsg.suggestions?.length ?? 0,
              hasNewQuickReplies,
              quickRepliesCount: quickReplies?.length ?? 0,
              existingQuickRepliesCount: existingMsg.quickReplies?.length ?? 0,
              contentChanged,
              willUpdate: hasNewSuggestions || hasNewQuickReplies || hasNewFollowUpActions || contentChanged,
            });

            if (hasNewSuggestions || hasNewQuickReplies || hasNewFollowUpActions || contentChanged) {
              hasChanges = true;
              updated[existingIdx] = {
                ...existingMsg,
                suggestions: suggestions || existingMsg.suggestions,
                suggestion: suggestions?.[0] || existingMsg.suggestion,
                quickReplies: quickReplies || existingMsg.quickReplies,
                selectionType: selectionType || existingMsg.selectionType,
                followUpActions: followUpActions || existingMsg.followUpActions,
                content: msg.content || existingMsg.content
              };
            }
          }
        }
      });

      return hasChanges ? updated : prev;
    });
  }, [activeAgent.messages, shouldUseMcpAgent]); // Depend on activeAgent.messages

  // Quick actions - enhanced to match AICoaching section features
  const quickActions = useMemo(() => {
    const baseActions = [
      { id: 'add-habit', label: locale === 'ja' ? '➕ 習慣追加' : '➕ Add Habit', command: locale === 'ja' ? '新しい習慣を追加したい' : 'I want to add a new habit' },
      { id: 'set-goal', label: locale === 'ja' ? '🎯 ゴール設定' : '🎯 Set Goal', command: locale === 'ja' ? 'ゴールを設定したい' : 'I want to set a goal' },
      { id: 'check-progress', label: locale === 'ja' ? '📊 進捗確認' : '📊 Check Progress', command: locale === 'ja' ? '習慣の進捗を確認したい' : 'I want to check my habit progress' },
      { id: 'get-advice', label: locale === 'ja' ? '💡 アドバイス' : '💡 Get Advice', command: locale === 'ja' ? '習慣を続けるコツを教えて' : 'Give me tips for sticking to habits' },
      { id: 'improve-habit', label: locale === 'ja' ? '🔧 習慣を改善' : '🔧 Improve Habit', command: locale === 'ja' ? '習慣を改善したい' : 'I want to improve my habits' },
      { id: 'analyze', label: locale === 'ja' ? '📈 分析' : '📈 Analyze', command: locale === 'ja' ? '習慣の達成率を分析して' : 'Analyze my habit completion rates' },
    ];

    // Add contextual actions based on user data
    const contextualActions: { id: string; label: string; command: string }[] = [];

    // Check for habits without levels
    const unassessedHabits = (habits || []).filter(h => h.level === null || h.level === undefined);
    if (unassessedHabits.length > 0) {
      contextualActions.push({
        id: 'assess-levels',
        label: locale === 'ja' ? `📐 ${unassessedHabits.length}件のレベル設定` : `📐 Set ${unassessedHabits.length} levels`,
        command: locale === 'ja' ? '既存の習慣のレベル設定をして下さい' : 'Please help me set levels for my existing habits',
      });
    }

    // Check for goals without habits
    const goalsWithoutHabits = (goals || []).filter(g => {
      const goalHabits = (habits || []).filter(h => h.goalId === g.id);
      return goalHabits.length === 0;
    });
    if (goalsWithoutHabits.length > 0) {
      contextualActions.push({
        id: 'suggest-for-goal',
        label: locale === 'ja' ? `🎯 「${goalsWithoutHabits[0]?.name}」の習慣提案` : `🎯 Suggest for "${goalsWithoutHabits[0]?.name}"`,
        command: locale === 'ja' ? `「${goalsWithoutHabits[0]?.name}」というゴールに向けた習慣を提案して` : `Suggest habits for my goal "${goalsWithoutHabits[0]?.name}"`,
      });
    }

    return [...contextualActions, ...baseActions].slice(0, 6);
  }, [locale, habits, goals]);

  const handleQuickAction = useCallback((command: string) => {
    // Auto-send the quick action message (reply-type behavior)
    const userMessage: GroupChatMessage = {
      id: `user-${Date.now()}`,
      senderId: 'user',
      senderName: 'You',
      senderType: 'user',
      senderIcon: ROLE_ICONS.user,
      content: command,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    activeAgent.sendMessage(command);
  }, [activeAgent]);

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
        // Determine which modal to open based on suggestionType
        const suggestionType = suggestion.suggestionType || (suggestion.type === 'goal' ? 'goal' : 'habit');

        switch (suggestionType) {
          case 'habit':
            // Open habit modal with pre-filled data
            openHabitModal({
              name: (suggestion.data.name as string) || '',
              type: (suggestion.data.type as 'do' | 'avoid') || 'do',
              goalId: (suggestion.data.goalId as string) || goals[0]?.id || null,
            });

            setMessages(prev => [...prev, {
              id: `system-${Date.now()}`,
              senderId: 'system',
              senderName: 'System',
              senderType: 'system',
              senderIcon: ROLE_ICONS.system,
              content: locale === 'ja'
                ? `📝 「${suggestion.data.name || 'New Habit'}」の詳細を確認してください`
                : `📝 Please review the details for "${suggestion.data.name || 'New Habit'}"`,
              timestamp: new Date(),
            }]);
            break;

          case 'goal':
            // Open goal modal with pre-filled data
            openGoalModal({
              name: (suggestion.data.name as string) || '',
              parentId: null,
            });

            setMessages(prev => [...prev, {
              id: `system-${Date.now()}`,
              senderId: 'system',
              senderName: 'System',
              senderType: 'system',
              senderIcon: ROLE_ICONS.system,
              content: locale === 'ja'
                ? `🎯 「${suggestion.data.name || 'New Goal'}」の詳細を確認してください`
                : `🎯 Please review the details for "${suggestion.data.name || 'New Goal'}"`,
              timestamp: new Date(),
            }]);
            break;

          case 'stickyn':
            // Open Sticky'n modal with pre-filled data
            openStickyModal({
              name: (suggestion.data.name as string) || '',
              description: (suggestion.data.description as string) || (suggestion.data.rationale as string) || '',
              habitId: (suggestion.data.habitId as string) || null,
            });

            setMessages(prev => [...prev, {
              id: `system-${Date.now()}`,
              senderId: 'system',
              senderName: 'System',
              senderType: 'system',
              senderIcon: ROLE_ICONS.system,
              content: locale === 'ja'
                ? `📌 「${suggestion.data.name || 'New Sticky'}」の詳細を確認してください`
                : `📌 Please review the details for "${suggestion.data.name || 'New Sticky'}"`,
              timestamp: new Date(),
            }]);
            break;

          case 'reply':
            // Send the suggestion content as a message automatically
            const replyContent = (suggestion.data.name as string) || (suggestion.data.content as string) || '';
            if (replyContent) {
              // Add user message to chat
              const userMessage: GroupChatMessage = {
                id: `user-${Date.now()}`,
                senderId: 'user',
                senderName: 'You',
                senderType: 'user',
                senderIcon: ROLE_ICONS.user,
                content: replyContent,
                timestamp: new Date(),
              };
              setMessages(prev => [...prev, userMessage]);

              // Send to AI
              activeAgent.sendMessage(replyContent);
            }
            break;

          default:
            // Fallback to habit/goal based on type
            if (suggestion.type === 'habit') {
              openHabitModal({
                name: (suggestion.data.name as string) || '',
                type: (suggestion.data.type as 'do' | 'avoid') || 'do',
                goalId: (suggestion.data.goalId as string) || goals[0]?.id || null,
              });
            } else {
              openGoalModal({
                name: (suggestion.data.name as string) || '',
                parentId: null,
              });
            }
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

  // Handle quick reply click (category selection)
  // Determines appropriate message based on selectionType from the last message with quickReplies
  const handleQuickReplyClick = useCallback((value: string, label: string) => {
    // Find the last message with quickReplies to get its selectionType
    const lastMessageWithQuickReplies = [...messages].reverse().find(m => m.quickReplies && m.quickReplies.length > 0);
    const selectionType = lastMessageWithQuickReplies?.selectionType;

    console.log('[handleQuickReplyClick] Click with context:', {
      value,
      label,
      selectionType,
      lastMessageId: lastMessageWithQuickReplies?.id,
    });

    // Determine the appropriate message based on selectionType
    let categoryMessage: string;
    if (selectionType === 'goal_category') {
      // Goal category selected - request goal suggestions
      categoryMessage = locale === 'ja'
        ? `${label}の目標を提案して`
        : `Suggest ${label} goals`;
    } else {
      // Habit category or default - request habit suggestions
      categoryMessage = locale === 'ja'
        ? `${label}の習慣を提案して`
        : `Suggest ${label} habits`;
    }

    // Add user message
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      senderId: 'user',
      senderName: 'You',
      senderType: 'user',
      senderIcon: '👤',
      content: label,
      timestamp: new Date(),
    }]);

    // Send to AI (active agent)
    activeAgent.sendMessage(categoryMessage);
  }, [locale, activeAgent, messages]);

  // Handle follow-up action click (more specific, easier, harder, improvement-related)
  const handleFollowUpActionClick = useCallback((action: string, category?: string) => {
    const actionLabels: Record<string, { ja: string; en: string }> = {
      more_specific: { ja: 'もっと具体的に', en: 'More specific' },
      easier: { ja: 'もっとやさしく', en: 'Easier' },
      harder: { ja: 'もっとむずかしく', en: 'Harder' },
      different: { ja: '別のジャンル', en: 'Different category' },
      more_suggestions: { ja: '他の改善案を見る', en: 'See more suggestions' },
      different_habit: { ja: '別の習慣を改善', en: 'Improve different habit' },
    };

    const label = actionLabels[action]?.[locale] || action;

    // Get previous suggestion names to exclude (for different/varied results)
    const previousSuggestionNames: string[] = [];
    // Look at recent messages with suggestions to get names to exclude
    for (let i = messages.length - 1; i >= 0 && i >= messages.length - 5; i--) {
      const msg = messages[i];
      // Check single suggestion
      if (msg.suggestion?.data?.name) {
        previousSuggestionNames.push(msg.suggestion.data.name as string);
      }
      // Check multiple suggestions array
      if (msg.suggestions && Array.isArray(msg.suggestions)) {
        for (const s of msg.suggestions) {
          if (s.data?.name) {
            previousSuggestionNames.push(s.data.name as string);
          }
        }
      }
    }

    // Add user message
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      senderId: 'user',
      senderName: 'You',
      senderType: 'user',
      senderIcon: '👤',
      content: label,
      timestamp: new Date(),
    }]);

    // Build message for AI with context about previous suggestions
    const excludeContext = previousSuggestionNames.length > 0
      ? (locale === 'ja'
        ? `（${previousSuggestionNames.join('、')}以外で）`
        : ` (excluding: ${previousSuggestionNames.join(', ')})`)
      : '';

    // Get the category from the last suggestion message
    const categoryContext = category || '';

    let aiMessage = '';
    if (action === 'more_specific') {
      aiMessage = locale === 'ja'
        ? `${categoryContext}の習慣をもっと具体的に提案して${excludeContext}`
        : `Suggest more specific ${categoryContext} habits${excludeContext}`;
    } else if (action === 'easier') {
      // Include category to ensure refine_suggestions is called correctly
      aiMessage = locale === 'ja'
        ? `${categoryContext ? categoryContext + 'の' : ''}もっと簡単な習慣を提案して（refine_suggestionsを使って）${excludeContext}`
        : `Suggest easier ${categoryContext} habits (use refine_suggestions)${excludeContext}`;
    } else if (action === 'harder') {
      // Include category to ensure refine_suggestions is called correctly
      aiMessage = locale === 'ja'
        ? `${categoryContext ? categoryContext + 'の' : ''}もっと難しい習慣を提案して（refine_suggestionsを使って）${excludeContext}`
        : `Suggest more challenging ${categoryContext} habits (use refine_suggestions)${excludeContext}`;
    } else if (action === 'different') {
      aiMessage = locale === 'ja'
        ? `別のジャンルの習慣を提案して${excludeContext}`
        : `Suggest habits from a different category${excludeContext}`;
    } else if (action === 'more_suggestions') {
      // Request more improvement suggestions for the same habit
      aiMessage = locale === 'ja'
        ? `他の改善案を提案して${excludeContext}`
        : `Suggest more improvement ideas${excludeContext}`;
    } else if (action === 'different_habit') {
      // Request to select a different habit for improvement
      aiMessage = locale === 'ja'
        ? '別の習慣を改善したい'
        : 'I want to improve a different habit';
    }

    activeAgent.sendMessage(aiMessage);
  }, [locale, activeAgent, messages]);

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
    if (activeAgent.error) {
      activeAgent.retry();
    }
  }, [activeAgent]);

  // Modal handlers for creating habits/goals
  const openHabitModal = useCallback((data: {
    name?: string;
    type?: 'do' | 'avoid';
    goalId?: string | null;
  }) => {
    setHabitModalInitial({
      name: data.name || '',
      type: data.type || 'do',
      goalId: data.goalId || (goals.length > 0 ? goals[0].id : undefined),
    });
    setHabitModalOpen(true);
  }, [goals]);

  const openGoalModal = useCallback((data: {
    name?: string;
    parentId?: string | null;
  }) => {
    setGoalModalInitial({
      name: data.name || '',
      parentId: data.parentId || null,
    });
    setGoalModalOpen(true);
  }, []);

  const openStickyModal = useCallback((data: {
    name?: string;
    description?: string;
    habitId?: string | null;
  }) => {
    // Create a partial Sticky object for initial values
    // Use correct property names from Sticky interface
    setStickyModalInitial({
      id: '',
      name: data.name || '',
      description: data.description || '',
      completed: false,
      displayOrder: 0,
      parentStickyId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Store habitId in habits array if provided
      habits: data.habitId ? [{ id: data.habitId } as Habit] : undefined,
    } as Sticky);
    setStickyModalOpen(true);
  }, []);

  const handleHabitCreated = useCallback(async (payload: { name: string; goalId?: string; type: 'do' | 'avoid'; timings?: any[]; workloadUnit?: string; workloadTotal?: number; workloadTotalEnd?: number; workloadPerCount?: number; notes?: string; relatedHabitIds?: string[] }) => {
    // Call API to create habit in database
    console.log('[handleHabitCreated] Creating habit with payload:', payload);

    const createdHabit = await api.createHabit(payload);
    console.log('[handleHabitCreated] API response:', createdHabit);

    // Verify the habit was actually created
    if (!createdHabit || !createdHabit.id) {
      console.error('[handleHabitCreated] Failed to create habit - no valid response');
      throw new Error('Failed to create habit: No valid response from API');
    }

    // Add success message
    setMessages(prev => [...prev, {
      id: `system-${Date.now()}`,
      senderId: 'system',
      senderName: 'System',
      senderType: 'system',
      senderIcon: ROLE_ICONS.system,
      content: locale === 'ja'
        ? `✅ 習慣「${payload.name}」を作成しました！`
        : `✅ Created habit "${payload.name}"!`,
      timestamp: new Date(),
    }]);

    // Notify parent component about the created habit
    if (onHabitCreated) {
      console.log('[handleHabitCreated] Notifying parent component');
      onHabitCreated(createdHabit);
    }
  }, [locale, onHabitCreated]);

  const handleGoalCreated = useCallback(async (payload: { name: string; parentId?: string | null }) => {
    // Call API to create goal in database
    // Note: Error handling and modal closing is done in Modal.Goal.tsx
    const createdGoal = await api.createGoal(payload);

    // Add success message
    setMessages(prev => [...prev, {
      id: `system-${Date.now()}`,
      senderId: 'system',
      senderName: 'System',
      senderType: 'system',
      senderIcon: ROLE_ICONS.system,
      content: locale === 'ja'
        ? `✅ ゴール「${payload.name}」を作成しました！`
        : `✅ Created goal "${payload.name}"!`,
      timestamp: new Date(),
    }]);

    // Notify parent component about the created goal
    if (onGoalCreated && createdGoal) {
      onGoalCreated(createdGoal);
    }
  }, [locale, onGoalCreated]);

  const handleStickyCreated = useCallback(async (payload: { name: string; description?: string; parentStickyId?: string | null }) => {
    // Call API to create sticky in database
    // Note: Error handling and modal closing is done in Modal.Sticky.tsx
    const createdSticky = await api.createSticky(payload);

    // Add success message
    setMessages(prev => [...prev, {
      id: `system-${Date.now()}`,
      senderId: 'system',
      senderName: 'System',
      senderType: 'system',
      senderIcon: ROLE_ICONS.system,
      content: locale === 'ja'
        ? `✅ Sticky'n「${payload.name}」を作成しました！`
        : `✅ Created Sticky'n "${payload.name}"!`,
      timestamp: new Date(),
    }]);

    // Notify parent component about the created sticky
    if (onStickyCreated && createdSticky) {
      onStickyCreated(createdSticky);
    }

    // Return the created sticky for relation updates
    return createdSticky;
  }, [locale, onStickyCreated]);

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
        <div className="flex items-center gap-1">
          {/* Help button - shows AI Coach response flow diagram */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            title={locale === 'ja' ? 'AIコーチ回答フロー' : 'AI Coach Response Flow'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          {/* Chat Agent Status Indicator */}
          {(() => {
            const hasConnectedServers = Array.from(server.connections.values()).some(c => c.connectionState === 'connected');
            const isUsingMcp = server.chatAgentSettings.useMcpAgent && hasConnectedServers;
            return (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-xs">
                <div className={`w-2 h-2 rounded-full ${isUsingMcp ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span className="text-muted-foreground">
                  {isUsingMcp ? 'MCP' : 'AI'}
                </span>
              </div>
            );
          })()}
          {/* Settings button - navigates to settings page */}
          <a
            href="/settings#ai-config"
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            title={locale === 'ja' ? 'チャットエージェント設定（設定ページ）' : 'Chat Agent Settings (Settings Page)'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </a>
        </div>
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
                isLoading={activeAgent.isStreaming}
                locale={locale}
                messagesEndRef={messagesEndRef}
                suggestionStates={suggestionStates}
                onSuggestionAction={handleSuggestionAction}
                onQuickReplyClick={handleQuickReplyClick}
                onFollowUpActionClick={handleFollowUpActionClick}
                error={activeAgent.error}
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
              {/* Initial Suggestions - only when no messages */}
              {messages.length === 0 && (
                <div className="px-4 pt-3">
                  <div className="text-center mb-3">
                    <p className="text-sm font-medium text-foreground">
                      {locale === 'ja' ? 'ようこそ！何をお手伝いしましょうか？' : 'Welcome! How can I help you?'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {locale === 'ja' ? '以下から選択するか、メッセージを入力してください' : 'Choose from below or type a message'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center pb-2">
                    {quickActions.map(action => (
                      <button
                        key={action.id}
                        onClick={() => handleQuickAction(action.command)}
                        className={`flex-shrink-0 px-3 py-2 text-sm rounded-xl transition-all hover:shadow-md ${
                          action.id === 'multi-agent-dev'
                            ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 font-medium'
                            : 'bg-muted border border-border hover:bg-muted/80 text-foreground'
                        }`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                    placeholder={locale === 'ja' ? 'AIにメッセージ...' : 'Message AI...'}
                    rows={1}
                    className="flex-1 px-3 py-2 bg-transparent text-sm text-foreground placeholder-muted-foreground focus:outline-none resize-none max-h-[120px]"
                    style={{ minHeight: '40px' }}
                  />

                  {/* Issue Report Button */}
                  <button
                    onClick={() => setShowIssueModal(true)}
                    className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-muted text-muted-foreground hover:bg-orange-100 hover:text-orange-600 dark:hover:bg-orange-900/30 dark:hover:text-orange-400"
                    title={locale === 'ja' ? 'Issue を報告' : 'Report Issue'}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </button>

                  {/* Send Button */}
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || activeAgent.isStreaming}
                    className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      inputValue.trim() && !activeAgent.isStreaming
                        ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    {activeAgent.isStreaming ? (
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
                customAgents={customAgents}
                onSelectAgent={(agentId) => {
                  // Open agent detail modal
                  const builtInAgent = BUILTIN_AGENTS[agentId];
                  if (builtInAgent) {
                    setSelectedAgentForDetail(builtInAgent);
                    setAgentDetailModalMode('view');
                    setAgentDetailModalOpen(true);
                  } else {
                    // Check custom agents first
                    const customAgent = customAgents.find(a => a.id === agentId);
                    if (customAgent) {
                      setSelectedAgentForDetail(customAgent);
                      setAgentDetailModalMode('view');
                      setAgentDetailModalOpen(true);
                    } else {
                      // MCP agent - create config from connection data
                      const allAgents = Array.from(server.connections.values()).flatMap(c => c.agents || []);
                      const mcpAgent = allAgents.find(a => a.id === agentId);
                      if (mcpAgent) {
                        const mcpConfig: AgentConfig = {
                          id: mcpAgent.id,
                          name: mcpAgent.name,
                          role: mcpAgent.role,
                          description: `MCP Agent - ${mcpAgent.role}`,
                          icon: ROLE_ICONS[mcpAgent.role.toLowerCase()] || '🤖',
                          status: mcpAgent.status || 'offline',
                          systemPrompt: locale === 'ja'
                            ? 'MCPエージェントのシステムプロンプトは接続先で管理されています。'
                            : 'MCP agent system prompt is managed by the connected server.',
                          model: 'MCP Server',
                          tools: [],
                          capabilities: mcpAgent.capabilities || [],
                          isBuiltIn: false,
                        };
                        setSelectedAgentForDetail(mcpConfig);
                        setAgentDetailModalMode('view');
                        setAgentDetailModalOpen(true);
                      }
                    }
                  }
                }}
                onAddAgent={() => {
                  setSelectedAgentForDetail(null);
                  setAgentDetailModalMode('create');
                  setAgentDetailModalOpen(true);
                }}
                onEditAgent={(agentId) => {
                  const customAgent = customAgents.find(a => a.id === agentId);
                  if (customAgent) {
                    setSelectedAgentForDetail(customAgent);
                    setAgentDetailModalMode('edit');
                    setAgentDetailModalOpen(true);
                  }
                }}
                onDeleteAgent={(agentId) => {
                  setCustomAgents(prev => prev.filter(a => a.id !== agentId));
                }}
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

      {/* Modals for creating habits/goals from suggestions */}
      <HabitModal
        open={habitModalOpen}
        onClose={() => {
          setHabitModalOpen(false);
          setHabitModalInitial(undefined);
        }}
        habit={null}
        onCreate={handleHabitCreated}
        initial={habitModalInitial}
        categories={goals}
      />

      <GoalModal
        open={goalModalOpen}
        onClose={() => {
          setGoalModalOpen(false);
          setGoalModalInitial(undefined);
        }}
        goal={null}
        onCreate={handleGoalCreated}
        initial={goalModalInitial}
        goals={goals}
        habits={habits}
      />

      <StickyModal
        open={stickyModalOpen}
        onClose={() => {
          setStickyModalOpen(false);
          setStickyModalInitial(null);
        }}
        sticky={stickyModalInitial}
        stickies={stickies}
        onCreate={handleStickyCreated}
        goals={goals}
        habits={habits}
        tags={tags}
      />

      <AgentDetailModal
        open={agentDetailModalOpen}
        onClose={() => {
          setAgentDetailModalOpen(false);
          setSelectedAgentForDetail(null);
          setAgentDetailModalMode('view');
        }}
        agent={selectedAgentForDetail}
        locale={locale}
        mode={agentDetailModalMode}
        availableParents={customAgents}
        onSave={(agentId, updates) => {
          // Handle saving agent config updates
          if (agentDetailModalMode === 'create') {
            // Create new custom agent
            const newAgent = updates as AgentConfig;
            setCustomAgents(prev => [...prev, newAgent]);
          } else {
            // Update existing custom agent
            setCustomAgents(prev =>
              prev.map(a => a.id === agentId ? { ...a, ...updates } : a)
            );
          }
        }}
        onDelete={(agentId) => {
          setCustomAgents(prev => prev.filter(a => a.id !== agentId));
        }}
      />

      {/* Issue Report Modal */}
      <IssueModal
        open={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        onSubmit={(data) => {
          // Show success message in chat
          setMessages(prev => [...prev, {
            id: `system-${Date.now()}`,
            senderId: 'system',
            senderName: 'System',
            senderType: 'system',
            senderIcon: ROLE_ICONS.system,
            content: locale === 'ja'
              ? `Issue "${data.title}" を作成しました。ご報告ありがとうございます。`
              : `Issue "${data.title}" has been created. Thank you for your report.`,
            timestamp: new Date(),
          }]);
        }}
        conversationId={undefined}
        messageIds={messages.map(m => m.id)}
        conversationData={{
          messages: messages.map((m): ConversationMessage => ({
            role: m.senderType === 'user' ? 'user' : 'assistant',
            content: m.content,
            timestamp: m.timestamp.toISOString(),
            toolCalls: m.suggestion ? [{ type: 'suggestion', data: m.suggestion }] : undefined,
          }))
        }}
        locale={locale}
      />

      {/* AI Coach Response Flow Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[10001] flex items-start justify-center pt-4 sm:pt-8 bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-lg text-card-foreground flex flex-col max-h-[95vh] sm:max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg sm:text-xl font-semibold">
                {locale === 'ja' ? 'AIコーチ 回答フロー' : 'AI Coach Response Flow'}
              </h2>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-muted-foreground hover:text-foreground text-xl p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-auto p-4 space-y-6">
              {/* Overview */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                  {locale === 'ja' ? '概要' : 'Overview'}
                </h3>
                <p className="text-sm text-foreground">
                  {locale === 'ja'
                    ? 'VOW AIコーチは、テキストベースの質問の代わりにインタラクティブなUI要素（ボタン）を使用します。'
                    : 'The VOW AI Coach uses interactive UI elements (buttons) instead of text-based questions.'}
                </p>
              </div>

              {/* Response Flow Diagram */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  {locale === 'ja' ? '回答フロー図' : 'Response Flow Diagram'}
                </h3>
                <div className="bg-muted/30 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                  <pre className="whitespace-pre text-foreground">{`User Request
    |
    +-> "${locale === 'ja' ? '習慣の進捗を確認したい' : 'Check habit progress'}"
    |       |
    |       +-> show_habit_selection() -> User's habits as buttons
    |               |
    |               +-> User selects habit -> check_progress(habitId)
    |
    +-> "${locale === 'ja' ? '目標の進捗を見たい' : 'Check goal progress'}"
    |       |
    |       +-> show_goal_selection() -> User's goals as buttons
    |               |
    |               +-> User selects goal -> check_progress(goalId)
    |
    +-> "${locale === 'ja' ? '新しい習慣を始めたい' : 'Start new habit'}"
    |       |
    |       +-> show_category_selection(selectionType: "habit_category")
    |               |
    |               +-> User selects category -> suggest_habits(category)
    |                       |
    |                       +-> Returns suggestions + followUpActions
    |
    +-> "${locale === 'ja' ? 'ゴールを設定したい' : 'Set a goal'}"
            |
            +-> show_category_selection(selectionType: "goal_category")
                    |
                    +-> User selects category -> suggest_goals(category)
                            |
                            +-> Returns suggestions + followUpActions`}</pre>
                </div>
              </div>

              {/* Tool Usage Rules */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  {locale === 'ja' ? 'ツール使用ルール' : 'Tool Usage Rules'}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                          {locale === 'ja' ? 'ユーザーリクエスト' : 'User Request'}
                        </th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                          {locale === 'ja' ? '呼び出すツール' : 'Tool to Call'}
                        </th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                          selectionType
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-3">{locale === 'ja' ? '習慣の進捗を確認したい' : 'Check habit progress'}</td>
                        <td className="py-2 px-3 font-mono text-xs">show_habit_selection</td>
                        <td className="py-2 px-3 text-muted-foreground">N/A</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-3">{locale === 'ja' ? '目標の進捗を見たい' : 'Check goal progress'}</td>
                        <td className="py-2 px-3 font-mono text-xs">show_goal_selection</td>
                        <td className="py-2 px-3 text-muted-foreground">N/A</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-3">{locale === 'ja' ? '新しい習慣を始めたい' : 'Start new habit'}</td>
                        <td className="py-2 px-3 font-mono text-xs">show_category_selection</td>
                        <td className="py-2 px-3 font-mono text-xs">habit_category</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-3">{locale === 'ja' ? 'ゴールを設定したい' : 'Set a goal'}</td>
                        <td className="py-2 px-3 font-mono text-xs">show_category_selection</td>
                        <td className="py-2 px-3 font-mono text-xs">goal_category</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-3">{locale === 'ja' ? '健康な習慣を提案して' : 'Suggest healthy habits'}</td>
                        <td className="py-2 px-3 font-mono text-xs">suggest_habits</td>
                        <td className="py-2 px-3 text-muted-foreground">N/A (category: health)</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3">{locale === 'ja' ? 'キャリア目標を提案して' : 'Suggest career goals'}</td>
                        <td className="py-2 px-3 font-mono text-xs">suggest_goals</td>
                        <td className="py-2 px-3 text-muted-foreground">N/A (category: career)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* After Category Selection */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  {locale === 'ja' ? 'カテゴリ選択後' : 'After Category Selection'}
                </h3>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-3">
                  <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                    {locale === 'ja'
                      ? '重要: 元のリクエストに基づいて正しいsuggestツールを使用してください'
                      : 'CRITICAL: Use the correct suggest tool based on the original request'}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                          {locale === 'ja' ? '元のリクエスト' : 'Original Request'}
                        </th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                          {locale === 'ja' ? '選択されたカテゴリ' : 'Category Selected'}
                        </th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                          {locale === 'ja' ? '呼び出すツール' : 'Tool to Call'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-3">{locale === 'ja' ? '新しい習慣を始めたい' : 'Start new habit'}</td>
                        <td className="py-2 px-3">health, learning, etc.</td>
                        <td className="py-2 px-3 font-mono text-xs font-bold text-green-600 dark:text-green-400">suggest_habits</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3">{locale === 'ja' ? 'ゴールを設定したい' : 'Set a goal'}</td>
                        <td className="py-2 px-3">career, finance, etc.</td>
                        <td className="py-2 px-3 font-mono text-xs font-bold text-green-600 dark:text-green-400">suggest_goals</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Follow-Up Actions */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  {locale === 'ja' ? 'フォローアップアクション' : 'Follow-Up Actions'}
                </h3>
                <p className="text-sm text-foreground mb-3">
                  {locale === 'ja'
                    ? 'suggest_habitsとsuggest_goalsはfollowUpActionsを返します:'
                    : 'Both suggest_habits and suggest_goals return followUpActions:'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm">
                    <span>🔍</span>
                    <span>{locale === 'ja' ? 'もっと具体的に' : 'More specific'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm">
                    <span>🌱</span>
                    <span>{locale === 'ja' ? 'もっとやさしく' : 'Easier'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm">
                    <span>🔥</span>
                    <span>{locale === 'ja' ? 'もっとむずかしく' : 'Harder'}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-sm">
                    <span>🔄</span>
                    <span>{locale === 'ja' ? '他には？' : 'Different'}</span>
                  </span>
                </div>
              </div>

              {/* Prohibited Patterns */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  {locale === 'ja' ? '禁止パターン' : 'Prohibited Patterns'}
                </h3>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-2">
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-red-500 flex-shrink-0">✕</span>
                    <span className="text-red-700 dark:text-red-400">
                      {locale === 'ja'
                        ? '「どの習慣ですか？」とテキストで質問 → show_habit_selectionを使用'
                        : 'Ask "Which habit?" with text → use show_habit_selection instead'}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-red-500 flex-shrink-0">✕</span>
                    <span className="text-red-700 dark:text-red-400">
                      {locale === 'ja'
                        ? '「習慣のIDを教えてください」と質問 → 選択ボタンを使用'
                        : 'Ask "Tell me the habit ID" → use selection buttons instead'}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-red-500 flex-shrink-0">✕</span>
                    <span className="text-red-700 dark:text-red-400">
                      {locale === 'ja'
                        ? 'goal_category選択後にsuggest_habitsを呼び出す'
                        : 'Call suggest_habits after goal_category selection'}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-red-500 flex-shrink-0">✕</span>
                    <span className="text-red-700 dark:text-red-400">
                      {locale === 'ja'
                        ? 'habit_category選択後にsuggest_goalsを呼び出す'
                        : 'Call suggest_goals after habit_category selection'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end p-4 border-t border-border">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity min-h-[44px]"
              >
                {locale === 'ja' ? '閉じる' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

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

/**
 * Parse ALL suggestions from ALL tool calls (returns array of suggestions)
 * This ensures all suggestions from multiple tool calls are displayed as buttons
 */
function parseSuggestions(msg: MastraMessage): GroupChatMessage['suggestions'] | undefined {
  // Parse tool calls for suggestions
  if (!msg.toolCalls?.length) return undefined;

  // Look for goal or habit suggestion tools
  // Note: refine_suggestions returns habit suggestions (with modified difficulty/specificity)
  // Note: suggest_habit_improvements returns improvements for existing habits
  const goalToolNames = ['suggest_goals', 'create_goal_suggestion', 'recommend_goals', 'create_smart_goal'];
  const habitToolNames = ['suggest_habits', 'create_habit_suggestion', 'recommend_habits', 'generate_baby_steps', 'refine_suggestions', 'suggest_habit_improvements'];

  const defaultActions = [
    { id: 'accept', label: '✅ 採用', variant: 'primary' as const },
    { id: 'snooze', label: '⏭️ 後で', variant: 'secondary' as const },
    { id: 'dismiss', label: '❌ 不要', variant: 'ghost' as const },
  ];

  // Aggregate suggestions from ALL tool calls
  const allSuggestions: NonNullable<GroupChatMessage['suggestions']> = [];

  const hasGoalTool = msg.toolCalls.some(tc => tc.toolName === 'suggest_goals');
  const hasHabitTool = msg.toolCalls.some(tc => tc.toolName === 'suggest_habits');
  const hasRefineTool = msg.toolCalls.some(tc => tc.toolName === 'refine_suggestions');

  console.log('[parseSuggestions] Processing toolCalls:', {
    count: msg.toolCalls.length,
    toolNames: msg.toolCalls.map(tc => tc.toolName),
    hasGoalTool,
    hasHabitTool,
    hasRefineTool,
  });

  // Specific debug for suggest_goals
  if (hasGoalTool) {
    const goalToolCall = msg.toolCalls.find(tc => tc.toolName === 'suggest_goals');
    console.log('[parseSuggestions] GOAL TOOL FOUND - Full details:', {
      toolName: goalToolCall?.toolName,
      input: goalToolCall?.input,
      output: goalToolCall?.output,
      success: goalToolCall?.success,
      durationMs: goalToolCall?.durationMs,
    });
  }

  // Specific debug for refine_suggestions (adjustment results)
  if (hasRefineTool) {
    const refineToolCall = msg.toolCalls.find(tc => tc.toolName === 'refine_suggestions');
    console.log('[parseSuggestions] REFINE TOOL FOUND - Full details:', {
      toolName: refineToolCall?.toolName,
      input: refineToolCall?.input,
      output: refineToolCall?.output,
      success: refineToolCall?.success,
      durationMs: refineToolCall?.durationMs,
    });
  }

  for (const toolCall of msg.toolCalls) {
    const isGoalTool = goalToolNames.includes(toolCall.toolName);
    const isHabitTool = habitToolNames.includes(toolCall.toolName);

    console.log('[parseSuggestions] Processing toolCall:', {
      toolName: toolCall.toolName,
      isGoalTool,
      isHabitTool,
      hasOutput: !!toolCall.output,
      outputType: typeof toolCall.output,
      output: toolCall.output,
      success: toolCall.success,
    });

    if (!isGoalTool && !isHabitTool) continue;

    // Skip failed tool calls
    if (toolCall.success === false) {
      console.warn('[parseSuggestions] Skipping failed tool call:', toolCall.toolName, toolCall.error);
      continue;
    }

    const isGoal = isGoalTool;

    // Parse output - handle both object and stringified JSON
    // Also handle null explicitly since null || input would incorrectly use input
    let output: Record<string, unknown> | undefined;
    if (toolCall.output === null || toolCall.output === undefined) {
      console.log('[parseSuggestions] toolCall.output is null/undefined for', toolCall.toolName);
      output = undefined;
    } else if (typeof toolCall.output === 'string') {
      try {
        output = JSON.parse(toolCall.output);
        console.log('[parseSuggestions] Parsed stringified output for', toolCall.toolName);
      } catch {
        console.warn('[parseSuggestions] Failed to parse stringified output for', toolCall.toolName);
        output = undefined;
      }
    } else if (typeof toolCall.output === 'object') {
      output = toolCall.output as Record<string, unknown>;
      console.log('[parseSuggestions] Using object output for', toolCall.toolName, '- keys:', Object.keys(output));
    } else {
      console.warn('[parseSuggestions] Unexpected output type for', toolCall.toolName, ':', typeof toolCall.output);
      output = undefined;
    }

    // Parse input - handle both object and stringified JSON
    let input: Record<string, unknown>;
    if (typeof toolCall.input === 'string') {
      try {
        input = JSON.parse(toolCall.input);
      } catch {
        input = {};
      }
    } else {
      input = (toolCall.input as Record<string, unknown>) || {};
    }

    const data = output || input;

    console.log('[parseSuggestions] data for', toolCall.toolName, ':', {
      data,
      dataType: typeof data,
      hasSuggestions: !!data?.suggestions,
      suggestionsIsArray: Array.isArray(data?.suggestions),
      suggestionsLength: Array.isArray(data?.suggestions) ? data.suggestions.length : 0,
    });

    // Safeguard: check if data is valid
    if (!data || typeof data !== 'object') {
      console.warn('[parseSuggestions] Invalid data for', toolCall.toolName, '- data is', data);
      continue;
    }

    // Handle array of suggestions
    if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
      console.log('[parseSuggestions] Found suggestions array for', toolCall.toolName, ':',
        data.suggestions.map((s: Record<string, unknown>) => ({
          name: s.name,
          suggestionType: s.suggestionType,
        }))
      );

      data.suggestions.forEach((suggestion: Record<string, unknown>) => {
        // Extract suggestionType from tool output, default based on tool type
        const suggestionType = (suggestion.suggestionType as SuggestionButtonType)
          || (isGoal ? 'goal' : 'habit');

        console.log('[parseSuggestions] Adding suggestion:', {
          name: suggestion.name,
          type: isGoal ? 'goal' : 'habit',
          suggestionType,
        });

        allSuggestions.push({
          type: isGoal ? 'goal' as const : 'habit' as const,
          suggestionType,
          data: suggestion,
          actions: defaultActions,
        });
      });
      continue;
    }

    // Handle SMART goal tool output
    if (data.smartGoal || data.refinedGoal) {
      allSuggestions.push({
        type: 'goal' as const,
        suggestionType: 'goal',
        data: {
          name: data.refinedGoal || 'New Goal',
          description: JSON.stringify(data.smartGoal),
          ...data,
        },
        actions: defaultActions,
      });
      continue;
    }

    // Handle baby steps tool output - each step becomes a suggestion
    if (data.steps && Array.isArray(data.steps)) {
      data.steps.forEach((step: Record<string, unknown>) => {
        allSuggestions.push({
          type: 'habit' as const,
          suggestionType: 'habit',
          data: {
            name: step?.action || 'New Habit',
            description: `Level ${step?.level}: ${step?.duration}`,
            ...step,
          },
          actions: defaultActions,
        });
      });
      continue;
    }

    // Handle habit improvements tool output - each improvement becomes a reply-type suggestion
    if (data.improvements && Array.isArray(data.improvements) && data.improvements.length > 0) {
      console.log('[parseSuggestions] Found improvements array for suggest_habit_improvements:',
        data.improvements.map((imp: Record<string, unknown>) => ({
          title: imp.title,
          suggestionType: imp.suggestionType || 'reply',
        }))
      );

      data.improvements.forEach((improvement: Record<string, unknown>) => {
        // Improvements are displayed as reply-type buttons that apply the improvement
        const suggestionType = (improvement.suggestionType as SuggestionButtonType) || 'reply';

        console.log('[parseSuggestions] Adding improvement:', {
          title: improvement.title,
          category: improvement.category,
          suggestionType,
        });

        allSuggestions.push({
          type: 'habit' as const,
          suggestionType,
          data: {
            name: improvement.title || 'Improvement',
            description: improvement.description,
            rationale: improvement.rationale,
            category: improvement.category,
            impact: improvement.impact,
            effort: improvement.effort,
            actionSteps: improvement.actionSteps,
            habitId: (data.habit as Record<string, unknown>)?.id,
            habitName: (data.habit as Record<string, unknown>)?.name,
            ...improvement,
          },
          actions: [
            { id: 'apply', label: '✅ 適用', variant: 'primary' as const },
            { id: 'snooze', label: '⏭️ 後で', variant: 'secondary' as const },
            { id: 'dismiss', label: '❌ 不要', variant: 'ghost' as const },
          ],
        });
      });
      continue;
    }

    // Single suggestion object
    if (data.name) {
      const suggestionType = (data.suggestionType as SuggestionButtonType)
        || (isGoal ? 'goal' : 'habit');

      allSuggestions.push({
        type: isGoal ? 'goal' as const : 'habit' as const,
        suggestionType,
        data: data,
        actions: defaultActions,
      });
    }
  }

  console.log('[parseSuggestions] Final result:', {
    count: allSuggestions.length,
    suggestions: allSuggestions.map(s => ({
      type: s.type,
      suggestionType: s.suggestionType,
      name: s.data?.name,
    })),
  });

  return allSuggestions.length > 0 ? allSuggestions : undefined;
}

// Legacy function for backward compatibility
function parseSuggestion(msg: MastraMessage): GroupChatMessage['suggestion'] | undefined {
  const suggestions = parseSuggestions(msg);
  return suggestions?.[0];
}

/**
 * Parse quick replies from show_category_selection, show_habit_selection, show_goal_selection tool output
 * Also handles suggest_habit_improvements which returns quickReplies for habit selection when no habitId is provided
 * Returns both the quickReplies array and the selectionType
 */
function parseQuickReplies(msg: MastraMessage): { quickReplies: GroupChatMessage['quickReplies']; selectionType?: GroupChatMessage['selectionType'] } | undefined {
  if (!msg.toolCalls?.length) {
    console.log('[parseQuickReplies] No toolCalls found');
    return undefined;
  }

  // Look for selection tools (category, habit, goal) and tools that return quickReplies
  const selectionToolNames = [
    'show_category_selection',
    'show_habit_selection',
    'show_goal_selection',
  ];

  // Tools that may also return quickReplies in their output
  const toolsWithQuickReplies = [
    'suggest_habit_improvements', // Returns habit selection when no habitId provided
  ];

  console.log('[parseQuickReplies] Searching for selection tools in:', msg.toolCalls.map(tc => ({
    name: tc.toolName,
    isSelectionTool: selectionToolNames.includes(tc.toolName),
    hasQuickReplies: toolsWithQuickReplies.includes(tc.toolName),
    hasOutput: !!tc.output,
    outputType: typeof tc.output,
    outputKeys: tc.output && typeof tc.output === 'object' ? Object.keys(tc.output as object) : [],
  })));

  // First try to find a dedicated selection tool
  let selectionTool = msg.toolCalls.find(tc =>
    selectionToolNames.includes(tc.toolName)
  );

  // If not found, look for tools that might have quickReplies in their output
  if (!selectionTool) {
    selectionTool = msg.toolCalls.find(tc => {
      if (!toolsWithQuickReplies.includes(tc.toolName)) return false;
      const output = tc.output as Record<string, unknown> | undefined;
      return output?.quickReplies && Array.isArray(output.quickReplies) && output.quickReplies.length > 0;
    });
  }

  if (!selectionTool) {
    console.log('[parseQuickReplies] No selection tool found among:', msg.toolCalls.map(tc => tc.toolName));
    return undefined;
  }

  console.log('[parseQuickReplies] Found selection tool:', {
    toolName: selectionTool.toolName,
    outputType: typeof selectionTool.output,
    output: selectionTool.output,
    success: selectionTool.success,
  });

  const output = selectionTool.output as Record<string, unknown> | undefined;

  // Extract selectionType from the output (for show_category_selection)
  let selectionType: GroupChatMessage['selectionType'] | undefined;
  if (output?.selectionType && typeof output.selectionType === 'string') {
    const validTypes = ['habit_category', 'goal_category', 'difficulty'] as const;
    if (validTypes.includes(output.selectionType as typeof validTypes[number])) {
      selectionType = output.selectionType as typeof validTypes[number];
      console.log('[parseQuickReplies] Found selectionType:', selectionType);
    }
  }

  // Handle case where output might be nested or have different structure
  let quickRepliesData: unknown[] | undefined;

  if (output?.quickReplies && Array.isArray(output.quickReplies)) {
    quickRepliesData = output.quickReplies as unknown[];
  } else if (output && typeof output === 'object') {
    // Try to find quickReplies in nested structure
    const outputObj = output as Record<string, unknown>;
    for (const key of Object.keys(outputObj)) {
      const value = outputObj[key];
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && 'id' in (value[0] as object) && 'label' in (value[0] as object)) {
        console.log('[parseQuickReplies] Found quickReplies in nested key:', key);
        quickRepliesData = value as unknown[];
        break;
      }
    }
  }

  if (!quickRepliesData || quickRepliesData.length === 0) {
    console.log('[parseQuickReplies] No quickReplies found in output:', {
      hasOutput: !!output,
      outputKeys: output ? Object.keys(output) : [],
      quickRepliesField: output?.quickReplies,
      isArray: Array.isArray(output?.quickReplies),
    });
    return undefined;
  }

  console.log('[parseQuickReplies] Successfully extracted quickReplies:', quickRepliesData);

  const quickReplies = quickRepliesData.map((reply: unknown) => {
    const r = reply as Record<string, unknown>;
    return {
      id: String(r.id || ''),
      label: String(r.label || ''),
      value: String(r.value || ''),
      icon: r.icon ? String(r.icon) : undefined,
    };
  });

  return { quickReplies, selectionType };
}

/**
 * Parse follow-up actions from refine_suggestions, suggest_habits, or suggest_goals tool output
 */
function parseFollowUpActions(msg: MastraMessage): GroupChatMessage['followUpActions'] | undefined {
  if (!msg.toolCalls?.length) return undefined;

  // Look for tools that may have followUpActions
  const toolsWithFollowUp = [
    'refine_suggestions',
    'suggest_habits',
    'suggest_goals',
    'suggest_habit_improvements', // Improvement tool has followUpActions like 'more_suggestions', 'different_habit'
  ];

  const toolWithFollowUp = msg.toolCalls.find(tc =>
    toolsWithFollowUp.includes(tc.toolName)
  );

  if (!toolWithFollowUp) return undefined;

  const output = toolWithFollowUp.output as Record<string, unknown> | undefined;
  if (!output?.followUpActions || !Array.isArray(output.followUpActions)) return undefined;

  return output.followUpActions.map((action: Record<string, unknown>) => ({
    id: String(action.id || ''),
    label: String(action.label || ''),
    action: action.action as 'more_specific' | 'easier' | 'harder' | 'different' | 'more_suggestions' | 'different_habit',
    category: action.category ? String(action.category) : undefined,
  }));
}

/**
 * Parse suggestions from multi-agent tool calls
 * This handles the format from useMultiAgentChat hook
 */
function parseMultiAgentSuggestion(
  toolCalls: Array<{
    toolName: string;
    toolCallId?: string;
    args?: unknown;
    result?: unknown;
  }>
): GroupChatMessage['suggestion'] | undefined {
  if (!toolCalls?.length) return undefined;

  // Look for goal or habit suggestion tools
  const goalToolNames = ['suggest_goals', 'create_goal_suggestion', 'recommend_goals', 'create_smart_goal', 'prioritize_goals', 'breakdown_milestones'];
  const habitToolNames = ['suggest_habits', 'create_habit_suggestion', 'recommend_habits', 'generate_baby_steps', 'analyze_habits'];

  const suggestionCall = toolCalls.find(tc =>
    goalToolNames.includes(tc.toolName) || habitToolNames.includes(tc.toolName)
  );

  if (!suggestionCall) return undefined;

  const isGoal = goalToolNames.includes(suggestionCall.toolName);

  // Extract data from result or args
  const resultData = suggestionCall.result as Record<string, unknown> | undefined;
  const argsData = suggestionCall.args as Record<string, unknown> | undefined;
  const data = resultData || argsData || {};

  // Handle various response formats
  let suggestionData: Record<string, unknown> = {};

  // Handle suggestions array (from suggest_habits, suggest_goals)
  if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
    suggestionData = data.suggestions[0] as Record<string, unknown>;
  }
  // Handle SMART goal output
  else if (data.smartGoal || data.refinedGoal) {
    suggestionData = {
      name: data.refinedGoal || 'New Goal',
      description: typeof data.smartGoal === 'object'
        ? Object.entries(data.smartGoal as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join('\n')
        : String(data.smartGoal),
      ...data,
    };
  }
  // Handle prioritized goals output
  else if (data.prioritizedGoals && Array.isArray(data.prioritizedGoals) && data.prioritizedGoals.length > 0) {
    const firstGoal = data.prioritizedGoals[0] as Record<string, unknown>;
    suggestionData = {
      name: firstGoal.goalId || 'Goal',
      description: firstGoal.reason || '',
      priority: firstGoal.priority,
      recommendedFocus: firstGoal.recommendedFocus,
      ...firstGoal,
    };
  }
  // Handle milestones output
  else if (data.milestones && Array.isArray(data.milestones) && data.milestones.length > 0) {
    const firstMilestone = data.milestones[0] as Record<string, unknown>;
    suggestionData = {
      name: firstMilestone.title || 'Milestone',
      description: firstMilestone.description || '',
      targetDate: firstMilestone.targetDate,
      ...firstMilestone,
    };
  }
  // Handle baby steps output
  else if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
    const firstStep = data.steps[0] as Record<string, unknown>;
    suggestionData = {
      name: firstStep.action || 'Baby Step',
      description: `Level ${firstStep.level}: ${firstStep.duration}`,
      tips: firstStep.tips,
      ...firstStep,
    };
  }
  // Handle analysis output (insights as suggestions)
  else if (data.insights && Array.isArray(data.insights) && data.insights.length > 0) {
    suggestionData = {
      name: 'Analysis Result',
      description: (data.insights as string[]).join('\n'),
      completionRate: data.completionRate,
      patterns: data.patterns,
      ...data,
    };
  }
  // Direct suggestion object
  else if (data.name) {
    suggestionData = data;
  }
  // Fallback
  else {
    suggestionData = data;
  }

  // Only return if we have meaningful data
  if (Object.keys(suggestionData).length === 0) return undefined;

  return {
    type: isGoal ? 'goal' : 'habit',
    data: suggestionData,
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
  onQuickReplyClick?: (value: string, label: string) => void;
  onFollowUpActionClick?: (action: string, category?: string) => void;
  error?: Error | null;
  onRetry?: () => void;
}

function GroupChatView({ messages, isLoading, locale, messagesEndRef, suggestionStates, onSuggestionAction, onQuickReplyClick, onFollowUpActionClick, error, onRetry }: GroupChatViewProps) {
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
              suggestionStates={suggestionStates}
              onSuggestionAction={onSuggestionAction}
              onQuickReplyClick={onQuickReplyClick}
              onFollowUpActionClick={onFollowUpActionClick}
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
  suggestionStates?: Record<string, SuggestionState>;
  onSuggestionAction?: (messageId: string, actionId: string, suggestion: NonNullable<GroupChatMessage['suggestion']>) => void;
  onQuickReplyClick?: (value: string, label: string) => void;
  onFollowUpActionClick?: (action: string, category?: string) => void;
}

function ChatMessageBubble({ message, locale, isFirstInGroup = true, isLastInGroup = true, suggestionState, suggestionStates, onSuggestionAction, onQuickReplyClick, onFollowUpActionClick }: ChatMessageBubbleProps) {
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

        {/* Suggestion Cards - render ALL suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            {message.suggestions.map((suggestion, index) => (
              <SuggestionCard
                key={`${message.id}-suggestion-${index}`}
                messageId={`${message.id}-${index}`}
                suggestion={suggestion}
                locale={locale}
                state={suggestionStates?.[`${message.id}-${index}`]}
                onAction={onSuggestionAction}
              />
            ))}
          </div>
        )}
        {/* Fallback for legacy single suggestion */}
        {!message.suggestions?.length && message.suggestion && (
          <SuggestionCard
            messageId={message.id}
            suggestion={message.suggestion}
            locale={locale}
            state={suggestionState}
            onAction={onSuggestionAction}
          />
        )}

        {/* Quick Reply Buttons for category selection */}
        {message.quickReplies && message.quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {message.quickReplies.map((reply) => (
              <button
                key={reply.id}
                onClick={() => onQuickReplyClick?.(reply.value, reply.label)}
                className="px-3 py-2 text-sm rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors flex items-center gap-1.5"
              >
                {reply.icon && <span>{reply.icon}</span>}
                <span>{reply.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Follow-up Action Buttons (more specific, easier, harder) */}
        {message.followUpActions && message.followUpActions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {message.followUpActions.map((action) => (
              <button
                key={action.id}
                onClick={() => onFollowUpActionClick?.(action.action, action.category)}
                className="px-3 py-1.5 text-xs rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
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
  const suggestionType = suggestion.suggestionType || (suggestion.type === 'goal' ? 'goal' : 'habit');
  const status = state?.status || 'pending';

  // Icons and labels based on suggestion type
  const typeConfig: Record<SuggestionButtonType, { icon: string; label: { ja: string; en: string }; color: string }> = {
    habit: { icon: '📝', label: { ja: 'Habit', en: 'Habit' }, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
    goal: { icon: '🎯', label: { ja: 'Goal', en: 'Goal' }, color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
    stickyn: { icon: '📌', label: { ja: "Sticky'n", en: "Sticky'n" }, color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
    reply: { icon: '💬', label: { ja: '回答', en: 'Reply' }, color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  };

  const config = typeConfig[suggestionType] || typeConfig.habit;

  // Handle clicking the card to open the modal (same as accept action)
  const handleCardClick = () => {
    if (status === 'loading') return;
    onAction?.(messageId, 'accept', suggestion);
  };

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
    <div className="mt-2 bg-card border border-border rounded-lg shadow-sm max-w-sm overflow-hidden">
      {/* Clickable card content - opens modal for review/edit */}
      <button
        type="button"
        onClick={handleCardClick}
        disabled={status === 'loading'}
        className="w-full p-3 text-left hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={locale === 'ja' ? '提案の詳細を確認' : 'Review suggestion details'}
      >
        <div className="flex items-start gap-2 mb-2">
          <span className="text-lg">{config.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-foreground">
                {(data.name as string) || (locale === 'ja' ? '提案' : 'Suggestion')}
              </h4>
              {/* Type badge */}
              <span className={`px-1.5 py-0.5 text-xs rounded ${config.color}`}>
                {config.label[locale]}
              </span>
            </div>
            {/* Frequency */}
            {typeof data.frequency === 'string' && data.frequency && (
              <p className="text-xs text-muted-foreground">
                {locale === 'ja' ? '頻度' : 'Frequency'}: {data.frequency}
              </p>
            )}
            {/* Estimated time per execution */}
            {typeof data.estimatedTime === 'string' && data.estimatedTime && (
              <p className="text-xs text-muted-foreground">
                {locale === 'ja' ? '所要時間' : 'Time'}: {data.estimatedTime}
              </p>
            )}
            {/* Estimated duration to achieve/establish */}
            {typeof data.estimatedDuration === 'string' && data.estimatedDuration && (
              <p className="text-xs text-muted-foreground font-medium">
                {locale === 'ja' ? '達成目安' : 'Duration'}: {data.estimatedDuration}
              </p>
            )}
          </div>
          {/* Arrow indicator to show clickability */}
          <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        {/* Description */}
        {typeof data.description === 'string' && data.description && (
          <p className="text-sm text-muted-foreground mb-2">
            {data.description}
          </p>
        )}
        {/* Rationale */}
        {typeof data.rationale === 'string' && data.rationale && (
          <p className="text-sm text-muted-foreground">
            {'💡 '}{data.rationale}
          </p>
        )}
        {/* Legacy reason field */}
        {typeof data.reason === 'string' && data.reason && !data.rationale && (
          <p className="text-sm text-muted-foreground">
            {'💡 '}{data.reason}
          </p>
        )}

        {/* Loading indicator */}
        {status === 'loading' && (
          <div className="flex items-center gap-2 mt-2 text-primary">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">{locale === 'ja' ? '処理中...' : 'Processing...'}</span>
          </div>
        )}
      </button>

      {/* Error message */}
      {status === 'error' && state?.error && (
        <p className="px-3 pb-2 text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      {/* Secondary action buttons (snooze/dismiss) - separated from clickable area */}
      <div className="flex gap-2 px-3 pb-3 pt-1 border-t border-border/50">
        {suggestion.actions
          .filter(action => action.variant !== 'primary') // Exclude primary (accept) button since clicking card does that
          .map(action => (
            <button
              key={action.id}
              onClick={(e) => {
                e.stopPropagation();
                onAction?.(messageId, action.id, suggestion);
              }}
              disabled={status === 'loading'}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                action.variant === 'secondary'
                  ? 'bg-muted text-foreground hover:bg-muted/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {action.label}
            </button>
          ))}
        {/* Hint text for clicking the card */}
        <span className="ml-auto text-xs text-muted-foreground self-center">
          {locale === 'ja' ? 'タップで詳細確認' : 'Tap to review'}
        </span>
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
  customAgents?: AgentConfig[];
  onSelectAgent?: (agentId: string) => void;
  onAddAgent?: () => void;
  onEditAgent?: (agentId: string) => void;
  onDeleteAgent?: (agentId: string) => void;
}

function AgentListView({ connections, locale, customAgents = [], onSelectAgent, onAddAgent, onEditAgent, onDeleteAgent }: AgentListViewProps) {
  const allMcpAgents = Array.from(connections.values()).flatMap(c => c.agents || []);
  const allTasks = Array.from(connections.values()).flatMap(c => c.tasks || []);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
    isBuiltIn = true,
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
    isBuiltIn?: boolean;
  }) => {
    const isExpanded = expandedNodes.has(id);
    const hasChildren = !!children;
    const currentTask = getAgentCurrentTask(id);
    const isHovered = hoveredAgent === id;
    const isConfirmingDelete = confirmDeleteId === id;

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
            className="group relative flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => onSelectAgent?.(id)}
            onMouseEnter={() => setHoveredAgent(id)}
            onMouseLeave={() => { setHoveredAgent(null); setConfirmDeleteId(null); }}
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
                {!isBuiltIn && (
                  <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                    {locale === 'ja' ? 'カスタム' : 'Custom'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {description || role}
              </p>
              {currentTask && (
                <p className="text-xs text-blue-600 dark:text-blue-400 truncate mt-0.5">
                  {currentTask.title}
                </p>
              )}
            </div>

            {/* Action buttons - show on hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Edit button (only for custom agents) */}
              {!isBuiltIn && onEditAgent && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEditAgent(id); }}
                  className="p-1.5 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                  title={locale === 'ja' ? '編集' : 'Edit'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
              {/* Delete button (only for custom agents) */}
              {!isBuiltIn && onDeleteAgent && (
                isConfirmingDelete ? (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { onDeleteAgent(id); setConfirmDeleteId(null); }}
                      className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                    >
                      {locale === 'ja' ? '削除' : 'Delete'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                    >
                      {locale === 'ja' ? 'X' : 'X'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(id); }}
                    className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title={locale === 'ja' ? '削除' : 'Delete'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )
              )}
            </div>

            {/* Tooltip */}
            {isHovered && !isConfirmingDelete && (
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

  // Role gradients for agents
  const roleGradients: Record<string, string> = {
    manager: 'from-amber-500 to-orange-500',
    developer: 'from-blue-500 to-cyan-500',
    reviewer: 'from-purple-500 to-pink-500',
    tester: 'from-green-500 to-emerald-500',
    architect: 'from-indigo-500 to-violet-500',
    devops: 'from-orange-500 to-red-500',
    analyst: 'from-cyan-500 to-teal-500',
    coach: 'from-purple-500 to-indigo-500',
    planner: 'from-indigo-500 to-blue-500',
    custom: 'from-pink-500 to-rose-500',
  };

  // Group custom agents by parent
  const getChildAgents = (parentId: string) => {
    return customAgents.filter(a => a.parentAgentId === parentId);
  };

  return (
    <div className="p-4 overflow-y-auto h-full">
      {/* Header with Add button */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {locale === 'ja' ? 'エージェントツリー' : 'Agent Tree'}
        </h3>
        {onAddAgent && (
          <button
            onClick={onAddAgent}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 border border-purple-300 dark:border-purple-600 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {locale === 'ja' ? '追加' : 'Add'}
          </button>
        )}
      </div>

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
          isBuiltIn={true}
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
            isBuiltIn={true}
          />

          {/* Habit Coach */}
          <TreeNode
            id="habit-coach"
            name="Habit Coach"
            role="Coach"
            icon="🎯"
            status="idle"
            gradient="from-blue-500 to-indigo-500"
            level={1}
            description={locale === 'ja' ? '習慣形成の専門家' : 'Habit Formation Expert'}
            isBuiltIn={true}
          />

          {/* Goal Planner */}
          <TreeNode
            id="goal-planner"
            name="Goal Planner"
            role="Planner"
            icon="📋"
            status="idle"
            gradient="from-indigo-500 to-blue-500"
            level={1}
            description={locale === 'ja' ? '目標設定・計画の専門家' : 'Goal & Planning Expert'}
            isBuiltIn={true}
          />

          {/* Progress Tracker */}
          <TreeNode
            id="progress-tracker"
            name="Progress Tracker"
            role="Analyst"
            icon="📊"
            status="idle"
            gradient="from-cyan-500 to-teal-500"
            level={1}
            description={locale === 'ja' ? '進捗追跡・分析の専門家' : 'Progress Tracking Expert'}
            isBuiltIn={true}
          />

          {/* Custom Agents under Manager */}
          {getChildAgents('manager').map(agent => (
            <TreeNode
              key={agent.id}
              id={agent.id}
              name={agent.name}
              role={agent.role}
              icon={agent.icon}
              status={agent.status}
              gradient={roleGradients[agent.role.toLowerCase()] || roleGradients.custom}
              level={1}
              description={agent.description}
              isBuiltIn={false}
            />
          ))}

          {/* MCP Agents - Children of Manager */}
          {allMcpAgents.map(agent => (
            <TreeNode
              key={agent.id}
              id={agent.id}
              name={agent.name}
              role={agent.role}
              icon={ROLE_ICONS[agent.role.toLowerCase()] || '🤖'}
              status={agent.status}
              gradient={roleGradients[agent.role.toLowerCase()] || 'from-gray-500 to-gray-600'}
              level={1}
              isBuiltIn={false}
            />
          ))}
        </TreeNode>
      </div>

      {/* Empty state for MCP agents */}
      {allMcpAgents.length === 0 && customAgents.length === 0 && (
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

      {/* Remote Agent Setup */}
      <RemoteAgentInstaller locale={locale} />

      {/* Remote Agent Setup Guide */}
      <RemoteAgentGuide locale={locale} />

      {/* Remote Task Execution */}
      <RemoteTaskExecutor locale={locale} />
    </div>
  );
}

// Remote Agent Installer Component
function RemoteAgentInstaller({ locale }: { locale: 'ja' | 'en' }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [installerConfig, setInstallerConfig] = useState<{
    serverUrl?: string;
    downloadUrl?: string;
    quickInstallCommand?: string;
    hasToken?: boolean;
  } | null>(null);
  const [token, setToken] = useState<string>('');
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [isCopied, setIsCopied] = useState<'command' | 'token' | null>(null);

  // Fetch installer config on expand
  useEffect(() => {
    if (isExpanded && !installerConfig) {
      // Try to fetch from API, fall back to default MCP server config
      fetch('/api/mcp-installer/config')
        .then(res => {
          if (!res.ok) {
            throw new Error('API not available');
          }
          return res.json();
        })
        .then(data => setInstallerConfig(data))
        .catch(() => {
          // Use default local MCP server config
          setInstallerConfig({
            serverUrl: 'http://localhost:3456',
            downloadUrl: 'https://raw.githubusercontent.com/example/mcp-installer/main/install.sh',
            quickInstallCommand: 'curl -sSL ... | bash',
            hasToken: true,
          });
        });
    }
  }, [isExpanded, installerConfig]);

  const handleShowToken = async () => {
    setIsLoadingToken(true);
    try {
      const res = await fetch('/api/mcp-installer/token');
      if (!res.ok) {
        throw new Error('API not available');
      }
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
      }
    } catch {
      // Use default token for local MCP server
      setToken('mcp-multi-agent-token-f75a6267');
    } finally {
      setIsLoadingToken(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'command' | 'token') => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(type);
      setTimeout(() => setIsCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="mt-6 pt-4 border-t border-border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left group"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🌐</span>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {locale === 'ja' ? 'リモートエージェント追加' : 'Remote Agent Setup'}
          </h4>
        </div>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-muted-foreground text-xs">
            {locale === 'ja'
              ? '別マシンでClaude Codeを実行し、このプロジェクトのMCPサーバーに接続できます。'
              : 'Run Claude Code on another machine and connect to this project\'s MCP server.'}
          </p>

          {installerConfig ? (
            <>
              {/* Server URL */}
              <div className="p-2 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">
                  {locale === 'ja' ? 'タスクサーバーURL' : 'Task Server URL'}
                </div>
                <code className="text-xs font-mono text-foreground">{installerConfig.serverUrl}</code>
              </div>

              {/* Quick Install Command */}
              <div className="p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-muted-foreground">
                    {locale === 'ja' ? 'ワンライナーインストール' : 'Quick Install'}
                  </div>
                  <button
                    onClick={() => copyToClipboard(
                      `curl -sSL ${installerConfig.downloadUrl} -o install.sh && chmod +x install.sh && ./install.sh --server-url ${installerConfig.serverUrl} --token ${token || 'YOUR_TOKEN'}`,
                      'command'
                    )}
                    className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400"
                  >
                    {isCopied === 'command' ? (locale === 'ja' ? 'コピー済み!' : 'Copied!') : (locale === 'ja' ? 'コピー' : 'Copy')}
                  </button>
                </div>
                <code className="text-xs font-mono text-foreground break-all block">
                  curl -sSL {installerConfig.downloadUrl} -o install.sh && ./install.sh --server-url {installerConfig.serverUrl} --token YOUR_TOKEN
                </code>
              </div>

              {/* Token Section */}
              <div className="p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-muted-foreground">
                    {locale === 'ja' ? '認証トークン' : 'Auth Token'}
                  </div>
                  {!token ? (
                    <button
                      onClick={handleShowToken}
                      disabled={isLoadingToken}
                      className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 disabled:opacity-50"
                    >
                      {isLoadingToken
                        ? (locale === 'ja' ? '取得中...' : 'Loading...')
                        : (locale === 'ja' ? 'トークンを表示' : 'Show Token')}
                    </button>
                  ) : (
                    <button
                      onClick={() => copyToClipboard(token, 'token')}
                      className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400"
                    >
                      {isCopied === 'token' ? (locale === 'ja' ? 'コピー済み!' : 'Copied!') : (locale === 'ja' ? 'コピー' : 'Copy')}
                    </button>
                  )}
                </div>
                {token ? (
                  <code className="text-xs font-mono text-foreground break-all block">{token}</code>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {locale === 'ja' ? 'クリックして表示' : 'Click to reveal'}
                  </p>
                )}
              </div>

              {/* Download Button */}
              <a
                href={installerConfig.downloadUrl}
                download="install.sh"
                className="flex items-center justify-center gap-2 w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {locale === 'ja' ? 'インストーラーをダウンロード' : 'Download Installer'}
              </a>
            </>
          ) : (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Remote Agent Setup Guide Component
function RemoteAgentGuide({ locale }: { locale: 'ja' | 'en' }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch documentation on expand
  useEffect(() => {
    if (isExpanded && !content) {
      setIsLoading(true);
      fetch('/docs/remote-mcp-agent-setup.md')
        .then(res => res.text())
        .then(text => setContent(text))
        .catch(err => {
          console.error('Failed to fetch documentation:', err);
          setContent(locale === 'ja'
            ? 'ドキュメントの読み込みに失敗しました。'
            : 'Failed to load documentation.');
        })
        .finally(() => setIsLoading(false));
    }
  }, [isExpanded, content, locale]);

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left group"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📖</span>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {locale === 'ja' ? 'セットアップガイド' : 'Setup Guide'}
          </h4>
        </div>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full" />
            </div>
          ) : content ? (
            <div className="max-h-96 overflow-y-auto pr-2 prose prose-sm dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-code:text-purple-600 dark:prose-code:text-purple-400 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-a:text-purple-600 dark:prose-a:text-purple-400 prose-table:text-xs prose-th:bg-muted prose-th:border prose-th:border-border prose-th:px-2 prose-th:py-1 prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1 max-w-none text-xs">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {locale === 'ja' ? 'ドキュメントを読み込み中...' : 'Loading documentation...'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Remote Task Executor Component
function RemoteTaskExecutor({ locale }: { locale: 'ja' | 'en' }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [workingDir, setWorkingDir] = useState('/home/ubuntu/Downloads/vow');
  const [isExecuting, setIsExecuting] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const executeTask = async () => {
    if (!prompt.trim()) return;

    setIsExecuting(true);
    setOutput([]);
    setErrors([]);
    setStatus('pending');
    setExitCode(null);

    try {
      // Create the remote task
      const res = await fetch('/api/agents/remote-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          workingDirectory: workingDir,
          timeoutMs: 30 * 60 * 1000, // 30 minutes
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors([data.error || 'Failed to create task']);
        setIsExecuting(false);
        setStatus('failed');
        return;
      }

      setTaskId(data.data.taskId);

      // Connect to SSE stream for output
      const eventSource = new EventSource(`/api/agents/remote-task/${data.data.taskId}/output`);

      eventSource.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'output') {
            setOutput(prev => [...prev, msg.data]);
          } else if (msg.type === 'error') {
            setErrors(prev => [...prev, msg.data]);
          } else if (msg.type === 'status') {
            setStatus(msg.status || msg.data);
          } else if (msg.type === 'exit') {
            setExitCode(msg.code);
            setStatus(msg.status || 'completed');
            setIsExecuting(false);
            eventSource.close();
          }
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        setIsExecuting(false);
        eventSource.close();
      };

    } catch (err) {
      setErrors([`Error: ${(err as Error).message}`]);
      setIsExecuting(false);
      setStatus('failed');
    }
  };

  const cancelTask = async () => {
    if (!taskId) return;

    try {
      await fetch(`/api/agents/remote-task/${taskId}/cancel`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Failed to cancel task:', err);
    }
  };

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, errors]);

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-500',
    running: 'bg-blue-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    cancelled: 'bg-yellow-500',
    timeout: 'bg-orange-500',
  };

  const statusLabels: Record<string, { ja: string; en: string }> = {
    pending: { ja: '待機中', en: 'Pending' },
    running: { ja: '実行中', en: 'Running' },
    completed: { ja: '完了', en: 'Completed' },
    failed: { ja: '失敗', en: 'Failed' },
    cancelled: { ja: 'キャンセル', en: 'Cancelled' },
    timeout: { ja: 'タイムアウト', en: 'Timeout' },
  };

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left group"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {locale === 'ja' ? 'リモートタスク実行' : 'Remote Task Execution'}
          </h4>
        </div>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          <p className="text-muted-foreground text-xs">
            {locale === 'ja'
              ? 'Claude Codeを使用してタスクをリモート実行します。'
              : 'Execute tasks remotely using Claude Code.'}
          </p>

          {/* Working Directory */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              {locale === 'ja' ? '作業ディレクトリ' : 'Working Directory'}
            </label>
            <input
              type="text"
              value={workingDir}
              onChange={(e) => setWorkingDir(e.target.value)}
              className="w-full px-2 py-1.5 text-xs font-mono bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="/home/ubuntu/Downloads/vow"
              disabled={isExecuting}
            />
          </div>

          {/* Prompt Input */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              {locale === 'ja' ? 'タスク内容' : 'Task Prompt'}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
              rows={4}
              placeholder={locale === 'ja' ? 'タスク内容を入力...' : 'Enter task prompt...'}
              disabled={isExecuting}
            />
          </div>

          {/* Execute / Cancel Buttons */}
          <div className="flex gap-2">
            {!isExecuting ? (
              <button
                onClick={executeTask}
                disabled={!prompt.trim()}
                className="flex-1 py-2 px-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {locale === 'ja' ? '実行' : 'Execute'}
              </button>
            ) : (
              <button
                onClick={cancelTask}
                className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {locale === 'ja' ? 'キャンセル' : 'Cancel'}
              </button>
            )}
          </div>

          {/* Status Display */}
          {status && (
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${statusColors[status] || 'bg-gray-500'} ${status === 'running' ? 'animate-pulse' : ''}`} />
              <span>{statusLabels[status]?.[locale] || status}</span>
              {exitCode !== null && (
                <span className="text-muted-foreground ml-2">
                  ({locale === 'ja' ? '終了コード' : 'Exit code'}: {exitCode})
                </span>
              )}
            </div>
          )}

          {/* Output Display */}
          {(output.length > 0 || errors.length > 0) && (
            <div
              ref={outputRef}
              className="h-48 overflow-y-auto bg-gray-900 text-gray-100 rounded-lg p-2 font-mono text-xs"
            >
              {output.map((line, i) => (
                <div key={`out-${i}`} className="whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))}
              {errors.map((line, i) => (
                <div key={`err-${i}`} className="whitespace-pre-wrap break-all text-red-400">
                  {line}
                </div>
              ))}
            </div>
          )}

          {/* Task ID */}
          {taskId && (
            <div className="text-xs text-muted-foreground">
              Task ID: <code className="font-mono text-foreground">{taskId}</code>
            </div>
          )}
        </div>
      )}
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
