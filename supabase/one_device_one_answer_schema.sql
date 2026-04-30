-- ONE DEVICE, ONE ANSWER - Database Schema
-- This schema adds strict backend validation to prevent duplicate submissions

-- Create a table to track survey completions with unique constraint
CREATE TABLE IF NOT EXISTS survey_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,  -- Device fingerprint (not UUID since fingerprints are strings)
  email TEXT,
  fingerprint TEXT,        -- Additional fingerprint data
  ip_address TEXT,         -- IP address for extra tracking
  user_agent TEXT,         -- Browser/user agent info
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- CRITICAL: Unique constraint prevents duplicate submissions from same device
  UNIQUE(survey_id, user_id)
);

-- Enable RLS on survey_sessions
ALTER TABLE survey_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (fingerprint validation happens at application level)
CREATE POLICY "Allow survey session creation" 
  ON survey_sessions FOR INSERT 
  TO anon, authenticated
  WITH CHECK (true);

-- Allow anyone to view (for checking previous submissions)
CREATE POLICY "Allow survey session viewing" 
  ON survey_sessions FOR SELECT 
  TO anon, authenticated
  USING (true);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_survey_sessions_lookup 
  ON survey_sessions(survey_id, user_id);

-- Function to check if user has already submitted
CREATE OR REPLACE FUNCTION has_user_completed_survey(
  p_survey_id UUID,
  p_user_id TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM survey_sessions 
    WHERE survey_id = p_survey_id 
    AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record survey completion atomically
-- This uses advisory locks to prevent race conditions
CREATE OR REPLACE FUNCTION record_survey_completion(
  p_survey_id UUID,
  p_user_id TEXT,
  p_fingerprint TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
) RETURNS TABLE(success BOOLEAN, error_message TEXT) AS $$
DECLARE
  lock_id BIGINT;
  already_completed BOOLEAN;
BEGIN
  -- Generate a lock ID from survey_id and user_id
  lock_id := ('x' || substr(md5(p_survey_id::text || p_user_id), 1, 16))::bit(64)::bigint;
  
  -- Acquire advisory lock to prevent concurrent submissions
  PERFORM pg_advisory_lock(lock_id);
  
  BEGIN
    -- Check if already completed (inside lock)
    SELECT EXISTS(
      SELECT 1 FROM survey_sessions 
      WHERE survey_id = p_survey_id 
      AND user_id = p_user_id
    ) INTO already_completed;
    
    IF already_completed THEN
      -- Release lock and return error
      PERFORM pg_advisory_unlock(lock_id);
      RETURN QUERY SELECT false, 'You have already completed this survey'::TEXT;
      RETURN;
    END IF;
    
    -- Insert the completion record
    INSERT INTO survey_sessions (
      survey_id, 
      user_id, 
      email,
      fingerprint, 
      ip_address, 
      user_agent
    ) VALUES (
      p_survey_id, 
      p_user_id, 
      p_email,
      p_fingerprint, 
      p_ip_address, 
      p_user_agent
    );
    
    -- Release lock
    PERFORM pg_advisory_unlock(lock_id);
    
    RETURN QUERY SELECT true, NULL::TEXT;
    
  EXCEPTION WHEN OTHERS THEN
    -- Ensure lock is released on error
    PERFORM pg_advisory_unlock(lock_id);
    RETURN QUERY SELECT false, SQLERRM::TEXT;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also add unique constraint on responses to prevent duplicates at DB level
-- This is a safety net in case the application logic fails
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_user_survey_response'
  ) THEN
    -- Add unique constraint on responses (user_id + survey_id + question_id)
    ALTER TABLE responses 
    ADD CONSTRAINT unique_user_survey_response 
    UNIQUE (user_id, survey_id, question_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Constraint might already exist or other error
  RAISE NOTICE 'Could not add unique constraint: %', SQLERRM;
END $$;

-- Enable realtime for survey_sessions (optional, for admin monitoring)
ALTER PUBLICATION supabase_realtime ADD TABLE survey_sessions;

COMMENT ON TABLE survey_sessions IS 'Tracks survey completions to enforce one-device-one-answer policy';
COMMENT ON FUNCTION has_user_completed_survey IS 'Checks if a user has already completed a survey';
COMMENT ON FUNCTION record_survey_completion IS 'Atomically records survey completion with race condition protection';
