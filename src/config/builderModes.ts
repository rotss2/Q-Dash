// Builder Mode Configuration for Survey, Quiz, and Exam modes
// Central source of truth for mode-specific UI and behavior

export type BuilderMode = 'survey' | 'quiz' | 'exam';

export interface TabConfig {
  id: string;
  label: string;
  icon?: string;
  required?: boolean;
  badge?: 'error' | 'warning' | 'success' | null;
}

export interface QuestionTypeConfig {
  id: string;
  label: string;
  icon: string;
  supported: boolean;
  scorable?: boolean;
}

export interface ToolConfig {
  id: string;
  label: string;
  icon: string;
  category: 'question' | 'layout' | 'smart';
  supported: boolean;
}

export interface FieldConfig {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'toggle' | 'textarea';
  required?: boolean;
  defaultValue?: unknown;
  options?: { value: string; label: string }[];
}

export interface TemplateConfig {
  id: string;
  title: string;
  description: string;
  questions: unknown[];
}

export interface EmptyStateConfig {
  title: string;
  description: string;
  buttonText: string;
}

export interface ModeConfig {
  mode: BuilderMode;
  label: string;
  builderTitle: string;
  description: string;
  icon: string;
  color: string;
  accentColor: string;
  tabs: TabConfig[];
  questionTypes: QuestionTypeConfig[];
  layoutBlocks: ToolConfig[];
  smartTools: ToolConfig[];
  questionFields: {
    show: string[];
    required: string[];
  };
  labels: {
    title: string;
    description: string;
    questions: string;
    check: string;
    publish: string;
    save: string;
    create: string;
  };
  templates: TemplateConfig[];
  emptyState: EmptyStateConfig;
  settings: {
    setup: FieldConfig[];
    scoring?: FieldConfig[];
    security?: FieldConfig[];
  };
  validation: {
    requireCorrectAnswer: boolean;
    requirePoints: boolean;
    requireTimeLimit: boolean;
    minOptions: number;
  };
  publish: {
    primaryLabel: string;
    showQrCode: boolean;
    showResultSettings: boolean;
  };
}

// ============================================
// SURVEY MODE CONFIGURATION
// ============================================
const surveyConfig: ModeConfig = {
  mode: 'survey',
  label: 'Survey',
  builderTitle: 'Survey Builder',
  description: 'Collect feedback, ratings, opinions, and research responses',
  icon: 'HelpCircle',
  color: 'blue',
  accentColor: 'bg-blue-500',
  tabs: [
    { id: 'setup', label: 'Setup', required: true },
    { id: 'design', label: 'Design' },
    { id: 'questions', label: 'Questions', required: true },
    { id: 'logic', label: 'Logic' },
    { id: 'preview', label: 'Preview' },
    { id: 'publish', label: 'Publish', required: true },
  ],
  questionTypes: [
    { id: 'text', label: 'Text Response', icon: 'Type', supported: true, scorable: false },
    { id: 'choice', label: 'Multiple Choice', icon: 'List', supported: true, scorable: false },
    { id: 'yes_no', label: 'Yes / No', icon: 'CheckCircle2', supported: true, scorable: false },
    { id: 'rating', label: 'Rating Scale', icon: 'Star', supported: true, scorable: false },
    { id: 'likert', label: 'Likert Scale', icon: 'BarChart3', supported: true, scorable: false },
    { id: 'dropdown', label: 'Dropdown', icon: 'ChevronDown', supported: true, scorable: false },
    { id: 'nps', label: 'NPS', icon: 'Gauge', supported: true, scorable: false },
  ],
  layoutBlocks: [
    { id: 'heading', label: 'Heading', icon: 'Heading', category: 'layout', supported: true },
    { id: 'instruction', label: 'Instruction', icon: 'FileText', category: 'layout', supported: true },
    { id: 'page_break', label: 'Page Break', icon: 'Separator', category: 'layout', supported: true },
  ],
  smartTools: [
    { id: 'bulk_import', label: 'Bulk Import', icon: 'Upload', category: 'smart', supported: true },
    { id: 'question_bank', label: 'Question Bank', icon: 'Database', category: 'smart', supported: true },
    { id: 'check', label: 'Check Survey', icon: 'CheckCircle', category: 'smart', supported: true },
    { id: 'logic_rules', label: 'Logic Rules', icon: 'GitBranch', category: 'smart', supported: true },
  ],
  questionFields: {
    show: ['question_text', 'type', 'options', 'required', 'show_when'],
    required: ['question_text', 'type'],
  },
  labels: {
    title: 'Survey Title',
    description: 'Survey Description',
    questions: 'Survey Questions',
    check: 'Check Survey',
    publish: 'Publish Survey',
    save: 'Save Survey',
    create: 'Create Survey',
  },
  templates: [
    { id: 'template-feedback', title: 'Customer Feedback', description: 'Collect feedback about your product or service', questions: [] },
    { id: 'template-event', title: 'Event Feedback', description: 'Gather attendee impressions after your event', questions: [] },
    { id: 'template-employee', title: 'Employee Satisfaction', description: 'Measure employee satisfaction and engagement', questions: [] },
    { id: 'template-training', title: 'Training Evaluation', description: 'Evaluate training program effectiveness', questions: [] },
    { id: 'template-nps', title: 'Net Promoter Score', description: 'Measure customer loyalty and satisfaction', questions: [] },
    { id: 'template-research', title: 'Research Questionnaire', description: 'Conduct academic or market research', questions: [] },
  ],
  emptyState: {
    title: 'No survey questions yet',
    description: 'Add feedback, rating, or research questions to get started.',
    buttonText: 'Add Survey Question',
  },
  settings: {
    setup: [
      { id: 'title', label: 'Survey Title', type: 'text', required: true },
      { id: 'description', label: 'Survey Description', type: 'textarea' },
      { id: 'open_date', label: 'Open Date', type: 'text' },
      { id: 'close_date', label: 'Close Date', type: 'text' },
      { id: 'status', label: 'Status', type: 'select', options: [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }] },
    ],
  },
  validation: {
    requireCorrectAnswer: false,
    requirePoints: false,
    requireTimeLimit: false,
    minOptions: 2,
  },
  publish: {
    primaryLabel: 'Publish Survey',
    showQrCode: true,
    showResultSettings: false,
  },
};

