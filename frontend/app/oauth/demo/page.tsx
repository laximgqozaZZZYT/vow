"use client";

import { useState, useEffect } from 'react';

export default function OAuthDemoPage() {
  const [step, setStep] = useState(1);
  const [clientId, setClientId] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get base URL
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Set default redirect URI
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRedirectUri(`${window.location.origin}/oauth/demo`);
    }
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (error) {
      setError(`Authorization failed: ${error}`);
      setStep(1);
    } else if (code && step === 2) {
      handleTokenExchange(code);
    }
  }, [step]);

  // Generate PKCE code verifier and challenge
  const generateCodeVerifier = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const generateCodeChallenge = async (verifier: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  // Start OAuth flow
  const startOAuthFlow = async () => {
    if (!clientId || !redirectUri) {
      setError('Please enter Client ID and Redirect URI');
      return;
    }

    try {
      setError('');
      setLoading(true);

      // Generate PKCE parameters
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      
      // Store code verifier for later use
      sessionStorage.setItem('code_verifier', codeVerifier);
      sessionStorage.setItem('client_id', clientId);
      sessionStorage.setItem('redirect_uri', redirectUri);
      
      // Build authorization URL
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'read',
        state: 'demo_state_' + Date.now(),
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
      });
      
      setStep(2);
      window.location.href = `${baseUrl}/api/oauth/authorize?${params}`;
    } catch (err) {
      setError('Failed to start OAuth flow: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Handle token exchange
  const handleTokenExchange = async (code: string) => {
    try {
      setLoading(true);
      setError('');

      const codeVerifier = sessionStorage.getItem('code_verifier');
      const storedClientId = sessionStorage.getItem('client_id');
      const storedRedirectUri = sessionStorage.getItem('redirect_uri');

      if (!codeVerifier || !storedClientId || !storedRedirectUri) {
        throw new Error('Missing stored OAuth parameters');
      }

      // Exchange code for token
      const response = await fetch(`${baseUrl}/api/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: storedRedirectUri,
          client_id: storedClientId,
          code_verifier: codeVerifier
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Token exchange failed');
      }

      setAccessToken(data.access_token);
      setStep(3);

      // Clean up session storage
      sessionStorage.removeItem('code_verifier');
      sessionStorage.removeItem('client_id');
      sessionStorage.removeItem('redirect_uri');

      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      setError('Token exchange failed: ' + (err as Error).message);
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  // Test API call
  const testApiCall = async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${baseUrl}/api/goals`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setUserData(data);
      setStep(4);
    } catch (err) {
      setError('API call failed: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Reset demo
  const resetDemo = () => {
    setStep(1);
    setClientId('');
    setRedirectUri(`${window.location.origin}/oauth/demo`);
    setAccessToken('');
    setUserData(null);
    setError('');
    sessionStorage.clear();
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <a
                href="/dashboard"
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                ← Back to Dashboard
              </a>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                OAuth Integration Demo
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3, 4].map((stepNum) => (
            <div key={stepNum} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= stepNum
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
              }`}>
                {stepNum}
              </div>
              {stepNum < 4 && (
                <div className={`w-16 h-1 mx-2 ${
                  step > stepNum
                    ? 'bg-blue-600'
                    : 'bg-zinc-200 dark:bg-zinc-700'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Labels */}
        <div className="flex justify-center mb-8">
          <div className="grid grid-cols-4 gap-8 text-center text-sm">
            <div className={step >= 1 ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'}>
              Setup
            </div>
            <div className={step >= 2 ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'}>
              Authorize
            </div>
            <div className={step >= 3 ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'}>
              Token
            </div>
            <div className={step >= 4 ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'}>
              API Call
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="text-red-800 dark:text-red-200 text-sm">{error}</div>
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Step 1: Setup OAuth Parameters
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                Enter your OAuth application credentials. You can create an application in{' '}
                <a href="/dashboard/settings" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Settings → OAuth Applications
                </a>.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="client_xxxxxxxxxxxxxxxx"
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Redirect URI
                  </label>
                  <input
                    type="url"
                    value={redirectUri}
                    onChange={(e) => setRedirectUri(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    This URI must be registered in your OAuth application settings.
                  </p>
                </div>
                
                <button
                  onClick={startOAuthFlow}
                  disabled={loading || !clientId || !redirectUri}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Starting...' : 'Start OAuth Flow'}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="text-center">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Step 2: User Authorization
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                Redirecting to authorization page...
              </p>
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Step 3: Access Token Received
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                Successfully exchanged authorization code for access token!
              </p>
              
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                  Access Token (truncated)
                </h3>
                <code className="text-sm text-zinc-600 dark:text-zinc-400 break-all">
                  {accessToken.substring(0, 20)}...{accessToken.substring(accessToken.length - 10)}
                </code>
              </div>
              
              <button
                onClick={testApiCall}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {loading ? 'Testing...' : 'Test API Call'}
              </button>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Step 4: API Call Successful
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                Successfully retrieved user data using the access token!
              </p>
              
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                  API Response (Goals)
                </h3>
                <pre className="text-sm text-zinc-600 dark:text-zinc-400 overflow-x-auto">
                  {JSON.stringify(userData, null, 2)}
                </pre>
              </div>
              
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-green-800 dark:text-green-200 font-medium">
                    OAuth Integration Complete!
                  </span>
                </div>
                <p className="text-green-700 dark:text-green-300 text-sm mt-2">
                  Your application can now access user data securely using OAuth 2.0.
                </p>
              </div>
            </div>
          )}

          {/* Reset Button */}
          {step > 1 && (
            <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <button
                onClick={resetDemo}
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 text-sm"
              >
                ← Start Over
              </button>
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            Need Help?
          </h3>
          <div className="space-y-2 text-blue-800 dark:text-blue-200">
            <p>
              • Check the{' '}
              <a href="/dashboard/settings/integration-guide" className="underline hover:no-underline">
                Integration Guide
              </a>{' '}
              for detailed documentation
            </p>
            <p>
              • Make sure your redirect URI is registered in your{' '}
              <a href="/dashboard/settings" className="underline hover:no-underline">
                OAuth application settings
              </a>
            </p>
            <p>
              • For public clients, PKCE (Proof Key for Code Exchange) is automatically used for security
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}