# Shared Hooks

This directory contains React hooks that are shared across the application, not specific to the dashboard.

## useScrollReveal

A custom hook for implementing scroll-triggered fade-in animations using the Intersection Observer API.

### Features

- ✅ Detects when elements enter the viewport
- ✅ Configurable threshold and root margin
- ✅ Optional trigger-once behavior
- ✅ Automatically respects `prefers-reduced-motion`
- ✅ Skips animation for initially visible elements
- ✅ Server-side rendering safe

### Usage

```tsx
import { useScrollReveal } from '@/app/hooks/useScrollReveal';

function MyComponent() {
  const { ref, isVisible } = useScrollReveal({
    threshold: 0.2,
    rootMargin: '0px 0px -100px 0px',
    triggerOnce: true
  });

  return (
    <section
      ref={ref}
      className={`
        transition-all duration-500 ease-out
        ${isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-8'
        }
      `}
    >
      <h2>This content fades in when scrolled into view</h2>
      <p>Smooth and accessible animations!</p>
    </section>
  );
}
```

### Options

- `threshold` (number, default: 0.1): Percentage of element visibility required to trigger (0.0 to 1.0)
- `rootMargin` (string, default: '0px 0px -100px 0px'): Margin around the root for intersection calculation
- `triggerOnce` (boolean, default: true): Whether animation triggers only once or every time element enters viewport

### Accessibility

The hook automatically respects the user's `prefers-reduced-motion` setting. When reduced motion is preferred, `isVisible` is immediately set to `true`, skipping all animations.
