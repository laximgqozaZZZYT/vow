/**
 * Modal.MultiAgentConfig - Multi-Agent Server Configuration Modal
 *
 * Allows users to configure multiple MCP Task Servers.
 * Supports list mode (view all servers) and edit mode (add/edit single server).
 *
 * @module Modal.MultiAgentConfig
 */

'use client';

import { useState, useEffect } from 'react';
import type { MultiAgentConfig, McpServer } from '../types/agent.types';
import type { ConnectionState, ServerConnection } from '../hooks/useMultiAgentServer';
import { ServerList } from './Widget.ServerList';

type ModalMode = 'list' | 'add' | 'edit';

interface MultiAgentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: MultiAgentConfig;
  onUpdateConfig: (updates: Partial<MultiAgentConfig>) => void;
  connections: Map<string, ServerConnection>;
  connectionState: ConnectionState;
  error: string | null;
  onAddServer: (server: Omit<McpServer, 'id'>) => string;
  onUpdateServer: (serverId: string, updates: Partial<McpServer>) => void;
  onRemoveServer: (serverId: string) => void;
  onConnectServer: (serverId: string) => Promise<void>;
  onDisconnectServer: (serverId: string) => void;
  onConnectAllEnabled: () => Promise<void>;
  onDisconnectAll: () => void;
}

/**
 * Server Edit Form Component
 */
