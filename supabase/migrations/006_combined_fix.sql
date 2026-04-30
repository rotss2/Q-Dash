-- COMBINED CRITICAL FIX - Run this in Supabase SQL Editor
-- This fixes RLS policies and creates force delete function

-- ============================================
-- PART 1: Fix RLS Policies
-- ============================================

-- Disable RLS temporarily
ALTER TABLE IF EXISTS surveys DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS responses DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE IF EXISTS surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS responses ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on all tables
DROP POLICY IF EXISTS "Admins can create surveys" ON surveys;
DROP POLICY IF EXISTS "Admins can delete their surveys" ON surveys;
DROP POLICY IF EXISTS "Admins can update their surveys" ON surveys;
DROP POLICY IF EXISTS "Admins can view all their surveys" ON surveys;
DROP POLICY IF EXISTS "Allow admin access" ON surveys;
DROP POLICY IF EXISTS "Allow auto-admin surveys access" ON surveys;
DROP POLICY IF EXISTS "Anonymous users can view surveys" ON surveys;
DROP POLICY IF EXISTS "Public can view open surveys" ON surveys;
DROP POLICY IF EXISTS "Service role bypass for surveys" ON surveys;
DROP POLICY IF EXISTS "Service role bypass for questions" ON surveys;
DROP POLICY IF EXISTS "Service role bypass for responses" ON surveys;
DROP POLICY IF EXISTS "Service role bypass for surveys" ON surveys;
DROP POLICY IF EXISTS "Service role bypass for questions" ON questions;
DROP POLICY IF EXISTS "Service role bypass for responses" ON responses;
DROP POLICY IF EXISTS "Public can view questions of open surveys" ON questions;
DROP POLICY IF EXISTS "Public can submit responses" ON responses;

-- Service role bypass policies (THE CRITICAL FIX)
CREATE POLICY "Service role bypass for surveys" 
ON surveys FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Service role bypass for questions" 
ON questions FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Service role bypass for responses" 
ON responses FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Public read policies
CREATE POLICY "Public can view open surveys" 
ON surveys FOR SELECT 
TO anon, authenticated 
USING (status = 'open');

CREATE POLICY "Public can view questions of open surveys" 
ON questions FOR SELECT 
TO anon, authenticated 
USING (EXISTS (SELECT 1 FROM surveys WHERE surveys.id = questions.survey_id AND surveys.status = 'open'));

-- ============================================
-- PART 2: Create Force Delete Function
-- ============================================

CREATE OR REPLACE FUNCTION force_delete_survey(survey_id UUID)
RETURNS VOID AS $$
BEGIN
    RAISE NOTICE 'Force deleting survey: %', survey_id;
    
    DELETE FROM responses WHERE survey_id = survey_id;
    DELETE FROM questions WHERE survey_id = survey_id;
    
    EXECUTE format('DELETE FROM surveys WHERE id = %L', survey_id);
    
    IF EXISTS (SELECT 1 FROM surveys WHERE id = survey_id) THEN
        RAISE EXCEPTION 'Survey % could not be deleted', survey_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION force_delete_survey(UUID) TO service_role;

-- Alternative hard delete function
CREATE OR REPLACE FUNCTION hard_delete_survey(survey_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    rows_deleted INT;
BEGIN
    WITH deleted AS (
        DELETE FROM surveys WHERE id = survey_id RETURNING id
    )
    SELECT COUNT(*) INTO rows_deleted FROM deleted;
    
    RETURN rows_deleted > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION hard_delete_survey(UUID) TO service_role;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'RLS Status:' as check_type, 
       (SELECT relrowsecurity FROM pg_class WHERE relname = 'surveys') as surveys_rls,
       (SELECT relrowsecurity FROM pg_class WHERE relname = 'questions') as questions_rls,
       (SELECT relrowsecurity FROM pg_class WHERE relname = 'responses') as responses_rls;

SELECT 'Service role policies created:' as check_type, COUNT(*) as policy_count
FROM pg_policies 
WHERE policyname LIKE '%Service role bypass%';
