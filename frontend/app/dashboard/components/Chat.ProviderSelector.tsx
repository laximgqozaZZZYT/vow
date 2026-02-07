/**
 * Chat.ProviderSelector - AI Provider Selection Dropdown
 *
 * Displays a dropdown (<select>) for switching between available AI providers,
 * grouped into MCP Servers and API Providers.
 *
 * @module components/Chat.ProviderSelector
 */

'use client';

import React, { useMemo } from 'react';
import type { AIProviderOption } from '../hooks/useAIProvider';

// =============================================================================
// Props
// =============================================================================

export interface ProviderSelectorProps {
  /** List of available provider options */
  providers: AIProviderOption[];
  /** Currently selected provider ID */
  selectedId: string;
  /** Callback when a provider is selected */
  onSelect: (id: string) => void;
}

// =============================================================================
// Component
// =============================================================================

export function ProviderSelector({
  providers,
  selectedId,
  onSelect,
}: ProviderSelectorProps) {
  const mcpProviders = useMemo(
    () => providers.filter((p) => p.source === 'mcp'),
    [providers],
  );

  const apiProviders = useMemo(
    () => providers.filter((p) => p.source === 'api'),
    [providers],
  );

  // Nothing to show if no providers at all
  if (providers.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <label className="text-xs text-muted-foreground whitespace-nowrap">AI:</label>
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        className="flex-1 text-xs bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary min-w-0 truncate"
      >
        {mcpProviders.length > 0 && (
          <optgroup label="MCP Servers">
            {mcpProviders.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.isAvailable}>
                {p.nameJa}{p.isAvailable ? '' : ' (未接続)'}
              </option>
            ))}
          </optgroup>
        )}
        {apiProviders.length > 0 && (
          <optgroup label="API Providers">
            {apiProviders.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.isAvailable}>
                {p.nameJa}{p.model ? ` (${p.model})` : ''}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}

export default ProviderSelector;
