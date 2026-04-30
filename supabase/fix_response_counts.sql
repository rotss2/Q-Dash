-- Fix response count synchronization
-- This adds a function to safely increment the survey response counter

-- Function to increment survey response count
CREATE OR REPLACE FUNCTION increment_survey_response_count(p_survey_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE surveys
  SET total_responses = total_responses + 1
  WHERE id = p_survey_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alternative: Create a trigger to auto-update response count
-- This is more reliable but requires responses to have proper constraints
CREATE OR REPLACE FUNCTION update_survey_response_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE surveys SET total_responses = total_responses + 1 WHERE id = NEW.survey_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE surveys SET total_responses = GREATEST(0, total_responses - 1) WHERE id = OLD.survey_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_update_response_count ON responses;

-- Create trigger to auto-update count
CREATE TRIGGER trg_update_response_count
  AFTER INSERT OR DELETE ON responses
  FOR EACH ROW
  EXECUTE FUNCTION update_survey_response_count();

-- Reset all survey response counts to actual values (run this to fix existing data)
UPDATE surveys s
SET total_responses = (
  SELECT COUNT(DISTINCT user_id || '_' || submitted_at::date)
  FROM responses r
  WHERE r.survey_id = s.id
);

COMMENT ON FUNCTION increment_survey_response_count IS 'Manually increments survey response counter';
COMMENT ON FUNCTION update_survey_response_count IS 'Trigger function to keep survey response count in sync';
