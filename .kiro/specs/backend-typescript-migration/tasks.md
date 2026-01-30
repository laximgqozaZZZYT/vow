# Implementation Plan: Backend Refactoring and TypeScript Migration

## Overview

This implementation plan covers a two-phase approach:
- **Phase 1**: Refactor the existing Python backend to improve code quality, testability, and maintainability
- **Phase 2**: Migrate the refactored Python backend to TypeScript

## Tasks

### Phase 1: Python Refactoring

- [x] 1. Set up error handling infrastructure
  - [x] 1.1 Create error hierarchy in `app/errors/__init__.py`
    - Define AppError base class with status_code, code, is_retryable attributes
    - Define AuthenticationError, TokenExpiredError, SlackAPIError, RateLimitError, DataFetchError, ConnectionError, ValidationError
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 1.2 Create centralized error handler in `app/errors/handler.py`
    - Implement app_error_handler for FastAPI exception handling
    - Implement get_user_friendly_message for Japanese error messages
    - _Requirements: 4.4, 4.5, 4.6_
  
  - [ ]* 1.3 Write unit tests for error handling
    - Test error classification (retryable vs non-retryable)
    - Test user-friendly message generation
    - **Property 3: Error Classification**
    - **Property 4: User-Friendly Error Messages**
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 2. Create repository layer
  - [x] 2.1 Create base repository in `app/repositories/base.py`
    - Implement BaseRepository with generic CRUD operations
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 2.2 Create HabitRepository in `app/repositories/habit.py`
    - Implement get_active_do_habits, find_by_name, search_by_name methods
    - _Requirements: 3.4_
  
  - [x] 2.3 Create ActivityRepository in `app/repositories/activity.py`
    - Implement get_activities_in_range, get_habit_activities, has_completion_today methods
    - _Requirements: 3.5_
  
  - [x] 2.4 Create GoalRepository in `app/repositories/goal.py`
    - Implement get_by_id, get_by_owner methods
    - _Requirements: 3.6_
  
  - [x] 2.5 Refactor SlackRepository to follow base pattern
    - Ensure consistency with other repositories
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ]* 2.6 Write unit tests for repositories
    - Test CRUD operations with mocked Supabase client
    - **Property 1: Repository CRUD Consistency**
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Set up dependency injection
  - [x] 3.1 Create dependencies module in `app/dependencies.py`
    - Define get_supabase, get_slack_repository, get_habit_repository, get_activity_repository, get_goal_repository
    - Define get_slack_service, get_habit_completion_reporter, get_daily_progress_calculator
    - _Requirements: 2.2, 2.6_
  
  - [ ]* 3.2 Write tests for dependency injection
    - Test that services receive correct dependencies
    - **Property 2: Service Dependency Isolation**
    - _Requirements: 2.6_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Refactor service layer
  - [x] 5.1 Refactor HabitCompletionReporter to use repositories
    - Remove direct Supabase calls
    - Inject HabitRepository, ActivityRepository, GoalRepository
    - _Requirements: 2.2_
  
  - [x] 5.2 Refactor DailyProgressCalculator to use repositories
    - Remove direct Supabase calls
    - Inject HabitRepository, ActivityRepository, GoalRepository
    - _Requirements: 2.3_
  
  - [x] 5.3 Refactor WeeklyReportGenerator to use repositories
    - Remove direct Supabase calls
    - Inject SlackRepository, HabitRepository, ActivityRepository
    - _Requirements: 2.4_
  
  - [x] 5.4 Refactor FollowUpAgent to use repositories
    - Remove direct Supabase calls
    - Inject SlackRepository
    - _Requirements: 2.5_
  
  - [ ]* 5.5 Write unit tests for refactored services
    - Test with mocked repositories
    - Test streak calculation
    - Test progress calculation
    - **Property 9: Streak Calculation**
    - **Property 10: Duplicate Completion Detection**
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 6. Refactor router layer
  - [x] 6.1 Refactor slack_webhook.py to use dependency injection
    - Use Depends() for services and repositories
    - Move business logic to services
    - _Requirements: 1.3_
  
  - [x] 6.2 Refactor slack_interactions.py to use dependency injection
    - Use Depends() for services and repositories
    - Move business logic to services
    - _Requirements: 1.3_
  
  - [x] 6.3 Refactor slack_oauth.py to use dependency injection
    - Use Depends() for services and repositories
    - _Requirements: 1.3_
  
  - [ ]* 6.4 Write integration tests for routers
    - Test with mocked dependencies
    - Test error handling
    - _Requirements: 1.3_

