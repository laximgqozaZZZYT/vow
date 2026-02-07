-- Migration: Fix built-in agent definitions
--
-- Only AICoach should be a built-in agent shared across all users.
-- habit-coach, goal-planner, progress-tracker become regular custom agents.
--
-- This migration:
--   1. Sets is_builtin=false for non-AICoach agents
--   2. Simplifies get_or_create_agent_config to AICoach + ELSE only
--
-- Idempotent: safe to run multiple times.

-- Part 1: Fix existing records
-- Mark habit-coach, goal-planner, progress-tracker as non-built-in
UPDATE agent_configs
SET is_builtin = false
WHERE agent_id IN ('habit-coach', 'goal-planner', 'progress-tracker')
  AND is_builtin = true;

-- Part 2: Replace get_or_create_agent_config function
-- Simplified to only handle AICoach as built-in; all others are custom
CREATE OR REPLACE FUNCTION get_or_create_agent_config(
  p_user_id UUID,
  p_agent_id TEXT
)
RETURNS agent_configs AS $$
DECLARE
  v_config agent_configs;
BEGIN
  -- Look up existing config
  SELECT * INTO v_config
  FROM agent_configs
  WHERE user_id = p_user_id AND agent_id = p_agent_id;

  IF FOUND THEN
    RETURN v_config;
  END IF;

  -- Auto-create: only AICoach is built-in
  IF p_agent_id = 'AICoach' THEN
    INSERT INTO agent_configs (
      user_id, agent_id, name, description, icon, instructions,
      role, capabilities, is_builtin
    ) VALUES (
      p_user_id,
      'AICoach',
      'AI Coach',
      '習慣・目標のAIコーチ',
      '🎯',
      'あなたはVOW（習慣・目標トラッカー）のAIコーチです。',
      'Coach',
      '["習慣提案", "目標提案", "パターン分析", "スモールステップ生成"]'::jsonb,
      true
    )
    RETURNING * INTO v_config;
  ELSE
    -- All other agents are custom (not built-in)
    INSERT INTO agent_configs (
      user_id, agent_id, name, description, icon, instructions,
      role, capabilities, is_builtin
    ) VALUES (
      p_user_id,
      p_agent_id,
      p_agent_id,
      '',
      '🤖',
      '',
      'custom',
      '[]'::jsonb,
      false
    )
    RETURNING * INTO v_config;
  END IF;

  RETURN v_config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure authenticated users can call this function
GRANT EXECUTE ON FUNCTION get_or_create_agent_config(UUID, TEXT) TO authenticated;
