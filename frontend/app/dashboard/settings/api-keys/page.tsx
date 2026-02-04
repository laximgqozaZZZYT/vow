"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../hooks/useAuth";

/**
 * API Key type definition based on backend response
 */
interface ApiKey {
  id: string;
  keyPrefix: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  isActive: boolean;
}

/**
 * Created API Key response (includes full key, only shown once)
 */
interface CreatedApiKey {
  id: string;
  key: string;
  keyPrefix: string;
  name: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Expiration options for API keys
 */
const expirationOptions = [
  { value: '7', label: '7 days', description: 'Most secure, requires frequent renewal' },
  { value: '30', label: '30 days', description: 'Good balance of security and convenience' },
  { value: '90', label: '90 days', description: 'Less frequent renewal needed' },
  { value: '180', label: '180 days', description: 'Extended validity period' },
  { value: '365', label: '1 year', description: 'Longest validity, least secure (default)' },
];

/**
 * API Key Management Page
 * 
 * Displays a list of user's API keys with their details.
 * Provides create and revoke functionality.
 * 
 * Requirements: 1.1 - Generate unique, cryptographically secure API key
 * Requirements: 1.3 - Display list of active keys with masked values and creation dates
 */
export default function ApiKeysPage() {
  const router = useRouter();
  const { isAuthed, isGuest } = useAuth();
  
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create key modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedExpirationDays, setSelectedExpirationDays] = useState<string>("365");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  
  // Created key display state (shown after successful creation)
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  // Revoke key modal state
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Extend key modal state
  const [keyToExtend, setKeyToExtend] = useState<ApiKey | null>(null);
  const [selectedExtensionDays, setSelectedExtensionDays] = useState<string>("30");
  const [isExtending, setIsExtending] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);

  const keyInputRef = useRef<HTMLInputElement>(null);

  // Fetch API keys on component mount
  useEffect(() => {
    const fetchApiKeys = async () => {
      // Don't fetch if not authenticated or is guest
      if (isAuthed === null) return; // Still loading auth state
      if (!isAuthed || isGuest) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const { supabase } = await import("../../../../lib/supabaseClient");
        if (!supabase) {
          throw new Error("Supabase client not available");
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error("No authentication token available");
        }

        // Call backend API for secure key listing
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
        if (!backendUrl) {
          // Fallback to direct Supabase query if backend not configured
          const { data, error: fetchError } = await supabase
            .from('api_keys')
            .select('id, key_prefix, name, created_at, last_used_at, expires_at, is_active')
            .eq('user_id', session.user.id)
            .eq('is_active', true)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false });

          if (fetchError) {
            throw new Error(fetchError.message || 'Failed to fetch API keys');
          }

          // Convert snake_case to camelCase
          const keys = (data || []).map((k: any) => ({
            id: k.id,
            keyPrefix: k.key_prefix,
            name: k.name,
            createdAt: k.created_at,
            lastUsedAt: k.last_used_at,
            expiresAt: k.expires_at,
            isActive: k.is_active,
          }));
          setApiKeys(keys);
          return;
        }

        const response = await fetch(`${backendUrl}/api/api-keys`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to fetch API keys: ${response.status}`);
        }

        const { keys } = await response.json();
        setApiKeys(keys || []);
      } catch (err) {
        console.error("Failed to fetch API keys:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch API keys");
      } finally {
        setIsLoading(false);
      }
    };

    fetchApiKeys();
  }, [isAuthed, isGuest]);

  // Format date for display
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Handle back navigation
  const handleBack = () => {
    router.push("/dashboard");
  };

  // Open create key modal
  const handleOpenCreateModal = () => {
    setNewKeyName("");
    setSelectedExpirationDays("365");
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  // Close create key modal
  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setNewKeyName("");
    setSelectedExpirationDays("365");
    setCreateError(null);
  };

  // Close created key display modal
  const handleCloseCreatedKeyModal = () => {
    setCreatedKey(null);
    setIsCopied(false);
  };

  // Copy key to clipboard
  const handleCopyKey = async () => {
    if (!createdKey) return;
    
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setIsCopied(true);
      // Reset copied state after 2 seconds
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy key:", err);
      // Fallback: select the input text
      if (keyInputRef.current) {
        keyInputRef.current.select();
      }
    }
  };

  // Create new API key
  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      setCreateError("Please enter a name for the API key");
      return;
    }

    if (apiKeys.length >= 5) {
      setCreateError("Maximum of 5 API keys allowed");
      return;
    }

    try {
      setIsCreating(true);
      setCreateError(null);

      const { supabase } = await import("../../../../lib/supabaseClient");
      if (!supabase) {
        throw new Error("Supabase client not available");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No authentication token available");
      }

      // Call backend API for secure server-side key generation
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
      if (!backendUrl) {
        throw new Error("Backend API URL not configured");
      }

      const response = await fetch(`${backendUrl}/api/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: newKeyName.trim(),
          expirationDays: selectedExpirationDays,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create API key: ${response.status}`);
      }

      const createdKeyData: CreatedApiKey = await response.json();
      
      // Close create modal and show created key modal
      setIsCreateModalOpen(false);
      setNewKeyName("");
      setCreatedKey(createdKeyData);
      
      // Add the new key to the list (without the full key)
      setApiKeys(prev => [...prev, {
        id: createdKeyData.id,
        keyPrefix: createdKeyData.keyPrefix,
        name: createdKeyData.name,
        createdAt: createdKeyData.createdAt,
        lastUsedAt: null,
        expiresAt: createdKeyData.expiresAt,
        isActive: true,
      }]);
    } catch (err) {
      console.error("Failed to create API key:", err);
      setCreateError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  };

  // Open revoke confirmation modal
  const handleOpenRevokeModal = (key: ApiKey) => {
    setKeyToRevoke(key);
    setRevokeError(null);
  };

  // Close revoke confirmation modal
  const handleCloseRevokeModal = () => {
    setKeyToRevoke(null);
    setRevokeError(null);
    setIsRevoking(false);
  };

  // Open extend modal
  const handleOpenExtendModal = (key: ApiKey) => {
    setKeyToExtend(key);
    setSelectedExtensionDays("30");
    setExtendError(null);
  };

  // Close extend modal
  const handleCloseExtendModal = () => {
    setKeyToExtend(null);
    setSelectedExtensionDays("30");
    setExtendError(null);
    setIsExtending(false);
  };

  // Extend API key expiration
  const handleExtendKey = async () => {
    if (!keyToExtend) return;

    try {
      setIsExtending(true);
      setExtendError(null);

      const { supabase } = await import("../../../../lib/supabaseClient");
      if (!supabase) {
        throw new Error("Supabase client not available");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No authentication token available");
      }

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
      if (!backendUrl) {
        throw new Error("Backend API URL not configured");
      }

      const response = await fetch(`${backendUrl}/api/api-keys/${keyToExtend.id}/extend`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          extensionDays: selectedExtensionDays,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to extend API key: ${response.status}`);
      }

      const { key: updatedKey } = await response.json();

      // Update the key in the list
      setApiKeys(prev => prev.map(key =>
        key.id === keyToExtend.id
          ? { ...key, expiresAt: updatedKey.expiresAt }
          : key
      ));

      // Close the modal
      handleCloseExtendModal();
    } catch (err) {
      console.error("Failed to extend API key:", err);
      setExtendError(err instanceof Error ? err.message : "Failed to extend API key");
    } finally {
      setIsExtending(false);
    }
  };

  // Revoke API key
  // Requirements: 1.4 - Mark key as inactive and reject future requests
  const handleRevokeKey = async () => {
    if (!keyToRevoke) return;

    try {
      setIsRevoking(true);
      setRevokeError(null);

      const { supabase } = await import("../../../../lib/supabaseClient");
      if (!supabase) {
        throw new Error("Supabase client not available");
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No authentication token available");
      }

      // Call backend API for secure key revocation
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
      if (!backendUrl) {
        throw new Error("Backend API URL not configured");
      }

      const response = await fetch(`${backendUrl}/api/api-keys/${keyToRevoke.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to revoke API key: ${response.status}`);
      }

      // Remove the revoked key from the list
      setApiKeys(prev => prev.filter(key => key.id !== keyToRevoke.id));
      
      // Close the modal
      handleCloseRevokeModal();
    } catch (err) {
      console.error("Failed to revoke API key:", err);
      setRevokeError(err instanceof Error ? err.message : "Failed to revoke API key");
    } finally {
      setIsRevoking(false);
    }
  };

  // Show loading state while checking auth
  if (isAuthed === null) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Redirect guests to login
  if (!isAuthed || isGuest) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <h2 className="text-h2 font-semibold mb-4">Authentication Required</h2>
            <p className="text-muted-foreground mb-4">
              You need to be logged in to manage API keys.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary transition-opacity"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Navigation sections (same as Settings page)
  const sections = [
    {
      id: 'profile',
      label: 'Profile',
      href: '/settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      href: '/settings?section=notifications',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      id: 'integrations',
      label: 'Integrations',
      href: '/settings?section=integrations',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
    },
    {
      id: 'api-keys',
      label: 'API Keys',
      href: '/dashboard/settings/api-keys',
      active: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      ),
    },
    {
      id: 'jwt-tokens',
      label: 'JWT Tokens',
      href: '/dashboard/settings/jwt-tokens',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      id: 'ai-config',
      label: 'AI設定',
      href: '/settings?section=ai-config',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">Back to Dashboard</span>
            </Link>
          </div>
          <h1 className="text-lg font-semibold">Settings</h1>
          <div className="w-24" /> {/* Spacer for centering */}
        </div>
      </header>

      <div className="pt-14 flex">
        {/* Sidebar */}
        <aside className="fixed left-0 top-14 bottom-0 w-64 border-r border-border bg-card p-4 hidden md:block">
          <nav className="space-y-1">
            {sections.map((section) => (
              <Link
                key={section.id}
                href={section.href}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  section.active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {section.icon}
                {section.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Mobile navigation - icons only to prevent overlap */}
        <div className="md:hidden fixed top-14 left-0 right-0 z-40 bg-card border-b border-border">
          <div className="flex justify-around p-2">
            {sections.map((section) => (
              <Link
                key={section.id}
                href={section.href}
                className={`flex flex-col items-center justify-center p-2 rounded-md transition-colors ${
                  section.active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
                title={section.label}
              >
                {section.icon}
                <span className="text-[10px] mt-0.5 truncate max-w-[48px]">{section.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 md:ml-64 p-4 sm:p-6 mt-14 md:mt-0">
          <div className="max-w-2xl mx-auto">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold">API Keys</h2>
                <p className="text-muted-foreground text-sm">
                  Manage API keys for embedding dashboard widgets
                </p>
              </div>
              <button
                onClick={handleOpenCreateModal}
                disabled={apiKeys.length >= 5}
                className="w-full sm:w-auto px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="whitespace-nowrap">Create API Key</span>
              </button>
            </div>

        {/* Info Card */}
        <div className="bg-muted border border-border rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary mt-0.5 flex-shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <div className="text-small">
              <p className="font-medium mb-1">About API Keys</p>
              <p className="text-muted-foreground">
                API keys allow you to embed dashboard widgets on external websites.
                Each key is limited to 100 requests per minute. You can have up to 5 active keys.
              </p>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-destructive flex-shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
              <p className="text-destructive text-small">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mx-auto mb-4"></div>
              <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && apiKeys.length === 0 && (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto mb-4 text-muted-foreground"
            >
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
            <h3 className="text-h3 font-semibold mb-2">No API Keys</h3>
            <p className="text-muted-foreground mb-4">
              You haven't created any API keys yet. Create one to start embedding widgets.
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary transition-opacity"
            >
              Create Your First API Key
            </button>
          </div>
        )}

        {/* API Keys List - Card view on mobile, table on desktop */}
        {!isLoading && !error && apiKeys.length > 0 && (
          <>
            {/* Mobile card view */}
            <div className="sm:hidden space-y-3">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="bg-card border border-border rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="font-medium block">{key.name}</span>
                      <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono mt-1 inline-block">
                        {key.keyPrefix}...
                      </code>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleOpenExtendModal(key)}
                        className="px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition-colors"
                      >
                        Extend
                      </button>
                      <button
                        onClick={() => handleOpenRevokeModal(key)}
                        className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded transition-colors"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide">Expires</span>
                      {formatDate(key.expiresAt)}
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-wide">Last Used</span>
                      {formatDate(key.lastUsedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-3 lg:p-4 text-small font-medium text-muted-foreground">
                        Name
                      </th>
                      <th className="text-left p-3 lg:p-4 text-small font-medium text-muted-foreground">
                        Key Prefix
                      </th>
                      <th className="text-left p-3 lg:p-4 text-small font-medium text-muted-foreground hidden md:table-cell">
                        Created
                      </th>
                      <th className="text-left p-3 lg:p-4 text-small font-medium text-muted-foreground">
                        Expires
                      </th>
                      <th className="text-left p-3 lg:p-4 text-small font-medium text-muted-foreground hidden lg:table-cell">
                        Last Used
                      </th>
                      <th className="text-right p-3 lg:p-4 text-small font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map((key) => (
                      <tr
                        key={key.id}
                        className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-3 lg:p-4">
                          <span className="font-medium">{key.name}</span>
                        </td>
                        <td className="p-3 lg:p-4">
                          <code className="px-2 py-1 bg-muted rounded text-small font-mono">
                            {key.keyPrefix}...
                          </code>
                        </td>
                        <td className="p-3 lg:p-4 text-small text-muted-foreground hidden md:table-cell">
                          {formatDate(key.createdAt)}
                        </td>
                        <td className="p-3 lg:p-4 text-small text-muted-foreground">
                          {formatDate(key.expiresAt)}
                        </td>
                        <td className="p-3 lg:p-4 text-small text-muted-foreground hidden lg:table-cell">
                          {formatDate(key.lastUsedAt)}
                        </td>
                        <td className="p-3 lg:p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenExtendModal(key)}
                              className="px-3 py-1.5 text-small text-primary hover:bg-primary/10 rounded-md transition-colors"
                            >
                              Extend
                            </button>
                            <button
                              onClick={() => handleOpenRevokeModal(key)}
                              className="px-3 py-1.5 text-small text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            >
                              Revoke
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Key Count Info */}
        {!isLoading && !error && apiKeys.length > 0 && (
          <p className="text-small text-muted-foreground mt-4 text-center">
            {apiKeys.length} of 5 API keys used
          </p>
        )}

        {/* CLI Usage Guide Section */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6 mt-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
            >
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            CLI / API Usage Guide
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            Use your API key to interact with VOW from the command line or integrate with external tools.
          </p>

          {/* Authentication Header */}
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-2">Authentication</h4>
            <p className="text-muted-foreground text-sm mb-2">
              Include your API key in the <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">X-API-Key</code> header:
            </p>
            <div className="bg-muted rounded-lg p-3 overflow-x-auto">
              <code className="text-xs font-mono text-foreground whitespace-pre">
X-API-Key: your-api-key-here
              </code>
            </div>
          </div>

          {/* Available Endpoints */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Available Endpoints</h4>

            {/* Chat with AI Coach */}
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-success/10 text-success text-xs font-medium rounded">POST</span>
                <code className="text-sm font-mono">/api/agents/cli/chat</code>
              </div>
              <p className="text-muted-foreground text-sm mb-3">
                Send a message to the AI coach and receive a response.
              </p>
              <details className="group">
                <summary className="cursor-pointer text-sm text-primary hover:underline">
                  View example
                </summary>
                <div className="mt-3 bg-muted rounded-lg p-3 overflow-x-auto">
                  <pre className="text-xs font-mono text-foreground whitespace-pre">{`curl -X POST http://localhost:4000/api/agents/cli/chat \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"message": "How can I improve my habits?", "locale": "en"}'`}</pre>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  <strong>Request body:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li><code className="px-1 bg-muted rounded">message</code> (required): Your message to the coach</li>
                    <li><code className="px-1 bg-muted rounded">sessionId</code> (optional): Session ID for multi-turn conversations</li>
                    <li><code className="px-1 bg-muted rounded">locale</code> (optional): Response language - "ja" or "en" (default: "ja")</li>
                  </ul>
                </div>
              </details>
            </div>

            {/* List Conversation History */}
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-xs font-medium rounded">GET</span>
                <code className="text-sm font-mono">/api/agents/history</code>
              </div>
              <p className="text-muted-foreground text-sm mb-3">
                List all your conversation sessions with the AI coach.
              </p>
              <details className="group">
                <summary className="cursor-pointer text-sm text-primary hover:underline">
                  View example
                </summary>
                <div className="mt-3 bg-muted rounded-lg p-3 overflow-x-auto">
                  <pre className="text-xs font-mono text-foreground whitespace-pre">{`curl -s http://localhost:4000/api/agents/history \\
  -H "X-API-Key: YOUR_API_KEY" | jq '.'`}</pre>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  <strong>Query parameters:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li><code className="px-1 bg-muted rounded">limit</code> (optional): Max sessions to return (default: 20, max: 100)</li>
                  </ul>
                </div>
              </details>
            </div>

            {/* Get Session Details */}
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-xs font-medium rounded">GET</span>
                <code className="text-sm font-mono">/api/agents/history/:sessionId</code>
              </div>
              <p className="text-muted-foreground text-sm mb-3">
                Get detailed conversation history for a specific session.
              </p>
              <details className="group">
                <summary className="cursor-pointer text-sm text-primary hover:underline">
                  View example
                </summary>
                <div className="mt-3 bg-muted rounded-lg p-3 overflow-x-auto">
                  <pre className="text-xs font-mono text-foreground whitespace-pre">{`curl -s http://localhost:4000/api/agents/history/SESSION_ID \\
  -H "X-API-Key: YOUR_API_KEY" | jq '.'`}</pre>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  <strong>Query parameters:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li><code className="px-1 bg-muted rounded">includeSuggestions</code> (optional): Include tool call outputs (default: true)</li>
                  </ul>
                </div>
              </details>
            </div>
          </div>

          {/* Base URL Note */}
          <div className="mt-6 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> Replace <code className="px-1 bg-muted rounded">http://localhost:4000</code> with the production API URL when deploying.
              Production URL: <code className="px-1 bg-muted rounded">https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development</code>
            </p>
          </div>
        </div>
          </div>
        </main>
      </div>

      {/* Create API Key Modal */}
      {isCreateModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleCloseCreateModal}
        >
          <div 
            className="w-full max-w-md p-6 bg-card rounded-xl shadow-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-h2 font-semibold">Create API Key</h2>
              <button
                onClick={handleCloseCreateModal}
                className="p-2 hover:bg-muted rounded-md transition-colors"
                aria-label="Close modal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-muted-foreground text-small mb-4">
              Give your API key a descriptive name to help you identify it later.
            </p>

            {createError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
                <p className="text-destructive text-small">{createError}</p>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="keyName" className="block text-small font-medium mb-2">
                Key Name
              </label>
              <input
                id="keyName"
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., My Website Widget"
                maxLength={100}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isCreating) {
                    handleCreateKey();
                  }
                }}
              />
            </div>

            <div className="mb-6">
              <label htmlFor="expirationDays" className="block text-small font-medium mb-2">
                Expiration Period
              </label>
              <select
                id="expirationDays"
                value={selectedExpirationDays}
                onChange={(e) => setSelectedExpirationDays(e.target.value)}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {expirationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">
                {expirationOptions.find(opt => opt.value === selectedExpirationDays)?.description}
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCloseCreateModal}
                className="px-4 py-2 text-foreground hover:bg-muted rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateKey}
                disabled={isCreating || !newKeyName.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Creating...
                  </>
                ) : (
                  "Create Key"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Created Key Display Modal */}
      {createdKey && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleCloseCreatedKeyModal}
        >
          <div 
            className="w-full max-w-lg p-6 bg-card rounded-xl shadow-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-success/10 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-success"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div>
                <h2 className="text-h2 font-semibold">API Key Created</h2>
                <p className="text-muted-foreground text-small">{createdKey.name}</p>
              </div>
            </div>

            {/* Warning Banner */}
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-warning mt-0.5 flex-shrink-0"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div className="text-small">
                  <p className="font-medium text-warning mb-1">Important: Save this key now!</p>
                  <p className="text-muted-foreground">
                    This is the only time you will see the full API key. 
                    Copy it and store it securely. You won't be able to see it again.
                  </p>
                </div>
              </div>
            </div>

            {/* API Key Display */}
            <div className="mb-6">
              <label className="block text-small font-medium mb-2">
                Your API Key
              </label>
              <div className="flex gap-2">
                <input
                  ref={keyInputRef}
                  type="text"
                  value={createdKey.key}
                  readOnly
                  className="flex-1 px-3 py-2 bg-muted border border-border rounded-md font-mono text-small text-foreground select-all"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopyKey}
                  className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${
                    isCopied 
                      ? "bg-success text-success-foreground" 
                      : "bg-primary text-primary-foreground hover:opacity-90"
                  }`}
                >
                  {isCopied ? (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleCloseCreatedKeyModal}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary transition-opacity"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Expiration Modal */}
      {keyToExtend && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleCloseExtendModal}
        >
          <div
            className="w-full max-w-md p-6 bg-card rounded-xl shadow-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-primary/10 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <h2 className="text-h2 font-semibold">Extend Expiration</h2>
                <p className="text-muted-foreground text-small">{keyToExtend.name}</p>
              </div>
            </div>

            <p className="text-muted-foreground mb-4">
              Extend the expiration date of this API key. The new expiration will be calculated from today.
            </p>

            {/* Current Expiration Info */}
            <div className="bg-muted border border-border rounded-lg p-3 mb-4">
              <div className="text-small">
                <span className="text-muted-foreground">Current expiration: </span>
                <span className="font-medium">{formatDate(keyToExtend.expiresAt)}</span>
              </div>
            </div>

            {extendError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
                <p className="text-destructive text-small">{extendError}</p>
              </div>
            )}

            <div className="mb-6">
              <label htmlFor="extensionDays" className="block text-small font-medium mb-2">
                Extension Period
              </label>
              <select
                id="extensionDays"
                value={selectedExtensionDays}
                onChange={(e) => setSelectedExtensionDays(e.target.value)}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {expirationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">
                {expirationOptions.find(opt => opt.value === selectedExtensionDays)?.description}
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCloseExtendModal}
                disabled={isExtending}
                className="px-4 py-2 text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExtendKey}
                disabled={isExtending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isExtending ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Extending...
                  </>
                ) : (
                  "Extend Expiration"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {keyToRevoke && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleCloseRevokeModal}
        >
          <div 
            className="w-full max-w-md p-6 bg-card rounded-xl shadow-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-destructive/10 rounded-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-destructive"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h2 className="text-h2 font-semibold">Revoke API Key</h2>
                <p className="text-muted-foreground text-small">{keyToRevoke.name}</p>
              </div>
            </div>

            <p className="text-muted-foreground mb-4">
              Are you sure you want to revoke this API key? This action cannot be undone.
              Any widgets using this key will stop working immediately.
            </p>

            {/* Key Info */}
            <div className="bg-muted border border-border rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2">
                <code className="px-2 py-1 bg-background rounded text-small font-mono">
                  {keyToRevoke.keyPrefix}...
                </code>
                <span className="text-small text-muted-foreground">
                  Created {formatDate(keyToRevoke.createdAt)}
                </span>
              </div>
            </div>

            {revokeError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
                <p className="text-destructive text-small">{revokeError}</p>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCloseRevokeModal}
                disabled={isRevoking}
                className="px-4 py-2 text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeKey}
                disabled={isRevoking}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md shadow-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-destructive transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isRevoking ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Revoking...
                  </>
                ) : (
                  "Revoke Key"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
