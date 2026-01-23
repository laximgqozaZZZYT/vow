'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  WidgetApiClient,
  WidgetApiClientError,
  type StatisticsData,
  type Top3Habit,
} from '../lib/widgetApi';

/**
 * Widget.Stats - Statistics summary display
 *
 * Displays statistics summary including achievement rates and top habits.
 * Supports light/dark themes using CSS variables.
 *
 * Requirements: 6.4, 8.1, 8.2, 8.3, 8.4
 */

interface WidgetStatsProps {
  apiKey: string;
  theme: 'light' | 'dark';
}

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
}

function StatCard({ label, value, subValue, color }: StatCardProps) {
  return (
    <div
      style={{
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: 'hsl(var(--color-muted) / 0.3)',
        border: '1px solid hsl(var(--color-border))',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color: 'hsl(var(--color-muted-foreground))',
          marginBottom: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '24px',
          fontWeight: 700,
          color: color || 'hsl(var(--color-foreground))',
        }}
      >
        {value}
      </div>
      {subValue && (
        <div
          style={{
            fontSize: '11px',
            color: 'hsl(var(--color-muted-foreground))',
            marginTop: '2px',
          }}
        >
          {subValue}
        </div>
      )}
    </div>
  );
}

interface Top3ItemProps {
  habit: Top3Habit;
  rank: number;
}

function Top3Item({ habit, rank }: Top3ItemProps) {
  const progressPercent = Math.round(habit.progressRate * 100);
  const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32']; // Gold, Silver, Bronze

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        borderRadius: '8px',
        backgroundColor: 'hsl(var(--color-muted) / 0.2)',
      }}
    >
      {/* Rank badge */}
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: rankColors[rank - 1] || 'hsl(var(--color-muted))',
          color: rank <= 2 ? '#000' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {rank}
      </div>

      {/* Habit name */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: '14px',
          color: 'hsl(var(--color-foreground))',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {habit.habitName}
      </div>

      {/* Progress */}
      <div
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color:
            progressPercent >= 100
              ? 'hsl(var(--color-success))'
              : 'hsl(var(--color-primary))',
        }}
      >
        {progressPercent}%
      </div>
    </div>
  );
}

export default function WidgetStats({ apiKey, theme }: WidgetStatsProps) {
  const [data, setData] = useState<StatisticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const client = new WidgetApiClient({ apiKey });
    try {
      setIsLoading(true);
      setError(null);
      const statsData = await client.getStats();
      setData(statsData);
    } catch (err) {
      if (err instanceof WidgetApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load statistics');
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const todayRate = Math.round(data.todayAchievementRate * 100);
  const cumulativeRate = Math.round(data.cumulativeAchievementRate * 100);

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
      <div style={{ marginBottom: '16px' }}>
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'hsl(var(--color-foreground))',
            margin: 0,
          }}
        >
          Statistics
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

      {/* Stats grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <StatCard
          label="Active Habits"
          value={data.totalActiveHabits}
        />
        <StatCard
          label="Today's Rate"
          value={`${todayRate}%`}
          subValue={`${data.todayAchieved}/${data.todayTotal}`}
          color={
            todayRate >= 80
              ? 'hsl(var(--color-success))'
              : todayRate >= 50
              ? 'hsl(var(--color-warning))'
              : 'hsl(var(--color-destructive))'
          }
        />
        <StatCard
          label="Cumulative Rate"
          value={`${cumulativeRate}%`}
          subValue={`${data.cumulativeAchieved}/${data.cumulativeTotal}`}
          color={
            cumulativeRate >= 80
              ? 'hsl(var(--color-success))'
              : cumulativeRate >= 50
              ? 'hsl(var(--color-warning))'
              : 'hsl(var(--color-destructive))'
          }
        />
        <StatCard
          label="Today Achieved"
          value={data.todayAchieved}
          subValue={`of ${data.todayTotal} habits`}
          color="hsl(var(--color-success))"
        />
      </div>

      {/* Top 3 Habits */}
      {data.top3Habits.length > 0 && (
        <div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'hsl(var(--color-foreground))',
              marginBottom: '12px',
            }}
          >
            Top Performing Habits
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.top3Habits.map((habit, index) => (
              <Top3Item key={habit.habitId} habit={habit} rank={index + 1} />
            ))}
          </div>
        </div>
      )}

      {data.top3Habits.length === 0 && (
        <div
          style={{
            padding: '16px',
            textAlign: 'center',
            color: 'hsl(var(--color-muted-foreground))',
            fontSize: '14px',
          }}
        >
          No habit data available yet
        </div>
      )}
    </div>
  );
}