// ============================================
// QUIZ MODE CONFIGURATION
// ============================================
const quizConfig: ModeConfig = {
  mode: 'quiz',
  label: 'Quiz',
  builderTitle: 'Quiz Builder',
  description: 'Create scored practice assessments with instant feedback',
  icon: 'CheckSquare',
  color: 'green',
  accentColor: 'bg-green-500',
  tabs: [
    { id: 'setup', label: 'Setup', required: true },
    { id: 'questions', label: 'Questions', required: true },
    { id: 'answer_key', label: 'Answer Key', required: true },
    { id: 'scoring', label: 'Scoring', required: true },
    { id: 'feedback', label: 'Feedback' },
    { id: 'preview', label: 'Preview' },
    { id: 'publish', label: 'Publish', required: true },
  ],
  questionTypes: [
    { id: 'single_choice', label: 'Single Choice', icon: 'Circle', supported: true, scorable: true },
    { id: 'multiple_choice', label: 'Multiple Choice', icon: 'List', supported: true, scorable: true },
    { id: 'true_false', label: 'True / False', icon: 'ToggleLeft', supported: true, scorable: true },
    { id: 'short_answer', label: 'Short Answer', icon: 'Type', supported: true, scorable: true },
    { id: 'fill_blank', label: 'Fill in the Blank', icon: 'Square', supported: true, scorable: true },
    { id: 'essay', label: 'Essay', icon: 'FileText', supported: true, scorable: true },
  ],
  layoutBlocks: [
    { id: 'heading', label: 'Heading', icon: 'Heading', category: 'layout', supported: true },
    { id: 'instruction', label: 'Instruction', icon: 'FileText', category: 'layout', supported: true },
    { id: 'page_break', label: 'Page Break', icon: 'Separator', category: 'layout', supported: true },
  ],
  smartTools: [
    { id: 'answer_key_builder', label: 'Answer Key Builder', icon: 'Key', category: 'smart', supported: true },
    { id: 'bulk_import', label: 'Bulk Import with Answers', icon: 'Upload', category: 'smart', supported: true },
    { id: 'question_bank', label: 'Question Bank', icon: 'Database', category: 'smart', supported: true },
    { id: 'auto_grade_check', label: 'Auto Grade Check', icon: 'CheckCircle', category: 'smart', supported: true },
    { id: 'check', label: 'Check Quiz', icon: 'ClipboardCheck', category: 'smart', supported: true },
  ],
  questionFields: {
    show: ['question_text', 'type', 'options', 'required', 'points', 'correct_answer', 'correct_answers', 'explanation', 'grading_type', 'show_when'],
    required: ['question_text', 'type', 'points'],
  },
  labels: {
    title: 'Quiz Title',
    description: 'Quiz Instructions',
    questions: 'Quiz Questions',
    check: 'Check Quiz',
    publish: 'Publish Quiz',
    save: 'Save Quiz',
    create: 'Create Quiz',
  },
  templates: [
    { id: 'template-practice', title: 'Practice Quiz', description: 'Basic practice quiz with multiple choice questions', questions: [] },
    { id: 'template-lesson', title: 'Lesson Review', description: 'Review quiz for lesson comprehension', questions: [] },
    { id: 'template-vocabulary', title: 'Vocabulary Quiz', description: 'Test vocabulary knowledge', questions: [] },
    { id: 'template-safety', title: 'Safety Quiz', description: 'Workplace safety knowledge check', questions: [] },
    { id: 'template-knowledge', title: 'Knowledge Check', description: 'Quick multiple choice knowledge assessment', questions: [] },
    { id: 'template-tf', title: 'True or False Quiz', description: 'True or false style assessment', questions: [] },
  ],
  emptyState: {
    title: 'No quiz questions yet',
    description: 'Add scored questions with correct answers and explanations.',
    buttonText: 'Add Quiz Question',
  },
  settings: {
    setup: [
      { id: 'title', label: 'Quiz Title', type: 'text', required: true },
      { id: 'description', label: 'Quiz Instructions', type: 'textarea' },
      { id: 'open_date', label: 'Open Date', type: 'text' },
      { id: 'close_date', label: 'Close Date', type: 'text' },
      { id: 'status', label: 'Status', type: 'select', options: [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }] },
    ],
    scoring: [
      { id: 'show_score_immediately', label: 'Show Score Immediately', type: 'toggle', defaultValue: true },
      { id: 'show_correct_answers', label: 'Show Correct Answers', type: 'toggle', defaultValue: true },
      { id: 'show_explanations', label: 'Show Explanations', type: 'toggle', defaultValue: true },
      { id: 'max_attempts', label: 'Max Attempts', type: 'number' },
      { id: 'shuffle_questions', label: 'Shuffle Questions', type: 'toggle', defaultValue: false },
      { id: 'shuffle_options', label: 'Shuffle Options', type: 'toggle', defaultValue: false },
    ],
  },
  validation: {
    requireCorrectAnswer: true,
    requirePoints: true,
    requireTimeLimit: false,
    minOptions: 2,
  },
  publish: {
    primaryLabel: 'Publish Quiz',
    showQrCode: true,
    showResultSettings: true,
  },
};

