import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { supabase } from '../../lib/supabase';
import { getAnonymousUserId } from '../../lib/fingerprint';
import { Survey, Question } from '../../types';
import { Send, CheckCircle, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';

interface Answer {
  question_id: string;
  answer: string;
}

export default function SurveyResponse() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const { showToast } = useToast();
  
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [email, setEmail] = useState('');
  const [submissionPreview, setSubmissionPreview] = useState<{ email?: string; answers: { questionText: string; answer: string }[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [fingerprint, setFingerprint] = useState<string>('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Initialize anonymous user ID on mount
  useEffect(() => {
    initializeUser();
  }, []);

  // Check localStorage for previous submission (Frontend Layer 1)
  useEffect(() => {
    if (!surveyId) return;
    
    const storageKey = `survey-completed-${surveyId}`;
    const hasCompleted = localStorage.getItem(storageKey);
    
    if (hasCompleted === 'true') {
      setIsBlocked(true);
      setBlockReason('You have already completed this survey on this device.');
    }
  }, [surveyId]);

  // Track presence (active users) when taking survey
  useEffect(() => {
    if (!surveyId || !userId || hasSubmitted) return;

    const presenceChannel = supabase.channel('survey-presence');
    
    presenceChannel
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: userId,
            survey_id: surveyId,
            online_at: new Date().toISOString()
          });
        }
      });

    // Heartbeat every 30 seconds to keep presence alive
    const heartbeat = setInterval(async () => {
      await presenceChannel.track({
        user_id: userId,
        survey_id: surveyId,
        online_at: new Date().toISOString()
      });
    }, 30000);

    return () => {
      clearInterval(heartbeat);
      presenceChannel.unsubscribe();
    };
  }, [surveyId, userId, hasSubmitted]);

  useEffect(() => {
    if (surveyId && userId) {
      loadSurvey();
      checkPreviousSubmission();
    }
  }, [surveyId, userId]);

  const initializeUser = async () => {
    const anonId = await getAnonymousUserId();
    setUserId(anonId);
    setFingerprint(anonId);
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
    if (!surveyId || !userId) return;

    // Layer 2: Check database via RPC function
    const { data: hasCompleted, error: rpcError } = await supabase
      .rpc('has_user_completed_survey', {
        p_survey_id: surveyId!,
        p_user_id: userId
      });

    if (rpcError) {
      console.error('Error checking completion status:', rpcError);
      // Fallback: check responses table directly
      const { data } = await supabase
        .from('responses')
        .select('id')
        .eq('survey_id', surveyId)
        .eq('user_id', userId)
        .limit(1);

      if (data && data.length > 0) {
        setIsBlocked(true);
        setBlockReason('You have already completed this survey.');
        localStorage.setItem(`survey-completed-${surveyId}`, 'true');
      }
      return;
    }

    if (hasCompleted) {
      setIsBlocked(true);
      setBlockReason('You have already completed this survey.');
      localStorage.setItem(`survey-completed-${surveyId}`, 'true');
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

  const handleSubmit = async () => {
    if (!userId) {
      showToast('Unable to identify user', 'error');
      return;
    }

    // Validate required fields for current and previous questions
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
      user_id: userId,
      question_id: a.question_id,
      answer: a.answer,
      submitted_at: now
    }));

    if (email.trim() && !/^[\w.%+-]+@gmail\.com$/i.test(email.trim())) {
      showToast('Please enter a valid Gmail address or leave the email blank.', 'error');
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from('responses')
      .insert(responsesToInsert);

    if (error) {
      showToast('Failed to submit response', 'error');
      console.error(error);
    } else {
      // Layer 3: Record completion in survey_sessions table
      const { error: completionError } = await supabase
        .rpc('record_survey_completion', {
          p_survey_id: surveyId!,
          p_user_id: userId,
          p_email: email.trim() || null,
          p_fingerprint: fingerprint,
          p_ip_address: typeof window !== 'undefined' ? window.location.hostname : undefined,
          p_user_agent: navigator.userAgent
        });

      if (completionError) {
        console.error('Error recording completion:', completionError);
        // Still mark as submitted since responses were saved
      }

      // Response count is automatically updated by database trigger
      // No need to manually call increment_survey_response_count

      // Layer 1: Save to localStorage to block future attempts
      localStorage.setItem(`survey-completed-${surveyId}`, 'true');
      
      setSubmissionPreview({
        email: email.trim() || undefined,
        answers: questions.map((q) => ({
          questionText: q.question_text,
          answer: getAnswer(q.id)
        }))
      });

      showToast('Response submitted successfully!', 'success');
      setHasSubmitted(true);
    }

    setIsSubmitting(false);
  };

  const goToNext = () => {
    const currentQ = questions[currentQuestionIndex];
    if (currentQ?.required && !getAnswer(currentQ.id)) {
      showToast('Please answer this question', 'error');
      return;
    }
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const goToPrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Layer 1 & 2: Block if already submitted
  if (isBlocked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Survey Completed</h2>
          <p className="text-gray-600 mb-2">{blockReason}</p>
          <p className="text-sm text-gray-500">Each device may only submit one response.</p>
        </div>
      </div>
    );
  }

  if (hasSubmitted && submissionPreview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-2xl w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h2>
          <p className="text-gray-600 mb-4">Your response has been recorded.</p>
          {submissionPreview.email && (
            <p className="text-sm text-slate-500 mb-4">
              A preview summary has been generated for <strong>{submissionPreview.email}</strong>.
            </p>
          )}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">Your Response Preview</h3>
            <div className="space-y-3">
              {submissionPreview.answers.map((item, index) => (
                <div key={index} className="rounded-lg bg-white border border-gray-200 p-3 text-left">
                  <p className="text-sm text-slate-500 mb-1">{item.questionText}</p>
                  <p className="text-sm text-slate-800 font-medium">{item.answer || 'No answer provided'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Survey Not Available</h2>
          <p className="text-gray-600 mb-6">This survey may be closed or does not exist.</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header with Progress */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between h-auto sm:h-14 min-w-0">
            <span className="text-sm font-medium text-gray-500 break-words">
              {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span className="text-sm font-medium text-slate-900 break-words text-center sm:text-left max-w-full">
              {survey.title}
            </span>
            <span className="text-sm font-medium text-gray-500 break-words">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-slate-900 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {/* Main Content - One Question at a Time */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {currentQuestion && (
            <div className="card space-y-6">
              {currentQuestionIndex === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Gmail (optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:outline-none"
                    placeholder="Enter your Gmail to receive a preview summary"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    This field is optional. Leave blank to proceed anonymously.
                  </p>
                </div>
              )}
              {/* Question */}
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-900 leading-relaxed break-words">
                  {currentQuestion.question_text}
                  {currentQuestion.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </h2>
              </div>

              {/* Answer Input */}
              <div className="space-y-3">
                {currentQuestion.type === 'text' && (
                  <textarea
                    value={getAnswer(currentQuestion.id)}
                    onChange={(e) => updateAnswer(currentQuestion.id, e.target.value)}
                    className="w-full p-4 border border-gray-200 rounded-lg text-slate-900 min-h-[120px] focus:outline-none focus:border-slate-400 resize-none"
                    placeholder="Type your answer here..."
                    autoFocus
                  />
                )}

                {currentQuestion.type === 'choice' && currentQuestion.options && (
                  <div className="space-y-2">
                    {currentQuestion.options.map((option) => (
                      <button
                        key={option}
                        onClick={() => updateAnswer(currentQuestion.id, option)}
                        className={`w-full p-4 text-left border rounded-lg transition-all ${
                          getAnswer(currentQuestion.id) === option
                            ? 'border-slate-900 bg-slate-50 text-slate-900'
                            : 'border-gray-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 min-w-0">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            getAnswer(currentQuestion.id) === option
                              ? 'border-slate-900'
                              : 'border-gray-300'
                          }`}>
                            {getAnswer(currentQuestion.id) === option && (
                              <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />
                            )}
                          </div>
                          <span className="font-medium break-words">{option}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {currentQuestion.type === 'likert' && (
                  <div className="flex justify-between gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        onClick={() => updateAnswer(currentQuestion.id, value.toString())}
                        className={`flex-1 py-4 px-2 border rounded-lg transition-all ${
                          getAnswer(currentQuestion.id) === value.toString()
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-gray-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <span className="text-xl font-bold">{value}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center">
                {currentQuestionIndex > 0 && (
                  <button
                    onClick={goToPrevious}
                    className="flex items-center gap-2 px-4 py-3 border border-gray-200 text-slate-700 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    Back
                  </button>
                )}
                
                {isLastQuestion ? (
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || (currentQuestion.required && !getAnswer(currentQuestion.id))}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Submit
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={goToNext}
                    disabled={currentQuestion.required && !getAnswer(currentQuestion.id)}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="max-w-lg mx-auto px-4 text-center">
          <p className="text-xs text-slate-500">
            Secured with browser fingerprinting
          </p>
        </div>
      </footer>
    </div>
  );
}
