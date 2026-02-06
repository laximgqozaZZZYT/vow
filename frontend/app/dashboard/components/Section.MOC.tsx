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
import type {
  TabId,
  GroupChatMessage,
  MOCSectionProps,
  TaskWithDetail,
  HistoryFilter,
  AgentResponse,
  AggregationSession,
} from '../types/moc.types';
import { TABS, ROLE_ICONS } from '../types/moc.types';
import { getRoleSystemPrompt } from '../constants/role-prompts';
// AI Candidate Response types and utilities
import type {
  AICandidateResponse,
  GoalCandidate,
  HabitCandidate,
  StickyCandidate,
  ReplyCandidate,
} from '../types/ai-candidate-response';
import {
  extractAICandidateResponse,
  createDebugModeResponse,
} from '../types/ai-candidate-response';
import { CandidateDisplay } from './Chat.CandidateDisplay';
import api from '../../../lib/api';
import { HabitModal } from './Modal.Habit';
import { GoalModal } from './Modal.Goal';
import { StickyModal } from './Modal.Sticky';
import { AgentDetailModal, BUILTIN_AGENTS, ROLE_ICONS as AGENT_ROLE_ICONS, type AgentConfig } from './Modal.AgentDetail';
import { IssueModal, type ConversationData, type ConversationMessage } from './Modal.Issue';
import ReactMarkdown from 'react-markdown';
import { ChatMessageBubble } from './Chat.MessageBubble';
import { AgentListView } from './Agent.ListView';
import { RemoteAgentInstaller } from './Agent.RemoteInstaller';
import { RemoteAgentGuide } from './Agent.RemoteGuide';
import { RemoteTaskExecutor } from './Agent.RemoteTaskExecutor';

