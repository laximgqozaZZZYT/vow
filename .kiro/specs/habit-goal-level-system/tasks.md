# Implementation Plan: Habit and Goal Level System with THLI-24

## Overview

This implementation plan breaks down the Habit and Goal Level System into discrete, incremental tasks. Each task builds on previous work and includes testing to validate functionality early. The plan follows a bottom-up approach: database schema → core services → API routes → UI components → scheduled jobs.

## Tasks

- [x] 1. Database Schema Setup
  - Create migrations for level-related fields in habits and goals tables
  - Create level_history, level_suggestions, thli_validation_log tables
  - Add indexes for performance
  - Update RLS policies for new tables
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ]* 1.1 Write property test for schema constraints
  - **Property 1: Level Field Constraints**
  - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 2. THLI-24 Prompt Template Setup
  - Create backend/src/specs/ai-coach/thli-24-v1.9-prompt.md with full THLI-24 v1.9 specification
  - Create backend/src/specs/ai-coach/thli-24-v1.9-prompt-ja.md with Japanese localization
  - Extend SpecLoader to support THLI-24 prompt loading with caching
  - Add prompt validation logic (check for required sections)
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.6, 15.1, 15.2_

- [ ]* 2.1 Write unit test for prompt template validation
  - Test that validation catches missing sections
  - Test that Japanese and English prompts load correctly
  - **Validates: Requirements 11.3**

- [x] 3. Core Data Models and Types
  - Create TypeScript interfaces for HabitFacts, FactValue, THLIVariable, LevelEstimate
  - Create interfaces for AssessmentSession, AssessmentStep, VOIQuestion
  - Create interfaces for BabyStepPlan, WorkloadChanges, LevelChange
  - Create interfaces for QuotaStatus, LevelSuggestion
  - Add type guards and validation functions
  - _Requirements: All (foundational types)_

- [x] 4. THLI Assessment Service - Core Logic
  - [x] 4.1 Implement THLIAssessmentService class with initiateAssessment()
    - Load THLI-24 prompt template
    - Inject habit context (name, workload, goal)
    - Create assessment session
    - Check user quota before starting
    - _Requirements: 2.1, 4.2, 11.7, 15.5_

  - [x] 4.2 Implement continueAssessment() for multi-turn conversation
    - Parse user responses to extract fact values
    - Determine U-type and E-type for each fact
    - Track gathered facts in session state
    - Decide next question or move to scoring
    - _Requirements: 2.1, 10.6_

  - [x] 4.3 Implement ICI calculation
    - Count U0 facts in core fact set
    - Calculate ICI = count / 14
    - _Requirements: 2.2_

  - [ ]* 4.3.1 Write property test for ICI calculation
    - **Property 4: ICI Calculation Correctness**
    - **Validates: Requirements 2.2**

  - [x] 4.4 Implement Missingness Firewall logic
    - Check ICI < 0.6
    - Check for U4 facts
    - Check No-Inference facts (F04, F13, F14, F16)
    - Check AB_used > 6
    - Prevent scoring if any condition met
    - _Requirements: 2.3, 2.8_

  - [ ]* 4.4.1 Write property test for Firewall triggering
    - **Property 5: Missingness Firewall Triggering**
    - **Validates: Requirements 2.3, 2.8**

  - [ ]* 4.4.2 Write unit test for Firewall edge cases
    - Test ICI = 0.59 (should trigger)
    - Test ICI = 0.60 (should not trigger)
    - Test U4 fact detection
    - Test No-Inference fact validation

  - [x] 4.5 Implement THLI-24 scoring algorithm
    - Score all 24 variables using rubrics
    - Use discrete score set {0.0, 1.4, 2.8, 4.1, 5.5, 6.9, 8.3}
    - Calculate O/E/C level estimates
    - Apply Range Justification Contract
    - Assign stoplight status (green/yellow/red)
    - _Requirements: 2.4, 2.5_

  - [ ]* 4.5.1 Write property test for discrete score set
    - **Property 6: Discrete Score Set Validation**
    - **Validates: Requirements 2.4, 18.5**

  - [x] 4.6 Implement VOI question generation
    - Calculate ΔLv_upper for each missing fact
    - Rank questions by impact
    - Return maximum 5 questions
    - _Requirements: 2.7_

  - [ ]* 4.6.1 Write property test for VOI ranking
    - **Property 7: VOI Question Ranking and Limiting**
    - **Validates: Requirements 2.7**

  - [x] 4.7 Implement cross-framework validation
    - Calculate NASA-TLX score (6 dimensions)
    - Calculate SRBAI automaticity score (4 prompts)
    - Map to COM-B framework
    - Check for deviations > 20 points
    - Set gate status (pass/fail)
    - _Requirements: 12.1, 12.2_

  - [ ]* 4.7.1 Write property test for cross-framework gate
    - **Property 31: Cross-Framework Gate Failure Detection**
    - **Validates: Requirements 12.2**

  - [x] 4.8 Implement assessment data storage
    - Store complete assessment in level_assessment_data JSONB
    - Update habit.level and habit.level_tier
    - Record in level_history table
    - Log to thli_validation_log
    - _Requirements: 1.4, 1.5, 12.4_

  - [ ]* 4.8.1 Write property test for assessment data completeness
    - **Property 2: Assessment Data Completeness**
    - **Validates: Requirements 1.4, 2.5**

  - [ ]* 4.8.2 Write property test for level change history
    - **Property 3: Level Change History Invariant**
    - **Validates: Requirements 1.5, 5.4, 6.6**

  - [ ]* 4.8.3 Write property test for validation logging
    - **Property 32: Cross-Framework Validation Logging**
    - **Validates: Requirements 12.4**

