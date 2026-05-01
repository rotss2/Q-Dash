import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { supabase } from '../../lib/supabase';
import { getAnonymousUserId } from '../../lib/fingerprint';
import { Survey, Question } from '../../types';
import { LanguageProvider, useLanguage } from '../../hooks/useLanguage';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Download, Printer } from 'lucide-react';
import { ThemedBackground } from '../../components/ThemedBackground';
import html2pdf from 'html2pdf.js';

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
  const [emailError, setEmailError] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [age, setAge] = useState('');
  const [profileError, setProfileError] = useState('');
  const [submissionPreview, setSubmissionPreview] = useState<{ email?: string; answers: { questionText: string; answer: string }[] } | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [fingerprint, setFingerprint] = useState<string>('');
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);

  const QUESTIONS_PER_SECTION = 6;

  // Define your section titles here - add or remove as needed
  const SECTION_TITLES: string[] = [
    'Ease of Use',      // Part A
    'Speed & Efficiency', // Part B
    'Accuracy',         // Part C
    'Security',         // Part D
    // Add more sections here:
    // 'Cost Effectiveness', // Part E
    // 'User Satisfaction',  // Part F
  ];

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

  const questionSections = useMemo(() => {
    const sections: Question[][] = [];
    let currentSection: Question[] = [];

    visibleQuestions.forEach((question) => {
      if (currentSection.length >= QUESTIONS_PER_SECTION) {
        sections.push(currentSection);
        currentSection = [];
      }
      currentSection.push(question);
    });

    if (currentSection.length > 0) {
      sections.push(currentSection);
    }

    return sections;
  }, [visibleQuestions]);

  useEffect(() => {
    if (currentSectionIndex >= questionSections.length) {
      setCurrentSectionIndex(Math.max(0, questionSections.length - 1));
    }
  }, [currentSectionIndex, questionSections.length]);

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
      .eq('is_active', true)
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
      // Layer 3: Record completion in survey_sessions table with profiling data
      console.log('Recording survey completion:', { surveyId, userId, email: email.trim() || null, gender, age });
      const { error: completionError, data: completionData } = await supabase
        .rpc('record_survey_completion', {
          p_survey_id: surveyId!,
          p_user_id: userId,
          p_email: email.trim() || null,
          p_gender: gender || null,
          p_age: age ? parseInt(age, 10) : null,
          p_fingerprint: fingerprint,
          p_ip_address: typeof window !== 'undefined' ? window.location.hostname : undefined,
          p_user_agent: navigator.userAgent
        });

      if (completionError) {
        console.error('Error recording completion:', completionError);
      } else {
        console.log('Survey completion recorded:', completionData);
      }

      // Response count is automatically updated by database trigger
      // No need to manually call increment_survey_response_count

      // Layer 1: Save to localStorage to block future attempts
      localStorage.setItem(`survey-completed-${surveyId}`, 'true');
      
      // Deduplicate questions by question_text to handle legacy data
      const seenQuestions = new Set<string>();
      const uniqueQuestions = visibleQuestions.filter((q) => {
        const normalized = q.question_text.trim().toLowerCase();
        if (seenQuestions.has(normalized)) {
          return false;
        }
        seenQuestions.add(normalized);
        return true;
      });

      setSubmissionPreview({
        email: email.trim() || undefined,
        answers: uniqueQuestions.map((q) => ({
          questionText: q.question_text,
          answer: getAnswer(q.id)
        }))
      });

      showToast(t('success'), 'success');
      setHasSubmitted(true);
    }

    setIsSubmitting(false);
  };

  const downloadPDF = async () => {
    if (!summaryRef.current || !survey) return;

    const element = summaryRef.current;
    const opt = {
      margin: 10,
      filename: `${survey.title}-response-summary.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    try {
      await html2pdf().set(opt).from(element).save();
      showToast('PDF downloaded successfully!', 'success');
    } catch (error) {
      console.error('PDF generation failed:', error);
      showToast('Failed to generate PDF. Please try printing instead.', 'error');
    }
  };

  const validateEmail = (email: string): boolean => {
    if (!email) return true; // Email is optional
    // Gmail validation - must be @gmail.com
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    return gmailRegex.test(email);
  };

  const handleGetStarted = () => {
    // Validate profiling information
    if (!gender) {
      setProfileError('Please select your gender');
      return;
    }
    if (!age || isNaN(Number(age)) || Number(age) < 1 || Number(age) > 120) {
      setProfileError('Please enter a valid age (1-120)');
      return;
    }
    
    // Validate email if provided
    if (email && !validateEmail(email)) {
      setEmailError('Please enter a valid Gmail address (e.g., user@gmail.com)');
      return;
    }
    
    setProfileError('');
    setEmailError('');
    setShowWelcome(false);
  };

  const goToNext = () => {
    const currentSection = questionSections[currentSectionIndex] || [];
    const missingRequired = currentSection.filter((q) => q.required && !getAnswer(q.id));
    if (missingRequired.length > 0) {
      showToast(t('errorRequiredField'), 'error');
      return;
    }
    if (currentSectionIndex < questionSections.length - 1) {
      setCurrentSectionIndex((prev) => prev + 1);
    }
  };

  const goToPrevious = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex((prev) => prev - 1);
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
      <div className={`min-h-screen flex flex-col ${themeClasses.bg} touch-manipulation select-none`} style={{ WebkitUserSelect: 'none', userSelect: 'none' }}>
        {/* Animated Background Theme */}
        <ThemedBackground theme={survey?.background_theme || 'default'} />
        
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="card max-w-2xl w-full text-center space-y-6">
            {/* Success Logo - PROMINENT */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-3xl blur-xl"></div>
                <img 
                  src="/logo.png" 
                  alt="SurveyTest" 
                  className="relative h-28 sm:h-32 md:h-40 w-auto object-contain drop-shadow-2xl"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>

            {/* Success Message - Professional */}
            <div className="space-y-2">
              <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
                {t('thankYou')}
              </h1>
              <p className="text-lg text-gray-600 max-w-md mx-auto">
                Your response has been successfully submitted
              </p>
              <p className="text-sm text-gray-500">
                We appreciate your time and valuable feedback
              </p>
            </div>

            {/* Success Stats - BIGGER & BOLDER */}
            <div className="grid grid-cols-3 gap-6 py-8">
              <div className="text-center bg-green-50 rounded-2xl p-4 border border-green-100">
                <div className="text-3xl sm:text-4xl font-extrabold text-green-600">{submissionPreview.answers.length}</div>
                <div className="text-sm font-medium text-green-700 mt-1">Questions Answered</div>
              </div>
              <div className="text-center bg-blue-50 rounded-2xl p-4 border border-blue-100">
                <div className="text-3xl sm:text-4xl font-extrabold text-blue-600">100%</div>
                <div className="text-sm font-medium text-blue-700 mt-1">Completed</div>
              </div>
              <div className="text-center bg-purple-50 rounded-2xl p-4 border border-purple-100">
                <div className="text-3xl sm:text-4xl font-extrabold text-purple-600">✓</div>
                <div className="text-sm font-medium text-purple-700 mt-1">Success</div>
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

            {/* Response Preview - PDF/Print Version */}
            <div ref={summaryRef} className="bg-white rounded-2xl p-8 text-left border border-gray-200 print:shadow-none print:border-0">
              {/* PDF Header with Logo - BIG & Centered */}
              <div className="border-b-2 border-gray-100 pb-6 mb-6 print:pb-4">
                <div className="flex flex-col items-center text-center gap-4 mb-6">
                  <img 
                    src="/logo.png" 
                    alt="SurveyTest" 
                    className="h-20 sm:h-24 w-auto object-contain print:h-16 drop-shadow-md"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="space-y-1">
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{survey?.title}</h2>
                    <p className="text-base text-gray-500 font-medium">Response Summary</p>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500 mt-4 bg-gray-50 rounded-xl p-3">
                  <span className="font-medium">
                    <span className="text-gray-400">Submitted:</span> {new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {submissionPreview.email && (
                    <span className="text-blue-600 font-medium">
                      <span className="text-gray-400">Email:</span> {submissionPreview.email}
                    </span>
                  )}
                  <span className="font-medium text-gray-400">
                    User ID: {userId.slice(0, 12)}...
                  </span>
                </div>
              </div>

              {/* All Answers - BIGGER & More Professional */}
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-500" />
                Your Responses ({submissionPreview.answers.length} {submissionPreview.answers.length === 1 ? 'question' : 'questions'})
              </h3>
              <div className="space-y-5">
                {submissionPreview.answers.map((item, index) => (
                  <div key={index} className="bg-gray-50 rounded-xl border-2 border-gray-200 p-5 break-inside-avoid hover:border-blue-300 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-base font-bold text-blue-600 flex-shrink-0 shadow-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0 space-y-3">
                        <p className="text-base font-semibold text-gray-800 leading-relaxed">{item.questionText}</p>
                        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                          <p className="text-lg text-gray-900 font-medium break-words">
                            {item.answer || <span className="text-gray-400 italic">No answer provided</span>}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* PDF Footer */}
              <div className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-400 print:mt-8">
                <p>Generated by Q-Dash Survey Platform</p>
                <p className="text-xs mt-1">q-dash.onrender.com</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={downloadPDF}
                className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 font-medium transition-all shadow-lg shadow-slate-200"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-6 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-all"
              >
                <Printer className="w-5 h-5" />
                Print
              </button>
              {navigator.share && (
                <button
                  onClick={() => navigator.share({
                    title: `Completed: ${survey?.title}`,
                    text: `I just completed the survey "${survey?.title}"!`,
                  })}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-all"
                >
                  <span>📤</span>
                  Share
                </button>
              )}
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

  const currentSection = questionSections[currentSectionIndex] || [];
  const isLastSection = currentSectionIndex === questionSections.length - 1;
  const answeredCount = visibleQuestions.filter((q) => !!getAnswer(q.id)).length;
  const progress = visibleQuestions.length > 0 ? (answeredCount / visibleQuestions.length) * 100 : 0;

  return (
    <div className={`min-h-screen ${themeClasses.bg} flex flex-col ${fontClass} relative`}>
      {/* Animated Background Theme */}
      <ThemedBackground theme={survey?.background_theme || 'default'} />
      
      {/* Header with Logo & Progress */}
      <header className={`${themeClasses.card} border-b sticky top-0 z-10 shadow-sm`}>
        <div className="max-w-2xl mx-auto px-4 py-4">
          {/* Top Row: Logo + Title */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <img 
              src="/logo.png" 
              alt="SurveyTest" 
              className="h-8 sm:h-10 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
              {survey.title}
            </h1>
          </div>
          
          {/* Progress Info */}
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span className="font-medium">
              {showWelcome ? 'Welcome' : `Part ${String.fromCharCode(65 + currentSectionIndex)}: ${SECTION_TITLES[currentSectionIndex] || `Section ${currentSectionIndex + 1}`} • ${currentSection.length} questions`}
            </span>
            {!showWelcome && (
              <span className="font-semibold text-gray-700">
                {Math.round(progress)}% complete • {answeredCount} of {visibleQuestions.length} answered
              </span>
            )}
          </div>
          
          {/* Progress Bar - no animation for performance */}
          {!showWelcome && (
            <div className={`h-3 ${themeClasses.progress} rounded-full overflow-hidden will-change-transform`}>
              <div 
                className={`h-full ${themeClasses.progressFill} transition-all duration-300 ease-out`}
                style={{ width: `${progress}%`, willChange: 'width' }}
              />
            </div>
          )}
        </div>
      </header>

      {/* Main Content - Welcome Screen or Questions */}
      <main className="flex-1 flex justify-center p-4 items-start">
        <div className="w-full max-w-lg">
          {showWelcome ? (
            // Welcome Screen
            <div className="card space-y-6 text-center">
              {/* Survey Logo - Prominent Header */}
              <div className="flex flex-col items-center gap-3">
                <img 
                  src="/logo.png" 
                  alt="SurveyTest" 
                  className="h-24 sm:h-28 md:h-32 w-auto object-contain mx-auto drop-shadow-xl"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <h2 className="text-2xl font-bold text-gray-900">SurveyTest</h2>
                <p className="text-base text-gray-500">Smart Data Insights</p>
              </div>
              
              <div>
                <h1 className={`text-2xl font-bold ${themeClasses.accent} mb-3`}>
                  {survey?.title}
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

              {/* Profiling Section - Required */}
              <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                  <h3 className="font-semibold text-indigo-900">Profile Information (Required)</h3>
                </div>
                
                {/* Gender Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setGender('male');
                        if (profileError) setProfileError('');
                      }}
                      className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                        gender === 'male'
                          ? 'border-blue-500 bg-blue-100 text-blue-900'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <span className="text-lg">♂</span> Male
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGender('female');
                        if (profileError) setProfileError('');
                      }}
                      className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                        gender === 'female'
                          ? 'border-pink-500 bg-pink-100 text-pink-900'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-pink-300'
                      }`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        <span className="text-lg">♀</span> Female
                      </span>
                    </button>
                  </div>
                </div>

                {/* Age Input */}
                <div className="mb-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={age}
                    onChange={(e) => {
                      setAge(e.target.value);
                      if (profileError) setProfileError('');
                    }}
                    className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-slate-900 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors bg-white"
                    placeholder="Enter your age (e.g., 25)"
                  />
                </div>

                {/* Gmail (Optional) */}
                <div className="mt-4 pt-4 border-t border-indigo-200">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Gmail ({t('optional').toLowerCase()})
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError('');
                    }}
                    className={`w-full rounded-xl border px-4 py-3 text-slate-900 focus:outline-none transition-colors ${
                      emailError ? 'border-red-300 focus:border-red-400 bg-red-50' : 'border-gray-200 focus:border-slate-400 bg-white'
                    }`}
                    placeholder="your.email@gmail.com"
                  />
                  {emailError ? (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      {emailError}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      {t('optional')}. Leave blank to proceed anonymously. Must be a valid @gmail.com address.
                    </p>
                  )}
                </div>

                {/* Profile Error Message */}
                {profileError && (
                  <p className="mt-3 text-sm text-red-600 flex items-center gap-1.5 bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    {profileError}
                  </p>
                )}
              </div>

              <button
                onClick={handleGetStarted}
                className={`w-full flex items-center justify-center gap-2 ${themeClasses.button} text-white py-4 rounded-xl font-medium text-lg transition-all hover:scale-[1.02] touch-manipulation`}
              >
                Get Started
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          ) : (
            currentSection.length > 0 && (
              <div className="card space-y-6">
                {/* Logo Header - PROMINENT Branding */}
                <div className="flex flex-col items-center gap-3 pb-6 border-b-2 border-gray-100">
                  <div className="relative">
                    <img 
                      src="/logo.png" 
                      alt="SurveyTest" 
                      className="h-20 sm:h-24 md:h-28 w-auto object-contain drop-shadow-lg"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-800 tracking-wide">SurveyTest</p>
                    <p className="text-xs text-gray-500">Smart Data Insights</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-gray-200 bg-slate-50 p-6">
                  <div className="flex flex-col gap-4">
                    {/* PART Label */}
                    <div className="flex items-center justify-center">
                      <span className={`px-6 py-2 rounded-full text-white text-sm font-bold uppercase tracking-wider shadow-md ${themeClasses.button}`}>
                        Part {String.fromCharCode(65 + currentSectionIndex)}
                      </span>
                    </div>
                    
                    {/* Section Title */}
                    <div className="text-center">
                      <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                        {SECTION_TITLES[currentSectionIndex] || `Section ${currentSectionIndex + 1}`}
                      </h2>
                      <p className="text-sm text-gray-600 mt-2">
                        Scroll down to answer all {currentSection.length} questions in this section
                      </p>
                    </div>
                    
                    {/* Rating Scale Legend */}
                    <div className="bg-white rounded-2xl border-2 border-gray-200 p-4 mt-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 text-center">
                        Rating Scale Legend
                      </p>
                      <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
                        <div className="flex items-center gap-2 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                          <span className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-bold">1</span>
                          <span className="text-xs text-gray-700 font-medium">Strongly Disagree</span>
                        </div>
                        <div className="flex items-center gap-2 bg-orange-50 px-3 py-2 rounded-lg border border-orange-100">
                          <span className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">2</span>
                          <span className="text-xs text-gray-700 font-medium">Disagree</span>
                        </div>
                        <div className="flex items-center gap-2 bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-100">
                          <span className="w-8 h-8 rounded-full bg-yellow-500 text-white flex items-center justify-center text-sm font-bold">3</span>
                          <span className="text-xs text-gray-700 font-medium">Neutral</span>
                        </div>
                        <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg border border-green-100">
                          <span className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center text-sm font-bold">4</span>
                          <span className="text-xs text-gray-700 font-medium">Agree</span>
                        </div>
                        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                          <span className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">5</span>
                          <span className="text-xs text-gray-700 font-medium">Strongly Agree</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-gray-500 text-center">
                      {currentSection.length} question{currentSection.length !== 1 ? 's' : ''} in this section • {visibleQuestions.length} total questions
                    </div>
                  </div>
                </div>

                <div className="space-y-6 relative">
                  {/* Scroll indicator for first section */}
                  {currentSectionIndex === 0 && currentSection.length > 3 && (
                    <div className="flex justify-center mb-4 animate-bounce">
                      <div className="text-gray-400 text-sm flex items-center gap-2">
                        <span>Scroll down for more questions</span>
                        <ChevronRight className="w-4 h-4 rotate-90" />
                      </div>
                    </div>
                  )}
                  {currentSection.map((question, index) => {
                    const answerValue = getAnswer(question.id);
                    const isText = question.type === 'text';
                    const isChoice = question.type === 'choice' && question.options;
                    const isLikert = question.type === 'likert';

                    return (
                      <div key={question.id} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-start gap-4">
                          <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-md ${themeClasses.button}`}>
                            {currentSectionIndex * QUESTIONS_PER_SECTION + index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                              <h3 className="text-xl font-semibold text-slate-900 break-words">
                                {question.question_text}
                                {question.required && <span className="text-red-500 ml-2">*</span>}
                              </h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                              <span className={`px-2 py-1 rounded-full ${
                                question.type === 'text'
                                  ? question.required
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-purple-100 text-purple-700'
                                  : question.type === 'choice'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}> 
                                {question.type === 'text'
                                  ? question.required
                                    ? 'Text Response'
                                    : 'Section Header'
                                  : question.type === 'choice'
                                    ? 'Multiple Choice'
                                    : 'Rating Scale'}
                              </span>
                              {question.required && <span>Required</span>}
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 space-y-4">
                          {/* Text questions: If required show textarea, if not required show as heading/instruction */}
                          {isText && question.required && (
                            <div className="relative">
                              <textarea
                                value={answerValue}
                                onChange={(e) => updateAnswer(question.id, e.target.value)}
                                className="w-full p-4 border-2 border-gray-200 rounded-xl text-slate-900 min-h-[140px] focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none transition-all"
                                placeholder={t('textPlaceholder')}
                              />
                              {answerValue && (
                                <div className="absolute top-3 right-3">
                                  <CheckCircle className="w-5 h-5 text-green-500" />
                                </div>
                              )}
                            </div>
                          )}
                          {isText && !question.required && (
                            <div className="bg-indigo-50 rounded-xl p-4 border-l-4 border-indigo-500">
                              <p className="text-sm text-indigo-700 font-medium">
                                ℹ️ This is an information section - no answer required
                              </p>
                            </div>
                          )}

                          {isChoice && question.options && (
                            <div className="space-y-4" role="radiogroup" aria-label={question.question_text}>
                              {question.options.map((option) => {
                                const isSelected = answerValue === option;
                                return (
                                  <button
                                    key={option}
                                    onClick={() => updateAnswer(question.id, option)}
                                    className={`w-full p-5 sm:p-6 text-left border-2 rounded-2xl transition-all group ${
                                      isSelected
                                        ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-lg transform scale-[1.02]'
                                        : 'border-gray-200 hover:border-blue-300 text-slate-700 hover:bg-gray-50 hover:shadow-md'
                                    }`}
                                    role="radio"
                                    aria-checked={isSelected}
                                  >
                                    <div className="flex items-center gap-4">
                                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                                        isSelected
                                          ? 'border-blue-500 bg-blue-500'
                                          : 'border-gray-300 group-hover:border-blue-400'
                                      }`}>
                                        {isSelected && <div className="w-3 h-3 rounded-full bg-white" />}
                                      </div>
                                      <div className="flex-1">
                                        <span className="text-lg sm:text-xl font-semibold break-words">{option}</span>
                                        {isSelected && <span className="ml-3 text-sm text-blue-600 font-medium bg-blue-100 px-2 py-1 rounded-full">Selected</span>}
                                      </div>
                                      {isSelected && <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500" />}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {isLikert && (
                            <div className="space-y-3">
                              <div className="flex justify-between items-center px-2 text-xs text-gray-500">
                                <span>Strongly Disagree</span>
                                <span>Strongly Agree</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                {[1, 2, 3, 4, 5].map((value) => {
                                  const isSelected = answerValue === value.toString();
                                  return (
                                    <button
                                      key={value}
                                      onClick={() => updateAnswer(question.id, value.toString())}
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
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
                  {currentSectionIndex > 0 && (
                    <button
                      onClick={goToPrevious}
                      className="flex items-center gap-2 px-6 py-3 border-2 border-gray-200 text-slate-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 font-medium transition-all hover:scale-[1.02] touch-manipulation"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      {t('back')}
                    </button>
                  )}

                  {isLastSection ? (
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting || currentSection.some((q) => q.required && !getAnswer(q.id))}
                      className={`flex-1 flex items-center justify-center gap-3 ${themeClasses.button} text-white py-4 rounded-xl font-medium text-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg touch-manipulation`}
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
                      disabled={currentSection.some((q) => q.required && !getAnswer(q.id))}
                      className={`flex-1 flex items-center justify-center gap-3 ${themeClasses.button} text-white py-4 rounded-xl font-medium text-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg touch-manipulation`}
                    >
                      {t('next')}
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  )}
                </div>
              </div>
            )
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
