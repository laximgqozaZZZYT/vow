# Implementation Plan: Slack Command Fix

## Overview

This implementation fixes the owner ID mapping bug in the VOW Slack integration. The bug is in `slack_webhook.py` where `owner_id = connection.slack_user_id` is used instead of `owner_id = connection.owner_id`, causing habit queries to fail.

## Tasks

- [x] 1. Fix owner ID resolution in slash command handler
  - [x] 1.1 Fix owner_id assignment in handle_slash_command() (line 75)
    - Change `owner_id = connection.slack_user_id` to `owner_id = connection.owner_id`
    - Change `owner_type = "user"` to `owner_type = connection.owner_type`
    - Remove redundant `get_connection_with_tokens()` call (lines 78-80)
    - Add logging for owner_id resolution
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

  - [x] 1.2 Fix owner_id assignment in handle_interaction() (line 235)
    - Change to use `connection.owner_id` directly
    - Change to use `connection.owner_type` directly
    - Remove redundant `get_connection_with_tokens()` call
    - Add logging for owner_id resolution
    - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [x] 2. Add enhanced logging for debugging
  - [x] 2.1 Add logging at command receipt
    - Log slack_user_id, team_id, and command
    - _Requirements: 7.1_

  - [x] 2.2 Add logging after connection lookup
    - Log whether connection was found
    - Log resolved owner_id and owner_type
    - _Requirements: 7.2_

  - [x] 2.3 Add logging before habit queries
    - Log owner_id and owner_type being used
    - _Requirements: 7.3_

- [x] 3. Checkpoint - Verify core fix
  - Ensure all tests pass, ask the user if questions arise.
  - Deploy to Lambda and test /habit-list command
  - Verify habits are returned for connected users

- [x] 4. Write unit tests for owner ID resolution
  - [x] 4.1 Create test_slack_owner_id_resolution.py
    - Test that connection.owner_id is used, not connection.slack_user_id
    - Test with mock connections where owner_id ≠ slack_user_id
    - Test missing connection returns appropriate error
    - _Requirements: 1.1, 1.2, 1.4_

  - [ ]* 4.2 Write property test for owner ID resolution
    - **Property 2: Owner ID Resolution Correctness**
    - Generate connections with distinct owner_id and slack_user_id
    - Verify habit queries use owner_id
    - **Validates: Requirements 1.1, 1.2, 1.4, 2.1, 2.4, 3.1, 3.3, 4.1, 4.2**

- [ ] 5. Verify all Slack commands work correctly
  - [x] 5.1 Test /habit-list command
    - Verify habits are returned for connected users
    - Verify "no habits" message for users with no habits
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 5.2 Test /habit-status command
    - Verify today's progress is shown correctly
    - Verify completed/total counts are accurate
    - _Requirements: 3.1, 3.2_

  - [x] 5.3 Test /habit-done command
    - Verify habit completion works
    - Verify activity is created with correct owner_id
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 6. Final checkpoint - Full integration test
  - Ensure all tests pass, ask the user if questions arise.
  - Test all three commands: /habit-list, /habit-status, /habit-done
  - Verify button clicks work correctly
  - Monitor Lambda logs for any errors

## Notes

- The primary fix is a simple 2-line change in `slack_webhook.py`
- The bug was using `connection.slack_user_id` instead of `connection.owner_id`
- The redundant `get_connection_with_tokens()` call was a workaround that didn't fully fix the issue
- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
