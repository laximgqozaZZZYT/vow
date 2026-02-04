/**
 * Modal.AgentDetail - Agent Detail & Edit Modal
 *
 * Shows agent details including system prompt, allows configuration.
 * Also supports creating new custom agents and editing existing ones.
 * Used when clicking on an agent in the Agents tab.
 *
 * @module components/Modal.AgentDetail
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Agent configuration data
 */
export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  description: string;
  icon: string;
  status: 'idle' | 'busy' | 'offline';
  systemPrompt: string;
  model: string;
  tools: string[];
  capabilities: string[];
  isBuiltIn: boolean; // Built-in agents cannot have their prompts modified
  parentAgentId?: string | null; // Parent agent ID for tree structure
}

/**
 * Available agent roles
 */
export const AGENT_ROLES = [
  'Manager',
  'Coach',
  'Planner',
  'Analyst',
  'Developer',
  'Reviewer',
  'Tester',
  'Architect',
  'DevOps',
  'Custom',
] as const;

export type AgentRole = typeof AGENT_ROLES[number];

/**
 * Available tools for agents
 */
export const AVAILABLE_TOOLS = [
  { id: 'analyze_habits', label: '習慣分析', labelEn: 'Analyze Habits' },
  { id: 'suggest_habits', label: '習慣提案', labelEn: 'Suggest Habits' },
  { id: 'suggest_goals', label: '目標提案', labelEn: 'Suggest Goals' },
  { id: 'generate_baby_steps', label: 'スモールステップ生成', labelEn: 'Generate Baby Steps' },
  { id: 'analyze_progress', label: '進捗分析', labelEn: 'Analyze Progress' },
  { id: 'create_smart_goal', label: 'SMART目標作成', labelEn: 'Create SMART Goal' },
  { id: 'identify_patterns', label: 'パターン識別', labelEn: 'Identify Patterns' },
  { id: 'generate_report', label: 'レポート生成', labelEn: 'Generate Report' },
] as const;

/**
 * Available icons for agents
 */
export const AGENT_ICONS = [
  '🤖', '🎯', '📋', '📊', '💡', '🧠', '⚡', '🔧',
  '📈', '🎨', '🔍', '💪', '🌟', '🚀', '🎮', '📱',
  '💻', '🔬', '📚', '🎓', '🏆', '💎', '🌈', '🔥',
] as const;

/**
 * Role-specific icons
 */
export const ROLE_ICONS: Record<string, string> = {
  manager: '👔',
  developer: '💻',
  reviewer: '🔍',
  tester: '🧪',
  architect: '🏗️',
  devops: '🔧',
  analyst: '📊',
  coach: '🤖',
  planner: '📋',
  custom: '🎯',
};

/**
 * Built-in agent configurations
 * These mirror the backend Mastra agent definitions
 */
