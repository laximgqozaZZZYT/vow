'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCredentials, AI_PROVIDERS, CredentialType } from '@/hooks/useCredentials';

interface AIProviderSettingsProps {
  authToken: string | null;
}

export default function AIProviderSettings({ authToken }: AIProviderSettingsProps) {
  const [activeProvider, setActiveProvider] = useState<CredentialType>('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Credentials for each provider
  const [providerCredentials, setProviderCredentials] = useState<Record<CredentialType, {
    exists: boolean;
    model?: string;
    maskedKey?: string;
  }>>({
    openai: { exists: false },
    anthropic: { exists: false },
    gemini: { exists: false },
    codex: { exists: false },
    custom: { exists: false },
  });

  const {
    checkCredential,
    saveCredential,
    deleteCredential,
    isLoading,
  } = useCredentials(authToken);

  // Load credentials for all providers
  const loadAllCredentials = useCallback(async () => {
    if (!authToken) return;

    const providers: CredentialType[] = ['openai', 'anthropic', 'gemini', 'codex'];
    const results: Record<CredentialType, { exists: boolean; model?: string; maskedKey?: string }> = {
      openai: { exists: false },
      anthropic: { exists: false },
      gemini: { exists: false },
      codex: { exists: false },
      custom: { exists: false },
    };

    for (const provider of providers) {
      try {
        const info = await checkCredential(provider);
        if (info) {
          results[provider] = {
            exists: info.exists,
            model: info.model,
            maskedKey: info.maskedKey,
          };
        }
      } catch {
        // Ignore errors for individual providers
      }
    }

    setProviderCredentials(results);
  }, [authToken, checkCredential]);

  useEffect(() => {
    loadAllCredentials();
  }, [loadAllCredentials]);

  // Update model when provider changes
  useEffect(() => {
    const cred = providerCredentials[activeProvider];
    if (cred?.model) {
      setModel(cred.model);
    } else {
      setModel(AI_PROVIDERS[activeProvider].defaultModel);
    }
    setApiKey('');
    setError(null);
    setSuccess(false);
  }, [activeProvider, providerCredentials]);

  const handleSave = async () => {
    if (!authToken) {
      setError('ログインが必要です');
      return;
    }

    if (!apiKey.trim()) {
      setError('APIキーを入力してください');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await saveCredential(activeProvider, {
        apiKey: apiKey.trim(),
        model: model || AI_PROVIDERS[activeProvider].defaultModel,
      });

      if (result) {
        setSuccess(true);
        setApiKey('');
        await loadAllCredentials();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError('保存に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!authToken) {
      setError('ログインが必要です');
      return;
    }

    const providerName = AI_PROVIDERS[activeProvider].nameJa;
    if (!confirm(`${providerName}のAPIキーを削除してもよろしいですか？`)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await deleteCredential(activeProvider);
      if (result) {
        await loadAllCredentials();
        setApiKey('');
        setModel(AI_PROVIDERS[activeProvider].defaultModel);
      } else {
        setError('削除に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const providerTabs: CredentialType[] = ['openai', 'gemini', 'anthropic', 'codex'];

  return (
    <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h3 className="font-medium">AI APIキー設定</h3>
          <p className="text-sm text-muted-foreground">複数のAIプロバイダーのAPIキーを管理</p>
        </div>
      </div>

      {/* Provider Tabs */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 border-b border-border pb-4">
        {providerTabs.map((provider) => {
          const config = AI_PROVIDERS[provider];
          const cred = providerCredentials[provider];
          const isActive = activeProvider === provider;

          return (
            <button
              key={provider}
              onClick={() => setActiveProvider(provider)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 hover:bg-muted text-foreground'
              }`}
            >
              <span>{config.nameJa}</span>
              {cred?.exists && (
                <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-300' : 'bg-green-500'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Error/Success display */}
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md text-green-700 dark:text-green-300 text-sm">
          設定を保存しました
        </div>
      )}

      {/* Provider Description */}
      <div className="mb-4 p-3 bg-muted/50 rounded-md">
        <p className="text-sm text-muted-foreground">
          {AI_PROVIDERS[activeProvider].descriptionJa}
        </p>
      </div>

      {/* Current Status */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          読み込み中...
        </div>
      ) : providerCredentials[activeProvider]?.exists ? (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm text-green-700 dark:text-green-300">
                APIキーが設定されています
              </span>
            </div>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="text-sm text-destructive hover:underline disabled:opacity-50"
            >
              削除
            </button>
          </div>
          {providerCredentials[activeProvider]?.maskedKey && (
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {providerCredentials[activeProvider].maskedKey}
            </p>
          )}
          {providerCredentials[activeProvider]?.model && (
            <p className="text-xs text-muted-foreground mt-1">
              モデル: {providerCredentials[activeProvider].model}
            </p>
          )}
        </div>
      ) : (
        <div className="mb-4 p-3 bg-muted/50 border border-border rounded-md">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full" />
            <span className="text-sm text-muted-foreground">
              APIキーが設定されていません
            </span>
          </div>
        </div>
      )}

      {/* API Key Input */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            {AI_PROVIDERS[activeProvider].nameJa} APIキー
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={providerCredentials[activeProvider]?.exists ? '新しいキーで上書き' : 'APIキーを入力'}
            className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground mt-1 break-words">
            {activeProvider === 'openai' && 'OpenAI Platformからキーを取得: platform.openai.com'}
            {activeProvider === 'gemini' && 'Google AI Studioからキーを取得: aistudio.google.com'}
            {activeProvider === 'anthropic' && 'Anthropic Consoleからキーを取得: console.anthropic.com'}
            {activeProvider === 'codex' && 'OpenAI Platform (Codex/o1アクセス): platform.openai.com'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">モデル</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {AI_PROVIDERS[activeProvider].models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !apiKey.trim()}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      {/* Info Box */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>ヒント:</strong> 複数のプロバイダーを設定しておくと、Claude Codeの使用制限に達した場合に
          他のAIプロバイダーに切り替えることができます。MOCセクションで使用するプロバイダーを選択できます。
        </p>
      </div>
    </div>
  );
}
