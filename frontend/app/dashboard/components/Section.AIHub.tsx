'use client';

/**
 * AI Hub Section - Unified AI Interface
 *
 * Integrates Coach mode, Agents mode, and Workflow mode into a single component.
 * Features:
 * - Tab-based mode switching (Coach / Agents / Workflow)
 * - Unified message format (UnifiedMessage)
 * - Unified SSE connection management
 * - Premium/Admin access control
 * - Mobile-friendly responsive design
 * - Japanese/English localization
 *
 * Uses the new Agents API (`/api/agents/*`) for agent operations.
 *
 * @module components/Section.AIHub
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useHandedness } from '../contexts/HandednessContext';
import {
  type UnifiedMessage,
  createUnifiedMessage,
  createUserMessage,
  createAssistantMessage,
  createSystemMessage,
  createErrorMessage,
  isUserMessage,
  isStreaming,
  hasToolCalls,
} from '../types/unified-message.types';
import { ChoiceButtons, type Choice } from './Widget.ChoiceButtons';
import { useMastraAgent, type MastraMessage } from '../hooks/useMastraAgent';
import { useMultiAgentServer, type ConnectionState, type DashboardStats } from '../hooks/useMultiAgentServer';
import type {
  Agent,
  AgentTask,
} from '../types/agent.types';
import {
  ROLE_CONFIG,
  STATUS_CONFIG,
  TASK_STATUS_CONFIG,
  PRIORITY_CONFIG,
  AGENT_TYPE_CONFIG,
} from '../types/agent.types';

// =============================================================================
// Types
// =============================================================================

type AIHubMode = 'coach' | 'agents' | 'workflow';

interface AIHubSectionProps {
  /** User's goals for Coach mode */
  goals?: { id: string; name: string }[];
  /** User's habits for Coach mode */
  habits?: { id: string; goalId: string; name: string; level?: number | null; completed?: boolean }[];
  /** Callback when habit is created */
  onHabitCreated?: () => void;
  /** Callback when goal is created */
  onGoalCreated?: () => void;
  /** Callback when habit is updated */
  onHabitUpdated?: () => void;
  /** Language preference */
  locale?: 'ja' | 'en';
  /** Initial mode */
  initialMode?: AIHubMode;
}

// =============================================================================
// Tool Call Config (from Section.Coach)
// =============================================================================

const TOOL_CALL_CONFIG: Record<string, { icon: string; label: string; labelEn: string; description: string; descriptionEn: string }> = {
  parse_habit: {
    icon: '📝',
    label: '習慣解析',
    labelEn: 'Parsing Habit',
    description: '入力から習慣情報を抽出中...',
    descriptionEn: 'Extracting habit info from input...',
  },
  suggest_habits: {
    icon: '💡',
    label: '習慣提案',
    labelEn: 'Suggesting Habits',
    description: 'おすすめの習慣を生成中...',
    descriptionEn: 'Generating habit suggestions...',
  },
  analyze_progress: {
    icon: '📊',
    label: '進捗分析',
    labelEn: 'Analyzing Progress',
    description: '習慣の達成状況を分析中...',
    descriptionEn: 'Analyzing habit progress...',
  },
  get_coaching: {
    icon: '🎯',
    label: 'コーチング',
    labelEn: 'Coaching',
    description: 'パーソナライズされたアドバイスを生成中...',
    descriptionEn: 'Generating personalized advice...',
  },
  assess_level: {
    icon: '📈',
    label: 'レベル評価',
    labelEn: 'Level Assessment',
    description: '習慣のレベルを評価中...',
    descriptionEn: 'Assessing habit level...',
  },
  default: {
    icon: '⚙️',
    label: 'ツール実行',
    labelEn: 'Running Tool',
    description: 'ツールを実行中...',
    descriptionEn: 'Running tool...',
  },
};

// =============================================================================
// Quick Actions
// =============================================================================