- [x] 7. Improve logging
  - [x] 7.1 Ensure all modules use structured logger
    - Replace print statements with logger calls
    - Add context to all log entries
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  
  - [ ]* 7.2 Write tests for logging
    - Test log format is valid JSON
    - Test Lambda context inclusion
    - **Property 5: Structured Log Format**
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 8. Add type hints and docstrings
  - [x] 8.1 Add type hints to all functions and methods
    - Use typing module for complex types
    - _Requirements: 1.4_
  
  - [x] 8.2 Add docstrings to all public functions and classes
    - Follow Google docstring format
    - _Requirements: 1.6_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Property-based tests for Phase 1
  - [ ]* 10.1 Write property test for daily progress time boundaries
    - Use hypothesis to generate random activities
    - **Property 7: Daily Progress Calculation - Time Boundaries**
    - _Requirements: 7.1_
  
  - [ ]* 10.2 Write property test for amount summation
    - Use hypothesis to generate random amounts
    - **Property 8: Daily Progress Calculation - Amount Summation**
    - _Requirements: 7.2, 7.3_
  
  - [ ]* 10.3 Write property test for Slack signature verification
    - Use hypothesis to generate random payloads
    - **Property 6: Slack Signature Verification**
    - _Requirements: 4.7, 4.8_
  
  - [ ]* 10.4 Write property test for retry behavior
    - Test exponential backoff timing
    - **Property 11: Retry Behavior**
    - _Requirements: 11.1, 11.2_
  
  - [ ]* 10.5 Write property test for token encryption
    - Test round-trip encryption/decryption
    - **Property 13: Token Encryption Round-Trip**
    - _Requirements: 14.1, 14.2_

- [x] 11. Final checkpoint for Phase 1
  - Ensure all tests pass, ask the user if questions arise.
  - Verify 80% code coverage target

### Phase 2: TypeScript Migration

- [x] 12. Set up TypeScript project
  - [x] 12.1 Initialize TypeScript project with package.json
    - Configure dependencies: hono, zod, @supabase/supabase-js, jose
    - Configure dev dependencies: typescript, vitest, fast-check
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [x] 12.2 Configure TypeScript with tsconfig.json
    - Enable strict mode
    - Configure paths and module resolution
    - _Requirements: 9.1_
  
  - [x] 12.3 Create project directory structure
    - Create src/middleware, src/routers, src/services, src/repositories, src/schemas, src/errors, src/utils
    - _Requirements: 9.5_

- [x] 13. Implement core infrastructure
  - [x] 13.1 Create configuration module (src/config.ts)
    - Use Zod for environment variable validation
    - _Requirements: 9.3_
  
  - [x] 13.2 Create error types (src/errors/index.ts)
    - Port Python error hierarchy to TypeScript
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 13.3 Create structured logger (src/utils/logger.ts)
    - Port Python structured logger to TypeScript
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 13.4 Create retry utility (src/utils/retry.ts)
    - Port Python retry logic to TypeScript
    - _Requirements: 11.1, 11.2_
  
  - [x] 13.5 Create encryption utility (src/utils/encryption.ts)
    - Port Python encryption to TypeScript using Web Crypto API
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [x] 14. Implement Zod schemas
  - [x] 14.1 Create Slack schemas (src/schemas/slack.ts)
    - Define slackConnectionSchema, slashCommandPayloadSchema, interactionPayloadSchema
    - _Requirements: 9.3_
  
  - [x] 14.2 Create Habit schemas (src/schemas/habit.ts)
    - Define habitSchema, habitProgressSchema, activitySchema
    - _Requirements: 9.3_
  
  - [x]* 14.3 Write tests for schema validation
    - Test valid and invalid inputs
    - _Requirements: 9.3_

