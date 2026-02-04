"use client";

/**
 * ServerList Widget
 *
 * Displays a list of configured MCP servers with connection status
 * and controls for each server.
 *
 * @module Widget.ServerList
 */

import { memo } from 'react';
import type { McpServer } from '../types/agent.types';
import type { ServerConnection, ConnectionState } from '../hooks/useMultiAgentServer';

interface ServerListProps {
  servers: McpServer[];
  connections: Map<string, ServerConnection>;
  onAdd: () => void;
  onEdit: (serverId: string) => void;
  onRemove: (serverId: string) => void;
  onConnect: (serverId: string) => void;
  onDisconnect: (serverId: string) => void;
}

/**
 * Connection status indicator
 */
function StatusIndicator({ state }: { state: ConnectionState }) {
  const config = {
    disconnected: { color: 'bg-gray-400', label: 'Offline' },
    connecting: { color: 'bg-yellow-400 animate-pulse', label: '接続中...' },
    connected: { color: 'bg-green-500', label: 'Connected' },
    error: { color: 'bg-red-500', label: 'Error' },
  };

  const { color, label } = config[state];

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/**
 * Individual server item
 */
function ServerItem({
  server,
  connection,
  onEdit,
  onRemove,
  onConnect,
  onDisconnect,
}: {
  server: McpServer;
  connection?: ServerConnection;
  onEdit: () => void;
  onRemove: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const state = connection?.connectionState || 'disconnected';
  const isConnected = state === 'connected';
  const isConnecting = state === 'connecting';

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
      {/* Priority Badge */}
      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary/10 rounded text-xs font-medium text-primary" title={`優先度: ${server.priority ?? 5}`}>
        {server.priority ?? 5}
      </div>

      {/* Server Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{server.name}</span>
          {!server.enabled && (
            <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
              無効
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">
          {server.serverUrl || '(URL未設定)'}
        </div>
        <StatusIndicator state={state} />
        {connection?.error && (
          <div className="text-xs text-red-500 mt-1 truncate">
            {connection.error}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Connect/Disconnect Button */}
        {isConnected ? (
          <button
            onClick={onDisconnect}
            className="p-1.5 rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
            title="切断"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={isConnecting || !server.serverUrl || !server.serverToken}
            className="p-1.5 rounded-md text-green-500 hover:bg-green-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="接続"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
          </button>
        )}

        {/* Edit Button */}
        <button
          onClick={onEdit}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="編集"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>

        {/* Delete Button */}
        <button
          onClick={onRemove}
          className="p-1.5 rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
          title="削除"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * ServerList Component
 */
function ServerListComponent({
  servers,
  connections,
  onAdd,
  onEdit,
  onRemove,
  onConnect,
  onDisconnect,
}: ServerListProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          MCP Servers ({servers.length})
        </h3>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 text-xs px-2 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>追加</span>
        </button>
      </div>

      {/* Server List */}
      {servers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <div className="text-3xl mb-2">🖥️</div>
          <div className="text-sm">サーバーが登録されていません</div>
          <button
            onClick={onAdd}
            className="mt-3 text-xs text-primary hover:underline"
          >
            + 最初のサーバーを追加
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {[...servers]
            .sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5))
            .map((server) => (
              <ServerItem
                key={server.id}
                server={server}
                connection={connections.get(server.id)}
                onEdit={() => onEdit(server.id)}
                onRemove={() => onRemove(server.id)}
                onConnect={() => onConnect(server.id)}
                onDisconnect={() => onDisconnect(server.id)}
              />
            ))}
        </div>
      )}

      {/* Connection Summary */}
      {servers.length > 0 && (
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              接続中: {Array.from(connections.values()).filter(c => c.connectionState === 'connected').length} / {servers.length}
            </span>
            {servers.some(s => s.enabled) && (
              <button
                onClick={() => {
                  servers.filter(s => s.enabled && s.serverUrl && s.serverToken).forEach(s => {
                    const conn = connections.get(s.id);
                    if (conn?.connectionState !== 'connected') {
                      onConnect(s.id);
                    }
                  });
                }}
                className="text-primary hover:underline"
              >
                全て接続
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const ServerList = memo(ServerListComponent);
export default ServerList;
