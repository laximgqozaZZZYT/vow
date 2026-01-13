"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { OAuthClientManager, type OAuthClientApplication } from '../../../lib/oauth/client-manager';
import { RedirectURIManager, type OAuthRedirectURI } from '../../../lib/oauth/redirect-uri-manager';

interface TabProps {
  id: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function Tab({ id, label, isActive, onClick }: TabProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
      }`}
    >
      {label}
    </button>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('oauth');
  const [applications, setApplications] = useState<OAuthClientApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { isAuthed, isGuest } = useAuth();

  // Load OAuth applications
  useEffect(() => {
    const loadApplications = async () => {
      if (!isAuthed || isGuest) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { supabase } = await import('../../../lib/supabaseClient');
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        if (userId) {
          const apps = await OAuthClientManager.getApplications(userId);
          setApplications(apps);
        }
      } catch (err) {
        console.error('Failed to load applications:', err);
        if (err instanceof Error && err.message.includes('Failed to fetch client applications')) {
          setError('OAuth feature is not available. Database migration may be required.');
        } else {
          setError('Failed to load OAuth applications');
        }
      } finally {
        setLoading(false);
      }
    };

    loadApplications();
  }, [isAuthed, isGuest]);

  if (!isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            Authentication Required
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Please log in to access settings.
          </p>
        </div>
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            Guest Mode
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            OAuth settings are not available in guest mode.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <a
                href="/dashboard"
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                ← Back to Dashboard
              </a>
              <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Settings
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8">
          <Tab
            id="oauth"
            label="OAuth Applications"
            isActive={activeTab === 'oauth'}
            onClick={() => setActiveTab('oauth')}
          />
          <Tab
            id="general"
            label="General"
            isActive={activeTab === 'general'}
            onClick={() => setActiveTab('general')}
          />
        </div>

        {/* Tab Content */}
        {activeTab === 'oauth' && (
          <OAuthSettingsTab
            applications={applications}
            setApplications={setApplications}
            loading={loading}
            error={error}
            setError={setError}
          />
        )}

        {activeTab === 'general' && (
          <GeneralSettingsTab />
        )}
      </div>
    </div>
  );
}

interface OAuthSettingsTabProps {
  applications: OAuthClientApplication[];
  setApplications: (apps: OAuthClientApplication[]) => void;
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
}

function OAuthSettingsTab({ 
  applications, 
  setApplications, 
  loading, 
  error, 
  setError 
}: OAuthSettingsTabProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedApp, setSelectedApp] = useState<OAuthClientApplication | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-zinc-600 dark:text-zinc-400">Loading OAuth applications...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
            OAuth Applications
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Manage external applications that can access your data
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/dashboard/settings/integration-guide"
            className="bg-zinc-600 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Integration Guide
          </a>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Create Application
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="text-red-800 dark:text-red-200 text-sm mb-2">{error}</div>
          {error.includes('Database migration') && (
            <div className="text-red-700 dark:text-red-300 text-xs">
              <p className="mb-2">The OAuth feature requires database migration. Please contact your administrator or:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Run the OAuth migration: <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">supabase db push</code></li>
                <li>Or apply the migration file: <code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">20260113000000_create_oauth_tables_secure.sql</code></li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Applications List */}
      {applications.length === 0 && !error ? (
        <div className="text-center py-12">
          <div className="text-zinc-500 dark:text-zinc-400 mb-4">
            No OAuth applications yet
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
            Create your first OAuth application to enable external integrations with your data.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            Create your first application
          </button>
        </div>
      ) : applications.length > 0 ? (
        <div className="grid gap-4">
          {applications.map((app) => (
            <ApplicationCard
              key={app.id}
              application={app}
              onEdit={() => setSelectedApp(app)}
              onDelete={async (appId) => {
                try {
                  const { supabase } = await import('../../../lib/supabaseClient');
                  const { data: { session } } = await supabase.auth.getSession();
                  const userId = session?.user?.id;

                  if (userId) {
                    await OAuthClientManager.deleteApplication(appId, userId);
                    setApplications(applications.filter(a => a.id !== appId));
                  }
                } catch (err) {
                  console.error('Failed to delete application:', err);
                  setError('Failed to delete application');
                }
              }}
            />
          ))}
        </div>
      ) : null}

      {/* Create Application Modal */}
      {showCreateForm && (
        <CreateApplicationModal
          onClose={() => setShowCreateForm(false)}
          onSuccess={(newApp) => {
            setApplications([...applications, newApp.application]);
            setShowCreateForm(false);
          }}
          setError={setError}
        />
      )}

      {/* Edit Application Modal */}
      {selectedApp && (
        <EditApplicationModal
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onSuccess={(updatedApp) => {
            setApplications(applications.map(a => 
              a.id === updatedApp.id ? updatedApp : a
            ));
            setSelectedApp(null);
          }}
          setError={setError}
        />
      )}
    </div>
  );
}

function GeneralSettingsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          General Settings
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          General application preferences
        </p>
      </div>
      
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
        <p className="text-zinc-600 dark:text-zinc-400">
          General settings will be available in a future update.
        </p>
      </div>
    </div>
  );
}

// Application Card Component
interface ApplicationCardProps {
  application: OAuthClientApplication;
  onEdit: () => void;
  onDelete: (appId: string) => void;
}

function ApplicationCard({ application, onEdit, onDelete }: ApplicationCardProps) {
  const [showClientId, setShowClientId] = useState(false);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
            {application.name}
          </h3>
          {application.description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              {application.description}
            </p>
          )}
          
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Client ID:</span>
              <code className="text-sm bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                {showClientId ? application.client_id : '••••••••••••••••'}
              </code>
              <button
                onClick={() => setShowClientId(!showClientId)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showClientId ? 'Hide' : 'Show'}
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Type:</span>
              <span className={`text-xs px-2 py-1 rounded-full ${
                application.client_type === 'public' 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              }`}>
                {application.client_type}
              </span>
            </div>
            
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Created: {new Date(application.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 ml-4">
          <button
            onClick={onEdit}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Edit
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete application "${application.name}"? This action cannot be undone.`)) {
                onDelete(application.id);
              }
            }}
            className="text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// Create Application Modal Component
