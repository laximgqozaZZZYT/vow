# Design Document

## Overview

This design document outlines the architecture and implementation approach for creating a high-conversion landing page for the VOW TODO application. The landing page will transform the existing homepage into a persuasive marketing page that effectively communicates the app's value proposition while maintaining design consistency with the dashboard.

The design follows modern web best practices including progressive enhancement, responsive design, accessibility compliance, and performance optimization. The page will feature scroll-triggered animations, compelling copy, visual proof elements, and strategically placed CTAs to maximize user conversion.

## Architecture

### Component Structure

The landing page will be implemented as a Next.js page component with the following structure:

```
frontend/app/page.tsx (Enhanced)
├── HeroSection
│   ├── Logo & Branding
│   ├── Headline & Subheadline
│   └── Primary CTA
├── FeaturesSection
│   ├── Feature Card (爆速動作)
│   ├── Feature Card (業界標準のUI)
│   └── Feature Card (完全無料)
├── SocialProofSection
│   ├── Dashboard Preview Image
│   └── Trust Indicators
├── SecondaryCTASection
│   ├── Call-to-Action Copy
│   └── CTA Buttons (Login + Guest)
└── Footer
```

### Technology Stack

- **Framework**: Next.js 14+ with App Router
- **Styling**: Tailwind CSS with existing design system tokens
- **Animations**: Intersection Observer API + CSS transitions
- **Images**: Next.js Image component with WebP optimization
- **SEO**: Next.js metadata API with existing seo.metadata.ts utilities


## Components and Interfaces

### 1. HeroSection Component

**Purpose**: Capture attention immediately and communicate the core value proposition.

**Structure**:
```typescript
interface HeroSectionProps {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaHref: string;
}
```

**Visual Design**:
- Full viewport height on desktop, auto on mobile
- Gradient background: `bg-gradient-to-b from-white via-zinc-50 to-zinc-100`
- Dark mode: `dark:from-black dark:via-zinc-900 dark:to-zinc-900`
- Logo + app name positioned top-left
- Headline: 4xl font size, bold weight, tight leading
- Subheadline: lg font size, muted color
- Primary CTA: Large rounded button with hover states

**Copy**:
- Headline: "AIと共に歩む、最もシンプルなタスク管理"
- Subheadline: "習慣を身につけ、目標を達成し、人生を前進させる。今すぐ無料で始めましょう。"
- CTA: "今すぐ始める"

### 2. FeaturesSection Component

**Purpose**: Highlight the three core competitive advantages.

**Structure**:
```typescript
interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface FeaturesSectionProps {
  features: Feature[];
}
```

**Features Data**:
1. **爆速動作** (Lightning-fast Performance)
   - Icon: Zap/Lightning bolt
   - Description: "ミリ秒単位で応答。待ち時間なし。ローカルファーストのアーキテクチャで瞬時に反応します。"

2. **業界標準のUI** (Industry-standard UI)
   - Icon: Layout/Grid
   - Description: "直感的で美しいインターフェース。Linearに触発されたデザインで、学習コストゼロ。"

3. **完全無料** (Completely Free)
   - Icon: Gift/Heart
   - Description: "隠れた料金なし。広告なし。永久に無料。あなたのデータはあなたのもの。"

**Visual Design**:
- Grid layout: 3 columns on desktop, 1 column on mobile
- Each feature card: white background with subtle shadow
- Icon: 48x48px, primary color
- Title: text-h3 size, semibold
- Description: text-body size, muted color
- Consistent spacing: gap-6 between cards


### 3. SocialProofSection Component

**Purpose**: Build trust through visual evidence of the app's interface.

**Structure**:
```typescript
interface SocialProofSectionProps {
  previewImage: string;
  previewAlt: string;
  testimonialText?: string;
}
```

**Visual Design**:
- Container: max-width-5xl, centered
- Preview image: Dashboard screenshot showing calendar, habits, and goals
- Image treatment: Subtle shadow, rounded corners (radius-xl)
- Aspect ratio: 16:9 for consistency
- Lazy loading: Below the fold optimization
- Placeholder: Gradient background with "Dashboard Preview" text

**Content**:
- Image: Screenshot of the dashboard with sample data
- Caption: "シンプルで直感的なダッシュボード - すべてが一目で分かります"
- Optional: User count or usage statistics if available

### 4. SecondaryCTASection Component

**Purpose**: Provide a final conversion opportunity for users who scrolled through the page.

**Structure**:
```typescript
interface SecondaryCTASectionProps {
  headline: string;
  ctaPrimaryText: string;
  ctaPrimaryHref: string;
  ctaSecondaryText: string;
  ctaSecondaryHref: string;
}
```

**Visual Design**:
- Full-width section with accent background color
- Centered content with max-width-3xl
- Headline: text-h2 size, centered
- Button group: Horizontal on desktop, stacked on mobile
- Primary button: Solid background, high contrast
- Secondary button: Outline style, lower emphasis

**Copy**:
- Headline: "準備はできましたか？今すぐ始めましょう。"
- Primary CTA: "ログイン"
- Secondary CTA: "ゲストとして続行"

