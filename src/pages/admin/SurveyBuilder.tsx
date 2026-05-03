import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { apiGet, apiPost, apiPut } from '../../lib/api';
import { QuestionType, Survey } from '../../types';
import { ArrowLeft, Plus, Trash2, X, Save, FileText, AlertCircle, Globe, Calendar, GripVertical, Type, Info, Star, ToggleRight } from 'lucide-react';
import BulkQuestionImporter from '../../components/BulkQuestionImporter';

interface SurveyTemplate {
  id: string;
  title: string;
  description: string;
  questions: Omit<FormQuestion, 'id'>[];
}

interface FormQuestion {
  id: string;
  block_type: 'question' | 'heading' | 'instruction' | 'page_break';
  type: QuestionType;
  question_text: string;
  options: string[];
  section_id?: string | null;
  show_when_question_id?: string;
  show_when_answer_value?: string;
  required: boolean;
  order_index: number;
}

const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    id: 'template-feedback',
    title: 'Customer Feedback',
    description: 'Collect quick feedback from customers about your product or service.',
    questions: [
      { block_type: 'question', type: 'text', question_text: 'What did you like most about your experience?', options: [], required: true, order_index: 0 },
      { block_type: 'question', type: 'choice', question_text: 'How satisfied are you with our service?', options: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very dissatisfied'], required: true, order_index: 1 },
      { block_type: 'question', type: 'text', question_text: 'What can we improve?', options: [], required: false, order_index: 2 }
    ]
  },
  {
    id: 'template-nps',
    title: 'Net Promoter Score',
    description: 'Measure customer loyalty and likelihood to recommend your company.',
    questions: [
      { block_type: 'question', type: 'likert', question_text: 'How likely are you to recommend us to a friend?', options: ['1', '2', '3', '4', '5'], required: true, order_index: 0 },
      { block_type: 'question', type: 'text', question_text: 'Tell us why you chose that score.', options: [], required: false, order_index: 1 }
    ]
  },
  {
    id: 'template-event',
    title: 'Event Check-In',
    description: 'Gather attendee impressions and improvement ideas after your event.',
    questions: [
      { block_type: 'question', type: 'choice', question_text: 'How did you hear about the event?', options: ['Email', 'Social media', 'Friend', 'Website', 'Other'], required: true, order_index: 0 },
      { block_type: 'question', type: 'likert', question_text: 'How would you rate the event overall?', options: ['1', '2', '3', '4', '5'], required: true, order_index: 1 },
      { block_type: 'question', type: 'text', question_text: 'Any comments for our team?', options: [], required: false, order_index: 2 }
    ]
  }
];

