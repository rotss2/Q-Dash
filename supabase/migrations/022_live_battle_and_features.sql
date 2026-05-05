-- Migration: Live Battle, Activity Logs, Question Bank, Badges
-- This migration adds all the new tables for Q-Dash Learning Platform

-- ============================================================================
-- PART 1: Live Quiz Battle Tables
-- ============================================================================

-- Live Rooms table
CREATE TABLE IF NOT EXISTS live_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code TEXT UNIQUE NOT NULL,
  quiz_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished', 'cancelled')),
  current_question_index INTEGER NOT NULL DEFAULT 0,
  timer_seconds INTEGER NOT NULL DEFAULT 20,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for room code lookups
CREATE INDEX IF NOT EXISTS idx_live_rooms_code ON live_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_live_rooms_host ON live_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_live_rooms_status ON live_rooms(status);
CREATE INDEX IF NOT EXISTS idx_live_rooms_quiz ON live_rooms(quiz_id);

-- Live Room Participants
CREATE TABLE IF NOT EXISTS live_room_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_participants_room ON live_room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_live_participants_user ON live_room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_live_participants_score ON live_room_participants(room_id, score DESC);

-- Live Answers
CREATE TABLE IF NOT EXISTS live_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES live_rooms(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES live_room_participants(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option_id UUID,
  answer_text TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  points INTEGER NOT NULL DEFAULT 0,
  response_time_ms INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_answers_room ON live_answers(room_id);
CREATE INDEX IF NOT EXISTS idx_live_answers_participant ON live_answers(participant_id);
CREATE INDEX IF NOT EXISTS idx_live_answers_question ON live_answers(question_id);

-- ============================================================================
-- PART 2: Activity Logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('admin', 'student')),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

-- ============================================================================
-- PART 3: Question Bank
-- ============================================================================

CREATE TABLE IF NOT EXISTS question_bank (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'true_false', 'identification', 'essay')),
  topic TEXT NOT NULL DEFAULT 'General',
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  explanation TEXT,
  points INTEGER NOT NULL DEFAULT 1,
  correct_answer TEXT,
  correct_answers JSONB,
  options JSONB NOT NULL DEFAULT '[]',
  mode_compatibility TEXT[] DEFAULT ARRAY['quiz', 'exam'],
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_question_bank_topic ON question_bank(topic);
CREATE INDEX IF NOT EXISTS idx_question_bank_difficulty ON question_bank(difficulty);
CREATE INDEX IF NOT EXISTS idx_question_bank_type ON question_bank(question_type);
CREATE INDEX IF NOT EXISTS idx_question_bank_created ON question_bank(created_by);

-- ============================================================================
-- PART 4: Badges System
-- ============================================================================

CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Trophy',
  color TEXT NOT NULL DEFAULT 'amber',
  requirement_type TEXT NOT NULL CHECK (requirement_type IN ('quizzes_completed', 'exams_completed', 'perfect_score', 'streak', 'rank', 'xp', 'surveys_completed')),
  requirement_value INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_student_badges_student ON student_badges(student_id);
CREATE INDEX IF NOT EXISTS idx_student_badges_badge ON student_badges(badge_id);

-- ============================================================================
-- PART 5: Enhanced Student Profile Fields
-- ============================================================================

-- Add gamification fields to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'xp_points') THEN
    ALTER TABLE profiles ADD COLUMN xp_points INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'level') THEN
    ALTER TABLE profiles ADD COLUMN level INTEGER DEFAULT 1;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'current_streak') THEN
    ALTER TABLE profiles ADD COLUMN current_streak INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'longest_streak') THEN
    ALTER TABLE profiles ADD COLUMN longest_streak INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'full_name') THEN
    ALTER TABLE profiles ADD COLUMN full_name TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'updated_at') THEN
    ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- ============================================================================
-- PART 6: Default Badges
-- ============================================================================

