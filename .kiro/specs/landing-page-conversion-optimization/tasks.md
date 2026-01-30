# Implementation Plan: Landing Page Conversion Optimization

## Overview

This implementation plan transforms the existing VOW landing page into a high-conversion marketing page with compelling copy, scroll-triggered animations, and strategic CTAs. The implementation follows a mobile-first approach, maintains design system consistency, and includes comprehensive testing for accessibility, performance, and correctness properties.

## Tasks

- [x] 1. Create scroll reveal animation hook
  - Implement useScrollReveal hook using Intersection Observer API
  - Support threshold, rootMargin, and triggerOnce options
  - Respect prefers-reduced-motion media query
  - Return ref and isVisible state for component usage
  - _Requirements: 6.1, 6.4, 6.5_

- [ ]* 1.1 Write property tests for scroll reveal hook
  - **Property 9: Scroll Animation Triggering**
  - **Validates: Requirements 6.1, 6.4**
  - **Property 12: Reduced Motion Respect**
  - **Validates: Requirements 6.5**

- [ ] 2. Implement enhanced Hero Section
  - [ ] 2.1 Update hero section with new headline "AIと共に歩む、最もシンプルなタスク管理"
    - Replace existing headline text
    - Update subheadline with conversion-focused copy
    - Maintain existing gradient background
    - _Requirements: 1.1, 1.3_

  - [ ] 2.2 Add prominent "今すぐ始める" primary CTA button
    - Create large, high-contrast button
    - Position prominently in hero section
    - Link to /dashboard for immediate access
    - Add hover and focus states
    - _Requirements: 1.2, 1.4_

  - [ ]* 2.3 Write property tests for hero section
    - **Property 1: Hero Section Viewport Visibility**
    - **Validates: Requirements 1.5**
    - **Property 2: CTA Navigation Consistency**
    - **Validates: Requirements 1.4, 4.5**

- [ ] 3. Build Features Section with three core strengths
  - [ ] 3.1 Create Feature component with icon, title, and description
    - Define Feature interface (id, icon, title, description, order)
    - Implement reusable FeatureCard component
    - Add responsive grid layout (3 columns desktop, 1 column mobile)
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [ ] 3.2 Add feature content for three strengths
    - 爆速動作 (Lightning-fast) with Zap icon
    - 業界標準のUI (Industry-standard UI) with Layout icon
    - 完全無料 (Completely free) with Gift icon
    - Use consistent spacing and styling
    - _Requirements: 2.1, 2.4_

  - [ ]* 3.3 Write property tests for features section
    - **Property 3: Feature Icon Presence**
    - **Validates: Requirements 2.2**
    - **Property 4: Feature Content Completeness**
    - **Validates: Requirements 2.3**
    - **Property 5: Feature Layout Consistency**
    - **Validates: Requirements 2.4**

- [ ] 4. Implement Social Proof Section
  - [ ] 4.1 Create dashboard preview image component
    - Use Next.js Image component for optimization
    - Add WebP format with fallback
    - Implement lazy loading for below-fold images
    - Add styled placeholder for loading/error states
    - _Requirements: 3.1, 3.5, 8.2, 8.3_

  - [ ] 4.2 Add preview image with proper aspect ratio
    - Use 16:9 aspect ratio container
    - Add subtle shadow and rounded corners
    - Include descriptive caption
    - Ensure responsive sizing
    - _Requirements: 3.2, 3.4_

  - [ ]* 4.3 Write property tests for social proof section
    - **Property 6: Image Aspect Ratio Preservation**
    - **Validates: Requirements 3.4**
    - **Property 15: Image Format Optimization**
    - **Validates: Requirements 8.2**
    - **Property 16: Below-Fold Lazy Loading**
    - **Validates: Requirements 8.3**

- [ ] 5. Create Secondary CTA Section
  - [ ] 5.1 Build bottom CTA section with dual buttons
    - Add headline "準備はできましたか？今すぐ始めましょう。"
    - Create "ログイン" primary button
    - Create "ゲストとして続行" secondary button
    - Use accent background color
    - _Requirements: 4.1, 4.2, 4.4_

  - [ ] 5.2 Implement responsive button layout
    - Horizontal layout on desktop
    - Stacked layout on mobile
    - Ensure proper spacing and alignment
    - _Requirements: 4.1_

  - [ ]* 5.3 Write unit tests for CTA section
    - Test button rendering and text content
    - Test navigation href attributes
    - Test responsive layout classes
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

