-- Fix schema for anonymous survey responses
-- Run this in Supabase SQL Editor to allow anonymous users to submit responses

-- Change responses.user_id from UUID to TEXT to support anonymous fingerprints
ALTER TABLE responses ALTER COLUMN user_id TYPE TEXT;

-- Drop the foreign key constraint to profiles (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'responses_user_id_fkey'
    AND table_name = 'responses'
  ) THEN
    ALTER TABLE responses DROP CONSTRAINT responses_user_id_fkey;
  END IF;
END $$;

-- Update the trigger function to work with TEXT user_id
-- ONLY increment when first response from a user/survey is inserted
CREATE OR REPLACE FUNCTION increment_survey_responses()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  -- Count how many responses this user already had for this survey BEFORE this insert
  SELECT COUNT(*) INTO existing_count
  FROM responses
  WHERE survey_id = NEW.survey_id
  AND user_id = NEW.user_id
  AND id < NEW.id;  -- Only count responses inserted before this one
  
  -- Only increment if this is the FIRST response from this user for this survey
  IF existing_count = 0 THEN
    UPDATE surveys
    SET total_responses = total_responses + 1
    WHERE id = NEW.survey_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger is active
DROP TRIGGER IF EXISTS trigger_increment_survey_responses ON responses;
CREATE TRIGGER trigger_increment_survey_responses
AFTER INSERT ON responses
FOR EACH ROW
EXECUTE FUNCTION increment_survey_responses();

-- Add the RPC function for manual increment (used in client code)
CREATE OR REPLACE FUNCTION increment_survey_response_count(p_survey_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE surveys
  SET total_responses = total_responses + 1
  WHERE id = p_survey_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies for responses to allow anonymous inserts
DROP POLICY IF EXISTS "Users can insert responses" ON responses;
CREATE POLICY "Anonymous users can insert responses"
  ON responses FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view responses" ON responses;
CREATE POLICY "Admins can view responses"
  ON responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM surveys
      WHERE surveys.id = responses.survey_id
      AND surveys.admin_id = auth.uid()
    )
  );

-- Allow anonymous users to view survey questions (for taking surveys)
DROP POLICY IF EXISTS "Public can view questions" ON questions;
CREATE POLICY "Public can view questions"
  ON questions FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow anonymous users to view open surveys
DROP POLICY IF EXISTS "Public can view surveys" ON surveys;
CREATE POLICY "Public can view open surveys"
  ON surveys FOR SELECT
  TO anon, authenticated
  USING (status = 'open');

-- CRITICAL: Fix existing response counts (if they were overcounted)
-- This recalculates total_responses as the count of distinct users per survey
UPDATE surveys s
SET total_responses = (
  SELECT COUNT(DISTINCT user_id)
  FROM responses r
  WHERE r.survey_id = s.id
);