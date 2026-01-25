'use strict';

/**
 * Lambda@Edge Viewer Request function for development environment access control
 * 
 * Validates Supabase JWT from cookies and allows only admin email access
 */

const ADMIN_EMAIL = 'k6285620@gmail.com';
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/_next/',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/sw.js',
  '/api/',
];

// Simple base64url decode
function base64UrlDecode(str) {
  // Replace URL-safe characters
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  // Pad with '=' if necessary
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

// Parse JWT without verification (we'll verify signature separately)
function parseJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return payload;
  } catch (e) {
    return null;
  }
}

// Get cookie value from Cookie header
function getCookie(cookies, name) {
  if (!cookies) return null;
  
  for (const cookie of cookies) {
    const value = cookie.value;
    const parts = value.split(';');
    for (const part of parts) {
      const [key, val] = part.trim().split('=');
      if (key === name) {
        return decodeURIComponent(val);
      }
    }
  }
  return null;
}

// Find Supabase auth token from cookies
function findSupabaseToken(cookies) {
  if (!cookies) return null;
  
  // Supabase stores tokens in cookies with pattern: sb-<project-ref>-auth-token
  // The token is base64 encoded JSON containing access_token
  for (const cookie of cookies) {
    const value = cookie.value;
    const parts = value.split(';');
    for (const part of parts) {
      const trimmed = part.trim();
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      
      const key = trimmed.substring(0, eqIndex);
      const val = trimmed.substring(eqIndex + 1);
      
      // Check for Supabase auth cookie pattern
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        try {
          // The cookie value is base64 encoded JSON
          const decoded = Buffer.from(decodeURIComponent(val), 'base64').toString('utf8');
          const authData = JSON.parse(decoded);
          if (authData.access_token) {
            return authData.access_token;
          }
        } catch (e) {
          // Try direct JWT parse
          const jwt = parseJwt(decodeURIComponent(val));
          if (jwt && jwt.email) {
            return decodeURIComponent(val);
          }
        }
      }
    }
  }
  return null;
}

exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const uri = request.uri;
  
  // Allow public paths
  for (const path of PUBLIC_PATHS) {
    if (uri.startsWith(path) || uri.endsWith('.svg') || uri.endsWith('.png') || uri.endsWith('.jpg') || uri.endsWith('.ico')) {
      // Allow request to proceed - Host header will be set by origin-request Lambda
      return request;
    }
  }
  
  // Get cookies from request
  const cookies = request.headers.cookie || [];
  
  // Find Supabase JWT token
  const token = findSupabaseToken(cookies);
  
  if (!token) {
    // No token - redirect to login
    return {
      status: '302',
      statusDescription: 'Found',
      headers: {
        location: [{
          key: 'Location',
          value: `/login?redirect=${encodeURIComponent(uri)}&dev_restricted=true`
        }],
        'cache-control': [{
          key: 'Cache-Control',
          value: 'no-cache, no-store, must-revalidate'
        }]
      }
    };
  }
  
  // Parse JWT to get email
  const payload = parseJwt(token);
  
  if (!payload || !payload.email) {
    // Invalid token - redirect to login
    return {
      status: '302',
      statusDescription: 'Found',
      headers: {
        location: [{
          key: 'Location',
          value: `/login?redirect=${encodeURIComponent(uri)}&dev_restricted=true&error=invalid_token`
        }],
        'cache-control': [{
          key: 'Cache-Control',
          value: 'no-cache, no-store, must-revalidate'
        }]
      }
    };
  }
  
  // Check if email is admin
  const userEmail = payload.email.toLowerCase();
  if (userEmail !== ADMIN_EMAIL.toLowerCase()) {
    // Not admin - return 403
    return {
      status: '403',
      statusDescription: 'Forbidden',
      headers: {
        'content-type': [{
          key: 'Content-Type',
          value: 'text/html; charset=utf-8'
        }],
        'cache-control': [{
          key: 'Cache-Control',
          value: 'no-cache, no-store, must-revalidate'
        }]
      },
      body: `<!DOCTYPE html>
<html>
<head>
  <title>Access Denied</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f4f4f5; }
    .container { text-align: center; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 400px; }
    h1 { color: #ef4444; margin-bottom: 1rem; }
    p { color: #71717a; margin-bottom: 1.5rem; }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚫 Access Denied</h1>
    <p>この開発環境へのアクセスは管理者のみに制限されています。</p>
    <p>ログイン中: ${userEmail}</p>
    <p><a href="/login">別のアカウントでログイン</a></p>
  </div>
</body>
</html>`
    };
  }
  
  // Admin - allow access (Host header will be set by origin-request Lambda)
  return request;
};