- [x] 5. Checkpoint - THLI Assessment Service Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Baby Step Generator Service
  - [x] 6.1 Implement calculateVariableReductions()
    - Calculate points to reduce (current_level - target_level)
    - Apply reduction priority order (⑱, ⑬, ⑫, ⑪, ⑩)
    - Generate VariableReduction objects
    - _Requirements: 16.2_

  - [ ]* 6.1.1 Write property test for reduction priority
    - **Property 36: Variable Reduction Priority Order**
    - **Validates: Requirements 16.2**

  - [x] 6.2 Implement frequency reduction transformations
    - daily→3x/week (reduces 2.8 points)
    - 3x/week→weekly (reduces 1.4 points)
    - weekly→biweekly (reduces 1.4 points)
    - _Requirements: 16.3_

  - [ ]* 6.2.1 Write property test for frequency transformations
    - **Property 37: Frequency Reduction Transformations**
    - **Validates: Requirements 16.3**

  - [x] 6.3 Implement duration reduction transformations
    - >60min→30min (reduces 2.8 points)
    - 30min→15min (reduces 1.4 points)
    - 15min→5min (reduces 1.4 points)
    - _Requirements: 16.4_

  - [ ]* 6.3.1 Write property test for duration transformations
    - **Property 38: Duration Reduction Transformations**
    - **Validates: Requirements 16.4**

  - [x] 6.4 Implement generateBabySteps() for Lv.50 and Lv.10
    - Calculate Lv.50 target (current * 0.5)
    - Calculate Lv.10 target (≤10)
    - Generate both plans with complete fields
    - _Requirements: 6.2, 6.3, 16.1_

  - [ ]* 6.4.1 Write property test for Lv.50 target calculation
    - **Property 19: Lv.50 Target Level Calculation**
    - **Validates: Requirements 6.3, 16.1**

  - [ ]* 6.4.2 Write property test for baby step plan completeness
    - **Property 18: Baby Step Plan Generation Completeness**
    - **Validates: Requirements 6.2**

  - [x] 6.5 Implement generateMinimalHabit() for Lv.10
    - Create cue, action, stop condition, fallback
    - Apply 2-minute rule
    - Preserve habit's core identity
    - _Requirements: 6.4, 16.5_

  - [ ]* 6.5.1 Write property test for Lv.10 structure
    - **Property 20: Lv.10 Minimal Habit Structure**
    - **Validates: Requirements 6.4, 16.5**