const COACH_QUICK_ACTIONS: Choice[] = [
  { id: 'assess-level', label: 'レベル設定', icon: '📈', description: '習慣のレベルを設定します' },
  { id: 'add-habit', label: '習慣を追加', icon: '➕', description: '新しい習慣を作成します' },
  { id: 'set-goal', label: 'ゴールを設定', icon: '🎯', description: '目標を設定します' },
  { id: 'check-progress', label: '進捗を確認', icon: '📊', description: '習慣の達成状況を確認します' },
  { id: 'get-advice', label: 'アドバイス', icon: '💡', description: '習慣継続のアドバイスを受けます' },
];

const COACH_QUICK_ACTIONS_EN: Choice[] = [
  { id: 'assess-level', label: 'Set Level', icon: '📈', description: 'Set the level for your habits' },
  { id: 'add-habit', label: 'Add Habit', icon: '➕', description: 'Create a new habit' },
  { id: 'set-goal', label: 'Set Goal', icon: '🎯', description: 'Set a goal' },
  { id: 'check-progress', label: 'Check Progress', icon: '📊', description: 'Check your habit progress' },
  { id: 'get-advice', label: 'Get Advice', icon: '💡', description: 'Get tips for habit building' },
];

const AGENTS_QUICK_ACTIONS: Choice[] = [
  { id: 'create-task', label: 'タスク作成', icon: '📋', description: '新しいタスクを作成します' },
  { id: 'view-agents', label: 'エージェント一覧', icon: '🤖', description: '接続中のエージェントを確認' },
  { id: 'view-tasks', label: 'タスク一覧', icon: '📝', description: '現在のタスク状況を確認' },
  { id: 'server-config', label: 'サーバー設定', icon: '⚙️', description: 'MCPサーバーを設定' },
];

const AGENTS_QUICK_ACTIONS_EN: Choice[] = [
  { id: 'create-task', label: 'Create Task', icon: '📋', description: 'Create a new task' },
  { id: 'view-agents', label: 'View Agents', icon: '🤖', description: 'View connected agents' },
  { id: 'view-tasks', label: 'View Tasks', icon: '📝', description: 'Check current task status' },
  { id: 'server-config', label: 'Server Settings', icon: '⚙️', description: 'Configure MCP server' },
];

const WORKFLOW_QUICK_ACTIONS: Choice[] = [
  { id: 'start-workflow', label: 'ワークフロー開始', icon: '▶️', description: '新しいワークフローを開始' },
  { id: 'view-progress', label: '進捗確認', icon: '📊', description: '実行中のワークフローを確認' },
  { id: 'view-history', label: '履歴表示', icon: '📜', description: '過去のワークフロー履歴' },
];

const WORKFLOW_QUICK_ACTIONS_EN: Choice[] = [
  { id: 'start-workflow', label: 'Start Workflow', icon: '▶️', description: 'Start a new workflow' },
  { id: 'view-progress', label: 'View Progress', icon: '📊', description: 'Check running workflows' },
  { id: 'view-history', label: 'View History', icon: '📜', description: 'View workflow history' },
];

// =============================================================================
// Sub-Components
// =============================================================================

/**
 * Mode Tab Component
 */
