"use client";

import { useState } from 'react';

export default function IntegrationGuidePage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <a
                href="/dashboard/settings"
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                ← Back to Settings
              </a>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                OAuth Integration Guide
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Demo Link */}
        <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                Try the Interactive Demo
              </h3>
              <p className="text-green-800 dark:text-green-200 text-sm mt-1">
                Test the complete OAuth flow with your own application credentials
              </p>
            </div>
            <a
              href="/oauth/demo"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Launch Demo
            </a>
          </div>
        </div>
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 border-b border-zinc-200 dark:border-zinc-700">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'setup', label: 'Setup' },
            { id: 'examples', label: 'Code Examples' },
            { id: 'security', label: 'Security' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="prose prose-zinc dark:prose-invert max-w-none">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'setup' && <SetupTab />}
          {activeTab === 'examples' && <ExamplesTab />}
          {activeTab === 'security' && <SecurityTab />}
        </div>
      </div>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          OAuth 2.0 Integration Overview
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Integrate your external websites and applications with our service using OAuth 2.0 authorization code flow.
          This allows you to securely access user data and display personalized content on external sites.
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
          What You Can Do
        </h3>
        <ul className="space-y-2 text-blue-800 dark:text-blue-200">
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-1">•</span>
            Display user's goals and habits on your personal blog or website
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-1">•</span>
            Create custom dashboards and analytics for your users
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-1">•</span>
            Build mobile apps that sync with our service
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-1">•</span>
            Integrate with other productivity tools and services
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          OAuth 2.0 Flow
        </h3>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
          <ol className="space-y-4">
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
                1
              </span>
              <div>
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100">User Authorization</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Redirect users to our authorization page where they can grant permission to your application.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
                2
              </span>
              <div>
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100">Authorization Code</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  After approval, users are redirected back to your site with an authorization code.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
                3
              </span>
              <div>
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100">Token Exchange</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Exchange the authorization code for an access token using your client credentials.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
                4
              </span>
              <div>
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100">API Access</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Use the access token to make authenticated API requests and retrieve user data.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function SetupTab() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          Setup Instructions
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Follow these steps to set up OAuth integration with your external application.
        </p>
      </div>

      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Step 1: Create an OAuth Application
          </h3>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <ol className="space-y-3 text-sm">
              <li>1. Go to <a href="/dashboard/settings" className="text-blue-600 dark:text-blue-400 hover:underline">Settings → OAuth Applications</a></li>
              <li>2. Click "Create Application"</li>
              <li>3. Fill in your application details:
                <ul className="ml-4 mt-2 space-y-1 text-zinc-600 dark:text-zinc-400">
                  <li>• <strong>Name:</strong> A descriptive name for your application</li>
                  <li>• <strong>Description:</strong> What your application does</li>
                  <li>• <strong>Client Type:</strong> Choose based on your application type</li>
                </ul>
              </li>
              <li>4. Save your Client ID and Client Secret (if applicable)</li>
            </ol>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Step 2: Configure Redirect URIs
          </h3>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              Add the URLs where users should be redirected after authorization:
            </p>
            <div className="space-y-2">
              <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded border">
                <code className="text-sm">https://your-website.com/oauth/callback</code>
              </div>
              <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded border">
                <code className="text-sm">https://your-app.com/auth/callback</code>
              </div>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3">
              ⚠️ Redirect URIs must be exact matches. HTTPS is required in production.
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Step 3: OAuth Endpoints
          </h3>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">Authorization Endpoint</h4>
                <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded border">
                  <code className="text-sm">{baseUrl}/api/oauth/authorize</code>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">Token Endpoint</h4>
                <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded border">
                  <code className="text-sm">{baseUrl}/api/oauth/token</code>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">API Base URL</h4>
                <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded border">
                  <code className="text-sm">{baseUrl}/api</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExamplesTab() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          Code Examples
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Implementation examples for different programming languages and frameworks.
        </p>
      </div>

      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            JavaScript (Client-side with PKCE)
          </h3>
          <div className="bg-zinc-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-zinc-100">
{`// Generate PKCE code verifier and challenge
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, array))
    .replace(/\\+/g, '-')
    .replace(/\\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
    .replace(/\\+/g, '-')
    .replace(/\\//g, '_')
    .replace(/=/g, '');
}

// Step 1: Redirect to authorization
async function startOAuthFlow() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  
  // Store code verifier for later use
  sessionStorage.setItem('code_verifier', codeVerifier);
  
  const params = new URLSearchParams({
    client_id: 'your_client_id',
    redirect_uri: 'https://your-site.com/oauth/callback',
    response_type: 'code',
    scope: 'read',
    state: 'random_state_string',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });
  
  window.location.href = '${baseUrl}/api/oauth/authorize?' + params;
}

// Step 2: Handle callback and exchange code for token
async function handleCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  
  if (!code) {
    console.error('Authorization failed');
    return;
  }
  
  const codeVerifier = sessionStorage.getItem('code_verifier');
  
  const response = await fetch('${baseUrl}/api/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: 'https://your-site.com/oauth/callback',
      client_id: 'your_client_id',
      code_verifier: codeVerifier
    })
  });
  
  const tokens = await response.json();
  
  if (tokens.access_token) {
    // Store access token securely
    sessionStorage.setItem('access_token', tokens.access_token);
    console.log('Authorization successful!');
  }
}`}
            </pre>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Node.js (Server-side)
          </h3>
          <div className="bg-zinc-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-zinc-100">
{`const express = require('express');
const axios = require('axios');
const app = express();

const CLIENT_ID = 'your_client_id';
const CLIENT_SECRET = 'your_client_secret';
const REDIRECT_URI = 'https://your-server.com/oauth/callback';

// Step 1: Redirect to authorization
app.get('/auth', (req, res) => {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'read',
    state: 'random_state_string'
  });
  
  res.redirect('${baseUrl}/api/oauth/authorize?' + params);
});

// Step 2: Handle callback
app.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).send('Authorization failed');
  }
  
  try {
    // Exchange code for token
    const tokenResponse = await axios.post('${baseUrl}/api/oauth/token', {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    });
    
    const { access_token, refresh_token } = tokenResponse.data;
    
    // Store tokens securely (use database in production)
    req.session.access_token = access_token;
    req.session.refresh_token = refresh_token;
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Token exchange failed:', error.response?.data);
    res.status(500).send('Token exchange failed');
  }
});

// Step 3: Make API requests
app.get('/api/user-data', async (req, res) => {
  const accessToken = req.session.access_token;
  
  if (!accessToken) {
    return res.status(401).send('Not authenticated');
  }
  
  try {
    const response = await axios.get('${baseUrl}/api/goals', {
      headers: {
        'Authorization': \`Bearer \${accessToken}\`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    if (error.response?.status === 401) {
      // Token expired, try to refresh
      // Implementation depends on your refresh token logic
    }
    res.status(error.response?.status || 500).send('API request failed');
  }
});`}
            </pre>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Python (Flask)
          </h3>
          <div className="bg-zinc-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm text-zinc-100">
{`import requests
from flask import Flask, request, redirect, session, jsonify
from urllib.parse import urlencode

app = Flask(__name__)
app.secret_key = 'your-secret-key'

CLIENT_ID = 'your_client_id'
CLIENT_SECRET = 'your_client_secret'
REDIRECT_URI = 'https://your-server.com/oauth/callback'
BASE_URL = '${baseUrl}'

@app.route('/auth')
def auth():
    params = {
        'client_id': CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'response_type': 'code',
        'scope': 'read',
        'state': 'random_state_string'
    }
    
    auth_url = f"{BASE_URL}/api/oauth/authorize?{urlencode(params)}"
    return redirect(auth_url)

@app.route('/oauth/callback')
def callback():
    code = request.args.get('code')
    state = request.args.get('state')
    
    if not code:
        return 'Authorization failed', 400
    
    # Exchange code for token
    token_data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': REDIRECT_URI,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET
    }
    
    response = requests.post(f"{BASE_URL}/api/oauth/token", json=token_data)
    
    if response.status_code == 200:
        tokens = response.json()
        session['access_token'] = tokens['access_token']
        session['refresh_token'] = tokens.get('refresh_token')
        return redirect('/dashboard')
    else:
        return 'Token exchange failed', 500

@app.route('/api/user-data')
def user_data():
    access_token = session.get('access_token')
    
    if not access_token:
        return 'Not authenticated', 401
    
    headers = {'Authorization': f'Bearer {access_token}'}
    response = requests.get(f"{BASE_URL}/api/goals", headers=headers)
    
    if response.status_code == 200:
        return jsonify(response.json())
    else:
        return 'API request failed', response.status_code`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          Security Best Practices
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">
          Follow these security guidelines to ensure your OAuth integration is secure.
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-3">
            Critical Security Requirements
          </h3>
          <ul className="space-y-2 text-red-800 dark:text-red-200">
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">⚠️</span>
              <strong>Never expose client secrets in client-side code</strong> - Use public clients with PKCE for browser-based apps
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">⚠️</span>
              <strong>Always use HTTPS in production</strong> - HTTP is only allowed for localhost during development
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">⚠️</span>
              <strong>Validate the state parameter</strong> - Prevents CSRF attacks during the OAuth flow
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-1">⚠️</span>
              <strong>Store tokens securely</strong> - Use secure, httpOnly cookies or encrypted storage
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Client Types and Security
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
              <h4 className="font-medium text-green-600 dark:text-green-400 mb-2">
                Public Clients
              </h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                For client-side applications (JavaScript, mobile apps)
              </p>
              <ul className="text-sm space-y-1">
                <li>• No client secret required</li>
                <li>• PKCE is mandatory</li>
                <li>• Suitable for SPAs and mobile apps</li>
                <li>• Enhanced security with code challenges</li>
              </ul>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
              <h4 className="font-medium text-blue-600 dark:text-blue-400 mb-2">
                Confidential Clients
              </h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                For server-side applications
              </p>
              <ul className="text-sm space-y-1">
                <li>• Client secret required</li>
                <li>• PKCE is optional but recommended</li>
                <li>• Suitable for server-side apps</li>
                <li>• Traditional OAuth 2.0 flow</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Token Security
          </h3>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">Access Tokens</h4>
                <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                  <li>• Short-lived (15 minutes)</li>
                  <li>• Include in Authorization header: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">Bearer {'{token}'}</code></li>
                  <li>• Never log or expose in URLs</li>
                  <li>• Automatically refresh when expired</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">Refresh Tokens</h4>
                <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                  <li>• Long-lived (30 days)</li>
                  <li>• Store securely on server-side</li>
                  <li>• Use to obtain new access tokens</li>
                  <li>• Rotate on each refresh</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Rate Limits
          </h3>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Authorization requests</span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">10 per minute</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Token requests</span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">5 per minute</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">API requests</span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">1000 per hour</span>
              </div>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-4">
              Rate limits are per IP address and client application. Implement exponential backoff for failed requests.
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
            Error Handling
          </h3>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
            <div className="space-y-3 text-sm">
              <div>
                <code className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded">401 Unauthorized</code>
                <span className="ml-2 text-zinc-600 dark:text-zinc-400">- Invalid or expired access token</span>
              </div>
              <div>
                <code className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded">403 Forbidden</code>
                <span className="ml-2 text-zinc-600 dark:text-zinc-400">- Valid token but insufficient permissions</span>
              </div>
              <div>
                <code className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded">429 Too Many Requests</code>
                <span className="ml-2 text-zinc-600 dark:text-zinc-400">- Rate limit exceeded</span>
              </div>
              <div>
                <code className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded">400 Bad Request</code>
                <span className="ml-2 text-zinc-600 dark:text-zinc-400">- Invalid request parameters</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}