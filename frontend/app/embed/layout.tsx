import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VOW Widget",
  description: "Embeddable VOW dashboard widget",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Embed Layout - Minimal layout for iframe embedding
 * 
 * Features:
 * - No navigation or header
 * - Transparent background by default
 * - Support for light/dark theme via query parameter
 * - X-Frame-Options header to allow embedding
 * - CSS variables for theming
 * 
 * Requirements: 6.4, 7.3, 8.1, 8.2, 8.3
 */
export default async function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Note: X-Frame-Options is set via Next.js headers config or middleware
  // This layout provides the minimal structure for embedded widgets
  
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        {/* Minimal head for embed context */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Prevent search engine indexing of embed pages */}
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body
        className={`${geistSans.variable} antialiased embed-body`}
        style={{
          // Transparent background by default (Requirement 8.2)
          background: "transparent",
          margin: 0,
          padding: 0,
          minHeight: "100%",
          // Use CSS variables for theming (Requirement 8.1)
          fontFamily: "var(--font-geist-sans, system-ui, sans-serif)",
        }}
      >
        {/* 
          Theme wrapper - applies theme class based on query parameter
          The actual theme detection happens in the page components
          which read the 'theme' query parameter
        */}
        <div 
          id="embed-root"
          className="embed-container"
          style={{
            width: "100%",
            height: "100%",
            minHeight: "inherit",
          }}
        >
          {children}
        </div>
        
        {/* Inline styles for embed-specific theming */}
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Embed-specific styles */
            .embed-body {
              background: transparent !important;
            }
            
            .embed-container {
              /* Responsive container (Requirement 8.3) */
              width: 100%;
              height: 100%;
            }
            
            /* Light theme (default) */
            .embed-theme-light {
              --color-background: 0 0% 100%;
              --color-foreground: 240 10% 3.9%;
              --color-card: 0 0% 100%;
              --color-card-foreground: 240 10% 3.9%;
              --color-muted: 240 4.8% 95.9%;
              --color-muted-foreground: 240 3.8% 46.1%;
              --color-border: 240 5.9% 90%;
              --color-input: 240 5.9% 90%;
              --color-primary: 240 5.9% 10%;
              --color-primary-foreground: 0 0% 98%;
              --color-secondary: 240 4.8% 95.9%;
              --color-secondary-foreground: 240 5.9% 10%;
              --color-accent: 240 4.8% 95.9%;
              --color-accent-foreground: 240 5.9% 10%;
              --color-destructive: 0 84.2% 60.2%;
              --color-destructive-foreground: 0 0% 98%;
              --color-success: 142 76% 36%;
              --color-success-foreground: 0 0% 98%;
              --color-warning: 38 92% 50%;
              --color-warning-foreground: 0 0% 98%;
            }
            
            /* Dark theme */
            .embed-theme-dark {
              --color-background: 240 10% 3.9%;
              --color-foreground: 0 0% 93%;
              --color-card: 240 8% 6%;
              --color-card-foreground: 0 0% 93%;
              --color-muted: 240 3.7% 15.9%;
              --color-muted-foreground: 240 5% 64.9%;
              --color-border: 240 3.7% 15.9%;
              --color-input: 240 3.7% 15.9%;
              --color-primary: 0 0% 98%;
              --color-primary-foreground: 240 5.9% 10%;
              --color-secondary: 240 3.7% 15.9%;
              --color-secondary-foreground: 0 0% 98%;
              --color-accent: 240 3.7% 15.9%;
              --color-accent-foreground: 0 0% 98%;
              --color-destructive: 0 62.8% 30.6%;
              --color-destructive-foreground: 0 0% 98%;
              --color-success: 142 70% 45%;
              --color-success-foreground: 0 0% 98%;
              --color-warning: 38 92% 50%;
              --color-warning-foreground: 0 0% 98%;
            }
            
            /* Apply theme colors to text and backgrounds */
            .embed-theme-light,
            .embed-theme-dark {
              color: hsl(var(--color-foreground));
            }
            
            /* Ensure focus styles work in embed context */
            .embed-container :focus-visible {
              outline: 2px solid hsl(var(--color-primary));
              outline-offset: 2px;
            }
            
            /* Touch target minimum size for accessibility */
            .embed-container button,
            .embed-container a[role="button"],
            .embed-container [role="button"] {
              min-height: 44px;
              min-width: 44px;
            }
            
            /* Respect reduced motion preference */
            @media (prefers-reduced-motion: reduce) {
              .embed-container * {
                animation-duration: 0.001ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.001ms !important;
              }
            }
          `
        }} />
      </body>
    </html>
  );
}
