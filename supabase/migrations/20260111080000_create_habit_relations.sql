-- Create habit_relations table
CREATE TABLE IF NOT EXISTS habit_relations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    related_habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    relation TEXT NOT NULL CHECK (relation IN ('main','sub','next')),
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_habit_relations_habit_id ON habit_relations(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_relations_related_habit_id ON habit_relations(related_habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_relations_owner ON habit_relations(owner_type, owner_id);

-- Enable RLS and create a policy similar to other tables
ALTER TABLE habit_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own habit relations" ON habit_relations
    FOR ALL USING (
        owner_type = 'user' AND owner_id = auth.uid()::text
        OR owner_type IS NULL
    );
