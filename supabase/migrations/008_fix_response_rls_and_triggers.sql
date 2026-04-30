-- Fix Response Submission Issues
-- 1. Fix RLS policy for anonymous users
-- 2. Remove duplicate/conflicting triggers

-- Step 1: Drop the old conflicting RLS policies
DROP POLICY IF EXISTS "Users can insert their own responses" ON responses;
DROP POLICY IF EXISTS "Public can submit responses" ON responses;

-- Step 2: Create proper RLS policy for anonymous and authenticated users
-- Allow anyone to submit responses to open surveys
CREATE POLICY "Allow responses submission to open surveys" 
ON responses FOR INSERT 
TO anon, authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM surveys 
    WHERE surveys.id = survey_id 
    AND surveys.status = 'open'
  )
);

-- Step 3: Allow admins to view all responses for their surveys
DROP POLICY IF EXISTS "Admins can view all responses for their surveys" ON responses;
DROP POLICY IF EXISTS "Service role bypass for responses" ON responses;

-- Service role bypass for backend
CREATE POLICY "Service role bypass for responses" 
ON responses FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Step 4: Remove old conflicting trigger
DROP TRIGGER IF EXISTS trigger_increment_survey_responses ON responses;
DROP FUNCTION IF EXISTS increment_survey_responses();

-- Step 5: Keep only our new trigger (already created in 007_response_count_trigger.sql)
-- Verify it exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_response_count_trigger'
    ) THEN
        -- If the new trigger doesn't exist, recreate it
        CREATE OR REPLACE FUNCTION update_survey_response_count()
        RETURNS TRIGGER AS $$
        BEGIN
            IF (TG_OP = 'INSERT') THEN
                UPDATE surveys 
                SET total_responses = (
                    SELECT COUNT(DISTINCT user_id) 
                    FROM responses 
                    WHERE survey_id = NEW.survey_id
                )
                WHERE id = NEW.survey_id;
                RETURN NEW;
            ELSIF (TG_OP = 'DELETE') THEN
                UPDATE surveys 
                SET total_responses = (
                    SELECT COUNT(DISTINCT user_id) 
                    FROM responses 
                    WHERE survey_id = OLD.survey_id
                )
                WHERE id = OLD.survey_id;
                RETURN OLD;
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;

        CREATE TRIGGER update_response_count_trigger
            AFTER INSERT OR DELETE ON responses
            FOR EACH ROW
            EXECUTE FUNCTION update_survey_response_count();
    END IF;
END $$;

-- Step 6: Fix existing counts
UPDATE surveys 
SET total_responses = (
    SELECT COUNT(DISTINCT user_id) 
    FROM responses 
    WHERE responses.survey_id = surveys.id
);

-- Step 7: Verify responses exist and are accessible
SELECT 
    s.title,
    s.id as survey_id,
    COUNT(DISTINCT r.user_id) as actual_responders,
    s.total_responses as cached_count
FROM surveys s
LEFT JOIN responses r ON r.survey_id = s.id
GROUP BY s.id, s.title, s.total_responses
ORDER BY actual_responders DESC;