export default function SurveyBuilder() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { surveyId } = useParams<{ surveyId?: string }>();
  const isEditing = !!surveyId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [theme, setTheme] = useState('default');
  const [fontFamily, setFontFamily] = useState('default');
  const [backgroundTheme, setBackgroundTheme] = useState('default');
  const [themeColor, setThemeColor] = useState('#111827');
  const [logoUrl, setLogoUrl] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [supportedLanguages, setSupportedLanguages] = useState('en,es');
  const [openDate, setOpenDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [antiCheatingEnabled, setAntiCheatingEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showBulkImporter, setShowBulkImporter] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // Track active question for relative insertion
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(null);
  
  // Connector tool state
  const [connectMode, setConnectMode] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [connections, setConnections] = useState<{from: string; to: string; id: string}[]>([]);

  useEffect(() => {
    if (isEditing && surveyId) {
      loadSurvey(surveyId);
    }
  }, [isEditing, surveyId]);

  const loadSurvey = async (id: string) => {
    setIsLoading(true);

    // Add cache-busting timestamp to force fresh data
    const timestamp = new Date().getTime();
    const { data, error } = await apiGet<{ survey: Survey; questions: FormQuestion[] }>(`/api/admin/surveys/${id}?_t=${timestamp}`);

    if (error || !data?.survey) {
      showToast(error || 'Failed to load survey', 'error');
      navigate('/admin');
      return;
    }

    setTitle(data.survey.title);
    setDescription(data.survey.description || '');
    if (data.survey.theme) setTheme(data.survey.theme);
    if (data.survey.font_family) setFontFamily(data.survey.font_family);
    if (data.survey.background_theme) setBackgroundTheme(data.survey.background_theme);
    setThemeColor(data.survey.theme_color || '#111827');
    setLogoUrl(data.survey.logo_url || '');
    setDefaultLanguage(data.survey.default_language || 'en');
    setSupportedLanguages((data.survey.supported_languages || ['en']).join(','));
    setOpenDate(data.survey.open_date ? new Date(data.survey.open_date).toISOString().slice(0, 16) : '');
    setCloseDate(data.survey.close_date ? new Date(data.survey.close_date).toISOString().slice(0, 16) : '');
    setAntiCheatingEnabled(data.survey.anti_cheating_enabled || false);
    // Ensure backwards compatibility: add default block_type for older surveys
    const questionsWithBlockType = (data.questions || []).map(q => ({
      ...q,
      block_type: q.block_type || 'question',
      section_id: q.section_id || null
    }));
    setQuestions(questionsWithBlockType);
    setIsLoading(false);
  };

  const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const applyTemplate = (templateId: string) => {
    const template = SURVEY_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;

    setTitle(template.title);
    setDescription(template.description);
    setQuestions(template.questions.map((question, index) => ({
      ...question,
      id: generateId(),
      order_index: index,
      section_id: null,
      show_when_question_id: undefined,
      show_when_answer_value: undefined
    })));
  };

  const addQuestion = (type: QuestionType, options: string[] = [], blockType: FormQuestion['block_type'] = 'question', insertAfterIndex?: number) => {
    const insertIndex = insertAfterIndex !== undefined ? insertAfterIndex + 1 : questions.length;
    const newQuestion: FormQuestion = {
      id: generateId(),
      block_type: blockType,
      type,
      question_text: '',
      options: options.length > 0 ? options : type === 'choice' ? ['Option 1', 'Option 2'] : type === 'likert' ? ['1', '2', '3', '4', '5'] : [],
      required: blockType === 'question',
      order_index: insertIndex
    };
    const newQuestions = [...questions];
    newQuestions.splice(insertIndex, 0, newQuestion);
    setQuestions(newQuestions.map((q, i) => ({ ...q, order_index: i })));
    setActiveQuestionIndex(insertIndex);
  };

  // Insert a block at a specific position
  const insertBlockAt = (index: number, blockType: FormQuestion['block_type']) => {
    const newQuestion: FormQuestion = {
      id: generateId(),
      block_type: blockType,
      type: 'text',
      question_text: blockType === 'heading' ? 'New Section Heading' : blockType === 'instruction' ? 'Instructions or information text...' : 'Page Break',
      options: [],
      required: false,
      order_index: index
    };
    const newQuestions = [...questions];
    newQuestions.splice(index, 0, newQuestion);
    setQuestions(newQuestions.map((q, i) => ({ ...q, order_index: i })));
  };

  // Add a section header
  const addSectionHeader = () => {
    const insertIndex = activeQuestionIndex !== null ? activeQuestionIndex + 1 : questions.length;
    const newQuestion: FormQuestion = {
      id: generateId(),
      block_type: 'heading',
      type: 'text',
      question_text: 'PART X: SECTION TITLE',
      options: [],
      required: false,
      order_index: insertIndex
    };
    const newQuestions = [...questions];
    newQuestions.splice(insertIndex, 0, newQuestion);
    setQuestions(newQuestions.map((q, i) => ({ ...q, order_index: i })));
    setActiveQuestionIndex(insertIndex);
    showToast('Section header added! Edit the text to your section title.', 'success');
  };

  // Add a legend/instruction
  const addLegend = () => {
    const insertIndex = activeQuestionIndex !== null ? activeQuestionIndex + 1 : questions.length;
    const newQuestion: FormQuestion = {
      id: generateId(),
      block_type: 'instruction',
      type: 'text',
      question_text: 'Instructions: 1 = Strongly Disagree, 2 = Disagree, 3 = Neutral, 4 = Agree, 5 = Strongly Agree',
      options: [],
      required: false,
      order_index: insertIndex
    };
    const newQuestions = [...questions];
    newQuestions.splice(insertIndex, 0, newQuestion);
    setQuestions(newQuestions.map((q, i) => ({ ...q, order_index: i })));
    setActiveQuestionIndex(insertIndex);
    showToast('Legend added! Edit the text to customize instructions.', 'success');
  };

  // Add a 1-5 rating scale question
  const addRatingScale = () => {
    addQuestion('likert', ['1', '2', '3', '4', '5'], 'question', activeQuestionIndex !== null ? activeQuestionIndex : undefined);
    showToast('Rating scale (1-5) question added!', 'success');
  };

  // Toggle all questions required
  const toggleAllRequired = () => {
    const allRequired = questions.every(q => q.required);
    setQuestions(questions.map(q => ({ ...q, required: !allRequired })));
    showToast(allRequired ? 'All questions set to optional' : 'All questions set to required', 'success');
  };

  /**
   * Boolean questions are stored as 'choice' type with ['Yes', 'No'] options.
   * The database schema only supports: 'text' | 'choice' | 'likert' (see schema.sql line 39)
   * The UI displays it as "Boolean" when options are exactly ['Yes', 'No'] (see line 464-466).
   * This is intentional design - there is no separate 'boolean' column in the database.
   */
  const addBooleanQuestion = (insertAfterIndex?: number) => {
    addQuestion('choice', ['Yes', 'No'], 'question', insertAfterIndex);
  };

  const updateQuestion = (id: string, updates: Partial<FormQuestion>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const addOption = (questionId: string) => {
    const question = questions.find(q => q.id === questionId);
    if (question) {
      updateQuestion(questionId, { options: [...question.options, `Option ${question.options.length + 1}`] });
    }
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    const question = questions.find(q => q.id === questionId);
    if (question) {
      const newOptions = [...question.options];
      newOptions[optionIndex] = value;
      updateQuestion(questionId, { options: newOptions });
    }
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    const question = questions.find(q => q.id === questionId);
    if (question && question.options.length > 2) {
      const newOptions = question.options.filter((_, i) => i !== optionIndex);
      updateQuestion(questionId, { options: newOptions });
    }
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newQuestions = [...questions];
      [newQuestions[index], newQuestions[index - 1]] = [newQuestions[index - 1], newQuestions[index]];
      setQuestions(newQuestions.map((q, i) => ({ ...q, order_index: i })));
    } else if (direction === 'down' && index < questions.length - 1) {
      const newQuestions = [...questions];
      [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];
      setQuestions(newQuestions.map((q, i) => ({ ...q, order_index: i })));
    }
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // Optimized: Pre-calculate all group info in one pass (O(n) instead of O(n²))
  interface GroupInfo {
    isGrouped: boolean;
    groupStartIndex: number;
    isGroupStart: boolean;
    hasHeadingBefore: boolean;
    hasHeadingAfter: boolean;
  }
  
  const groupInfoMap = useMemo<Map<number, GroupInfo>>(() => {
    const map = new Map<number, GroupInfo>();
    
    // First pass: find all heading positions
    const headingPositions: number[] = [];
    for (let i = 0; i < questions.length; i++) {
      if (questions[i].block_type === 'heading') {
        headingPositions.push(i);
      }
    }
    
    // Second pass: assign group info to each question
    for (let i = 0; i < questions.length; i++) {
      const currentQ = questions[i];
      
      if (currentQ?.block_type === 'heading') {
        map.set(i, { isGrouped: true, groupStartIndex: i, isGroupStart: true, hasHeadingBefore: false, hasHeadingAfter: false });
        continue;
      }
      
      // Find nearest headings before and after
      let backwardHeading = -1;
      let forwardHeading = -1;
      
      for (const headingPos of headingPositions) {
        if (headingPos < i) {
          // Check if there's a page break between this heading and current position
          let hasPageBreak = false;
          for (let j = headingPos + 1; j < i; j++) {
            if (questions[j].block_type === 'page_break') {
              hasPageBreak = true;
              break;
            }
          }
          if (!hasPageBreak) backwardHeading = headingPos;
        } else if (headingPos > i && forwardHeading === -1) {
          // Check if there's a page break between current position and this heading
          let hasPageBreak = false;
          for (let j = i + 1; j < headingPos; j++) {
            if (questions[j].block_type === 'page_break') {
              hasPageBreak = true;
              break;
            }
          }
          if (!hasPageBreak) forwardHeading = headingPos;
        }
      }
      
      const hasNearbyHeading = backwardHeading !== -1 || forwardHeading !== -1;
      const groupStart = backwardHeading !== -1 ? backwardHeading : forwardHeading;
      
      map.set(i, {
        isGrouped: hasNearbyHeading && groupStart !== -1,
        groupStartIndex: groupStart,
        isGroupStart: false,
        hasHeadingBefore: backwardHeading !== -1,
        hasHeadingAfter: forwardHeading !== -1
      });
    }
    
    return map;
  }, [questions]);

  // Helper: Get group info from pre-calculated map
  const getGroupInfo = (index: number): GroupInfo => {
    return groupInfoMap.get(index) || { isGrouped: false, groupStartIndex: -1, isGroupStart: false, hasHeadingBefore: false, hasHeadingAfter: false };
  };

  // Connector functions
  const toggleConnectMode = () => {
    setConnectMode(!connectMode);
    setSelectedSource(null);
    if (!connectMode) {
      showToast('Connect Mode: Click two items to connect them', 'info');
    }
  };

  const handleItemClickForConnect = (questionId: string) => {
    if (!connectMode) return;
    
    if (!selectedSource) {
      setSelectedSource(questionId);
      showToast('Source selected. Click another item to connect.', 'info');
    } else if (selectedSource === questionId) {
      setSelectedSource(null);
      showToast('Source deselected.', 'info');
    } else {
      // Create connection
      const newConnection = {
        from: selectedSource,
        to: questionId,
        id: `${selectedSource}-${questionId}-${Date.now()}`
      };
      setConnections([...connections, newConnection]);
      setSelectedSource(null);
      showToast('Connected!', 'success');
    }
  };

  const removeConnection = (connectionId: string) => {
    setConnections(connections.filter(c => c.id !== connectionId));
  };

  const clearAllConnections = () => {
    setConnections([]);
    setSelectedSource(null);
    showToast('All connections cleared', 'info');
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newQuestions = [...questions];
    const [removed] = newQuestions.splice(draggedIndex, 1);
    newQuestions.splice(dropIndex, 0, removed);
    
    setQuestions(newQuestions.map((q, i) => ({ ...q, order_index: i })));
    setDraggedIndex(null);
    setDragOverIndex(null);
    showToast('Question moved successfully!', 'success');
  };

  const saveSurvey = async () => {
    if (!title.trim()) {
      showToast('Please enter a survey title', 'error');
      return;
    }

    if (!questions || questions.length === 0) {
      showToast('Please add at least one question', 'error');
      return;
    }

    for (const q of questions) {
      if (!q.question_text.trim()) {
        showToast('All questions must have text', 'error');
        return;
      }
      if (q.type === 'choice' && q.options.some(o => !o.trim())) {
        showToast('All choice options must have text', 'error');
        return;
      }
    }

    setIsSaving(true);

    try {
      const payload = {
        title,
        description,
        theme,
        background_theme: backgroundTheme,
        font_family: fontFamily,
        theme_color: themeColor,
        logo_url: logoUrl || null,
        default_language: defaultLanguage || null,
        supported_languages: supportedLanguages.split(',').map((lang) => lang.trim()).filter(Boolean),
        open_date: openDate ? new Date(openDate).toISOString() : null,
        close_date: closeDate ? new Date(closeDate).toISOString() : null,
        anti_cheating_enabled: antiCheatingEnabled,
        questions
      };

      const response = isEditing && surveyId
        ? await apiPut<{ survey: Survey }>(`/api/admin/surveys/${surveyId}`, payload)
        : await apiPost<{ survey: Survey }>('/api/admin/surveys', payload);

      if (response.error) {
        throw new Error(response.error);
      }

      showToast(isEditing ? 'Survey updated successfully' : 'Survey created successfully', 'success');
      navigate('/admin');
    } catch (error: any) {
      console.error('Survey save error:', error);
      const errorMessage = error?.message || 'Unknown error';
      showToast(`Failed to save survey: ${errorMessage}`, 'error');
    }

    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Simplified */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <button
              onClick={() => navigate('/admin')}
              className="group flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
            >
              <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-gray-200 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="font-medium hidden sm:inline">Back to Dashboard</span>
              <span className="font-medium sm:hidden">Back</span>
            </button>
            {isEditing && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                Editing Mode
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 sm:pb-8">
        {/* Survey Details */}
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="card">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <span className="text-xl">📋</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
                <p className="text-sm text-gray-500">Define your survey identity</p>
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <label className="label flex items-center gap-1">
                  Survey Title
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input text-lg font-medium"
                  placeholder="e.g., Customer Satisfaction Survey 2024"
                />
                <p className="text-xs text-gray-500 mt-2">Give your survey a clear, descriptive title that respondents will recognize.</p>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input min-h-[100px] resize-y"
                  placeholder="Briefly explain the purpose of this survey to your respondents..."
                />
                <p className="text-xs text-gray-500 mt-2">Optional context shown to respondents before they start. Helps set expectations.</p>
              </div>
            </div>
          </div>

          {/* Appearance & Settings - Two Column Layout on Desktop */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Appearance */}
            <div className="card">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <span className="text-xl">🎨</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Appearance & Branding</h2>
                  <p className="text-sm text-gray-500">Customize the visual style</p>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="label">Brand Color</label>
                  <div className="flex gap-3 items-center">
                    <div className="relative">
                      <input
                        type="color"
                        value={themeColor}
                        onChange={(e) => setThemeColor(e.target.value)}
                        className="h-12 w-12 rounded-xl border-2 border-gray-200 p-0 cursor-pointer overflow-hidden shadow-sm"
                      />
                      <div 
                        className="absolute inset-0 rounded-xl border-2 border-gray-300 pointer-events-none"
                        style={{ borderColor: themeColor }}
                      ></div>
                    </div>
                    <input
                      type="text"
                      value={themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                      className="flex-1 input font-mono text-sm uppercase"
                      placeholder="#111827"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Logo URL</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="input pl-10"
                      placeholder="https://yoursite.com/logo.png"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🖼️</span>
                  </div>
                  {logoUrl && (
                    <div className="mt-3 flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                      <div className="w-14 h-14 rounded-lg bg-white border border-gray-200 flex items-center justify-center p-2 shadow-sm">
                        <img src={logoUrl} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Logo Preview</p>
                        <p className="text-xs text-gray-500">This will appear on the survey header</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Theme Style</label>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      className="input"
                    >
                      <option value="default">🎯 Modern</option>
                      <option value="warm">🌅 Warm</option>
                      <option value="cool">❄️ Cool</option>
                      <option value="forest">🌲 Forest</option>
                      <option value="dark">🌙 Dark</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Font</label>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="input"
                    >
                      <option value="default">System</option>
                      <option value="serif">Serif</option>
                      <option value="sans">Sans-serif</option>
                      <option value="mono">Monospace</option>
                      <option value="rounded">Rounded</option>
                      <option value="elegant">Elegant</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Background</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { value: 'default', icon: '⬜', label: 'Plain' },
                      { value: 'ocean', icon: '🌊', label: 'Ocean' },
                      { value: 'sunset', icon: '🌅', label: 'Sunset' },
                      { value: 'forest', icon: '🌲', label: 'Forest' },
                      { value: 'galaxy', icon: '🌌', label: 'Galaxy' },
                      { value: 'minimal', icon: '✨', label: 'Minimal' }
                    ].map((bg) => (
                      <button
                        key={bg.value}
                        onClick={() => setBackgroundTheme(bg.value)}
                        className={`flex flex-col items-center gap-1 p-2 sm:p-3 rounded-xl border-2 transition-all min-h-[44px] ${
                          backgroundTheme === bg.value
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <span className="text-2xl">{bg.icon}</span>
                        <span className="text-xs font-medium text-gray-700">{bg.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="card">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <span className="text-xl">⚙️</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Survey Settings</h2>
                  <p className="text-sm text-gray-500">Configure availability, language, and protection</p>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="label flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    Survey Schedule
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">Open</span>
                      <input
                        type="datetime-local"
                        value={openDate}
                        onChange={(e) => setOpenDate(e.target.value)}
                        className="input w-full pl-12 text-sm h-11"
                      />
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">Close</span>
                      <input
                        type="datetime-local"
                        value={closeDate}
                        onChange={(e) => setCloseDate(e.target.value)}
                        className="input w-full pl-12 text-sm h-11"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Optional: Limit when respondents can access the survey. Leave blank for always open.</p>
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <label className="label flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-500" />
                    Supported Languages
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(['English', 'Spanish', 'French', 'German', 'Chinese', 'Filipino'] as const).map((lang) => {
                      const langMap: Record<string, string> = { 'English': 'en', 'Spanish': 'es', 'French': 'fr', 'German': 'de', 'Chinese': 'zh', 'Filipino': 'fil' };
                      const langCode = langMap[lang];
                      const isSelected = supportedLanguages.split(',').map(l => l.trim()).includes(langCode);
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => {
                            const current = supportedLanguages.split(',').map(l => l.trim()).filter(Boolean);
                            if (isSelected) {
                              setSupportedLanguages(current.filter(l => l !== langCode).join(','));
                            } else {
                              setSupportedLanguages([...current, langCode].join(','));
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
                              : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                          }`}
                        >
                          {lang}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Select which languages respondents can choose from.</p>
                </div>
                
                <div>
                  <label className="label">Default Language</label>
                  <select
                    value={defaultLanguage}
                    onChange={(e) => setDefaultLanguage(e.target.value)}
                    className="input"
                  >
                    <option value="en">🇺🇸 English</option>
                    <option value="es">🇪🇸 Spanish</option>
                    <option value="fr">🇫🇷 French</option>
                    <option value="de">🇩🇪 German</option>
                    <option value="zh">🇨🇳 Chinese</option>
                    <option value="fil">🇵🇭 Filipino</option>
                  </select>
                </div>
                
                {/* Anti-Cheating Toggle */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-xl">🛡️</span>
                      </div>
                      <div className="min-w-0">
                        <label className="font-semibold text-gray-900 block text-sm sm:text-base">Anti-Cheating Protection</label>
                        <p className="text-xs sm:text-sm text-gray-500 truncate">Prevent screenshots, copying, and tab switching</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAntiCheatingEnabled(!antiCheatingEnabled)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex-shrink-0 ${
                        antiCheatingEnabled ? 'bg-red-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          antiCheatingEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  {antiCheatingEnabled && (
                    <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-700">
                        <span className="font-semibold">Features enabled:</span> Screenshot detection, copy/paste blocking, tab switching alerts, developer tools blocking, and traceable watermarks.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Templates */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <span className="text-xl">📄</span>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">Start from a Template</h2>
              <p className="text-sm text-gray-500">Save time with pre-built survey structures</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {SURVEY_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template.id)}
                className="group relative rounded-xl border-2 border-gray-100 bg-white p-5 text-left transition-all duration-200 hover:border-blue-300 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {template.id === 'template-feedback' && (
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shadow-sm">
                        <span className="text-2xl">💬</span>
                      </div>
                    )}
                    {template.id === 'template-nps' && (
                      <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shadow-sm">
                        <span className="text-2xl">⭐</span>
                      </div>
                    )}
                    {template.id === 'template-event' && (
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center shadow-sm">
                        <span className="text-2xl">📅</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900 mb-1.5 group-hover:text-blue-600 transition-colors">
                      {template.title}
                    </h4>
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{template.description}</p>
                  </div>
                </div>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0.5">
                  <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center">
                    <ArrowLeft className="w-4 h-4 text-blue-600 rotate-180" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Questions */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <span className="text-xl">❓</span>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">Survey Questions</h2>
              <p className="text-sm text-gray-500">{questions?.length || 0} items total • Build your survey flow</p>
            </div>
          </div>
          
          {/* Editor Tools - Quick Add */}
          <div className="mb-6 p-5 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-200/50 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-white text-sm font-bold">+</span>
                </div>
                <span className="text-sm font-bold text-indigo-900">Quick Add Tools</span>
              </div>
              <p className="hidden sm:block text-xs text-indigo-600/70">
                Click to insert at selected position
              </p>
            </div>
            
            <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-6 gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-2 px-2 sm:mx-0 sm:px-0">
              <button
                onClick={addSectionHeader}
                className="group flex flex-col items-center gap-2 p-3 bg-white rounded-xl border-2 border-indigo-100 hover:border-indigo-300 hover:shadow-md transition-all flex-shrink-0 w-[100px] sm:w-auto min-h-[80px]"
                title="Add a section title like 'PART A: EASE OF USE'"
              >
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                  <Type className="w-5 h-5 text-indigo-600" />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">Heading</span>
              </button>

              <button
                onClick={addLegend}
                className="group flex flex-col items-center gap-2 p-3 bg-white rounded-xl border-2 border-purple-100 hover:border-purple-300 hover:shadow-md transition-all flex-shrink-0 w-[100px] sm:w-auto min-h-[80px]"
                title="Add instructions like '1 = Strongly Disagree...'"
              >
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <Info className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">Legend</span>
              </button>

              <button
                onClick={addRatingScale}
                className="group flex flex-col items-center gap-2 p-3 bg-white rounded-xl border-2 border-blue-100 hover:border-blue-300 hover:shadow-md transition-all flex-shrink-0 w-[100px] sm:w-auto min-h-[80px]"
                title="Add a 1-5 rating scale question"
              >
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <Star className="w-5 h-5 text-blue-600" />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">Rating</span>
              </button>

              <button
                onClick={toggleAllRequired}
                className="group flex flex-col items-center gap-2 p-3 bg-white rounded-xl border-2 border-green-100 hover:border-green-300 hover:shadow-md transition-all flex-shrink-0 w-[100px] sm:w-auto min-h-[80px]"
                title="Toggle all questions between required and optional"
              >
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <ToggleRight className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">Required</span>
              </button>

              <button
                onClick={toggleConnectMode}
                className={`group flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all flex-shrink-0 w-[100px] sm:w-auto min-h-[80px] ${connectMode ? 'bg-orange-50 border-orange-300 shadow-md' : 'bg-white border-pink-100 hover:border-pink-300 hover:shadow-md'}`}
                title="Click to connect questions and blocks together"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${connectMode ? 'bg-orange-200' : 'bg-pink-100 group-hover:bg-pink-200'}`}>
                  <svg className={`w-5 h-5 ${connectMode ? 'text-orange-600' : 'text-pink-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-gray-700 text-center">
                  {connectMode ? `Links (${connections.length})` : 'Connect'}
                </span>
              </button>

              {connections.length > 0 && (
                <button
                  onClick={clearAllConnections}
                  className="group flex flex-col items-center gap-2 p-3 bg-white rounded-xl border-2 border-red-100 hover:border-red-300 hover:shadow-md transition-all flex-shrink-0 w-[100px] sm:w-auto min-h-[80px]"
                  title="Remove all connections"
                >
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors">
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-gray-700 text-center">Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Add Question Section */}
          <div className="mb-6 p-5 bg-gray-50/80 rounded-2xl border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                  <Plus className="w-4 h-4 text-gray-700" />
                </div>
                <span className="text-sm font-bold text-gray-800">Add Elements</span>
              </div>
              {activeQuestionIndex !== null && (
                <span className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 font-medium">
                  Inserting after Q{activeQuestionIndex + 1}
                </span>
              )}
            </div>
            
            {/* Question Types */}
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Question Types</p>
              <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2 overflow-x-auto pb-2 -mx-2 px-2 sm:mx-0 sm:px-0">
                <button
                  onClick={() => addQuestion('text', [], 'question', activeQuestionIndex !== null ? activeQuestionIndex : undefined)}
                  className="group flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all flex-shrink-0 w-[160px] sm:w-auto min-h-[60px]"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors flex-shrink-0">
                    <span className="text-blue-600 text-xs font-bold">T</span>
                  </div>
                  <div className="text-left min-w-0">
                    <span className="block text-sm font-medium text-gray-800">Text</span>
                    <span className="block text-xs text-gray-500 truncate">Open-ended</span>
                  </div>
                </button>

                <button
                  onClick={() => addQuestion('choice', [], 'question', activeQuestionIndex !== null ? activeQuestionIndex : undefined)}
                  className="group flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-green-300 hover:shadow-md transition-all flex-shrink-0 w-[160px] sm:w-auto min-h-[60px]"
                >
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors flex-shrink-0">
                    <span className="text-green-600 text-xs font-bold">✓</span>
                  </div>
                  <div className="text-left min-w-0">
                    <span className="block text-sm font-medium text-gray-800">Choice</span>
                    <span className="block text-xs text-gray-500 truncate">Multiple options</span>
                  </div>
                </button>
                
                <button
                  onClick={() => addBooleanQuestion(activeQuestionIndex !== null ? activeQuestionIndex : undefined)}
                  className="group flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-md transition-all flex-shrink-0 w-[160px] sm:w-auto min-h-[60px]"
                >
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors flex-shrink-0">
                    <span className="text-purple-600 text-xs font-bold">?</span>
                  </div>
                  <div className="text-left min-w-0">
                    <span className="block text-sm font-medium text-gray-800">Yes/No</span>
                    <span className="block text-xs text-gray-500 truncate">Binary</span>
                  </div>
                </button>

                <button
                  onClick={() => addQuestion('likert', [], 'question', activeQuestionIndex !== null ? activeQuestionIndex : undefined)}
                  className="group flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-orange-300 hover:shadow-md transition-all flex-shrink-0 w-[160px] sm:w-auto min-h-[60px]"
                >
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors flex-shrink-0">
                    <span className="text-orange-600 text-xs font-bold">1-5</span>
                  </div>
                  <div className="text-left min-w-0">
                    <span className="block text-sm font-medium text-gray-800">Rating</span>
                    <span className="block text-xs text-gray-500 truncate">1-5 scale</span>
                  </div>
                </button>
              </div>
            </div>
            
            {/* Utility Buttons */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Utility & Import</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowBulkImporter(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all text-sm"
                >
                  <FileText className="w-4 h-4 text-gray-600" />
                  <span className="font-medium">Bulk Import</span>
                </button>
                
                <div className="relative group">
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/emergency-demo', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' }
                        });
                        const data = await response.json();
                        if (data.success && data.questions) {
                          const newQuestions = data.questions.map((q: any, index: number) => ({
                            id: generateId(),
                            block_type: q.block_type || 'question',
                            type: q.type,
                            question_text: q.question_text,
                            options: q.options || [],
                            required: q.required,
                            order_index: questions?.length || 0 + index,
                            section_id: null,
                            show_when_question_id: undefined,
                            show_when_answer_value: undefined
                          }));
                          setQuestions([...questions, ...newQuestions]);
                          showToast(`${newQuestions.length} emergency questions added`, 'success');
                        }
                      } catch (error) {
                        showToast('Emergency fallback failed', 'error');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 hover:border-amber-300 transition-all text-sm"
                  >
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-800">Emergency Demo</span>
                  </button>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    <p className="font-semibold mb-1">Emergency Question Bank</p>
                    <p>Instantly adds pre-built critical safety questions for emergency response scenarios.</p>
                    <div className="absolute bottom-0 left-6 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-800"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Questions List with Visual Flow */}
          <div className="relative space-y-10">
            {/* Visual connector line - runs through all questions */}
            <div className="absolute left-[22px] sm:left-[26px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-indigo-300 via-purple-300 to-indigo-300 rounded-full hidden sm:block"></div>
            
            {/* Connection nodes for each question */}
          {/* Connection lines layer - renders all manual connections */}
          <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none" style={{minHeight: '100%'}}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#f97316" />
              </marker>
            </defs>
            {connections.map((conn) => {
              const fromIndex = questions.findIndex(q => q.id === conn.from);
              const toIndex = questions.findIndex(q => q.id === conn.to);
              if (fromIndex === -1 || toIndex === -1) return null;
              
              // Calculate positions (approximate)
              const fromY = fromIndex * 200 + 100; // Approximate card height
              const toY = toIndex * 200 + 100;
              const fromX = 300;
              const toX = 300;
              
              return (
                <g key={conn.id} className={`${connectMode ? 'cursor-pointer pointer-events-auto' : 'pointer-events-none'}`} onClick={connectMode ? () => removeConnection(conn.id) : undefined}>
                  <path
                    d={`M ${fromX} ${fromY} Q ${fromX + 100} ${(fromY + toY) / 2} ${toX} ${toY}`}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="3"
                    markerEnd="url(#arrowhead)"
                    strokeDasharray="5,5"
                    className="hover:stroke-red-500 transition-colors"
                  />
                  {/* Delete hint label */}
                  <text
                    x={(fromX + toX) / 2 + 50}
                    y={(fromY + toY) / 2}
                    className="opacity-0 group-hover:opacity-100 text-[10px] fill-red-500 font-medium transition-opacity pointer-events-none"
                  >
                    Click to remove
                  </text>
                </g>
              );
            })}
          </svg>

          {questions.map((question, index) => {
            const groupInfo = getGroupInfo(index);
            const isSource = selectedSource === question.id;
            const isConnected = connections.some(c => c.from === question.id || c.to === question.id);
            const connectionCount = connections.filter(c => c.from === question.id || c.to === question.id).length;
            
            return (
            <div 
              key={question.id} 
              className={`relative transition-all ${dragOverIndex === index ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''} ${connectMode ? 'cursor-pointer' : ''} ${isSource ? 'ring-4 ring-orange-400 bg-orange-50' : ''} ${isConnected && !isSource ? 'ring-2 ring-orange-200' : ''} ${activeQuestionIndex === index ? 'ring-2 ring-blue-400 z-10' : ''}`}
              draggable={!connectMode}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onClick={connectMode ? () => handleItemClickForConnect(question.id) : () => setActiveQuestionIndex(index)}
            >
              {/* Active indicator badge */}
              {activeQuestionIndex === index && !connectMode && (
                <div className="absolute -top-3 right-4 z-20 rounded-full bg-blue-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                  Active
                </div>
              )}
              {/* Connection node - visual dot on the timeline */}
              <div className="absolute left-[18px] sm:left-[22px] top-8 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white shadow-sm hidden sm:block z-10"></div>
              
              {/* Section grouping indicator - shows when this is start of a new section */}
              {question.block_type === 'heading' && index > 0 && (
                <div className="relative z-20 my-2 flex items-center justify-center">
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-indigo-200" />
                  <span className="relative z-10 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-600 shadow-sm">
                    New Section
                  </span>
                </div>
              )}
              
              {/* Page break connector */}
              {question.block_type === 'page_break' && (
                <>
                  <div className="absolute left-0 right-0 top-0 flex items-center justify-center -mt-3">
                    <div className="bg-gray-200 text-gray-600 text-[10px] px-3 py-1 rounded-full border border-gray-300 font-medium flex items-center gap-1.5 shadow-sm">
                      <span>↵</span> Page Break
                    </div>
                  </div>
                  {/* Visual page break spacing */}
                  <div className="my-4 border-t-2 border-dashed border-gray-300"></div>
                </>
              )}
              
              {/* Visual Group Frame - surrounds all grouped items */}
              {groupInfo.isGrouped && (
                <div className="absolute left-10 sm:left-12 right-0 top-0 bottom-0 border-l-2 border-indigo-200 bg-indigo-50/20 rounded-r-lg pointer-events-none"></div>
              )}
              
              {/* Connector line UP to heading before */}
              {(groupInfo.hasHeadingBefore || (groupInfo.isGroupStart && index > 0 && getGroupInfo(index - 1).hasHeadingAfter)) && (
                <div className="absolute left-10 sm:left-12 top-[-16px] bottom-full w-0.5 bg-indigo-300 z-0"></div>
              )}
              
              {/* Connector line DOWN to heading after */}
              {(groupInfo.hasHeadingAfter || (groupInfo.isGroupStart && index < questions.length - 1 && getGroupInfo(index + 1).hasHeadingBefore)) && (
                <div className="absolute left-10 sm:left-12 top-full bottom-[-16px] w-0.5 bg-indigo-300 z-0"></div>
              )}
              
              <div className={`card relative ml-0 sm:ml-2 p-5 sm:p-6 ${groupInfo.isGrouped ? 'border-indigo-200' : ''} ${groupInfo.isGroupStart ? 'ring-2 ring-indigo-400 shadow-md bg-white' : groupInfo.isGrouped ? 'bg-white/80' : ''}`}>
              {/* Insert toolbar - appears on hover */}
              <div className="flex items-center gap-1 mb-2 opacity-0 hover:opacity-100 transition-opacity -mt-4">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gray-300"></div>
                <span className="text-[10px] text-gray-400 uppercase">Insert</span>
                <button
                  onClick={() => insertBlockAt(index, 'heading')}
                  className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] rounded hover:bg-indigo-100 border border-indigo-200"
                  title="Insert heading here"
                >
                  H
                </button>
                <button
                  onClick={() => insertBlockAt(index, 'instruction')}
                  className="px-2 py-0.5 bg-cyan-50 text-cyan-600 text-[10px] rounded hover:bg-cyan-100 border border-cyan-200"
                  title="Insert instruction here"
                >
                  i
                </button>
                <button
                  onClick={() => insertBlockAt(index, 'page_break')}
                  className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded hover:bg-gray-200 border border-gray-300"
                  title="Insert page break here"
                >
                  ↵
                </button>
                <button
                  onClick={addLegend}
                  className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[10px] rounded hover:bg-purple-100 border border-purple-200"
                  title="Insert legend/notes here"
                >
                  ★
                </button>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gray-300"></div>
              </div>

              <div className="flex items-start gap-2 sm:gap-4">
                <div className="flex flex-col gap-1 items-center flex-shrink-0">
                  {/* Drag Handle */}
                  <div 
                    className="p-1.5 sm:p-2 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    title="Drag to reorder"
                  >
                    <GripVertical className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-gray-600 bg-gray-100 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">{index + 1}</span>
                  <div className="flex flex-col">
                    <button
                      onClick={() => moveQuestion(index, 'up')}
                      disabled={index === 0}
                      className="p-0.5 sm:p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move up"
                    >
                      <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 -rotate-90" />
                    </button>
                    <button
                      onClick={() => moveQuestion(index, 'down')}
                      disabled={index === questions.length - 1}
                      className="p-0.5 sm:p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                      title="Move down"
                    >
                      <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 rotate-90" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 space-y-5">
                  {/* Connect Mode Badges */}
                  {connectMode && (
                    <div className="flex items-center gap-2">
                      {isSource && (
                        <span className="px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded-full animate-pulse">
                          SOURCE - Click target to connect
                        </span>
                      )}
                      {connectionCount > 0 && !isSource && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full border border-orange-200">
                          {connectionCount} connection{connectionCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {!isSource && !isConnected && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
                          Click to {selectedSource ? 'connect here' : 'select as source'}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Card Header: Type Badge + Required Badge + Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Block Type Badge */}
                    {question.block_type === 'heading' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700">
                        <Type className="w-3 h-3" />
                        Section Heading
                      </span>
                    )}
                    {question.block_type === 'instruction' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-medium text-cyan-700">
                        <Info className="w-3 h-3" />
                        Instruction
                      </span>
                    )}
                    {question.block_type === 'page_break' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                        <span className="text-xs">↵</span>
                        Page Break
                      </span>
                    )}
                    {question.block_type === 'question' && (
                      <>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {question.type === 'text'
                            ? 'Text Answer'
                            : question.type === 'choice'
                              ? (question.options.length === 2 && question.options.includes('Yes') && question.options.includes('No') ? 'Yes / No' : 'Multiple Choice')
                              : 'Rating Scale'}
                        </span>
                        {question.required && (
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                            Required
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* Required Toggle - separate row for better visibility */}
                  {question.block_type === 'question' && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => updateQuestion(question.id, { required: !question.required })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                          question.required ? 'bg-primary-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            question.required ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className={`text-sm font-medium ${question.required ? 'text-gray-900' : 'text-gray-500'}`}>
                        {question.required ? 'Required question' : 'Optional question'}
                      </span>
                    </div>
                  )}

                  {/* Text Input with placeholder based on block type */}
                  <input
                    type="text"
                    value={question.question_text}
                    onChange={(e) => updateQuestion(question.id, { question_text: e.target.value })}
                    className={`input min-w-0 ${question.block_type === 'heading' ? 'text-lg font-semibold text-indigo-900' : question.block_type === 'instruction' ? 'text-cyan-900' : ''}`}
                    placeholder={
                      question.block_type === 'heading' ? 'Enter section heading title...' :
                      question.block_type === 'instruction' ? 'Enter instruction or information text...' :
                      question.block_type === 'page_break' ? 'Page break (optional label)...' :
                      'Enter your question'
                    }
                  />

                  {/* Conditional logic and options only for question blocks */}
                  {question.block_type === 'question' && (
                    <>
                      {/* Question type-specific options */}
                      {question.type === 'choice' && (
                        <div className="space-y-2">
                          <label className="label">Options</label>
                          <div className="space-y-2">
                            {question.options.map((option, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => {
                                    const newOptions = [...question.options];
                                    newOptions[optIndex] = e.target.value;
                                    updateQuestion(question.id, { options: newOptions });
                                  }}
                                  className="input flex-1"
                                  placeholder={`Option ${optIndex + 1}`}
                                />
                                <button
                                  onClick={() => {
                                    const newOptions = question.options.filter((_, i) => i !== optIndex);
                                    updateQuestion(question.id, { options: newOptions });
                                  }}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                  title="Remove option"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => updateQuestion(question.id, { options: [...question.options, `Option ${question.options.length + 1}`] })}
                              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                            >
                              + Add Option
                            </button>
                          </div>
                        </div>
                      )}
                      {/* Advanced Settings - Conditional Logic */}
                      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm font-semibold text-gray-700">Display Condition</span>
                          <span className="text-xs text-gray-500">(Optional)</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">
                          Show this question only when a previous answer matches your condition.
                        </p>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div>
                            <label className="label text-xs">Show when this question is answered:</label>
                            <select
                              value={question.show_when_question_id || ''}
                              onChange={(e) => updateQuestion(question.id, { show_when_question_id: e.target.value || undefined })}
                              className="input text-sm"
                            >
                              <option value="">— Always show —</option>
                              {questions.slice(0, index).map((prevQ) => (
                                <option key={prevQ.id} value={prevQ.id}>Q{prevQ.order_index + 1}: {prevQ.question_text.slice(0, 40)}{prevQ.question_text.length > 40 ? '...' : ''}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="label text-xs">And the answer equals:</label>
                            <input
                              type="text"
                              value={question.show_when_answer_value || ''}
                              onChange={(e) => updateQuestion(question.id, { show_when_answer_value: e.target.value || undefined })}
                              className="input text-sm"
                              placeholder="e.g., Yes, Option A, 5"
                              disabled={!question.show_when_question_id}
                            />
                          </div>
                        </div>
                      </div>

                      {question.type === 'choice' && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Options</p>
                      {question.options.map((option, optIndex) => (
                        <div key={optIndex} className="flex flex-col gap-2 sm:flex-row sm:items-center w-full">
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => updateOption(question.id, optIndex, e.target.value)}
                            className="input flex-1 min-w-0"
                            placeholder={`Option ${optIndex + 1}`}
                          />
                          {question.options.length > 2 && (
                            <button
                              onClick={() => removeOption(question.id, optIndex)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => addOption(question.id)}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        + Add Option
                      </button>
                    </div>
                  )}

                  {question.type === 'likert' && (
                    <div className="flex gap-4 items-center">
                      <span className="text-sm text-gray-500">Scale: 1 to 5</span>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((num) => (
                          <div
                            key={num}
                            className="w-10 h-10 rounded-lg border-2 border-gray-200 flex items-center justify-center text-gray-400"
                          >
                            {num}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </>
                )}
                </div>

                <button
                  onClick={() => {
                    const confirmMessage = question.block_type === 'heading' 
                      ? 'Are you sure you want to delete this section heading?' 
                      : question.block_type === 'instruction'
                        ? 'Are you sure you want to delete this instruction?'
                        : question.block_type === 'page_break'
                          ? 'Are you sure you want to delete this page break?'
                          : 'Are you sure you want to delete this question?';
                    if (window.confirm(confirmMessage)) {
                      deleteQuestion(question.id);
                    }
                  }}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              </div>
            </div>
          );
          })}
          </div>
          
          {questions.length === 0 && !showBulkImporter && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
                <Plus className="w-6 h-6 text-indigo-600" />
              </div>
              
              <h3 className="text-base font-semibold text-gray-900">
                No questions yet
              </h3>
              
              <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
                Start building your survey by adding your first question or section. Use the tools above to add questions, headings, or import in bulk.
              </p>
              
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => addQuestion('text', [], 'question')}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Question
                </button>
                <button
                  onClick={() => setShowBulkImporter(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  <FileText className="w-4 h-4" />
                  Bulk Import
                </button>
              </div>
            </div>
          )}

          
          {/* Bulk Question Importer */}
          {showBulkImporter && (
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Bulk Import Questions</h3>
                <button
                  onClick={() => setShowBulkImporter(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <BulkQuestionImporter
                onImport={(importedQuestions) => {
                  const newQuestions: FormQuestion[] = importedQuestions.map((q, index) => {
                    const type: QuestionType = q.type;
                    const blockType: FormQuestion['block_type'] = q.block_type || 'question';
                    const options = type === 'choice'
                      ? q.options.length > 0 ? q.options : ['Option 1', 'Option 2']
                      : type === 'likert'
                        ? ['1', '2', '3', '4', '5']
                        : [];

                    return {
                      id: generateId(),
                      block_type: blockType,
                      type,
                      question_text: q.text,
                      options,
                      required: blockType === 'question',
                      order_index: questions?.length || 0 + index,
                      section_id: null
                    };
                  });
                  setQuestions([...questions, ...newQuestions]);
                  setShowBulkImporter(false);
                  showToast(`${newQuestions.length} questions imported`, 'success');
                }}
              />
            </div>
          )}
        </div>
      </main>
      
      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium transition-all hover:bg-gray-200 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <button
            onClick={saveSurvey}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl font-medium transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : (isEditing ? 'Update Survey' : 'Create Survey')}
          </button>
        </div>
      </div>
    </div>
  );
}
