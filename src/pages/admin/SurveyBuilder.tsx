import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { apiGet, apiPost, apiPut } from '../../lib/api';
import { QuestionType, Survey } from '../../types';
import { ArrowLeft, Plus, Trash2, X, Save, FileText, AlertCircle, HelpCircle, Globe, Calendar, GripVertical, Type, Info, Star, ToggleRight } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showBulkImporter, setShowBulkImporter] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
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

  const addQuestion = (type: QuestionType, options: string[] = [], blockType: FormQuestion['block_type'] = 'question') => {
    const newQuestion: FormQuestion = {
      id: generateId(),
      block_type: blockType,
      type,
      question_text: '',
      options: options.length > 0 ? options : type === 'choice' ? ['Option 1', 'Option 2'] : type === 'likert' ? ['1', '2', '3', '4', '5'] : [],
      required: blockType === 'question',
      order_index: questions?.length || 0
    };
    setQuestions([...questions, newQuestion]);
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
    const newQuestion: FormQuestion = {
      id: generateId(),
      block_type: 'heading',
      type: 'text',
      question_text: 'PART X: SECTION TITLE',
      options: [],
      required: false,
      order_index: questions?.length || 0
    };
    setQuestions([...questions, newQuestion]);
    showToast('Section header added! Edit the text to your section title.', 'success');
  };

  // Add a legend/instruction
  const addLegend = () => {
    const newQuestion: FormQuestion = {
      id: generateId(),
      block_type: 'instruction',
      type: 'text',
      question_text: 'Instructions: 1 = Strongly Disagree, 2 = Disagree, 3 = Neutral, 4 = Agree, 5 = Strongly Agree',
      options: [],
      required: false,
      order_index: questions?.length || 0
    };
    setQuestions([...questions, newQuestion]);
    showToast('Legend added! Edit the text to customize instructions.', 'success');
  };

  // Add a 1-5 rating scale question
  const addRatingScale = () => {
    const newQuestion: FormQuestion = {
      id: generateId(),
      block_type: 'question',
      type: 'likert',
      question_text: 'Enter your rating scale question here',
      options: ['1', '2', '3', '4', '5'],
      required: true,
      order_index: questions?.length || 0
    };
    setQuestions([...questions, newQuestion]);
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
  const addBooleanQuestion = () => {
    addQuestion('choice', ['Yes', 'No']);
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

  // Helper: Check if a question belongs to a group (connected to a heading)
  const getGroupInfo = (index: number) => {
    const currentQ = questions[index];
    
    // If this is a heading, it's the group start
    if (currentQ?.block_type === 'heading') {
      return { isGrouped: true, groupStartIndex: index, isGroupStart: true };
    }
    
    // Look backward for a heading
    let backwardHeading = -1;
    for (let i = index - 1; i >= 0; i--) {
      if (questions[i].block_type === 'page_break') break;
      if (questions[i].block_type === 'heading') {
        backwardHeading = i;
        break;
      }
    }
    
    // Look forward for a heading
    let forwardHeading = -1;
    for (let i = index + 1; i < questions.length; i++) {
      if (questions[i].block_type === 'page_break') break;
      if (questions[i].block_type === 'heading') {
        forwardHeading = i;
        break;
      }
    }
    
    // Determine group membership
    // If there's a heading nearby (before or after), we're in a group
    const hasNearbyHeading = backwardHeading !== -1 || forwardHeading !== -1;
    const groupStart = backwardHeading !== -1 ? backwardHeading : forwardHeading;
    
    return {
      isGrouped: hasNearbyHeading && groupStart !== -1,
      groupStartIndex: groupStart,
      isGroupStart: false,
      hasHeadingBefore: backwardHeading !== -1,
      hasHeadingAfter: forwardHeading !== -1
    };
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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between h-auto md:h-16">
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </button>
            <button
              onClick={saveSurvey}
              disabled={isSaving}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : (isEditing ? 'Update Survey' : 'Create Survey')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Survey Details */}
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Survey Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input text-lg"
                  placeholder="Enter a clear, descriptive title for your survey"
                />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="Provide context and explain the purpose of this survey"
                />
              </div>
            </div>
          </div>

          {/* Appearance & Settings - Two Column Layout on Desktop */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Appearance */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                <h2 className="text-lg font-semibold text-gray-900">Appearance & Branding</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label">Brand Color</label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      value={themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                      className="h-12 w-20 rounded-lg border border-gray-200 p-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                      className="flex-1 input font-mono text-sm"
                      placeholder="#111827"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Logo URL</label>
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    className="input"
                    placeholder="https://yoursite.com/logo.png"
                  />
                  {logoUrl && (
                    <div className="mt-3 flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
                      <img src={logoUrl} alt="Logo preview" className="h-10 w-10 rounded-md object-contain" />
                      <span className="text-sm text-gray-600">Logo preview</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="label">Theme Style</label>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="input"
                  >
                    <option value="default">Default (Modern)</option>
                    <option value="warm">Warm (Orange/Peach)</option>
                    <option value="cool">Cool (Purple/Indigo)</option>
                    <option value="forest">Forest (Green/Earth)</option>
                    <option value="dark">Dark Mode</option>
                  </select>
                </div>
                <div>
                  <label className="label">Background Theme</label>
                  <select
                    value={backgroundTheme}
                    onChange={(e) => setBackgroundTheme(e.target.value)}
                    className="input"
                  >
                    <option value="default">Default (Plain)</option>
                    <option value="ocean">🌊 Ocean (Waves)</option>
                    <option value="sunset">🌅 Sunset (Warm)</option>
                    <option value="forest">🌲 Forest (Nature)</option>
                    <option value="galaxy">🌌 Galaxy (Cosmic)</option>
                    <option value="minimal">✨ Minimal (Clean)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Font Family</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="input"
                  >
                    <option value="default">Default (System)</option>
                    <option value="serif">Serif (Times New Roman)</option>
                    <option value="sans">Sans-serif (Clean)</option>
                    <option value="mono">Monospace (Code)</option>
                    <option value="rounded">Rounded (Friendly)</option>
                    <option value="elegant">Elegant (Playfair)</option>
                  </select>
                </div>
                <div>
                  <label className="label flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-500" />
                    Supported Languages
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
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
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                          }`}
                        >
                          {lang}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500">Click to toggle languages for respondent switching.</p>
                </div>
                <div>
                  <label className="label">Default Language</label>
                  <select
                    value={defaultLanguage}
                    onChange={(e) => setDefaultLanguage(e.target.value)}
                    className="input"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="zh">Chinese</option>
                    <option value="fil">Filipino</option>
                  </select>
                </div>
                <div>
                  <label className="label flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    Open Date
                  </label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={openDate}
                      onChange={(e) => setOpenDate(e.target.value)}
                      className="input w-full pr-10"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">When the survey becomes available to respondents.</p>
                </div>
                <div>
                  <label className="label flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    Close Date
                  </label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      value={closeDate}
                      onChange={(e) => setCloseDate(e.target.value)}
                      className="input w-full pr-10"
                    />
                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">When the survey stops accepting responses.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Templates */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-orange-500 rounded-full"></div>
            <h2 className="text-lg font-semibold text-gray-900">Start from a template</h2>
            <span className="text-sm text-gray-500 ml-2">Save time with pre-built survey structures</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {SURVEY_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template.id)}
                className="group relative rounded-xl border border-gray-200 bg-white p-5 text-left transition-all duration-200 hover:border-blue-300 hover:shadow-lg hover:-translate-y-1"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {template.id === 'template-feedback' && (
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-lg">💬</span>
                      </div>
                    )}
                    {template.id === 'template-nps' && (
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <span className="text-lg">⭐</span>
                      </div>
                    )}
                    {template.id === 'template-event' && (
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <span className="text-lg">📅</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                      {template.title}
                    </h4>
                    <p className="text-xs text-gray-500 leading-relaxed">{template.description}</p>
                  </div>
                </div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowLeft className="w-4 h-4 text-blue-600 rotate-180" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Questions */}
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-6 bg-indigo-500 rounded-full"></div>
            <h2 className="text-lg font-semibold text-gray-900">Questions ({questions?.length || 0})</h2>
            <span className="text-sm text-gray-500 ml-2">Add and organize your survey questions</span>
          </div>
          
          {/* Editor Tools - Section Headers & Legends */}
          <div className="mb-6 p-4 bg-indigo-50 rounded-xl border border-indigo-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 bg-indigo-600 rounded"></div>
              <span className="text-sm font-bold text-indigo-900 uppercase tracking-wide">Quick Add Tools</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <button
                onClick={addSectionHeader}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors text-sm"
                title="Add a section title like 'PART A: EASE OF USE'"
              >
                <Type className="w-4 h-4 text-indigo-600" />
                <span className="font-medium text-indigo-900">Section Header</span>
              </button>
              <button
                onClick={addLegend}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors text-sm"
                title="Add instructions like '1 = Strongly Disagree...'"
              >
                <Info className="w-4 h-4 text-purple-600" />
                <span className="font-medium text-indigo-900">Legend/Notes</span>
              </button>
              <button
                onClick={addRatingScale}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors text-sm"
                title="Add a 1-5 rating scale question"
              >
                <Star className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-indigo-900">Rating Scale</span>
              </button>
              <button
                onClick={toggleAllRequired}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors text-sm"
                title="Toggle all questions between required and optional"
              >
                <ToggleRight className="w-4 h-4 text-green-600" />
                <span className="font-medium text-indigo-900">Toggle All Required</span>
              </button>
              <button
                onClick={toggleConnectMode}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-sm ${connectMode ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-white border-pink-200 hover:bg-pink-50 hover:border-pink-300'}`}
                title="Click to connect questions and blocks together"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className="font-medium">{connectMode ? 'Exit Connect' : 'Connect Mode'}</span>
                {connectMode && <span className="ml-1 text-xs">({connections.length} links)</span>}
              </button>
              {connections.length > 0 && (
                <button
                  onClick={clearAllConnections}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors text-sm"
                  title="Remove all connections"
                >
                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="font-medium text-red-600">Clear Links</span>
                </button>
              )}
            </div>
            <p className="text-xs text-indigo-600 mt-2">
              💡 <strong>How to use:</strong> Click buttons above to quickly add formatted elements. Drag questions by the handle (⋮⋮) to reorder. Edit text fields to customize.
            </p>
          </div>

          {/* Add Question Section */}
          <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Add Question</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <button
                onClick={() => setShowBulkImporter(true)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors text-sm"
              >
                <FileText className="w-4 h-4 text-gray-600" />
                <span>Bulk Import</span>
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
                  className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-colors text-sm w-full"
                >
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-700">Emergency</span>
                  <HelpCircle className="w-3 h-3 text-red-400 ml-auto" />
                </button>
                {/* Tooltip */}
                <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <p className="font-semibold mb-1">Emergency Question Bank</p>
                  <p>Instantly adds pre-built critical safety questions for emergency response scenarios.</p>
                  <div className="absolute bottom-0 left-6 translate-y-1/2 rotate-45 w-2 h-2 bg-slate-800"></div>
                </div>
              </div>
              <button
                onClick={() => addQuestion('text')}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors text-sm"
              >
                <div className="w-4 h-4 bg-blue-100 rounded flex items-center justify-center text-xs">T</div>
                <span>Text</span>
              </button>
              <button
                onClick={() => addQuestion('choice')}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors text-sm"
              >
                <div className="w-4 h-4 bg-green-100 rounded flex items-center justify-center text-xs">✓</div>
                <span>Multiple Choice</span>
              </button>
              <button
                onClick={addBooleanQuestion}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors text-sm"
              >
                <div className="w-4 h-4 bg-purple-100 rounded flex items-center justify-center text-xs">?</div>
                <span>Yes/No</span>
              </button>
              <button
                onClick={() => addQuestion('likert')}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors text-sm"
              >
                <div className="w-4 h-4 bg-orange-100 rounded flex items-center justify-center text-xs">1-5</div>
                <span>Scaling</span>
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-600">Structure Blocks</span>
              </div>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                <button
                  onClick={() => addQuestion('text', [], 'heading')}
                  className="flex items-center justify-center sm:justify-start gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 hover:border-indigo-300 transition-colors text-sm"
                >
                  <div className="w-4 h-4 bg-indigo-100 rounded flex items-center justify-center text-xs flex-shrink-0">H</div>
                  <span className="text-indigo-700">Heading</span>
                </button>
                <button
                  onClick={() => addQuestion('text', [], 'instruction')}
                  className="flex items-center justify-center sm:justify-start gap-2 px-3 py-2 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 hover:border-cyan-300 transition-colors text-sm"
                >
                  <div className="w-4 h-4 bg-cyan-100 rounded flex items-center justify-center text-xs flex-shrink-0">i</div>
                  <span className="text-cyan-700">Instruction</span>
                </button>
                <button
                  onClick={addLegend}
                  className="flex items-center justify-center sm:justify-start gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 hover:border-purple-300 transition-colors text-sm"
                >
                  <div className="w-4 h-4 bg-purple-100 rounded flex items-center justify-center text-xs flex-shrink-0">★</div>
                  <span className="text-purple-700">Legend/Notes</span>
                </button>
                <button
                  onClick={() => addQuestion('text', [], 'page_break')}
                  className="flex items-center justify-center sm:justify-start gap-2 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 hover:border-gray-400 transition-colors text-sm"
                >
                  <div className="w-4 h-4 bg-gray-200 rounded flex items-center justify-center text-xs flex-shrink-0">↵</div>
                  <span className="text-gray-700">Page Break</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Questions List with Visual Flow */}
          <div className="relative space-y-0">
            {/* Visual connector line - runs through all questions */}
            <div className="absolute left-[22px] sm:left-[26px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-indigo-300 via-purple-300 to-indigo-300 rounded-full hidden sm:block"></div>
            
            {/* Connection nodes for each question */}
          {/* Connection lines layer - renders all manual connections */}
          <svg className="absolute inset-0 w-full h-full z-20" style={{minHeight: '100%'}}>
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
                <g key={conn.id} className="group cursor-pointer" onClick={() => removeConnection(conn.id)}>
                  <path
                    d={`M ${fromX} ${fromY} Q ${fromX + 100} ${(fromY + toY) / 2} ${toX} ${toY}`}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="3"
                    markerEnd="url(#arrowhead)"
                    strokeDasharray="5,5"
                    className="hover:stroke-red-500 transition-colors"
                  />
                  {/* Invisible wider path for easier clicking */}
                  <path
                    d={`M ${fromX} ${fromY} Q ${fromX + 100} ${(fromY + toY) / 2} ${toX} ${toY}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="15"
                    className="cursor-pointer"
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
              className={`relative transition-all ${dragOverIndex === index ? 'ring-2 ring-indigo-500 bg-indigo-50' : ''} ${connectMode ? 'cursor-pointer' : ''} ${isSource ? 'ring-4 ring-orange-400 bg-orange-50' : ''} ${isConnected && !isSource ? 'ring-2 ring-orange-200' : ''}`}
              draggable={!connectMode}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onClick={() => handleItemClickForConnect(question.id)}
            >
              {/* Connection node - visual dot on the timeline */}
              <div className="absolute left-[18px] sm:left-[22px] top-8 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white shadow-sm hidden sm:block z-10"></div>
              
              {/* Section grouping indicator - shows when this is start of a new section */}
              {question.block_type === 'heading' && index > 0 && (
                <div className="absolute left-0 right-0 -top-3 flex items-center justify-center">
                  <div className="bg-indigo-100 text-indigo-600 text-[10px] px-2 py-0.5 rounded-full border border-indigo-200 font-medium">
                    New Section
                  </div>
                </div>
              )}
              
              {/* Page break connector */}
              {question.block_type === 'page_break' && (
                <div className="absolute left-0 right-0 top-0 flex items-center justify-center -mt-2">
                  <div className="bg-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded-full border border-gray-300 font-medium flex items-center gap-1">
                    <span>↵</span> Page Break
                  </div>
                </div>
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
              
              <div className={`card relative ml-0 sm:ml-2 ${groupInfo.isGrouped ? 'border-indigo-200' : ''} ${groupInfo.isGroupStart ? 'ring-2 ring-indigo-400 shadow-md bg-white' : groupInfo.isGrouped ? 'bg-white/80' : ''}`}>
              {/* Insert toolbar - appears on hover */}
              <div className="flex items-center gap-1 mb-1 opacity-0 hover:opacity-100 transition-opacity -mt-2">
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

                <div className="flex-1 space-y-4">
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
                  
                  {/* Block Type Badge */}
                  <div className="flex flex-wrap items-center gap-3">
                    {question.block_type === 'heading' && (
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">
                        Heading
                      </span>
                    )}
                    {question.block_type === 'instruction' && (
                      <span className="px-2 py-1 bg-cyan-100 text-cyan-700 text-xs font-medium rounded">
                        Instruction
                      </span>
                    )}
                    {question.block_type === 'page_break' && (
                      <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-medium rounded">
                        Page Break
                      </span>
                    )}
                    {question.block_type === 'question' && (
                      <>
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded break-words">
                          {question.type === 'text'
                        ? 'Text'
                        : question.type === 'choice'
                          ? (question.options.length === 2 && question.options.includes('Yes') && question.options.includes('No') ? 'Boolean' : 'Multiple Choice')
                          : 'Scaling'}
                        </span>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={question.required}
                            onChange={(e) => updateQuestion(question.id, { required: e.target.checked })}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          Required
                        </label>
                      </>
                    )}
                  </div>

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
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                          <label className="label">Show this question only if</label>
                          <select
                            value={question.show_when_question_id || ''}
                            onChange={(e) => updateQuestion(question.id, { show_when_question_id: e.target.value || undefined })}
                            className="input"
                          >
                            <option value="">No condition</option>
                            {questions.slice(0, index).map((prevQ) => (
                              <option key={prevQ.id} value={prevQ.id}>{prevQ.question_text || `Question ${prevQ.order_index + 1}`}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Answer must equal</label>
                          <input
                            type="text"
                            value={question.show_when_answer_value || ''}
                            onChange={(e) => updateQuestion(question.id, { show_when_answer_value: e.target.value || undefined })}
                            className="input"
                            placeholder="Expected answer value"
                          />
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
                  onClick={() => deleteQuestion(question.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
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
            <div className="card text-center py-12">
              <p className="text-gray-500 mb-4">No questions yet. Add your first question above.</p>
              <div className="flex justify-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowBulkImporter(true)}
                  className="btn-secondary"
                >
                  <FileText className="w-4 h-4 inline mr-2" />
                  Bulk Import Questions
                </button>
                <button
                  onClick={() => addQuestion('text')}
                  className="btn-secondary"
                >
                  Add Text Question
                </button>
                <button
                  onClick={addBooleanQuestion}
                  className="btn-secondary"
                >
                  Add Boolean Question
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
    </div>
  );
}
