-- CRITICAL: Force Delete Function for Survey Zombie Records
-- This function ensures complete deletion bypassing all triggers and constraints

-- Create force delete function
CREATE OR REPLACE FUNCTION force_delete_survey(survey_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Log the attempt
    RAISE NOTICE 'Force deleting survey: %', survey_id;
    
    -- Delete responses first
    DELETE FROM responses WHERE survey_id = survey_id;
    
    -- Delete questions
    DELETE FROM questions WHERE survey_id = survey_id;
    
    -- Force delete survey with direct SQL (bypasses ORM/RLS issues)
    EXECUTE format('DELETE FROM surveys WHERE id = %L', survey_id);
    
    -- Verify
    IF EXISTS (SELECT 1 FROM surveys WHERE id = survey_id) THEN
        RAISE EXCEPTION 'Survey % could not be deleted even with force delete', survey_id;
    END IF;
    
    RAISE NOTICE 'Force delete successful for survey: %', survey_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION force_delete_survey(UUID) TO service_role;

-- Also create a simpler direct delete that can be called via REST
CREATE OR REPLACE FUNCTION hard_delete_survey(survey_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    rows_deleted INT;
BEGIN
    -- Direct delete with RETURNING to count rows
    WITH deleted AS (
        DELETE FROM surveys 
        WHERE id = survey_id
        RETURNING id
    )
    SELECT COUNT(*) INTO rows_deleted FROM deleted;
    
    RETURN rows_deleted > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION hard_delete_survey(UUID) TO service_role;
