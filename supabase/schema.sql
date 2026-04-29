-- Q-Dash Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Surveys table
CREATE TABLE surveys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_responses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questions table
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('text', 'choice', 'likert')),
  question_text TEXT NOT NULL,
  options TEXT[],
  order_index INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT true
);

-- Responses table
CREATE TABLE responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_surveys_admin_id ON surveys(admin_id);
CREATE INDEX idx_surveys_status ON surveys(status);
CREATE INDEX idx_questions_survey_id ON questions(survey_id);
CREATE INDEX idx_responses_survey_id ON responses(survey_id);
CREATE INDEX idx_responses_user_id ON responses(user_id);
CREATE INDEX idx_responses_question_id ON responses(question_id);

-- Trigger function to update total_responses
CREATE OR REPLACE FUNCTION increment_survey_responses()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if this is the first response from this user for this survey
  IF NOT EXISTS (
    SELECT 1 FROM responses 
    WHERE survey_id = NEW.survey_id 
    AND user_id = NEW.user_id 
    AND id != NEW.id
  ) THEN
    UPDATE surveys 
    SET total_responses = total_responses + 1 
    WHERE id = NEW.survey_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment total_responses
CREATE TRIGGER trigger_increment_survey_responses
AFTER INSERT ON responses
FOR EACH ROW
EXECUTE FUNCTION increment_survey_responses();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Surveys policies
CREATE POLICY "Anyone can view open surveys" 
  ON surveys FOR SELECT 
  USING (status = 'open');

CREATE POLICY "Admins can view all their surveys" 
  ON surveys FOR SELECT 
  USING (admin_id = auth.uid());

CREATE POLICY "Admins can create surveys" 
  ON surveys FOR INSERT 
  WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Admins can update their surveys" 
  ON surveys FOR UPDATE 
  USING (admin_id = auth.uid());

CREATE POLICY "Admins can delete their surveys" 
  ON surveys FOR DELETE 
  USING (admin_id = auth.uid());

-- Questions policies
CREATE POLICY "Anyone can view questions for open surveys" 
  ON questions FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM surveys 
    WHERE surveys.id = questions.survey_id 
    AND surveys.status = 'open'
  ));

CREATE POLICY "Admins can view all questions for their surveys" 
  ON questions FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM surveys 
    WHERE surveys.id = questions.survey_id 
    AND surveys.admin_id = auth.uid()
  ));

CREATE POLICY "Admins can create questions for their surveys" 
  ON questions FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM surveys 
    WHERE surveys.id = questions.survey_id 
    AND surveys.admin_id = auth.uid()
  ));

CREATE POLICY "Admins can update questions for their surveys" 
  ON questions FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM surveys 
    WHERE surveys.id = questions.survey_id 
    AND surveys.admin_id = auth.uid()
  ));

CREATE POLICY "Admins can delete questions for their surveys" 
  ON questions FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM surveys 
    WHERE surveys.id = questions.survey_id 
    AND surveys.admin_id = auth.uid()
  ));

-- Responses policies
CREATE POLICY "Users can insert their own responses" 
  ON responses FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own responses" 
  ON responses FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all responses for their surveys" 
  ON responses FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM surveys 
    WHERE surveys.id = responses.survey_id 
    AND surveys.admin_id = auth.uid()
  ));
