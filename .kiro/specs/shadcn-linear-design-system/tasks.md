# Implementation Plan: shadcn/ui & Linear Design System

## Overview

This implementation plan breaks down the visual redesign into discrete styling tasks. Each task focuses on updating CSS classes and styles without changing component behavior or logic.

## Tasks

- [x] 1. Set up design tokens and base styles
  - Add CSS custom properties to `globals.css` for colors, spacing, typography
  - Add typography utility classes
  - Configure Tailwind with design system tokens (if needed)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 18.1, 18.2, 18.3_

- [x] 2. Update button styling across the application
  - [x] 2.1 Update primary action buttons with new styling pattern
    - Apply primary button classes to main action buttons
    - Ensure hover and focus states are properly styled
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 2.2 Update secondary and outline buttons
    - Apply secondary and outline button classes
    - Update ghost buttons for subtle actions
    - _Requirements: 8.1, 8.2_

  - [x] 2.3 Update destructive/delete buttons
    - Apply destructive button styling
    - Ensure proper visual warning for dangerous actions
    - _Requirements: 8.1, 8.2_

  - [ ]* 2.4 Test button accessibility and touch targets
    - Verify focus rings are visible
    - Verify minimum 44x44px touch targets on mobile
    - Test keyboard navigation
    - _Requirements: 8.3, 8.6, 15.3_

- [x] 3. Update form input styling
  - [x] 3.1 Update text inputs and textareas
    - Apply new input styling classes
    - Update focus states with ring styling
    - _Requirements: 9.1, 9.2_

  - [x] 3.2 Update select/dropdown styling
    - Apply new select styling classes
    - Ensure consistent appearance with inputs
    - _Requirements: 9.1, 9.2_

  - [x] 3.3 Update form labels and helper text
    - Apply label styling classes
    - Update error message styling
    - _Requirements: 9.5, 9.3_

  - [ ]* 3.4 Test form accessibility
    - Verify label associations
    - Test error state visibility
    - Verify placeholder contrast
    - _Requirements: 9.5, 9.6, 15.2_


- [x] 4. Update card and panel styling
  - [x] 4.1 Update dashboard widget cards
    - Apply card styling to calendar widget
    - Apply card styling to statistics widgets
    - Apply card styling to activity sections
    - _Requirements: 12.1, 12.3, 12.4, 17.4_

  - [x] 4.2 Update card headers and titles
    - Apply card header styling
    - Update card title typography
    - _Requirements: 12.6, 4.5_

  - [ ]* 4.3 Test card hover states and shadows
    - Verify hover effects on interactive cards
    - Test shadow consistency
    - _Requirements: 12.5_

- [x] 5. Update modal/dialog styling
  - [x] 5.1 Update modal backdrops and containers
    - Apply backdrop blur styling
    - Update modal container positioning and borders
    - _Requirements: 10.6, 10.7_

  - [x] 5.2 Update modal headers and content
    - Apply modal header styling
    - Update modal title and description styling
    - _Requirements: 10.1, 10.2_

  - [x] 5.3 Update modal footers and action buttons
    - Apply modal footer styling
    - Ensure button spacing is consistent
    - _Requirements: 10.1_

  - [ ]* 5.4 Test modal accessibility
    - Verify focus trapping still works
    - Test Escape key functionality
    - Test backdrop click dismissal
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 6. Update sidebar and navigation styling
  - [x] 6.1 Update sidebar container and layout
    - Apply sidebar container styling
    - Update sidebar border and background
    - _Requirements: 11.1, 11.6_

  - [x] 6.2 Update navigation items
    - Apply navigation item styling for inactive state
    - Apply navigation item styling for active state
    - Update hover effects
    - _Requirements: 11.2, 11.3, 11.4_

  - [x] 6.3 Update navigation section headers
    - Apply section header styling
    - Ensure proper visual hierarchy
    - _Requirements: 11.2_

  - [ ]* 6.4 Test sidebar responsiveness
    - Verify sidebar collapse on mobile
    - Test navigation keyboard accessibility
    - _Requirements: 11.5, 15.2_


- [x] 7. Update dashboard layout and spacing
  - [x] 7.1 Update main container and content area
    - Apply main container background styling
    - Update content area padding
    - _Requirements: 17.1, 17.6_

  - [x] 7.2 Update section spacing
    - Apply consistent spacing between sections (space-y-6)
    - Apply spacing between related items (space-y-4)
    - Apply spacing between tightly related items (space-y-2)
    - _Requirements: 7.4, 7.5, 7.6, 17.5_

  - [x] 7.3 Update grid layouts
    - Apply grid styling to widget layouts
    - Ensure responsive grid behavior
    - _Requirements: 17.2_

