'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  WidgetApiClient,
  WidgetApiClientError,
  type NextHabitsData,
  type NextHabitItem,
} from '../lib/widgetApi';

/**
 * Widget.Next - Next habits list with completion buttons
 *
 * Displays upcoming habits within the next 24 hours with interactive completion buttons.
 * Supports light/dark themes using CSS variables.
 *
 * Requirements: 6.4, 8.1, 8.2, 8.3, 8.4
 */

interface WidgetNextProps {
  apiKey: string;
  theme: 'light' | 'dark';
}

interface NextItemProps {
  item: NextHabitItem;
  onComplete: (habitId: string, amount: number) => Promise<void>;
  isLoading: boolean;
}

function NextItem({ item, onComplete, isLoading }: NextItemProps) {
  const [amount, setAmount] = useState<string>(String(item.targetAmount || 1));
  const [isCompleting, setIsCompleting] = useState(false);

  const handleComplete = async () => {
    if (isCompleting || isLoading) return;
    setIsCompleting(true);
    try {
      const numAmount = parseFloat(amount) || 1;
      await onComplete(item.habitId, numAmount);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: 'hsl(var(--color-muted) / 0.3)',
        border: '1px solid hsl(var(--color-border))',
      }}
    >
      {/* Complete button */}
      <button
        onClick={handleComplete}
        disabled={isCompleting || isLoading}
        style={{
          width: '36px',
          height: '36px',
          minWidth: '44px',
          minHeight: '44px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: 'hsl(var(--color-success))',
          color: 'hsl(var(--color-success-foreground))',
          cursor: isCompleting || isLoading ? 'not-allowed' : 'pointer',
          opacity: isCompleting || isLoading ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: 'bold',
          transition: 'opacity 0.2s, background-color 0.2s',
        }}
        title="Complete"
      >
        {isCompleting ? '...' : '✓'}
      </button>

      {/* Amount input */}
      <input
        type="number"
        min="0"
        step="0.1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        disabled={isLoading}
        style={{
          width: '48px',
          padding: '6px 8px',
          borderRadius: '6px',
          border: '1px solid hsl(var(--color-border))',
          backgroundColor: 'hsl(var(--color-input))',
          color: 'hsl(var(--color-foreground))',
          fontSize: '12px',
          textAlign: 'center',
        }}
      />

      {/* Habit info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'hsl(var(--color-foreground))',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.habitName}
        </div>
        {item.workloadUnit && (
          <div
            style={{
              fontSize: '12px',
              color: 'hsl(var(--color-muted-foreground))',
              marginTop: '2px',
            }}
          >
            Target: {item.targetAmount} {item.workloadUnit}
          </div>
        )}
      </div>

      {/* Time indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'hsl(var(--color-primary))',
          }}
        />
        <div
          style={{
            fontSize: '12px',
            color: 'hsl(var(--color-muted-foreground))',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {item.startTimeDisplay}
        </div>
      </div>
    </div>
  );
}

export default function WidgetNext({ apiKey, theme }: WidgetNextProps) {
  const [data, setData] = useState<NextHabitsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = new WidgetApiClient({ apiKey });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const nextData = await client.getNextHabits();
      setData(nextData);
    } catch (err) {
      if (err instanceof WidgetApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load next habits');
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleComplete = async (habitId: string, amount: number) => {
    try {
      // Complete the habit and refresh the list
      await client.completeHabit(habitId, amount);
      // Refresh the next habits list
      await fetchData();
    } catch (err) {
      if (err instanceof WidgetApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to complete habit');
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
            Next Habits
          </h2>
          <div
            style={{
              fontSize: '12px',
              color: 'hsl(var(--color-muted-foreground))',
              marginTop: '4px',
            }}
          >
            Upcoming in 24 hours
          </div>
        </div>
        <div
          style={{
            padding: '4px 12px',
            borderRadius: '16px',
            backgroundColor: 'hsl(var(--color-primary) / 0.1)',
            color: 'hsl(var(--color-primary))',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          {data.count} habits
        </div>
      </div>

      {/* Habits list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {data.habits.length === 0 ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              color: 'hsl(var(--color-muted-foreground))',
              fontSize: '14px',
            }}
          >
            No habits starting in the next 24 hours
          </div>
        ) : (
          data.habits.map((habit) => (
            <NextItem
              key={habit.habitId}
              item={habit}
              onComplete={handleComplete}
              isLoading={isLoading}
            />
          ))
        )}
      </div>
    </div>
  );
}
