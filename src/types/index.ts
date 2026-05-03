export type UserRole = 'admin' | 'user';

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export type SurveyStatus = 'open' | 'closed';
export type QuestionType = 'text' | 'choice' | 'likert';
export type SurveyMode = 'survey' | 'quiz' | 'exam';
export type ResultReleaseMode = 'immediate' | 'after_close' | 'manual';

// NEW: Block type for strict element typing
export type BlockType = 'question' | 'heading' | 'instruction' | 'page_break';

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  admin_id: string;
  total_responses: number;
  // Mode: survey, quiz, or exam
  mode?: SurveyMode | null;
  // Quiz/Exam Settings
  time_limit_minutes?: number | null;
  passing_score?: number | null;
  max_attempts?: number | null;
  show_score_immediately?: boolean | null;
  show_correct_answers?: boolean | null;
  show_explanations?: boolean | null;
  shuffle_questions?: boolean | null;
  shuffle_options?: boolean | null;
  allow_review_after_submit?: boolean | null;
  release_results_mode?: ResultReleaseMode | null;
  // Anti-cheating
  anti_cheating_enabled?: boolean | null;
  require_fullscreen?: boolean | null;
  disable_copy_paste?: boolean | null;
  disable_tab_switching?: boolean | null;
  // Appearance
  theme?: string | null;
  background_theme?: string | null;
  font_family?: string | null;
  theme_color?: string | null;
  logo_url?: string | null;
  default_language?: string | null;
  supported_languages?: string[] | null;
  open_date?: string | null;
  close_date?: string | null;
  created_at: string;
}

export interface Question {
  id: string;
  survey_id: string;
  block_type: BlockType;           // NEW: strict typing - determines rendering
  type: QuestionType;              // Only used when block_type === 'question'
  question_text: string;
  options: string[] | null;
  section_id?: string | null;      // NEW: for section-based pagination
  show_when_question_id?: string | null;
  show_when_answer_value?: string | null;
  order_index: number;
  required: boolean;
  is_active?: boolean;
  version?: number;
  question_group_id?: string | null;
  _questionNumber?: number;        // Runtime property for numbering (not in DB)
  // Quiz/Exam fields
  points?: number | null;          // Points for this question (default: 1)
  correct_answer?: string | null;    // Single correct answer
  correct_answers?: string[] | null; // Multiple correct answers for multi-select
  explanation?: string | null;       // Explanation shown after answering
  grading_type?: 'auto' | 'manual' | null; // 'auto' for auto-graded, 'manual' for essay/manual
  display_variant?: string | null;   // 'radio', 'dropdown', 'checkbox', 'nps', etc.
}

// NEW: Section type for organizing questions into pages
export interface Section {
  id: string;
  survey_id: string;
  title: string;
  description?: string | null;
  order_index: number;
  created_at?: string;
}

export interface Response {
  id: string;
  survey_id: string;
  user_id: string;
  question_id: string;
  answer: string;
  submitted_at: string;
}

export interface ResponseWithDetails extends Response {
  question: Question;
  profile: Profile;
}

export interface SurveyWithQuestions extends Survey {
  questions: Question[];
}

export interface ResponseAggregation {
  question_id: string;
  question_text: string;
  type: QuestionType;
  answers: { value: string; count: number }[];
  total_responses: number;
}

// Quiz/Exam Attempt Types
export type AttemptStatus = 'in_progress' | 'submitted' | 'graded' | 'expired';

export interface QuizAttempt {
  id: string;
  survey_id: string;
  user_id?: string | null;
  anonymous_user_id?: string | null;
  respondent_name?: string | null;
  respondent_email?: string | null;
  mode: SurveyMode;
  status: AttemptStatus;
  started_at: string;
  submitted_at?: string | null;
  time_spent_seconds?: number | null;
  score?: number | null;
  max_score?: number | null;
  percentage?: number | null;
  passed?: boolean | null;
  attempt_number: number;
  auto_score?: number | null;
  manual_score?: number | null;
  needs_manual_grading?: boolean | null;
  created_at: string;
}

export interface QuizAttemptAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  answer: string | null;
  is_correct?: boolean | null;
  points_awarded?: number | null;
  max_points?: number | null;
  graded_by?: string | null;
  graded_at?: string | null;
  feedback?: string | null;
}

export interface QuizAttemptWithAnswers extends QuizAttempt {
  answers: QuizAttemptAnswer[];
  survey?: Survey;
}

export interface QuizResultsSummary {
  total_attempts: number;
  completed_attempts: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  pass_rate: number;
  average_time_spent: number;
  needs_manual_grading_count: number;
}