// Type definitions moved to types/moc.types.ts
// Re-export commonly used types for backward compatibility
export type { GroupChatMessage } from '../types/moc.types';

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
  userId,
}: MOCSectionProps) {
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  // selectedAgent state removed - manager-only mode is now default


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

  // AI Candidate responses (parsed from AI messages)
  // Key: message ID, Value: parsed candidate response
  const [candidateResponses, setCandidateResponses] = useState<Map<string, AICandidateResponse>>(new Map());

  // Adopted candidates for batch registration
  // Key: candidateId, Value: { type, candidate }
  type AdoptedCandidate = {
    type: 'Goal' | 'Habit' | "Sticky'n";
    candidate: GoalCandidate | HabitCandidate | StickyCandidate;
  };
  const [adoptedCandidates, setAdoptedCandidates] = useState<Map<string, AdoptedCandidate>>(new Map());
  const [adoptionStates, setAdoptionStates] = useState<Map<string, 'pending' | 'adopted' | 'rejected'>>(new Map());
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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

  // Get AI Coach system prompt for JSON format responses
  const aiCoachSystemPrompt = useMemo(() => {
    const prompt = getRoleSystemPrompt('coach', locale);
    console.log('[MOCSection] AI Coach system prompt loaded:', {
      locale,
      promptLength: prompt?.length ?? 0,
    });
    return prompt;
  }, [locale]);

  // MCP chat hook - no automatic fallback, let user see errors and retry
  // userId is passed for user-specific session isolation
  // systemMessage is the AI Coach prompt that instructs JSON format response
  const mcpChat = useMcpChat({
    server: selectedMcpServer,
    agentId: selectedMcpAgentId,
    settings: server.chatAgentSettings,
    enableStreaming: true,
    systemMessage: aiCoachSystemPrompt,  // AI Coach system prompt for JSON responses
    userId: userId,
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

  // handleSendMessage is defined below after candidate response handlers

  // Convert active agent messages to group chat format with candidate label support
  // Using a single batch update to avoid race conditions with multiple setMessages calls
  useEffect(() => {
    console.log('[MOC useEffect] Processing activeAgent.messages:', {
      agentType: shouldUseMcpAgent ? 'MCP' : 'Mastra',
      count: activeAgent.messages.length,
      messages: activeAgent.messages.map(m => ({
        id: m.id,
        role: m.role,
        status: m.status,
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
          const displayContent = msg.content || '';

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
              content: displayContent,
              timestamp: msg.timestamp || new Date(),
            });
          } else {
            const existingMsg = updated[existingIdx];
            const contentChanged = existingMsg.content !== displayContent;

            if (contentChanged) {
              hasChanges = true;
              updated[existingIdx] = {
                ...existingMsg,
                content: displayContent || existingMsg.content,
              };
            }
          }
        }
      });

      return hasChanges ? updated : prev;
    });
  }, [activeAgent.messages, shouldUseMcpAgent]); // Depend on activeAgent.messages

  // Parse AI candidate responses from messages
  useEffect(() => {
    const newCandidates = new Map<string, AICandidateResponse>();

    messages.forEach(msg => {
      if (msg.senderType === 'coach' && msg.content) {
        // Try to parse as AI candidate response
        const parsed = extractAICandidateResponse(msg.content);
        if (parsed) {
          newCandidates.set(msg.id, parsed);
        }
      }
    });

    // Only update if there are changes
    if (newCandidates.size !== candidateResponses.size ||
        Array.from(newCandidates.keys()).some(k => !candidateResponses.has(k))) {
      setCandidateResponses(newCandidates);

      // 新しい候補が来たら自動で採用状態にする
      // candidateIdはCandidateDisplayと同じ形式: `${type}-${index}-${label}`
      const newAdopted = new Map(adoptedCandidates);
      const newAdoptionStates = new Map(adoptionStates);
      let hasNewCandidates = false;

      newCandidates.forEach((response) => {
        // Goal候補を自動採用
        response.goals?.forEach((goal, index) => {
          const candidateId = `goal-${index}-${goal.label}`;
          if (!adoptedCandidates.has(candidateId)) {
            newAdopted.set(candidateId, { type: 'Goal', candidate: goal });
            newAdoptionStates.set(candidateId, 'adopted');
            hasNewCandidates = true;
          }
        });

        // Habit候補を自動採用
        response.habits?.forEach((habit, index) => {
          const candidateId = `habit-${index}-${habit.label}`;
          if (!adoptedCandidates.has(candidateId)) {
            newAdopted.set(candidateId, { type: 'Habit', candidate: habit });
            newAdoptionStates.set(candidateId, 'adopted');
            hasNewCandidates = true;
          }
        });

        // Orphan習慣 (Goalに紐づいていない習慣)も自動採用
        const orphanHabits = response.habits?.filter(h => !h.parentGoalId) || [];
        orphanHabits.forEach((habit, index) => {
          const candidateId = `orphan-habit-${index}-${habit.label}`;
          if (!adoptedCandidates.has(candidateId)) {
            newAdopted.set(candidateId, { type: 'Habit', candidate: habit });
            newAdoptionStates.set(candidateId, 'adopted');
            hasNewCandidates = true;
          }
        });
      });

      if (hasNewCandidates) {
        setAdoptedCandidates(newAdopted);
        setAdoptionStates(newAdoptionStates);
      }
    }
  }, [messages, candidateResponses, adoptedCandidates, adoptionStates]);

  // Batch registration handler
  const handleBatchRegister = useCallback(async () => {
    if (adoptedCandidates.size === 0) return;

    setIsRegistering(true);
    setRegistrationMessage(null);

    let successCount = 0;
    let errorCount = 0;

    for (const [candidateId, { type, candidate }] of adoptedCandidates) {
      try {
        if (type === 'Goal') {
          const goalCandidate = candidate as GoalCandidate;
          const createdGoal = await api.createGoal({
            name: goalCandidate.detail.name,
            details: goalCandidate.detail.details || '',
            dueDate: goalCandidate.detail.dueDate || null,
            parentId: goalCandidate.detail.parentId || null,
          });
          if (createdGoal) {
            onGoalCreated?.(createdGoal as Goal);
          }
          successCount++;
        } else if (type === 'Habit') {
          const habitCandidate = candidate as HabitCandidate;
          const createdHabit = await api.createHabit({
            name: habitCandidate.detail.name,
            type: habitCandidate.detail.habitType || 'do',
            must: habitCandidate.detail.must || 1,
            duration: habitCandidate.detail.duration || null,
            repeat: habitCandidate.detail.repeat || 'daily',
            time: habitCandidate.detail.time || null,
            endTime: habitCandidate.detail.endTime || null,
            dueDate: habitCandidate.detail.dueDate || null,
            allDay: habitCandidate.detail.allDay || false,
            goalId: habitCandidate.detail.goalId || null,
            notes: habitCandidate.detail.notes || '',
          });
          if (createdHabit) {
            onHabitCreated?.(createdHabit as Habit);
          }
          successCount++;
        } else if (type === "Sticky'n") {
          const stickyCandidate = candidate as StickyCandidate;
          const createdSticky = await api.createSticky({
            name: stickyCandidate.detail.name,
            description: stickyCandidate.detail.description || '',
            completed: stickyCandidate.detail.completed || false,
            displayOrder: stickyCandidate.detail.displayOrder || 0,
            parentStickyId: stickyCandidate.detail.parentStickyId || null,
          });
          if (createdSticky) {
            onStickyCreated?.(createdSticky as Sticky);
          }
          successCount++;
        }
      } catch (error) {
        console.error(`Failed to register ${type}:`, error);
        errorCount++;
      }
    }

    // Clear adopted candidates after registration
    setAdoptedCandidates(new Map());
    setAdoptionStates(new Map());
    setIsRegistering(false);

    // Show success/error message
    if (errorCount === 0) {
      setRegistrationMessage({
        type: 'success',
        text: locale === 'ja'
          ? `${successCount}件を登録しました`
          : `Registered ${successCount} item(s)`,
      });
    } else {
      setRegistrationMessage({
        type: 'error',
        text: locale === 'ja'
          ? `${successCount}件登録、${errorCount}件失敗`
          : `Registered ${successCount}, failed ${errorCount}`,
      });
    }

    // Clear message after 3 seconds
    setTimeout(() => setRegistrationMessage(null), 3000);
  }, [adoptedCandidates, locale, onGoalCreated, onHabitCreated, onStickyCreated]);

  // Handle sending message - with debug mode and candidate support
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || activeAgent.isStreaming) return;

    const messageText = inputValue.trim();
    setInputValue('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    console.log(`[MOCSection] Sending message via ${shouldUseMcpAgent ? 'MCP agent' : 'Mastra agent'}`);

    // Check for debug mode trigger
    if (messageText === '候補表示テスト') {
      // Add user message
      const userMessage: GroupChatMessage = {
        id: `user-${Date.now()}`,
        senderId: 'user',
        senderName: 'You',
        senderType: 'user',
        senderIcon: ROLE_ICONS.user,
        content: messageText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);

      // Add debug response with all candidate types
      const debugResponse = createDebugModeResponse();
      const debugMessageId = `ai-debug-${Date.now()}`;
      const debugMessage: GroupChatMessage = {
        id: debugMessageId,
        senderId: 'ai',
        senderName: 'AI',
        senderType: 'coach',
        senderRole: 'Coach',
        senderIcon: '🤖',
        content: JSON.stringify(debugResponse, null, 2),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, debugMessage]);

      // Add to candidate responses
      setCandidateResponses(prev => {
        const newMap = new Map(prev);
        newMap.set(debugMessageId, debugResponse);
        return newMap;
      });
      return;
    }

    // Registration keyword detection
    const registrationKeywords = [
      // 既存
      '登録したい', '登録して', '登録する', '登録お願い',
      'これで登録', 'まとめて登録', '一括登録',
      'register', 'save these', 'save them',
      // 採用・確認系
      '採用', 'これで採用', 'このまま採用', 'いい感じ',
      'これでOK', 'OK', 'いいね', '決定', 'これにする',
      '確定', 'confirm', 'looks good', 'perfect'
    ];

    const messageTextLower = messageText.toLowerCase();
    const shouldAutoRegister = registrationKeywords.some(kw =>
      messageTextLower.includes(kw.toLowerCase())
    );

    if (shouldAutoRegister && adoptedCandidates.size > 0) {
      // Add user message first
      const userMessage: GroupChatMessage = {
        id: `user-${Date.now()}`,
        senderId: 'user',
        senderName: 'You',
        senderType: 'user',
        senderIcon: ROLE_ICONS.user,
        content: messageText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);

      // Execute batch registration
      await handleBatchRegister();
      return;
    }

    // Normal message handling - delegate to original handler
    const userMessage: GroupChatMessage = {
      id: `user-${Date.now()}`,
      senderId: 'user',
      senderName: 'You',
      senderType: 'user',
      senderIcon: ROLE_ICONS.user,
      content: messageText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
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
  }, [inputValue, activeAgent, shouldUseMcpAgent, locale, adoptedCandidates, handleBatchRegister]);

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

  // Handle candidate adoption state change (toggle)
  const handleGoalAdoptionChange = useCallback((candidate: GoalCandidate, isAdopted: boolean, candidateId: string) => {
    setAdoptionStates(prev => {
      const next = new Map(prev);
      next.set(candidateId, isAdopted ? 'adopted' : 'pending');
      return next;
    });
    setAdoptedCandidates(prev => {
      const next = new Map(prev);
      if (isAdopted) {
        next.set(candidateId, { type: 'Goal', candidate });
      } else {
        next.delete(candidateId);
      }
      return next;
    });
  }, []);

  const handleHabitAdoptionChange = useCallback((candidate: HabitCandidate, isAdopted: boolean, candidateId: string) => {
    setAdoptionStates(prev => {
      const next = new Map(prev);
      next.set(candidateId, isAdopted ? 'adopted' : 'pending');
      return next;
    });
    setAdoptedCandidates(prev => {
      const next = new Map(prev);
      if (isAdopted) {
        next.set(candidateId, { type: 'Habit', candidate });
      } else {
        next.delete(candidateId);
      }
      return next;
    });
  }, []);

  const handleStickyAdoptionChange = useCallback((candidate: StickyCandidate, isAdopted: boolean, candidateId: string) => {
    setAdoptionStates(prev => {
      const next = new Map(prev);
      next.set(candidateId, isAdopted ? 'adopted' : 'pending');
      return next;
    });
    setAdoptedCandidates(prev => {
      const next = new Map(prev);
      if (isAdopted) {
        next.set(candidateId, { type: "Sticky'n", candidate });
      } else {
        next.delete(candidateId);
      }
      return next;
    });
  }, []);

  // Handle card click - opens modal for detail view (no registration)
  const handleGoalCardClick = useCallback((candidate: GoalCandidate) => {
    openGoalModal({
      name: candidate.detail.name,
      parentId: candidate.detail.parentId,
    });
  }, [openGoalModal]);

  const handleHabitCardClick = useCallback((candidate: HabitCandidate) => {
    openHabitModal({
      name: candidate.detail.name,
      type: candidate.detail.habitType || 'do',
      goalId: candidate.detail.goalId,
    });
  }, [openHabitModal]);

  const handleStickyCardClick = useCallback((candidate: StickyCandidate) => {
    openStickyModal({
      name: candidate.detail.name,
      description: candidate.detail.description || undefined,
    });
  }, [openStickyModal]);

  const handleReplyCandidateSelect = useCallback(async (candidate: ReplyCandidate) => {
    // Send the reply label as a user message
    const userMessage: GroupChatMessage = {
      id: `user-${Date.now()}`,
      senderId: 'user',
      senderName: 'You',
      senderType: 'user',
      senderIcon: ROLE_ICONS.user,
      content: candidate.label,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // confirmアクションの場合、採用済み候補があれば一括登録
    if (candidate.detail?.action === 'confirm' && adoptedCandidates.size > 0) {
      await handleBatchRegister();
      return;
    }

    // 通常のAI送信
    activeAgent.sendMessage(candidate.label);
  }, [activeAgent, adoptedCandidates, handleBatchRegister]);

  // Copy chat history to clipboard
  const [copySuccess, setCopySuccess] = useState(false);
  const handleCopyChatHistory = useCallback(async () => {
    if (messages.length === 0) return;

    const formattedHistory = messages
      .filter(msg => msg.senderType !== 'system') // システムメッセージは除外
      .map(msg => {
        const senderLabel = msg.senderType === 'user'
          ? 'ユーザー'
          : 'チャットボット';
        return `${senderLabel}:\n${msg.content}`;
      })
      .join('\n');

    try {
      await navigator.clipboard.writeText(formattedHistory);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy chat history:', err);
    }
  }, [messages]);

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
          {/* Copy chat history button */}
          <button
            onClick={handleCopyChatHistory}
            disabled={messages.length === 0}
            className={`p-2 rounded-lg transition-colors ${
              copySuccess
                ? 'text-green-500 bg-green-100 dark:bg-green-900/30'
                : messages.length === 0
                  ? 'text-muted-foreground/50 cursor-not-allowed'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            title={locale === 'ja' ? 'チャット履歴をコピー' : 'Copy chat history'}
          >
            {copySuccess ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
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
                error={activeAgent.error}
                onRetry={handleRetry}
                candidateResponses={candidateResponses}
                onGoalAdoptionChange={handleGoalAdoptionChange}
                onHabitAdoptionChange={handleHabitAdoptionChange}
                onStickyAdoptionChange={handleStickyAdoptionChange}
                onGoalClick={handleGoalCardClick}
                onHabitClick={handleHabitCardClick}
                onStickyClick={handleStickyCardClick}
                onReplySelect={handleReplyCandidateSelect}
                adoptionStates={adoptionStates}
              />
            </div>

            {/* Batch Registration Bar - shown when there are adopted candidates */}
            {adoptedCandidates.size > 0 && (
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-green-50 dark:bg-green-900/20 border-t border-green-200 dark:border-green-800">
                <span className="text-sm text-green-700 dark:text-green-300">
                  {locale === 'ja'
                    ? `${adoptedCandidates.size}件の候補を選択中`
                    : `${adoptedCandidates.size} candidate(s) selected`}
                </span>
                <button
                  onClick={handleBatchRegister}
                  disabled={isRegistering}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isRegistering ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {locale === 'ja' ? '登録中...' : 'Registering...'}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {locale === 'ja' ? 'まとめて登録' : 'Register All'}
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Registration Success/Error Message */}
            {registrationMessage && (
              <div className={`flex-shrink-0 px-4 py-2 text-sm text-center ${
                registrationMessage.type === 'success'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              }`}>
                {registrationMessage.text}
              </div>
            )}

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
  error?: Error | null;
  onRetry?: () => void;
  // Candidate display props (new toggle-based API)
  candidateResponses?: Map<string, AICandidateResponse>;
  onGoalAdoptionChange?: (candidate: GoalCandidate, isAdopted: boolean, candidateId: string) => void;
  onHabitAdoptionChange?: (candidate: HabitCandidate, isAdopted: boolean, candidateId: string) => void;
  onStickyAdoptionChange?: (candidate: StickyCandidate, isAdopted: boolean, candidateId: string) => void;
  onGoalClick?: (candidate: GoalCandidate) => void;
  onHabitClick?: (candidate: HabitCandidate) => void;
  onStickyClick?: (candidate: StickyCandidate) => void;
  onReplySelect?: (candidate: ReplyCandidate) => void;
  adoptionStates?: Map<string, 'pending' | 'adopted' | 'rejected'>;
}

function GroupChatView({
  messages,
  isLoading,
  locale,
  messagesEndRef,
  error,
  onRetry,
  candidateResponses,
  onGoalAdoptionChange,
  onHabitAdoptionChange,
  onStickyAdoptionChange,
  onGoalClick,
  onHabitClick,
  onStickyClick,
  onReplySelect,
  adoptionStates,
}: GroupChatViewProps) {
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
          {messages.map((msg, index) => {
            const candidateResponse = candidateResponses?.get(msg.id);
            const isLastInGroup = index === messages.length - 1 || messages[index + 1]?.senderId !== msg.senderId;

            return (
              <React.Fragment key={msg.id}>
                <ChatMessageBubble
                  message={msg}
                  locale={locale}
                  isFirstInGroup={index === 0 || messages[index - 1]?.senderId !== msg.senderId}
                  isLastInGroup={isLastInGroup}
                  displayContent={candidateResponse?.message}
                />
                {/* Show CandidateDisplay for messages with parsed candidates */}
                {candidateResponse && isLastInGroup && (
                  <div className="ml-13 pl-3">
                    <CandidateDisplay
                      response={candidateResponse}
                      locale={locale}
                      onGoalAdoptionChange={onGoalAdoptionChange}
                      onHabitAdoptionChange={onHabitAdoptionChange}
                      onStickyAdoptionChange={onStickyAdoptionChange}
                      onGoalClick={onGoalClick}
                      onHabitClick={onHabitClick}
                      onStickyClick={onStickyClick}
                      onReplySelect={onReplySelect}
                      adoptionStates={adoptionStates}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
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

// ChatMessageBubble component moved to Chat.MessageBubble.tsx

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

  return (
    <div className="space-y-3">
      {/* Filter & Search */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-1">{filterOpts.map(opt => (
          <button
            key={opt.value}
            onClick={() => setActiveFilter(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeFilter === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            }`}
          >
            <span className="mr-1">{opt.icon}</span>
            {opt.label}
          </button>
        ))}</div>

        {/* Search Input */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={activeSearch}
            onChange={(e) => setActiveSearch(e.target.value)}
            placeholder={locale === 'ja' ? '検索...' : 'Search...'}
            className="w-full px-3 py-1.5 text-xs bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Messages List */}
      <div className="space-y-2">
        {filteredMsgs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {locale === 'ja' ? 'メッセージがありません' : 'No messages'}
          </div>
        ) : (
          filteredMsgs.map(msg => (
            <div
              key={msg.id}
              className="p-3 bg-muted/50 rounded-lg border border-border hover:bg-muted/70 transition-colors"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {msg.senderType === 'user' && '👤'}
                    {msg.senderType === 'coach' && '🤖'}
                    {msg.senderType === 'agent' && '👔'}
                    {msg.senderType === 'system' && '⚙️'}
                  </span>
                  <span className="text-sm font-medium text-foreground">{msg.senderName}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(msg.timestamp).toLocaleString(locale === 'ja' ? 'ja-JP' : 'en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              {/* Content */}
              <div className="text-sm text-foreground whitespace-pre-wrap break-words">
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default MOCSection;
