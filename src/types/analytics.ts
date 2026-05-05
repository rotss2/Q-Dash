export interface AnalyticsOverview {
  total_students: number;
  total_quizzes: number;
  total_exams: number;
  total_surveys: number;
  total_attempts: number;
  average_score: number;
  passing_rate: number;
  completion_rate: number;
}

export interface TopicPerformance {
  topic: string;
  total_questions: number;
  correct_answers: number;
  wrong_answers: number;
  accuracy_rate: number;
  avg_time_spent_seconds: number;
}

export interface MostMissedQuestion {
  question_id: string;
  question_text: string;
  topic: string;
  total_attempts: number;
  wrong_answers: number;
  miss_rate: number;
}

export interface ScoreTrend {
  date: string;
  avg_score: number;
  total_attempts: number;
  passing_count: number;
}

export interface StudentPerformance {
  user_id: string;
  display_name: string;
  total_attempts: number;
  avg_score: number;
  highest_score: number;
  lowest_score: number;
  total_time_spent_seconds: number;
  rank: number;
}

export interface SurveyAnalytics {
  survey_id: string;
  title: string;
  total_responses: number;
  completion_rate: number;
  avg_time_spent_seconds: number;
  response_breakdown: {
    question_id: string;
    question_text: string;
    type: string;
    answers: { value: string; count: number; percentage: number }[];
  }[];
}

export interface LiveBattleAnalytics {
  total_rooms: number;
  total_participants: number;
  avg_participants_per_room: number;
  avg_score: number;
  most_active_room?: {
    room_code: string;
    participant_count: number;
    quiz_title: string;
  };
}

export interface AnalyticsFilters {
  date_from?: string;
  date_to?: string;
  mode?: 'quiz' | 'exam' | 'survey' | 'live' | 'all';
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'all';
  section?: string;
}

export interface TimeSeriesData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
}

export interface ChartData {
  labels: string[];
  values: number[];
  colors?: string[];
}
