"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
}

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
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  
  // Created key display state (shown after successful creation)
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  // Revoke key modal state
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  
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

        // Fetch API keys from backend
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') || '';
        const response = await fetch(`${SUPABASE_URL}/functions/v1/api-keys`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to fetch API keys: ${response.status}`);
        }

        const data = await response.json();
        setApiKeys(data.keys || []);
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
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  // Close create key modal
  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setNewKeyName("");
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

      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') || '';
      const response = await fetch(`${SUPABASE_URL}/functions/v1/api-keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create API key: ${response.status}`);
      }

      const data: CreatedApiKey = await response.json();
      
      // Close create modal and show created key modal
      setIsCreateModalOpen(false);
      setNewKeyName("");
      setCreatedKey(data);
      
      // Add the new key to the list (without the full key)
      setApiKeys(prev => [...prev, {
        id: data.id,
        keyPrefix: data.keyPrefix,
        name: data.name,
        createdAt: data.createdAt,
        lastUsedAt: null,
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

      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') || '';
      const response = await fetch(`${SUPABASE_URL}/functions/v1/api-keys/${keyToRevoke.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
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

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-muted rounded-md transition-colors"
              aria-label="Back to dashboard"
            >
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
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-h1 font-semibold">API Keys</h1>
              <p className="text-muted-foreground text-small">
                Manage API keys for embedding dashboard widgets
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenCreateModal}
            disabled={apiKeys.length >= 5}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary transition-opacity flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
            Create API Key
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

        {/* API Keys List */}
        {!isLoading && !error && apiKeys.length > 0 && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-4 text-small font-medium text-muted-foreground">
                      Name
                    </th>
                    <th className="text-left p-4 text-small font-medium text-muted-foreground">
                      Key Prefix
                    </th>
                    <th className="text-left p-4 text-small font-medium text-muted-foreground">
                      Created
                    </th>
                    <th className="text-left p-4 text-small font-medium text-muted-foreground">
                      Last Used
                    </th>
                    <th className="text-right p-4 text-small font-medium text-muted-foreground">
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
                      <td className="p-4">
                        <span className="font-medium">{key.name}</span>
                      </td>
                      <td className="p-4">
                        <code className="px-2 py-1 bg-muted rounded text-small font-mono">
                          {key.keyPrefix}...
                        </code>
                      </td>
                      <td className="p-4 text-small text-muted-foreground">
                        {formatDate(key.createdAt)}
                      </td>
                      <td className="p-4 text-small text-muted-foreground">
                        {formatDate(key.lastUsedAt)}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenRevokeModal(key)}
                          className="px-3 py-1.5 text-small text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Key Count Info */}
        {!isLoading && !error && apiKeys.length > 0 && (
          <p className="text-small text-muted-foreground mt-4 text-center">
            {apiKeys.length} of 5 API keys used
          </p>
        )}
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

            <div className="mb-6">
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
