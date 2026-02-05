"use client";

/**
 * ManagerChatModal Component
 *
 * Unified chat interface for multi-agent communication.
 * Features:
 * - User instructions to Manager
 * - Manager responses and SPEC drafting
 * - Task assignments to agents
 * - Agent progress and completion reports
 * - All participants visible in one chat stream
 *
 * Now uses Widget.GroupChatTimeline for chat display.
 *
 * @module Modal.ManagerChat
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type {
  ChatMessage,
  ChatSession,
  ChatAction,
  AgentTask,
  Agent,
  AgentRole,
  ChatMessageRole,
  ChatMessageType,
  AgentActivity,
} from '../types/agent.types';
import { ROLE_CONFIG } from '../types/agent.types';
import type { ConnectionState } from '../hooks/useMultiAgentServer';
import { GroupChatTimeline, convertToTimelineMessage } from './Widget.GroupChatTimeline';
import type { TimelineChatMessage } from './Widget.GroupChatTimeline';

interface ManagerChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Connection state for displaying status */
  connectionState?: ConnectionState;
  /** Create task on the server */
  onCreateTask?: (task: Partial<AgentTask> & { assignTo?: string }) => Promise<AgentTask | null>;
  /** Assign task to agent */
  onAssignTask?: (taskId: string, agentId: string) => Promise<boolean>;
  /** Available agents for assignment */
  agents?: Agent[];
  /** Server error if any */
  serverError?: string | null;
  /** Real-time activities from SSE */
  activities?: AgentActivity[];
  /** All tasks for reference */
  tasks?: AgentTask[];
  /** Focus on a specific task (highlight related messages) */
  focusTaskId?: string | null;
}

// Note: MessageBubble, MessageTypeBadge, and getAvatarConfig have been moved to Widget.GroupChatTimeline.tsx
// This modal now uses the GroupChatTimeline component for rendering messages.

/**
 * Session Selector Component
 */
