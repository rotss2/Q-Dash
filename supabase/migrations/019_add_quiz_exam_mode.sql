-- Migration: Add Quiz and Exam Mode Support
-- This migration adds support for quiz and exam modes without breaking existing surveys

-- ============================================================
-- 1. Update surveys table with quiz/exam mode fields
-- ============================================================

-- Add mode column with default 'survey' for existing surveys
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS mode text DEFAULT 'survey';

-- Quiz/Exam settings
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS time_limit_minutes integer;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS passing_score numeric;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS max_attempts integer;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS show_score_immediately boolean DEFAULT false;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS show_correct_answers boolean DEFAULT false;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS show_explanations boolean DEFAULT false;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS shuffle_questions boolean DEFAULT false;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS shuffle_options boolean DEFAULT false;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS allow_review_after_submit boolean DEFAULT true;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS release_results_mode text DEFAULT 'immediate';

-- Anti-cheating fields
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS require_fullscreen boolean DEFAULT false;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS disable_copy_paste boolean DEFAULT false;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS disable_tab_switching boolean DEFAULT false;

-- Update existing surveys to have mode = 'survey' if null
UPDATE surveys SET mode = 'survey' WHERE mode IS NULL;

-- ============================================================
-- 2. Update questions table with quiz/exam fields
-- ============================================================

ALTER TABLE questions ADD COLUMN IF NOT EXISTS points numeric DEFAULT 1;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS correct_answer text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS correct_answers jsonb;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS grading_type text DEFAULT 'auto';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS display_variant text;

-- Update existing questions to have default points = 1
UPDATE questions SET points = 1 WHERE points IS NULL;
UPDATE questions SET grading_type = 'auto' WHERE grading_type IS NULL;

-- ============================================================
-- 3. Create quiz_attempts table
-- ============================================================

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id uuid REFERENCES surveys(id) ON DELETE CASCADE,
    user_id text,
    email text,
    mode text NOT NULL,
    status text NOT NULL DEFAULT 'in_progress',
    started_at timestamptz NOT NULL DEFAULT now(),
    submitted_at timestamptz,
    time_spent_seconds integer,
    score numeric,
    max_score numeric,
    percentage numeric,
    passed boolean,
    attempt_number integer NOT NULL DEFAULT 1,
    needs_manual_grading boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. Create quiz_attempt_answers table
-- ============================================================

CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id uuid REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
    answer jsonb,
    answer_text text,
    is_correct boolean,
    points_awarded numeric,
    max_points numeric,
    feedback text,
    graded_by uuid,
    graded_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. Add indexes for performance
-- ============================================================

-- quiz_attempts indexes
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_survey_id ON quiz_attempts(survey_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_status ON quiz_attempts(status);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_survey_user ON quiz_attempts(survey_id, user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_email ON quiz_attempts(email);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_created_at ON quiz_attempts(created_at);

-- quiz_attempt_answers indexes
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_answers_attempt_id ON quiz_attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempt_answers_question_id ON quiz_attempt_answers(question_id);

-- Additional indexes for surveys quiz fields
CREATE INDEX IF NOT EXISTS idx_surveys_mode ON surveys(mode);

-- ============================================================
-- 6. Enable Row Level Security (RLS)
-- ============================================================

-- Enable RLS on quiz_attempts
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Enable RLS on quiz_attempt_answers
ALTER TABLE quiz_attempt_answers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Quiz attempts are viewable by survey admin" ON quiz_attempts;
DROP POLICY IF EXISTS "Quiz attempts are viewable by own user" ON quiz_attempts;
DROP POLICY IF EXISTS "Quiz attempts are insertable by anyone" ON quiz_attempts;
DROP POLICY IF EXISTS "Quiz attempts are updatable by survey admin" ON quiz_attempts;
DROP POLICY IF EXISTS "Quiz attempts are updatable by own user" ON quiz_attempts;

DROP POLICY IF EXISTS "Quiz attempt answers are viewable by survey admin" ON quiz_attempt_answers;
DROP POLICY IF EXISTS "Quiz attempt answers are viewable by own user" ON quiz_attempt_answers;
DROP POLICY IF EXISTS "Quiz attempt answers are insertable by anyone" ON quiz_attempt_answers;
DROP POLICY IF EXISTS "Quiz attempt answers are updatable by survey admin" ON quiz_attempt_answers;
DROP POLICY IF EXISTS "Quiz attempt answers are updatable by own user" ON quiz_attempt_answers;

-- Quiz attempts policies
-- Allow survey admins to view all attempts for their surveys
CREATE POLICY "Quiz attempts are viewable by survey admin"
    ON quiz_attempts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM surveys s
            WHERE s.id = quiz_attempts.survey_id
            AND s.admin_id = auth.uid()::text
        )
    );

