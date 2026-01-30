# Design Document

## Overview

This design document outlines a **visual-only redesign** of the existing TODO/habit tracking application, inspired by shadcn/ui and Linear.app aesthetics. 

**Critical Constraint**: This is purely a styling update. All existing functionality, component behavior, data flows, and user interactions remain completely unchanged. We are only updating:
- CSS styling (colors, typography, spacing, borders, shadows)
- Tailwind class names on existing elements
- Visual appearance of existing components
- Hover states and transitions

**What we are NOT changing:**
- Component structure or logic
- Event handlers or state management
- Data fetching or API calls
- Routing or navigation behavior
- Modal opening/closing logic
- Form submission behavior

## Architecture

### Styling Approach

The redesign will be implemented through:

1. **Enhanced `globals.css`**: Add CSS custom properties for design tokens
2. **Tailwind Configuration**: Update with custom colors, spacing, and typography
3. **Component Class Updates**: Replace existing Tailwind classes with new design system classes
4. **No New Dependencies**: Use existing Tailwind CSS v4 and React 19

### Files to Modify

- `frontend/app/globals.css` - Add design tokens
- `frontend/tailwind.config.js` - Configure design system (if file exists, otherwise use CSS @theme)
- `frontend/app/dashboard/components/*.tsx` - Update className props
- `frontend/app/components/*.tsx` - Update className props


## Components and Interfaces

### 1. Design Tokens (CSS Variables in globals.css)

Add these CSS custom properties to `frontend/app/globals.css`:

```css
@layer base {
  :root {
    /* Spacing Scale (8px increments) */
    --spacing-1: 0.25rem;  /* 4px */
    --spacing-2: 0.5rem;   /* 8px */
    --spacing-3: 0.75rem;  /* 12px */
    --spacing-4: 1rem;     /* 16px */
    --spacing-6: 1.5rem;   /* 24px */
    --spacing-8: 2rem;     /* 32px */
    --spacing-10: 2.5rem;  /* 40px */
    --spacing-12: 3rem;    /* 48px */
    
    /* Colors - Light Mode (HSL format for Tailwind) */
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --border: 240 5.9% 90%;
    --input-border: 240 5.9% 90%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --success: 142 76% 36%;
    --success-foreground: 0 0% 98%;
    
    /* Border Radius */
    --radius-sm: 0.375rem;  /* 6px */
    --radius-md: 0.5rem;    /* 8px */
    --radius-lg: 0.75rem;   /* 12px */
    
    /* Shadows */
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  }

  .dark {
    /* Colors - Dark Mode (Linear-inspired: very dark gray, not pure black) */
    --background: 240 10% 3.9%;
    --foreground: 0 0% 93%;
    --card: 240 8% 6%;
    --card-foreground: 0 0% 93%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --border: 240 3.7% 15.9%;
    --input-border: 240 3.7% 15.9%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --success: 142 70% 45%;
    --success-foreground: 0 0% 98%;
  }
}
```


### 2. Typography Styling

Add typography utilities to `globals.css`:

```css
/* Typography Scale */
.text-display { font-size: 2.25rem; font-weight: 700; line-height: 1.2; }
.text-h1 { font-size: 1.875rem; font-weight: 600; line-height: 1.25; }
.text-h2 { font-size: 1.5rem; font-weight: 600; line-height: 1.3; }
.text-h3 { font-size: 1.25rem; font-weight: 600; line-height: 1.4; }
.text-h4 { font-size: 1.125rem; font-weight: 600; line-height: 1.4; }
.text-body { font-size: 1rem; font-weight: 400; line-height: 1.5; }
.text-small { font-size: 0.875rem; font-weight: 400; line-height: 1.5; }
.text-caption { font-size: 0.75rem; font-weight: 400; line-height: 1.5; }
```

**Application**: Replace existing text size classes in components with these semantic classes.


### 3. Button Styling Patterns

Update button elements with these class patterns (no behavior changes):

**Primary Button:**
```tsx
className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground 
           px-4 py-2 text-sm font-medium transition-colors hover:bg-primary/90 
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary 
           disabled:pointer-events-none disabled:opacity-50"
```

**Secondary Button:**
```tsx
className="inline-flex items-center justify-center rounded-md bg-secondary text-secondary-foreground 
           px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary/80 
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
```

**Outline Button:**
```tsx
className="inline-flex items-center justify-center rounded-md border border-input bg-transparent 
           px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground 
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
```

**Ghost Button:**
```tsx
className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium 
           transition-colors hover:bg-accent hover:text-accent-foreground 
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
```

**Destructive Button:**
```tsx
className="inline-flex items-center justify-center rounded-md bg-destructive text-destructive-foreground 
           px-4 py-2 text-sm font-medium transition-colors hover:bg-destructive/90 
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
```

**Size Variants:**
- Small: `px-3 py-1.5 text-xs`
- Default: `px-4 py-2 text-sm`
- Large: `px-6 py-3 text-base`


### 4. Input Field Styling

Update input elements with these classes:

**Text Input:**
```tsx
className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm 
           placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 
           focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
```

**Textarea:**
```tsx
className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm 
           placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 
           focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
```

**Select/Dropdown:**
```tsx
className="flex h-10 w-full items-center justify-between rounded-md border border-input 
           bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary 
           disabled:cursor-not-allowed disabled:opacity-50"
```

**Label:**
```tsx
className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
```


### 5. Card/Panel Styling

Update card/panel containers with these classes:

**Default Card:**
```tsx
className="rounded-lg border border-border bg-card text-card-foreground shadow-sm"
```

**Card with Padding:**
```tsx
className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-6"
```