function SessionSelector({
  sessions,
  currentSessionId,
  onSelect,
  onNewSession,
}: {
  sessions: ChatSession[];
  currentSessionId: string;
  onSelect: (sessionId: string) => void;
  onNewSession: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
      >
        <span className="truncate max-w-[200px]">{currentSession?.title || 'Select session'}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => {
                  onSelect(session.id);
                  setIsOpen(false);
                }}
                className={`
                  w-full text-left px-3 py-2 text-sm
                  hover:bg-muted transition-colors
                  ${session.id === currentSessionId ? 'bg-muted' : ''}
                `}
              >
                <div className="font-medium truncate">{session.title}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(session.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))}
            <div className="border-t border-border my-1" />
            <button
              onClick={() => {
                onNewSession();
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-muted transition-colors flex items-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>New Session</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Agent Selector for manual assignment
 */
function AgentSelector({
  agents,
  selectedAgentId,
  onSelect,
}: {
  agents: Agent[];
  selectedAgentId: string | null;
  onSelect: (agentId: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  const idleAgents = agents.filter(a => a.status === 'idle');
  const busyAgents = agents.filter(a => a.status === 'busy');

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs px-2 py-1 bg-muted rounded-md hover:bg-muted/80 transition-colors"
      >
        {selectedAgent ? (
          <>
            <span>{ROLE_CONFIG[selectedAgent.role]?.icon}</span>
            <span className="truncate max-w-[80px]">{selectedAgent.name}</span>
          </>
        ) : (
          <>
            <span>👔</span>
            <span>Auto (Manager)</span>
          </>
        )}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 bottom-full mb-1 w-48 bg-card border border-border rounded-lg shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
            <button
              onClick={() => { onSelect(null); setIsOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-muted ${!selectedAgentId ? 'bg-muted' : ''}`}
            >
              <span className="flex items-center gap-2">
                <span>👔</span>
                <span>Auto (Manager first)</span>
              </span>
            </button>
            <div className="border-t border-border my-1" />
            {idleAgents.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] text-green-500 font-medium">IDLE</div>
                {idleAgents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => { onSelect(agent.id); setIsOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted ${selectedAgentId === agent.id ? 'bg-muted' : ''}`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{ROLE_CONFIG[agent.role]?.icon}</span>
                      <span className="truncate">{agent.name}</span>
                      <span className="text-[10px] text-muted-foreground">{agent.role}</span>
                    </span>
                  </button>
                ))}
              </>
            )}
            {busyAgents.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] text-yellow-500 font-medium">BUSY</div>
                {busyAgents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => { onSelect(agent.id); setIsOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted opacity-60 ${selectedAgentId === agent.id ? 'bg-muted' : ''}`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{ROLE_CONFIG[agent.role]?.icon}</span>
                      <span className="truncate">{agent.name}</span>
                    </span>
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Quick Command Buttons
 */
function QuickCommands({ onCommand }: { onCommand: (command: string) => void }) {
  const commands = [
    { label: 'Status', command: '現在のエージェント状況を教えてください', icon: '📊' },
    { label: 'Tasks', command: '進行中のタスク一覧を表示してください', icon: '📋' },
    { label: 'SPEC', command: 'この機能のSPECを作成してください', icon: '📝' },
  ];

  return (
    <div className="flex gap-2 p-2 border-t border-border">
      {commands.map((cmd) => (
        <button
          key={cmd.label}
          onClick={() => onCommand(cmd.command)}
          className="flex items-center gap-1 text-xs px-2 py-1 bg-muted hover:bg-muted/80 rounded-md transition-colors"
        >
          <span>{cmd.icon}</span>
          <span>{cmd.label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Online Agents Indicator
 */
function OnlineAgents({ agents }: { agents: Agent[] }) {
  const idleCount = agents.filter(a => a.status === 'idle').length;
  const busyCount = agents.filter(a => a.status === 'busy').length;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
        {idleCount} idle
      </span>
      <span className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
        {busyCount} busy
      </span>
    </div>
  );
}

/**
 * ManagerChatModal Component
 */
// Storage keys for persistence
const CHAT_MESSAGES_KEY = 'vow-agent-chat-messages';
const CHAT_SESSIONS_KEY = 'vow-agent-chat-sessions';
const CURRENT_SESSION_KEY = 'vow-agent-chat-current-session';

/**
 * Load data from localStorage
 */
function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error(`[Chat] Failed to load ${key}:`, e);
  }
  return defaultValue;
}

/**
 * Save data to localStorage
 */
function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`[Chat] Failed to save ${key}:`, e);
  }
}

export default function ManagerChatModal({
  isOpen,
  onClose,
  connectionState = 'disconnected',
  onCreateTask,
  onAssignTask,
  agents = [],
  serverError,
  activities = [],
  tasks = [],
  focusTaskId = null,
}: ManagerChatModalProps) {
  // Load initial state from localStorage
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadFromStorage<ChatMessage[]>(CHAT_MESSAGES_KEY, [])
  );
  const [sessions, setSessions] = useState<ChatSession[]>(() =>
    loadFromStorage<ChatSession[]>(CHAT_SESSIONS_KEY, [])
  );
  const [currentSessionId, setCurrentSessionId] = useState<string>(() =>
    loadFromStorage<string>(CURRENT_SESSION_KEY, '')
  );
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [filterByTask, setFilterByTask] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Note: messagesEndRef and focusMessageRef are now handled internally by GroupChatTimeline

  // Initialize processedActivityIds from existing messages to prevent duplicates on reload
  const processedActivityIds = useRef<Set<string>>(new Set<string>());

  // One-time initialization of processedActivityIds from loaded messages
  const [activityIdsInitialized, setActivityIdsInitialized] = useState(false);
  useEffect(() => {
    if (!activityIdsInitialized) {
      const stored = loadFromStorage<ChatMessage[]>(CHAT_MESSAGES_KEY, []);
      stored.forEach(m => {
        if (m.id.startsWith('activity-')) {
          processedActivityIds.current.add(m.id.replace('activity-', ''));
        }
      });
      setActivityIdsInitialized(true);
    }
  }, [activityIdsInitialized]);

  const isConnected = connectionState === 'connected';

  // Persist messages to localStorage
  useEffect(() => {
    saveToStorage(CHAT_MESSAGES_KEY, messages);
  }, [messages]);

  // Persist sessions to localStorage
  useEffect(() => {
    saveToStorage(CHAT_SESSIONS_KEY, sessions);
  }, [sessions]);

  // Persist current session ID to localStorage
  useEffect(() => {
    if (currentSessionId) {
      saveToStorage(CURRENT_SESSION_KEY, currentSessionId);
    }
  }, [currentSessionId]);

  // Find Manager agent (prefer idle, then busy)
  const managerAgent = useMemo(() => {
    const managers = agents.filter(a => a.role === 'manager');
    return managers.find(a => a.status === 'idle') || managers.find(a => a.status === 'busy') || managers[0] || null;
  }, [agents]);

  // Get target agent (selected or manager)
  const targetAgent = useMemo(() => {
    if (selectedAgentId) {
      return agents.find(a => a.id === selectedAgentId) || null;
    }
    return managerAgent;
  }, [selectedAgentId, managerAgent, agents]);

  // Create initial session if none exists
  useEffect(() => {
    if (sessions.length === 0 && isOpen) {
      const initialSession: ChatSession = {
        id: `session-${Date.now()}`,
        userId: 'current-user',
        title: `Chat ${new Date().toLocaleDateString()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSessions([initialSession]);
      setCurrentSessionId(initialSession.id);
    }
  }, [sessions.length, isOpen]);

  // Handle focus task change
  useEffect(() => {
    if (focusTaskId && isOpen) {
      setFilterByTask(focusTaskId);
      // Note: Scrolling is now handled internally by GroupChatTimeline via focusTaskId prop
    }
  }, [focusTaskId, isOpen]);

  // Get focused task info
  const focusedTask = useMemo(() => {
    if (!filterByTask) return null;
    return tasks.find(t => t.id === filterByTask) || null;
  }, [filterByTask, tasks]);

  // Convert activities to chat messages
  useEffect(() => {
    if (!currentSessionId) return;

    activities.forEach(activity => {
      // Skip if already processed
      if (processedActivityIds.current.has(activity.id)) return;
      processedActivityIds.current.add(activity.id);

      // Skip heartbeat and connected events
      if (activity.eventType === 'heartbeat') return;

      const agent = agents.find(a => a.id === activity.agentId);
      const task = tasks.find(t => t.id === activity.taskId);

      let content = '';
      let messageType: ChatMessageType = 'message';
      let role: ChatMessageRole = 'agent';

      switch (activity.eventType) {
        case 'task_created':
          content = `📋 新しいタスクが作成されました: "${activity.taskTitle || task?.title || 'Untitled'}"`;
          messageType = 'message';
          role = 'system';
          break;
        case 'task_assigned':
          content = `👉 タスク "${activity.taskTitle || task?.title || ''}" が ${activity.agentName || agent?.name || 'エージェント'} に割り当てられました`;
          messageType = 'task_assignment';
          role = 'system';
          break;
        case 'task_started':
          content = `▶️ タスクを開始しました: "${activity.taskTitle || task?.title || ''}"`;
          messageType = 'progress_report';
          break;
        case 'task_completed': {
          const result = (activity.details as any)?.result || '';
          content = result
            ? `✅ タスク完了: "${activity.taskTitle || task?.title || ''}"\n\n${result}`
            : `✅ タスクを完了しました: "${activity.taskTitle || task?.title || ''}"`;
          messageType = 'completion_report';
          break;
        }
        case 'task_failed': {
          const error = (activity.details as any)?.result || (activity.details as any)?.error || '';
          content = `❌ タスク失敗: "${activity.taskTitle || task?.title || ''}"\n${error}`;
          messageType = 'error_report';
          break;
        }
        case 'agent_registered':
          content = `🤖 ${activity.agentName || 'エージェント'} が参加しました (${agent?.role || 'general'})`;
          role = 'system';
          break;
        case 'agent_status_changed': {
          const newStatus = (activity.details as any)?.newStatus;
          if (newStatus === 'offline') {
            content = `👋 ${activity.agentName || 'エージェント'} がオフラインになりました`;
            role = 'system';
          } else {
            return; // Skip other status changes
          }
          break;
        }
        default:
          return; // Skip unknown events
      }

      const chatMessage: ChatMessage = {
        id: `activity-${activity.id}`,
        sessionId: currentSessionId,
        role,
        content,
        agentId: activity.agentId,
        agentName: activity.agentName || agent?.name,
        agentRole: agent?.role,
        messageType,
        taskId: activity.taskId,
        taskTitle: activity.taskTitle || task?.title,
        createdAt: activity.createdAt,
      };

      setMessages(prev => {
        // Check if message already exists
        if (prev.some(m => m.id === chatMessage.id)) return prev;
        // Insert in chronological order
        const newMessages = [...prev, chatMessage];
        return newMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });
    });
  }, [activities, agents, tasks, currentSessionId]);

  // Filter messages for current session (and optionally by task)
  const sessionMessages = useMemo(() => {
    let filtered = messages.filter(m => m.sessionId === currentSessionId);

    // If filtering by task, only show related messages
    if (filterByTask) {
      filtered = filtered.filter(m =>
        m.taskId === filterByTask ||
        // Also include system messages about this task
        (m.role === 'system' && m.content.includes(filterByTask))
      );
    }

    return filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, currentSessionId, filterByTask]);

  // Convert session messages to timeline format
  const timelineMessages: TimelineChatMessage[] = useMemo(() => {
    return sessionMessages.map(convertToTimelineMessage);
  }, [sessionMessages]);

  // Handle action from timeline
  const handleTimelineAction = useCallback((action: ChatAction, _message: TimelineChatMessage) => {
    console.log('Timeline action clicked:', action);
    const confirmMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sessionId: currentSessionId,
      role: 'system',
      content: `アクション「${action.label}」を実行しました。`,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, confirmMessage]);
  }, [currentSessionId]);

  // Note: Auto-scroll is now handled by GroupChatTimeline component

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userContent = inputValue.trim();
    const now = new Date().toISOString();

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sessionId: currentSessionId,
      role: 'user',
      content: userContent,
      messageType: 'instruction',
      createdAt: now,
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Create task and assign
    if (isConnected && onCreateTask && targetAgent) {
      try {
        const taskPayload: Partial<AgentTask> & { assignTo?: string } = {
          title: userContent.slice(0, 100),
          description: userContent,
          priority: 'normal',
          tags: ['chat-instruction'],
          assignTo: targetAgent.id,
        };

        const task = await onCreateTask(taskPayload);

        let responseContent = '';
        let responseType: ChatMessageType = 'message';

        if (task) {
          const isAssigned = task.status === 'assigned' || task.assignedTo;

          if (isAssigned) {
            responseContent = `了解しました。タスクを受け付けました。\n\n📋 タスクID: ${task.id}\n\n処理を開始します。完了次第、このチャットで報告します。`;
            responseType = 'message';
          } else {
            // Try explicit assignment
            if (onAssignTask) {
              const assigned = await onAssignTask(task.id, targetAgent.id);
              if (assigned) {
                responseContent = `了解しました。タスクを受け付けました。\n\n📋 タスクID: ${task.id}`;
                responseType = 'message';
              } else {
                responseContent = `⚠️ タスクを作成しましたが、割り当てに失敗しました。\n\nタスクID: ${task.id}`;
                responseType = 'error_report';
              }
            }
          }
        } else {
          responseContent = '❌ タスクの作成に失敗しました。';
          responseType = 'error_report';
        }

        const responseMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          sessionId: currentSessionId,
          role: targetAgent.role === 'manager' ? 'manager' : 'agent',
          content: responseContent,
          agentId: targetAgent.id,
          agentName: targetAgent.name,
          agentRole: targetAgent.role,
          messageType: responseType,
          taskId: task?.id,
          taskTitle: task?.title,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, responseMessage]);

      } catch (error: any) {
        const errorMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          sessionId: currentSessionId,
          role: 'system',
          content: `❌ エラー: ${error.message || 'タスクの作成に失敗しました'}`,
          messageType: 'error_report',
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } else if (!isConnected) {
      // Offline mode message
      const offlineMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sessionId: currentSessionId,
        role: 'system',
        content: `⚠️ サーバーに接続されていません。\n\n設定からMCPタスクサーバーに接続してください。`,
        messageType: 'error_report',
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, offlineMessage]);
    } else if (!targetAgent) {
      // No agent available
      const noAgentMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sessionId: currentSessionId,
        role: 'system',
        content: `⚠️ 利用可能なエージェントがありません。\n\nClaude CodeからMCPサーバーにエージェントを登録してください。`,
        messageType: 'error_report',
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, noAgentMessage]);
    }

    setIsLoading(false);
  }, [inputValue, isLoading, currentSessionId, isConnected, onCreateTask, onAssignTask, targetAgent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Note: handleAction has been replaced by handleTimelineAction above

  const handleNewSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      userId: 'user-001',
      title: `Chat ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    processedActivityIds.current.clear();
  };

  const handleQuickCommand = (command: string) => {
    setInputValue(command);
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-4 bottom-[calc(70px+env(safe-area-inset-bottom,0px)+16px)] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[700px] sm:h-[85vh] sm:max-h-[800px] bg-card border border-border rounded-lg shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isConnected ? 'bg-green-500/10' : 'bg-muted'}`}>
              <span className="text-xl">💬</span>
            </div>
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                Agent Chat
                {isConnected ? (
                  <span className="text-xs font-normal text-green-500 bg-green-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    LIVE
                  </span>
                ) : (
                  <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    OFFLINE
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-3">
                <SessionSelector
                  sessions={sessions}
                  currentSessionId={currentSessionId}
                  onSelect={setCurrentSessionId}
                  onNewSession={handleNewSession}
                />
                {isConnected && <OnlineAgents agents={agents} />}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Task Focus Banner */}
        {focusedTask && (
          <div className="px-4 py-2 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm">📋</span>
              <div className="min-w-0">
                <div className="text-xs text-primary font-medium">Focused on task:</div>
                <div className="text-sm font-medium truncate">{focusedTask.title}</div>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                focusedTask.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                focusedTask.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-500' :
                focusedTask.status === 'assigned' ? 'bg-blue-500/20 text-blue-500' :
                'bg-gray-500/20 text-gray-500'
              }`}>
                {focusedTask.status}
              </span>
            </div>
            <button
              onClick={() => setFilterByTask(null)}
              className="shrink-0 text-xs px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
            >
              Show all
            </button>
          </div>
        )}

        {/* Messages - Using GroupChatTimeline component */}
        <GroupChatTimeline
          messages={timelineMessages}
          focusTaskId={filterByTask || undefined}
          locale="ja"
          showDateSeparators={true}
          isLoading={isLoading}
          loadingAgent={targetAgent ? { name: targetAgent.name, role: targetAgent.role } : undefined}
          onActionClick={handleTimelineAction}
          emptyMessage={filterByTask ? 'このタスクに関連するメッセージはまだありません' : undefined}
        />

        {/* Quick Commands */}
        <QuickCommands onCommand={handleQuickCommand} />

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2">
            {/* Agent Selector */}
            {isConnected && agents.length > 0 && (
              <AgentSelector
                agents={agents}
                selectedAgentId={selectedAgentId}
                onSelect={setSelectedAgentId}
              />
            )}

            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={targetAgent ? `${targetAgent.name} に指示...` : 'メッセージを入力...'}
              disabled={isLoading}
              className="flex-1 bg-muted border-0 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
