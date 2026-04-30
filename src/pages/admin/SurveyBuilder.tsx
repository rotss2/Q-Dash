import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { apiGet, apiPost, apiPut } from '../../lib/api';
import { QuestionType, Survey } from '../../types';
import { ArrowLeft, Plus, Trash2, X, Save, FileText } from 'lucide-react';
import BulkQuestionImporter from '../../components/BulkQuestionImporter';

interface FormQuestion {
  id: string;
  type: QuestionType;
  question_text: string;
  options: string[];
  required: boolean;
  order_index: number;
}

export default function SurveyBuilder() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { surveyId } = useParams<{ surveyId?: string }>();
  const isEditing = !!surveyId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
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

    const { data, error } = await apiGet<{ survey: Survey; questions: FormQuestion[] }>(`/api/admin/surveys/${id}`);

    if (error || !data?.survey) {
      showToast(error || 'Failed to load survey', 'error');
      navigate('/admin');
      return;
    }

    setTitle(data.survey.title);
    setDescription(data.survey.description || '');
    setQuestions(data.questions || []);
    setIsLoading(false);
  };

  const generateId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const addQuestion = (type: QuestionType) => {
    const newQuestion: FormQuestion = {
      id: generateId(),
      type,
      question_text: '',
      options: type === 'choice' ? ['Option 1', 'Option 2'] : type === 'likert' ? ['1', '2', '3', '4', '5'] : [],
      required: true,
      order_index: questions.length
    };
    setQuestions([...questions, newQuestion]);
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

    if (questions.length === 0) {
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
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Survey Details</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Survey Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
                placeholder="Enter survey title"
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input min-h-[100px]"
                placeholder="Enter survey description"
              />
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 justify-between items-start md:flex-row md:items-center">
            <h2 className="text-lg font-semibold text-gray-900">Questions ({questions.length})</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowBulkImporter(true)}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <FileText className="w-4 h-4" />
                Bulk Import
              </button>
              <button
                onClick={() => addQuestion('text')}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Text
              </button>
              <button
                onClick={() => addQuestion('choice')}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Choice
              </button>
              <button
                onClick={() => addQuestion('likert')}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Likert
              </button>
            </div>
          </div>

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
                      {question.type === 'text' ? 'Text' : question.type === 'choice' ? 'Multiple Choice' : 'Likert Scale'}
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

          {questions.length === 0 && !showBulkImporter && (
            <div className="card text-center py-12">
              <p className="text-gray-500 mb-4">No questions yet. Add your first question above.</p>
              <div className="flex justify-center gap-2">
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
                    let type: QuestionType = 'text';
                    if (q.type === 'choice') type = 'choice';
                    else if (q.type === 'rating' || q.type === 'boolean') type = 'likert';
                    
                    return {
                      id: generateId(),
                      type,
                      question_text: q.text,
                      options: type === 'choice' ? q.options : type === 'likert' ? ['1', '2', '3', '4', '5'] : [],
                      required: true,
                      order_index: questions.length + index
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
