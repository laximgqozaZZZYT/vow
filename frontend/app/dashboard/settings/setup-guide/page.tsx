"use client";

export default function SetupGuidePage() {
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
                OAuth Setup Guide
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
            Database Setup Required
          </h2>
          
          <div className="space-y-6">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                    OAuth Tables Not Found
                  </h3>
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                    The OAuth feature requires database migration to create the necessary tables.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Setup Instructions
              </h3>
              
              <div className="space-y-4">
                <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                  <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                    Option 1: Using Supabase CLI (Recommended)
                  </h4>
                  <div className="space-y-2">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      If you have Supabase CLI installed and configured:
                    </p>
                    <div className="bg-zinc-900 rounded p-3">
                      <code className="text-green-400 text-sm">
                        supabase db push
                      </code>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      This will apply all pending migrations including the OAuth tables.
                    </p>
                  </div>
                </div>

                <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                  <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                    Option 2: Manual SQL Execution
                  </h4>
                  <div className="space-y-2">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Execute the migration file directly in your Supabase dashboard:
                    </p>
                    <ol className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 list-decimal list-inside">
                      <li>Go to your Supabase project dashboard</li>
                      <li>Navigate to SQL Editor</li>
                      <li>Copy and paste the migration file content</li>
                      <li>Execute the SQL</li>
                    </ol>
                    <div className="bg-zinc-50 dark:bg-zinc-800 rounded p-3 border">
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-2">
                        Migration file location:
                      </p>
                      <code className="text-xs text-zinc-800 dark:text-zinc-200">
                        supabase/migrations/20260113000000_create_oauth_tables_secure.sql
                      </code>
                    </div>
                  </div>
                </div>

                <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                  <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                    Option 3: Contact Administrator
                  </h4>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    If you don't have database access, contact your system administrator to run the OAuth migration.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                What Gets Created
              </h3>
              
              <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                  The migration creates the following secure OAuth 2.0 infrastructure:
                </p>
                <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1 list-disc list-inside">
                  <li><strong>oauth_client_applications</strong> - OAuth client app registration</li>
                  <li><strong>oauth_redirect_uris</strong> - Allowed callback URLs</li>
                  <li><strong>oauth_authorization_codes</strong> - Temporary auth codes with PKCE</li>
                  <li><strong>oauth_access_tokens</strong> - Secure access tokens</li>
                  <li><strong>oauth_auth_logs</strong> - Audit logging for security</li>
                  <li><strong>oauth_rate_limits</strong> - Rate limiting protection</li>
                </ul>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="font-medium text-green-800 dark:text-green-200 mb-1">
                    Security Features Included
                  </h3>
                  <ul className="text-green-700 dark:text-green-300 text-sm space-y-1">
                    <li>• Client secret bcrypt hashing with salt</li>
                    <li>• Authorization code reuse prevention</li>
                    <li>• PKCE mandatory for public clients</li>
                    <li>• Rate limiting protection</li>
                    <li>• Row Level Security (RLS) policies</li>
                    <li>• Audit logging with tamper protection</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="text-center pt-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                After running the migration, refresh this page to access OAuth settings.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}