INSERT INTO badges (name, description, icon, color, requirement_type, requirement_value) VALUES
  ('First Quiz', 'Complete your first quiz', 'CheckCircle', 'green', 'quizzes_completed', 1),
  ('Quiz Enthusiast', 'Complete 10 quizzes', 'Target', 'blue', 'quizzes_completed', 10),
  ('Quiz Master', 'Complete 50 quizzes', 'Trophy', 'purple', 'quizzes_completed', 50),
  ('Exam Finisher', 'Complete your first exam', 'GraduationCap', 'indigo', 'exams_completed', 1),
  ('Exam Expert', 'Complete 5 exams', 'Award', 'red', 'exams_completed', 5),
  ('Perfect Score', 'Get 100% on any quiz', 'Star', 'yellow', 'perfect_score', 1),
  ('7-Day Streak', 'Maintain a 7-day activity streak', 'Flame', 'orange', 'streak', 7),
  ('30-Day Streak', 'Maintain a 30-day activity streak', 'Zap', 'red', 'streak', 30),
  ('Top Performer', 'Reach top 10 in leaderboard', 'Crown', 'amber', 'rank', 10),
  ('Survey Contributor', 'Complete your first survey', 'MessageSquare', 'cyan', 'surveys_completed', 1),
  ('Point Collector', 'Earn 1000 XP points', 'Coins', 'emerald', 'xp', 1000),
  ('Expert Learner', 'Earn 5000 XP points', 'Gem', 'violet', 'xp', 5000)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- PART 7: Functions for Live Battle
-- ============================================================================

