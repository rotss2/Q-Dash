export type BankQuestionType = 'multiple_choice' | 'true_false' | 'identification' | 'essay';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type ModeCompatibility = 'quiz' | 'exam' | 'survey' | 'all';

export interface QuestionBankItem {
  id: string;
  question_text: string;
  question_type: BankQuestionType;
  topic: string;
  difficulty: DifficultyLevel;
  explanation: string | null;
  points: number;
  correct_answer: string | null;
  correct_answers: string[] | null;
  options: QuestionBankOption[];
  mode_compatibility: ModeCompatibility[];
  created_by: string;
  created_at: string;
  updated_at: string;
  usage_count: number;
}

export interface QuestionBankOption {
  id: string;
  option_text: string;
  is_correct: boolean;
  order_index: number;
}

export interface QuestionBankFilter {
  topic?: string;
  difficulty?: DifficultyLevel;
  question_type?: BankQuestionType;
  mode?: ModeCompatibility;
  search?: string;
  created_by?: string;
}

export interface BulkImportQuestion {
  question_text: string;
  question_type: BankQuestionType;
  options: string[];
  correct_answer: string;
  topic: string;
  difficulty: DifficultyLevel;
  explanation?: string;
  points?: number;
  is_valid: boolean;
  errors: string[];
}

export interface BulkImportResult {
  questions: BulkImportQuestion[];
  valid_count: number;
  invalid_count: number;
  total_count: number;
}
