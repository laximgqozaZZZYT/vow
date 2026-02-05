/**
 * Agent.ListView - Agent List View Component
 *
 * Displays agent tree with hierarchical structure
 *
 * @module Agent.ListView
 */

'use client';

import React, { useState } from 'react';
import type { ServerConnection } from '../hooks/useMultiAgentServer';
import type { AgentConfig } from './Modal.AgentDetail';
import { ROLE_ICONS } from './Modal.AgentDetail';
import { RemoteAgentInstaller } from './Agent.RemoteInstaller';
import { RemoteAgentGuide } from './Agent.RemoteGuide';
import { RemoteTaskExecutor } from './Agent.RemoteTaskExecutor';

interface AgentListViewProps {
  connections: Map<string, ServerConnection>;
  locale: 'ja' | 'en';
  customAgents?: AgentConfig[];
  onSelectAgent?: (agentId: string) => void;
  onAddAgent?: () => void;
  onEditAgent?: (agentId: string) => void;
  onDeleteAgent?: (agentId: string) => void;
}

export function AgentListView({
  connections,
  locale,
  customAgents = [],
  onSelectAgent,
  onAddAgent,
  onEditAgent,
  onDeleteAgent
}: AgentListViewProps) {
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

export default AgentListView;
