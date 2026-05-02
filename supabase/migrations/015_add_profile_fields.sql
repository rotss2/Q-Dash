-- Add gender and age columns to survey_sessions for profiling
ALTER TABLE survey_sessions ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'non-binary', 'prefer-not-to-say'));
ALTER TABLE survey_sessions ADD COLUMN IF NOT EXISTS age INTEGER CHECK (age > 0 AND age <= 120);

-- Drop ALL existing versions of the function (using wildcard to catch any signature)
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN 
    SELECT oid::regprocedure as func_name
    FROM pg_proc 
    WHERE proname = 'record_survey_completion'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.func_name;
  END LOOP;
END $$;

-- Update record_survey_completion function to accept and store gender and age
CREATE OR REPLACE FUNCTION record_survey_completion(
  p_survey_id UUID,
  p_user_id TEXT,
  p_fingerprint TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_age INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  already_completed BOOLEAN;
  lock_key BIGINT;
BEGIN
  -- Generate a consistent lock key from survey_id and user_id
  lock_key := (('x' || substr(md5(p_survey_id::text || p_user_id), 1, 16))::bit(64)::bigint);
  
  -- Try to acquire advisory lock (prevents concurrent duplicate submissions)
  IF NOT pg_try_advisory_xact_lock(lock_key) THEN
    -- Someone else is processing this exact combination right now
    RAISE EXCEPTION 'Submission in progress. Please wait a moment and try again.';
  END IF;
  
  -- Check if already completed (inside lock)
  SELECT EXISTS(
    SELECT 1 FROM survey_sessions 
    WHERE survey_id = p_survey_id 
    AND user_id = p_user_id
  ) INTO already_completed;
  
  IF already_completed THEN
    RETURN FALSE; -- Already completed
  END IF;
  
  -- Insert the completion record with gender and age
  INSERT INTO survey_sessions (
    survey_id, 
    user_id, 
    email,
    gender,
    age,
    fingerprint, 
    ip_address, 
    user_agent
  ) VALUES (
    p_survey_id, 
    p_user_id,
    p_email,
    p_gender,
    p_age,
    p_fingerprint, 
    p_ip_address, 
    p_user_agent
  );
  
  -- Update survey response count
  UPDATE surveys 
  SET total_responses = total_responses + 1
  WHERE id = p_survey_id;
  
  RETURN TRUE; -- Successfully recorded
EXCEPTION
  WHEN unique_violation THEN
    -- Race condition: another session inserted between check and insert
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_survey_completion IS 'Atomically records survey completion with profiling data (gender, age) and race condition protection';
