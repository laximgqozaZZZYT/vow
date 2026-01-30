# Implementation Plan: Embeddable Dashboard Widgets

## Overview

This implementation plan creates embeddable dashboard widgets with API key authentication. The work is organized into phases: database setup, backend services, API endpoints, frontend embed pages, and testing.

## Tasks

- [x] 1. Database Schema and Migrations
  - [x] 1.1 Create api_keys table migration
    - Create migration file in supabase/migrations/
    - Define table with id, user_id, key_hash, key_prefix, name, timestamps, is_active
    - Add indexes for key_hash and user_id lookups
    - Enable RLS with policies for user access
    - _Requirements: 1.1, 1.2_
  
  - [x] 1.2 Create rate_limits table migration
    - Create migration file for rate limiting storage
    - Define table with key_id, window_start, request_count
    - Add unique constraint on (key_id, window_start)
    - Add index for fast lookups
    - _Requirements: 3.1, 3.3_

- [x] 2. Backend API Key Service
  - [x] 2.1 Create API key Zod schemas
    - Create backend/src/schemas/apiKey.ts
    - Define apiKeyDbSchema, createApiKeyRequestSchema, apiKeyResponseSchema
    - Define createApiKeyResponseSchema with full key field
    - _Requirements: 1.1, 1.3_
  
  - [x] 2.2 Create ApiKeyRepository
    - Create backend/src/repositories/apiKeyRepository.ts
    - Implement findByKeyHash, findActiveByUserId, countActiveByUserId
    - Implement markRevoked, updateLastUsed methods
    - Extend BaseRepository pattern
    - _Requirements: 1.2, 1.4_
  
  - [x] 2.3 Create ApiKeyService
    - Create backend/src/services/apiKeyService.ts
    - Implement createKey with crypto-secure generation
    - Implement validateKey with hash comparison
    - Implement listKeys with masked values
    - Implement revokeKey and countActiveKeys
    - Enforce 5-key limit per user
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x]* 2.4 Write property tests for ApiKeyService
    - **Property 1: API Key Uniqueness**
    - **Property 2: API Key Lifecycle Round-Trip**
    - **Property 3: API Key Listing Masks Full Keys**
    - **Property 4: API Key Limit Enforcement**
    - **Property 7: API Key Hash Determinism**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.4**

- [x] 3. Checkpoint - API Key Service
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Backend Rate Limiter
  - [x] 4.1 Create RateLimiter service
    - Create backend/src/middleware/rateLimiter.ts
    - Implement sliding window algorithm
    - Implement checkLimit and recordRequest methods
    - Return remaining count and reset time
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 4.2 Create rate limit middleware
    - Create middleware factory function
    - Configure 100 requests per 60 seconds
    - Return 429 with Retry-After header when exceeded
    - _Requirements: 3.1, 3.2_
  
  - [ ]* 4.3 Write property tests for RateLimiter
    - **Property 8: Rate Limit Enforcement**
    - **Validates: Requirements 3.1, 3.3**

- [x] 5. Backend API Key Authentication
  - [x] 5.1 Create API key auth middleware
    - Create backend/src/middleware/apiKeyAuth.ts
    - Extract X-API-Key header
    - Validate key using ApiKeyService
    - Set apiKeyUserId and apiKeyId in context
    - Return 401 for missing/invalid keys
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [ ]* 5.2 Write property tests for API key auth
    - **Property 5: Valid API Key Authentication**
    - **Property 6: Invalid API Key Rejection**
    - **Validates: Requirements 2.1, 2.2**

