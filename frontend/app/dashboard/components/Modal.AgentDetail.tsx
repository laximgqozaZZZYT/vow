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

import { useState, useEffect, useCallback } from 'react';
import { getRoleSystemPrompt } from '../constants/role-prompts';

/**
 * Agent configuration data
 */
export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  description: string;
  icon: string;
  systemPrompt: string;
  capabilities: string[];
  isBuiltIn: boolean; // Built-in agents cannot have their prompts modified
}

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
  AICoach: '🎯',
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
  AICoach: {
    id: 'AICoach',
    name: 'AI Coach',
    role: 'Coach',
    description: '習慣・目標のAIコーチ',
    icon: '🎯',
    systemPrompt: getRoleSystemPrompt('AICoach', 'ja'),
    capabilities: ['習慣提案', '目標提案', 'パターン分析', 'スモールステップ生成'],
    isBuiltIn: true,
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
}

export function AgentDetailModal({
  open,
  onClose,
  agent,
  locale,
  onSave,
  onDelete,
  mode = 'view',
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
    capabilities: [],
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'prompt'>('overview');
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
          capabilities: [],
        });
        setActiveTab('overview');
      } else if (agent) {
        setFormData({
          name: agent.name,
          role: agent.role,
          description: agent.description,
          icon: agent.icon,
          systemPrompt: agent.systemPrompt,
          capabilities: [...agent.capabilities],
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
        systemPrompt: formData.systemPrompt || '',
        capabilities: formData.capabilities || [],
        isBuiltIn: false,
      };
      onSave?.(newId, newAgent);
    } else if (agent && onSave) {
      if (isEditMode) {
        onSave(agent.id, {
          name: formData.name,
          description: formData.description,
          icon: formData.icon,
          systemPrompt: formData.systemPrompt,
          capabilities: formData.capabilities,
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

  if (!open) return null;
  if (!isCreateMode && !agent) return null;

  const tabs = isCreateMode || isEditMode
    ? [
        { id: 'overview' as const, label: locale === 'ja' ? '基本設定' : 'Basic', icon: '📋' },
        { id: 'prompt' as const, label: locale === 'ja' ? 'プロンプト' : 'Prompt', icon: '💬' },
      ]
    : [
        { id: 'overview' as const, label: locale === 'ja' ? '概要' : 'Overview', icon: '📋' },
        { id: 'prompt' as const, label: locale === 'ja' ? 'プロンプト' : 'Prompt', icon: '💬' },
      ];

  const modalTitle = isCreateMode
    ? (locale === 'ja' ? '新規役割登録' : 'Create New Role')
    : isEditMode
    ? (locale === 'ja' ? '役割編集' : 'Edit Role')
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
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-2xl shadow-lg">
                {agent?.icon}
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{modalTitle}</h2>
              {!isCreateMode && agent && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {agent.description}
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
                      {locale === 'ja' ? '役割名' : 'Role Name'} *
                    </label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder={locale === 'ja' ? '役割名を入力' : 'Enter role name'}
                    />
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
                      placeholder={locale === 'ja' ? '役割の説明' : 'Role description'}
                    />
                  </div>
                </>
              ) : agent && (
                <>
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