interface CreateApplicationModalProps {
  onClose: () => void;
  onSuccess: (app: { application: OAuthClientApplication; clientSecret: string }) => void;
  setError: (error: string | null) => void;
}

function CreateApplicationModal({ onClose, onSuccess, setError }: CreateApplicationModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clientType: 'confidential' as 'public' | 'confidential'
  });
  const [loading, setLoading] = useState(false);
  const [createdApp, setCreatedApp] = useState<{ application: OAuthClientApplication; clientSecret: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Application name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const { supabase } = await import('../../../lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const newApp = await OAuthClientManager.createApplication({
        userId,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        clientType: formData.clientType
      });

      setCreatedApp(newApp);
    } catch (err) {
      console.error('Failed to create application:', err);
      setError('Failed to create application');
    } finally {
      setLoading(false);
    }
  };

  if (createdApp) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
            Application Created Successfully
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Client ID
              </label>
              <code className="block text-sm bg-zinc-100 dark:bg-zinc-800 p-2 rounded border">
                {createdApp.application.client_id}
              </code>
            </div>
            
            {createdApp.application.client_type === 'confidential' && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Client Secret
                </label>
                <code className="block text-sm bg-zinc-100 dark:bg-zinc-800 p-2 rounded border">
                  {createdApp.clientSecret}
                </code>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  ⚠️ Save this secret now. You won't be able to see it again.
                </p>
              </div>
            )}
          </div>
          
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `Client ID: ${createdApp.application.client_id}\n` +
                  (createdApp.application.client_type === 'confidential' 
                    ? `Client Secret: ${createdApp.clientSecret}` 
                    : '')
                );
              }}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
            >
              Copy Credentials
            </button>
            <button
              onClick={() => {
                onSuccess(createdApp);
              }}
              className="flex-1 bg-zinc-600 hover:bg-zinc-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
          Create OAuth Application
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Application Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              placeholder="My External App"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              placeholder="Description of your application"
              rows={3}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Client Type
            </label>
            <select
              value={formData.clientType}
              onChange={(e) => setFormData({ ...formData, clientType: e.target.value as 'public' | 'confidential' })}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
            >
              <option value="confidential">Confidential (Server-side app)</option>
              <option value="public">Public (Client-side app)</option>
            </select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {formData.clientType === 'public' 
                ? 'For JavaScript/mobile apps. PKCE required for security.'
                : 'For server-side apps that can securely store secrets.'
              }
            </p>
          </div>
          
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Application Modal Component
interface EditApplicationModalProps {
  application: OAuthClientApplication;
  onClose: () => void;
  onSuccess: (app: OAuthClientApplication) => void;
  setError: (error: string | null) => void;
}