- [x] 6. Checkpoint - Authentication and Rate Limiting
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Backend Widget API Endpoints
  - [x] 7.1 Create Widget Router
    - Create backend/src/routers/widgets.ts
    - Apply apiKeyAuthMiddleware and rateLimitMiddleware
    - Configure CORS for widget endpoints
    - _Requirements: 7.1, 7.2_
  
  - [x] 7.2 Implement widget data endpoints
    - GET /api/widgets/progress using DashboardDataService.getDailyProgress
    - GET /api/widgets/stats using DashboardDataService.getStatistics
    - GET /api/widgets/next using DashboardDataService.getNextHabits
    - GET /api/widgets/stickies using DashboardDataService.getStickies
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 7.3 Implement habit completion endpoint
    - POST /api/widgets/habits/:habitId/complete
    - Validate habitId belongs to API key owner
    - Create activity record with amount
    - Return updated progress data
    - _Requirements: 5.1, 5.3, 5.4_
  
  - [x] 7.4 Implement sticky toggle endpoint
    - POST /api/widgets/stickies/:stickyId/toggle
    - Validate stickyId belongs to API key owner
    - Toggle completion status
    - Return updated sticky data
    - _Requirements: 5.2, 5.3, 5.4_
  
  - [ ]* 7.5 Write property tests for Widget API
    - **Property 9: Widget Endpoints Schema Validation**
    - **Property 10: Habit Completion Activity Creation**
    - **Property 11: Sticky Toggle Round-Trip**
    - **Property 12: Cross-User Resource Access Forbidden**
    - **Property 15: CORS Headers Present**
    - **Validates: Requirements 4.1-4.5, 5.1-5.4, 7.1**

- [x] 8. Backend API Key Management Endpoints
  - [x] 8.1 Create API Key Router
    - Create backend/src/routers/apiKeys.ts
    - Apply jwtAuthMiddleware for user authentication
    - _Requirements: 1.1, 1.3, 1.4_
  
  - [x] 8.2 Implement API key CRUD endpoints
    - GET /api/api-keys - List user's API keys
    - POST /api/api-keys - Create new API key
    - DELETE /api/api-keys/:keyId - Revoke API key
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

- [x] 9. Checkpoint - Backend Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Frontend Embed Pages
  - [x] 10.1 Create embed layout
    - Create frontend/app/embed/layout.tsx
    - Minimal layout without navigation
    - Set X-Frame-Options header to allow embedding
    - Support theme parameter
    - _Requirements: 6.4, 7.3, 8.1_
  
  - [x] 10.2 Create widget API client
    - Create frontend/app/embed/lib/widgetApi.ts
    - Implement fetch functions for each widget endpoint
    - Handle API key authentication
    - Handle error responses
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 10.3 Create embed widget components
    - Create frontend/app/embed/components/Widget.Progress.tsx
    - Create frontend/app/embed/components/Widget.Stats.tsx
    - Create frontend/app/embed/components/Widget.Next.tsx
    - Create frontend/app/embed/components/Widget.Stickies.tsx
    - Use design system tokens for styling
    - Support light/dark themes
    - _Requirements: 6.4, 8.1, 8.2, 8.3, 8.4_
  
  - [x] 10.4 Create embed pages
    - Create frontend/app/embed/progress/page.tsx
    - Create frontend/app/embed/stats/page.tsx
    - Create frontend/app/embed/next/page.tsx
    - Create frontend/app/embed/stickies/page.tsx
    - Read apiKey and theme from query parameters
    - Display error for invalid/missing API key
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  
  - [ ]* 10.5 Write tests for embed pages
    - **Property 13: Embed Page Authentication Behavior**
    - **Property 14: Theme Parameter Rendering**
    - **Validates: Requirements 6.2, 6.3, 6.5**

- [x] 11. Frontend API Key Management UI
  - [x] 11.1 Create API key management page
    - Create frontend/app/dashboard/settings/api-keys/page.tsx
    - Display list of user's API keys
    - Show key prefix, name, created date, last used
    - _Requirements: 1.3_
  
  - [x] 11.2 Implement key creation UI
    - Add "Create API Key" button and modal
    - Input field for key name
    - Display full key once after creation (copy to clipboard)
    - Show warning that key won't be shown again
    - _Requirements: 1.1_
  
  - [x] 11.3 Implement key revocation UI
    - Add revoke button for each key
    - Confirmation dialog before revocation
    - Update list after revocation
    - _Requirements: 1.4_

- [x] 12. Integration and Wiring
  - [x] 12.1 Mount routers in main app
    - Add widget router to backend/src/index.ts
    - Add API key router to backend/src/index.ts
    - Update CORS configuration for widget endpoints
    - _Requirements: 7.1, 7.2_
  
  - [x] 12.2 Add navigation to API key settings
    - Add link to API key management in dashboard settings
    - _Requirements: 1.3_

- [x] 13. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verify embed pages work in iframe context
  - Test API key creation, usage, and revocation flow

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation uses TypeScript throughout (backend and frontend)