- [x] 7. Usage Quota Service
  - [x] 7.1 Implement checkQuota()
    - Query token_quotas for current period
    - Calculate remaining assessments
    - Handle unlimited (quota_limit = -1)
    - _Requirements: 7.3_

  - [x] 7.2 Implement consumeAssessment()
    - Increment quota_used by 1
    - Only on successful assessment completion
    - _Requirements: 7.6, 4.5_

  - [ ]* 7.2.1 Write property test for quota increment
    - **Property 13: Quota Increment on Success Only**
    - **Validates: Requirements 4.5, 7.6**

  - [x] 7.3 Implement quota enforcement
    - Block assessment if quota_used >= quota_limit
    - Return error with upgrade_required: true
    - _Requirements: 7.4_

  - [ ]* 7.3.1 Write property test for quota enforcement
    - **Property 11: Quota Enforcement During Assessment**
    - **Validates: Requirements 3.5, 7.4**

  - [x] 7.4 Implement resetMonthlyQuotas()
    - Create new quota periods for new month
    - Set quota_used = 0
    - Preserve quota_limit
    - _Requirements: 7.5_

  - [ ]* 7.4.1 Write property test for quota reset
    - **Property 23: Monthly Quota Reset**
    - **Validates: Requirements 7.5**

  - [x] 7.5 Add quota initialization for new users
    - Free users: quota_limit = 10
    - Premium users: quota_limit = -1
    - _Requirements: 7.1, 7.2_

  - [ ]* 7.5.1 Write property test for quota allocation
    - **Property 21: Free User Quota Allocation**
    - **Property 22: Premium User Unlimited Quota**
    - **Validates: Requirements 7.1, 7.2**

- [x] 8. Level Manager Service
  - [x] 8.1 Implement detectLevelUpCandidates()
    - Query habits with completion_rate >= 0.9 over 30 days
    - Filter by days_since_last_level_change >= 30
    - Filter by level IS NOT NULL
    - _Requirements: 5.1, 17.2_

  - [ ]* 8.1.1 Write property test for level-up detection
    - **Property 15: Level-Up Candidate Detection**
    - **Validates: Requirements 5.1, 17.2**

  - [x] 8.2 Implement detectLevelDownCandidates()
    - Query habits with completion_rate < 0.5 over 14 days
    - Filter by days_active >= 14
    - Filter by level IS NOT NULL
    - _Requirements: 6.1, 17.3_

  - [ ]* 8.2.1 Write property test for level-down detection
    - **Property 17: Level-Down Candidate Detection**
    - **Validates: Requirements 6.1, 17.3**

  - [x] 8.3 Implement applyLevelUp()
    - Update habit workload fields
    - Update habit.level
    - Record in level_history with reason "level_up_progression"
    - _Requirements: 5.4_

  - [x] 8.4 Implement applyLevelDown()
    - Update habit fields based on baby step plan
    - Update habit.level
    - Record in level_history with reason "level_down_baby_step_lv50" or "lv10"
    - _Requirements: 6.6_

  - [x] 8.5 Implement getLevelHistory()
    - Query level_history for entity
    - Sort by assessed_at DESC
    - Apply filters (date range, change type)
    - _Requirements: 9.1, 9.4_

  - [ ]* 8.5.1 Write property test for history sorting
    - **Property 25: Level History Sorting**
    - **Validates: Requirements 9.1**

  - [ ]* 8.5.2 Write property test for history filtering
    - **Property 26: Level History Filtering**
    - **Validates: Requirements 9.4**

  - [x] 8.6 Implement level-up frequency limit check
    - Ensure no level-up within 30 days of last change
    - _Requirements: 5.5_

  - [ ]* 8.6.1 Write property test for frequency limit
    - **Property 16: Level-Up Frequency Limit**
    - **Validates: Requirements 5.5**

- [x] 9. AI Coach Integration
  - [x] 9.1 Add THLI-24 function calling tools to COACH_TOOLS array
    - assess_habit_level(habit_id, conversation_context)
    - suggest_baby_steps(habit_id, target_level)
    - suggest_level_up(habit_id)
    - _Requirements: 10.5_

  - [x] 9.2 Implement assess_habit_level tool handler
    - Call THLIAssessmentService.initiateAssessment()
    - Return first audit question
    - Store conversation context
    - _Requirements: 10.6_

  - [x] 9.3 Implement suggest_baby_steps tool handler
    - Call BabyStepGeneratorService.generateBabySteps()
    - Format plans for user display
    - _Requirements: 10.5_

  - [x] 9.4 Implement suggest_level_up tool handler
    - Call LevelManagerService to calculate target level
    - Propose workload increases
    - _Requirements: 10.5_

  - [x] 9.5 Extend PersonalizationEngine to include level context
    - Add user's habit levels to context
    - Add level distribution to context
    - _Requirements: 10.1_

  - [x] 9.6 Update PromptBuilder to inject THLI-24 context
    - Inject habit name, workload, goal context
    - Replace placeholders in prompt template
    - _Requirements: 10.2, 11.7, 15.5_

  - [ ]* 9.6.1 Write property test for context injection
    - **Property 30: Prompt Context Injection**
    - **Property 34: Context Value Injection Correctness**
    - **Validates: Requirements 11.7, 15.5**

