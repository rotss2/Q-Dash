-- Migration: Add live session tracking for real-time respondent monitoring
-- Created: 2026-05-02

-- Create the survey_live_sessions table
CREATE TABLE IF NOT EXISTS survey_live_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    email TEXT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned', 'blocked')),
    total_questions INTEGER DEFAULT 0,
    answered_questions INTEGER DEFAULT 0,
    progress_percentage NUMERIC DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    started_at TIMESTAMPTZ DEFAULT now(),
    last_activity_at TIMESTAMPTZ DEFAULT now(),
    submitted_at TIMESTAMPTZ NULL,
    abandoned_at TIMESTAMPTZ NULL,
    fingerprint TEXT NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add unique constraint to prevent duplicate sessions per survey+user
ALTER TABLE survey_live_sessions 
    ADD CONSTRAINT unique_survey_user_session 
    UNIQUE (survey_id, user_id);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_live_sessions_survey_id ON survey_live_sessions(survey_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON survey_live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_last_activity ON survey_live_sessions(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_sessions_started_at ON survey_live_sessions(started_at DESC);

-- Function to automatically mark abandoned sessions
CREATE OR REPLACE FUNCTION mark_abandoned_sessions()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE survey_live_sessions
    SET 
        status = 'abandoned',
        abandoned_at = now(),
        updated_at = now()
    WHERE 
        status = 'active'
        AND last_activity_at < now() - interval '30 minutes';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to upsert live session (handles duplicate key by updating)
CREATE OR REPLACE FUNCTION upsert_live_session(
    p_survey_id UUID,
    p_user_id TEXT,
    p_email TEXT DEFAULT NULL,
    p_total_questions INTEGER DEFAULT 0,
    p_fingerprint TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
BEGIN
    INSERT INTO survey_live_sessions (
        survey_id,
        user_id,
        email,
        total_questions,
        fingerprint,
        user_agent,
        status,
        started_at,
        last_activity_at
    ) VALUES (
        p_survey_id,
        p_user_id,
        p_email,
        p_total_questions,
        p_fingerprint,
        p_user_agent,
        'active',
        now(),
        now()
    )
    ON CONFLICT (survey_id, user_id) 
    DO UPDATE SET
        last_activity_at = now(),
        updated_at = now(),
        status = CASE 
            WHEN survey_live_sessions.status = 'abandoned' THEN 'active'
            ELSE survey_live_sessions.status 
        END,
        total_questions = EXCLUDED.total_questions
    RETURNING id INTO v_session_id;
    
    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update live session progress
CREATE OR REPLACE FUNCTION update_live_session_progress(
    p_survey_id UUID,
    p_user_id TEXT,
    p_answered_questions INTEGER,
    p_progress_percentage NUMERIC
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE survey_live_sessions
    SET 
        answered_questions = p_answered_questions,
        progress_percentage = p_progress_percentage,
        last_activity_at = now(),
        updated_at = now()
    WHERE 
        survey_id = p_survey_id 
        AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to complete a live session
CREATE OR REPLACE FUNCTION complete_live_session(
    p_survey_id UUID,
    p_user_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE survey_live_sessions
    SET 
        status = 'completed',
        progress_percentage = 100,
        submitted_at = now(),
        last_activity_at = now(),
        updated_at = now()
    WHERE 
        survey_id = p_survey_id 
        AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security policies for survey_live_sessions
ALTER TABLE survey_live_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert/update (for respondents)
CREATE POLICY "Allow respondents to manage live sessions"
    ON survey_live_sessions
    FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);

-- Allow admin to read all sessions
CREATE POLICY "Allow admin to read all live sessions"
    ON survey_live_sessions
    FOR SELECT
    TO public
    USING (true);

COMMENT ON TABLE survey_live_sessions IS 'Real-time tracking of survey respondent sessions';
COMMENT ON COLUMN survey_live_sessions.status IS 'active, completed, abandoned, or blocked';
COMMENT ON COLUMN survey_live_sessions.progress_percentage IS 'Percentage of questions answered (0-100)';
