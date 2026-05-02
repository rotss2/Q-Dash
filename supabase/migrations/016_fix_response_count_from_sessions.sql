-- Fix response count to use survey_sessions (authoritative source for submissions)
-- This ensures total_responses reflects actual respondent count, not answer rows

-- Step 1: Drop the old trigger on responses table
DROP TRIGGER IF EXISTS update_response_count_trigger ON responses;

-- Step 2: Update the function to use survey_sessions count
CREATE OR REPLACE FUNCTION update_survey_response_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE surveys 
        SET total_responses = (
            SELECT COUNT(*) 
            FROM survey_sessions 
            WHERE survey_id = NEW.survey_id
        )
        WHERE id = NEW.survey_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE surveys 
        SET total_responses = (
            SELECT COUNT(*) 
            FROM survey_sessions 
            WHERE survey_id = OLD.survey_id
        )
        WHERE id = OLD.survey_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create trigger on survey_sessions instead of responses
-- This ensures one row per submission counts as one response
CREATE TRIGGER update_response_count_trigger
    AFTER INSERT OR DELETE ON survey_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_survey_response_count();

-- Step 4: Resync all cached counts from survey_sessions
UPDATE surveys s
SET total_responses = COALESCE(session_counts.total_count, 0)
FROM (
    SELECT survey_id, COUNT(*) AS total_count
    FROM survey_sessions
    GROUP BY survey_id
) AS session_counts
WHERE s.id = session_counts.survey_id;

-- Set to 0 for surveys with no sessions
UPDATE surveys s
SET total_responses = 0
WHERE NOT EXISTS (
    SELECT 1 FROM survey_sessions ss WHERE ss.survey_id = s.id
);

-- Step 5: Verify the fix
SELECT 
    s.title,
    s.id AS survey_id,
    s.total_responses AS cached_total_responses,
    COUNT(DISTINCT ss.user_id) AS actual_sessions,
    COUNT(DISTINCT r.user_id) AS unique_users_from_responses,
    COUNT(r.id) AS answer_rows
FROM surveys s
LEFT JOIN survey_sessions ss ON ss.survey_id = s.id
LEFT JOIN responses r ON r.survey_id = s.id
GROUP BY s.id, s.title, s.total_responses
ORDER BY s.created_at DESC;
