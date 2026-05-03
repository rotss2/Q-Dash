-- Migration: Quiz and Exam Scoring Support
-- This migration adds functions for calculating scores and storing quiz/exam results

-- ============================================================================
-- PART 1: Create quiz_exam_results table to store scores
-- ============================================================================

CREATE TABLE IF NOT EXISTS quiz_exam_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,  -- Device fingerprint
  score INTEGER NOT NULL,
  total_points INTEGER NOT NULL,
  percentage NUMERIC(5,2) NOT NULL,
  passed BOOLEAN,
  responses JSONB NOT NULL,  -- Store user responses with scoring details
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(survey_id, user_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quiz_exam_results_survey_user 
  ON quiz_exam_results(survey_id, user_id);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_quiz_exam_results_survey 
  ON quiz_exam_results(survey_id);

COMMENT ON TABLE quiz_exam_results IS 'Stores quiz and exam results with scores and user responses';

-- ============================================================================
-- PART 2: Function to calculate score for a submission
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_quiz_score(
  p_survey_id UUID,
  p_user_id TEXT
)
RETURNS TABLE (
  score INTEGER,
  total_points INTEGER,
  percentage NUMERIC,
  passed BOOLEAN,
  question_results JSONB
) AS $$
DECLARE
  v_score INTEGER := 0;
  v_total_points INTEGER := 0;
  v_passing_score INTEGER;
  v_results JSONB := '[]'::JSONB;
  v_question RECORD;
  v_user_response RECORD;
  v_is_correct BOOLEAN;
  v_points_earned INTEGER;
BEGIN
  -- Get passing score from survey
  SELECT COALESCE(passing_score, 0) INTO v_passing_score
  FROM surveys WHERE id = p_survey_id;

  -- Iterate through all questions for this survey
  FOR v_question IN 
    SELECT 
      q.id as question_id,
      q.question_text,
      q.points,
      q.correct_answer,
      q.correct_answers,
      q.grading_type,
      q.type
    FROM questions q
    WHERE q.survey_id = p_survey_id
    AND q.block_type = 'question'
    AND q.is_active = true
    ORDER BY q.order_index
  LOOP
    -- Get user's response for this question
    SELECT r.answer INTO v_user_response
    FROM responses r
    WHERE r.survey_id = p_survey_id
    AND r.user_id = p_user_id
    AND r.question_id = v_question.question_id
    ORDER BY r.submitted_at DESC
    LIMIT 1;

    v_is_correct := false;
    v_points_earned := 0;

    -- Calculate if answer is correct based on grading type
    IF v_question.grading_type = 'manual' THEN
      -- Manual grading - don't auto-score
      v_is_correct := NULL;
      v_points_earned := 0;
    ELSIF v_question.type IN ('single_choice', 'choice', 'true_false', 'yes_no') THEN
      -- Single answer comparison
      IF v_user_response IS NOT NULL AND v_user_response.answer = v_question.correct_answer THEN
        v_is_correct := true;
        v_points_earned := COALESCE(v_question.points, 1);
      END IF;
    ELSIF v_question.type = 'multiple_choice' THEN
      -- Multiple answer comparison
      IF v_user_response IS NOT NULL AND v_question.correct_answers IS NOT NULL THEN
        -- Check if user's answers match all correct answers
        v_is_correct := v_user_response.answer::JSONB @> v_question.correct_answers::JSONB
                        AND v_user_response.answer::JSONB <@ v_question.correct_answers::JSONB;
        IF v_is_correct THEN
          v_points_earned := COALESCE(v_question.points, 1);
        END IF;
      END IF;
    ELSIF v_question.type IN ('short_answer', 'fill_blank', 'text') THEN
      -- Text comparison (case insensitive, trimmed)
      IF v_user_response IS NOT NULL AND v_question.correct_answer IS NOT NULL THEN
        v_is_correct := LOWER(TRIM(v_user_response.answer)) = LOWER(TRIM(v_question.correct_answer));
        IF v_is_correct THEN
          v_points_earned := COALESCE(v_question.points, 1);
        END IF;
      END IF;
    END IF;

    -- Add to total
    v_score := v_score + v_points_earned;
    v_total_points := v_total_points + COALESCE(v_question.points, 1);

    -- Build result object for this question
    v_results := v_results || jsonb_build_object(
      'question_id', v_question.question_id,
      'question_text', v_question.question_text,
      'user_answer', COALESCE(v_user_response.answer, ''),
      'correct_answer', v_question.correct_answer,
      'correct_answers', v_question.correct_answers,
      'is_correct', v_is_correct,
      'points_earned', v_points_earned,
      'points_possible', COALESCE(v_question.points, 1),
      'grading_type', v_question.grading_type
    );
  END LOOP;

  -- Calculate percentage and passed status
  RETURN QUERY SELECT 
    v_score,
    v_total_points,
    CASE 
      WHEN v_total_points > 0 THEN ROUND((v_score::NUMERIC / v_total_points) * 100, 2)
      ELSE 0
    END,
    CASE 
      WHEN v_total_points > 0 THEN (v_score::NUMERIC / v_total_points) * 100 >= v_passing_score
      ELSE false
    END,
    v_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_quiz_score(UUID, TEXT) IS 
'Calculates the score for a quiz/exam submission based on correct answers';

-- ============================================================================
-- PART 3: Function to submit quiz/exam and calculate score
-- ============================================================================

CREATE OR REPLACE FUNCTION submit_quiz_exam(
  p_survey_id UUID,
  p_user_id TEXT,
  p_responses JSONB
)
RETURNS TABLE (
  success BOOLEAN,
  score INTEGER,
  total_points INTEGER,
  percentage NUMERIC,
  passed BOOLEAN,
  question_results JSONB,
  error_message TEXT
) AS $$
DECLARE
  v_score INTEGER;
  v_total_points INTEGER;
  v_percentage NUMERIC;
  v_passed BOOLEAN;
  v_results JSONB;
  v_existing_result UUID;
BEGIN
  -- Check if user already submitted
  SELECT id INTO v_existing_result
  FROM quiz_exam_results
  WHERE survey_id = p_survey_id AND user_id = p_user_id;

  IF v_existing_result IS NOT NULL THEN
    RETURN QUERY SELECT 
      false, 0, 0, 0::NUMERIC, false, '[]'::JSONB, 
      'You have already submitted this quiz/exam'::TEXT;
    RETURN;
  END IF;

  -- Calculate score
  SELECT * INTO v_score, v_total_points, v_percentage, v_passed, v_results
  FROM calculate_quiz_score(p_survey_id, p_user_id);

  -- Store the result
  INSERT INTO quiz_exam_results (
    survey_id, user_id, score, total_points, 
    percentage, passed, responses, completed_at
  ) VALUES (
    p_survey_id, p_user_id, v_score, v_total_points,
    v_percentage, v_passed, p_responses, NOW()
  );

  -- Also record survey completion for tracking
  PERFORM record_survey_completion(p_survey_id, p_user_id);

  RETURN QUERY SELECT 
    true, v_score, v_total_points, v_percentage, v_passed, v_results, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION submit_quiz_exam(UUID, TEXT, JSONB) IS 
'Submits a quiz/exam, calculates the score, and stores the result';

-- ============================================================================
-- PART 4: Function to get quiz result for a user
-- ============================================================================

CREATE OR REPLACE FUNCTION get_quiz_result(
  p_survey_id UUID,
  p_user_id TEXT
)
RETURNS TABLE (
  score INTEGER,
  total_points INTEGER,
  percentage NUMERIC,
  passed BOOLEAN,
  responses JSONB,
  submitted_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.score,
    r.total_points,
    r.percentage,
    r.passed,
    r.responses,
    r.submitted_at
  FROM quiz_exam_results r
  WHERE r.survey_id = p_survey_id
  AND r.user_id = p_user_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_quiz_result(UUID, TEXT) IS 
'Retrieves the quiz/exam result for a specific user';

-- ============================================================================
-- PART 5: Update record_survey_completion to also handle quiz/exam mode
-- ============================================================================

-- Create an improved version that checks mode
CREATE OR REPLACE FUNCTION record_survey_completion_with_mode(
  p_survey_id UUID,
  p_user_id TEXT,
  p_fingerprint TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_age INTEGER DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, error_message TEXT, is_quiz_exam BOOLEAN) AS $$
DECLARE
  v_mode TEXT;
BEGIN
  -- Get survey mode
  SELECT mode INTO v_mode FROM surveys WHERE id = p_survey_id;

  -- Record completion
  INSERT INTO survey_sessions (
    survey_id, user_id, fingerprint, ip_address, user_agent,
    email, gender, age, completed_at
  ) VALUES (
    p_survey_id, p_user_id, p_fingerprint, p_ip_address, p_user_agent,
    p_email, p_gender, p_age, NOW()
  )
  ON CONFLICT (survey_id, user_id) 
  DO UPDATE SET 
    completed_at = NOW(),
    email = COALESCE(EXCLUDED.email, survey_sessions.email),
    gender = COALESCE(EXCLUDED.gender, survey_sessions.gender),
    age = COALESCE(EXCLUDED.age, survey_sessions.age);

  RETURN QUERY SELECT true, NULL::TEXT, 
    CASE WHEN v_mode IN ('quiz', 'exam') THEN true ELSE false END;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT false, SQLERRM, false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 6: Enable RLS on quiz_exam_results
-- ============================================================================

ALTER TABLE quiz_exam_results ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own results
CREATE POLICY quiz_exam_results_user_policy ON quiz_exam_results
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id', true));

-- Allow admins to see all results for their surveys
CREATE POLICY quiz_exam_results_admin_policy ON quiz_exam_results
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM surveys s
      WHERE s.id = quiz_exam_results.survey_id
      AND s.admin_id = auth.uid()
    )
  );
