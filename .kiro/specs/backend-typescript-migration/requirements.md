# Requirements Document

## Introduction

This document specifies the requirements for a two-phase backend improvement project:

**Phase 1: Python Refactoring** - Refactor the existing Python (FastAPI) backend to improve code quality, maintainability, and test coverage while preserving all functionality.

**Phase 2: TypeScript Migration** - Migrate the refactored Python backend to TypeScript, maintaining complete feature parity while leveraging TypeScript's type system.

The backend serves a habit tracking application with Slack integration, supporting slash commands, interactive components, scheduled reports, and reminders.

## Glossary

- **Backend_API**: The FastAPI/Hono application that handles HTTP requests and Lambda events
- **Slack_Integration_Service**: Service responsible for Slack API interactions including OAuth, messaging, and webhook handling
- **Habit_Completion_Reporter**: Service that tracks and reports habit completion status and streaks
- **Daily_Progress_Calculator**: Service that calculates workload-based daily progress for habits
- **Weekly_Report_Generator**: Service that compiles and sends weekly summary reports via Slack
- **Follow_Up_Agent**: Service that manages habit reminders and follow-up messages
- **Slack_Repository**: Data access layer for Slack connections and follow-up status
- **JWT_Auth_Middleware**: Middleware that validates JWT tokens from Supabase or Cognito
- **Lambda_Handler**: Entry point that routes EventBridge and API Gateway events
- **Supabase_Client**: Database client for PostgreSQL operations via Supabase
- **Circuit_Breaker**: Pattern to prevent cascading failures in external service calls

## Phase 1: Python Refactoring Requirements

### Requirement 1: Code Organization and Structure

**User Story:** As a developer, I want a well-organized Python codebase, so that I can maintain and extend the code efficiently.

#### Acceptance Criteria

1. THE Backend_API SHALL organize code into clear layers: routers, services, repositories, schemas, utils
2. THE Backend_API SHALL use dependency injection for service dependencies
3. THE Backend_API SHALL separate business logic from HTTP handling in routers
4. THE Backend_API SHALL use type hints consistently throughout the codebase
5. THE Backend_API SHALL follow PEP 8 style guidelines
6. THE Backend_API SHALL have docstrings for all public functions and classes

### Requirement 2: Service Layer Refactoring

**User Story:** As a developer, I want services to have single responsibilities, so that the code is easier to test and maintain.

#### Acceptance Criteria

1. THE Slack_Integration_Service SHALL handle only Slack API communication
2. THE Habit_Completion_Reporter SHALL handle only habit completion logic and streak calculation
3. THE Daily_Progress_Calculator SHALL handle only progress calculation logic
4. THE Weekly_Report_Generator SHALL handle only report generation and scheduling
5. THE Follow_Up_Agent SHALL handle only reminder and follow-up logic
6. WHEN a service needs another service, THE Backend_API SHALL inject it as a dependency

### Requirement 3: Repository Pattern Implementation

**User Story:** As a developer, I want database operations isolated in repositories, so that I can easily test business logic without database dependencies.

#### Acceptance Criteria

1. THE Slack_Repository SHALL encapsulate all slack_connections table operations
2. THE Slack_Repository SHALL encapsulate all notification_preferences table operations
3. THE Slack_Repository SHALL encapsulate all slack_follow_up_status table operations
4. THE Backend_API SHALL create a HabitRepository for habits table operations
5. THE Backend_API SHALL create an ActivityRepository for activities table operations
6. THE Backend_API SHALL create a GoalRepository for goals table operations
7. WHEN services need database access, THE Backend_API SHALL inject repositories as dependencies

### Requirement 4: Error Handling Improvements

**User Story:** As a developer, I want consistent error handling, so that errors are properly logged and users receive appropriate messages.

#### Acceptance Criteria

1. THE Backend_API SHALL define a hierarchy of custom exception classes
2. THE Backend_API SHALL have a base AppError class with status_code, code, and is_retryable attributes
3. THE Backend_API SHALL have specific error classes: AuthenticationError, SlackAPIError, DataFetchError, ConnectionError
4. WHEN an error occurs in Slack handlers, THE Backend_API SHALL return user-friendly Japanese messages
5. THE Backend_API SHALL log technical error details separately from user-facing messages
6. THE Backend_API SHALL use a centralized error handler for consistent error responses

### Requirement 5: Logging Standardization

**User Story:** As a developer, I want standardized structured logging, so that I can easily search and analyze logs in CloudWatch.

#### Acceptance Criteria

