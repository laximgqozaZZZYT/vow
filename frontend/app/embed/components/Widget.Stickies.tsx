'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  WidgetApiClient,
  WidgetApiClientError,
  type StickiesData,
  type StickyItem,
} from '../lib/widgetApi';

/**
 * Widget.Stickies - Stickies list with toggle buttons
 *
 * Displays stickies with interactive toggle buttons for completion status.
 * Supports light/dark themes using CSS variables.
 *
 * Requirements: 6.4, 8.1, 8.2, 8.3, 8.4
 */

interface WidgetStickiesProps {
  apiKey: string;
  theme: 'light' | 'dark';
}

interface StickyItemComponentProps {
  item: StickyItem;
  onToggle: (stickyId: string) => Promise<void>;
  isLoading: boolean;
}

function StickyItemComponent({ item, onToggle, isLoading }: StickyItemComponentProps) {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    if (isToggling || isLoading) return;
    setIsToggling(true);
    try {
      await onToggle(item.id);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: item.completed
          ? 'hsl(var(--color-muted) / 0.2)'
          : 'hsl(var(--color-warning) / 0.1)',
        border: `1px solid ${
          item.completed
            ? 'hsl(var(--color-border))'
            : 'hsl(var(--color-warning) / 0.3)'
        }`,
        opacity: item.completed ? 0.7 : 1,
        transition: 'opacity 0.2s, background-color 0.2s',
      }}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        disabled={isToggling || isLoading}
        style={{
          width: '24px',
          height: '24px',
          minWidth: '44px',
          minHeight: '44px',
          borderRadius: '6px',
          border: `2px solid ${
            item.completed
              ? 'hsl(var(--color-success))'
              : 'hsl(var(--color-border))'
          }`,
          backgroundColor: item.completed
            ? 'hsl(var(--color-success))'
            : 'transparent',
          color: item.completed
            ? 'hsl(var(--color-success-foreground))'
            : 'transparent',
          cursor: isToggling || isLoading ? 'not-allowed' : 'pointer',
          opacity: isToggling || isLoading ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 'bold',
          transition: 'all 0.2s',
          flexShrink: 0,
        }}
        title={item.completed ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {isToggling ? '...' : item.completed ? '✓' : ''}
      </button>

      {/* Sticky content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: item.completed
              ? 'hsl(var(--color-muted-foreground))'
              : 'hsl(var(--color-foreground))',
            textDecoration: item.completed ? 'line-through' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.name || 'Unnamed Sticky'}
        </div>
        {item.description && (
          <div
            style={{
              fontSize: '12px',
              color: 'hsl(var(--color-muted-foreground))',
              marginTop: '4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {item.description}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WidgetStickies({ apiKey, theme }: WidgetStickiesProps) {
  const [data, setData] = useState<StickiesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = new WidgetApiClient({ apiKey });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const stickiesData = await client.getStickies();
      setData(stickiesData);
    } catch (err) {
      if (err instanceof WidgetApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load stickies');
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = async (stickyId: string) => {
    try {
      const result = await client.toggleSticky(stickyId);
      // Update the local state with the toggled sticky
      setData((prevData) => {
        if (!prevData) return prevData;
        const updatedStickies = prevData.stickies.map((sticky) =>
          sticky.id === stickyId
            ? { ...sticky, completed: result.completed }
            : sticky
        );
        const incompleteCount = updatedStickies.filter((s) => !s.completed).length;
        const completedCount = updatedStickies.filter((s) => s.completed).length;
        return {
          ...prevData,
          stickies: updatedStickies,
          incompleteCount,
          completedCount,
        };
      });
    } catch (err) {
      if (err instanceof WidgetApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to toggle sticky');
      }
    }
  };

  const themeClass = theme === 'dark' ? 'embed-theme-dark' : 'embed-theme-light';

  if (error) {
    return (
      <div
        className={themeClass}
        style={{
          padding: '16px',
          borderRadius: '12px',
          backgroundColor: 'hsl(var(--color-destructive) / 0.1)',
          border: '1px solid hsl(var(--color-destructive) / 0.3)',
          color: 'hsl(var(--color-destructive))',
          fontSize: '14px',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '4px' }}>Error</div>
        <div>{error}</div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div
        className={themeClass}
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'hsl(var(--color-muted-foreground))',
        }}
      >
        Loading...
      </div>
    );
  }

  // Sort stickies: incomplete first, then by displayOrder
  const sortedStickies = [...data.stickies].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return a.displayOrder - b.displayOrder;
  });

  const incompleteStickies = sortedStickies.filter((s) => !s.completed);
  const completedStickies = sortedStickies.filter((s) => s.completed);

  return (
    <div
      className={themeClass}
      style={{
        padding: '16px',
        borderRadius: '12px',
        backgroundColor: 'hsl(var(--color-card))',
        border: '1px solid hsl(var(--color-border))',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'hsl(var(--color-foreground))',
              margin: 0,
            }}
          >
            Sticky&apos;n
          </h2>
          <div
            style={{
              fontSize: '12px',
              color: 'hsl(var(--color-muted-foreground))',
              marginTop: '4px',
            }}
          >
            Quick tasks and reminders
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div
            style={{
              padding: '4px 10px',
              borderRadius: '16px',
              backgroundColor: 'hsl(var(--color-warning) / 0.1)',
              color: 'hsl(var(--color-warning))',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            {data.incompleteCount} pending
          </div>
          <div
            style={{
              padding: '4px 10px',
              borderRadius: '16px',
              backgroundColor: 'hsl(var(--color-success) / 0.1)',
              color: 'hsl(var(--color-success))',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            {data.completedCount} done
          </div>
        </div>
      </div>

      {/* Stickies list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sortedStickies.length === 0 ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              color: 'hsl(var(--color-muted-foreground))',
              fontSize: '14px',
            }}
          >
            No stickies yet
          </div>
        ) : (
          <>
            {/* Incomplete stickies */}
            {incompleteStickies.map((sticky) => (
              <StickyItemComponent
                key={sticky.id}
                item={sticky}
                onToggle={handleToggle}
                isLoading={isLoading}
              />
            ))}

            {/* Completed stickies section */}
            {completedStickies.length > 0 && incompleteStickies.length > 0 && (
              <div
                style={{
                  marginTop: '8px',
                  paddingTop: '12px',
                  borderTop: '1px solid hsl(var(--color-border))',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: 'hsl(var(--color-muted-foreground))',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Completed
                </div>
              </div>
            )}

            {completedStickies.map((sticky) => (
              <StickyItemComponent
                key={sticky.id}
                item={sticky}
                onToggle={handleToggle}
                isLoading={isLoading}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
