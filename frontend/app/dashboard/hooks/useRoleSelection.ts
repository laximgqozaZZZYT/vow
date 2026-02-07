/**
 * useRoleSelection - Manages role selection state
 *
 * Manages role selection state including localStorage persistence
 * and MCP provider constraint enforcement.
 *
 * @module hooks/useRoleSelection
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { AgentRole, RoleConfig } from '../constants/role-prompts';
import { ROLE_CONFIGS, getRoleConfig, getAvailableRoles } from '../constants/role-prompts';

const ROLE_STORAGE_KEY = 'vow_selected_role';

export interface RoleOption {
  id: AgentRole;
  name: string;
  icon: string;
  description: string;
  mcpOnly: boolean;
}

export interface UseRoleSelectionOptions {
  /** Whether an MCP provider is currently selected */
  isMcpSelected: boolean;
  /** Locale for display strings */
  locale: 'ja' | 'en';
}

export interface UseRoleSelectionReturn {
  /** Currently selected role ID */
  selectedRole: AgentRole;
  /** Switch to a different role */
  switchRole: (roleId: AgentRole) => void;
  /** List of selectable roles */
  availableRoles: RoleOption[];
  /** RoleConfig for the currently selected role */
  roleConfig: RoleConfig;
  /** Whether Remote CLI role is enabled (true only when MCP is selected) */
  isRemoteCliEnabled: boolean;
  /** Whether the current role is Remote CLI */
  isRemoteCli: boolean;
}

export function useRoleSelection({ isMcpSelected, locale }: UseRoleSelectionOptions): UseRoleSelectionReturn {
  // ---------------------------------------------------------------------------
  // Restore initial value from localStorage
  // ---------------------------------------------------------------------------
  const [selectedRole, setSelectedRole] = useState<AgentRole>(() => {
    if (typeof window === 'undefined') return 'AICoach';
    try {
      const saved = localStorage.getItem(ROLE_STORAGE_KEY);
      if (saved && saved in ROLE_CONFIGS) {
        return saved as AgentRole;
      }
    } catch { /* ignore */ }
    return 'AICoach';
  });

  // ---------------------------------------------------------------------------
  // MCP fallback: revert to AICoach if remoteCli is selected without MCP
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isMcpSelected && selectedRole === 'remoteCli') {
      setSelectedRole('AICoach');
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(ROLE_STORAGE_KEY, 'AICoach');
        } catch { /* ignore */ }
      }
    }
  }, [isMcpSelected, selectedRole]);

  // ---------------------------------------------------------------------------
  // Switch role
  // ---------------------------------------------------------------------------
  const switchRole = useCallback((roleId: AgentRole) => {
    // Block switching to MCP-only roles when MCP is not selected
    const config = getRoleConfig(roleId);
    if (config.mcpOnly && !isMcpSelected) {
      return;
    }
    setSelectedRole(roleId);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ROLE_STORAGE_KEY, roleId);
      } catch { /* ignore */ }
    }
  }, [isMcpSelected]);

  // ---------------------------------------------------------------------------
  // Build selectable role options
  // ---------------------------------------------------------------------------
  const availableRoles = useMemo((): RoleOption[] => {
    const roles = getAvailableRoles(locale);
    // Deduplicate: exclude alias entries ('coach' is alias for 'AICoach', 'default' is internal)
    const seen = new Set<string>();
    return roles
      .filter(role => {
        if (role.id === 'coach' || role.id === 'default') return false;
        if (seen.has(role.id)) return false;
        seen.add(role.id);
        return true;
      })
      .map(role => ({
        ...role,
        mcpOnly: ROLE_CONFIGS[role.id]?.mcpOnly ?? false,
      }));
  }, [locale]);

  // ---------------------------------------------------------------------------
  // Current role config
  // ---------------------------------------------------------------------------
  const roleConfig = useMemo(() => getRoleConfig(selectedRole), [selectedRole]);

  // ---------------------------------------------------------------------------
  // Remote CLI convenience flags
  // ---------------------------------------------------------------------------
  const isRemoteCli = selectedRole === 'remoteCli';
  const isRemoteCliEnabled = isMcpSelected;

  return {
    selectedRole,
    switchRole,
    availableRoles,
    roleConfig,
    isRemoteCliEnabled,
    isRemoteCli,
  };
}

export default useRoleSelection;
