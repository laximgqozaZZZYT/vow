/**
 * Modal.MultiAgentConfig - Multi-Agent Server Configuration Modal
 *
 * Allows users to configure connection to the MCP Task Server.
 *
 * @module Modal.MultiAgentConfig
 */

'use client';

import { useState, useEffect } from 'react';
import type { MultiAgentConfig } from '../types/agent.types';
import type { ConnectionState } from '../hooks/useMultiAgentServer';

interface MultiAgentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: MultiAgentConfig;
  onUpdateConfig: (updates: Partial<MultiAgentConfig>) => void;
  connectionState: ConnectionState;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

/**
 * Connection status indicator
 */
function ConnectionStatus({
  state,
  error,
}: {
  state: ConnectionState;
  error: string | null;
}) {
  const statusConfig = {
    disconnected: { color: 'bg-gray-400', label: '未接続', labelEn: 'Disconnected' },
    connecting: { color: 'bg-yellow-400 animate-pulse', label: '接続中...', labelEn: 'Connecting...' },
    connected: { color: 'bg-green-500', label: '接続済み', labelEn: 'Connected' },
    error: { color: 'bg-red-500', label: 'エラー', labelEn: 'Error' },
  };

  const cfg = statusConfig[state];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${cfg.color}`} />
      <span className="text-sm">{cfg.label}</span>
      {error && state === 'error' && (
        <span className="text-xs text-red-400 ml-2">{error}</span>
      )}
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
  connectionState,
  error,
  onConnect,
  onDisconnect,
}: MultiAgentConfigModalProps) {
  const [localConfig, setLocalConfig] = useState<MultiAgentConfig>(config);
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Sync local config with prop changes
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateConfig(localConfig);
    onClose();
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`${localConfig.serverUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        setTestResult({
          success: true,
          message: `接続成功 - Agents: ${data.data?.agents || 0}, Tasks: ${data.data?.tasks || 0}`,
        });
      } else {
        setTestResult({
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
        });
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: e.message || 'Connection failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnect = () => {
    onUpdateConfig(localConfig);
    onConnect();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Multi-Agent Server Configuration</h2>
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
        <div className="p-4 space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <ConnectionStatus state={connectionState} error={error} />
            <div className="flex items-center gap-2">
              {connectionState === 'connected' ? (
                <button
                  onClick={onDisconnect}
                  className="px-3 py-1.5 text-sm bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                >
                  切断
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={!localConfig.serverUrl || !localConfig.serverToken || connectionState === 'connecting'}
                  className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  接続
                </button>
              )}
            </div>
          </div>

          {/* Enable toggle */}
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium">Multi-Agent機能を有効化</span>
            <button
              onClick={() => setLocalConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
              className={`
                relative w-11 h-6 rounded-full transition-colors
                ${localConfig.enabled ? 'bg-primary' : 'bg-muted'}
              `}
            >
              <span
                className={`
                  absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow
                  ${localConfig.enabled ? 'translate-x-5' : ''}
                `}
              />
            </button>
          </label>

          {/* Server URL */}
          <div>
            <label className="block text-sm font-medium mb-1">サーバーURL</label>
            <input
              type="text"
              value={localConfig.serverUrl}
              onChange={(e) => setLocalConfig(prev => ({ ...prev, serverUrl: e.target.value }))}
              placeholder="http://192.168.2.126:3456"
              className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Server Token */}
          <div>
            <label className="block text-sm font-medium mb-1">認証トークン</label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={localConfig.serverToken}
                onChange={(e) => setLocalConfig(prev => ({ ...prev, serverToken: e.target.value }))}
                placeholder="mcp-multi-agent-token-..."
                className="w-full px-3 py-2 pr-10 bg-muted border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
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
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestConnection}
              disabled={isTesting || !localConfig.serverUrl}
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
            <h3 className="text-sm font-medium text-muted-foreground">オプション</h3>

            <label className="flex items-center justify-between">
              <span className="text-sm">自動接続</span>
              <button
                onClick={() => setLocalConfig(prev => ({ ...prev, autoConnect: !prev.autoConnect }))}
                className={`
                  relative w-9 h-5 rounded-full transition-colors
                  ${localConfig.autoConnect ? 'bg-primary' : 'bg-muted'}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow
                    ${localConfig.autoConnect ? 'translate-x-4' : ''}
                  `}
                />
              </button>
            </label>

            <label className="flex items-center justify-between">
              <span className="text-sm">タスク完了時に通知</span>
              <button
                onClick={() => setLocalConfig(prev => ({ ...prev, notifyOnTaskComplete: !prev.notifyOnTaskComplete }))}
                className={`
                  relative w-9 h-5 rounded-full transition-colors
                  ${localConfig.notifyOnTaskComplete ? 'bg-primary' : 'bg-muted'}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow
                    ${localConfig.notifyOnTaskComplete ? 'translate-x-4' : ''}
                  `}
                />
              </button>
            </label>

            <label className="flex items-center justify-between">
              <span className="text-sm">エージェントオフライン時に通知</span>
              <button
                onClick={() => setLocalConfig(prev => ({ ...prev, notifyOnAgentOffline: !prev.notifyOnAgentOffline }))}
                className={`
                  relative w-9 h-5 rounded-full transition-colors
                  ${localConfig.notifyOnAgentOffline ? 'bg-primary' : 'bg-muted'}
                `}
              >
                <span
                  className={`
                    absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow
                    ${localConfig.notifyOnAgentOffline ? 'translate-x-4' : ''}
                  `}
                />
              </button>
            </label>
          </div>

          {/* Help text */}
          <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg space-y-3">
            <div>
              <p className="font-medium mb-1">設定方法:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>タスクサーバーを起動: <code className="bg-muted px-1 rounded">./scripts/agents/multi-agent-launcher.sh start</code></li>
                <li>サーバーURLとトークンを入力</li>
                <li>「接続テスト」で接続を確認</li>
                <li>「接続」ボタンでリアルタイム接続を開始</li>
              </ol>
            </div>
            <div className="pt-2 border-t border-border/50">
              <p className="font-medium mb-1">リモートからの接続:</p>
              <p className="text-muted-foreground/80">
                AWS等のリモート環境から接続するには、Tailscale VPNまたはngrokでサーバーを公開してください。
                Tailscale使用時はTailscale IPを入力します。
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded hover:bg-muted transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