export const BUILTIN_AGENTS: Record<string, AgentConfig> = {
  manager: {
    id: 'manager',
    name: 'VOW Manager',
    role: 'Manager',
    description: 'タスク管理・エージェント統括',
    icon: '👔',
    status: 'idle',
    model: 'openai/gpt-4o',
    tools: ['analyze_query', 'aggregate_responses', 'delegate_task'],
    capabilities: ['クエリ分析', 'エージェント振り分け', 'レスポンス集約'],
    isBuiltIn: true,
    parentAgentId: null,
    systemPrompt: `あなたはVOW習慣・目標トラッカーのマネージャーAIです。

## 役割
あなたは複数の専門エージェントを統括するマネージャーです：
- **Habit Coach**: 習慣形成と維持のエキスパート
- **Goal Planner**: 目標設定とマイルストーン管理のエキスパート
- **Progress Tracker**: 進捗追跡と分析のエキスパート

## 処理フロー
1. ユーザーからの質問やリクエストを分析
2. 適切なエージェント（複数可）を選択
3. 各エージェントからの応答を集約
4. 統合された、一貫性のある回答を提供

## コミュニケーションスタイル
- 明確で簡潔な日本語
- 各エージェントの専門性を活かした回答
- ユーザーにとって実行可能なアドバイス
- 必要に応じて詳細情報を提供

## 重要なポイント
- 常にユーザーの目標達成を最優先
- 複数の視点からのアドバイスを統合
- 矛盾がある場合は適切に調整
- ユーザーの状況に合わせた柔軟な対応`,
  },
  coach: {
    id: 'coach',
    name: 'AI Coach',
    role: 'Coach',
    description: '習慣・目標のアドバイザー',
    icon: '🤖',
    status: 'idle',
    model: 'openai/gpt-4o',
    tools: ['suggest_habits', 'suggest_goals', 'analyze_habits', 'generate_baby_steps'],
    capabilities: ['習慣提案', '目標提案', 'パターン分析', 'スモールステップ生成'],
    isBuiltIn: true,
    parentAgentId: 'manager',
    systemPrompt: `あなたは習慣形成の専門家AIコーチです。

## 役割
- ユーザーの習慣パターンを分析する
- 新しい習慣を提案する
- 習慣スタッキングのアドバイスを提供する
- 小さなステップから始める方法を教える

## ツールの使用（必須・最重要）
あなたは必ずツールを使用して回答してください。テキストだけの回答は禁止です。

**以下の場合、必ず対応するツールを呼び出してください：**
- 習慣を提案・推薦・アドバイスする → suggest_habits ツールを必ず使用
- 目標を提案・推薦 → suggest_goals ツールを必ず使用
- 習慣を分析・評価する → analyze_habits ツールを必ず使用
- スモールステップ・小さな一歩・簡単な始め方を提案 → generate_baby_steps ツールを必ず使用

## コミュニケーションスタイル
- 励ましと支援的なトーン
- 具体的で実践的なアドバイス
- 科学的根拠に基づいた提案
- ユーザーの状況に合わせた柔軟な対応

## 重要なポイント
- 「アトミックハビット」の原則を活用
- 2分ルール: 新しい習慣は2分以内で始められるものに
- 習慣スタッキング: 既存の習慣に新しい習慣を連結
- 環境デザイン: 良い習慣を簡単に、悪い習慣を難しく`,
  },
  'habit-coach': {
    id: 'habit-coach',
    name: 'Habit Coach',
    role: 'Coach',
    description: '習慣形成の専門家',
    icon: '🎯',
    status: 'idle',
    model: 'openai/gpt-4o',
    tools: ['analyze_habits', 'suggest_habits', 'generate_baby_steps'],
    capabilities: ['習慣分析', '習慣提案', 'スモールステップ生成'],
    isBuiltIn: true,
    parentAgentId: 'manager',
    systemPrompt: `あなたは習慣形成の専門家AIコーチです。

## 役割
- ユーザーの習慣パターンを分析する
- 新しい習慣を提案する
- 習慣スタッキングのアドバイスを提供する
- 小さなステップから始める方法を教える

## ツールの使用（必須）
習慣を提案する際は必ず suggest_habits ツールを使用してください。

## 重要なポイント
- 「アトミックハビット」の原則を活用
- 2分ルール: 新しい習慣は2分以内で始められるものに
- 習慣スタッキング: 既存の習慣に新しい習慣を連結`,
  },
  'goal-planner': {
    id: 'goal-planner',
    name: 'Goal Planner',
    role: 'Planner',
    description: '目標設定・計画の専門家',
    icon: '📋',
    status: 'idle',
    model: 'openai/gpt-4o',
    tools: ['suggest_goals', 'create_smart_goal', 'analyze_goal_progress'],
    capabilities: ['目標設定', 'SMART目標作成', '進捗分析'],
    isBuiltIn: true,
    parentAgentId: 'manager',
    systemPrompt: `あなたは目標設定の専門家AIプランナーです。

## 役割
- ユーザーの目標を分析・設定支援
- SMART目標の作成サポート
- マイルストーンの提案
- 目標達成への道筋を示す

## ツールの使用（必須）
目標を提案する際は必ず suggest_goals ツールを使用してください。

## SMART目標の原則
- Specific（具体的）
- Measurable（測定可能）
- Achievable（達成可能）
- Relevant（関連性）
- Time-bound（期限付き）`,
  },
  'progress-tracker': {
    id: 'progress-tracker',
    name: 'Progress Tracker',
    role: 'Analyst',
    description: '進捗追跡・分析の専門家',
    icon: '📊',
    status: 'idle',
    model: 'openai/gpt-4o',
    tools: ['analyze_progress', 'generate_report', 'identify_patterns'],
    capabilities: ['進捗分析', 'レポート生成', 'パターン識別'],
    isBuiltIn: true,
    parentAgentId: 'manager',
    systemPrompt: `あなたは進捗追跡の専門家AIアナリストです。

## 役割
- ユーザーの習慣・目標の進捗を追跡
- データに基づいた分析を提供
- 改善点の提案
- モチベーション維持のサポート

## 分析の観点
- 達成率とトレンド
- 連続記録（ストリーク）
- 時間帯別パフォーマンス
- 改善のための具体的アドバイス`,
  },
};