**Elevated Card (with hover):**
```tsx
className="rounded-lg border border-border bg-card text-card-foreground shadow-md 
           transition-shadow hover:shadow-lg"
```

**Card Header:**
```tsx
className="flex flex-col space-y-1.5 p-6"
```

**Card Title:**
```tsx
className="text-2xl font-semibold leading-none tracking-tight"
```

**Card Content:**
```tsx
className="p-6 pt-0"
```


### 6. Modal/Dialog Styling

Update modal components with these classes (keeping existing open/close logic):

**Modal Backdrop:**
```tsx
className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
```

**Modal Container:**
```tsx
className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] 
           w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg"
```

**Modal Header:**
```tsx
className="flex flex-col space-y-1.5 text-center sm:text-left"
```

**Modal Title:**
```tsx
className="text-lg font-semibold leading-none tracking-tight"
```

**Modal Description:**
```tsx
className="text-sm text-muted-foreground"
```

**Modal Footer:**
```tsx
className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2"
```


### 7. Sidebar/Navigation Styling

Update sidebar with these classes:

**Sidebar Container:**
```tsx
className="fixed left-0 top-0 z-40 h-screen w-80 border-r border-border bg-card"
```

**Navigation Item (Inactive):**
```tsx
className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium 
           text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
```

**Navigation Item (Active):**
```tsx
className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium 
           bg-accent text-accent-foreground"
```

**Navigation Section Header:**
```tsx
className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
```


### 8. Dashboard Layout Styling

Update main dashboard layout:

**Main Container:**
```tsx
className="flex min-h-screen bg-background text-foreground"
```

**Content Area:**
```tsx
className="flex-1 p-6 lg:p-8"
```

**Section Spacing:**
```tsx
className="space-y-6"  // Between major sections
className="space-y-4"  // Between related items
className="space-y-2"  // Between tightly related items
```

**Grid Layouts:**
```tsx
className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"  // For cards
className="grid grid-cols-1 gap-4"  // For list items
```


## Data Models

No data model changes are required. This is a visual-only redesign.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Since this is a visual redesign with no behavioral changes, correctness properties focus on visual consistency and accessibility:

**Property 1: Color Contrast Compliance**
*For any* text element displayed on the interface, the contrast ratio between text and background SHALL be at least 4.5:1 for normal text and 3:1 for large text
**Validates: Requirements 4.4, 15.5**

**Property 2: Spacing Consistency**
*For any* spacing value used in the interface, it SHALL be a multiple of 4px (from the spacing scale: 4, 8, 12, 16, 24, 32, 40, 48)
**Validates: Requirements 7.1, 7.2**

**Property 3: Focus Indicator Visibility**
*For any* interactive element, when focused via keyboard navigation, it SHALL display a visible focus ring with at least 2px width
**Validates: Requirements 15.3, 8.3**

**Property 4: Dark Mode Color Consistency**
*For any* color variable, when dark mode is active, the color SHALL use the dark mode variant defined in CSS variables
**Validates: Requirements 5.4, 5.5, 5.6**

**Property 5: Button Touch Target Size**
*For any* button element on mobile viewports, the minimum touch target size SHALL be 44x44px
**Validates: Requirements 8.6, 16.3**

**Property 6: Responsive Typography Scaling**
*For any* text element, the font size SHALL scale appropriately across breakpoints without requiring horizontal scrolling
**Validates: Requirements 16.5, 16.6**

**Property 7: Animation Respect for Reduced Motion**
*For any* animated element, when the user has prefers-reduced-motion enabled, animations SHALL be disabled or reduced to minimal duration
**Validates: Requirements 6.7, 15.6**


## Error Handling

Since this is a visual redesign, error handling remains unchanged. However, error states will have updated styling:

**Error Message Styling:**
```tsx
className="text-sm font-medium text-destructive"
```

**Input Error State:**
```tsx
className="... border-destructive focus-visible:ring-destructive"
```

**Error Toast/Notification:**
```tsx
className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive"
```

## Testing Strategy

### Visual Regression Testing

Since this is a styling-only change, testing will focus on visual consistency:

1. **Manual Visual Testing**:
   - Test all components in light and dark modes
   - Verify spacing consistency across all pages
   - Check color contrast ratios using browser dev tools
   - Test responsive behavior at different breakpoints
   - Verify keyboard focus indicators are visible

2. **Accessibility Testing**:
   - Run axe DevTools or similar accessibility checker
   - Test keyboard navigation through all interactive elements
   - Verify ARIA labels and roles remain intact
   - Test with screen reader (NVDA, JAWS, or VoiceOver)
   - Verify color contrast meets WCAG 2.1 AA standards

3. **Cross-Browser Testing**:
   - Test in Chrome, Firefox, Safari, and Edge
   - Verify CSS custom properties work correctly
   - Check Tailwind classes render consistently

4. **Responsive Testing**:
   - Test on mobile (375px, 414px)
   - Test on tablet (768px, 1024px)
   - Test on desktop (1280px, 1920px)
   - Verify touch targets are adequate on mobile

### Testing Checklist

- [ ] All buttons use consistent styling patterns
- [ ] All inputs have proper focus states
- [ ] All modals have proper backdrop and positioning
- [ ] Sidebar navigation has proper hover and active states
- [ ] Cards have consistent padding and borders
- [ ] Typography hierarchy is clear and consistent
- [ ] Spacing follows 8px grid system
- [ ] Dark mode colors are properly applied
- [ ] Color contrast meets WCAG AA standards
- [ ] Focus indicators are visible
- [ ] Touch targets are at least 44x44px on mobile
- [ ] Animations respect prefers-reduced-motion
- [ ] No horizontal scrolling on any viewport size

