-- Trigger to auto-update survey.total_responses when responses are added/deleted

-- Function to update response count
CREATE OR REPLACE FUNCTION update_survey_response_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- Increment count when new response is added
        UPDATE surveys 
        SET total_responses = (
            SELECT COUNT(DISTINCT user_id) 
            FROM responses 
            WHERE survey_id = NEW.survey_id
        )
        WHERE id = NEW.survey_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        -- Decrement count when response is deleted
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

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS update_response_count_trigger ON responses;

-- Create trigger
CREATE TRIGGER update_response_count_trigger
    AFTER INSERT OR DELETE ON responses
    FOR EACH ROW
    EXECUTE FUNCTION update_survey_response_count();

-- Also fix existing counts
UPDATE surveys 
SET total_responses = (
    SELECT COUNT(DISTINCT user_id) 
    FROM responses 
    WHERE responses.survey_id = surveys.id
);

-- Verify the fix
SELECT title, total_responses, 
       (SELECT COUNT(DISTINCT user_id) FROM responses WHERE responses.survey_id = surveys.id) as actual_count
FROM surveys;
