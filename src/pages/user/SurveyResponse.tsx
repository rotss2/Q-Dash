import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { supabase } from '../../lib/supabase';
import { Survey, Question } from '../../types';
import { ArrowLeft, Send, CheckCircle, AlertCircle, LogIn } from 'lucide-react';

interface Answer {
  question_id: string;
  answer: string;
}

export default function SurveyResponse() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (surveyId && user) {
      loadSurvey();
      checkPreviousSubmission();
    }
  }, [surveyId, user]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
    }
    setIsLoading(false);
  };

  const loadSurvey = async () => {
    if (!surveyId) return;

    const { data: surveyData, error: surveyError } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', surveyId)
      .eq('status', 'open')
      .single();

    if (surveyError || !surveyData) {
      showToast('Survey not found or is closed', 'error');
      return;
    }

    setSurvey(surveyData);

    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('survey_id', surveyId)
      .order('order_index', { ascending: true });

    if (questionsError) {
      showToast('Failed to load questions', 'error');
    } else {
      setQuestions(questionsData || []);
    }
  };

  const checkPreviousSubmission = async () => {
    if (!surveyId || !user) return;

    const { data } = await supabase
      .from('responses')
      .select('id')
      .eq('survey_id', surveyId)
      .eq('user_id', user.id)
      .limit(1);

    if (data && data.length > 0) {
      setHasSubmitted(true);
    }
  };

  const updateAnswer = (questionId: string, value: string) => {
    setAnswers(prev => {
      const existing = prev.find(a => a.question_id === questionId);
      if (existing) {
        return prev.map(a => a.question_id === questionId ? { ...a, answer: value } : a);
      }
      return [...prev, { question_id: questionId, answer: value }];
    });
  };

  const getAnswer = (questionId: string): string => {
    return answers.find(a => a.question_id === questionId)?.answer || '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      showToast('Please sign in to submit your response', 'error');
      navigate('/login', { state: { from: `/survey/${surveyId}` } });
      return;
    }

    // Validate required fields
    const missingRequired = questions
      .filter(q => q.required)
      .filter(q => !getAnswer(q.id));

    if (missingRequired.length > 0) {
      showToast(`Please answer all required questions`, 'error');
      return;
    }

    setIsSubmitting(true);

    const now = new Date().toISOString();
    const responsesToInsert = answers.map(a => ({
      survey_id: surveyId!,
      user_id: user.id,
      question_id: a.question_id,
      answer: a.answer,
      submitted_at: now
    }));

    const { error } = await supabase
      .from('responses')
      .insert(responsesToInsert);

    if (error) {
      showToast('Failed to submit response', 'error');
      console.error(error);
    } else {
      showToast('Response submitted successfully!', 'success');
      setHasSubmitted(true);
    }

    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Sign In Required</h2>
          <p className="text-gray-600 mb-6">Please sign in or create an account to complete this survey</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/login', { state: { from: `/survey/${surveyId}` } })}
              className="btn-primary"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/register')}
              className="btn-secondary"
            >
              Register
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (hasSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-600 mb-6">You have already submitted your response to this survey.</p>
          <button
            onClick={() => navigate(user ? '/user' : '/login')}
            className="btn-primary"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Survey Not Available</h2>
          <p className="text-gray-600 mb-6">This survey may be closed or does not exist.</p>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={() => navigate(user ? '/user' : '/login')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{survey.title}</h1>
          <p className="text-gray-600">{survey.description || 'Please answer the following questions:'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {questions.map((question, index) => (
            <div key={question.id} className="card">
              <div className="mb-4">
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <label className="text-base font-medium text-gray-900">
                      {question.question_text}
                      {question.required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              <div className="ml-10">
                {question.type === 'text' && (
                  <textarea
                    value={getAnswer(question.id)}
                    onChange={(e) => updateAnswer(question.id, e.target.value)}
                    className="input min-h-[100px]"
                    placeholder="Enter your answer..."
                    required={question.required}
                  />
                )}

                {question.type === 'choice' && question.options && (
                  <div className="space-y-2">
                    {question.options.map((option, optIndex) => (
                      <label
                        key={optIndex}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option}
                          checked={getAnswer(question.id) === option}
                          onChange={(e) => updateAnswer(question.id, e.target.value)}
                          className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                          required={question.required && !getAnswer(question.id)}
                        />
                        <span className="text-gray-700">{option}</span>
                      </label>
                    ))}
                  </div>
                )}

                {question.type === 'likert' && (
                  <div className="flex gap-4 flex-wrap">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <label
                        key={value}
                        className="flex flex-col items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={value.toString()}
                          checked={getAnswer(question.id) === value.toString()}
                          onChange={(e) => updateAnswer(question.id, e.target.value)}
                          className="w-5 h-5 text-primary-600 border-gray-300 focus:ring-primary-500"
                          required={question.required && !getAnswer(question.id)}
                        />
                        <span className="text-sm text-gray-600">{value}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="card">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Response
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