### 5. ScrollReveal Hook

**Purpose**: Implement scroll-triggered fade-in animations.

**Interface**:
```typescript
interface UseScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

function useScrollReveal(options?: UseScrollRevealOptions): {
  ref: React.RefObject<HTMLElement>;
  isVisible: boolean;
}
```

**Implementation**:
- Uses Intersection Observer API
- Default threshold: 0.1 (10% visible)
- Default rootMargin: "0px 0px -100px 0px"
- Triggers once by default (no re-animation on scroll up)
- Respects prefers-reduced-motion media query


## Data Models

### Feature Model

```typescript
interface Feature {
  id: string;
  icon: IconType;
  title: string;
  description: string;
  order: number;
}
```

### CTAButton Model

```typescript
interface CTAButton {
  text: string;
  href: string;
  variant: 'primary' | 'secondary' | 'outline';
  size: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
}
```

### AnimationConfig Model

```typescript
interface AnimationConfig {
  duration: number; // milliseconds
  delay: number; // milliseconds
  easing: string; // CSS easing function
  translateY: number; // pixels
  respectReducedMotion: boolean;
}
```

### PageSection Model

```typescript
interface PageSection {
  id: string;
  component: React.ComponentType;
  animationConfig?: AnimationConfig;
  backgroundColor?: string;
  padding?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Hero Section Viewport Visibility

*For any* viewport size (mobile, tablet, desktop), the hero section should be fully visible without requiring the user to scroll.

**Validates: Requirements 1.5**

### Property 2: CTA Navigation Consistency

*For any* CTA button on the landing page (primary, secondary, hero, footer), clicking the button should navigate to the correct destination (login page for "ログイン", dashboard for "ゲストとして続行").

**Validates: Requirements 1.4, 4.5**

### Property 3: Feature Icon Presence

*For any* feature item displayed in the features section, the feature should include an icon element that is visible and properly rendered.

**Validates: Requirements 2.2**

### Property 4: Feature Content Completeness

*For any* feature item, the feature should have both a non-empty title and a non-empty description.

**Validates: Requirements 2.3**

### Property 5: Feature Layout Consistency

*For any* pair of feature cards in the features section, the spacing between them should be equal, and their alignment should be consistent.

**Validates: Requirements 2.4**

### Property 6: Image Aspect Ratio Preservation

*For any* viewport size, preview images should maintain their intended aspect ratio without distortion or stretching.

**Validates: Requirements 3.4**

### Property 7: Design System Token Consistency

*For any* design token (colors, typography, spacing, border radius), the values used on the landing page should match the corresponding values defined in the dashboard's design system.

**Validates: Requirements 5.1, 5.2, 5.3, 5.5**

### Property 8: Theme Support Consistency

*For any* theme mode (light or dark), all page elements should use the appropriate theme-specific color values, and switching themes should update all elements correctly.

**Validates: Requirements 5.4**

### Property 9: Scroll Animation Triggering

*For any* section with scroll-triggered animations, the animation should trigger when the section enters the viewport and should not trigger for sections initially visible on page load.

**Validates: Requirements 6.1, 6.4**

### Property 10: Animation Duration Bounds

*For any* fade-in animation, the animation duration should be between 300ms and 600ms inclusive.

**Validates: Requirements 6.2**

### Property 11: Animation Property Configuration

*For any* animated element, the animation should transition opacity from 0 to 1 and translate vertically by 20-40 pixels.

**Validates: Requirements 6.3**

### Property 12: Reduced Motion Respect

*For any* animated element, when the user has prefers-reduced-motion enabled, animations should either be disabled entirely or have a duration of less than 10ms.

**Validates: Requirements 6.5**

### Property 13: Touch Target Minimum Size

*For any* interactive element (button, link) on mobile viewports (< 640px), the element should have a minimum touch target size of 44x44 pixels.

**Validates: Requirements 7.4**

### Property 14: Line Length Readability

*For any* text container, the maximum line length should be constrained to maintain readability (approximately 45-75 characters or max-width of 65ch).

**Validates: Requirements 7.5**

### Property 15: Image Format Optimization

*For any* image element, the image should use modern formats (WebP) with appropriate fallbacks for older browsers.

**Validates: Requirements 8.2**

### Property 16: Below-Fold Lazy Loading

*For any* image that is positioned below the initial viewport, the image should have the loading="lazy" attribute to defer loading until needed.

**Validates: Requirements 8.3**

### Property 17: Semantic HTML Structure

*For any* major page section, the section should use appropriate semantic HTML elements (header, main, section, article, footer) rather than generic div elements.

**Validates: Requirements 9.1**

### Property 18: Image and Icon Text Alternatives

*For any* image or icon element, the element should have either a non-empty alt attribute, an aria-label, or an aria-labelledby reference.

**Validates: Requirements 9.2, 9.5**

### Property 19: Color Contrast Compliance

*For any* text element, the color contrast ratio between the text and its background should be at least 4.5:1 for normal text or 3:1 for large text (18pt+).

**Validates: Requirements 9.3**

### Property 20: Keyboard Navigation Completeness

*For any* interactive element, the element should be reachable via keyboard navigation (Tab key) and should have a visible focus indicator.

**Validates: Requirements 9.4**

### Property 21: Heading Hierarchy Validity

*For any* sequence of heading elements on the page, the headings should follow proper nesting order without skipping levels (e.g., h1 → h2 → h3, not h1 → h3).

**Validates: Requirements 10.3**


## Error Handling

### Image Loading Failures

**Scenario**: Preview images fail to load due to network issues or missing files.

**Handling**:
- Display a styled placeholder with gradient background
- Show descriptive text: "ダッシュボードプレビュー"
- Log error to console for debugging
- Ensure layout doesn't break (maintain aspect ratio container)

### Animation Performance Issues

**Scenario**: Animations cause performance degradation on low-end devices.

**Handling**:
- Use CSS transforms (GPU-accelerated) instead of position changes
- Implement will-change property sparingly
- Provide fallback to instant display if IntersectionObserver is not supported
- Respect prefers-reduced-motion automatically

### Navigation Failures

**Scenario**: CTA buttons fail to navigate due to routing issues.

**Handling**:
- Use Next.js Link component for client-side navigation
- Provide fallback href for progressive enhancement
- Log navigation errors to error tracking service
- Display user-friendly error message if navigation fails

### Theme Switching Errors

**Scenario**: Theme preference cannot be detected or applied.

**Handling**:
- Default to light theme if preference cannot be determined
- Use system preference as fallback (prefers-color-scheme)
- Ensure all colors have fallback values
- Prevent flash of unstyled content (FOUC)

### Responsive Layout Issues

**Scenario**: Layout breaks at unexpected viewport sizes.

**Handling**:
- Use mobile-first responsive design approach
- Test at standard breakpoints: 640px, 768px, 1024px, 1280px
- Use min-width media queries for progressive enhancement
- Implement container queries where appropriate

## Testing Strategy

### Unit Testing Approach

Unit tests will verify specific examples, edge cases, and component rendering:

**Test Framework**: Jest + React Testing Library

**Test Coverage**:
- Component rendering with different props
- Button click handlers and navigation
- Theme switching functionality
- Responsive class application at breakpoints
- Image fallback rendering
- Accessibility attributes presence

**Example Tests**:
- Hero section renders with correct headline text
- Features section displays exactly 3 feature cards
- CTA buttons have correct href attributes
- Placeholder displays when image src is invalid
- Dark mode classes apply when theme is dark

### Property-Based Testing Approach

Property tests will verify universal properties across all inputs using fast-check library:

**Test Framework**: Jest + fast-check

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with: `Feature: landing-page-conversion-optimization, Property N: [property text]`

**Property Test Coverage**:
- **Property 2**: Generate random CTA configurations, verify all navigate correctly
- **Property 3**: Generate random feature data, verify all have icons
- **Property 4**: Generate random feature data, verify all have title and description
- **Property 5**: Generate random feature layouts, verify consistent spacing
- **Property 6**: Generate random viewport sizes, verify aspect ratios preserved
- **Property 7**: Generate random design tokens, verify consistency with dashboard
- **Property 8**: Generate random theme states, verify all elements update
- **Property 9**: Generate random scroll positions, verify animation triggering
- **Property 10**: Generate random animation configs, verify duration bounds
- **Property 11**: Generate random animated elements, verify property values
- **Property 12**: Generate random motion preferences, verify respect for reduced motion
- **Property 13**: Generate random interactive elements, verify touch target sizes
- **Property 14**: Generate random text content, verify line length constraints
- **Property 15**: Generate random image elements, verify format optimization
- **Property 16**: Generate random image positions, verify lazy loading
- **Property 17**: Generate random page structures, verify semantic HTML
- **Property 18**: Generate random images/icons, verify text alternatives
- **Property 19**: Generate random color combinations, verify contrast ratios
- **Property 20**: Generate random interactive elements, verify keyboard navigation
- **Property 21**: Generate random heading structures, verify hierarchy validity

### Integration Testing

**Test Framework**: Playwright

**Test Scenarios**:
- Full page load and render
- Scroll-triggered animations in real browser
- Theme switching with system preference
- Responsive layout at multiple viewport sizes
- Navigation flow from landing page to dashboard
- Performance metrics (Lighthouse CI)

### Accessibility Testing

**Test Framework**: axe-core + jest-axe

**Test Coverage**:
- Automated accessibility violations detection
- Keyboard navigation flow
- Screen reader compatibility
- Color contrast validation
- ARIA attribute correctness

### Visual Regression Testing

**Test Framework**: Percy or Chromatic

**Test Coverage**:
- Landing page appearance in light/dark themes
- Responsive layouts at standard breakpoints
- Animation states (before/after)
- Hover and focus states

### Performance Testing

**Test Framework**: Lighthouse CI

**Metrics**:
- First Contentful Paint (FCP) < 1.8s
- Largest Contentful Paint (LCP) < 2.5s
- Time to Interactive (TTI) < 3.8s
- Cumulative Layout Shift (CLS) < 0.1
- Overall Performance Score ≥ 90

