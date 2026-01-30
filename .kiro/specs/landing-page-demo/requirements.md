# Requirements Document

## Introduction

本ドキュメントは、VOW（習慣・目標トラッカー）アプリケーションのランディングページにインタラクティブなデモセクションを追加する機能の要件を定義します。このデモセクションは、実際のダッシュボードと同じコンポーネントとレイアウトを使用し、自動再生アニメーションによってユーザーに典型的な操作フローを紹介します。

## Glossary

- **Demo_Section**: ランディングページに表示されるインタラクティブなデモ領域
- **Demo_Data**: デモ表示用の静的テストデータ（習慣、目標、アクティビティ、付箋）
- **Demo_Animation**: デモセクション内で自動再生されるユーザー操作のミニアニメーション
- **Dashboard_Component**: 実際のダッシュボードで使用されているReactコンポーネント
- **Landing_Page**: アプリケーションのトップページ（frontend/app/page.tsx）
- **Habit**: 習慣データ（名前、時間、繰り返し設定など）
- **Goal**: 目標データ（名前、期限、親子関係など）
- **Activity**: 習慣の完了記録データ
- **Sticky**: 付箋（Sticky'n）データ

## Requirements

### Requirement 1: デモ用テストデータの作成

**User Story:** As a visitor, I want to see realistic demo data, so that I can understand how the app works with actual content.

#### Acceptance Criteria

1. THE Demo_Data SHALL include at least 3 sample habits with Japanese names (e.g., "朝の運動", "読書", "瞑想")
2. THE Demo_Data SHALL include at least 2 sample goals with Japanese names (e.g., "健康的な生活", "スキルアップ")
3. THE Demo_Data SHALL include sample activities representing completion records for the past 7 days
4. THE Demo_Data SHALL include at least 2 sample stickies with Japanese content
5. THE Demo_Data SHALL follow the existing type definitions (Habit, Goal, Activity, Sticky interfaces)
6. THE Demo_Data SHALL include realistic timing data for habits (morning, afternoon, evening schedules)

### Requirement 2: デモセクションのレイアウト【重要】

**User Story:** As a visitor, I want to see a miniature version of the dashboard, so that I can preview the app's interface before signing up.

**CRITICAL:** このセクションの要件は特に厳守すること。実際のダッシュボードとの視覚的一貫性が最優先事項です。

#### Acceptance Criteria

1. WHEN a visitor views the landing page, THE Demo_Section SHALL display below the hero section
2. THE Demo_Section SHALL use the EXACT same layout structure as the actual dashboard (frontend/app/dashboard/page.tsx)
3. THE Demo_Section SHALL display a scaled-down version of the dashboard components while maintaining the EXACT same visual proportions and spacing
4. THE Demo_Section SHALL be responsive and adapt to mobile and desktop viewports using the SAME breakpoints as the actual dashboard
5. THE Demo_Section SHALL include a visual frame or container that clearly identifies it as a demo preview
6. THE Demo_Section SHALL display a title indicating it is a demo (e.g., "ダッシュボードプレビュー")
7. THE Demo_Section SHALL maintain the EXACT same component arrangement (grid layout, section ordering) as the actual dashboard
8. THE Demo_Section SHALL use CSS transform scale or container queries to achieve miniaturization WITHOUT altering component internal layouts
9. THE Demo_Section SHALL preserve all visual details including borders, shadows, and spacing ratios from the actual dashboard

### Requirement 3: ダッシュボードコンポーネントの再利用

**User Story:** As a developer, I want to reuse existing dashboard components, so that the demo accurately represents the actual app experience.

#### Acceptance Criteria

1. THE Demo_Section SHALL use the NextSection component to display upcoming habits
2. THE Demo_Section SHALL use the StickiesSection component to display sticky notes
3. THE Demo_Section SHALL use the CalendarWidget component to display the calendar view
4. THE Demo_Section SHALL use the StaticsSection component to display statistics
5. WHEN rendering components, THE Demo_Section SHALL pass demo data instead of API-fetched data
6. THE Demo_Section SHALL NOT make any API calls during rendering

### Requirement 4: 自動再生デモアニメーション

**User Story:** As a visitor, I want to see animated interactions, so that I can understand how to use the app without reading documentation.

#### Acceptance Criteria

1. WHEN the demo section is visible, THE Demo_Animation SHALL auto-play showing typical user interactions
2. THE Demo_Animation SHALL demonstrate habit completion flow (clicking complete button)
3. THE Demo_Animation SHALL demonstrate sticky note creation and editing
4. THE Demo_Animation SHALL demonstrate calendar navigation (switching between day/week views)
5. THE Demo_Animation SHALL loop smoothly after completing all demonstration sequences
6. THE Demo_Animation SHALL include visual indicators (e.g., cursor animation, highlight effects) to show where interactions occur
7. THE Demo_Animation SHALL pause when the user hovers over or touches the demo section
8. WHEN the user stops interacting, THE Demo_Animation SHALL resume after a 3-second delay

### Requirement 5: パフォーマンスとアクセシビリティ

**User Story:** As a visitor, I want the demo to load quickly and be accessible, so that I can view it on any device without issues.

#### Acceptance Criteria

1. THE Demo_Section SHALL lazy-load to avoid blocking initial page render
2. THE Demo_Section SHALL respect prefers-reduced-motion media query by disabling animations
3. THE Demo_Section SHALL maintain minimum touch target size of 44x44px for interactive elements
4. THE Demo_Section SHALL use semantic HTML elements for proper screen reader support
5. THE Demo_Section SHALL not significantly impact the landing page's Largest Contentful Paint (LCP)
6. IF the demo fails to load, THEN THE Landing_Page SHALL display a static fallback image or placeholder

### Requirement 6: デザインシステムの遵守

**User Story:** As a designer, I want the demo to follow the design system, so that it maintains visual consistency with the rest of the app.

#### Acceptance Criteria

1. THE Demo_Section SHALL use CSS variables for colors (bg-background, text-foreground, etc.)
2. THE Demo_Section SHALL use Tailwind CSS classes consistent with the design system
3. THE Demo_Section SHALL support dark mode through the existing class strategy
4. THE Demo_Section SHALL use the 8px-based spacing scale defined in the design system
5. THE Demo_Section SHALL use the defined border-radius values (radius-sm, radius-md, radius-lg)
6. THE Demo_Section SHALL use the defined shadow values (shadow-sm, shadow-md, shadow-lg)
