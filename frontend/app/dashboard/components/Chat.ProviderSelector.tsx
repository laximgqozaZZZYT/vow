/**
 * Chat.ProviderSelector - AI Provider Selection Component
 *
 * Displays a row of pill buttons for switching between available AI providers
 * (MCP servers and API providers like OpenAI). Hidden when only one provider
 * is available.
 *
 * @module components/Chat.ProviderSelector
 */

'use client';

import React from 'react';
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
// Source badge labels
// =============================================================================

const SOURCE_LABELS: Record<string, { badge: string; badgeJa: string }> = {
  mcp: { badge: 'MCP', badgeJa: 'MCP' },
  api: { badge: 'API', badgeJa: 'API' },
};

// =============================================================================
// Component
// =============================================================================

export function ProviderSelector({
  providers,
  selectedId,
  onSelect,
}: ProviderSelectorProps) {
  // Only render when multiple providers are available
  if (providers.length <= 1) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border">
      <span className="text-xs text-muted-foreground mr-1">AI:</span>
      {providers.map((p) => {
        const isSelected = p.id === selectedId;
        const sourceLabel = SOURCE_LABELS[p.source] ?? {
          badge: p.source,
          badgeJa: p.source,
        };

        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            disabled={!p.isAvailable}
            className={`
              px-2 py-0.5 rounded text-xs transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed
              ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 hover:bg-muted text-foreground'
              }
            `}
            title={
              p.isAvailable
                ? p.name
                : `${p.name} (unavailable)`
            }
          >
            <span className="opacity-60 mr-0.5">[{sourceLabel.badge}]</span>
            {p.nameJa}
            {p.model && (
              <span className="ml-1 opacity-60">{p.model}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default ProviderSelector;
