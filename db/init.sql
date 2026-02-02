
-- Create feedback_forms table
CREATE TABLE IF NOT EXISTS feedback_forms (
    id SERIAL PRIMARY KEY,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data JSONB NOT NULL
);

-- Index for faster querying if needed in the future
CREATE INDEX IF NOT EXISTS idx_feedback_data ON feedback_forms USING GIN (data);