- [x] 10. Checkpoint - Core Services Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. API Routes Implementation
  - [x] 11.1 Implement POST /api/habits/:id/assess-level
    - Validate habit ownership
    - Check quota
    - Call THLIAssessmentService.initiateAssessment()
    - Return assessment session
    - _Requirements: 13.1_

  - [x] 11.2 Implement GET /api/habits/:id/level-history
    - Validate habit ownership
    - Call LevelManagerService.getLevelHistory()
    - Return level changes array
    - _Requirements: 13.2_

  - [x] 11.3 Implement POST /api/habits/:id/accept-baby-step
    - Validate habit ownership
    - Call LevelManagerService.applyLevelDown()
    - Return updated habit
    - _Requirements: 13.3_

  - [x] 11.4 Implement POST /api/habits/:id/accept-level-up
    - Validate habit ownership
    - Call LevelManagerService.applyLevelUp()
    - Return updated habit
    - _Requirements: 13.4_

  - [x] 11.5 Implement GET /api/users/:id/thli-quota
    - Validate user identity
    - Call UsageQuotaService.checkQuota()
    - Return quota status
    - _Requirements: 13.5_

  - [x] 11.6 Implement GET /api/habits/:id/level-details
    - Validate habit ownership
    - Return full assessment data from level_assessment_data
    - _Requirements: 13.6_

  - [ ]* 11.7 Write integration tests for API routes
    - Test authentication and authorization
    - Test error responses
    - Test happy paths

- [x] 12. Frontend UI Components
  - [x] 12.1 Create LevelBadge component
    - Display level number and tier
    - Use tier-specific colors (beginner: green, intermediate: blue, advanced: orange, expert: red)
    - Show "Not Assessed" for NULL levels
    - Responsive design (compact on mobile)
    - _Requirements: 8.1, 8.2, 8.5, 8.6, 14.1, 14.2, 14.5, 14.6_

  - [x] 12.2 Create Modal.LevelDetails component
    - Display full THLI-24 assessment details
    - Show all 24 variables with scores and stoplights
    - Show O/E/C estimates
    - Show cross-framework scores
    - Show assessment timestamp
    - _Requirements: 8.3, 14.3_

  - [x] 12.3 Create Modal.AssessmentResult component
    - Display O/E/C level estimates
    - Show recommended starting workload
    - Explain what the level means
    - _Requirements: 4.3_

  - [x] 12.4 Create Modal.BabyStepPlan component
    - Display Lv.50 and Lv.10 plans side-by-side
    - Show comparison table of variable changes
    - Allow user to select and accept a plan
    - _Requirements: 6.5, 16.7_

  - [x] 12.5 Create Section.LevelHistory component
    - Display vertical timeline of level changes
    - Show date, old→new level, delta, reason
    - Expandable workload changes
    - Filter controls (date range, change type)
    - Export to CSV button
    - Empty state message
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 14.7_

  - [ ]* 12.5.1 Write property test for CSV export
    - **Property 27: Level History CSV Export Completeness**
    - **Validates: Requirements 9.5**

  - [x] 12.6 Create Widget.QuotaStatus component
    - Display remaining THLI assessments
    - Show "X/10 remaining" for free users
    - Show "無制限" for premium users
    - Link to upgrade page
    - _Requirements: 7.7_

  - [x] 12.7 Integrate LevelBadge into habit cards
    - Position in top-right corner
    - Add click handler to open Modal.LevelDetails
    - Show delta indicator for recent changes
    - _Requirements: 8.7_

  - [x] 12.8 Add "Assess Level" button to habit creation flow
    - Show quota status
    - Open AI coach chat with pre-filled message
    - _Requirements: 4.1_

  - [x] 12.9 Implement goal level aggregation display
    - Calculate MAX(child_habit_levels)
    - Display aggregated level badge on goal cards
    - _Requirements: 8.4_

  - [ ]* 12.9.1 Write property test for goal level aggregation
    - **Property 24: Goal Level Aggregation**
    - **Validates: Requirements 8.4**