-- Function to generate unique room code
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate 6 character alphanumeric code
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6));
    
    -- Check if code exists
    SELECT EXISTS(SELECT 1 FROM live_rooms WHERE room_code = code) INTO exists_check;
    
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to join a live room
CREATE OR REPLACE FUNCTION join_live_room(
  p_room_code TEXT,
  p_display_name TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  participant_id UUID,
  room_id UUID,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_room_id UUID;
  v_room_status TEXT;
  v_participant_id UUID;
BEGIN
  -- Find room by code
  SELECT id, status INTO v_room_id, v_room_status
  FROM live_rooms WHERE room_code = p_room_code;
  
  IF v_room_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, false, 'Room not found'::TEXT;
    RETURN;
  END IF;
  
  IF v_room_status != 'waiting' THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, false, 'Room is not accepting new participants'::TEXT;
    RETURN;
  END IF;
  
  -- Check if user already joined
  IF p_user_id IS NOT NULL THEN
    SELECT id INTO v_participant_id
    FROM live_room_participants
    WHERE room_id = v_room_id AND user_id = p_user_id;
    
    IF v_participant_id IS NOT NULL THEN
      RETURN QUERY SELECT v_participant_id, v_room_id, true, NULL::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Create participant
  INSERT INTO live_room_participants (room_id, user_id, display_name)
  VALUES (v_room_id, p_user_id, p_display_name)
  RETURNING id INTO v_participant_id;
  
  RETURN QUERY SELECT v_participant_id, v_room_id, true, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate live leaderboard
CREATE OR REPLACE FUNCTION get_live_leaderboard(p_room_id UUID)
RETURNS TABLE (
  participant_id UUID,
  display_name TEXT,
  score INTEGER,
  rank INTEGER,
  correct_answers BIGINT,
  total_answers BIGINT,
  avg_response_time_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as participant_id,
    p.display_name,
    p.score,
    ROW_NUMBER() OVER (ORDER BY p.score DESC) as rank,
    COUNT(a.id) FILTER (WHERE a.is_correct = true) as correct_answers,
    COUNT(a.id) as total_answers,
    COALESCE(AVG(a.response_time_ms), 0) as avg_response_time_ms
  FROM live_room_participants p
  LEFT JOIN live_answers a ON a.participant_id = p.id
  WHERE p.room_id = p_room_id AND p.is_active = true
  GROUP BY p.id, p.display_name, p.score
  ORDER BY p.score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 8: Activity Logger Function
-- ============================================================================

CREATE OR REPLACE FUNCTION log_activity(
  p_actor_id UUID,
  p_actor_name TEXT,
  p_actor_role TEXT,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO activity_logs (
    actor_id, actor_name, actor_role, action, entity_type, entity_id, metadata
  ) VALUES (
    p_actor_id, p_actor_name, p_actor_role, p_action, p_entity_type, p_entity_id, p_metadata
  )
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 9: XP and Level Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION add_xp_to_student(
  p_student_id UUID,
  p_xp_amount INTEGER,
  p_reason TEXT DEFAULT 'Activity completed'
)
RETURNS TABLE (
  new_xp INTEGER,
  new_level INTEGER,
  leveled_up BOOLEAN
) AS $$
DECLARE
  v_current_xp INTEGER;
  v_new_xp INTEGER;
  v_current_level INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Get current values
  SELECT xp_points, level INTO v_current_xp, v_current_level
  FROM profiles WHERE id = p_student_id;
  
  -- Calculate new XP
  v_new_xp := COALESCE(v_current_xp, 0) + p_xp_amount;
  
  -- Calculate new level (every 1000 XP = 1 level)
  v_new_level := FLOOR(v_new_xp / 1000) + 1;
  
  -- Update profile
  UPDATE profiles 
  SET xp_points = v_new_xp,
      level = v_new_level,
      updated_at = NOW()
  WHERE id = p_student_id;
  
  RETURN QUERY SELECT 
    v_new_xp, 
    v_new_level, 
    (v_new_level > COALESCE(v_current_level, 1));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 10: RLS Policies
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE live_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_badges ENABLE ROW LEVEL SECURITY;

-- Live Rooms policies
DROP POLICY IF EXISTS live_rooms_select ON live_rooms;
CREATE POLICY live_rooms_select ON live_rooms
  FOR SELECT USING (true);

DROP POLICY IF EXISTS live_rooms_insert ON live_rooms;
CREATE POLICY live_rooms_insert ON live_rooms
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS live_rooms_update ON live_rooms;
CREATE POLICY live_rooms_update ON live_rooms
  FOR UPDATE USING (
    host_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS live_rooms_delete ON live_rooms;
CREATE POLICY live_rooms_delete ON live_rooms
  FOR DELETE USING (
    host_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Live Room Participants policies
DROP POLICY IF EXISTS live_participants_select ON live_room_participants;
CREATE POLICY live_participants_select ON live_room_participants
  FOR SELECT USING (true);

DROP POLICY IF EXISTS live_participants_insert ON live_room_participants;
CREATE POLICY live_participants_insert ON live_room_participants
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS live_participants_update ON live_room_participants;
CREATE POLICY live_participants_update ON live_room_participants
  FOR UPDATE USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM live_rooms r 
      WHERE r.id = room_id AND r.host_id = auth.uid()
    )
  );

-- Activity Logs policies
DROP POLICY IF EXISTS activity_logs_select ON activity_logs;
CREATE POLICY activity_logs_select ON activity_logs
  FOR SELECT USING (true);

-- Question Bank policies
DROP POLICY IF EXISTS question_bank_select ON question_bank;
CREATE POLICY question_bank_select ON question_bank
  FOR SELECT USING (true);

DROP POLICY IF EXISTS question_bank_insert ON question_bank;
CREATE POLICY question_bank_insert ON question_bank
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS question_bank_update ON question_bank;
CREATE POLICY question_bank_update ON question_bank
  FOR UPDATE USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS question_bank_delete ON question_bank;
CREATE POLICY question_bank_delete ON question_bank
  FOR DELETE USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Badges policies (read-only for students, admin manages)
DROP POLICY IF EXISTS badges_select ON badges;
CREATE POLICY badges_select ON badges
  FOR SELECT USING (true);

DROP POLICY IF EXISTS student_badges_select ON student_badges;
CREATE POLICY student_badges_select ON student_badges
  FOR SELECT USING (
    student_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

COMMENT ON TABLE live_rooms IS 'Stores live quiz battle room information';
COMMENT ON TABLE live_room_participants IS 'Stores participants in live quiz rooms';
COMMENT ON TABLE live_answers IS 'Stores answers submitted during live quizzes';
COMMENT ON TABLE activity_logs IS 'Stores activity feed events';
COMMENT ON TABLE question_bank IS 'Reusable question bank for quizzes and exams';
COMMENT ON TABLE badges IS 'Achievement badges for students';
COMMENT ON TABLE student_badges IS 'Links students to their earned badges';
