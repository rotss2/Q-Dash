-- Migration: Fix RLS Policies for Service Role Bypass
-- Ensures service role can access all data while maintaining security for anon/authenticated users

-- First, disable RLS temporarily to ensure clean state
ALTER TABLE IF EXISTS surveys DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS responses DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS on all tables
ALTER TABLE IF EXISTS surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS responses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Admins can create surveys" ON surveys;
DROP POLICY IF EXISTS "Admins can delete their surveys" ON surveys;
DROP POLICY IF EXISTS "Admins can update their surveys" ON surveys;
DROP POLICY IF EXISTS "Admins can view all their surveys" ON surveys;
DROP POLICY IF EXISTS "Allow admin access" ON surveys;
DROP POLICY IF EXISTS "Allow auto-admin surveys access" ON surveys;
DROP POLICY IF EXISTS "Anonymous users can view surveys" ON surveys;
DROP POLICY IF EXISTS "Public can view open surveys" ON surveys;

-- Create service role bypass policy for surveys
-- This allows the server (using service role key) to access all data
CREATE POLICY "Service role bypass for surveys" 
ON surveys FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Create service role bypass policy for questions
CREATE POLICY "Service role bypass for questions" 
ON questions FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Create service role bypass policy for responses
CREATE POLICY "Service role bypass for responses" 
ON responses FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Create policy for public/anonymous to view open surveys
CREATE POLICY "Public can view open surveys" 
ON surveys FOR SELECT 
TO anon, authenticated 
USING (status = 'open');

-- Create policy for public/anonymous to view questions of open surveys
CREATE POLICY "Public can view questions of open surveys" 
ON questions FOR SELECT 
TO anon, authenticated 
USING (
  EXISTS (
    SELECT 1 FROM surveys 
    WHERE surveys.id = questions.survey_id 
    AND surveys.status = 'open'
  )
);

-- Create policy for submitting responses (public can insert)
CREATE POLICY "Public can submit responses" 
ON responses FOR INSERT 
TO anon, authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM surveys 
    WHERE surveys.id = responses.survey_id 
    AND surveys.status = 'open'
  )
);

-- Verify policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('surveys', 'questions', 'responses')
ORDER BY tablename, policyname;
