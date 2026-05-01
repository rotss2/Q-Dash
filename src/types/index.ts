export type UserRole = 'admin' | 'user';

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export type SurveyStatus = 'open' | 'closed';
export type QuestionType = 'text' | 'choice' | 'likert';

// NEW: Block type for strict element typing
export type BlockType = 'question' | 'heading' | 'instruction' | 'page_break';

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  admin_id: string;
  total_responses: number;
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
