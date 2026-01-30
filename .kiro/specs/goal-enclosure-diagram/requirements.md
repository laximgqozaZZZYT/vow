# Requirements Document

## Introduction

This document defines the requirements for the Goal Enclosure Diagram feature, a new visualization type for the Statistics section of the habit management dashboard. The diagram displays Goals as rectangular enclosures (boxes) with their associated Habits shown inside, and visualizes hierarchical Goal relationships through nested or connected rectangles.

## Glossary

- **Goal_Enclosure_Diagram**: A visual representation where Goals are displayed as rectangular boxes containing their associated Habits
- **Goal**: A user-defined objective that can have a parent Goal and contain multiple Habits
- **Habit**: A recurring task or behavior that belongs to a Goal
- **Enclosure**: A rectangular box representing a Goal that visually contains its child elements
- **Parent_Goal**: A Goal that has one or more child Goals in a hierarchical relationship
- **Child_Goal**: A Goal that has a parentId referencing another Goal
- **Statistics_Section**: The dashboard section that displays analytics and visualizations

## Requirements

### Requirement 1: Display Goals as Rectangular Enclosures

**User Story:** As a user, I want to see my Goals displayed as rectangular boxes, so that I can visually understand the scope and boundaries of each Goal.

#### Acceptance Criteria

1. WHEN the Goal Enclosure Diagram is rendered, THE Goal_Enclosure_Diagram SHALL display each visible Goal as a distinct rectangular enclosure
2. WHEN a Goal has a name, THE Goal_Enclosure_Diagram SHALL display the Goal name as a label on the enclosure
3. WHEN a Goal is marked as completed, THE Goal_Enclosure_Diagram SHALL apply a visual distinction (e.g., muted colors or strikethrough) to indicate completion status
4. THE Goal_Enclosure_Diagram SHALL use the design system's semantic colors for enclosure styling (bg-card, border-border)

### Requirement 2: Display Habits Inside Goal Enclosures

**User Story:** As a user, I want to see my Habits displayed inside their parent Goal's enclosure, so that I can understand which Habits contribute to which Goals.

#### Acceptance Criteria

1. WHEN a Habit belongs to a Goal, THE Goal_Enclosure_Diagram SHALL render the Habit element inside that Goal's enclosure
2. WHEN a Habit is displayed, THE Goal_Enclosure_Diagram SHALL show the Habit name
3. WHEN a Habit has no associated Goal, THE Goal_Enclosure_Diagram SHALL display the Habit in a separate "Unassigned" area or exclude it from the diagram
4. WHEN multiple Habits belong to the same Goal, THE Goal_Enclosure_Diagram SHALL arrange them in a readable layout within the enclosure

### Requirement 3: Visualize Goal Hierarchy

**User Story:** As a user, I want to see parent-child Goal relationships visualized, so that I can understand how my Goals are organized hierarchically.

#### Acceptance Criteria

1. WHEN a Goal has a parentId, THE Goal_Enclosure_Diagram SHALL visually represent the parent-child relationship
2. WHEN displaying nested Goals, THE Goal_Enclosure_Diagram SHALL render child Goal enclosures inside or connected to their parent Goal enclosure
3. WHEN a Goal hierarchy has multiple levels, THE Goal_Enclosure_Diagram SHALL support at least 3 levels of nesting
4. THE Goal_Enclosure_Diagram SHALL use visual cues (indentation, borders, or connecting lines) to distinguish hierarchy levels

### Requirement 4: Interactive Diagram Features

**User Story:** As a user, I want to interact with the Goal Enclosure Diagram, so that I can explore my Goals and Habits efficiently.

#### Acceptance Criteria

1. WHEN a user clicks on a Goal enclosure, THE Goal_Enclosure_Diagram SHALL trigger a callback to open the Goal edit modal
2. WHEN a user clicks on a Habit element, THE Goal_Enclosure_Diagram SHALL trigger a callback to open the Habit edit modal
3. WHEN the diagram content exceeds the viewport, THE Goal_Enclosure_Diagram SHALL support panning and zooming
4. WHEN a user hovers over an element, THE Goal_Enclosure_Diagram SHALL provide visual feedback (hover state)

### Requirement 5: Integration with Statistics Section

**User Story:** As a user, I want the Goal Enclosure Diagram to be accessible from the Statistics section, so that I can view it alongside other analytics.

#### Acceptance Criteria

1. THE Goal_Enclosure_Diagram SHALL be available as a page/view within the Statistics section carousel
2. WHEN the Statistics section receives Goals and Habits data, THE Goal_Enclosure_Diagram SHALL render using that data
3. THE Goal_Enclosure_Diagram SHALL support goal visibility filtering consistent with other Statistics views
4. WHEN the "Edit Graph" button is clicked, THE Goal_Enclosure_Diagram SHALL allow users to configure which Goals are visible

### Requirement 6: Responsive and Accessible Design

**User Story:** As a user, I want the Goal Enclosure Diagram to work well on different devices and be accessible, so that I can use it regardless of my device or abilities.

#### Acceptance Criteria

1. THE Goal_Enclosure_Diagram SHALL be responsive and adapt to different screen sizes (mobile, tablet, desktop)
2. THE Goal_Enclosure_Diagram SHALL support dark mode using the design system's CSS variables
3. WHEN touch interactions are used, THE Goal_Enclosure_Diagram SHALL provide appropriate touch targets (minimum 44x44px)
4. THE Goal_Enclosure_Diagram SHALL use semantic HTML and ARIA attributes for accessibility
5. THE Goal_Enclosure_Diagram SHALL respect the user's prefers-reduced-motion setting for animations

### Requirement 7: Visual Layout Algorithm

**User Story:** As a user, I want the diagram to automatically arrange Goals and Habits in a clear layout, so that I can easily understand the structure without manual positioning.

#### Acceptance Criteria

1. THE Goal_Enclosure_Diagram SHALL automatically calculate enclosure sizes based on content
2. WHEN a Goal contains many Habits, THE Goal_Enclosure_Diagram SHALL expand the enclosure to accommodate all elements
3. WHEN Goals have hierarchical relationships, THE Goal_Enclosure_Diagram SHALL position parent enclosures to contain or connect to child enclosures
4. THE Goal_Enclosure_Diagram SHALL minimize visual overlap between enclosures