1. THE Backend_API SHALL output all logs as structured JSON
2. THE Backend_API SHALL include timestamp, level, logger name, and message in every log entry
3. THE Backend_API SHALL include Lambda context (request_id, remaining_time) when available
4. WHEN a Slack command is processed, THE Backend_API SHALL log command, processing_time_ms, and result_status
5. WHEN an error occurs, THE Backend_API SHALL log error_type, error_message, and stack trace
6. THE Backend_API SHALL use a consistent logger instance across all modules

### Requirement 6: Test Coverage

**User Story:** As a developer, I want comprehensive test coverage, so that I can refactor with confidence.

#### Acceptance Criteria

1. THE Backend_API SHALL have unit tests for all service methods
2. THE Backend_API SHALL have unit tests for all repository methods with mocked database
3. THE Backend_API SHALL have unit tests for retry logic with various error scenarios
4. THE Backend_API SHALL have unit tests for Slack signature verification
5. THE Backend_API SHALL have unit tests for JWT token validation
6. THE Backend_API SHALL have unit tests for daily progress calculation
7. THE Backend_API SHALL have unit tests for streak calculation
8. THE Backend_API SHALL achieve at least 80% code coverage

### Requirement 7: Configuration Management

**User Story:** As a developer, I want centralized configuration management, so that settings are validated and easily accessible.

#### Acceptance Criteria

1. THE Backend_API SHALL validate all required environment variables on startup
2. THE Backend_API SHALL provide clear error messages for missing configuration
3. THE Backend_API SHALL use Pydantic Settings for type-safe configuration
4. THE Backend_API SHALL support environment-specific configuration (development, production)
5. THE Backend_API SHALL not expose sensitive configuration in logs or error messages

### Requirement 8: Async/Await Consistency

**User Story:** As a developer, I want consistent async patterns, so that the code is predictable and performs well.

#### Acceptance Criteria

1. THE Backend_API SHALL use async/await consistently for all I/O operations
2. THE Backend_API SHALL use async context managers for resource cleanup
3. THE Backend_API SHALL properly handle async exceptions
4. THE Backend_API SHALL avoid mixing sync and async code patterns
5. THE Backend_API SHALL use asyncio.gather for concurrent operations where appropriate

## Phase 2: TypeScript Migration Requirements

### Requirement 9: TypeScript Project Setup

**User Story:** As a developer, I want a well-configured TypeScript project, so that I can leverage type safety and modern tooling.

#### Acceptance Criteria

1. THE Backend_API SHALL use TypeScript with strict mode enabled
2. THE Backend_API SHALL use Hono as the web framework for Lambda compatibility
3. THE Backend_API SHALL use Zod for request/response validation
4. THE Backend_API SHALL use the official Supabase JavaScript client
5. THE Backend_API SHALL maintain the same directory structure as the refactored Python backend
6. THE Backend_API SHALL support both local development and AWS Lambda deployment

### Requirement 10: API Contract Compatibility

**User Story:** As a frontend developer, I want the API contracts to remain unchanged, so that the frontend continues to work during migration.

#### Acceptance Criteria

1. THE Backend_API SHALL maintain the same endpoint paths as the Python backend
2. THE Backend_API SHALL maintain the same request/response schemas as the Python backend
3. THE Backend_API SHALL maintain the same HTTP status codes as the Python backend
4. THE Backend_API SHALL maintain the same error response format as the Python backend
5. THE Backend_API SHALL support the same CORS configuration as the Python backend

### Requirement 11: Feature Parity

**User Story:** As a user, I want all existing features to work identically after migration, so that my workflow is not disrupted.

#### Acceptance Criteria

1. THE Backend_API SHALL support all existing Slack slash commands (/habit-done, /habit-status, /habit-list, /habit-dashboard)
2. THE Backend_API SHALL support all existing Slack interactive components (Done, Skip, Remind Later, Increment buttons)
3. THE Backend_API SHALL support JWT authentication with Supabase (ES256, HS256) and Cognito (RS256)
4. THE Backend_API SHALL support weekly report generation with timezone-aware scheduling
5. THE Backend_API SHALL support reminder and follow-up notifications
6. THE Backend_API SHALL support token encryption for Slack credentials

### Requirement 12: Incremental Migration Support

**User Story:** As a system operator, I want to run both backends during transition, so that I can gradually migrate traffic.

#### Acceptance Criteria

1. THE Backend_API SHALL be deployable alongside the Python backend
2. THE Backend_API SHALL use the same database (Supabase) as the Python backend
3. THE Backend_API SHALL use the same environment variable names as the Python backend
4. THE Backend_API SHALL produce compatible log formats for CloudWatch
5. THE Backend_API SHALL support feature flags to enable/disable specific endpoints