- [ ] 6. Apply scroll-triggered animations to all sections
  - [ ] 6.1 Add scroll reveal to Features Section
    - Wrap section with useScrollReveal hook
    - Apply fade-in animation classes
    - Set animation duration to 400ms
    - Add 30px vertical translation
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 6.2 Add scroll reveal to Social Proof Section
    - Apply same animation pattern
    - Ensure smooth transition
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 6.3 Add scroll reveal to Secondary CTA Section
    - Apply same animation pattern
    - Ensure animations don't block interaction
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 6.4 Write property tests for animations
    - **Property 10: Animation Duration Bounds**
    - **Validates: Requirements 6.2**
    - **Property 11: Animation Property Configuration**
    - **Validates: Requirements 6.3**

- [ ] 7. Ensure design system consistency
  - [ ] 7.1 Verify color palette matches dashboard
    - Use existing CSS custom properties
    - Test light and dark theme support
    - Ensure proper theme switching
    - _Requirements: 5.1, 5.4_

  - [ ] 7.2 Verify typography matches dashboard
    - Use design system font classes
    - Match font sizes, weights, and line heights
    - _Requirements: 5.2_

  - [ ] 7.3 Verify spacing and layout grid
    - Use design system spacing tokens
    - Match button styles and interactive elements
    - _Requirements: 5.3, 5.5_

  - [ ]* 7.4 Write property tests for design consistency
    - **Property 7: Design System Token Consistency**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.5**
    - **Property 8: Theme Support Consistency**
    - **Validates: Requirements 5.4**

- [ ] 8. Checkpoint - Ensure all visual elements render correctly
  - Verify all sections display properly
  - Test responsive layouts at all breakpoints
  - Ensure animations work smoothly
  - Ask the user if questions arise

- [ ] 9. Implement responsive optimizations
  - [ ] 9.1 Add mobile-specific layout adjustments
    - Single-column layout for mobile (< 640px)
    - Adjust font sizes for readability
    - Stack buttons vertically
    - _Requirements: 7.1_

  - [ ] 9.2 Add tablet-specific adjustments
    - Adjust spacing for tablet (640px - 1024px)
    - Optimize font sizes
    - _Requirements: 7.2_

  - [ ] 9.3 Ensure touch-friendly interactive elements
    - Minimum 44x44px touch targets on mobile
    - Add appropriate padding to buttons
    - _Requirements: 7.4_

  - [ ]* 9.4 Write property tests for responsive design
    - **Property 13: Touch Target Minimum Size**
    - **Validates: Requirements 7.4**
    - **Property 14: Line Length Readability**
    - **Validates: Requirements 7.5**

- [ ] 10. Implement accessibility enhancements
  - [ ] 10.1 Add semantic HTML structure
    - Use header, main, section, article, footer elements
    - Ensure proper heading hierarchy (h1 → h2 → h3)
    - Add ARIA labels where needed
    - _Requirements: 9.1, 10.3_

  - [ ] 10.2 Add alt text and ARIA labels
    - Provide descriptive alt text for all images
    - Add aria-label to icon-only buttons
    - Ensure screen reader compatibility
    - _Requirements: 9.2, 9.5_

  - [ ] 10.3 Ensure keyboard navigation support
    - Test Tab key navigation flow
    - Add visible focus indicators
    - Ensure all interactive elements are reachable
    - _Requirements: 9.4_

  - [ ] 10.4 Verify color contrast compliance
    - Test all text/background combinations
    - Ensure 4.5:1 ratio for normal text
    - Ensure 3:1 ratio for large text
    - _Requirements: 9.3_

  - [ ]* 10.5 Write property tests for accessibility
    - **Property 17: Semantic HTML Structure**
    - **Validates: Requirements 9.1**
    - **Property 18: Image and Icon Text Alternatives**
    - **Validates: Requirements 9.2, 9.5**
    - **Property 19: Color Contrast Compliance**
    - **Validates: Requirements 9.3**
    - **Property 20: Keyboard Navigation Completeness**
    - **Validates: Requirements 9.4**
    - **Property 21: Heading Hierarchy Validity**
    - **Validates: Requirements 10.3**

- [ ] 11. Optimize SEO metadata
  - [ ] 11.1 Update page metadata
    - Add descriptive title with keywords
    - Add compelling meta description
    - Include Open Graph metadata
    - Add Twitter Card metadata
    - _Requirements: 10.1, 10.2, 10.4_

  - [ ] 11.2 Verify sitemap generation
    - Ensure landing page is included in sitemap
    - Test sitemap.xml generation
    - _Requirements: 10.5_

  - [ ]* 11.3 Write unit tests for SEO metadata
    - Test title tag content
    - Test meta description presence
    - Test Open Graph tags
    - Test heading hierarchy
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 12. Final checkpoint - Run full test suite
  - Run all unit tests
  - Run all property-based tests
  - Test responsive layouts manually
  - Test accessibility with screen reader
  - Verify performance with Lighthouse
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript and React with Next.js
- All animations respect prefers-reduced-motion for accessibility
- Design system tokens ensure visual consistency with dashboard
