-- Migration: Resync response counts and check for duplicate triggers
-- This migration fixes count inconsistencies between surveys.total_responses and survey_sessions

-- ============================================================================
-- PART 1: Check for and remove old response-based count triggers
-- ============================================================================

-- Drop old trigger on responses table if it exists
DROP TRIGGER IF EXISTS trigger_increment_survey_responses ON responses;
DROP TRIGGER IF EXISTS update_response_count_trigger ON responses;
DROP TRIGGER IF EXISTS responses_count_trigger ON responses;

-- Drop old trigger functions if they exist
DROP FUNCTION IF EXISTS increment_survey_response_count() CASCADE;
DROP FUNCTION IF EXISTS update_response_count() CASCADE;
DROP FUNCTION IF EXISTS manage_response_count() CASCADE;

-- ============================================================================
-- PART 2: Ensure survey_sessions trigger exists and is correct
-- ============================================================================

-- Function to update survey response count from survey_sessions
CREATE OR REPLACE FUNCTION update_survey_response_count_from_sessions()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE surveys 
    SET total_responses = (
      SELECT COUNT(*) 
      FROM survey_sessions 
      WHERE survey_id = NEW.survey_id
    )
    WHERE id = NEW.survey_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
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
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS survey_sessions_count_trigger ON survey_sessions;

CREATE TRIGGER survey_sessions_count_trigger
AFTER INSERT OR DELETE ON survey_sessions
FOR EACH ROW
EXECUTE FUNCTION update_survey_response_count_from_sessions();

-- ============================================================================
-- PART 3: Resync all existing counts
-- ============================================================================

-- Recalculate total_responses for all surveys from survey_sessions
UPDATE surveys s
SET total_responses = COALESCE(x.count, 0)
FROM (
  SELECT survey_id, COUNT(*) AS count
  FROM survey_sessions
  GROUP BY survey_id
) x
WHERE s.id = x.survey_id;

-- Set zero for surveys with no sessions
UPDATE surveys s
SET total_responses = 0
WHERE NOT EXISTS (
  SELECT 1 FROM survey_sessions ss WHERE ss.survey_id = s.id
);

-- ============================================================================
-- PART 4: Add diagnostic view for admin debugging
-- ============================================================================

-- Create a view for admin debugging of response counts
CREATE OR REPLACE VIEW survey_response_counts AS
SELECT 
  s.id as survey_id,
  s.title as survey_title,
  s.total_responses as cached_total_responses,
  COALESCE(ss.completed_submissions, 0) as completed_submissions,
  COALESCE(r.unique_response_users, 0) as unique_response_users,
  COALESCE(r.answer_rows, 0) as answer_rows,
  COALESCE(r.valid_answer_rows, 0) as valid_answer_rows,
  COALESCE(r.orphan_answer_rows, 0) as orphan_answer_rows
FROM surveys s
LEFT JOIN (
  SELECT survey_id, COUNT(*) as completed_submissions
  FROM survey_sessions
  GROUP BY survey_id
) ss ON ss.survey_id = s.id
LEFT JOIN (
  SELECT 
    survey_id,
    COUNT(DISTINCT user_id) as unique_response_users,
    COUNT(*) as answer_rows,
    COUNT(*) FILTER (WHERE question_id IN (
      SELECT id FROM questions WHERE is_active = true AND block_type = 'question'
    )) as valid_answer_rows,
    COUNT(*) FILTER (WHERE question_id NOT IN (
      SELECT id FROM questions WHERE is_active = true AND block_type = 'question'
    ) OR question_id IS NULL) as orphan_answer_rows
  FROM responses
  GROUP BY survey_id
) r ON r.survey_id = s.id;

-- ============================================================================
-- PART 5: Add comments for documentation
-- ============================================================================

COMMENT ON FUNCTION update_survey_response_count_from_sessions() IS 
'Updates surveys.total_responses based on survey_sessions count. This is the ONLY trigger that should update total_responses.';

COMMENT ON TRIGGER survey_sessions_count_trigger ON survey_sessions IS 
'Updates survey total_responses when sessions are added or removed';

COMMENT ON VIEW survey_response_counts IS 
'Admin diagnostic view showing all count metrics for debugging discrepancies';

-- ============================================================================
-- PART 6: Verify no duplicate triggers exist
-- ============================================================================

-- This query can be run manually to check for any remaining problematic triggers:
-- SELECT 
--   t.tgname,
--   c.relname AS table_name,
--   pg_get_triggerdef(t.oid) as trigger_definition
-- FROM pg_trigger t
-- JOIN pg_class c ON c.oid = t.tgrelid
-- WHERE c.relname IN ('responses', 'survey_sessions')
-- AND NOT t.tgisinternal
-- AND t.tgname LIKE '%count%' OR t.tgname LIKE '%response%';

-- ============================================================================
-- PART 7: Add RPC function for diagnostic counts
-- ============================================================================

CREATE OR REPLACE FUNCTION get_survey_diagnostic_counts(p_survey_id UUID)
RETURNS TABLE (
  metric_name TEXT,
  metric_value BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'completed_submissions'::TEXT, COUNT(*)::BIGINT
  FROM survey_sessions WHERE survey_id = p_survey_id
  UNION ALL
  SELECT 'unique_response_users'::TEXT, COUNT(DISTINCT user_id)::BIGINT
  FROM responses WHERE survey_id = p_survey_id
  UNION ALL
  SELECT 'answer_rows'::TEXT, COUNT(*)::BIGINT
  FROM responses WHERE survey_id = p_survey_id
  UNION ALL
  SELECT 'valid_answer_rows'::TEXT, COUNT(*)::BIGINT
  FROM responses r
  JOIN questions q ON q.id = r.question_id
  WHERE r.survey_id = p_survey_id
  AND q.is_active = true
  AND q.block_type = 'question'
  UNION ALL
  SELECT 'orphan_inactive_rows'::TEXT, COUNT(*)::BIGINT
  FROM responses r
  LEFT JOIN questions q ON q.id = r.question_id
  WHERE r.survey_id = p_survey_id
  AND (q.id IS NULL OR q.is_active = false OR q.block_type <> 'question');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_survey_diagnostic_counts(UUID) IS 
'Returns diagnostic counts for a survey to help debug discrepancies';

-- ============================================================================
-- Summary of changes
-- ============================================================================
-- 1. Removed any old triggers on responses table that update total_responses
-- 2. Ensured the survey_sessions trigger is correct and active
-- 3. Resynced all survey total_responses from survey_sessions count
-- 4. Created diagnostic view and function for admin debugging
-- 5. Added documentation comments
