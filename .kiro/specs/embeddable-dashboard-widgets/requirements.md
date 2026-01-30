# Requirements Document

## Introduction

This feature enables dashboard sections (Daily Progress, Statistics, Next Habits, Stickies) to be embedded in external websites as interactive widgets. Users can generate API keys to authenticate embedded widgets, allowing read and write operations including viewing habit progress, incrementing/decrementing habit counts, and toggling sticky completion status.

## Glossary

- **Widget_System**: The system responsible for rendering and managing embeddable dashboard widgets
- **API_Key_Service**: The service responsible for generating, validating, and managing API keys for widget authentication
- **Widget_API**: The REST API endpoints that serve widget data and handle interactive operations
- **Embed_Page**: A standalone Next.js page designed to be loaded in an iframe on external sites
- **Rate_Limiter**: The component that limits API requests per API key to prevent abuse

## Requirements

### Requirement 1: API Key Management

**User Story:** As a user, I want to generate API keys for my account, so that I can authenticate embedded widgets on external sites.

#### Acceptance Criteria

1. WHEN a user requests a new API key THEN THE API_Key_Service SHALL generate a unique, cryptographically secure API key
2. WHEN an API key is generated THEN THE API_Key_Service SHALL store the key hash with the associated user ID and creation timestamp
3. WHEN a user views their API keys THEN THE API_Key_Service SHALL return a list of active keys with masked values and creation dates
4. WHEN a user revokes an API key THEN THE API_Key_Service SHALL mark the key as inactive and reject future requests using it
5. THE API_Key_Service SHALL limit each user to a maximum of 5 active API keys

### Requirement 2: API Key Authentication

**User Story:** As a widget consumer, I want to authenticate using an API key, so that I can access widget data without user login.

#### Acceptance Criteria

1. WHEN a request includes a valid API key in the X-API-Key header THEN THE Widget_API SHALL authenticate the request and associate it with the key's owner
2. WHEN a request includes an invalid or revoked API key THEN THE Widget_API SHALL return a 401 Unauthorized response
3. WHEN a request lacks an API key THEN THE Widget_API SHALL return a 401 Unauthorized response
4. THE Widget_API SHALL validate API keys by comparing the hash of the provided key against stored hashes

### Requirement 3: Rate Limiting

**User Story:** As a system administrator, I want to limit API requests per key, so that I can prevent abuse and ensure fair usage.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL limit each API key to 100 requests per minute
2. WHEN the rate limit is exceeded THEN THE Widget_API SHALL return a 429 Too Many Requests response with a Retry-After header
3. THE Rate_Limiter SHALL track request counts per API key using a sliding window algorithm

### Requirement 4: Widget Data Endpoints

**User Story:** As a widget consumer, I want to fetch dashboard section data via API, so that I can display it in embedded widgets.

#### Acceptance Criteria

1. WHEN a GET request is made to /api/widgets/progress THEN THE Widget_API SHALL return daily progress data in JSON format
2. WHEN a GET request is made to /api/widgets/stats THEN THE Widget_API SHALL return statistics data in JSON format
3. WHEN a GET request is made to /api/widgets/next THEN THE Widget_API SHALL return next habits data in JSON format
4. WHEN a GET request is made to /api/widgets/stickies THEN THE Widget_API SHALL return stickies data in JSON format
5. THE Widget_API SHALL use the existing DashboardDataService to fetch data for consistency

### Requirement 5: Interactive Operations

**User Story:** As a widget user, I want to perform actions like completing habits from embedded widgets, so that I can track progress without visiting the main dashboard.

#### Acceptance Criteria

1. WHEN a POST request is made to /api/widgets/habits/:habitId/complete with an amount THEN THE Widget_API SHALL record a completion activity for the habit
2. WHEN a POST request is made to /api/widgets/stickies/:stickyId/toggle THEN THE Widget_API SHALL toggle the sticky's completion status
3. IF the habitId or stickyId does not belong to the API key owner THEN THE Widget_API SHALL return a 403 Forbidden response
4. WHEN an operation succeeds THEN THE Widget_API SHALL return the updated resource data

### Requirement 6: Embeddable Pages

**User Story:** As a website owner, I want to embed dashboard widgets using iframes, so that I can display habit tracking on my site.

#### Acceptance Criteria

1. THE Widget_System SHALL provide embeddable pages at /embed/progress, /embed/stats, /embed/next, /embed/stickies
2. WHEN an embed page is loaded with a valid apiKey query parameter THEN THE Embed_Page SHALL authenticate and display the widget
3. WHEN an embed page is loaded without an apiKey or with an invalid key THEN THE Embed_Page SHALL display an authentication error message
4. THE Embed_Page SHALL be styled as self-contained components that work in any iframe context
5. THE Embed_Page SHALL support a theme query parameter with values "light" or "dark"

### Requirement 7: CORS Configuration

**User Story:** As a widget consumer, I want to embed widgets from any domain, so that I can use them on any website.

#### Acceptance Criteria

1. THE Widget_API SHALL include CORS headers allowing requests from any origin for /api/widgets/* endpoints
2. THE Widget_API SHALL allow the X-API-Key header in CORS preflight responses
3. THE Embed_Page SHALL set X-Frame-Options to allow embedding from any origin

### Requirement 8: Widget Styling

**User Story:** As a website owner, I want embedded widgets to have minimal, adaptable styling, so that they integrate well with my site design.

#### Acceptance Criteria

1. THE Embed_Page SHALL use CSS variables for colors to support theming
2. THE Embed_Page SHALL have a transparent background by default
3. THE Embed_Page SHALL be responsive and adapt to the iframe container size
4. THE Embed_Page SHALL use the existing design system tokens where applicable
