-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'habit', 'goal', 'diary', 'activity'
  entity_id UUID NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  content_hash TEXT NOT NULL, -- For detecting content changes
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one embedding per entity
  UNIQUE(user_id, entity_type, entity_id)
);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS embeddings_vector_idx
  ON embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for entity lookup
CREATE INDEX IF NOT EXISTS embeddings_entity_idx
  ON embeddings (user_id, entity_type);

-- RLS Policies
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- Users can only access their own embeddings
CREATE POLICY embeddings_select_policy ON embeddings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY embeddings_insert_policy ON embeddings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY embeddings_update_policy ON embeddings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY embeddings_delete_policy ON embeddings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to search similar embeddings
CREATE OR REPLACE FUNCTION search_embeddings(
  query_embedding vector(1536),
  target_user_id UUID,
  target_entity_types TEXT[] DEFAULT NULL,
  match_count INT DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  entity_type TEXT,
  entity_id UUID,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.entity_type,
    e.entity_id,
    1 - (e.embedding <=> query_embedding) AS similarity,
    e.metadata
  FROM embeddings e
  WHERE
    e.user_id = target_user_id
    AND (target_entity_types IS NULL OR e.entity_type = ANY(target_entity_types))
    AND 1 - (e.embedding <=> query_embedding) > similarity_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
