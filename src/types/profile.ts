export interface StudentProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'student' | 'admin';
  xp_points: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  created_at: string;
  updated_at: string;
}

export interface StudentStats {
  total_quizzes_taken: number;
  total_exams_taken: number;
  total_surveys_completed: number;
  average_score: number;
  highest_score: number;
  total_time_spent_seconds: number;
  current_rank: number;
  total_students: number;
}

export interface StudentTopicMastery {
  topic: string;
  total_questions: number;
  correct_answers: number;
  accuracy_rate: number;
  mastery_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  requirement_type: 'quizzes_completed' | 'exams_completed' | 'perfect_score' | 'streak' | 'rank' | 'xp';
  requirement_value: number;
  created_at: string;
}

export interface StudentBadge {
  id: string;
  student_id: string;
  badge_id: string;
  earned_at: string;
  badge: Badge;
}

export interface RecentActivity {
  id: string;
  type: 'quiz_completed' | 'exam_completed' | 'survey_completed' | 'badge_earned' | 'level_up';
  title: string;
  description: string;
  score?: number;
  xp_earned?: number;
  created_at: string;
}

export interface AttemptHistory {
  id: string;
  survey_id: string;
  survey_title: string;
  mode: 'quiz' | 'exam' | 'survey';
  score: number | null;
  percentage: number | null;
  passed: boolean | null;
  completed_at: string;
  time_spent_seconds: number;
}

export interface ProgressChartData {
  labels: string[];
  scores: number[];
  avg_scores: number[];
}