- [x] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Implement repository layer
  - [x] 16.1 Create base repository (src/repositories/base.ts)
    - Port Python BaseRepository to TypeScript
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 16.2 Create SlackRepository (src/repositories/slackRepository.ts)
    - Port Python SlackRepository to TypeScript
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 16.3 Create HabitRepository (src/repositories/habitRepository.ts)
    - Port Python HabitRepository to TypeScript
    - _Requirements: 3.4_
  
  - [x] 16.4 Create ActivityRepository (src/repositories/activityRepository.ts)
    - Port Python ActivityRepository to TypeScript
    - _Requirements: 3.5_
  
  - [x]* 16.5 Write unit tests for repositories
    - Test with mocked Supabase client
    - **Property 1: Repository CRUD Consistency**
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 17. Implement service layer
  - [x] 17.1 Create SlackIntegrationService (src/services/slackService.ts)
    - Port Python SlackIntegrationService to TypeScript
    - _Requirements: 4.1, 4.7, 4.8, 4.9, 4.10_
  
  - [x] 17.2 Create HabitCompletionReporter (src/services/habitCompletionReporter.ts)
    - Port Python HabitCompletionReporter to TypeScript
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  
  - [x] 17.3 Create DailyProgressCalculator (src/services/dailyProgressCalculator.ts)
    - Port Python DailyProgressCalculator to TypeScript
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  
  - [x] 17.4 Create WeeklyReportGenerator (src/services/weeklyReportGenerator.ts)
    - Port Python WeeklyReportGenerator to TypeScript
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [x]* 17.5 Write unit tests for services
    - Test with mocked repositories
    - **Property 9: Streak Calculation**
    - **Property 10: Duplicate Completion Detection**
    - _Requirements: 8.2, 8.3_

- [x] 18. Implement middleware
  - [x] 18.1 Create JWT auth middleware (src/middleware/auth.ts)
    - Port Python JWTAuthMiddleware to TypeScript
    - Support ES256, HS256, RS256 algorithms
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_
  
  - [x] 18.2 Create CORS middleware (src/middleware/cors.ts)
    - Configure CORS for Hono
    - _Requirements: 10.5_
  
  - [x]* 18.3 Write tests for middleware
    - Test JWT validation with various tokens
    - Test path exclusion
    - _Requirements: 3.1, 3.6, 3.7_

- [x] 19. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Implement routers
  - [x] 20.1 Create health router (src/routers/health.ts)
    - Port Python health router to TypeScript
    - _Requirements: 10.1_
  
  - [x] 20.2 Create Slack OAuth router (src/routers/slackOAuth.ts)
    - Port Python slack_oauth router to TypeScript
    - _Requirements: 10.1, 10.2_
  
  - [x] 20.3 Create Slack commands router (src/routers/slackCommands.ts)
    - Port Python slack_webhook router to TypeScript
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
  
  - [x] 20.4 Create Slack interactions router (src/routers/slackInteractions.ts)
    - Port Python slack_interactions router to TypeScript
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [x]* 20.5 Write integration tests for routers
    - Test API contract compatibility
    - **Property 12: API Contract Compatibility**
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 21. Implement Lambda handler
  - [x] 21.1 Create Hono app entry point (src/index.ts)
    - Configure middleware and routers
    - _Requirements: 9.2_
  
  - [x] 21.2 Create Lambda handler (src/lambda.ts)
    - Handle API Gateway and EventBridge events
    - Register cleanup handlers
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [x]* 21.3 Write tests for Lambda handler
    - Test event routing
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 22. Property-based tests for Phase 2
  - [x]* 22.1 Write property test for daily progress time boundaries
    - Use fast-check to generate random activities
    - **Property 7: Daily Progress Calculation - Time Boundaries**
    - _Requirements: 7.1_
  
  - [x]* 22.2 Write property test for amount summation
    - Use fast-check to generate random amounts
    - **Property 8: Daily Progress Calculation - Amount Summation**
    - _Requirements: 7.2, 7.3_
  
  - [x]* 22.3 Write property test for Slack signature verification
    - Use fast-check to generate random payloads
    - **Property 6: Slack Signature Verification**
    - _Requirements: 4.7, 4.8_
  
  - [x]* 22.4 Write property test for token encryption
    - Test round-trip encryption/decryption
    - **Property 13: Token Encryption Round-Trip**
    - _Requirements: 14.1, 14.2_

- [x] 23. Final checkpoint for Phase 2
  - Ensure all tests pass, ask the user if questions arise.
  - Verify 80% code coverage target
  - Verify API contract compatibility with Python backend

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Phase 1 must be completed before starting Phase 2
