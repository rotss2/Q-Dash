export type UserRole = 'admin' | 'user';

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export type SurveyStatus = 'open' | 'closed';
export type QuestionType = 'text' | 'choice' | 'likert';

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  admin_id: string;
  total_responses: number;
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
  type: QuestionType;
  question_text: string;
  options: string[] | null;
  show_when_question_id?: string | null;
  show_when_answer_value?: string | null;
  order_index: number;
  required: boolean;
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
