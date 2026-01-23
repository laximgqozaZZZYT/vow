'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import WidgetProgress from '../components/Widget.Progress';

/**
 * Embed Progress Page - Daily progress widget for iframe embedding
 *
 * Query Parameters:
 * - apiKey (required): API key for authentication
 * - theme (optional): 'light' or 'dark' (default: 'light')
 *
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */

function ProgressPageContent() {
  const searchParams = useSearchParams();
  const apiKey = searchParams.get('apiKey');
  const theme = (searchParams.get('theme') as 'light' | 'dark') || 'light';

  // Validate theme parameter
  const validTheme = theme === 'dark' ? 'dark' : 'light';
  const themeClass = validTheme === 'dark' ? 'embed-theme-dark' : 'embed-theme-light';

  // Display error for missing API key (Requirement 6.3)
  if (!apiKey) {
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
        <div style={{ fontWeight: 600, marginBottom: '4px' }}>Authentication Error</div>
        <div>API key is required. Please provide a valid apiKey query parameter.</div>
      </div>
    );
  }

  // Render widget with valid API key (Requirement 6.2)
  return <WidgetProgress apiKey={apiKey} theme={validTheme} />;
}

export default function ProgressPage() {
  return (
    <Suspense
      fallback={
        <div
          className="embed-theme-light"
          style={{
            padding: '24px',
            textAlign: 'center',
            color: 'hsl(var(--color-muted-foreground))',
          }}
        >
          Loading...
        </div>
      }
    >
      <ProgressPageContent />
    </Suspense>
  );
}
