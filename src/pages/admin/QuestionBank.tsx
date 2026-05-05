import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toaster';
import { useAuth } from '../../hooks/useAuth';
import { SkeletonCard } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { parseBulkImportText, convertToQuestionBankItem } from '../../lib/questionBankParser';
import { 
  Library, 
  Search, 
  Plus, 
  Upload, 
  Trash2, 
  Edit2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import type { QuestionBankItem, BulkImportQuestion, BankQuestionType, DifficultyLevel } from '../../types/questionBank';

const QUESTION_TYPES: { value: BankQuestionType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True/False' },
  { value: 'identification', label: 'Identification' },
];

const DIFFICULTIES: { value: DifficultyLevel | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: 'bg-gray-100' },
  { value: 'easy', label: 'Easy', color: 'bg-green-100 text-green-700' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-100 text-amber-700' },
  { value: 'hard', label: 'Hard', color: 'bg-red-100 text-red-700' },
];

export default function QuestionBank() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<BankQuestionType | 'all'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyLevel | 'all'>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [topics, setTopics] = useState<string[]>([]);
  const [showImportModal, setShowImportModal] = useState(searchParams.get('import') === 'true');
  const [importText, setImportText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<BulkImportQuestion[]>([]);
  const [importStep, setImportStep] = useState<'input' | 'preview' | 'importing'>('input');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionBankItem | null>(null);

  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('question_bank')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Cast question_type from string to BankQuestionType
      const mappedQuestions = (data || []).map(q => ({
        ...q,
        question_type: q.question_type as QuestionBankItem['question_type'],
      })) as QuestionBankItem[];
      setQuestions(mappedQuestions);
      
      // Extract unique topics
      const uniqueTopics = [...new Set((data || []).map(q => q.topic))];
      setTopics(uniqueTopics);
    } catch (error) {
      console.error('Error fetching questions:', error);
      showToast('Failed to load questions', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const filteredQuestions = questions.filter(q => {
    const matchesSearch = searchQuery === '' || 
      q.question_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.topic.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || q.question_type === typeFilter;
    const matchesDifficulty = difficultyFilter === 'all' || q.difficulty === difficultyFilter;
    const matchesTopic = topicFilter === 'all' || q.topic === topicFilter;
    return matchesSearch && matchesType && matchesDifficulty && matchesTopic;
  });

  const handleParseImport = () => {
    const result = parseBulkImportText(importText);
    setParsedQuestions(result.questions);
    setImportStep('preview');
    
    if (result.invalid_count > 0) {
      showToast(`${result.invalid_count} questions have errors`, 'info');
    } else {
      showToast(`${result.valid_count} questions ready to import`, 'success');
    }
  };

  const handleImport = async () => {
    if (!user?.id) {
      showToast('You must be logged in to import questions', 'error');
      return;
    }

    const validQuestions = parsedQuestions.filter(q => q.is_valid);
    if (validQuestions.length === 0) {
      showToast('No valid questions to import', 'error');
      return;
    }

    setImportStep('importing');
    
    try {
      const questionsToInsert = validQuestions.map(q => 
        convertToQuestionBankItem(q, user.id)
      );

      const { error } = await supabase
        .from('question_bank')
        .insert(questionsToInsert as unknown as Record<string, unknown>[]);

      if (error) throw error;

      showToast(`Successfully imported ${validQuestions.length} questions`, 'success');
      setShowImportModal(false);
      setImportText('');
      setParsedQuestions([]);
      setImportStep('input');
      fetchQuestions();
    } catch (error) {
      console.error('Import error:', error);
      showToast('Failed to import questions', 'error');
      setImportStep('preview');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      const { error } = await supabase
        .from('question_bank')
        .delete()
        .eq('id', id);

      if (error) throw error;
      showToast('Question deleted', 'success');
      fetchQuestions();
    } catch (error) {
      console.error('Delete error:', error);
      showToast('Failed to delete question', 'error');
    }
  };

  const formatQuestionType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Library className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Question Bank</h1>
                <p className="text-xs text-gray-500">{questions.length} questions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-all"
              >
                <Upload className="w-4 h-4" />
                Bulk Import
              </button>
              <button
                onClick={() => { setEditingQuestion(null); setShowAddModal(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Question
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 w-full bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <div className="flex flex-wrap gap-3">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as BankQuestionType | 'all')}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {QUESTION_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value as DifficultyLevel | 'all')}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {DIFFICULTIES.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              
              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Topics</option>
                {topics.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              
              <button
                onClick={fetchQuestions}
                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Questions List */}
        {loading ? (
          <div className="space-y-4">
            <SkeletonCard count={5} />
          </div>
        ) : filteredQuestions.length === 0 ? (
          <EmptyState
            type="search"
            title="No questions found"
            description={searchQuery ? "Try adjusting your search or filters" : "Add your first question to get started"}
          />
        ) : (
          <div className="grid gap-4">
            {filteredQuestions.map((question) => (
              <div
                key={question.id}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        DIFFICULTIES.find(d => d.value === question.difficulty)?.color || 'bg-gray-100'
                      }`}>
                        {question.difficulty}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                        {formatQuestionType(question.question_type)}
                      </span>
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">
                        {question.topic}
                      </span>
                      <span className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
                        {question.points} pts
                      </span>
                    </div>
                    
                    <h3 className="font-medium text-gray-900 mb-3">{question.question_text}</h3>
                    
                    {question.options && question.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                        {question.options.map((opt) => (
                          <div
                            key={opt.id}
                            className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                              opt.is_correct 
                                ? 'bg-green-50 border border-green-200 text-green-800' 
                                : 'bg-gray-50 text-gray-700'
                            }`}
                          >
                            {opt.is_correct && <CheckCircle className="w-4 h-4 text-green-600" />}
                            <span>{opt.option_text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {question.correct_answer && question.question_type === 'identification' && (
                      <p className="text-sm text-green-700 bg-green-50 p-2 rounded-lg">
                        Answer: {question.correct_answer}
                      </p>
                    )}
                    
                    {question.explanation && (
                      <p className="text-sm text-gray-500 mt-2">
                        <span className="font-medium">Explanation:</span> {question.explanation}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex lg:flex-col items-center gap-2">
                    <button
                      onClick={() => { setEditingQuestion(question); setShowAddModal(true); }}
                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(question.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {importStep === 'input' ? 'Bulk Import Questions' : importStep === 'preview' ? 'Preview Questions' : 'Importing...'}
              </h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportStep('input');
                  setImportText('');
                  setParsedQuestions([]);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {importStep === 'input' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h3 className="font-medium text-blue-900 mb-2">Format Guide:</h3>
                    <pre className="text-sm text-blue-800 bg-blue-100/50 p-3 rounded-lg overflow-x-auto">
{`Question: What is DTFT?
A. Discrete-Time Fourier Transform
B. Digital Time Frequency Table
C. Direct Transfer Function Theory
D. Dynamic Transform Formula
Answer: A
Topic: DTFT
Difficulty: Easy
Explanation: DTFT means Discrete-Time Fourier Transform.
Points: 1`}
                    </pre>
                  </div>
                  
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Paste your questions here..."
                    className="w-full h-96 p-4 border border-gray-300 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
              )}

              {importStep === 'preview' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600 font-medium">
                      {parsedQuestions.filter(q => q.is_valid).length} valid
                    </span>
                    <span className="text-red-600 font-medium">
                      {parsedQuestions.filter(q => !q.is_valid).length} invalid
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {parsedQuestions.map((q, i) => (
                      <div
                        key={i}
                        className={`p-4 rounded-xl border ${
                          q.is_valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {q.is_valid ? (
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{q.question_text}</p>
                            {q.errors.length > 0 && (
                              <ul className="mt-2 text-sm text-red-600">
                                {q.errors.map((err, j) => (
                                  <li key={j}>• {err}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importStep === 'importing' && (
                <div className="flex flex-col items-center justify-center py-12">
                  <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                  <p className="text-lg font-medium text-gray-900">Importing questions...</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              {importStep === 'input' && (
                <>
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleParseImport}
                    disabled={!importText.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Preview
                  </button>
                </>
              )}
              
              {importStep === 'preview' && (
                <>
                  <button
                    onClick={() => setImportStep('input')}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={parsedQuestions.filter(q => q.is_valid).length === 0}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Import {parsedQuestions.filter(q => q.is_valid).length} Questions
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