// ============================================
// EXAM MODE CONFIGURATION
// ============================================
const examConfig: ModeConfig = {
  mode: 'exam',
  label: 'Exam',
  builderTitle: 'Exam Builder',
  description: 'Create formal timed assessments with controlled scoring and result release',
  icon: 'GraduationCap',
  color: 'purple',
  accentColor: 'bg-purple-500',
  tabs: [
    { id: 'setup', label: 'Setup', required: true },
    { id: 'questions', label: 'Questions', required: true },
    { id: 'scoring', label: 'Scoring', required: true },
    { id: 'security', label: 'Security', required: true },
    { id: 'review', label: 'Review' },
    { id: 'preview', label: 'Preview' },
    { id: 'publish', label: 'Publish', required: true },
  ],
  questionTypes: [
    { id: 'single_choice', label: 'Single Choice', icon: 'Circle', supported: true, scorable: true },
    { id: 'multiple_choice', label: 'Multiple Choice', icon: 'List', supported: true, scorable: true },
    { id: 'true_false', label: 'True / False', icon: 'ToggleLeft', supported: true, scorable: true },
    { id: 'short_answer', label: 'Short Answer', icon: 'Type', supported: true, scorable: true },
    { id: 'essay', label: 'Essay', icon: 'FileText', supported: true, scorable: true },
    { id: 'fill_blank', label: 'Fill in the Blank', icon: 'Square', supported: true, scorable: true },
  ],
  layoutBlocks: [
    { id: 'heading', label: 'Heading', icon: 'Heading', category: 'layout', supported: true },
    { id: 'instruction', label: 'Instruction', icon: 'FileText', category: 'layout', supported: true },
    { id: 'page_break', label: 'Page Break', icon: 'Separator', category: 'layout', supported: true },
  ],
  smartTools: [
    { id: 'exam_blueprint', label: 'Exam Blueprint', icon: 'LayoutGrid', category: 'smart', supported: true },
    { id: 'answer_key_builder', label: 'Answer Key Builder', icon: 'Key', category: 'smart', supported: true },
    { id: 'manual_grading', label: 'Manual Grading', icon: 'ClipboardCheck', category: 'smart', supported: true },
    { id: 'question_pool', label: 'Question Pool', icon: 'Database', category: 'smart', supported: true },
    { id: 'bulk_import', label: 'Bulk Import', icon: 'Upload', category: 'smart', supported: true },
    { id: 'check', label: 'Check Exam', icon: 'CheckCircle', category: 'smart', supported: true },
  ],
  questionFields: {
    show: ['question_text', 'type', 'options', 'required', 'points', 'correct_answer', 'correct_answers', 'explanation', 'grading_type', 'show_when'],
    required: ['question_text', 'type', 'points'],
  },
  labels: {
    title: 'Exam Title',
    description: 'Exam Instructions',
    questions: 'Exam Questions',
    check: 'Check Exam',
    publish: 'Publish Exam',
    save: 'Save Exam',
    create: 'Create Exam',
  },
  templates: [
    { id: 'template-midterm', title: 'Midterm Exam', description: 'Standard midterm examination format', questions: [] },
    { id: 'template-final', title: 'Final Exam', description: 'Comprehensive final examination', questions: [] },
    { id: 'template-certification', title: 'Certification Exam', description: 'Professional certification assessment', questions: [] },
    { id: 'template-timed', title: 'Timed Assessment', description: 'Time-limited knowledge assessment', questions: [] },
    { id: 'template-essay', title: 'Essay Exam', description: 'Essay-based examination', questions: [] },
    { id: 'template-mixed', title: 'Mixed Question Exam', description: 'Exam with multiple question types', questions: [] },
  ],
  emptyState: {
    title: 'No exam questions yet',
    description: 'Add formal assessment questions with points, timer, and grading rules.',
    buttonText: 'Add Exam Question',
  },
  settings: {
    setup: [
      { id: 'title', label: 'Exam Title', type: 'text', required: true },
      { id: 'description', label: 'Exam Instructions', type: 'textarea' },
      { id: 'open_date', label: 'Open Date', type: 'text' },
      { id: 'close_date', label: 'Close Date', type: 'text' },
      { id: 'status', label: 'Status', type: 'select', options: [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }] },
    ],
    scoring: [
      { id: 'passing_score', label: 'Passing Score (%)', type: 'number', required: true },
      { id: 'show_score_immediately', label: 'Show Score Immediately', type: 'toggle', defaultValue: false },
      { id: 'show_correct_answers', label: 'Show Correct Answers', type: 'toggle', defaultValue: false },
      { id: 'show_explanations', label: 'Show Explanations', type: 'toggle', defaultValue: false },
      { id: 'max_attempts', label: 'Max Attempts', type: 'number', required: true },
      { id: 'shuffle_questions', label: 'Shuffle Questions', type: 'toggle', defaultValue: false },
      { id: 'shuffle_options', label: 'Shuffle Options', type: 'toggle', defaultValue: false },
      { id: 'release_results_mode', label: 'Result Release', type: 'select', options: [
        { value: 'immediate', label: 'Immediate' },
        { value: 'after_close', label: 'After Close' },
        { value: 'manual', label: 'Manual' },
      ], defaultValue: 'manual' },
    ],
    security: [
      { id: 'time_limit_minutes', label: 'Time Limit (minutes)', type: 'number', required: true },
      { id: 'require_fullscreen', label: 'Require Fullscreen', type: 'toggle', defaultValue: false },
      { id: 'disable_copy_paste', label: 'Disable Copy/Paste', type: 'toggle', defaultValue: true },
      { id: 'disable_tab_switching', label: 'Disable Tab Switching', type: 'toggle', defaultValue: true },
      { id: 'anti_cheating_enabled', label: 'Anti-Cheating Protection', type: 'toggle', defaultValue: true },
    ],
  },
  validation: {
    requireCorrectAnswer: true,
    requirePoints: true,
    requireTimeLimit: true,
    minOptions: 2,
  },
  publish: {
    primaryLabel: 'Publish Exam',
    showQrCode: true,
    showResultSettings: true,
  },
};

