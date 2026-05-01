import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { supabase } from '../../lib/supabase';
import { getAnonymousUserId } from '../../lib/fingerprint';
import { Survey, Question } from '../../types';
import { LanguageProvider, useLanguage } from '../../hooks/useLanguage';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { Send, CheckCircle, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { ThemedBackground } from '../../components/ThemedBackground';
import { AvatarMascot } from '../../components/AvatarMascot';

interface Answer {
  question_id: string;
  answer: string;
}

// Inner component that uses localization
function SurveyContent() {
  const { t } = useLanguage();
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
  const [showWelcome, setShowWelcome] = useState(true);

  const answersMap = useMemo(
    () => Object.fromEntries(answers.map((answer) => [answer.question_id, answer.answer])),
    [answers]
  );

  // Font classes based on survey.font_family
  const fontClass = useMemo(() => {
    const font = survey?.font_family || 'default';
    switch (font) {
      case 'serif':
        return 'font-serif';
      case 'sans':
        return 'font-sans';
      case 'mono':
        return 'font-mono';
      case 'rounded':
        return 'font-rounded';
      case 'elegant':
        return 'font-elegant';
      default:
        return '';
    }
  }, [survey?.font_family]);

  // Theme styles based on survey.theme
  const themeClasses = useMemo(() => {
    const theme = survey?.theme || 'default';
    switch (theme) {
      case 'warm':
        return {
          bg: 'bg-orange-50',
          card: 'bg-white border-orange-200',
          button: 'bg-orange-600 hover:bg-orange-700',
          accent: 'text-orange-600',
          progress: 'bg-orange-200',
          progressFill: 'bg-orange-500'
        };
      case 'cool':
        return {
          bg: 'bg-indigo-50',
          card: 'bg-white border-indigo-200',
          button: 'bg-indigo-600 hover:bg-indigo-700',
          accent: 'text-indigo-600',
          progress: 'bg-indigo-200',
          progressFill: 'bg-indigo-500'
        };
      case 'forest':
        return {
          bg: 'bg-green-50',
          card: 'bg-white border-green-200',
          button: 'bg-green-600 hover:bg-green-700',
          accent: 'text-green-600',
          progress: 'bg-green-200',
          progressFill: 'bg-green-500'
        };
      case 'dark':
        return {
          bg: 'bg-gray-900',
          card: 'bg-gray-800 border-gray-700',
          button: 'bg-slate-600 hover:bg-slate-500',
          accent: 'text-slate-400',
          progress: 'bg-gray-700',
          progressFill: 'bg-slate-400'
        };
      default:
        return {
          bg: 'bg-gray-50',
          card: 'bg-white border-gray-200',
          button: 'bg-slate-900 hover:bg-slate-800',
          accent: 'text-slate-900',
          progress: 'bg-gray-200',
          progressFill: 'bg-slate-900'
        };
    }
  }, [survey?.theme]);

  const shouldShowQuestion = (question: Question, answerValues: Record<string, string>) => {
    if (!question.show_when_question_id) return true;
    return answerValues[question.show_when_question_id] === question.show_when_answer_value;
  };

  const visibleQuestions = useMemo(
    () => questions.filter((question) => shouldShowQuestion(question, answersMap)),
    [questions, answersMap]
  );

  useEffect(() => {
    if (currentQuestionIndex >= visibleQuestions.length) {
      setCurrentQuestionIndex(Math.max(0, visibleQuestions.length - 1));
    }
  }, [currentQuestionIndex, visibleQuestions.length]);

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
    // Don't set isLoading false here - let loadSurvey handle it
  };

  const loadSurvey = async () => {
    if (!surveyId) return;
    
    setIsLoading(true); // Ensure loading state during fetch

    const { data: surveyData, error: surveyError } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError || !surveyData) {
      showToast(t('errorLoadingSurvey'), 'error');
      setSurvey(null);
      setIsLoading(false);
      return;
    }

    const now = new Date();
    if (surveyData.status !== 'open') {
      setSurvey(surveyData);
      setIsBlocked(true);
      setBlockReason(t('surveyClosed'));
      setIsLoading(false);
      return;
    }

    if (surveyData.open_date && new Date(surveyData.open_date) > now) {
      setSurvey(surveyData);
      setIsBlocked(true);
      setBlockReason(`${t('surveyNotOpen')} ${new Date(surveyData.open_date).toLocaleString()}.`);
      setIsLoading(false);
      return;
    }

    if (surveyData.close_date && new Date(surveyData.close_date) < now) {
      setSurvey(surveyData);
      setIsBlocked(true);
      setBlockReason(`${t('surveyExpired')} ${new Date(surveyData.close_date).toLocaleString()}.`);
      setIsLoading(false);
      return;
    }

    setSurvey(surveyData);

    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('survey_id', surveyId)
      .order('order_index', { ascending: true });

    if (questionsError) {
      showToast(t('errorLoadingSurvey'), 'error');
    } else {
      setQuestions(questionsData || []);
    }
    setIsLoading(false);
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
        setBlockReason(t('responseRecorded'));
        localStorage.setItem(`survey-completed-${surveyId}`, 'true');
      }
      return;
    }

    if (hasCompleted) {
      setIsBlocked(true);
      setBlockReason(t('responseRecorded'));
      localStorage.setItem(`survey-completed-${surveyId}`, 'true');
    }
  };

  const updateAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => {
      const existing = prev.find((a) => a.question_id === questionId);
      const updated = existing
        ? prev.map((a) => (a.question_id === questionId ? { ...a, answer: value } : a))
        : [...prev, { question_id: questionId, answer: value }];

      const updatedMap = Object.fromEntries(updated.map((answer) => [answer.question_id, answer.answer]));
      const visibleQuestionIds = new Set(
        questions.filter((question) => shouldShowQuestion(question, updatedMap)).map((question) => question.id)
      );

      return updated.filter((answer) => visibleQuestionIds.has(answer.question_id));
    });
  };

  const getAnswer = (questionId: string): string => {
    return answers.find((a) => a.question_id === questionId)?.answer || '';
  };

  const handleSubmit = async () => {
    console.log('Submit attempt - userId:', userId, 'survey:', survey?.title, 'status:', survey?.status);
    
    if (!userId) {
      console.error('Cannot submit: userId is null');
      showToast(t('error'), 'error');
      return;
    }

    if (!survey) {
      console.error('Cannot submit: survey is null');
      showToast(t('errorLoadingSurvey'), 'error');
      return;
    }

    if (survey.status !== 'open') {
      console.error('Cannot submit: survey is not open, status:', survey.status);
      showToast('This survey is closed and not accepting responses', 'error');
      return;
    }

    // Validate required fields for visible questions only
    const missingRequired = visibleQuestions
      .filter((q) => q.required)
      .filter((q) => !getAnswer(q.id));

    if (missingRequired.length > 0) {
      showToast(t('errorRequiredField'), 'error');
      return;
    }

    setIsSubmitting(true);

    const now = new Date().toISOString();
    const visibleQuestionIds = new Set(visibleQuestions.map((q) => q.id));
    const responsesToInsert = answers
      .filter((a) => visibleQuestionIds.has(a.question_id))
      .map((a) => ({
        survey_id: surveyId!,
        user_id: userId,
        question_id: a.question_id,
        answer: a.answer,
        submitted_at: now
      }));

    if (email.trim() && !/^[\w.%+-]+@gmail\.com$/i.test(email.trim())) {
      showToast(t('errorInvalidEmail'), 'error');
      setIsSubmitting(false);
      return;
    }

    console.log('Submitting responses:', responsesToInsert);
    
    const { error, data: insertedData } = await supabase
      .from('responses')
      .insert(responsesToInsert)
      .select();

    if (error) {
      console.error('Response insert error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      showToast(`${t('errorSubmitting')}: ${error.message}`, 'error');
    } else {
      console.log('Responses inserted successfully:', insertedData);
      console.log('Response insert details:', {
        message: 'Success',
        code: '200',
        details: 'Responses inserted successfully',
        hint: 'No issues found'
      });
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
        answers: visibleQuestions.map((q) => ({
          questionText: q.question_text,
          answer: getAnswer(q.id)
        }))
      });

      showToast(t('success'), 'success');
      setHasSubmitted(true);
    }

    setIsSubmitting(false);
  };

  const goToNext = () => {
    const currentQ = visibleQuestions[currentQuestionIndex];
    if (currentQ?.required && !getAnswer(currentQ.id)) {
      showToast(t('errorRequiredField'), 'error');
      return;
    }
    if (currentQuestionIndex < visibleQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
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
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="text-gray-500">{t('loading')}</p>
        </div>
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
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('thankYou')}</h2>
          <p className="text-gray-600 mb-2">{blockReason}</p>
          <p className="text-sm text-gray-500">Each device may only submit one response.</p>
        </div>
      </div>
    );
  }

  if (hasSubmitted && submissionPreview) {
    return (
      <div className={`min-h-screen ${themeClasses.bg} flex flex-col ${fontClass} relative`}>
        {/* Animated Background Theme */}
        <ThemedBackground theme={survey?.background_theme || 'default'} />
        
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="card max-w-2xl w-full text-center space-y-6">
            {/* Success Animation */}
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
              <div className="absolute inset-0 w-24 h-24 bg-green-400 rounded-full mx-auto animate-ping opacity-20"></div>
            </div>
            
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                🎉 {t('thankYou')}! 🎉
              </h1>
              <p className="text-lg text-gray-600 mb-2">
                Your response has been successfully submitted
              </p>
              <p className="text-sm text-gray-500">
                We appreciate your time and valuable feedback
              </p>
            </div>

            {/* Success Stats */}
            <div className="grid grid-cols-3 gap-4 py-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{submissionPreview.answers.length}</div>
                <div className="text-xs text-gray-500">Questions Answered</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">100%</div>
                <div className="text-xs text-gray-500">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">✓</div>
                <div className="text-xs text-gray-500">Success</div>
              </div>
            </div>

            {submissionPreview.email && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-lg">📧</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-blue-900">
                      Preview summary sent to {submissionPreview.email}
                    </p>
                    <p className="text-xs text-blue-700">
                      Check your inbox for a copy of your responses
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Response Preview */}
            <div className="bg-gray-50 rounded-xl p-6 text-left">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>📋</span>
                Your Response Summary
              </h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {submissionPreview.answers.map((item, index) => (
                  <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-semibold text-blue-600 flex-shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-500 mb-1">{item.questionText}</p>
                        <p className="text-sm text-gray-900 font-medium break-words">{item.answer || 'No answer provided'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-6 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-all"
              >
                <span>🖨️</span>
                Print Summary
              </button>
              <button
                onClick={() => navigator.share && navigator.share({
                  title: `Completed: ${survey?.title}`,
                  text: `I just completed the survey "${survey?.title}"!`,
                })}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-all"
              >
                <span>📤</span>
                Share Results
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 py-4">
          <div className="max-w-lg mx-auto px-4 text-center flex flex-col items-center gap-2">
            <LanguageSwitcher variant="minimal" />
            <p className="text-xs text-gray-500">
              Secured with browser fingerprinting
            </p>
          </div>
        </footer>
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
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('surveyClosed')}</h2>
          <p className="text-gray-600 mb-6">{t('errorLoadingSurvey')}</p>
        </div>
      </div>
    );
  }

  if (visibleQuestions.length === 0) {
    return (
      <div className={`min-h-screen ${themeClasses.bg} flex items-center justify-center p-4`}>
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className={`text-lg font-semibold ${themeClasses.accent}`}>{survey?.title}</h1>
          <p className="text-gray-600 mb-6">{t('errorLoadingSurvey')}</p>
        </div>
      </div>
    );
  }

  const currentQuestion = visibleQuestions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === visibleQuestions.length - 1;
  const progress = visibleQuestions.length > 0 ? ((currentQuestionIndex + 1) / visibleQuestions.length) * 100 : 0;

  return (
    <div className={`min-h-screen ${themeClasses.bg} flex flex-col ${fontClass} relative`}>
      {/* Animated Background Theme */}
      <ThemedBackground theme={survey?.background_theme || 'default'} />
      
      {/* Header with Progress */}
      <header className={`${themeClasses.card} border-b sticky top-0 z-10 shadow-sm`}>
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold ${themeClasses.button}`}>
                {showWelcome ? '👋' : (currentQuestionIndex + 1)}
              </div>
              <div>
                <span className="text-sm font-medium text-gray-500 block">
                  {showWelcome ? 'Welcome' : `Question ${currentQuestionIndex + 1} of ${visibleQuestions.length}`}
                </span>
                <span className="text-xs text-gray-400">
                  {Math.round(progress)}% complete
                </span>
              </div>
            </div>
            <span className="text-sm font-medium text-slate-900 break-words text-center sm:text-left max-w-full truncate">
              {survey.title}
            </span>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-sm font-medium text-gray-500 block">
                  {visibleQuestions.length - currentQuestionIndex - 1} left
                </span>
                <span className="text-xs text-gray-400">
                  ~{Math.ceil((visibleQuestions.length - currentQuestionIndex - 1) * 0.5)} min
                </span>
              </div>
            </div>
          </div>
          <div className={`mt-3 h-3 ${themeClasses.progress} rounded-full overflow-hidden`}>
            <div 
              className={`h-full ${themeClasses.progressFill} transition-all duration-500 ease-out relative`}
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-0 w-3 h-3 bg-white rounded-full shadow-md animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Welcome Screen or Questions */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {showWelcome ? (
            // Welcome Screen
            <div className="card space-y-6 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📋</span>
              </div>
              
              <div>
                <h1 className={`text-2xl font-bold ${themeClasses.accent} mb-3`}>
                  Welcome to {survey?.title}
                </h1>
                {survey?.description && (
                  <p className="text-gray-600 leading-relaxed mb-6">
                    {survey.description}
                  </p>
                )}
              </div>

              <div className="bg-gray-50 rounded-xl p-4 text-left">
                <h3 className="font-semibold text-gray-900 mb-3">What to expect:</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>This survey takes approximately {Math.ceil(visibleQuestions.length * 0.5)} minutes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>There are {visibleQuestions.length} question{visibleQuestions.length !== 1 ? 's' : ''} to complete</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Your responses are completely confidential</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>You can navigate back to review previous answers</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Gmail ({t('optional').toLowerCase()})
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-slate-900 focus:border-slate-400 focus:outline-none"
                  placeholder="Enter your Gmail to receive a preview summary"
                />
                <p className="mt-2 text-xs text-slate-500">
                  {t('optional')}. Leave blank to proceed anonymously.
                </p>
              </div>

              <button
                onClick={() => setShowWelcome(false)}
                className={`w-full flex items-center justify-center gap-2 ${themeClasses.button} text-white py-4 rounded-xl font-medium text-lg transition-all hover:scale-[1.02]`}
              >
                Get Started
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          ) : (
            // Questions
            currentQuestion && (
              <div className="card space-y-6">
              {/* Question */}
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold ${themeClasses.button}`}>
                    {currentQuestionIndex + 1}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-slate-900 leading-relaxed break-words">
                      {currentQuestion.question_text}
                      {currentQuestion.required && (
                        <span className="text-red-500 ml-2" title={t('required')}>*</span>
                      )}
                    </h2>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        currentQuestion.type === 'text' ? 'bg-blue-100 text-blue-700' :
                        currentQuestion.type === 'choice' ? 'bg-green-100 text-green-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {currentQuestion.type === 'text' ? 'Text Response' :
                         currentQuestion.type === 'choice' ? 'Multiple Choice' :
                         'Rating Scale'}
                      </span>
                      {currentQuestion.required && (
                        <span className="text-xs text-gray-500">Required</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Answer Input */}
              <div className="space-y-4">
                {currentQuestion.type === 'text' && (
                  <div className="relative">
                    <textarea
                      value={getAnswer(currentQuestion.id)}
                      onChange={(e) => updateAnswer(currentQuestion.id, e.target.value)}
                      className="w-full p-4 border-2 border-gray-200 rounded-xl text-slate-900 min-h-[140px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none transition-all"
                      placeholder={t('textPlaceholder')}
                      autoFocus
                    />
                    {getAnswer(currentQuestion.id) && (
                      <div className="absolute top-3 right-3">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                    )}
                  </div>
                )}

                {currentQuestion.type === 'choice' && currentQuestion.options && (
                  <div className="space-y-3" role="radiogroup" aria-label={currentQuestion.question_text}>
                    {currentQuestion.options.map((option, index) => {
                      const isSelected = getAnswer(currentQuestion.id) === option;
                      return (
                        <button
                          key={option}
                          onClick={() => updateAnswer(currentQuestion.id, option)}
                          className={`w-full p-4 text-left border-2 rounded-xl transition-all group ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-sm'
                              : 'border-gray-200 hover:border-gray-300 text-slate-700 hover:bg-gray-50'
                          }`}
                          role="radio"
                          aria-checked={isSelected}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-300 group-hover:border-gray-400'
                            }`}>
                              {isSelected && (
                                <div className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </div>
                            <div className="flex-1">
                              <span className="font-medium break-words">{option}</span>
                              {isSelected && (
                                <span className="ml-2 text-xs text-blue-600 font-medium">Selected</span>
                              )}
                            </div>
                            {isSelected && (
                              <CheckCircle className="w-5 h-5 text-blue-500" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {currentQuestion.type === 'likert' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-2 text-xs text-gray-500">
                      <span>Strongly Disagree</span>
                      <span>Strongly Agree</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      {[1, 2, 3, 4, 5].map((value) => {
                        const isSelected = getAnswer(currentQuestion.id) === value.toString();
                        return (
                          <button
                            key={value}
                            onClick={() => updateAnswer(currentQuestion.id, value.toString())}
                            className={`flex-1 py-4 px-2 border-2 rounded-xl transition-all relative group ${
                              isSelected
                                ? `border-transparent ${themeClasses.button} text-white shadow-lg transform scale-105`
                                : 'border-gray-200 hover:border-gray-300 text-slate-700 hover:bg-gray-50'
                            }`}
                          >
                            <span className="text-xl font-bold">{value}</span>
                            {isSelected && (
                              <div className="absolute -top-2 -right-2">
                                <CheckCircle className="w-5 h-5 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
                {currentQuestionIndex > 0 && (
                  <button
                    onClick={goToPrevious}
                    className="flex items-center gap-2 px-6 py-3 border-2 border-gray-200 text-slate-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 font-medium transition-all hover:scale-[1.02]"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    {t('back')}
                  </button>
                )}
                
                {isLastQuestion ? (
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || (currentQuestion.required && !getAnswer(currentQuestion.id))}
                    className={`flex-1 flex items-center justify-center gap-3 ${themeClasses.button} text-white py-4 rounded-xl font-medium text-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg`}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t('loading')}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-6 h-6" />
                        {t('submit')}
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={goToNext}
                    disabled={currentQuestion.required && !getAnswer(currentQuestion.id)}
                    className={`flex-1 flex items-center justify-center gap-3 ${themeClasses.button} text-white py-4 rounded-xl font-medium text-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg`}
                  >
                    {t('next')}
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="max-w-lg mx-auto px-4 text-center flex flex-col items-center gap-2">
          <LanguageSwitcher variant="minimal" />
          <p className="text-xs text-slate-500">
            Secured with browser fingerprinting
          </p>
        </div>
      </footer>
      
      {/* Avatar Mascot */}
      <AvatarMascot 
        progress={progress} 
        currentQuestion={currentQuestionIndex + 1} 
        totalQuestions={visibleQuestions.length} 
      />
    </div>
  );
}

// Main exported component wrapped with LanguageProvider
export default function SurveyResponse() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [defaultLanguage, setDefaultLanguage] = useState<string>('en');
  const [supportedLanguages, setSupportedLanguages] = useState<string[] | undefined>(undefined);

  // Load survey to get supported languages
  useEffect(() => {
    if (!surveyId) return;
    
    const loadSurveyLanguages = async () => {
      const { data } = await supabase
        .from('surveys')
        .select('default_language, supported_languages')
        .eq('id', surveyId)
        .single();
      
      if (data) {
        setDefaultLanguage(data.default_language || 'en');
        setSupportedLanguages(data.supported_languages || undefined);
      }
    };
    
    loadSurveyLanguages();
  }, [surveyId]);

  return (
    <LanguageProvider 
      defaultLocale={defaultLanguage as any} 
      surveySupportedLanguages={supportedLanguages}
    >
      <SurveyContent />
    </LanguageProvider>
  );
}
