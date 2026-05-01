import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { apiGet, apiPost, apiPut } from '../../lib/api';
import { QuestionType, Survey } from '../../types';
import { ArrowLeft, Plus, Trash2, X, Save, FileText, AlertCircle, HelpCircle, Globe } from 'lucide-react';
import BulkQuestionImporter from '../../components/BulkQuestionImporter';

interface SurveyTemplate {
  id: string;
  title: string;
  description: string;
  questions: Omit<FormQuestion, 'id'>[];
}

interface FormQuestion {
  id: string;
  type: QuestionType;
  question_text: string;
  options: string[];
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
      { type: 'text', question_text: 'What did you like most about your experience?', options: [], required: true, order_index: 0 },
      { type: 'choice', question_text: 'How satisfied are you with our service?', options: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied', 'Very dissatisfied'], required: true, order_index: 1 },
      { type: 'text', question_text: 'What can we improve?', options: [], required: false, order_index: 2 }
    ]
  },
  {
    id: 'template-nps',
    title: 'Net Promoter Score',
    description: 'Measure customer loyalty and likelihood to recommend your company.',
    questions: [
      { type: 'likert', question_text: 'How likely are you to recommend us to a friend?', options: ['1', '2', '3', '4', '5'], required: true, order_index: 0 },
      { type: 'text', question_text: 'Tell us why you chose that score.', options: [], required: false, order_index: 1 }
    ]
  },
  {
    id: 'template-event',
    title: 'Event Check-In',
    description: 'Gather attendee impressions and improvement ideas after your event.',
    questions: [
      { type: 'choice', question_text: 'How did you hear about the event?', options: ['Email', 'Social media', 'Friend', 'Website', 'Other'], required: true, order_index: 0 },
      { type: 'likert', question_text: 'How would you rate the event overall?', options: ['1', '2', '3', '4', '5'], required: true, order_index: 1 },
      { type: 'text', question_text: 'Any comments for our team?', options: [], required: false, order_index: 2 }
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
    setQuestions(data.questions || []);
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
      show_when_question_id: undefined,
      show_when_answer_value: undefined
    })));
  };

  const addQuestion = (type: QuestionType, options: string[] = []) => {
    const newQuestion: FormQuestion = {
      id: generateId(),
      type,
      question_text: '',
      options: options.length > 0 ? options : type === 'choice' ? ['Option 1', 'Option 2'] : type === 'likert' ? ['1', '2', '3', '4', '5'] : [],
      required: true,
      order_index: questions?.length || 0
    };
    setQuestions([...questions, newQuestion]);
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

          {/* Appearance */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-gray-900">Appearance & Branding</h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
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
              </div>
              <div className="space-y-4">
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
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-6 bg-green-500 rounded-full"></div>
              <h2 className="text-lg font-semibold text-gray-900">Settings & Scheduling</h2>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="label flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-500" />
                    Supported Languages
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(['English', 'Spanish', 'French', 'German', 'Chinese'] as const).map((lang) => {
                      const langMap: Record<string, string> = { 'English': 'en', 'Spanish': 'es', 'French': 'fr', 'German': 'de', 'Chinese': 'zh' };
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
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label">Open Date</label>
                  <input
                    type="datetime-local"
                    value={openDate}
                    onChange={(e) => setOpenDate(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Close Date</label>
                  <input
                    type="datetime-local"
                    value={closeDate}
                    onChange={(e) => setCloseDate(e.target.value)}
                    className="input"
                  />
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
                    {template.id === 'customer-feedback' && (
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-lg">💬</span>
                      </div>
                    )}
                    {template.id === 'nps' && (
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <span className="text-lg">⭐</span>
                      </div>
                    )}
                    {template.id === 'event-checkin' && (
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
                          type: q.type,
                          question_text: q.question_text,
                          options: q.options || [],
                          required: q.required,
                          order_index: questions?.length || 0 + index,
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
          </div>
          
          {/* Questions List */}
          <div className="space-y-4">

          {questions.map((question, index) => (
            <div key={question.id} className="card">
              <div className="flex items-start gap-4">
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveQuestion(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ArrowLeft className="w-4 h-4 -rotate-90" />
                  </button>
                  <span className="text-xs font-medium text-gray-500 text-center">{index + 1}</span>
                  <button
                    onClick={() => moveQuestion(index, 'down')}
                    disabled={index === questions.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ArrowLeft className="w-4 h-4 rotate-90" />
                  </button>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
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
                  </div>

                  <input
                    type="text"
                    value={question.question_text}
                    onChange={(e) => updateQuestion(question.id, { question_text: e.target.value })}
                    className="input min-w-0"
                    placeholder="Enter your question"
                  />

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
                </div>

                <button
                  onClick={() => deleteQuestion(question.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
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
                    const options = type === 'choice'
                      ? q.options.length > 0 ? q.options : ['Option 1', 'Option 2']
                      : type === 'likert'
                        ? ['1', '2', '3', '4', '5']
                        : [];

                    return {
                      id: generateId(),
                      type,
                      question_text: q.text,
                      options,
                      required: true,
                      order_index: questions?.length || 0 + index
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