function ServerEditForm({
  server,
  isNew,
  onSave,
  onCancel,
  onTestConnection,
}: {
  server: Partial<McpServer>;
  isNew: boolean;
  onSave: (data: Omit<McpServer, 'id'>) => void;
  onCancel: () => void;
  onTestConnection: (url: string, token: string) => Promise<{ success: boolean; message: string }>;
}) {
  const [localServer, setLocalServer] = useState<Partial<McpServer>>({
    name: '',
    serverUrl: '',
    serverToken: '',
    enabled: true,
    autoConnect: true,
    priority: 5,
    ...server,
  });
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    if (!localServer.serverUrl) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await onTestConnection(localServer.serverUrl, localServer.serverToken || '');
      setTestResult(result);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (!localServer.name || !localServer.serverUrl) return;
    onSave({
      name: localServer.name,
      serverUrl: localServer.serverUrl,
      serverToken: localServer.serverToken || '',
      enabled: localServer.enabled ?? true,
      autoConnect: localServer.autoConnect ?? true,
      priority: localServer.priority ?? 5,
    });
  };

  const isValid = localServer.name && localServer.serverUrl;

  return (
    <div className="space-y-4">
      {/* Server Name */}
      <div>
        <label className="block text-sm font-medium mb-1">サーバー名</label>
        <input
          type="text"
          value={localServer.name || ''}
          onChange={(e) => setLocalServer(prev => ({ ...prev, name: e.target.value }))}
          placeholder="例: Local Server, Remote Dev"
          className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Server URL */}
      <div>
        <label className="block text-sm font-medium mb-1">サーバーURL</label>
        <input
          type="text"
          value={localServer.serverUrl || ''}
          onChange={(e) => setLocalServer(prev => ({ ...prev, serverUrl: e.target.value }))}
          placeholder="https://example.tailddc354.ts.net または http://192.168.2.126:3456"
          className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Server Token */}
      <div>
        <label className="block text-sm font-medium mb-1">認証トークン</label>
        <div className="relative">
          <input
            type={showToken ? 'text' : 'password'}
            value={localServer.serverToken || ''}
            onChange={(e) => setLocalServer(prev => ({ ...prev, serverToken: e.target.value }))}
            placeholder="mcp-..."
            className="w-full px-3 py-2 pr-10 bg-muted border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
          >
            {showToken ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {localServer.serverToken === '********' && (
          <p className="text-xs text-muted-foreground mt-1">
            トークンは保存済みです。変更する場合は新しいトークンを入力してください。
          </p>
        )}
      </div>

      {/* Test Connection */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleTest}
          disabled={isTesting || !localServer.serverUrl}
          className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted transition-colors disabled:opacity-50"
        >
          {isTesting ? '接続テスト中...' : '接続テスト'}
        </button>
        {testResult && (
          <span className={`text-sm ${testResult.success ? 'text-green-500' : 'text-red-500'}`}>
            {testResult.message}
          </span>
        )}
      </div>

      {/* Options */}
      <div className="space-y-3 pt-2 border-t border-border">
        <label className="flex items-center justify-between">
          <span className="text-sm">有効</span>
          <button
            type="button"
            onClick={() => setLocalServer(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={`
              relative w-9 h-5 rounded-full transition-colors
              ${localServer.enabled ? 'bg-primary' : 'bg-muted'}
            `}
          >
            <span
              className={`
                absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow
                ${localServer.enabled ? 'translate-x-4' : ''}
              `}
            />
          </button>
        </label>

        <label className="flex items-center justify-between">
          <span className="text-sm">自動接続</span>
          <button
            type="button"
            onClick={() => setLocalServer(prev => ({ ...prev, autoConnect: !prev.autoConnect }))}
            className={`
              relative w-9 h-5 rounded-full transition-colors
              ${localServer.autoConnect ? 'bg-primary' : 'bg-muted'}
            `}
          >
            <span
              className={`
                absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow
                ${localServer.autoConnect ? 'translate-x-4' : ''}
              `}
            />
          </button>
        </label>

        <label className="flex items-center justify-between">
          <div>
            <span className="text-sm">優先度</span>
            <p className="text-xs text-muted-foreground">1=最高, 10=最低</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="10"
              value={localServer.priority ?? 5}
              onChange={(e) => setLocalServer(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
              className="w-20 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="w-6 text-center text-sm font-medium bg-primary/10 rounded px-1">
              {localServer.priority ?? 5}
            </span>
          </div>
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-border rounded hover:bg-muted transition-colors"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isNew ? '追加' : '保存'}
        </button>
      </div>
    </div>
  );
}

/**
 * Global Settings Component
 */
function GlobalSettings({
  config,
  connections,
  onUpdate,
}: {
  config: MultiAgentConfig;
  connections: Map<string, ServerConnection>;
  onUpdate: (updates: Partial<MultiAgentConfig>) => void;
}) {
  const chatSettings = config.chatAgentSettings || {
    useMcpAgent: false,
    mcpServerId: undefined,
    fallbackToApi: true,
  };

  // Get connected servers for selection
  const connectedServers = config.servers.filter(s => {
    const conn = connections.get(s.id);
    return conn?.connectionState === 'connected';
  });

  const updateChatSettings = (updates: Partial<typeof chatSettings>) => {
    onUpdate({
      chatAgentSettings: {
        ...chatSettings,
        ...updates,
      },
    });
  };

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <h3 className="text-sm font-medium text-muted-foreground">グローバル設定</h3>

      {/* MCP Agent for Chat - NEW! */}
      <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
        <label className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium">チャットにMCPエージェントを使用</span>
            <p className="text-xs text-muted-foreground mt-0.5">
              MOCセクションでClaude Codeエージェントを使用します
            </p>
          </div>
          <button
            type="button"
            onClick={() => updateChatSettings({ useMcpAgent: !chatSettings.useMcpAgent })}
            className={`
              relative w-9 h-5 rounded-full transition-colors
              ${chatSettings.useMcpAgent ? 'bg-primary' : 'bg-muted'}
            `}
          >
            <span
              className={`
                absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow
                ${chatSettings.useMcpAgent ? 'translate-x-4' : ''}
              `}
            />
          </button>
        </label>

        {chatSettings.useMcpAgent && (
          <>
            {/* Server Selection */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">チャット用サーバー</label>
              <select
                value={chatSettings.mcpServerId || ''}
                onChange={(e) => updateChatSettings({ mcpServerId: e.target.value || undefined })}
                className="w-full px-2 py-1.5 bg-muted border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">自動選択（接続済みの最初のサーバー）</option>
                {connectedServers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {connectedServers.length === 0 && (
                <p className="text-xs text-amber-500 mt-1">
                  ⚠️ 接続済みのサーバーがありません。サーバーに接続してください。
                </p>
              )}
            </div>

            {/* Fallback Option */}
            <label className="flex items-center justify-between">
              <span className="text-xs">MCP失敗時にOpenAIにフォールバック</span>
              <button
                type="button"
                onClick={() => updateChatSettings({ fallbackToApi: !chatSettings.fallbackToApi })}
                className={`
                  relative w-8 h-4 rounded-full transition-colors
                  ${chatSettings.fallbackToApi ? 'bg-primary' : 'bg-muted'}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform shadow
                    ${chatSettings.fallbackToApi ? 'translate-x-4' : ''}
                  `}
                />
              </button>
            </label>
          </>
        )}
      </div>

      <label className="flex items-center justify-between">
        <span className="text-sm">ダッシュボードに表示</span>
        <button
          type="button"
          onClick={() => onUpdate({ showInDashboard: !config.showInDashboard })}
          className={`
            relative w-9 h-5 rounded-full transition-colors
            ${config.showInDashboard ? 'bg-primary' : 'bg-muted'}
          `}
        >
          <span
            className={`
              absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow
              ${config.showInDashboard ? 'translate-x-4' : ''}
            `}
          />
        </button>
      </label>

      <label className="flex items-center justify-between">
        <span className="text-sm">タスク完了時に通知</span>
        <button
          type="button"
          onClick={() => onUpdate({ notifyOnTaskComplete: !config.notifyOnTaskComplete })}
          className={`
            relative w-9 h-5 rounded-full transition-colors
            ${config.notifyOnTaskComplete ? 'bg-primary' : 'bg-muted'}
          `}
        >
          <span
            className={`
              absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow
              ${config.notifyOnTaskComplete ? 'translate-x-4' : ''}
            `}
          />
        </button>
      </label>

      <label className="flex items-center justify-between">
        <span className="text-sm">エージェントオフライン時に通知</span>
        <button
          type="button"
          onClick={() => onUpdate({ notifyOnAgentOffline: !config.notifyOnAgentOffline })}
          className={`
            relative w-9 h-5 rounded-full transition-colors
            ${config.notifyOnAgentOffline ? 'bg-primary' : 'bg-muted'}
          `}
        >
          <span
            className={`
              absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow
              ${config.notifyOnAgentOffline ? 'translate-x-4' : ''}
            `}
          />
        </button>
      </label>
    </div>
  );
}

/**
 * Multi-Agent Configuration Modal
 */
export default function MultiAgentConfigModal({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  connections,
  connectionState,
  error,
  onAddServer,
  onUpdateServer,
  onRemoveServer,
  onConnectServer,
  onDisconnectServer,
  onConnectAllEnabled,
  onDisconnectAll,
}: MultiAgentConfigModalProps) {
  const [mode, setMode] = useState<ModalMode>('list');
  const [editingServerId, setEditingServerId] = useState<string | null>(null);

  // Reset mode when modal closes
  useEffect(() => {
    if (!isOpen) {
      setMode('list');
      setEditingServerId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const editingServer = editingServerId
    ? config.servers.find(s => s.id === editingServerId)
    : undefined;

  const handleTestConnection = async (url: string, token: string): Promise<{ success: boolean; message: string }> => {
    try {
      const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch(`${url}/health`, { headers });
      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: `接続成功 - Agents: ${data.data?.agents || 0}, Tasks: ${data.data?.tasks || 0}`,
        };
      } else {
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Connection failed';
      return { success: false, message };
    }
  };

  const handleAddServer = (data: Omit<McpServer, 'id'>) => {
    onAddServer(data);
    setMode('list');
  };

  const handleUpdateServer = (data: Omit<McpServer, 'id'>) => {
    if (editingServerId) {
      onUpdateServer(editingServerId, data);
    }
    setMode('list');
    setEditingServerId(null);
  };

  const handleEdit = (serverId: string) => {
    setEditingServerId(serverId);
    setMode('edit');
  };

  const handleRemove = (serverId: string) => {
    if (confirm('このサーバーを削除しますか？')) {
      onRemoveServer(serverId);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'add':
        return 'サーバーを追加';
      case 'edit':
        return 'サーバーを編集';
      default:
        return 'MCP Server 設定';
    }
  };

  const connectedCount = Array.from(connections.values()).filter(c => c.connectionState === 'connected').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-auto modern-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            {mode !== 'list' && (
              <button
                onClick={() => {
                  setMode('list');
                  setEditingServerId(null);
                }}
                className="p-1 hover:bg-muted rounded transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-lg font-semibold">{getTitle()}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {mode === 'list' && (
            <div className="space-y-4">
              {/* Connection Summary */}
              {config.servers.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${connectedCount > 0 ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className="text-sm">
                      {connectedCount} / {config.servers.length} 接続中
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {connectedCount > 0 ? (
                      <button
                        onClick={onDisconnectAll}
                        className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                      >
                        全て切断
                      </button>
                    ) : (
                      <button
                        onClick={onConnectAllEnabled}
                        disabled={!config.servers.some(s => s.enabled && s.serverUrl && s.serverToken)}
                        className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        全て接続
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Server List */}
              <ServerList
                servers={config.servers}
                connections={connections}
                onAdd={() => setMode('add')}
                onEdit={handleEdit}
                onRemove={handleRemove}
                onConnect={onConnectServer}
                onDisconnect={onDisconnectServer}
              />

              {/* Global Settings */}
              <GlobalSettings config={config} connections={connections} onUpdate={onUpdateConfig} />

              {/* MCP Server Download */}
              <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18" />
                      <path d="M9 21V9" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm mb-1">MCPサーバーをダウンロード</h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      自分のマシンでMCPタスクサーバーを実行し、Claude Codeエージェントを管理できます。
                    </p>
                    <a
                      href="/downloads/vow-mcp-server-v2.0.0.zip"
                      download
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      vow-mcp-server-v2.0.0.zip
                    </a>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Node.js 18+ が必要です。解凍後 <code className="bg-muted px-1 rounded">./setup.sh</code> を実行してください。
                    </p>
                  </div>
                </div>
              </div>

              {/* Help text */}
              <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg space-y-3">
                <div>
                  <p className="font-medium mb-1">設定方法:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>上記からMCPサーバーをダウンロード、または既存のサーバーを使用</li>
                    <li>「追加」ボタンでサーバーを登録（URL・トークンを入力）</li>
                    <li>接続ボタンで各サーバーに接続</li>
                  </ol>
                </div>
                <div className="pt-2 border-t border-border/50">
                  <p className="font-medium mb-1">リモートからの接続:</p>
                  <p className="text-muted-foreground/80">
                    Tailscale Funnelでサーバーを公開すると、どこからでも安全に接続できます。
                  </p>
                </div>
              </div>
            </div>
          )}

          {mode === 'add' && (
            <ServerEditForm
              server={{}}
              isNew={true}
              onSave={handleAddServer}
              onCancel={() => setMode('list')}
              onTestConnection={handleTestConnection}
            />
          )}

          {mode === 'edit' && editingServer && (
            <ServerEditForm
              server={editingServer}
              isNew={false}
              onSave={handleUpdateServer}
              onCancel={() => {
                setMode('list');
                setEditingServerId(null);
              }}
              onTestConnection={handleTestConnection}
            />
          )}
        </div>
      </div>
    </div>
  );
}