function ModeTabs({
  activeMode,
  onModeChange,
  locale,
  agentsConnectionState,
}: {
  activeMode: AIHubMode;
  onModeChange: (mode: AIHubMode) => void;
  locale: 'ja' | 'en';
  agentsConnectionState: ConnectionState;
}) {
  const tabs: { id: AIHubMode; label: string; labelEn: string; icon: string }[] = [
    { id: 'coach', label: 'コーチ', labelEn: 'Coach', icon: '🎯' },
    { id: 'agents', label: 'エージェント', labelEn: 'Agents', icon: '🤖' },
    { id: 'workflow', label: 'ワークフロー', labelEn: 'Workflow', icon: '📋' },
  ];

  return (
    <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onModeChange(tab.id)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
            transition-colors
            ${activeMode === tab.id
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }
          `}
        >
          <span>{tab.icon}</span>
          <span className="hidden sm:inline">{locale === 'ja' ? tab.label : tab.labelEn}</span>
          {tab.id === 'agents' && agentsConnectionState === 'connected' && (
            <span className="w-2 h-2 bg-green-500 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Connection Status Indicator
 */
function ConnectionIndicator({
  state,
  locale,
  onClick,
}: {
  state: ConnectionState;
  locale: 'ja' | 'en';
  onClick?: () => void;
}) {
  const stateConfig = {
    disconnected: { color: 'bg-gray-400', text: locale === 'ja' ? 'オフライン' : 'Offline', textColor: 'text-gray-400' },
    connecting: { color: 'bg-yellow-400 animate-pulse', text: locale === 'ja' ? '接続中...' : 'Connecting...', textColor: 'text-yellow-400' },
    connected: { color: 'bg-green-500', text: 'LIVE', textColor: 'text-green-500' },
    error: { color: 'bg-red-500', text: locale === 'ja' ? 'エラー' : 'Error', textColor: 'text-red-500' },
  };

  const cfg = stateConfig[state];

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted transition-colors"
      title={locale === 'ja' ? 'サーバー設定' : 'Server Settings'}
    >
      <div className={`w-2 h-2 rounded-full ${cfg.color}`} />
      <span className={`text-xs font-medium ${cfg.textColor}`}>{cfg.text}</span>
    </button>
  );
}

/**
 * Unified Message Display Component
 */
function MessageBubble({
  message,
  locale,
}: {
  message: UnifiedMessage;
  locale: 'ja' | 'en';
}) {
  const isUser = isUserMessage(message);
  const streaming = isStreaming(message);

  // Get role display
  const getRoleDisplay = () => {
    if (message.role === 'user') return null;
    if (message.agentName) return message.agentName;
    if (message.role === 'manager') return 'Manager';
    if (message.role === 'agent') return message.agentRole || 'Agent';
    return null;
  };

  const roleDisplay = getRoleDisplay();

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[95%] md:max-w-[85%] px-4 py-3 rounded-xl text-base whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted border border-border rounded-bl-sm'
        }`}
      >
        {/* Agent role indicator */}
        {roleDisplay && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            {message.agentType && (
              <span className={`font-bold ${
                message.agentType === 'mastra' ? 'text-purple-500' :
                message.agentType === 'multi-agent' ? 'text-cyan-500' :
                'text-gray-500'
              }`}>
                {message.agentType === 'mastra' ? 'M' : message.agentType === 'multi-agent' ? 'MA' : ''}
              </span>
            )}
            <span className="font-medium">{roleDisplay}</span>
          </div>
        )}

        {/* Message content */}
        {message.content}

        {/* Streaming indicator */}
        {streaming && (
          <span className="inline-block ml-1 animate-pulse">...</span>
        )}

        {/* Tool calls */}
        {hasToolCalls(message) && message.toolCalls && (
          <div className="flex flex-wrap gap-2 mt-2">
            {message.toolCalls.map((call, idx) => {
              const config = TOOL_CALL_CONFIG[call.toolName] || TOOL_CALL_CONFIG.default;
              return (
                <div
                  key={`tool-${idx}-${call.toolName}`}
                  className={`
                    flex items-center gap-1.5 px-2 py-1 rounded-md text-xs
                    ${call.success
                      ? 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20'
                      : 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20'
                    }
                  `}
                  title={call.error || (locale === 'ja' ? config.description : config.descriptionEn)}
                >
                  <span>{config.icon}</span>
                  <span>{locale === 'ja' ? config.label : config.labelEn}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Task info (for multi-agent messages) */}
        {message.taskTitle && (
          <div className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium">{locale === 'ja' ? 'タスク:' : 'Task:'}</span>
            <span className="ml-1">{message.taskTitle}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Streaming Indicator Component
 */
function StreamingIndicator({
  toolName,
  locale,
}: {
  toolName?: string;
  locale: 'ja' | 'en';
}) {
  const config = toolName
    ? (TOOL_CALL_CONFIG[toolName] || TOOL_CALL_CONFIG.default)
    : TOOL_CALL_CONFIG.default;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="flex items-center gap-1">
        <span>{config.icon}</span>
        <span>{locale === 'ja' ? config.description : config.descriptionEn}</span>
      </span>
    </div>
  );
}

/**
 * Agent Card Mini Component
 */
function AgentCardMini({
  agent,
  onClick,
}: {
  agent: Agent;
  onClick?: () => void;
}) {
  const statusConfig = STATUS_CONFIG[agent.status];
  const roleConfig = ROLE_CONFIG[agent.role];
  const typeConfig = agent.agentType ? AGENT_TYPE_CONFIG[agent.agentType] : AGENT_TYPE_CONFIG.custom;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors text-left w-full"
    >
      <div className={`w-2 h-2 rounded-full ${statusConfig.bgColor}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-bold ${typeConfig.color}`}>{typeConfig.icon}</span>
          <span className="font-medium text-sm truncate">{agent.name}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{roleConfig.icon}</span>
          <span>{roleConfig.label}</span>
        </div>
      </div>
      {agent.currentTaskTitle && (
        <div className="text-xs text-muted-foreground truncate max-w-[100px]">
          {agent.currentTaskTitle}
        </div>
      )}
    </button>
  );
}

/**
 * Task Card Mini Component
 */
function TaskCardMini({
  task,
  onClick,
}: {
  task: AgentTask;
  onClick?: () => void;
}) {
  const statusConfig = TASK_STATUS_CONFIG[task.status];
  const priorityConfig = PRIORITY_CONFIG[task.priority];

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors text-left w-full"
    >
      <div className={`w-2 h-2 rounded-full ${statusConfig.bgColor} ${task.status === 'in_progress' ? 'animate-pulse' : ''}`} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{task.title}</div>
        {task.assignedAgentName && (
          <div className="text-xs text-muted-foreground">
            → {task.assignedAgentName}
          </div>
        )}
      </div>
      <span className={`text-xs ${priorityConfig.color}`}>
        {task.priority === 'urgent' ? '!' : task.priority === 'high' ? '^' : ''}
      </span>
    </button>
  );
}

/**
 * Quick Stats Bar Component
 */
function StatsBar({
  stats,
  locale,
}: {
  stats: DashboardStats | null;
  locale: 'ja' | 'en';
}) {
  if (!stats) return null;

  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <span>🤖</span>
        <span>{locale === 'ja' ? 'エージェント' : 'Agents'}:</span>
        <span>{stats.agents.total}</span>
        <span className="text-green-500">({stats.agents.idle})</span>
      </div>
      <div className="flex items-center gap-1">
        <span>📋</span>
        <span>{locale === 'ja' ? 'タスク' : 'Tasks'}:</span>
        <span>{stats.tasks.total}</span>
        <span className="text-yellow-500">({stats.tasks.in_progress})</span>
      </div>
    </div>
  );
}

/**
 * Upgrade Prompt Component
 */
function UpgradePrompt({ locale }: { locale: 'ja' | 'en' }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h3 className="font-medium mb-2">
          {locale === 'ja'
            ? 'AI Hub機能はPremiumプランで利用可能'
            : 'AI Hub features are available with Premium plan'}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {locale === 'ja'
            ? 'AIコーチング、マルチエージェント管理などの機能をご利用いただけます。'
            : 'Access AI coaching, multi-agent management, and more.'}
        </p>
        <a
          href="/settings/subscription"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
        >
          {locale === 'ja' ? 'プランを見る' : 'View Plans'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function AIHubSection({
  goals: _goals = [],
  habits: _habits = [],
  onHabitCreated: _onHabitCreated,
  onGoalCreated: _onGoalCreated,
  onHabitUpdated: _onHabitUpdated,
  locale = 'ja',
  initialMode = 'coach',
}: AIHubSectionProps) {
  const { isLeftHanded } = useHandedness();

  // Reserved for future coach mode integration
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [goals, habits, onHabitCreated, onGoalCreated, onHabitUpdated] = [
    _goals, _habits, _onHabitCreated, _onGoalCreated, _onHabitUpdated
  ];

  // Access control state
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Mode state
  const [activeMode, setActiveMode] = useState<AIHubMode>(initialMode);

  // Unified messages state
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || process.env.NEXT_PUBLIC_SLACK_API_URL;

  // Mastra Agent Hook (for Coach mode)
  const mastraAgent = useMastraAgent({
    authToken,
    enableStreaming: true,
    systemMessage: locale === 'ja'
      ? 'あなたはVOWアプリの習慣コーチです。ユーザーの習慣形成をサポートします。'
      : 'You are a habit coach for the VOW app. You help users build better habits.',
    onMessage: useCallback((msg: MastraMessage) => {
      // Convert MastraMessage to UnifiedMessage
      const unified = createUnifiedMessage({
        id: msg.id,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        timestamp: msg.timestamp || new Date(),
        status: msg.status,
        agentType: 'mastra',
        toolCalls: msg.toolCalls?.map(tc => ({
          toolName: tc.toolName,
          input: tc.input,
          output: tc.output,
          success: tc.success,
          error: tc.error,
        })),
        usage: msg.usage,
      });
      // Update messages
      setMessages(prev => {
        const existingIdx = prev.findIndex(m => m.id === unified.id);
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = unified;
          return updated;
        }
        return [...prev, unified];
      });
    }, []),
    onError: useCallback((err: Error) => {
      setError(err.message);
    }, []),
  });

  // Multi-Agent Server Hook (for Agents mode)
  const multiAgentServer = useMultiAgentServer({ authToken });

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 80), 160)}px`;
    }
  }, [input]);

  // Check premium/admin status
  useEffect(() => {
    const checkStatus = async () => {
      if (!apiUrl) {
        setLoading(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setLoading(false);
          return;
        }

        setAuthToken(session.access_token);

        const response = await fetch(`${apiUrl}/api/subscription/status`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const planType = data.subscription?.planType;
          setIsPremium(planType === 'premium_basic' || planType === 'premium_pro');
        }

        // Check admin status
        const adminCheck = await fetch(`${apiUrl}/api/ai/parse-habit`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: '' }),
        });

        if (adminCheck.status !== 402) {
          setIsAdmin(true);
          setIsPremium(true);
        }
      } catch (err) {
        console.error('Failed to check status:', err);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, [apiUrl]);

  // Get quick actions based on mode
  const quickActions = useMemo(() => {
    switch (activeMode) {
      case 'coach':
        return locale === 'ja' ? COACH_QUICK_ACTIONS : COACH_QUICK_ACTIONS_EN;
      case 'agents':
        return locale === 'ja' ? AGENTS_QUICK_ACTIONS : AGENTS_QUICK_ACTIONS_EN;
      case 'workflow':
        return locale === 'ja' ? WORKFLOW_QUICK_ACTIONS : WORKFLOW_QUICK_ACTIONS_EN;
      default:
        return [];
    }
  }, [activeMode, locale]);

  // Add message helper
  const addMessage = useCallback((message: UnifiedMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  // Handle sending message
  const handleSendMessage = useCallback(async () => {
    if (!input.trim()) return;

    const userInput = input.trim();
    setInput('');
    setError(null);
    setProcessing(true);

    // Add user message
    const userMessage = createUserMessage(userInput);
    addMessage(userMessage);

    try {
      if (activeMode === 'coach') {
        // Use Mastra agent for Coach mode
        await mastraAgent.sendMessage(userInput);
      } else if (activeMode === 'agents') {
        // For agents mode, we'll use a simple command interface
        // More complex chat would use the Manager Chat modal
        const response = createAssistantMessage(
          locale === 'ja'
            ? 'エージェント管理機能を使用するには、右側のパネルを参照するか、Chat ボタンをクリックしてください。'
            : 'To use agent management features, please refer to the panel on the right or click the Chat button.',
          { agentType: 'multi-agent' }
        );
        addMessage(response);
      } else if (activeMode === 'workflow') {
        // Workflow mode - placeholder
        const response = createAssistantMessage(
          locale === 'ja'
            ? 'ワークフロー機能は現在開発中です。'
            : 'Workflow features are currently under development.',
          { agentType: 'custom' }
        );
        addMessage(response);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : locale === 'ja' ? 'エラーが発生しました' : 'An error occurred';
      setError(errorMsg);
      addMessage(createErrorMessage(errorMsg));
    } finally {
      setProcessing(false);
    }
  }, [input, activeMode, mastraAgent, locale, addMessage]);

  // Handle quick action selection
  const handleQuickAction = useCallback((choice: Choice) => {
    switch (choice.id) {
      case 'server-config':
        // This would typically open a modal
        // For now, we'll add a message directing the user
        addMessage(createSystemMessage(
          locale === 'ja'
            ? 'サーバー設定を開くには、ヘッダーの設定アイコンをクリックしてください。'
            : 'To open server settings, click the settings icon in the header.'
        ));
        break;
      default:
        // Set input and process
        setInput(choice.description || choice.label);
        break;
    }
  }, [locale, addMessage]);

  // Clear conversation
  const handleClear = useCallback(() => {
    setMessages([]);
    mastraAgent.clearMessages();
    setError(null);
  }, [mastraAgent]);

  const hasAccess = isPremium || isAdmin;

  // Loading state
  if (loading) {
    return (
      <section className="flex flex-col h-full min-h-[500px] bg-card border border-border rounded-lg">
        <div className="animate-pulse p-4">
          <div className="h-6 bg-muted rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </section>
    );
  }

  return (
    <section className={`relative flex flex-col h-full bg-card border border-border rounded-lg shadow-sm ${isLeftHanded ? '' : ''}`}>
      {/* Header */}
      <header className="flex flex-col gap-3 px-4 py-3 border-b border-border bg-card">
        {/* Title Row */}
        <div className={`flex items-center justify-between ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>🤖</span>
            <span>AI Hub</span>
            {isAdmin && (
              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                Admin
              </span>
            )}
          </h2>
          <div className={`flex items-center gap-2 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
            {/* Connection status for agents mode */}
            {activeMode === 'agents' && (
              <ConnectionIndicator
                state={multiAgentServer.connectionState}
                locale={locale}
              />
            )}
            {/* Mastra connection indicator for coach mode */}
            {activeMode === 'coach' && (
              <span
                className={`w-2 h-2 rounded-full ${
                  mastraAgent.connectionState === 'streaming'
                    ? 'bg-green-500 animate-pulse'
                    : mastraAgent.connectionState === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : mastraAgent.connectionState === 'error'
                    ? 'bg-red-500'
                    : 'bg-gray-400'
                }`}
                title={
                  mastraAgent.connectionState === 'streaming'
                    ? locale === 'ja' ? 'ストリーミング中' : 'Streaming'
                    : mastraAgent.connectionState === 'connecting'
                    ? locale === 'ja' ? '接続中' : 'Connecting'
                    : mastraAgent.connectionState === 'error'
                    ? locale === 'ja' ? 'エラー' : 'Error'
                    : locale === 'ja' ? '待機中' : 'Idle'
                }
              />
            )}
            {/* Clear button */}
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
              >
                {locale === 'ja' ? 'クリア' : 'Clear'}
              </button>
            )}
          </div>
        </div>

        {/* Mode Tabs and Stats */}
        <div className={`flex items-center justify-between gap-2 flex-wrap ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
          <ModeTabs
            activeMode={activeMode}
            onModeChange={setActiveMode}
            locale={locale}
            agentsConnectionState={multiAgentServer.connectionState}
          />
          {activeMode === 'agents' && (
            <StatsBar stats={multiAgentServer.stats} locale={locale} />
          )}
        </div>
      </header>

      {/* Content Area */}
      {!hasAccess ? (
        <UpgradePrompt locale={locale} />
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Main Chat Area */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 pb-40 md:pb-36">
              {messages.length === 0 ? (
                /* Quick Actions - centered when no conversation */
                <div className="flex flex-col items-center justify-center min-h-[300px] pt-12">
                  <p className="text-lg text-muted-foreground mb-6 text-center">
                    {activeMode === 'coach'
                      ? locale === 'ja' ? '何をお手伝いしましょうか？' : 'How can I help you?'
                      : activeMode === 'agents'
                      ? locale === 'ja' ? 'エージェント管理' : 'Agent Management'
                      : locale === 'ja' ? 'ワークフロー実行' : 'Workflow Execution'}
                  </p>
                  <ChoiceButtons
                    choices={quickActions}
                    onSelect={handleQuickAction}
                    layout="vertical"
                    size="md"
                    className="w-full max-w-md"
                  />
                </div>
              ) : (
                /* Conversation History */
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} locale={locale} />
                  ))}

                  {/* Streaming indicator */}
                  {(processing || mastraAgent.isStreaming) && (
                    <div className="flex justify-start">
                      <div className="px-4 py-3 rounded-xl bg-muted border border-border rounded-bl-sm">
                        <StreamingIndicator locale={locale} />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area - Fixed at bottom */}
            <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-card p-3 md:p-4">
              {error && (
                <div className="mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive flex items-center justify-between">
                  <span>{error}</span>
                  <button
                    onClick={() => setError(null)}
                    className="text-destructive/70 hover:text-destructive"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <div className="flex gap-2 md:gap-3 items-end">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    activeMode === 'coach'
                      ? locale === 'ja'
                        ? '例: 毎朝7時に30分ジョギングする'
                        : 'e.g., Jog for 30 minutes at 7am every day'
                      : locale === 'ja'
                        ? 'メッセージを入力...'
                        : 'Type a message...'
                  }
                  className="flex-1 min-h-[44px] md:min-h-[52px] max-h-[100px] px-3 md:px-4 py-2 md:py-3 rounded-lg border border-input bg-background text-base resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  disabled={processing || mastraAgent.isStreaming}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={processing || mastraAgent.isStreaming || !input.trim()}
                  className="px-4 md:px-6 py-2 md:py-3 min-h-[44px] bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {processing || mastraAgent.isStreaming ? '...' : locale === 'ja' ? '送信' : 'Send'}
                </button>
              </div>
            </div>
          </div>

          {/* Side Panel for Agents Mode */}
          {activeMode === 'agents' && multiAgentServer.connectionState === 'connected' && (
            <div className="hidden lg:block w-72 border-l border-border p-3 overflow-y-auto">
              {/* Agents List */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <span>🤖</span>
                  <span>{locale === 'ja' ? 'エージェント' : 'Agents'} ({multiAgentServer.agents.length})</span>
                </h3>
                <div className="space-y-1">
                  {multiAgentServer.agents.slice(0, 5).map((agent) => (
                    <AgentCardMini key={agent.id} agent={agent} />
                  ))}
                  {multiAgentServer.agents.length > 5 && (
                    <div className="text-xs text-muted-foreground text-center py-1">
                      +{multiAgentServer.agents.length - 5} more
                    </div>
                  )}
                  {multiAgentServer.agents.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-2">
                      {locale === 'ja' ? 'エージェントなし' : 'No agents'}
                    </div>
                  )}
                </div>
              </div>

              {/* Tasks List */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <span>📋</span>
                  <span>{locale === 'ja' ? 'タスク' : 'Tasks'} ({multiAgentServer.tasks.length})</span>
                </h3>
                <div className="space-y-1">
                  {multiAgentServer.tasks
                    .filter(t => t.status !== 'completed')
                    .slice(0, 5)
                    .map((task) => (
                      <TaskCardMini key={task.id} task={task} />
                    ))}
                  {multiAgentServer.tasks.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-2">
                      {locale === 'ja' ? 'タスクなし' : 'No tasks'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default AIHubSection;
