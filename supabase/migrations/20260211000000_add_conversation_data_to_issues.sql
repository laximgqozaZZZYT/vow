-- Add conversation_data column to issues table
-- Stores conversation history as JSON for issue context

-- Add the conversation_data JSONB column
ALTER TABLE issues ADD COLUMN IF NOT EXISTS conversation_data JSONB;

-- Add comment for documentation
COMMENT ON COLUMN issues.conversation_data IS 'JSON array of conversation messages for issue context. Format: { "messages": [{ "role": "user"|"assistant", "content": "...", "timestamp": "...", "toolCalls": [...] }] }. Limited to 50 messages or ~100KB';

-- Create index for JSONB queries (optional, for future use)
CREATE INDEX IF NOT EXISTS idx_issues_conversation_data ON issues USING GIN (conversation_data) WHERE conversation_data IS NOT NULL;
