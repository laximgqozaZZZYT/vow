/**
 * Agent.ListView - Role Card Grid Component
 *
 * Displays roles as a card grid (built-in + custom roles)
 * with a separate section for connected MCP agents.
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
  builtInAgents?: AgentConfig[];
  onSelectAgent?: (agentId: string) => void;
  onAddAgent?: () => void;
  onEditAgent?: (agentId: string) => void;
  onDeleteAgent?: (agentId: string) => void;
}

export function AgentListView({
  connections,
  locale,
  customAgents = [],
  builtInAgents = [],
  onSelectAgent,
  onAddAgent,
  onEditAgent,
  onDeleteAgent
}: AgentListViewProps) {
  const allMcpAgents = Array.from(connections.values()).flatMap(c => c.agents || []);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Built-in roles from backend (with fallback)
  const builtInRoles = builtInAgents.length > 0
    ? builtInAgents.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        icon: a.icon,
        gradient: 'from-purple-500 to-indigo-500',
        isBuiltIn: true,
        capabilities: a.capabilities || [],
      }))
    : [
        {
          id: 'AICoach',
          name: 'AI Coach',
          description: locale === 'ja' ? '習慣・目標のAIコーチ' : 'AI Coach for habits & goals',
          icon: '🎯',
          gradient: 'from-purple-500 to-indigo-500',
          isBuiltIn: true,
          capabilities: [] as string[],
        },
      ];

  // Combine built-in + custom roles
  const allRoles = [
    ...builtInRoles,
    ...customAgents.map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      icon: a.icon,
      gradient: 'from-pink-500 to-rose-500',
      isBuiltIn: a.isBuiltIn,
      capabilities: a.capabilities || [],
    })),
  ];

  return (
    <div className="p-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {locale === 'ja' ? '役割一覧' : 'Roles'}
        </h3>
        {onAddAgent && (
          <button
            onClick={onAddAgent}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 border border-purple-300 dark:border-purple-600 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {locale === 'ja' ? '役割を追加' : 'Add Role'}
          </button>
        )}
      </div>

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 gap-3">
        {allRoles.map(role => {
          const isConfirmingDelete = confirmDeleteId === role.id;
          return (
            <div
              key={role.id}
              className="group relative flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 cursor-pointer transition-all hover:shadow-sm"
              onClick={() => onSelectAgent?.(role.id)}
            >
              {/* Icon */}
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${role.gradient} flex items-center justify-center text-xl shadow-sm flex-shrink-0`}>
                {role.icon}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm text-foreground truncate">{role.name}</h4>
                  {role.isBuiltIn && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                      {locale === 'ja' ? '組み込み' : 'Built-in'}
                    </span>
                  )}
                  {!role.isBuiltIn && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                      {locale === 'ja' ? 'カスタム' : 'Custom'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{role.description}</p>
              </div>

              {/* Action buttons - show on hover, only for custom roles */}
              {!role.isBuiltIn && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onEditAgent && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditAgent(role.id); }}
                      className="p-1.5 text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                      title={locale === 'ja' ? '編集' : 'Edit'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                  {onDeleteAgent && (
                    isConfirmingDelete ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { onDeleteAgent(role.id); setConfirmDeleteId(null); }}
                          className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                        >
                          {locale === 'ja' ? '削除' : 'Delete'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(role.id); }}
                        className="p-1.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title={locale === 'ja' ? '削除' : 'Delete'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MCP Agents Section - separate from roles */}
      {allMcpAgents.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {locale === 'ja' ? '接続済みMCPエージェント' : 'Connected MCP Agents'}
          </h3>
          <div className="space-y-2">
            {allMcpAgents.map(agent => (
              <div
                key={agent.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onSelectAgent?.(agent.id)}
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center text-lg flex-shrink-0">
                  {ROLE_ICONS[agent.role.toLowerCase()] || '🤖'}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-foreground truncate">{agent.name}</h4>
                  <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
                </div>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  agent.status === 'idle' ? 'bg-green-500' :
                  agent.status === 'busy' ? 'bg-yellow-500' : 'bg-gray-400'
                }`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {allMcpAgents.length === 0 && customAgents.length === 0 && (
        <div className="mt-6 text-center text-muted-foreground py-6 border-2 border-dashed border-border rounded-lg">
          <span className="text-2xl mb-2 block">🔌</span>
          <p className="text-sm font-medium">{locale === 'ja' ? 'MCPエージェント未接続' : 'No MCP agents connected'}</p>
          <p className="text-xs mt-1">{locale === 'ja' ? '設定からMCPサーバーに接続' : 'Connect via settings'}</p>
        </div>
      )}

      {/* Remote Agent Setup Components */}
      <RemoteAgentInstaller locale={locale} />
      <RemoteAgentGuide locale={locale} />
      <RemoteTaskExecutor locale={locale} />
    </div>
  );
}

export default AgentListView;
