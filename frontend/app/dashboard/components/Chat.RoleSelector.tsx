/**
 * Chat.RoleSelector - Role Selection Dropdown
 *
 * Displays a dropdown (<select>) for switching between available agent roles.
 * Designed to sit alongside the AI provider dropdown (ProviderSelector).
 *
 * @module components/Chat.RoleSelector
 */

'use client';

import React from 'react';
import type { AgentRole } from '../constants/role-prompts';

// =============================================================================
// Types
// =============================================================================

export interface RoleOption {
  id: AgentRole;
  name: string;
  icon: string;
  description: string;
  mcpOnly: boolean;
}

// =============================================================================
// Props
// =============================================================================

export interface RoleSelectorProps {
  /** List of available role options */
  availableRoles: RoleOption[];
  /** Currently selected role ID */
  selectedRoleId: AgentRole;
  /** Callback when a role is selected */
  onSelect: (roleId: AgentRole) => void;
  /** Whether an MCP server is currently selected */
  isMcpSelected: boolean;
  /** Current locale */
  locale: 'ja' | 'en';
}

// =============================================================================
// i18n labels
// =============================================================================

const LABELS = {
  ja: {
    label: 'ロール:',
    mcpSuffix: '(MCP限定)',
    ariaLabel: 'ロール選択',
  },
  en: {
    label: 'Role:',
    mcpSuffix: '(MCP only)',
    ariaLabel: 'Role selection',
  },
} as const;

// =============================================================================
// Component
// =============================================================================

export function RoleSelector({
  availableRoles,
  selectedRoleId,
  onSelect,
  isMcpSelected,
  locale,
}: RoleSelectorProps) {
  const t = LABELS[locale];

  // Nothing to show if no roles at all
  if (availableRoles.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <label className="text-xs text-muted-foreground whitespace-nowrap">
        {t.label}
      </label>
      <select
        value={selectedRoleId}
        onChange={(e) => onSelect(e.target.value as AgentRole)}
        aria-label={t.ariaLabel}
        className="flex-1 text-xs bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {availableRoles.map((role) => {
          const isMcpDisabled = role.mcpOnly && !isMcpSelected;
          const suffix = isMcpDisabled ? ` ${t.mcpSuffix}` : '';

          return (
            <option
              key={role.id}
              value={role.id}
              disabled={isMcpDisabled}
            >
              {role.icon} {role.name}{suffix}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export default RoleSelector;