- [x] 8. Update typography across the application
  - [x] 8.1 Update heading styles
    - Apply h1, h2, h3, h4 typography classes
    - Ensure proper hierarchy
    - _Requirements: 4.2, 4.5_

  - [x] 8.2 Update body text and captions
    - Apply body text styling
    - Apply small text and caption styling
    - _Requirements: 4.2, 4.6_

  - [ ]* 8.3 Test typography contrast and readability
    - Verify contrast ratios meet WCAG AA
    - Test line heights for readability
    - _Requirements: 4.4, 4.6, 15.5_

- [x] 9. Implement dark mode styling
  - [x] 9.1 Verify dark mode CSS variables
    - Ensure all dark mode colors are defined
    - Test dark mode background colors
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

  - [x] 9.2 Test dark mode across all components
    - Test buttons in dark mode
    - Test inputs in dark mode
    - Test cards in dark mode
    - Test modals in dark mode
    - _Requirements: 5.6, 5.7_

  - [ ]* 9.3 Test dark mode contrast ratios
    - Verify text contrast in dark mode
    - Verify interactive element contrast
    - _Requirements: 5.6, 15.5_


- [x] 10. Add micro-interactions and transitions
  - [x] 10.1 Add button hover and active transitions
    - Add transition-colors to buttons
    - Add scale effect on button click (optional)
    - _Requirements: 6.1, 6.2_

  - [x] 10.2 Add modal open/close animations
    - Add fade-in animation for backdrop
    - Add slide-in animation for modal content
    - _Requirements: 6.4, 6.5_

  - [x] 10.3 Add loading state styling
    - Style loading spinners
    - Add skeleton loader styling (if needed)
    - _Requirements: 14.1, 14.2, 14.5_

  - [ ]* 10.4 Test reduced motion preferences
    - Verify animations are disabled with prefers-reduced-motion
    - Test that functionality works without animations
    - _Requirements: 6.7, 15.6_

- [x] 11. Update responsive design
  - [x] 11.1 Test mobile layout (375px - 768px)
    - Verify sidebar collapses properly
    - Verify touch targets are adequate
    - Test modal full-screen behavior
    - _Requirements: 16.2, 16.3, 16.4_

  - [x] 11.2 Test tablet layout (768px - 1024px)
    - Verify grid layouts adapt properly
    - Test spacing at tablet breakpoint
    - _Requirements: 16.1_

  - [x] 11.3 Test desktop layout (1024px+)
    - Verify two-column layout
    - Test widget grid layouts
    - _Requirements: 16.1, 17.1_

  - [ ]* 11.4 Test responsive typography
    - Verify text scales appropriately
    - Ensure no horizontal scrolling
    - _Requirements: 16.5, 16.6_

- [x] 12. Checkpoint - Visual review and accessibility audit
  - Review all updated components in light and dark modes
  - Run accessibility checker (axe DevTools)
  - Test keyboard navigation through entire app
  - Verify color contrast ratios
  - Test on multiple browsers (Chrome, Firefox, Safari)
  - Ask user for feedback on visual design


- [x] 13. Polish and refinements
  - [x] 13.1 Update toast/notification styling
    - Apply toast styling for success, error, warning states
    - Ensure proper positioning and stacking
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x] 13.2 Update error state styling
    - Apply error message styling
    - Update input error states
    - _Requirements: 9.3_

  - [x] 13.3 Add focus indicators
    - Ensure all interactive elements have visible focus rings
    - Test focus indicator contrast
    - _Requirements: 15.3, 8.3_

  - [x] 13.4 Final spacing adjustments
    - Review and adjust spacing inconsistencies
    - Ensure 8px grid system is followed
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 14. Final testing and validation
  - [ ]* 14.1 Run full accessibility audit
    - Test with screen reader
    - Verify ARIA labels are intact
    - Test keyboard navigation
    - Verify color contrast
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [ ]* 14.2 Cross-browser testing
    - Test in Chrome
    - Test in Firefox
    - Test in Safari
    - Test in Edge
    - _Requirements: All_

  - [ ]* 14.3 Responsive testing
    - Test on mobile devices (375px, 414px)
    - Test on tablets (768px, 1024px)
    - Test on desktop (1280px, 1920px)
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [ ]* 14.4 Visual regression check
    - Compare before/after screenshots
    - Verify all components are styled consistently
    - Check for any broken layouts
    - _Requirements: All_

- [ ] 15. Final checkpoint - User acceptance
  - Present final design to user
  - Gather feedback on visual improvements
  - Make any final adjustments based on feedback
  - Confirm design system is complete

## Notes

- Tasks marked with `*` are optional testing tasks that can be skipped for faster MVP
- All tasks focus on visual styling only - no behavior changes
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Testing tasks validate visual consistency and accessibility