- [x] 13. Habit Inventory Feature
  - [x] 13.1 Create "すべての習慣を評価" button in dashboard
    - Check quota before starting
    - Show confirmation modal with quota cost
    - _Requirements: 3.1_

  - [x] 13.2 Implement batch assessment logic
    - Query unassessed habits
    - Assess sequentially with rate limit (1 per 2 seconds)
    - Handle Firewall-triggered assessments (mark as pending_data)
    - _Requirements: 3.2, 3.3_

  - [ ]* 13.2.1 Write property test for inventory filtering
    - **Property 8: Habit Inventory Filtering**
    - **Validates: Requirements 3.1**

  - [ ]* 13.2.2 Write property test for failed assessment marking
    - **Property 9: Failed Assessment Status Marking**
    - **Validates: Requirements 3.3**

  - [x] 13.3 Implement inventory progress indicator
    - Show "習慣評価中... (3/10 完了)"
    - Show estimated time remaining
    - Allow cancellation (save progress)
    - _Requirements: 3.7_

  - [x] 13.4 Implement inventory summary report
    - Show level distribution histogram
    - Show average level
    - List habits pending data
    - _Requirements: 3.4_

  - [ ]* 13.4.1 Write property test for summary accuracy
    - **Property 10: Inventory Summary Accuracy**
    - **Validates: Requirements 3.4**

  - [x] 13.5 Implement inventory resumption
    - Save progress on interruption
    - Load state and continue from last habit
    - _Requirements: 3.6_

  - [ ]* 13.5.1 Write property test for resumability
    - **Property 12: Inventory Resumability**
    - **Validates: Requirements 3.6**

- [ ] 14. Checkpoint - Frontend Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Scheduled Jobs Implementation
  - [x] 15.1 Create level-up detection job
    - Run daily at 2 AM JST
    - Call LevelManagerService.detectLevelUpCandidates()
    - Create level_suggestions records
    - Log execution to job_execution_log
    - _Requirements: 5.7, 17.1, 17.4, 17.7_

  - [ ]* 15.1.1 Write property test for suggestion creation
    - **Property 39: Level Suggestion Creation on Detection**
    - **Validates: Requirements 17.4**

  - [ ]* 15.1.2 Write property test for job logging
    - **Property 40: Scheduled Job Execution Logging**
    - **Validates: Requirements 17.7**

  - [x] 15.2 Create level-down detection job
    - Run daily at 2 AM JST
    - Call LevelManagerService.detectLevelDownCandidates()
    - Generate baby step plans
    - Create level_suggestions records
    - _Requirements: 17.1, 17.4_

  - [x] 15.3 Create monthly quota reset job
    - Run on first day of each month
    - Call UsageQuotaService.resetMonthlyQuotas()
    - Log execution
    - _Requirements: 7.5_

  - [x] 15.4 Add notification badge for pending suggestions
    - Check for pending level_suggestions on login
    - Display count in dashboard
    - Link to suggestions page
    - _Requirements: 17.5_

  - [x] 15.5 Implement rate limiting in scheduled jobs
    - Process max 100 habits per run
    - 1-second delay between assessments
    - _Requirements: 17.6_

