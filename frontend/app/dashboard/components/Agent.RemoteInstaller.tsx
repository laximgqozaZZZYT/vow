/**
 * Agent.RemoteInstaller - Remote Agent Installer Component
 *
 * Provides UI for installing and connecting remote MCP agents
 *
 * @module Agent.RemoteInstaller
 */

'use client';

import React, { useState, useEffect } from 'react';

interface RemoteAgentInstallerProps {
  locale: 'ja' | 'en';
}

export function RemoteAgentInstaller({ locale }: RemoteAgentInstallerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [installerConfig, setInstallerConfig] = useState<{
    serverUrl?: string;
    downloadUrl?: string;
    quickInstallCommand?: string;
    hasToken?: boolean;
  } | null>(null);
  const [token, setToken] = useState<string>('');
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [isCopied, setIsCopied] = useState<'command' | 'token' | null>(null);

  // Fetch installer config on expand
  useEffect(() => {
    if (isExpanded && !installerConfig) {
      // Try to fetch from API, fall back to default MCP server config
      fetch('/api/mcp-installer/config')
        .then(res => {
          if (!res.ok) {
            throw new Error('API not available');
          }
          return res.json();
        })
        .then(data => setInstallerConfig(data))
        .catch(() => {
          // Use default local MCP server config
          setInstallerConfig({
            serverUrl: 'http://localhost:3456',
            downloadUrl: 'https://raw.githubusercontent.com/example/mcp-installer/main/install.sh',
            quickInstallCommand: 'curl -sSL ... | bash',
            hasToken: true,
          });
        });
    }
  }, [isExpanded, installerConfig]);

  const handleShowToken = async () => {
    setIsLoadingToken(true);
    try {
      const res = await fetch('/api/mcp-installer/token');
      if (!res.ok) {
        throw new Error('API not available');
      }
      const data = await res.json();
      if (data.token) {
        setToken(data.token);
      }
    } catch {
      // Use default token for local MCP server
      setToken('mcp-multi-agent-token-f75a6267');
    } finally {
      setIsLoadingToken(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'command' | 'token') => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(type);
      setTimeout(() => setIsCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="mt-6 pt-4 border-t border-border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left group"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🌐</span>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {locale === 'ja' ? 'リモートエージェント追加' : 'Remote Agent Setup'}
          </h4>
        </div>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-muted-foreground text-xs">
            {locale === 'ja'
              ? '別マシンでClaude Codeを実行し、このプロジェクトのMCPサーバーに接続できます。'
              : 'Run Claude Code on another machine and connect to this project\'s MCP server.'}
          </p>

          {installerConfig ? (
            <>
              {/* Server URL */}
              <div className="p-2 bg-muted/50 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">
                  {locale === 'ja' ? 'タスクサーバーURL' : 'Task Server URL'}
                </div>
                <code className="text-xs font-mono text-foreground">{installerConfig.serverUrl}</code>
              </div>

              {/* Quick Install Command */}
              <div className="p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-muted-foreground">
                    {locale === 'ja' ? 'ワンライナーインストール' : 'Quick Install'}
                  </div>
                  <button
                    onClick={() => copyToClipboard(
                      `curl -sSL ${installerConfig.downloadUrl} -o install.sh && chmod +x install.sh && ./install.sh --server-url ${installerConfig.serverUrl} --token ${token || 'YOUR_TOKEN'}`,
                      'command'
                    )}
                    className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400"
                  >
                    {isCopied === 'command' ? (locale === 'ja' ? 'コピー済み!' : 'Copied!') : (locale === 'ja' ? 'コピー' : 'Copy')}
                  </button>
                </div>
                <code className="text-xs font-mono text-foreground break-all block">
                  curl -sSL {installerConfig.downloadUrl} -o install.sh && ./install.sh --server-url {installerConfig.serverUrl} --token YOUR_TOKEN
                </code>
              </div>

              {/* Token Section */}
              <div className="p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-muted-foreground">
                    {locale === 'ja' ? '認証トークン' : 'Auth Token'}
                  </div>
                  {!token ? (
                    <button
                      onClick={handleShowToken}
                      disabled={isLoadingToken}
                      className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 disabled:opacity-50"
                    >
                      {isLoadingToken
                        ? (locale === 'ja' ? '取得中...' : 'Loading...')
                        : (locale === 'ja' ? 'トークンを表示' : 'Show Token')}
                    </button>
                  ) : (
                    <button
                      onClick={() => copyToClipboard(token, 'token')}
                      className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400"
                    >
                      {isCopied === 'token' ? (locale === 'ja' ? 'コピー済み!' : 'Copied!') : (locale === 'ja' ? 'コピー' : 'Copy')}
                    </button>
                  )}
                </div>
                {token ? (
                  <code className="text-xs font-mono text-foreground break-all block">{token}</code>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {locale === 'ja' ? 'クリックして表示' : 'Click to reveal'}
                  </p>
                )}
              </div>

              {/* Download Button */}
              <a
                href={installerConfig.downloadUrl}
                download="install.sh"
                className="flex items-center justify-center gap-2 w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {locale === 'ja' ? 'インストーラーをダウンロード' : 'Download Installer'}
              </a>
            </>
          ) : (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RemoteAgentInstaller;
