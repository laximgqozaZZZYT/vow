"use client";

import { useState, useEffect } from 'react';
import { Base64urlManager } from '../../lib/oauth/base64url-manager';

interface OAuthTestState {
  step: 'init' | 'authorizing' | 'exchanging' | 'testing' | 'complete' | 'error';
  clientId?: string;
  redirectUri: string;
  codeVerifier?: string;
  codeChallenge?: string;
  authorizationCode?: string;
  accessToken?: string;
  error?: string;
  testResult?: any;
}

export default function OAuthTestPage() {
  const [state, setState] = useState<OAuthTestState>({
    step: 'init',
    redirectUri: 'http://localhost:3000/oauth-test',
  });

  // URLからauthorization codeを取得
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (error) {
      setState(prev => ({
        ...prev,
        step: 'error',
        error: `OAuth Error: ${error} - ${urlParams.get('error_description') || 'Unknown error'}`,
      }));
    } else if (code && state.step === 'authorizing') {
      setState(prev => ({
        ...prev,
        step: 'exchanging',
        authorizationCode: code,
      }));
    }
  }, [state.step]);

  // Authorization codeをaccess tokenに交換
  useEffect(() => {
    if (state.step === 'exchanging' && state.authorizationCode && state.codeVerifier && state.clientId) {
      exchangeCodeForToken();
    }
  }, [state.step, state.authorizationCode]);

  const startOAuthFlow = async () => {
    try {
      setState(prev => ({ ...prev, step: 'authorizing' }));

      // テスト用のクライアントアプリケーションを作成（実際の実装では事前に作成済み）
      const clientId = 'test-client-' + Date.now(); // 実際にはダッシュボードで作成されたclient_idを使用
      
      // PKCE パラメータ生成
      const codeVerifier = Base64urlManager.generateCodeVerifier();
      const codeChallenge = Base64urlManager.generateCodeChallenge(codeVerifier);
      
      setState(prev => ({
        ...prev,
        clientId,
        codeVerifier,
        codeChallenge,
      }));

      // OAuth認可URLを構築
      const authParams = new URLSearchParams({
        client_id: clientId,
        redirect_uri: state.redirectUri,
        response_type: 'code',
        scope: 'read',
        state: Base64urlManager.generateState(),
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      const authUrl = `/api/oauth/authorize?${authParams}`;
      
      // 認可ページにリダイレクト
      window.location.href = authUrl;
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        step: 'error',
        error: `Failed to start OAuth flow: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
    }
  };

  const exchangeCodeForToken = async () => {
    try {
      const response = await fetch('/api/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: state.authorizationCode,
          redirect_uri: state.redirectUri,
          client_id: state.clientId,
          code_verifier: state.codeVerifier,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Token exchange failed');
      }

      setState(prev => ({
        ...prev,
        step: 'testing',
        accessToken: data.access_token,
      }));

      // アクセストークンでAPIをテスト
      await testApiWithToken(data.access_token);

    } catch (error) {
      setState(prev => ({
        ...prev,
        step: 'error',
        error: `Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
    }
  };

  const testApiWithToken = async (accessToken: string) => {
    try {
      const response = await fetch('/api/test-oauth', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_description || data.error || 'API test failed');
      }

      setState(prev => ({
        ...prev,
        step: 'complete',
        testResult: data,
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        step: 'error',
        error: `API test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
    }
  };

  const resetTest = () => {
    // URLからクエリパラメータを削除
    window.history.replaceState({}, document.title, window.location.pathname);
    
    setState({
      step: 'init',
      redirectUri: 'http://localhost:3000/oauth-test',
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
            OAuth 2.0 Test Page
          </h1>
          
          <div className="mb-6">
            <div className="flex items-center space-x-4 mb-4">
              {['init', 'authorizing', 'exchanging', 'testing', 'complete'].map((step, index) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    state.step === step 
                      ? 'bg-blue-600 text-white' 
                      : index < ['init', 'authorizing', 'exchanging', 'testing', 'complete'].indexOf(state.step)
                        ? 'bg-green-600 text-white'
                        : 'bg-zinc-300 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-400'
                  }`}>
                    {index + 1}
                  </div>
                  {index < 4 && (
                    <div className={`w-12 h-0.5 ${
                      index < ['init', 'authorizing', 'exchanging', 'testing', 'complete'].indexOf(state.step)
                        ? 'bg-green-600'
                        : 'bg-zinc-300 dark:bg-zinc-600'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Step {['init', 'authorizing', 'exchanging', 'testing', 'complete', 'error'].indexOf(state.step) + 1}: {
                {
                  init: 'Ready to start OAuth flow',
                  authorizing: 'Redirecting to authorization page...',
                  exchanging: 'Exchanging authorization code for access token...',
                  testing: 'Testing API with access token...',
                  complete: 'OAuth flow completed successfully!',
                  error: 'Error occurred',
                }[state.step]
              }
            </div>
          </div>

          {state.step === 'init' && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  OAuth 2.0 Authorization Code Flow Test
                </h3>
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                  This page will test the complete OAuth 2.0 authorization code flow with PKCE:
                </p>
                <ul className="list-disc list-inside text-blue-800 dark:text-blue-200 text-sm mt-2 space-y-1">
                  <li>Generate PKCE parameters (code_verifier, code_challenge)</li>
                  <li>Redirect to authorization endpoint</li>
                  <li>Exchange authorization code for access token</li>
                  <li>Test API access with the token</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Redirect URI:
                </label>
                <input
                  type="text"
                  value={state.redirectUri}
                  onChange={(e) => setState(prev => ({ ...prev, redirectUri: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              
              <button
                onClick={startOAuthFlow}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Start OAuth Flow
              </button>
            </div>
          )}

          {state.step === 'complete' && state.testResult && (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h3 className="font-medium text-green-900 dark:text-green-100 mb-2">
                  ✅ OAuth Flow Completed Successfully!
                </h3>
                <p className="text-green-800 dark:text-green-200 text-sm">
                  The OAuth 2.0 authorization code flow with PKCE has been completed successfully.
                </p>
              </div>
              
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">API Test Result:</h4>
                <pre className="text-sm text-zinc-600 dark:text-zinc-400 overflow-x-auto">
                  {JSON.stringify(state.testResult, null, 2)}
                </pre>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100">Flow Details:</h4>
                <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                  <div><strong>Client ID:</strong> {state.clientId}</div>
                  <div><strong>Access Token:</strong> {state.accessToken?.substring(0, 20)}...</div>
                  <div><strong>Redirect URI:</strong> {state.redirectUri}</div>
                </div>
              </div>
              
              <button
                onClick={resetTest}
                className="bg-zinc-600 hover:bg-zinc-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Run Test Again
              </button>
            </div>
          )}

          {state.step === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h3 className="font-medium text-red-900 dark:text-red-100 mb-2">
                  ❌ Error Occurred
                </h3>
                <p className="text-red-800 dark:text-red-200 text-sm">
                  {state.error}
                </p>
              </div>
              
              <button
                onClick={resetTest}
                className="bg-zinc-600 hover:bg-zinc-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {['authorizing', 'exchanging', 'testing'].includes(state.step) && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-zinc-600 dark:text-zinc-400">
                {state.step === 'authorizing' && 'Preparing authorization...'}
                {state.step === 'exchanging' && 'Exchanging code for token...'}
                {state.step === 'testing' && 'Testing API access...'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}