- [x] 16. Error Handling and Resilience
  - [x] 16.1 Implement retry logic with exponential backoff
    - Retry OpenAI API calls up to 3 times
    - Use delays: 2s, 4s, 8s
    - Only retry on retryable errors (429, 5xx)
    - _Requirements: 18.1_

  - [ ]* 16.1.1 Write property test for retry logic
    - **Property 41: API Retry with Exponential Backoff**
    - **Validates: Requirements 18.1**

  - [x] 16.2 Implement conversation state saving on failure
    - Save to failed_assessments table
    - Return resumption token
    - _Requirements: 18.2_

  - [ ]* 16.2.1 Write property test for state preservation
    - **Property 42: Conversation State Preservation on Failure**
    - **Validates: Requirements 18.2**

  - [x] 16.3 Implement assessment resumption
    - Load state from resumption token
    - Continue conversation from last question
    - _Requirements: 18.7_

  - [x] 16.4 Ensure Firewall is not treated as error
    - Return status "needs_more_data" not "failed"
    - Generate VOI questions
    - _Requirements: 18.3_

  - [ ]* 16.4.1 Write property test for Firewall classification
    - **Property 43: Firewall Non-Error Classification**
    - **Validates: Requirements 18.3**

  - [x] 16.5 Implement graceful quota exhaustion handling
    - Complete current assessment even if quota exhausted mid-assessment
    - Block only subsequent attempts
    - _Requirements: 18.4_

  - [ ]* 16.5.1 Write property test for quota exhaustion handling
    - **Property 44: Quota Exhaustion Graceful Handling**
    - **Validates: Requirements 18.4**

  - [x] 16.6 Implement partial success for cross-framework failures
    - Store THLI assessment even if gate fails
    - Add warning flag
    - Update habit level
    - _Requirements: 18.6_

  - [ ]* 16.6.1 Write property test for partial success
    - **Property 45: Cross-Framework Failure Partial Success**
    - **Validates: Requirements 18.6**

- [x] 17. Localization and Prompt Refinement
  - [x] 17.1 Refine THLI-24 prompt with context injection points
    - Add {{HABIT_NAME}}, {{CURRENT_WORKLOAD}}, {{GOAL_CONTEXT}}, {{USER_LEVEL}} placeholders
    - Add category-specific examples (exercise, reading, meditation, learning)
    - _Requirements: 15.4, 15.6_

  - [x] 17.2 Implement language detection and prompt selection
    - Detect user's language preference
    - Load appropriate prompt file (ja or en)
    - _Requirements: 15.2_

  - [ ]* 17.2.1 Write property test for language-based selection
    - **Property 33: Language-Based Prompt Selection**
    - **Validates: Requirements 15.2**

  - [x] 17.3 Validate localized prompt consistency
    - Test sample habits with both prompts
    - Ensure level estimates within ±5 points
    - _Requirements: 15.7_

  - [ ]* 17.3.1 Write property test for prompt consistency
    - **Property 35: Localized Prompt Consistency**
    - **Validates: Requirements 15.7**

- [x] 18. Final Integration and Testing
  - [ ]* 18.1 Run full property test suite (100 iterations each)
    - All 45 properties must pass
    - Fix any failures

  - [ ]* 18.2 Run integration test suite
    - End-to-end assessment flow
    - Level-up flow
    - Level-down flow
    - Quota enforcement flow

  - [ ]* 18.3 Run performance tests
    - Batch inventory of 100 habits < 5 minutes
    - Level history query < 100ms
    - API response times < 300ms

  - [x] 18.4 Manual testing checklist
    - Create habit → Assess level → View details → Check history
    - Trigger level-up → Accept → Verify workload increased
    - Trigger level-down → Accept Lv.50 → Verify habit simplified
    - Exhaust quota → Verify blocked → Upgrade → Verify unblocked
    - Test Japanese and English prompts

- [ ] 19. Final Checkpoint - All Tests Pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Documentation and Deployment Preparation
  - [x] 20.1 Update API documentation
    - Document all new endpoints
    - Add request/response examples
    - Document error codes

  - [x] 20.2 Create user guide for THLI-24 assessment
    - Explain what THLI-24 is
    - Explain level tiers
    - Explain baby steps
    - Explain quota system

  - [x] 20.3 Create monitoring dashboard
    - THLI assessment funnel
    - Level distribution histogram
    - Firewall trigger rate
    - Cross-framework gate failure rate

  - [x] 20.4 Set up alerts
    - Firewall trigger rate > 50%
    - Cross-framework gate failure rate > 30%
    - OpenAI API error rate > 10%

  - [x] 20.5 Prepare deployment plan
    - Run migrations on development database
    - Deploy backend to development Lambda
    - Deploy frontend to development Amplify
    - Test on development environment
    - Get user approval
    - Deploy to production

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- The implementation follows a bottom-up approach: database → services → API → UI → jobs
- All code should follow existing patterns in the codebase (TypeScript, Express, React, Tailwind)
- Use fast-check for property-based testing
- Use Vitest for unit and integration testing
- Follow the design system rules for frontend components
