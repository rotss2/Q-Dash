-- Migration: Add time_spent_seconds calculation to live sessions
-- Created: 2026-05-02

-- Add time_spent_seconds column
ALTER TABLE survey_live_sessions 
    ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER DEFAULT 0;

-- Update the upsert_live_session function to calculate time_spent_seconds
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
    v_started_at TIMESTAMPTZ;
BEGIN
    -- Try to get existing session info first
    SELECT id, started_at INTO v_session_id, v_started_at
    FROM survey_live_sessions
    WHERE survey_id = p_survey_id AND user_id = p_user_id;
    
    INSERT INTO survey_live_sessions (
        survey_id,
        user_id,
        email,
        total_questions,
        fingerprint,
        user_agent,
        status,
        started_at,
        last_activity_at,
        time_spent_seconds
    ) VALUES (
        p_survey_id,
        p_user_id,
        p_email,
        p_total_questions,
        p_fingerprint,
        p_user_agent,
        'active',
        COALESCE(v_started_at, now()),
        now(),
        COALESCE(
            (SELECT time_spent_seconds FROM survey_live_sessions 
             WHERE survey_id = p_survey_id AND user_id = p_user_id),
            0
        )
    )
    ON CONFLICT (survey_id, user_id) 
    DO UPDATE SET
        last_activity_at = now(),
        updated_at = now(),
        status = CASE 
            WHEN survey_live_sessions.status = 'abandoned' THEN 'active'
            ELSE survey_live_sessions.status 
        END,
        total_questions = EXCLUDED.total_questions,
        time_spent_seconds = EXTRACT(EPOCH FROM (now() - survey_live_sessions.started_at))::INTEGER
    RETURNING id INTO v_session_id;
    
    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- Update the update_live_session_progress function to calculate time_spent_seconds
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
        updated_at = now(),
        time_spent_seconds = EXTRACT(EPOCH FROM (now() - started_at))::INTEGER
    WHERE 
        survey_id = p_survey_id 
        AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Update the complete_live_session function to set final time_spent_seconds
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
        updated_at = now(),
        time_spent_seconds = EXTRACT(EPOCH FROM (now() - started_at))::INTEGER
    WHERE 
        survey_id = p_survey_id 
        AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Update mark_abandoned_sessions to calculate time_spent_seconds for abandoned sessions
CREATE OR REPLACE FUNCTION mark_abandoned_sessions()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE survey_live_sessions
    SET 
        status = 'abandoned',
        abandoned_at = now(),
        updated_at = now(),
        time_spent_seconds = EXTRACT(EPOCH FROM (last_activity_at - started_at))::INTEGER
    WHERE 
        status = 'active'
        AND last_activity_at < now() - interval '30 minutes';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get live sessions with real-time time spent calculation
CREATE OR REPLACE FUNCTION get_live_sessions_with_time_spent(
    p_survey_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    survey_id UUID,
    user_id TEXT,
    email TEXT,
    status TEXT,
    total_questions INTEGER,
    answered_questions INTEGER,
    progress_percentage NUMERIC,
    started_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    abandoned_at TIMESTAMPTZ,
    time_spent_seconds INTEGER,
    fingerprint TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    -- First mark abandoned sessions
    PERFORM mark_abandoned_sessions();
    
    -- Return sessions with calculated time_spent_seconds
    RETURN QUERY
    SELECT 
        s.id,
        s.survey_id,
        s.user_id,
        s.email,
        s.status,
        s.total_questions,
        s.answered_questions,
        s.progress_percentage,
        s.started_at,
        s.last_activity_at,
        s.submitted_at,
        s.abandoned_at,
        CASE 
            WHEN s.status = 'active' THEN 
                EXTRACT(EPOCH FROM (now() - s.started_at))::INTEGER
            ELSE 
                COALESCE(s.time_spent_seconds, 
                    EXTRACT(EPOCH FROM (COALESCE(s.submitted_at, s.last_activity_at) - s.started_at))::INTEGER
                )
        END as time_spent_seconds,
        s.fingerprint,
        s.user_agent,
        s.created_at,
        s.updated_at
    FROM survey_live_sessions s
    WHERE 
        (p_survey_id IS NULL OR s.survey_id = p_survey_id)
        AND (p_status IS NULL OR s.status = p_status)
    ORDER BY s.last_activity_at DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN survey_live_sessions.time_spent_seconds IS 'Total time spent in seconds (calculated from started_at to last_activity_at or submitted_at)';
