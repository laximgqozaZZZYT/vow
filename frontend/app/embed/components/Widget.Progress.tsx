'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  WidgetApiClient,
  WidgetApiClientError,
  type DailyProgressData,
  type DailyProgressItem,
} from '../lib/widgetApi';

/**
 * Widget.Progress - Daily progress display with completion buttons
 *
 * Displays daily habit progress with interactive completion buttons.
 * Supports light/dark themes using CSS variables.
 *
 * Requirements: 6.4, 8.1, 8.2, 8.3, 8.4
 */

interface WidgetProgressProps {
  apiKey: string;
  theme: 'light' | 'dark';
}

interface ProgressItemProps {
  item: DailyProgressItem;
  onComplete: (habitId: string, amount: number) => Promise<void>;
  isLoading: boolean;
}

function ProgressItem({ item, onComplete, isLoading }: ProgressItemProps) {
  const [amount, setAmount] = useState<string>(String(item.workloadPerCount || 1));
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

  const progressPercent = Math.min(100, Math.round(item.progressRate * 100));
  const isCompleted = item.completed || progressPercent >= 100;

  return (
    <div
      className="widget-progress-item"
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
          backgroundColor: isCompleted
            ? 'hsl(var(--color-success))'
            : 'hsl(var(--color-primary))',
          color: isCompleted
            ? 'hsl(var(--color-success-foreground))'
            : 'hsl(var(--color-primary-foreground))',
          cursor: isCompleting || isLoading ? 'not-allowed' : 'pointer',
          opacity: isCompleting || isLoading ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: 'bold',
          transition: 'opacity 0.2s, background-color 0.2s',
        }}
        title={isCompleted ? 'Completed' : 'Complete'}
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
            color: isCompleted
              ? 'hsl(var(--color-muted-foreground))'
              : 'hsl(var(--color-foreground))',
            textDecoration: isCompleted ? 'line-through' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.habitName}
        </div>
        <div
          style={{
            fontSize: '12px',
            color: 'hsl(var(--color-muted-foreground))',
            marginTop: '2px',
          }}
        >
          {item.currentCount}/{item.totalCount} {item.workloadUnit || 'units'}
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          width: '60px',
          height: '8px',
          borderRadius: '4px',
          backgroundColor: 'hsl(var(--color-muted))',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            backgroundColor: isCompleted
              ? 'hsl(var(--color-success))'
              : 'hsl(var(--color-primary))',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Progress percentage */}
      <div
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: isCompleted
            ? 'hsl(var(--color-success))'
            : 'hsl(var(--color-foreground))',
          minWidth: '40px',
          textAlign: 'right',
        }}
      >
        {progressPercent}%
      </div>
    </div>
  );
}

export default function WidgetProgress({ apiKey, theme }: WidgetProgressProps) {
  const [data, setData] = useState<DailyProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = new WidgetApiClient({ apiKey });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const progressData = await client.getProgress();
      setData(progressData);
    } catch (err) {
      if (err instanceof WidgetApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load progress data');
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
      const updatedData = await client.completeHabit(habitId, amount);
      setData(updatedData);
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
            Daily Progress
          </h2>
          <div
            style={{
              fontSize: '12px',
              color: 'hsl(var(--color-muted-foreground))',
              marginTop: '4px',
            }}
          >
            {data.dateDisplay}
          </div>
        </div>
        <div
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color:
              data.completionRate >= 1
                ? 'hsl(var(--color-success))'
                : 'hsl(var(--color-primary))',
          }}
        >
          {Math.round(data.completionRate * 100)}%
        </div>
      </div>

      {/* Summary */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '16px',
          padding: '12px',
          borderRadius: '8px',
          backgroundColor: 'hsl(var(--color-muted) / 0.5)',
        }}
      >
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: 'hsl(var(--color-success))',
            }}
          >
            {data.completedHabits}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: 'hsl(var(--color-muted-foreground))',
            }}
          >
            Completed
          </div>
        </div>
        <div
          style={{
            width: '1px',
            backgroundColor: 'hsl(var(--color-border))',
          }}
        />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: 'hsl(var(--color-foreground))',
            }}
          >
            {data.totalHabits}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: 'hsl(var(--color-muted-foreground))',
            }}
          >
            Total
          </div>
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
            No habits for today
          </div>
        ) : (
          data.habits.map((habit) => (
            <ProgressItem
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