function EditApplicationModal({ application, onClose, onSuccess, setError }: EditApplicationModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'redirects'>('details');
  const [formData, setFormData] = useState({
    name: application.name,
    description: application.description || ''
  });
  const [loading, setLoading] = useState(false);
  const [redirectURIs, setRedirectURIs] = useState<OAuthRedirectURI[]>([]);
  const [loadingURIs, setLoadingURIs] = useState(true);

  // Load redirect URIs
  useEffect(() => {
    const loadRedirectURIs = async () => {
      try {
        setLoadingURIs(true);
        const uris = await RedirectURIManager.getRedirectURIs(application.id);
        setRedirectURIs(uris);
      } catch (err) {
        console.error('Failed to load redirect URIs:', err);
        setError('Failed to load redirect URIs');
      } finally {
        setLoadingURIs(false);
      }
    };

    loadRedirectURIs();
  }, [application.id, setError]);

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      
      const { supabase } = await import('../../../lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const updatedApp = await OAuthClientManager.updateApplication(
        application.id,
        userId,
        {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined
        }
      );

      onSuccess(updatedApp);
    } catch (err) {
      console.error('Failed to update application:', err);
      setError('Failed to update application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
            Edit Application: {application.name}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('redirects')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'redirects'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            Redirect URIs ({redirectURIs.length})
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'details' && (
          <form onSubmit={handleUpdateDetails} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Application Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                rows={3}
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                {loading ? 'Updating...' : 'Update'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'redirects' && (
          <RedirectURIManagerComponent
            applicationId={application.id}
            redirectURIs={redirectURIs}
            setRedirectURIs={setRedirectURIs}
            loading={loadingURIs}
            setError={setError}
          />
        )}
      </div>
    </div>
  );
}

// Redirect URI Manager Component
interface RedirectURIManagerComponentProps {
  applicationId: string;
  redirectURIs: OAuthRedirectURI[];
  setRedirectURIs: (uris: OAuthRedirectURI[]) => void;
  loading: boolean;
  setError: (error: string | null) => void;
}

function RedirectURIManagerComponent({ 
  applicationId, 
  redirectURIs, 
  setRedirectURIs, 
  loading, 
  setError 
}: RedirectURIManagerComponentProps) {
  const [newURI, setNewURI] = useState('');
  const [addingURI, setAddingURI] = useState(false);

  const handleAddURI = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newURI.trim()) {
      setError('Redirect URI is required');
      return;
    }

    try {
      setAddingURI(true);
      setError(null);
      
      const uri = await RedirectURIManager.addRedirectURI(applicationId, newURI.trim());
      setRedirectURIs([...redirectURIs, uri]);
      setNewURI('');
    } catch (err) {
      console.error('Failed to add redirect URI:', err);
      setError('Failed to add redirect URI');
    } finally {
      setAddingURI(false);
    }
  };

  const handleDeleteURI = async (uriId: string) => {
    try {
      await RedirectURIManager.deleteRedirectURI(uriId);
      setRedirectURIs(redirectURIs.filter(uri => uri.id !== uriId));
    } catch (err) {
      console.error('Failed to delete redirect URI:', err);
      setError('Failed to delete redirect URI');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-zinc-600 dark:text-zinc-400">Loading redirect URIs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add URI Form */}
      <form onSubmit={handleAddURI} className="flex gap-2">
        <input
          type="url"
          value={newURI}
          onChange={(e) => setNewURI(e.target.value)}
          placeholder="https://example.com/oauth/callback"
          className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          required
        />
        <button
          type="submit"
          disabled={addingURI}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {addingURI ? 'Adding...' : 'Add'}
        </button>
      </form>

      {/* URI List */}
      {redirectURIs.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
          No redirect URIs configured
        </div>
      ) : (
        <div className="space-y-2">
          {redirectURIs.map((uri) => (
            <div
              key={uri.id}
              className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg"
            >
              <code className="text-sm text-zinc-900 dark:text-zinc-100 flex-1 mr-4">
                {uri.uri}
              </code>
              <button
                onClick={() => {
                  if (confirm(`Delete redirect URI "${uri.uri}"?`)) {
                    handleDeleteURI(uri.id);
                  }
                }}
                className="text-red-600 dark:text-red-400 hover:underline text-sm"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
        <p className="font-medium mb-1">Redirect URI Guidelines:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Must be HTTPS in production (HTTP allowed for localhost in development)</li>
          <li>Must be an exact match - no wildcards allowed</li>
          <li>Cannot contain fragment identifiers (#)</li>
          <li>Maximum 10 redirect URIs per application</li>
        </ul>
      </div>
    </div>
  );
}