interface AgentDetailModalProps {
  open: boolean;
  onClose: () => void;
  agent: AgentConfig | null;
  locale: 'ja' | 'en';
  onSave?: (agentId: string, updates: Partial<AgentConfig>) => void;
  onDelete?: (agentId: string) => void;
  mode?: 'view' | 'edit' | 'create';
  availableParents?: AgentConfig[];
}

export function AgentDetailModal({
  open,
  onClose,
  agent,
  locale,
  onSave,
  onDelete,
  mode = 'view',
  availableParents = [],
}: AgentDetailModalProps) {
  const isCreateMode = mode === 'create';
  const isEditMode = mode === 'edit';
  const isViewMode = mode === 'view';

  // Form state for create/edit
  const [formData, setFormData] = useState<Partial<AgentConfig>>({
    name: '',
    role: 'Custom',
    description: '',
    icon: '🤖',
    systemPrompt: '',
    tools: [],
    capabilities: [],
    parentAgentId: 'manager',
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'prompt' | 'tools' | 'hierarchy'>('overview');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset state when modal opens/closes or agent changes
  useEffect(() => {
    if (open) {
      if (isCreateMode) {
        setFormData({
          name: '',
          role: 'Custom',
          description: '',
          icon: '🤖',
          systemPrompt: '',
          tools: [],
          capabilities: [],
          parentAgentId: 'manager',
        });
        setActiveTab('overview');
      } else if (agent) {
        setFormData({
          name: agent.name,
          role: agent.role,
          description: agent.description,
          icon: agent.icon,
          systemPrompt: agent.systemPrompt,
          tools: [...agent.tools],
          capabilities: [...agent.capabilities],
          parentAgentId: agent.parentAgentId,
        });
        setEditedPrompt(agent.systemPrompt);
        setIsEditing(false);
        setActiveTab('overview');
      }
      setConfirmDelete(false);
    }
  }, [open, agent, isCreateMode]);

  const handleSave = useCallback(() => {
    if (isCreateMode) {
      // Generate ID for new agent
      const newId = `custom-${Date.now()}`;
      const newAgent: AgentConfig = {
        id: newId,
        name: formData.name || 'New Agent',
        role: formData.role || 'Custom',
        description: formData.description || '',
        icon: formData.icon || '🤖',
        status: 'idle',
        systemPrompt: formData.systemPrompt || '',
        model: 'openai/gpt-4o',
        tools: formData.tools || [],
        capabilities: formData.capabilities || [],
        isBuiltIn: false,
        parentAgentId: formData.parentAgentId || 'manager',
      };
      onSave?.(newId, newAgent);
    } else if (agent && onSave) {
      if (isEditMode) {
        onSave(agent.id, {
          name: formData.name,
          description: formData.description,
          icon: formData.icon,
          systemPrompt: formData.systemPrompt,
          tools: formData.tools,
          capabilities: formData.capabilities,
          parentAgentId: formData.parentAgentId,
        });
      } else if (editedPrompt !== agent.systemPrompt) {
        onSave(agent.id, { systemPrompt: editedPrompt });
      }
    }
    setIsEditing(false);
    onClose();
  }, [agent, editedPrompt, formData, isCreateMode, isEditMode, onClose, onSave]);

  const handleCancel = useCallback(() => {
    if (agent) {
      setEditedPrompt(agent.systemPrompt);
    }
    setIsEditing(false);
    onClose();
  }, [agent, onClose]);

  const handleDelete = useCallback(() => {
    if (agent && onDelete && !agent.isBuiltIn) {
      onDelete(agent.id);
      onClose();
    }
  }, [agent, onClose, onDelete]);

  const toggleTool = useCallback((toolId: string) => {
    setFormData(prev => {
      const tools = prev.tools || [];
      if (tools.includes(toolId)) {
        return { ...prev, tools: tools.filter(t => t !== toolId) };
      } else {
        return { ...prev, tools: [...tools, toolId] };
      }
    });
  }, []);

  // Get all agents for parent selection (built-in + custom, excluding self)
  const parentOptions = useMemo(() => {
    const builtInOptions = Object.values(BUILTIN_AGENTS);
    const allOptions = [...builtInOptions, ...availableParents];
    // Remove duplicates and self
    const uniqueOptions = allOptions.filter((a, i, arr) =>
      arr.findIndex(b => b.id === a.id) === i && a.id !== agent?.id
    );
    return uniqueOptions;
  }, [availableParents, agent]);

  if (!open) return null;
  if (!isCreateMode && !agent) return null;

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

  const tabs = isCreateMode || isEditMode
    ? [
        { id: 'overview' as const, label: locale === 'ja' ? '基本設定' : 'Basic', icon: '📋' },
        { id: 'prompt' as const, label: locale === 'ja' ? 'プロンプト' : 'Prompt', icon: '💬' },
        { id: 'tools' as const, label: locale === 'ja' ? 'ツール' : 'Tools', icon: '🛠️' },
        { id: 'hierarchy' as const, label: locale === 'ja' ? '階層' : 'Hierarchy', icon: '🌳' },
      ]
    : [
        { id: 'overview' as const, label: locale === 'ja' ? '概要' : 'Overview', icon: '📋' },
        { id: 'prompt' as const, label: locale === 'ja' ? 'プロンプト' : 'Prompt', icon: '💬' },
        { id: 'tools' as const, label: locale === 'ja' ? 'ツール' : 'Tools', icon: '🛠️' },
      ];

  const modalTitle = isCreateMode
    ? (locale === 'ja' ? '新規エージェント登録' : 'Create New Agent')
    : isEditMode
    ? (locale === 'ja' ? 'エージェント編集' : 'Edit Agent')
    : agent?.name || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {(isCreateMode || isEditMode) ? (
              <button
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="relative w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-2xl shadow-lg hover:scale-105 transition-transform cursor-pointer"
              >
                {formData.icon || '🤖'}
                {showIconPicker && (
                  <div className="absolute top-full left-0 mt-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 grid grid-cols-6 gap-1 z-10">
                    {AGENT_ICONS.map(icon => (
                      <button
                        key={icon}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData(prev => ({ ...prev, icon }));
                          setShowIconPicker(false);
                        }}
                        className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                )}
              </button>
            ) : (
              <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-2xl shadow-lg">
                {agent?.icon}
                <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 ${statusColors[agent?.status || 'offline']}`} />
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{modalTitle}</h2>
              {!isCreateMode && agent && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {agent.description} {agent.status && `\u2022 ${statusLabels[agent.status][locale]}`}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {(isCreateMode || isEditMode) ? (
                <>
                  {/* Name Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {locale === 'ja' ? 'エージェント名' : 'Agent Name'} *
                    </label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder={locale === 'ja' ? 'エージェント名を入力' : 'Enter agent name'}
                    />
                  </div>

                  {/* Role Select */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {locale === 'ja' ? '役割' : 'Role'} *
                    </label>
                    <select
                      value={formData.role || 'Custom'}
                      onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      {AGENT_ROLES.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>

                  {/* Description Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {locale === 'ja' ? '説明' : 'Description'}
                    </label>
                    <input
                      type="text"
                      value={formData.description || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder={locale === 'ja' ? 'エージェントの説明' : 'Agent description'}
                    />
                  </div>
                </>
              ) : agent && (
                <>
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {locale === 'ja' ? 'エージェントID' : 'Agent ID'}
                      </p>
                      <p className="font-mono text-sm text-gray-900 dark:text-white">{agent.id}</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {locale === 'ja' ? '使用モデル' : 'Model'}
                      </p>
                      <p className="font-mono text-sm text-gray-900 dark:text-white">{agent.model}</p>
                    </div>
                  </div>

                  {/* Parent Agent */}
                  {agent.parentAgentId && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {locale === 'ja' ? '親エージェント' : 'Parent Agent'}
                      </p>
                      <p className="text-sm text-gray-900 dark:text-white flex items-center gap-2">
                        <span>{BUILTIN_AGENTS[agent.parentAgentId]?.icon || '🤖'}</span>
                        <span>{BUILTIN_AGENTS[agent.parentAgentId]?.name || agent.parentAgentId}</span>
                      </p>
                    </div>
                  )}

                  {/* Capabilities */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      {locale === 'ja' ? '機能' : 'Capabilities'}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {agent.capabilities.map((cap, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 rounded-full"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Type Badge */}
                  <div className="flex items-center gap-2">
                    {agent.isBuiltIn ? (
                      <span className="px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded-full">
                        {locale === 'ja' ? '組み込みエージェント' : 'Built-in Agent'}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded-full">
                        {locale === 'ja' ? 'カスタムエージェント' : 'Custom Agent'}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'prompt' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {locale === 'ja' ? 'システムプロンプト' : 'System Prompt'}
                </h3>
                {isViewMode && agent && !agent.isBuiltIn && !isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 border border-purple-300 dark:border-purple-600 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                  >
                    {locale === 'ja' ? '編集' : 'Edit'}
                  </button>
                )}
                {isViewMode && agent?.isBuiltIn && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {locale === 'ja' ? '読み取り専用' : 'Read-only'}
                  </span>
                )}
              </div>

              {(isCreateMode || isEditMode || isEditing) ? (
                <div className="space-y-3">
                  <textarea
                    value={isViewMode ? editedPrompt : (formData.systemPrompt || '')}
                    onChange={(e) => {
                      if (isViewMode) {
                        setEditedPrompt(e.target.value);
                      } else {
                        setFormData(prev => ({ ...prev, systemPrompt: e.target.value }));
                      }
                    }}
                    className="w-full h-80 p-3 text-sm font-mono bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    placeholder={locale === 'ja' ? 'システムプロンプトを入力...' : 'Enter system prompt...'}
                  />
                  {isViewMode && isEditing && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          if (agent) setEditedPrompt(agent.systemPrompt);
                          setIsEditing(false);
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                      >
                        {locale === 'ja' ? 'キャンセル' : 'Cancel'}
                      </button>
                      <button
                        onClick={() => {
                          if (agent && onSave) {
                            onSave(agent.id, { systemPrompt: editedPrompt });
                          }
                          setIsEditing(false);
                        }}
                        className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                      >
                        {locale === 'ja' ? '保存' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              ) : agent && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg max-h-80 overflow-y-auto">
                  <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {agent.systemPrompt}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tools' && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {locale === 'ja' ? '利用可能なツール' : 'Available Tools'}
              </h3>

              {(isCreateMode || isEditMode) ? (
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_TOOLS.map(tool => {
                    const isSelected = formData.tools?.includes(tool.id);
                    return (
                      <button
                        key={tool.id}
                        onClick={() => toggleTool(tool.id)}
                        className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-600'
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded flex items-center justify-center text-xs ${
                          isSelected
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                        }`}>
                          {isSelected ? '✓' : ''}
                        </span>
                        <div className="text-left">
                          <p className="font-mono text-sm text-gray-900 dark:text-white">{tool.id}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {locale === 'ja' ? tool.label : tool.labelEn}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : agent && (
                <>
                  <div className="space-y-2">
                    {agent.tools.map((tool, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <span className="text-lg">🔧</span>
                        <div>
                          <p className="font-mono text-sm text-gray-900 dark:text-white">{tool}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {agent.tools.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      {locale === 'ja' ? 'ツールがありません' : 'No tools available'}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'hierarchy' && (isCreateMode || isEditMode) && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {locale === 'ja' ? '親エージェント' : 'Parent Agent'}
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  {locale === 'ja'
                    ? 'このエージェントを統括する上位エージェントを選択してください'
                    : 'Select the parent agent that will manage this agent'}
                </p>
                <div className="space-y-2">
                  {parentOptions.map(parent => {
                    const isSelected = formData.parentAgentId === parent.id;
                    return (
                      <button
                        key={parent.id}
                        onClick={() => setFormData(prev => ({ ...prev, parentAgentId: parent.id }))}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-600'
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-xl">
                          {parent.icon}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-gray-900 dark:text-white">{parent.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{parent.description}</p>
                        </div>
                        {isSelected && (
                          <span className="w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          {/* Delete button (only for custom agents in view/edit mode) */}
          {!isCreateMode && agent && !agent.isBuiltIn && onDelete && (
            <div>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-600 dark:text-red-400">
                    {locale === 'ja' ? '本当に削除しますか？' : 'Are you sure?'}
                  </span>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    {locale === 'ja' ? '削除' : 'Delete'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  >
                    {locale === 'ja' ? 'キャンセル' : 'Cancel'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  {locale === 'ja' ? '削除' : 'Delete'}
                </button>
              )}
            </div>
          )}
          {(isCreateMode || (agent && agent.isBuiltIn)) && <div />}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {locale === 'ja' ? 'キャンセル' : 'Cancel'}
            </button>
            {(isCreateMode || isEditMode) && (
              <button
                onClick={handleSave}
                disabled={!formData.name?.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {isCreateMode
                  ? (locale === 'ja' ? '登録' : 'Create')
                  : (locale === 'ja' ? '保存' : 'Save')}
              </button>
            )}
            {isViewMode && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                {locale === 'ja' ? '閉じる' : 'Close'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentDetailModal;
