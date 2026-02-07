/**
 * useMOCChat - MOC Section chat logic hook
 *
 * Manages chat messages, agent selection, message sending, and quick actions
 * for the Multi-agent Orchestration Center.
 *
 * @module hooks/useMOCChat
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useMultiAgentServer, type ServerConnection } from './useMultiAgentServer';
import { useMcpChat, type MastraMessage } from './useMcpChat';
import { useChatSessions } from './useChatSessions';
import type { McpServer } from '../types/agent.types';
import type { Goal, Habit } from '../types';
import type { AgentRole } from '../constants/role-prompts';
import { getRoleSystemPrompt, getRoleConfig, getAvailableRoles } from '../constants/role-prompts';
import type { ChatSession } from '../types/chat-session.types';
import type { AgentConfig } from '../components/Modal.AgentDetail';

// Re-export types needed by consumers
export type { MastraMessage };

// GroupChatMessage type
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
    suggestionType?: 'habit' | 'goal' | 'stickyn' | 'reply';
    data: Record<string, unknown>;
    actions: Array<{ id: string; label: string; variant: 'primary' | 'secondary' | 'ghost' }>;
  };
  suggestions?: Array<{
    type: 'habit' | 'goal';
    suggestionType?: 'habit' | 'goal' | 'stickyn' | 'reply';
    data: Record<string, unknown>;
    actions: Array<{ id: string; label: string; variant: 'primary' | 'secondary' | 'ghost' }>;
  }>;
  quickReplies?: Array<{
    id: string;
    label: string;
    value: string;
    icon?: string;
  }>;
  selectionType?: 'habit_category' | 'goal_category' | 'difficulty';
  followUpActions?: Array<{
    id: string;
    label: string;
    action: 'more_specific' | 'easier' | 'harder' | 'different' | 'more_suggestions' | 'different_habit';
    category?: string;
  }>;
  unifiedButtons?: Array<{
    type: string;
    [key: string]: unknown;
  }>;
  extractedMessage?: string;
}

// SelectableAgent type
export interface SelectableAgent {
  id: string;
  name: string;
  role: string;
  icon: string;
  type: 'coach' | 'mcp-agent';
  serverId?: string;
  status?: string;
}

export interface UseMOCChatOptions {
  authToken?: string;
  userId?: string;
  locale?: 'ja' | 'en';
  habits?: Habit[];
  goals?: Goal[];
  roleIcons: Record<string, string>;
  /** Initial role for the chat (default: 'AICoach') */
  initialRole?: AgentRole;
  /** Custom agents for custom role prompt lookup */
  customAgents?: AgentConfig[];
  // Parser functions
  parseSuggestions: (msg: MastraMessage) => GroupChatMessage['suggestions'] | undefined;
  parseQuickReplies: (msg: MastraMessage) => { quickReplies: GroupChatMessage['quickReplies']; selectionType?: GroupChatMessage['selectionType'] } | undefined;
  parseFollowUpActions: (msg: MastraMessage) => GroupChatMessage['followUpActions'] | undefined;
  parseUnifiedResponse: (content: string) => { message: string; buttons: Array<{ type: string; [key: string]: unknown }> } | undefined;
  formatActivityContent: (activity: { eventType: string; details?: Record<string, unknown> }) => string;
}

export interface UseMOCChatReturn {
  // Messages
  messages: GroupChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<GroupChatMessage[]>>;

  // Input
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;

  // Actions
  handleSendMessage: () => Promise<void>;
  handleQuickAction: (command: string) => void;
  handleQuickReplyClick: (value: string, label: string) => void;
  handleFollowUpActionClick: (action: string, category?: string) => void;
  handleRetry: () => void;

  // State
  isLoading: boolean;
  error: Error | null;
  activeAgent: ReturnType<typeof useMcpChat>;

  // Server info
  isConnected: boolean;
  connectedAgentCount: number;
  availableAgents: SelectableAgent[];

  // Quick actions
  quickActions: Array<{ id: string; label: string; command: string }>;

  // Server access for other hooks
  server: ReturnType<typeof useMultiAgentServer>;

