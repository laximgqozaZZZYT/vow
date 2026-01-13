"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '../../dashboard/hooks/useAuth';
import { OAuthClientManager } from '../../../lib/oauth/client-manager';
import { RedirectURIManager } from '../../../lib/oauth/redirect-uri-manager';
import { OAuthAuthorizationCodeManager } from '../../../lib/oauth/authorization-code-manager';

interface AuthorizeParams {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
}

interface ClientApplication {
  id: string;
  name: string;
  description: string | null;
  client_type: 'public' | 'confidential';
}

function AuthorizePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthed, isGuest } = useAuth();
  
  const [params, setParams] = useState<AuthorizeParams | null>(null);
  const [client, setClient] = useState<ClientApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorizing, setAuthorizing] = useState(false);

  // Parse and validate OAuth parameters
  useEffect(() => {
    const parseParams = () => {
      const clientId = searchParams.get('client_id');
      const redirectUri = searchParams.get('redirect_uri');
      const responseType = searchParams.get('response_type');
      const scope = searchParams.get('scope');
      const state = searchParams.get('state');
      const codeChallenge = searchParams.get('code_challenge');
      const codeChallengeMethod = searchParams.get('code_challenge_method');

      if (!clientId) {
        setError('Missing required parameter: client_id');
        return;
      }

      if (!redirectUri) {
        setError('Missing required parameter: redirect_uri');
        return;
      }

      if (!responseType || responseType !== 'code') {
        setError('Invalid or missing response_type. Only "code" is supported.');
        return;
      }

      setParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: responseType,
        scope: scope || undefined,
        state: state || undefined,
        code_challenge: codeChallenge || undefined,
        code_challenge_method: codeChallengeMethod || undefined,
      });
    };

    parseParams();
  }, [searchParams]);

  // Validate client and redirect URI
  useEffect(() => {
    const validateRequest = async () => {
      if (!params) return;

      try {
        setLoading(true);
        setError(null);

        // Get client application
        const application = await OAuthClientManager.getApplicationByClientId(params.client_id);
        if (!application) {
          setError('Invalid client_id');
          return;
        }

        // Validate redirect URI
        const uriValidation = await RedirectURIManager.validateRedirectURI(
          params.client_id,
          params.redirect_uri
        );
        if (!uriValidation.isValid) {
          setError(uriValidation.error || 'Invalid redirect_uri');
          return;
        }

        // Check PKCE requirements for public clients
        if (application.client_type === 'public') {
          if (!params.code_challenge) {
            setError('PKCE is required for public clients. Missing code_challenge parameter.');
            return;
          }
          if (params.code_challenge_method !== 'S256') {
            setError('Only S256 code_challenge_method is supported for PKCE.');
            return;
          }
        }

        setClient({
          id: application.id,
          name: application.name,
          description: application.description,
          client_type: application.client_type,
        });
      } catch (err) {
        console.error('Failed to validate OAuth request:', err);
        setError('Failed to validate authorization request');
      } finally {
        setLoading(false);
      }
    };

    validateRequest();
  }, [params]);

  // Handle authorization approval
  const handleApprove = async () => {
    if (!params || !client || !isAuthed) return;

    try {
      setAuthorizing(true);
      setError(null);

      const { supabase } = await import('../../../lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId) {
        setError('User not authenticated');
        return;
      }

      // Generate authorization code
      const authCode = await OAuthAuthorizationCodeManager.createAuthorizationCode({
        clientId: params.client_id,
        userId: userId,
        redirectUri: params.redirect_uri,
        scope: params.scope || undefined,
        codeChallenge: params.code_challenge || undefined,
        codeChallengeMethod: params.code_challenge_method as 'S256' || undefined,
      });

      // Build redirect URL with authorization code
      const redirectUrl = new URL(params.redirect_uri);
      redirectUrl.searchParams.set('code', authCode.code);
      if (params.state) {
        redirectUrl.searchParams.set('state', params.state);
      }

      // Redirect to client application
      window.location.href = redirectUrl.toString();
    } catch (err) {
      console.error('Failed to authorize application:', err);
      setError('Failed to authorize application');
    } finally {
      setAuthorizing(false);
    }
  };

  // Handle authorization denial
  const handleDeny = () => {
    if (!params) return;

    try {
      const redirectUrl = new URL(params.redirect_uri);
      redirectUrl.searchParams.set('error', 'access_denied');
      redirectUrl.searchParams.set('error_description', 'The user denied the request');
      if (params.state) {
        redirectUrl.searchParams.set('state', params.state);
      }

      window.location.href = redirectUrl.toString();
    } catch (err) {
      console.error('Failed to redirect with denial:', err);
      setError('Failed to process denial');
    }
  };

  // Redirect to login if not authenticated
  if (!isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 text-center">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Authentication Required
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              You need to log in to authorize this application.
            </p>
            <a
              href={`/login?redirect=${encodeURIComponent(window.location.href)}`}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Log In
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Show error for guest users
  if (isGuest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 text-center">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Guest Mode
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              OAuth authorization is not available in guest mode. Please create an account or log in.
            </p>
            <a
              href="/login"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Log In
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-zinc-600 dark:text-zinc-400">
          Validating authorization request...
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 text-center">
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
              Authorization Error
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              {error}
            </p>
            <button
              onClick={() => window.history.back()}
              className="bg-zinc-600 hover:bg-zinc-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show authorization consent form
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              Authorize Application
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              An external application is requesting access to your account
            </p>
          </div>

          {/* Application Info */}
          <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
              {client?.name}
            </h3>
            {client?.description && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                {client.description}
              </p>
            )}
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400">Type:</span>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  client?.client_type === 'public' 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}>
                  {client?.client_type}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400">Redirect to:</span>
                <code className="text-xs bg-zinc-100 dark:bg-zinc-700 px-2 py-1 rounded">
                  {params?.redirect_uri}
                </code>
              </div>
              
              {params?.scope && (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 dark:text-zinc-400">Scope:</span>
                  <code className="text-xs bg-zinc-100 dark:bg-zinc-700 px-2 py-1 rounded">
                    {params.scope}
                  </code>
                </div>
              )}
            </div>
          </div>

          {/* Permissions */}
          <div className="mb-6">
            <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-3">
              This application will be able to:
            </h4>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Access your goals and habits data
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Read your activity and progress information
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Display your data on external websites
              </li>
            </ul>
          </div>

          {/* Security Notice */}
          {client?.client_type === 'public' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-6">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Enhanced Security</p>
                  <p>This application uses PKCE (Proof Key for Code Exchange) for additional security.</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleDeny}
              disabled={authorizing}
              className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              Deny
            </button>
            <button
              onClick={handleApprove}
              disabled={authorizing}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {authorizing ? 'Authorizing...' : 'Authorize'}
            </button>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
              You can revoke this authorization at any time from your{' '}
              <a href="/dashboard/settings" className="text-blue-600 dark:text-blue-400 hover:underline">
                account settings
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthorizePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    }>
      <AuthorizePageContent />
    </Suspense>
  );
}