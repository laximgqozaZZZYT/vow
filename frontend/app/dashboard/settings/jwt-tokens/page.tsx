"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../hooks/useAuth";

/**
 * CLI Token type definition based on backend response
 */
interface CliToken {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  isActive: boolean;
}

/**
 * Created CLI Token response (includes both tokens, only shown once)
 */
interface CreatedCliToken {
  id: string;
  accessToken: string;
  refreshToken: string;
  name: string;
  scopes: string[];
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  createdAt: string;
}

/**
 * JWT Token Management Page
 *
 * Displays a list of user's CLI JWT tokens with their details.
 * Provides create and revoke functionality.
 */
export default function JwtTokensPage() {
  const router = useRouter();
  const { isAuthed, isGuest } = useAuth();

  const [tokens, setTokens] = useState<CliToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create token modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["cli:read", "cli:write"]);
  const [selectedExpirationDays, setSelectedExpirationDays] = useState<string>("30");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Created token display state (shown after successful creation)
  const [createdToken, setCreatedToken] = useState<CreatedCliToken | null>(null);
  const [isCopiedAccess, setIsCopiedAccess] = useState(false);
  const [isCopiedRefresh, setIsCopiedRefresh] = useState(false);

  // Revoke token modal state
  const [tokenToRevoke, setTokenToRevoke] = useState<CliToken | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // Extend token modal state
  const [tokenToExtend, setTokenToExtend] = useState<CliToken | null>(null);
  const [selectedExtendDays, setSelectedExtendDays] = useState<string>("30");
  const [isExtending, setIsExtending] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);

  const accessTokenRef = useRef<HTMLInputElement>(null);
  const refreshTokenRef = useRef<HTMLInputElement>(null);

  // Fetch CLI tokens on component mount
  useEffect(() => {
    const fetchTokens = async () => {
      if (isAuthed === null) return;
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

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
        if (!backendUrl) {
          throw new Error("Backend API URL not configured");
        }

        const response = await fetch(`${backendUrl}/api/cli-tokens`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to fetch CLI tokens: ${response.status}`);
        }

        const { tokens: fetchedTokens } = await response.json();
        setTokens(fetchedTokens || []);
      } catch (err) {
        console.error("Failed to fetch CLI tokens:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch CLI tokens");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTokens();
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

  // Check if token is expired
  const isExpired = (expiresAt: string): boolean => {
    return new Date(expiresAt) < new Date();
  };

  // Open create token modal
  const handleOpenCreateModal = () => {
    setNewTokenName("");
    setSelectedScopes(["cli:read", "cli:write"]);
    setSelectedExpirationDays("30");
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  // Close create token modal
  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setNewTokenName("");
    setCreateError(null);
  };

  // Close created token display modal
  const handleCloseCreatedTokenModal = () => {
    setCreatedToken(null);
    setIsCopiedAccess(false);
    setIsCopiedRefresh(false);
  };

  // Copy access token to clipboard
  const handleCopyAccessToken = async () => {
    if (!createdToken) return;

    try {
      await navigator.clipboard.writeText(createdToken.accessToken);
      setIsCopiedAccess(true);
      setTimeout(() => setIsCopiedAccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy access token:", err);
      if (accessTokenRef.current) {
        accessTokenRef.current.select();
      }
    }
  };

  // Copy refresh token to clipboard
  const handleCopyRefreshToken = async () => {
    if (!createdToken) return;

    try {
      await navigator.clipboard.writeText(createdToken.refreshToken);
      setIsCopiedRefresh(true);
      setTimeout(() => setIsCopiedRefresh(false), 2000);
    } catch (err) {
      console.error("Failed to copy refresh token:", err);
      if (refreshTokenRef.current) {
        refreshTokenRef.current.select();
      }
    }
  };

  // Toggle scope selection
  const handleToggleScope = (scope: string) => {
    setSelectedScopes(prev =>
      prev.includes(scope)
        ? prev.filter(s => s !== scope)
        : [...prev, scope]
    );
  };

  // Create new CLI token
  const handleCreateToken = async () => {
    if (!newTokenName.trim()) {
      setCreateError("Please enter a name for the token");
      return;
    }

    if (selectedScopes.length === 0) {
      setCreateError("Please select at least one scope");
      return;
    }

    if (tokens.length >= 10) {
      setCreateError("Maximum of 10 CLI tokens allowed");
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

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
      if (!backendUrl) {
        throw new Error("Backend API URL not configured");
      }

      const response = await fetch(`${backendUrl}/api/cli-tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: newTokenName.trim(),
          scopes: selectedScopes,
          expirationDays: selectedExpirationDays,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create CLI token: ${response.status}`);
      }

      const createdTokenData: CreatedCliToken = await response.json();

      setIsCreateModalOpen(false);
      setNewTokenName("");
      setCreatedToken(createdTokenData);

      // Add the new token to the list
      setTokens(prev => [...prev, {
        id: createdTokenData.id,
        name: createdTokenData.name,
        scopes: createdTokenData.scopes,
        createdAt: createdTokenData.createdAt,
        lastUsedAt: null,
        expiresAt: createdTokenData.refreshTokenExpiresAt,
        isActive: true,
      }]);
    } catch (err) {
      console.error("Failed to create CLI token:", err);
      setCreateError(err instanceof Error ? err.message : "Failed to create CLI token");
    } finally {
      setIsCreating(false);
    }
  };

  // Open revoke confirmation modal
  const handleOpenRevokeModal = (token: CliToken) => {
    setTokenToRevoke(token);
    setRevokeError(null);
  };

  // Close revoke confirmation modal
  const handleCloseRevokeModal = () => {
    setTokenToRevoke(null);
    setRevokeError(null);
    setIsRevoking(false);
  };

  // Revoke CLI token
  const handleRevokeToken = async () => {
    if (!tokenToRevoke) return;

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

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL;
      if (!backendUrl) {
        throw new Error("Backend API URL not configured");
      }

      const response = await fetch(`${backendUrl}/api/cli-tokens/${tokenToRevoke.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to revoke CLI token: ${response.status}`);
      }

      setTokens(prev => prev.filter(token => token.id !== tokenToRevoke.id));
      handleCloseRevokeModal();
    } catch (err) {
      console.error("Failed to revoke CLI token:", err);
      setRevokeError(err instanceof Error ? err.message : "Failed to revoke CLI token");
    } finally {
      setIsRevoking(false);
    }
  };

  // Open extend token modal
  const handleOpenExtendModal = (token: CliToken) => {
    setTokenToExtend(token);
    setSelectedExtendDays("30");
    setExtendError(null);
  };

  // Close extend token modal
  const handleCloseExtendModal = () => {
    setTokenToExtend(null);
    setExtendError(null);
    setIsExtending(false);
  };

  // Extend JWT token expiration
  const handleExtendToken = async () => {
    if (!tokenToExtend) return;

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

      const response = await fetch(`${backendUrl}/api/cli-tokens/${tokenToExtend.id}/extend`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          extensionDays: selectedExtendDays,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to extend token: ${response.status}`);
      }

      const { token: updatedToken } = await response.json();

      // Update the token in the list
      setTokens(prev => prev.map(token =>
        token.id === tokenToExtend.id
          ? { ...token, expiresAt: updatedToken.expiresAt }
          : token
      ));

      handleCloseExtendModal();
    } catch (err) {
      console.error("Failed to extend JWT token:", err);
      setExtendError(err instanceof Error ? err.message : "Failed to extend token");
    } finally {
      setIsExtending(false);
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
              You need to be logged in to manage CLI tokens.
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

  // Navigation sections
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
      active: true,
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

  // Available scopes
  const availableScopes = [
    { id: 'cli:read', label: 'Read', description: 'Read data from your account' },
    { id: 'cli:write', label: 'Write', description: 'Create and modify data' },
    { id: 'cli:admin', label: 'Admin', description: 'Administrative operations' },
  ];

  // Expiration options for refresh tokens
  const expirationOptions = [
    { value: '7', label: '7 days', description: 'Most secure, requires frequent renewal' },
    { value: '30', label: '30 days', description: 'Balanced security and convenience (default)' },
    { value: '90', label: '90 days', description: 'Less frequent renewal needed' },
    { value: '180', label: '180 days', description: 'Extended validity period' },
    { value: '365', label: '1 year', description: 'Longest validity, least secure' },
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
          <div className="w-24" />
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
        <main className="flex-1 md:ml-64 p-4 sm:p-6 mt-14 md:mt-0 overflow-x-hidden">
          <div className="max-w-2xl mx-auto w-full">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold">JWT Tokens</h2>
                <p className="text-muted-foreground text-sm">
                  Manage JWT tokens for CLI authentication
                </p>
              </div>
              <button
                onClick={handleOpenCreateModal}
                disabled={tokens.length >= 10}
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
                <span className="whitespace-nowrap">Create Token</span>
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
                  <p className="font-medium mb-1">About JWT Tokens</p>
                  <p className="text-muted-foreground">
                    JWT tokens provide secure authentication for CLI tools.
                    Access tokens expire in 15 minutes and can be refreshed automatically.
                    Refresh token expiration is configurable (7-365 days).
                    You can have up to 10 active tokens.
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
            {!isLoading && !error && tokens.length === 0 && (
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
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <h3 className="text-h3 font-semibold mb-2">No JWT Tokens</h3>
                <p className="text-muted-foreground mb-4">
                  You haven't created any JWT tokens yet. Create one to use CLI tools.
                </p>
                <button
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary transition-opacity"
                >
                  Create Your First Token
                </button>
              </div>
            )}

            {/* Tokens List - Card view on mobile, table on desktop */}
            {!isLoading && !error && tokens.length > 0 && (
              <>
                {/* Mobile card view */}
                <div className="sm:hidden space-y-3">
                  {tokens.map((token) => (
                    <div
                      key={token.id}
                      className="bg-card border border-border rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="font-medium block">{token.name}</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {token.scopes.map((scope) => (
                              <span
                                key={scope}
                                className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono"
                              >
                                {scope.split(':')[1]}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleOpenExtendModal(token)}
                            disabled={isExpired(token.expiresAt)}
                            className="px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-50"
                          >
                            Extend
                          </button>
                          <button
                            onClick={() => handleOpenRevokeModal(token)}
                            className="px-2 py-1 text-xs text-destructive hover:bg-destructive/10 rounded transition-colors"
                          >
                            Revoke
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="block text-[10px] uppercase tracking-wide">Expires</span>
                          {isExpired(token.expiresAt) ? (
                            <span className="text-destructive">Expired</span>
                          ) : (
                            formatDate(token.expiresAt)
                          )}
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase tracking-wide">Last Used</span>
                          {formatDate(token.lastUsedAt)}
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
                            Scopes
                          </th>
                          <th className="text-left p-3 lg:p-4 text-small font-medium text-muted-foreground">
                            Expires
                          </th>
                          <th className="text-left p-3 lg:p-4 text-small font-medium text-muted-foreground hidden md:table-cell">
                            Last Used
                          </th>
                          <th className="text-right p-3 lg:p-4 text-small font-medium text-muted-foreground">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tokens.map((token) => (
                          <tr
                            key={token.id}
                            className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="p-3 lg:p-4">
                              <span className="font-medium">{token.name}</span>
                            </td>
                            <td className="p-3 lg:p-4">
                              <div className="flex flex-wrap gap-1">
                                {token.scopes.map((scope) => (
                                  <span
                                    key={scope}
                                    className="px-2 py-0.5 bg-muted rounded text-xs font-mono"
                                  >
                                    {scope.split(':')[1]}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="p-3 lg:p-4 text-small">
                              {isExpired(token.expiresAt) ? (
                                <span className="text-destructive">Expired</span>
                              ) : (
                                <span className="text-muted-foreground">
                                  {formatDate(token.expiresAt)}
                                </span>
                              )}
                            </td>
                            <td className="p-3 lg:p-4 text-small text-muted-foreground hidden md:table-cell">
                              {formatDate(token.lastUsedAt)}
                            </td>
                            <td className="p-3 lg:p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenExtendModal(token)}
                                  disabled={isExpired(token.expiresAt)}
                                  className="px-3 py-1.5 text-small text-primary hover:bg-primary/10 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Extend
                                </button>
                                <button
                                  onClick={() => handleOpenRevokeModal(token)}
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

            {/* Token Count Info */}
            {!isLoading && !error && tokens.length > 0 && (
              <p className="text-small text-muted-foreground mt-4 text-center">
                {tokens.length} of 10 JWT tokens used
              </p>
            )}

            {/* CLI Usage Guide */}
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
                CLI Usage with JWT
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                Use your JWT tokens for secure CLI authentication with automatic token refresh.
              </p>

              {/* Authentication */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-2">Authentication</h4>
                <p className="text-muted-foreground text-sm mb-2">
                  Include your access token in the Authorization header:
                </p>
                <div className="bg-muted rounded-lg p-3 overflow-x-auto">
                  <code className="text-xs font-mono text-foreground whitespace-pre">
Authorization: Bearer YOUR_ACCESS_TOKEN
                  </code>
                </div>
              </div>

              {/* Refresh Token */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-2">Token Refresh</h4>
                <p className="text-muted-foreground text-sm mb-2">
                  When your access token expires, use the refresh token to get a new one:
                </p>
                <div className="bg-muted rounded-lg p-3 overflow-x-auto">
                  <pre className="text-xs font-mono text-foreground whitespace-pre">{`curl -X POST \${API_URL}/api/cli-tokens/refresh \\
  -H "Content-Type: application/json" \\
  -d '{"refreshToken": "YOUR_REFRESH_TOKEN"}'`}</pre>
                </div>
              </div>

              {/* Environment Variables */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>Tip:</strong> Store your tokens in environment variables for easier usage:
                </p>
                <div className="mt-2 bg-muted rounded p-2 overflow-x-auto">
                  <pre className="text-xs font-mono text-foreground whitespace-pre">{`export VOW_ACCESS_TOKEN="your_access_token"
export VOW_REFRESH_TOKEN="your_refresh_token"`}</pre>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Create Token Modal */}
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
              <h2 className="text-h2 font-semibold">Create JWT Token</h2>
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
              Create a JWT token for CLI authentication.
            </p>

            {createError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
                <p className="text-destructive text-small">{createError}</p>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="tokenName" className="block text-small font-medium mb-2">
                Token Name
              </label>
              <input
                id="tokenName"
                type="text"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder="e.g., My CLI Tool"
                maxLength={255}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="block text-small font-medium mb-2">
                Scopes
              </label>
              <div className="space-y-2">
                {availableScopes.map((scope) => (
                  <label
                    key={scope.id}
                    className="flex items-start gap-3 p-3 border border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(scope.id)}
                      onChange={() => handleToggleScope(scope.id)}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="font-medium">{scope.label}</span>
                      <p className="text-muted-foreground text-xs">{scope.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-small font-medium mb-2">
                Token Expiration
              </label>
              <select
                value={selectedExpirationDays}
                onChange={(e) => setSelectedExpirationDays(e.target.value)}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {expirationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs mt-2">
                Access tokens always expire in 15 minutes and can be refreshed using the refresh token.
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
                onClick={handleCreateToken}
                disabled={isCreating || !newTokenName.trim() || selectedScopes.length === 0}
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
                  "Create Token"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Created Token Display Modal */}
      {createdToken && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleCloseCreatedTokenModal}
        >
          <div
            className="w-full max-w-lg p-6 bg-card rounded-xl shadow-lg mx-4 max-h-[90vh] overflow-y-auto"
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
                <h2 className="text-h2 font-semibold">JWT Token Created</h2>
                <p className="text-muted-foreground text-small">{createdToken.name}</p>
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
                  <p className="font-medium text-warning mb-1">Important: Save these tokens now!</p>
                  <p className="text-muted-foreground">
                    This is the only time you will see these tokens.
                    Copy them and store them securely.
                  </p>
                </div>
              </div>
            </div>

            {/* Access Token Display */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-small font-medium">
                  Access Token
                </label>
                <span className="text-xs text-muted-foreground">
                  Expires: {formatDate(createdToken.accessTokenExpiresAt)}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  ref={accessTokenRef}
                  type="text"
                  value={createdToken.accessToken}
                  readOnly
                  className="flex-1 px-3 py-2 bg-muted border border-border rounded-md font-mono text-xs text-foreground select-all"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopyAccessToken}
                  className={`px-3 py-2 rounded-md transition-colors flex items-center gap-1.5 text-sm ${
                    isCopiedAccess
                      ? "bg-success text-success-foreground"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                  }`}
                >
                  {isCopiedAccess ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Refresh Token Display */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-small font-medium">
                  Refresh Token
                </label>
                <span className="text-xs text-muted-foreground">
                  Expires: {formatDate(createdToken.refreshTokenExpiresAt)}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  ref={refreshTokenRef}
                  type="text"
                  value={createdToken.refreshToken}
                  readOnly
                  className="flex-1 px-3 py-2 bg-muted border border-border rounded-md font-mono text-xs text-foreground select-all"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={handleCopyRefreshToken}
                  className={`px-3 py-2 rounded-md transition-colors flex items-center gap-1.5 text-sm ${
                    isCopiedRefresh
                      ? "bg-success text-success-foreground"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                  }`}
                >
                  {isCopiedRefresh ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleCloseCreatedTokenModal}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md shadow-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary transition-opacity"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {tokenToRevoke && (
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
                <h2 className="text-h2 font-semibold">Revoke JWT Token</h2>
                <p className="text-muted-foreground text-small">{tokenToRevoke.name}</p>
              </div>
            </div>

            <p className="text-muted-foreground mb-4">
              Are you sure you want to revoke this token? This action cannot be undone.
              Any CLI tools using this token will stop working immediately.
            </p>

            {/* Token Info */}
            <div className="bg-muted border border-border rounded-lg p-3 mb-4">
              <div className="flex flex-wrap gap-2 items-center">
                {tokenToRevoke.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="px-2 py-0.5 bg-background rounded text-xs font-mono"
                  >
                    {scope}
                  </span>
                ))}
                <span className="text-small text-muted-foreground ml-auto">
                  Created {formatDate(tokenToRevoke.createdAt)}
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
                onClick={handleRevokeToken}
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
                  "Revoke Token"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extend Expiration Modal */}
      {tokenToExtend && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={handleCloseExtendModal}
        >
          <div
            className="w-full max-w-md p-6 bg-card rounded-xl shadow-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-h2 font-semibold">Extend Token Expiration</h2>
              <button
                onClick={handleCloseExtendModal}
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
              Extend the expiration of "{tokenToExtend.name}". The new expiration date will be calculated from today.
            </p>

            {/* Current Expiration Info */}
            <div className="bg-muted border border-border rounded-lg p-3 mb-4">
              <div className="flex justify-between items-center text-small">
                <span className="text-muted-foreground">Current expiration:</span>
                <span className="font-medium">{formatDate(tokenToExtend.expiresAt)}</span>
              </div>
            </div>

            {extendError && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 mb-4">
                <p className="text-destructive text-small">{extendError}</p>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-small font-medium mb-2">
                New Expiration Period
              </label>
              <select
                value={selectedExtendDays}
                onChange={(e) => setSelectedExtendDays(e.target.value)}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {expirationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs mt-2">
                The token will expire {selectedExtendDays} days from today.
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
                onClick={handleExtendToken}
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
    </div>
  );
}