-- Allow users to view their own attempts
CREATE POLICY "Quiz attempts are viewable by own user"
    ON quiz_attempts FOR SELECT
    USING (
        user_id = auth.uid()::text
        OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Allow anonymous attempts (insert only)
CREATE POLICY "Quiz attempts are insertable by anyone"
    ON quiz_attempts FOR INSERT
    WITH CHECK (true);

-- Allow survey admins to update attempts for grading
CREATE POLICY "Quiz attempts are updatable by survey admin"
    ON quiz_attempts FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM surveys s
            WHERE s.id = quiz_attempts.survey_id
            AND s.admin_id = auth.uid()::text
        )
    );

-- Allow users to update their own in-progress attempts
CREATE POLICY "Quiz attempts are updatable by own user"
    ON quiz_attempts FOR UPDATE
    USING (
        (user_id = auth.uid()::text OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
        AND status = 'in_progress'
    );

-- Quiz attempt answers policies
-- Allow survey admins to view all answers for their surveys
CREATE POLICY "Quiz attempt answers are viewable by survey admin"
    ON quiz_attempt_answers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM quiz_attempts qa
            JOIN surveys s ON s.id = qa.survey_id
            WHERE qa.id = quiz_attempt_answers.attempt_id
            AND s.admin_id = auth.uid()::text
        )
    );

-- Allow users to view their own answers
CREATE POLICY "Quiz attempt answers are viewable by own user"
    ON quiz_attempt_answers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM quiz_attempts qa
            WHERE qa.id = quiz_attempt_answers.attempt_id
            AND (qa.user_id = auth.uid()::text OR qa.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
        )
    );

-- Allow anyone to insert answers
CREATE POLICY "Quiz attempt answers are insertable by anyone"
    ON quiz_attempt_answers FOR INSERT
    WITH CHECK (true);

-- Allow survey admins to update answers for grading
CREATE POLICY "Quiz attempt answers are updatable by survey admin"
    ON quiz_attempt_answers FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM quiz_attempts qa
            JOIN surveys s ON s.id = qa.survey_id
            WHERE qa.id = quiz_attempt_answers.attempt_id
            AND s.admin_id = auth.uid()::text
        )
    );

-- Allow users to update their own answers while in progress
CREATE POLICY "Quiz attempt answers are updatable by own user"
    ON quiz_attempt_answers FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM quiz_attempts qa
            WHERE qa.id = quiz_attempt_answers.attempt_id
            AND qa.status = 'in_progress'
            AND (qa.user_id = auth.uid()::text OR qa.email = (SELECT email FROM auth.users WHERE id = auth.uid()))
        )
    );

-- ============================================================
-- 7. Add triggers for updated_at
-- ============================================================

-- Create function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers
DROP TRIGGER IF EXISTS update_quiz_attempts_updated_at ON quiz_attempts;
CREATE TRIGGER update_quiz_attempts_updated_at
    BEFORE UPDATE ON quiz_attempts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quiz_attempt_answers_updated_at ON quiz_attempt_answers;
CREATE TRIGGER update_quiz_attempt_answers_updated_at
    BEFORE UPDATE ON quiz_attempt_answers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Migration complete
-- ============================================================
