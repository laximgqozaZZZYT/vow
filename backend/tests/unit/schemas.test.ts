/**
 * Schema Validation Tests
 *
 * Tests for Zod schema validation in the TypeScript backend.
 * Tests valid and invalid inputs for all schemas.
 *
 * Requirements: 9.3
 */

import { describe, it, expect } from 'vitest';
import {
  slackConnectionCreateSchema,
  slackConnectionResponseSchema,
  slackPreferencesUpdateSchema,
  slackPreferencesResponseSchema,
  slashCommandPayloadSchema,
  interactionPayloadSchema,
  interactionUserSchema,
  interactionTeamSchema,
  interactionActionSchema,
  slackEventPayloadSchema,
  slackMessageSchema,
  slackFollowUpStatusCreateSchema,
  slackOAuthStateSchema,
} from '@/schemas/slack';
import {
  habitSchema,
  habitCreateSchema,
  habitUpdateSchema,
  activitySchema,
  activityCreateSchema,
  habitProgressSchema,
  dailyProgressSummarySchema,
  goalSchema,
  goalCreateSchema,
  goalUpdateSchema,
} from '@/schemas/habit';

// ============================================================================
// Slack Schema Tests
// ============================================================================

describe('Slack Schemas', () => {
  describe('slackConnectionCreateSchema', () => {
    it('should validate a valid connection create payload', () => {
      const validPayload = {
        slack_user_id: 'U12345678',
        slack_team_id: 'T12345678',
        slack_team_name: 'Test Workspace',
        slack_user_name: 'testuser',
        access_token: 'xoxp-token-12345',
        refresh_token: 'xoxr-refresh-12345',
        bot_access_token: 'xoxb-bot-12345',
        token_expires_at: '2024-12-31T23:59:59Z',
      };

      const result = slackConnectionCreateSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should validate with only required fields', () => {
      const minimalPayload = {
        slack_user_id: 'U12345678',
        slack_team_id: 'T12345678',
        access_token: 'xoxp-token-12345',
      };

      const result = slackConnectionCreateSchema.safeParse(minimalPayload);
      expect(result.success).toBe(true);
    });

    it('should reject missing slack_user_id', () => {
      const invalidPayload = {
        slack_team_id: 'T12345678',
        access_token: 'xoxp-token-12345',
      };

      const result = slackConnectionCreateSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject missing slack_team_id', () => {
      const invalidPayload = {
        slack_user_id: 'U12345678',
        access_token: 'xoxp-token-12345',
      };

      const result = slackConnectionCreateSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject missing access_token', () => {
      const invalidPayload = {
        slack_user_id: 'U12345678',
        slack_team_id: 'T12345678',
      };

      const result = slackConnectionCreateSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject invalid token_expires_at format', () => {
      const invalidPayload = {
        slack_user_id: 'U12345678',
        slack_team_id: 'T12345678',
        access_token: 'xoxp-token-12345',
        token_expires_at: 'not-a-date',
      };

      const result = slackConnectionCreateSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('slackConnectionResponseSchema', () => {
    it('should validate a valid connection response', () => {
      const validResponse = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_type: 'user',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        slack_user_id: 'U12345678',
        slack_team_id: 'T12345678',
        slack_team_name: 'Test Workspace',
        slack_user_name: 'testuser',
        connected_at: '2024-01-01T00:00:00Z',
        is_valid: true,
      };

      const result = slackConnectionResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should accept null for optional nullable fields', () => {
      const validResponse = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_type: 'user',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        slack_user_id: 'U12345678',
        slack_team_id: 'T12345678',
        slack_team_name: null,
        slack_user_name: null,
        connected_at: '2024-01-01T00:00:00Z',
        is_valid: true,
      };

      const result = slackConnectionResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should reject missing required fields', () => {
      const invalidResponse = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_type: 'user',
        // missing owner_id
      };

      const result = slackConnectionResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });
  });

  describe('slackPreferencesUpdateSchema', () => {
    it('should validate a valid preferences update', () => {
      const validUpdate = {
        slack_notifications_enabled: true,
        weekly_slack_report_enabled: true,
        weekly_report_day: 1,
        weekly_report_time: '09:00',
      };

      const result = slackPreferencesUpdateSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should validate empty object (all fields optional)', () => {
      const result = slackPreferencesUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject weekly_report_day out of range (negative)', () => {
      const invalidUpdate = {
        weekly_report_day: -1,
      };

      const result = slackPreferencesUpdateSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should reject weekly_report_day out of range (> 6)', () => {
      const invalidUpdate = {
        weekly_report_day: 7,
      };

      const result = slackPreferencesUpdateSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should accept boundary values for weekly_report_day', () => {
      expect(slackPreferencesUpdateSchema.safeParse({ weekly_report_day: 0 }).success).toBe(true);
      expect(slackPreferencesUpdateSchema.safeParse({ weekly_report_day: 6 }).success).toBe(true);
    });
  });

  describe('slashCommandPayloadSchema', () => {
    it('should validate a valid slash command payload', () => {
      const validPayload = {
        command: '/habit-done',
        text: 'exercise',
        user_id: 'U12345678',
        team_id: 'T12345678',
        channel_id: 'C12345678',
        response_url: 'https://hooks.slack.com/commands/T12345678/12345/abcdef',
        trigger_id: '12345.67890.abcdef',
      };

      const result = slashCommandPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should use default empty string for text', () => {
      const payloadWithoutText = {
        command: '/habit-status',
        user_id: 'U12345678',
        team_id: 'T12345678',
        channel_id: 'C12345678',
        response_url: 'https://hooks.slack.com/commands/T12345678/12345/abcdef',
      };

      const result = slashCommandPayloadSchema.safeParse(payloadWithoutText);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe('');
      }
    });

    it('should reject invalid response_url', () => {
      const invalidPayload = {
        command: '/habit-done',
        user_id: 'U12345678',
        team_id: 'T12345678',
        channel_id: 'C12345678',
        response_url: 'not-a-url',
      };

      const result = slashCommandPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const invalidPayload = {
        command: '/habit-done',
        // missing user_id, team_id, channel_id, response_url
      };

      const result = slashCommandPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('interactionPayloadSchema', () => {
    it('should validate a valid interaction payload', () => {
      const validPayload = {
        type: 'block_actions',
        user: {
          id: 'U12345678',
          username: 'testuser',
          name: 'Test User',
        },
        team: {
          id: 'T12345678',
          domain: 'testworkspace',
        },
        actions: [
          {
            action_id: 'habit_done_btn',
            block_id: 'habit_block_1',
            type: 'button',
            value: 'habit_123',
          },
        ],
        response_url: 'https://hooks.slack.com/actions/T12345678/12345/abcdef',
        trigger_id: '12345.67890.abcdef',
      };

      const result = interactionPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should validate with minimal user and team info', () => {
      const minimalPayload = {
        type: 'block_actions',
        user: { id: 'U12345678' },
        team: { id: 'T12345678' },
        actions: [{ action_id: 'test', type: 'button' }],
        response_url: 'https://hooks.slack.com/actions/T12345678/12345/abcdef',
        trigger_id: '12345.67890.abcdef',
      };

      const result = interactionPayloadSchema.safeParse(minimalPayload);
      expect(result.success).toBe(true);
    });

    it('should reject missing user', () => {
      const invalidPayload = {
        type: 'block_actions',
        team: { id: 'T12345678' },
        actions: [],
        response_url: 'https://hooks.slack.com/actions/T12345678/12345/abcdef',
        trigger_id: '12345.67890.abcdef',
      };

      const result = interactionPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it('should reject invalid response_url', () => {
      const invalidPayload = {
        type: 'block_actions',
        user: { id: 'U12345678' },
        team: { id: 'T12345678' },
        actions: [],
        response_url: 'invalid-url',
        trigger_id: '12345.67890.abcdef',
      };

      const result = interactionPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('slackEventPayloadSchema', () => {
    it('should validate a URL verification challenge', () => {
      const challengePayload = {
        type: 'url_verification',
        challenge: 'challenge_token_12345',
        token: 'verification_token',
      };

      const result = slackEventPayloadSchema.safeParse(challengePayload);
      expect(result.success).toBe(true);
    });

    it('should validate an event callback', () => {
      const eventPayload = {
        type: 'event_callback',
        token: 'verification_token',
        team_id: 'T12345678',
        event: {
          type: 'message',
          text: 'Hello',
        },
      };

      const result = slackEventPayloadSchema.safeParse(eventPayload);
      expect(result.success).toBe(true);
    });

    it('should reject missing type', () => {
      const invalidPayload = {
        challenge: 'challenge_token',
      };

      const result = slackEventPayloadSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe('slackMessageSchema', () => {
    it('should validate a valid message', () => {
      const validMessage = {
        channel: 'C12345678',
        text: 'Hello, world!',
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Hello' } }],
        thread_ts: '1234567890.123456',
      };

      const result = slackMessageSchema.safeParse(validMessage);
      expect(result.success).toBe(true);
    });

    it('should validate with only required fields', () => {
      const minimalMessage = {
        channel: 'C12345678',
        text: 'Hello',
      };

      const result = slackMessageSchema.safeParse(minimalMessage);
      expect(result.success).toBe(true);
    });

    it('should reject missing channel', () => {
      const invalidMessage = {
        text: 'Hello',
      };

      const result = slackMessageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });

    it('should reject missing text', () => {
      const invalidMessage = {
        channel: 'C12345678',
      };

      const result = slackMessageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });
  });

  describe('slackFollowUpStatusCreateSchema', () => {
    it('should validate a valid follow-up status', () => {
      const validStatus = {
        habit_id: '123e4567-e89b-12d3-a456-426614174000',
        date: '2024-01-15',
      };

      const result = slackFollowUpStatusCreateSchema.safeParse(validStatus);
      expect(result.success).toBe(true);
    });

    it('should validate with only habit_id', () => {
      const minimalStatus = {
        habit_id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = slackFollowUpStatusCreateSchema.safeParse(minimalStatus);
      expect(result.success).toBe(true);
    });

    it('should reject missing habit_id', () => {
      const invalidStatus = {
        date: '2024-01-15',
      };

      const result = slackFollowUpStatusCreateSchema.safeParse(invalidStatus);
      expect(result.success).toBe(false);
    });
  });

  describe('slackOAuthStateSchema', () => {
    it('should validate a valid OAuth state', () => {
      const validState = {
        owner_type: 'user',
        owner_id: '123e4567-e89b-12d3-a456-426614174000',
        redirect_uri: 'https://example.com/callback',
        timestamp: 1704067200,
      };

      const result = slackOAuthStateSchema.safeParse(validState);
      expect(result.success).toBe(true);
    });

    it('should use default owner_type', () => {
      const stateWithoutOwnerType = {
        owner_id: '123e4567-e89b-12d3-a456-426614174000',
        redirect_uri: 'https://example.com/callback',
        timestamp: 1704067200,
      };

      const result = slackOAuthStateSchema.safeParse(stateWithoutOwnerType);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.owner_type).toBe('user');
      }
    });

    it('should reject invalid redirect_uri', () => {
      const invalidState = {
        owner_id: '123e4567-e89b-12d3-a456-426614174000',
        redirect_uri: 'not-a-url',
        timestamp: 1704067200,
      };

      const result = slackOAuthStateSchema.safeParse(invalidState);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer timestamp', () => {
      const invalidState = {
        owner_id: '123e4567-e89b-12d3-a456-426614174000',
        redirect_uri: 'https://example.com/callback',
        timestamp: 1704067200.5,
      };

      const result = slackOAuthStateSchema.safeParse(invalidState);
      expect(result.success).toBe(false);
    });
  });
});


// ============================================================================
// Habit Schema Tests
// ============================================================================

describe('Habit Schemas', () => {
  describe('habitSchema', () => {
    it('should validate a valid habit', () => {
      const validHabit = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_type: 'user',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Exercise',
        description: 'Daily exercise routine',
        goal_id: '123e4567-e89b-12d3-a456-426614174002',
        active: true,
        frequency: 'daily',
        target_count: 1,
        workload_unit: 'minutes',
        workload_per_count: 30,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T12:00:00Z',
      };

      const result = habitSchema.safeParse(validHabit);
      expect(result.success).toBe(true);
    });

    it('should validate with default values', () => {
      const minimalHabit = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Exercise',
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = habitSchema.safeParse(minimalHabit);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.owner_type).toBe('user');
        expect(result.data.active).toBe(true);
        expect(result.data.frequency).toBe('daily');
        expect(result.data.target_count).toBe(1);
        expect(result.data.workload_per_count).toBe(1);
      }
    });

    it('should reject invalid UUID for id', () => {
      const invalidHabit = {
        id: 'not-a-uuid',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Exercise',
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = habitSchema.safeParse(invalidHabit);
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const invalidHabit = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        name: '',
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = habitSchema.safeParse(invalidHabit);
      expect(result.success).toBe(false);
    });

    it('should reject invalid frequency', () => {
      const invalidHabit = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Exercise',
        frequency: 'yearly',
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = habitSchema.safeParse(invalidHabit);
      expect(result.success).toBe(false);
    });

    it('should accept all valid frequency values', () => {
      const baseHabit = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Exercise',
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(habitSchema.safeParse({ ...baseHabit, frequency: 'daily' }).success).toBe(true);
      expect(habitSchema.safeParse({ ...baseHabit, frequency: 'weekly' }).success).toBe(true);
      expect(habitSchema.safeParse({ ...baseHabit, frequency: 'monthly' }).success).toBe(true);
    });

    it('should reject non-positive target_count', () => {
      const invalidHabit = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Exercise',
        target_count: 0,
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = habitSchema.safeParse(invalidHabit);
      expect(result.success).toBe(false);
    });

    it('should reject non-positive workload_per_count', () => {
      const invalidHabit = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Exercise',
        workload_per_count: -1,
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = habitSchema.safeParse(invalidHabit);
      expect(result.success).toBe(false);
    });
  });

  describe('habitCreateSchema', () => {
    it('should validate a valid habit create payload', () => {
      const validCreate = {
        name: 'Exercise',
        description: 'Daily exercise routine',
        goal_id: '123e4567-e89b-12d3-a456-426614174000',
        frequency: 'daily',
        target_count: 1,
        workload_unit: 'minutes',
        workload_per_count: 30,
      };

      const result = habitCreateSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it('should validate with only required fields', () => {
      const minimalCreate = {
        name: 'Exercise',
      };

      const result = habitCreateSchema.safeParse(minimalCreate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.frequency).toBe('daily');
        expect(result.data.target_count).toBe(1);
        expect(result.data.workload_per_count).toBe(1);
      }
    });

    it('should reject empty name', () => {
      const invalidCreate = {
        name: '',
      };

      const result = habitCreateSchema.safeParse(invalidCreate);
      expect(result.success).toBe(false);
    });

    it('should reject name exceeding max length', () => {
      const invalidCreate = {
        name: 'a'.repeat(101),
      };

      const result = habitCreateSchema.safeParse(invalidCreate);
      expect(result.success).toBe(false);
    });

    it('should reject description exceeding max length', () => {
      const invalidCreate = {
        name: 'Exercise',
        description: 'a'.repeat(501),
      };

      const result = habitCreateSchema.safeParse(invalidCreate);
      expect(result.success).toBe(false);
    });

    it('should reject invalid goal_id UUID', () => {
      const invalidCreate = {
        name: 'Exercise',
        goal_id: 'not-a-uuid',
      };

      const result = habitCreateSchema.safeParse(invalidCreate);
      expect(result.success).toBe(false);
    });
  });

  describe('habitUpdateSchema', () => {
    it('should validate a valid habit update payload', () => {
      const validUpdate = {
        name: 'Updated Exercise',
        active: false,
        target_count: 2,
      };

      const result = habitUpdateSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should validate empty object (all fields optional)', () => {
      const result = habitUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept null for nullable fields', () => {
      const validUpdate = {
        description: null,
        goal_id: null,
        workload_unit: null,
      };

      const result = habitUpdateSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should reject empty name when provided', () => {
      const invalidUpdate = {
        name: '',
      };

      const result = habitUpdateSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });
  });
});

describe('Activity Schemas', () => {
  describe('activitySchema', () => {
    it('should validate a valid activity', () => {
      const validActivity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_type: 'user',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        habit_id: '123e4567-e89b-12d3-a456-426614174002',
        habit_name: 'Exercise',
        kind: 'complete',
        timestamp: '2024-01-15T10:00:00Z',
        amount: 1,
        memo: 'Morning workout',
        created_at: '2024-01-15T10:00:00Z',
      };

      const result = activitySchema.safeParse(validActivity);
      expect(result.success).toBe(true);
    });

    it('should validate with default values', () => {
      const minimalActivity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        habit_id: '123e4567-e89b-12d3-a456-426614174002',
        timestamp: '2024-01-15T10:00:00Z',
      };

      const result = activitySchema.safeParse(minimalActivity);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.owner_type).toBe('user');
        expect(result.data.kind).toBe('complete');
        expect(result.data.amount).toBe(1);
      }
    });

    it('should accept all valid kind values', () => {
      const baseActivity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        habit_id: '123e4567-e89b-12d3-a456-426614174002',
        timestamp: '2024-01-15T10:00:00Z',
      };

      expect(activitySchema.safeParse({ ...baseActivity, kind: 'complete' }).success).toBe(true);
      expect(activitySchema.safeParse({ ...baseActivity, kind: 'skip' }).success).toBe(true);
      expect(activitySchema.safeParse({ ...baseActivity, kind: 'partial' }).success).toBe(true);
    });

    it('should reject invalid kind', () => {
      const invalidActivity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        habit_id: '123e4567-e89b-12d3-a456-426614174002',
        kind: 'invalid',
        timestamp: '2024-01-15T10:00:00Z',
      };

      const result = activitySchema.safeParse(invalidActivity);
      expect(result.success).toBe(false);
    });

    it('should reject non-positive amount', () => {
      const invalidActivity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        habit_id: '123e4567-e89b-12d3-a456-426614174002',
        timestamp: '2024-01-15T10:00:00Z',
        amount: 0,
      };

      const result = activitySchema.safeParse(invalidActivity);
      expect(result.success).toBe(false);
    });

    it('should reject invalid timestamp format', () => {
      const invalidActivity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        habit_id: '123e4567-e89b-12d3-a456-426614174002',
        timestamp: 'not-a-date',
      };

      const result = activitySchema.safeParse(invalidActivity);
      expect(result.success).toBe(false);
    });
  });

  describe('activityCreateSchema', () => {
    it('should validate a valid activity create payload', () => {
      const validCreate = {
        habit_id: '123e4567-e89b-12d3-a456-426614174000',
        habit_name: 'Exercise',
        kind: 'complete',
        timestamp: '2024-01-15T10:00:00Z',
        amount: 2,
        memo: 'Great workout!',
      };

      const result = activityCreateSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it('should validate with only required fields', () => {
      const minimalCreate = {
        habit_id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = activityCreateSchema.safeParse(minimalCreate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.kind).toBe('complete');
        expect(result.data.amount).toBe(1);
      }
    });

    it('should reject invalid habit_id UUID', () => {
      const invalidCreate = {
        habit_id: 'not-a-uuid',
      };

      const result = activityCreateSchema.safeParse(invalidCreate);
      expect(result.success).toBe(false);
    });

    it('should reject memo exceeding max length', () => {
      const invalidCreate = {
        habit_id: '123e4567-e89b-12d3-a456-426614174000',
        memo: 'a'.repeat(501),
      };

      const result = activityCreateSchema.safeParse(invalidCreate);
      expect(result.success).toBe(false);
    });
  });
});

describe('Progress Schemas', () => {
  describe('habitProgressSchema', () => {
    it('should validate a valid habit progress', () => {
      const validProgress = {
        habit_id: '123e4567-e89b-12d3-a456-426614174000',
        habit_name: 'Exercise',
        goal_id: '123e4567-e89b-12d3-a456-426614174001',
        goal_name: 'Health',
        target_count: 1,
        current_count: 1,
        workload_unit: 'minutes',
        workload_per_count: 30,
        total_workload: 30,
        target_workload: 30,
        completed: true,
        streak: 5,
      };

      const result = habitProgressSchema.safeParse(validProgress);
      expect(result.success).toBe(true);
    });

    it('should accept null for optional nullable fields', () => {
      const validProgress = {
        habit_id: '123e4567-e89b-12d3-a456-426614174000',
        habit_name: 'Exercise',
        goal_id: null,
        goal_name: null,
        target_count: 1,
        current_count: 0,
        workload_unit: null,
        workload_per_count: 1,
        total_workload: 0,
        target_workload: 1,
        completed: false,
        streak: 0,
      };

      const result = habitProgressSchema.safeParse(validProgress);
      expect(result.success).toBe(true);
    });

    it('should reject negative current_count', () => {
      const invalidProgress = {
        habit_id: '123e4567-e89b-12d3-a456-426614174000',
        habit_name: 'Exercise',
        target_count: 1,
        current_count: -1,
        workload_per_count: 1,
        total_workload: 0,
        target_workload: 1,
        completed: false,
        streak: 0,
      };

      const result = habitProgressSchema.safeParse(invalidProgress);
      expect(result.success).toBe(false);
    });

    it('should reject negative streak', () => {
      const invalidProgress = {
        habit_id: '123e4567-e89b-12d3-a456-426614174000',
        habit_name: 'Exercise',
        target_count: 1,
        current_count: 0,
        workload_per_count: 1,
        total_workload: 0,
        target_workload: 1,
        completed: false,
        streak: -1,
      };

      const result = habitProgressSchema.safeParse(invalidProgress);
      expect(result.success).toBe(false);
    });
  });

  describe('dailyProgressSummarySchema', () => {
    it('should validate a valid daily progress summary', () => {
      const validSummary = {
        date: '2024-01-15',
        total_habits: 5,
        completed_habits: 3,
        completion_rate: 60,
        habits: [
          {
            habit_id: '123e4567-e89b-12d3-a456-426614174000',
            habit_name: 'Exercise',
            target_count: 1,
            current_count: 1,
            workload_per_count: 1,
            total_workload: 1,
            target_workload: 1,
            completed: true,
            streak: 5,
          },
        ],
      };

      const result = dailyProgressSummarySchema.safeParse(validSummary);
      expect(result.success).toBe(true);
    });

    it('should validate with empty habits array', () => {
      const validSummary = {
        date: '2024-01-15',
        total_habits: 0,
        completed_habits: 0,
        completion_rate: 0,
        habits: [],
      };

      const result = dailyProgressSummarySchema.safeParse(validSummary);
      expect(result.success).toBe(true);
    });

    it('should reject completion_rate over 100', () => {
      const invalidSummary = {
        date: '2024-01-15',
        total_habits: 5,
        completed_habits: 3,
        completion_rate: 101,
        habits: [],
      };

      const result = dailyProgressSummarySchema.safeParse(invalidSummary);
      expect(result.success).toBe(false);
    });

    it('should reject negative completion_rate', () => {
      const invalidSummary = {
        date: '2024-01-15',
        total_habits: 5,
        completed_habits: 3,
        completion_rate: -1,
        habits: [],
      };

      const result = dailyProgressSummarySchema.safeParse(invalidSummary);
      expect(result.success).toBe(false);
    });
  });
});

describe('Goal Schemas', () => {
  describe('goalSchema', () => {
    it('should validate a valid goal', () => {
      const validGoal = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_type: 'user',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Health',
        description: 'Improve overall health',
        parent_id: '123e4567-e89b-12d3-a456-426614174002',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T12:00:00Z',
      };

      const result = goalSchema.safeParse(validGoal);
      expect(result.success).toBe(true);
    });

    it('should validate with default values', () => {
      const minimalGoal = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Health',
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = goalSchema.safeParse(minimalGoal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.owner_type).toBe('user');
        expect(result.data.status).toBe('active');
      }
    });

    it('should accept all valid status values', () => {
      const baseGoal = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Health',
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(goalSchema.safeParse({ ...baseGoal, status: 'active' }).success).toBe(true);
      expect(goalSchema.safeParse({ ...baseGoal, status: 'completed' }).success).toBe(true);
      expect(goalSchema.safeParse({ ...baseGoal, status: 'archived' }).success).toBe(true);
    });

    it('should reject invalid status', () => {
      const invalidGoal = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Health',
        status: 'invalid',
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = goalSchema.safeParse(invalidGoal);
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const invalidGoal = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        owner_id: '123e4567-e89b-12d3-a456-426614174001',
        name: '',
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = goalSchema.safeParse(invalidGoal);
      expect(result.success).toBe(false);
    });
  });

  describe('goalCreateSchema', () => {
    it('should validate a valid goal create payload', () => {
      const validCreate = {
        name: 'Health',
        description: 'Improve overall health',
        parent_id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = goalCreateSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it('should validate with only required fields', () => {
      const minimalCreate = {
        name: 'Health',
      };

      const result = goalCreateSchema.safeParse(minimalCreate);
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const invalidCreate = {
        name: '',
      };

      const result = goalCreateSchema.safeParse(invalidCreate);
      expect(result.success).toBe(false);
    });

    it('should reject name exceeding max length', () => {
      const invalidCreate = {
        name: 'a'.repeat(101),
      };

      const result = goalCreateSchema.safeParse(invalidCreate);
      expect(result.success).toBe(false);
    });

    it('should reject description exceeding max length', () => {
      const invalidCreate = {
        name: 'Health',
        description: 'a'.repeat(501),
      };

      const result = goalCreateSchema.safeParse(invalidCreate);
      expect(result.success).toBe(false);
    });
  });

  describe('goalUpdateSchema', () => {
    it('should validate a valid goal update payload', () => {
      const validUpdate = {
        name: 'Updated Health',
        status: 'completed',
      };

      const result = goalUpdateSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should validate empty object (all fields optional)', () => {
      const result = goalUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept null for nullable fields', () => {
      const validUpdate = {
        description: null,
        parent_id: null,
      };

      const result = goalUpdateSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should reject empty name when provided', () => {
      const invalidUpdate = {
        name: '',
      };

      const result = goalUpdateSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });

    it('should reject invalid status', () => {
      const invalidUpdate = {
        status: 'invalid',
      };

      const result = goalUpdateSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });
  });
});