// ============================================
// MODE CONFIGURATION MAP
// ============================================
export const MODE_CONFIGS: Record<BuilderMode, ModeConfig> = {
  survey: surveyConfig,
  quiz: quizConfig,
  exam: examConfig,
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function getConfigForMode(mode: BuilderMode): ModeConfig {
  return MODE_CONFIGS[mode] || MODE_CONFIGS.survey;
}

export function getTabsForMode(mode: BuilderMode): TabConfig[] {
  return getConfigForMode(mode).tabs;
}

export function getToolsForMode(mode: BuilderMode): { questionTypes: QuestionTypeConfig[]; layoutBlocks: ToolConfig[]; smartTools: ToolConfig[] } {
  const config = getConfigForMode(mode);
  return {
    questionTypes: config.questionTypes.filter(t => t.supported),
    layoutBlocks: config.layoutBlocks.filter(t => t.supported),
    smartTools: config.smartTools.filter(t => t.supported),
  };
}

export function getQuestionFieldsForMode(mode: BuilderMode): { show: string[]; required: string[] } {
  return getConfigForMode(mode).questionFields;
}

export function shouldShowField(mode: BuilderMode, fieldId: string): boolean {
  const fields = getQuestionFieldsForMode(mode);
  return fields.show.includes(fieldId);
}

export function isFieldRequired(mode: BuilderMode, fieldId: string): boolean {
  const fields = getQuestionFieldsForMode(mode);
  return fields.required.includes(fieldId);
}

export function validateBuilder(mode: BuilderMode, formData: unknown, questions: unknown[]): { valid: boolean; errors: string[]; warnings: string[] } {
  const config = getConfigForMode(mode);
  const errors: string[] = [];
  const warnings: string[] = [];

  // Title validation
  const data = formData as Record<string, unknown>;
  if (!data.title || (typeof data.title === 'string' && data.title.trim() === '')) {
    errors.push(`${config.label} title is required`);
  }

  // Question validation
  if (!questions || questions.length === 0) {
    errors.push('At least one question is required');
  } else {
    questions.forEach((q, index) => {
      const question = q as Record<string, unknown>;
      const qNum = index + 1;

      if (!question.question_text || (typeof question.question_text === 'string' && question.question_text.trim() === '')) {
        errors.push(`Question ${qNum}: Text is required`);
      }

      // Mode-specific validations
      if (config.validation.requirePoints) {
        const points = question.points as number | undefined;
        if (points === undefined || points === null || points <= 0) {
          errors.push(`Question ${qNum}: Points must be greater than 0`);
        }
      }

      if (config.validation.requireCorrectAnswer && question.grading_type !== 'manual') {
        const correctAnswer = question.correct_answer as string | undefined;
        const correctAnswers = question.correct_answers as string[] | undefined;
        const hasCorrectAnswer = correctAnswer || (correctAnswers && correctAnswers.length > 0);
        
        if (!hasCorrectAnswer && ['choice', 'single_choice', 'multiple_choice', 'true_false', 'yes_no'].includes(question.type as string)) {
          errors.push(`Question ${qNum}: Correct answer is required for auto-graded questions`);
        }
      }

      // Choice question validation
      if (['choice', 'single_choice', 'multiple_choice'].includes(question.type as string)) {
        const options = question.options as string[] | undefined;
        if (!options || options.length < config.validation.minOptions) {
          errors.push(`Question ${qNum}: Must have at least ${config.validation.minOptions} options`);
        }
      }
    });
  }

  // Exam-specific validations
  if (mode === 'exam') {
    const timeLimit = data.time_limit_minutes as number | undefined;
    if (!timeLimit || timeLimit <= 0) {
      warnings.push('Time limit is recommended for exams');
    }

    const passingScore = data.passing_score as number | undefined;
    if (!passingScore) {
      warnings.push('Passing score is recommended');
    }

    const releaseMode = data.release_results_mode as string | undefined;
    if (releaseMode === 'immediate') {
      warnings.push('Immediate result release may not be appropriate for exams');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function calculateTotalPoints(questions: Array<{ points?: number }>): number {
  return questions.reduce((sum, q) => sum + (q.points || 1), 0);
}

export function isQuestionScorable(question: unknown, mode: BuilderMode): boolean {
  if (mode === 'survey') return false;
  
  const q = question as { type?: string; grading_type?: string };
  const scorableTypes = ['single_choice', 'multiple_choice', 'true_false', 'yes_no', 'short_answer', 'fill_blank'];
  
  if (q.grading_type === 'manual') return false;
  return scorableTypes.includes(q.type || '');
}

export function getModeBadgeColor(mode: BuilderMode): string {
  const colors: Record<BuilderMode, string> = {
    survey: 'bg-blue-50 text-blue-700 border-blue-100',
    quiz: 'bg-green-50 text-green-700 border-green-100',
    exam: 'bg-purple-50 text-purple-700 border-purple-100',
  };
  return colors[mode] || colors.survey;
}

export function getModeIcon(mode: BuilderMode): string {
  return getConfigForMode(mode).icon;
}

export function getModeLabel(mode: BuilderMode): string {
  return getConfigForMode(mode).label;
}

export function getDefaultMode(): BuilderMode {
  return 'survey';
}

export function normalizeMode(mode: string | null | undefined): BuilderMode {
  if (mode === 'quiz' || mode === 'exam') return mode;
  return 'survey';
}