  // Session management
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  currentRole: AgentRole;
  createSession: (role: AgentRole, name?: string) => ChatSession;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, newName: string) => void;
  canCreateSession: boolean;
  availableRoles: Array<{ id: AgentRole; name: string; icon: string; description: string }>;
}

/**
 * Hook for managing MOC chat functionality
 */
export function useMOCChat({
  authToken,
  userId,
  locale = 'ja',
  habits = [],
  goals = [],
  roleIcons,
  initialRole = 'AICoach',
  customAgents = [],
  parseSuggestions,
  parseQuickReplies,
  parseFollowUpActions,
  parseUnifiedResponse,
  formatActivityContent,
}: UseMOCChatOptions): UseMOCChatReturn {
  // State
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Session management hook
  const sessionManager = useChatSessions({
    userId,
    locale,
    onSessionChange: (session) => {
      console.log('[useMOCChat] Session changed:', session?.id, session?.role);
      // Clear messages when switching sessions (they'll be loaded from MCP server memory)
      setMessages([]);
    },
  });

  // Get current role from active session or use initial role
  const currentRole: AgentRole = sessionManager.activeSession?.role || initialRole;

  // Get role-based system prompt (custom agent prompt takes priority)
  const roleSystemPrompt = useMemo(() => {
    // Check custom agents first for a matching role's systemPrompt
    const customAgent = customAgents.find(a => a.role === currentRole || a.id === currentRole);
    if (customAgent?.systemPrompt) {
      console.log('[useMOCChat] Using custom agent system prompt:', {
        role: currentRole,
        agentId: customAgent.id,
        promptLength: customAgent.systemPrompt.length,
      });
      return customAgent.systemPrompt;
    }

    // Fall back to built-in role prompt
    const prompt = getRoleSystemPrompt(currentRole, locale);
    console.log('[useMOCChat] Role system prompt loaded:', {
      role: currentRole,
      locale,
      promptLength: prompt?.length ?? 0,
    });
    return prompt;
  }, [currentRole, locale, customAgents]);

  // Available roles for selection
  const availableRoles = useMemo(() => getAvailableRoles(locale), [locale]);

  // Server hook
  const server = useMultiAgentServer({ authToken });

  // Available agents for selection (AI Coach + custom roles + connected MCP agents)
  const availableAgents = useMemo((): SelectableAgent[] => {
    const agents: SelectableAgent[] = [
      // AI Coach is the built-in role (always available)
      {
        id: 'AICoach',
        name: 'AI Coach',
        role: 'Coach',
        icon: roleIcons.coach || '🎯',
        type: 'coach',
      },
    ];

    // Add custom agents as selectable roles
    customAgents.forEach(agent => {
      agents.push({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        icon: agent.icon || '🤖',
        type: 'coach',
      });
    });

    // Add connected MCP agents
    server.agents.forEach(agent => {
      agents.push({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        icon: roleIcons[agent.role.toLowerCase()] || roleIcons.developer,
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
  }, [server.agents, locale, roleIcons, customAgents]);

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

  // Get the MCP session ID for the current session
  const mcpSessionId = useMemo(() => {
    if (sessionManager.activeSession) {
      return sessionManager.getMcpSessionId(sessionManager.activeSession.id);
    }
    return undefined;
  }, [sessionManager.activeSession, sessionManager]);

  // MCP chat hook - with role-based system prompt
  const mcpChat = useMcpChat({
    server: selectedMcpServer,
    agentId: selectedMcpAgentId,
    settings: server.chatAgentSettings,
    enableStreaming: true,
    systemMessage: roleSystemPrompt,
    userId: userId,
    onError: (error) => {
      console.error('[useMOCChat] MCP chat error:', error);
    },
  });

  // Active chat agent - always MCP
  const activeAgent = mcpChat;

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
            senderIcon: roleIcons[role.toLowerCase()] || roleIcons.developer,
            content: formatActivityContent(activity),
            timestamp: new Date(activity.createdAt),
            taskId: activity.taskId,
            taskTitle: activity.taskTitle,
          };
          setMessages(prev => [...prev, newMessage]);
        }
      });
    });
  }, [server.connections, messages, roleIcons, formatActivityContent]);

  // Handle sending message
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || activeAgent.isStreaming) return;

    const userMessage: GroupChatMessage = {
      id: `user-${Date.now()}`,
      senderId: 'user',
      senderName: 'You',
      senderType: 'user',
      senderIcon: roleIcons.user,
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
      console.log('[useMOCChat] Sending message via MCP agent');
      await activeAgent.sendMessage(messageText);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderType: 'system',
        senderIcon: roleIcons.system,
        content: locale === 'ja' ? '❌ AIへの問い合わせに失敗しました' : '❌ Failed to query AI',
        timestamp: new Date(),
      }]);
    }
  }, [inputValue, activeAgent, locale, roleIcons]);

  // Convert active agent messages to group chat format
  useEffect(() => {
    console.log('[useMOCChat useEffect] Processing activeAgent.messages:', {
      agentType: 'MCP',
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

          // Only parse toolCalls when message is complete
          const isComplete = msg.status === 'complete';
          const suggestions = isComplete && msg.toolCalls?.length ? parseSuggestions(msg) : undefined;
          const quickRepliesResult = isComplete && msg.toolCalls?.length ? parseQuickReplies(msg) : undefined;
          const quickReplies = quickRepliesResult?.quickReplies;
          const selectionType = quickRepliesResult?.selectionType;
          const followUpActions = isComplete && msg.toolCalls?.length ? parseFollowUpActions(msg) : undefined;

          // Debug logging for toolCalls and suggestions
          if (isComplete && msg.toolCalls?.length) {
            console.log('[useMOCChat] Message complete with toolCalls:', {
              messageId: msg.id,
              toolCallCount: msg.toolCalls.length,
              toolNames: msg.toolCalls.map(tc => tc.toolName),
              parsedSuggestions: suggestions,
              parsedQuickReplies: quickReplies,
              parsedFollowUpActions: followUpActions,
            });
          }

          const existingIdx = updated.findIndex(m => m.id === messageId);

          // Parse unified JSON response from content
          const unifiedResponse = isComplete ? parseUnifiedResponse(msg.content || '') : undefined;
          const unifiedButtons = unifiedResponse?.buttons;
          const extractedMessage = unifiedResponse?.message;

          // Log unified response parsing
          if (unifiedResponse) {
            console.log('[useMOCChat] Parsed unified response:', {
              messageId,
              extractedMessage: extractedMessage?.substring(0, 50) + '...',
              buttonCount: unifiedButtons?.length ?? 0,
              buttonTypes: unifiedButtons?.map(b => b.type),
            });
          }

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
              content: extractedMessage || msg.content || '',
              timestamp: msg.timestamp || new Date(),
              suggestions,
              suggestion: suggestions?.[0],
              quickReplies,
              selectionType,
              followUpActions,
              unifiedButtons,
              extractedMessage,
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
            const hasNewUnifiedButtons = unifiedButtons && unifiedButtons.length > 0 &&
              (!existingMsg.unifiedButtons || existingMsg.unifiedButtons.length === 0);
            const contentChanged = existingMsg.content !== msg.content;

            if (hasNewSuggestions || hasNewQuickReplies || hasNewFollowUpActions || hasNewUnifiedButtons || contentChanged) {
              hasChanges = true;
              updated[existingIdx] = {
                ...existingMsg,
                suggestions: suggestions || existingMsg.suggestions,
                suggestion: suggestions?.[0] || existingMsg.suggestion,
                quickReplies: quickReplies || existingMsg.quickReplies,
                selectionType: selectionType || existingMsg.selectionType,
                followUpActions: followUpActions || existingMsg.followUpActions,
                unifiedButtons: unifiedButtons || existingMsg.unifiedButtons,
                extractedMessage: extractedMessage || existingMsg.extractedMessage,
                content: extractedMessage || msg.content || existingMsg.content,
              };
            }
          }
        }
      });

      return hasChanges ? updated : prev;
    });
  }, [activeAgent.messages, parseSuggestions, parseQuickReplies, parseFollowUpActions, parseUnifiedResponse]);

  // Quick actions
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
    const unassessedHabits = habits.filter(h => h.level === null || h.level === undefined);
    if (unassessedHabits.length > 0) {
      contextualActions.push({
        id: 'assess-levels',
        label: locale === 'ja' ? `📐 ${unassessedHabits.length}件のレベル設定` : `📐 Set ${unassessedHabits.length} levels`,
        command: locale === 'ja' ? '既存の習慣のレベル設定をして下さい' : 'Please help me set levels for my existing habits',
      });
    }

    // Check for goals without habits
    const goalsWithoutHabits = goals.filter(g => {
      const goalHabits = habits.filter(h => h.goalId === g.id);
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
    const userMessage: GroupChatMessage = {
      id: `user-${Date.now()}`,
      senderId: 'user',
      senderName: 'You',
      senderType: 'user',
      senderIcon: roleIcons.user,
      content: command,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    activeAgent.sendMessage(command);
  }, [activeAgent, roleIcons]);

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
      categoryMessage = locale === 'ja'
        ? `${label}の目標を提案して`
        : `Suggest ${label} goals`;
    } else {
      // Default to habit category
      categoryMessage = locale === 'ja'
        ? `${label}の習慣を提案して`
        : `Suggest ${label} habits`;
    }

    const userMessage: GroupChatMessage = {
      id: `user-${Date.now()}`,
      senderId: 'user',
      senderName: 'You',
      senderType: 'user',
      senderIcon: roleIcons.user,
      content: categoryMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    activeAgent.sendMessage(categoryMessage);
  }, [messages, activeAgent, locale, roleIcons]);

  const handleFollowUpActionClick = useCallback((action: string, category?: string) => {
    let message = '';
    if (action === 'more_specific') {
      message = locale === 'ja' ? 'もっと具体的な習慣を提案して' : 'Suggest more specific habits';
    } else if (action === 'easier') {
      message = locale === 'ja' ? 'もっと簡単な習慣を提案して' : 'Suggest easier habits';
    } else if (action === 'harder') {
      message = locale === 'ja' ? 'もっとチャレンジングな習慣を提案して' : 'Suggest more challenging habits';
    } else if (action === 'different') {
      message = locale === 'ja' ? '別の習慣を提案して' : 'Suggest different habits';
    } else if (action === 'more_suggestions') {
      message = locale === 'ja' ? 'もっと多くの習慣を提案して' : 'Suggest more habits';
    } else if (action === 'different_habit' && category) {
      message = locale === 'ja' ? `${category}の別の習慣を提案して` : `Suggest different ${category} habits`;
    }

    if (message) {
      const userMessage: GroupChatMessage = {
        id: `user-${Date.now()}`,
        senderId: 'user',
        senderName: 'You',
        senderType: 'user',
        senderIcon: roleIcons.user,
        content: message,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
      activeAgent.sendMessage(message);
    }
  }, [activeAgent, locale, roleIcons]);

  const handleRetry = useCallback(() => {
    activeAgent.retry();
  }, [activeAgent]);

  // Update session activity when messages are sent
  useEffect(() => {
    if (sessionManager.activeSession && messages.length > 0) {
      sessionManager.updateSessionActivity(
        sessionManager.activeSession.id,
        messages.filter(m => m.senderType === 'user' || m.senderType === 'coach').length
      );
    }
  }, [messages.length, sessionManager.activeSession, sessionManager]);

  return {
    messages,
    setMessages,
    inputValue,
    setInputValue,
    textareaRef,
    handleSendMessage,
    handleQuickAction,
    handleQuickReplyClick,
    handleFollowUpActionClick,
    handleRetry,
    isLoading: activeAgent.isStreaming,
    error: activeAgent.error,
    activeAgent,
    isConnected,
    connectedAgentCount,
    availableAgents,
    quickActions,
    server,
    // Session management
    sessions: sessionManager.sessions,
    activeSession: sessionManager.activeSession,
    currentRole,
    createSession: sessionManager.createSession,
    switchSession: sessionManager.switchSession,
    deleteSession: sessionManager.deleteSession,
    renameSession: sessionManager.renameSession,
    canCreateSession: sessionManager.canCreateSession,
    availableRoles,
  };
}
