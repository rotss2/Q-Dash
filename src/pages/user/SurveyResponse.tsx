import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { apiPost } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { getAnonymousUserId } from '../../lib/fingerprint';
import { Survey, Question } from '../../types';
import { LanguageProvider, useLanguage } from '../../hooks/useLanguage';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Download, Printer, ShieldAlert, Eye, Camera } from 'lucide-react';
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
  const [userAge, setUserAge] = useState('');
  const [userGender, setUserGender] = useState('');
  const [submissionPreview, setSubmissionPreview] = useState<{ email?: string; answers: { questionText: string; answer: string }[] } | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [fingerprint, setFingerprint] = useState<string>('');
  const [showWelcome, setShowWelcome] = useState(true);
  
  // Live session tracking
  const [liveSessionStarted, setLiveSessionStarted] = useState(false);
  const progressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Security/Anti-cheating states
  const [securityViolation, setSecurityViolation] = useState<string | null>(null);
  const [violationCount, setViolationCount] = useState(0);
  const [showSecurityWarning, setShowSecurityWarning] = useState(false);
  const [isScreenCaptured, setIsScreenCaptured] = useState(false);
  
  // Response summary collapsible state
  const [showResponseSummary, setShowResponseSummary] = useState(false);
  
  // Quiz/Exam mode states
  const [quizResult, setQuizResult] = useState<{
    score: number;
    totalPoints: number;
    percentage: number;
    passed: boolean;
    questionResults: Array<{
      question_id: string;
      question_text: string;
      user_answer: string;
      correct_answer: string;
      is_correct: boolean;
      points_earned: number;
      points_possible: number;
    }>;
    showCorrectAnswers: boolean;
    showExplanations: boolean;
  } | null>(null);

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

  // Check if survey is in quiz or exam mode
  const isQuizOrExam = useMemo(() => {
    return survey?.mode === 'quiz' || survey?.mode === 'exam';
  }, [survey?.mode]);

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

  // Filter active questions only
  const activeQuestions = useMemo(
    () => questions.filter((q) => q.is_active !== false),
    [questions]
  );

  // Group by sections for pagination - split on heading OR page_break
  const sections = useMemo(() => {
    const result: { 
      sectionId: string | null; 
      title: string; 
      items: Question[];
      questionCount: number;
    }[] = [];
    
    let currentSection: typeof result[0] | null = null;
    let questionCounter = 0;
    let sectionCounter = 0;
    
    // First pass: collect all visible questions with their indices
    const visibleQuestions: Question[] = [];
    activeQuestions.forEach((q) => {
      if (shouldShowQuestion(q, answersMap)) {
        visibleQuestions.push(q);
      }
    });
    
    // Second pass: group into sections
    visibleQuestions.forEach((q, index) => {
      // Start new section on heading, page_break, or first item
      if (q.block_type === 'heading' || q.block_type === 'page_break' || !currentSection) {
        // End previous section
        if (currentSection && currentSection.items.length > 0) {
          result.push(currentSection);
        }
        
        // Skip if it's just a page_break with no content yet and no previous section
        if (q.block_type === 'page_break' && !currentSection) {
          return;
        }
        
        sectionCounter++;
        
        // Determine section title
        let sectionTitle: string;
        if (q.block_type === 'heading') {
          // Use the heading text as the section title
          sectionTitle = q.question_text;
        } else if (q.block_type === 'page_break') {
          // Look ahead for the next heading to use as title
          let foundHeading = false;
          for (let i = index + 1; i < visibleQuestions.length; i++) {
            if (visibleQuestions[i].block_type === 'heading') {
              sectionTitle = visibleQuestions[i].question_text;
              foundHeading = true;
              break;
            }
            if (visibleQuestions[i].block_type === 'page_break') break;
          }
          if (!foundHeading) {
            sectionTitle = `Part ${sectionCounter}`;
          }
        } else {
          // First item is not a heading - check if there's a heading soon after
          let foundHeading = false;
          for (let i = index; i < visibleQuestions.length && i < index + 3; i++) {
            if (visibleQuestions[i].block_type === 'heading') {
              sectionTitle = visibleQuestions[i].question_text;
              foundHeading = true;
              break;
            }
            if (visibleQuestions[i].block_type === 'page_break') break;
          }
          if (!foundHeading) {
            sectionTitle = `Part ${sectionCounter}`;
          }
        }
        
        currentSection = {
          sectionId: q.section_id || q.id,
          title: sectionTitle!,
          items: [],
          questionCount: 0
        };
      }
      
      // Skip page_break blocks (they don't display, just split sections)
      if (q.block_type === 'page_break') return;
      
      // Skip headings - they're used as section titles, not items
      if (q.block_type === 'heading') return;
      
      if (q.block_type === 'question') {
        questionCounter++;
        if (currentSection) currentSection.questionCount++;
      }
      
      if (currentSection) {
        currentSection.items.push({ ...q, _questionNumber: q.block_type === 'question' ? questionCounter : undefined });
      }
    });
    
    // Push final section if it has items
    if (currentSection) {
      const section = currentSection as { sectionId: string | null; title: string; items: Question[]; questionCount: number };
      if (section.items.length > 0) {
        result.push(section);
      }
    }
    
    // Remove empty sections
    return result.filter(s => s.items.length > 0);
  }, [activeQuestions, answersMap]);

  // Calculate progress based on actual answered questions (not structural blocks)
  const progress = useMemo(() => {
    // Get all actual question blocks (not headings, instructions, page_breaks)
    const questionBlocks = activeQuestions.filter(q => 
      q.block_type === 'question' && 
      shouldShowQuestion(q, answersMap)
    );
    
    if (questionBlocks.length === 0) return 0;
    
    // Count answered questions (non-empty answers)
    const answeredCount = questionBlocks.filter(q => {
      const answer = answersMap[q.id];
      return answer && answer.trim() !== '';
    }).length;
    
    return (answeredCount / questionBlocks.length) * 100;
  }, [activeQuestions, answersMap]);

  // Section-based navigation
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  
  const currentSection = sections[currentSectionIndex];
  const isLastSection = currentSectionIndex >= sections.length - 1;
  const isFirstSection = currentSectionIndex === 0;
  
  // Reset section index when sections change
  useEffect(() => {
    setCurrentSectionIndex(0);
  }, [sections.length]);

  // Initialize anonymous user ID on mount
  useEffect(() => {
    initializeUser();
  }, []);

  // Check localStorage for previous submission (Frontend Layer 1)
  // Also verify with server to handle admin reset scenario
  useEffect(() => {
    if (!surveyId || !userId) return;

    const storageKey = `survey-completed-${surveyId}`;
    const hasCompleted = localStorage.getItem(storageKey);

    if (hasCompleted === 'true') {
      // Verify with server - admin may have reset responses
      const verifyCompletion = async () => {
        try {
          const { data: hasCompletedOnServer } = await supabase.rpc('has_user_completed_survey', {
            p_survey_id: surveyId,
            p_user_id: userId,
          });

          if (hasCompletedOnServer) {
            // Server confirms - still blocked
            setIsBlocked(true);
            setBlockReason('You have already completed this survey on this device.');
          } else {
            // Server says not completed (admin reset) - clear localStorage and allow access
            localStorage.removeItem(storageKey);
            setIsBlocked(false);
            setBlockReason('');
          }
        } catch (error) {
          // If verification fails, trust localStorage and block
          console.error('Failed to verify completion status:', error);
          setIsBlocked(true);
          setBlockReason('You have already completed this survey on this device.');
        }
      };

      verifyCompletion();
    }
  }, [surveyId, userId]);

  // Start live session immediately when survey loads (on page open)
  useEffect(() => {
    if (!surveyId || !userId || hasSubmitted || isBlocked) return;
    if (!questions.length) return; // Wait for questions to load
    if (liveSessionStarted) return; // Don't start twice

    const startLiveSession = async () => {
      try {
        const questionBlocks = activeQuestions.filter(q => 
          q.block_type === 'question' && 
          shouldShowQuestion(q, answersMap)
        );

        await apiPost('/api/live-sessions/start', {
          survey_id: surveyId,
          user_id: userId,
          email: email || null,
          total_questions: questionBlocks.length,
          fingerprint: fingerprint,
          user_agent: navigator.userAgent
        });
        
        setLiveSessionStarted(true);
        console.log('Live session started on page load');
      } catch (error) {
        // Fail silently - live tracking is not critical
        console.log('Live session start failed (non-critical):', error);
      }
    };

    startLiveSession();
  }, [surveyId, userId, hasSubmitted, isBlocked, questions.length, email, fingerprint, activeQuestions, answersMap, liveSessionStarted]);

  // Update live session when email changes (user enters email on welcome screen)
  useEffect(() => {
    if (!surveyId || !userId || !liveSessionStarted || hasSubmitted) return;
    if (!email) return; // Only update if email is provided

    const updateSessionEmail = async () => {
      try {
        await apiPost('/api/live-sessions/progress', {
          survey_id: surveyId,
          user_id: userId,
          email: email,
          answered_questions: 0,
          progress_percentage: 0
        });
        console.log('Live session email updated');
      } catch (error) {
        // Fail silently
        console.log('Email update failed (non-critical):', error);
      }
    };

    updateSessionEmail();
  }, [surveyId, userId, liveSessionStarted, hasSubmitted, email]);

  // Debounced progress updates
  useEffect(() => {
    if (!surveyId || !userId || !liveSessionStarted || hasSubmitted) return;

    // Clear previous debounce
    if (progressDebounceRef.current) {
      clearTimeout(progressDebounceRef.current);
    }

    // Debounce progress updates by 1.5 seconds
    progressDebounceRef.current = setTimeout(async () => {
      try {
        const questionBlocks = activeQuestions.filter(q => 
          q.block_type === 'question' && 
          shouldShowQuestion(q, answersMap)
        );

        const answeredCount = questionBlocks.filter(q => {
          const answer = answersMap[q.id];
          return answer && answer.trim() !== '';
        }).length;

        const progressPercentage = questionBlocks.length > 0 
          ? (answeredCount / questionBlocks.length) * 100 
          : 0;

        await apiPost('/api/live-sessions/progress', {
          survey_id: surveyId,
          user_id: userId,
          email: email || null,
          answered_questions: answeredCount,
          progress_percentage: progressPercentage
        });
      } catch (error) {
        // Fail silently - progress updates are not critical
        console.log('Progress update failed (non-critical):', error);
      }
    }, 1500);

    return () => {
      if (progressDebounceRef.current) {
        clearTimeout(progressDebounceRef.current);
      }
    };
  }, [answers, surveyId, userId, liveSessionStarted, hasSubmitted, activeQuestions, answersMap, email]);

  // ANTI-CHEATING: Detect tab/window/app switching + Screenshot attempts (Desktop + Mobile)
  useEffect(() => {
    if (showWelcome || hasSubmitted) return;
    if (!survey?.anti_cheating_enabled) return;

    let blurTimeout: ReturnType<typeof setTimeout>;
    let wasHidden = false;
    let lastFocusTime = Date.now();
    
    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        wasHidden = true;
        // Mobile: Sometimes screenshots trigger visibility change
        triggerSecurityViolation('screenshot-attempt', "Don't take screenshots!");
        blurTimeout = setTimeout(() => {
          triggerSecurityViolation('tab-switch', "Don't leave the survey!");
        }, 100);
      } else if (wasHidden) {
        wasHidden = false;
        // User came back - screenshot or app switch
        const awayTime = Date.now() - lastFocusTime;
        if (awayTime < 1000) {
          // Short away time = likely screenshot
          triggerSecurityViolation('screenshot-detected', 'Screenshot gesture detected!');
        }
        triggerSecurityViolation('returned', 'You left and returned to the survey');
        clearTimeout(blurTimeout);
      }
    };

    const handleBlur = () => {
      lastFocusTime = Date.now();
      blurTimeout = setTimeout(() => {
        // Window lost focus - could be screenshot tool
        triggerSecurityViolation('window-blur', "Don't screenshot! Stay focused.");
      }, 50);
    };

    const handleFocus = () => {
      const awayTime = Date.now() - lastFocusTime;
      if (awayTime > 50 && awayTime < 2000) {
        // Quick refocus = possible screenshot
        triggerSecurityViolation('quick-return', 'Possible screenshot detected!');
      }
      clearTimeout(blurTimeout);
    };

    // Mobile-specific: detect app switching / screenshot
    const handlePageHide = () => {
      triggerSecurityViolation('app-switch', "Don't switch apps or screenshot!");
    };

    // Resize sometimes triggers on screenshot UI appearing
    let lastHeight = window.innerHeight;
    const handleResize = () => {
      const newHeight = window.innerHeight;
      const heightDiff = Math.abs(newHeight - lastHeight);
      // Mobile screenshot tools sometimes change viewport
      if (heightDiff > 100 && heightDiff < 300) {
        triggerSecurityViolation('viewport-change', 'Screenshot tool detected!');
      }
      lastHeight = newHeight;
    };

    const handleBeforeUnload = () => {
      console.warn('[SECURITY] User attempted to leave page');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearTimeout(blurTimeout);
    };
  }, [showWelcome, hasSubmitted, survey]);

  // ANTI-CHEATING: Detect print screen, dev tools, right-click
  useEffect(() => {
    if (showWelcome || hasSubmitted) return;
    if (!survey?.anti_cheating_enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Print Screen
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        triggerSecurityViolation('screenshot', "Don't take screenshots!");
        return false;
      }
      
      // Ctrl+Shift+I (Dev Tools)
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.keyCode === 73)) {
        e.preventDefault();
        triggerSecurityViolation('dev-tools', 'Developer tools shortcut blocked');
        return false;
      }
      
      // Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j' || e.keyCode === 74)) {
        e.preventDefault();
        triggerSecurityViolation('dev-tools', 'Developer console shortcut blocked');
        return false;
      }
      
      // F12 (Dev Tools)
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        triggerSecurityViolation('dev-tools', 'Developer tools key blocked');
        return false;
      }
      
      // Ctrl+U (View Source)
      if (e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.keyCode === 85)) {
        e.preventDefault();
        triggerSecurityViolation('view-source', 'View source blocked');
        return false;
      }
      
      // Ctrl+C (Copy) - Desktop
      if (e.ctrlKey && (e.key === 'C' || e.key === 'c' || e.keyCode === 67)) {
        e.preventDefault();
        triggerSecurityViolation('copy', "Don't copy!");
        return false;
      }
      
      // Cmd+C (Copy) - Mac
      if (e.metaKey && (e.key === 'C' || e.key === 'c' || e.keyCode === 67)) {
        e.preventDefault();
        triggerSecurityViolation('copy', "Don't copy!");
        return false;
      }
      
      // Ctrl+P (Print)
      if (e.ctrlKey && (e.key === 'P' || e.key === 'p' || e.keyCode === 80)) {
        e.preventDefault();
        triggerSecurityViolation('print', "Don't print!");
        return false;
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      triggerSecurityViolation('right-click', "Don't right-click!");
      return false;
    };

    // Mobile touch copy prevention
    const handleTouchStart = (e: TouchEvent) => {
      // Prevent long-press context menu on mobile
      if (e.touches.length > 1) {
        e.preventDefault();
        triggerSecurityViolation('multi-touch', "Don't use multi-touch!");
      }
    };

    const handleSelectStart = (e: Event) => {
      e.preventDefault();
      triggerSecurityViolation('select', "Don't select text!");
      return false;
    };

    const handleBeforePrint = () => {
      triggerSecurityViolation('print', "Don't print!");
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('selectstart', handleSelectStart);
    window.addEventListener('beforeprint', handleBeforePrint);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('selectstart', handleSelectStart);
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, [showWelcome, hasSubmitted, survey]);

  // ANTI-CHEATING: Detect text selection
  useEffect(() => {
    if (showWelcome || hasSubmitted) return;
    if (!survey?.anti_cheating_enabled) return;

    const handleSelection = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        triggerSecurityViolation('text-select', "Don't select text!");
        selection.removeAllRanges();
      }
    };

    document.addEventListener('selectionchange', handleSelection);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelection);
    };
  }, [showWelcome, hasSubmitted, survey]);

  // Security violation handler
  const triggerSecurityViolation = (type: string, message: string) => {
    const timestamp = new Date().toISOString();
    console.warn(`[SECURITY VIOLATION] ${type}: ${message} at ${timestamp}`);
    
    setSecurityViolation(message);
    setViolationCount(prev => prev + 1);
    setShowSecurityWarning(true);
    setIsScreenCaptured(true);
    
    // Log to database (optional - can be enabled)
    // logSecurityEvent(type, message, timestamp);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setShowSecurityWarning(false);
      setIsScreenCaptured(false);
    }, 5000);
  };

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

    // Cast survey data to proper type
    const typedSurvey: Survey = {
      ...surveyData,
      release_results_mode: surveyData.release_results_mode as Survey['release_results_mode']
    };

    const now = new Date();
    if (typedSurvey.status !== 'open') {
      setSurvey(typedSurvey);
      setIsBlocked(true);
      setBlockReason(t('surveyClosed'));
      setIsLoading(false);
      return;
    }

    if (typedSurvey.open_date && new Date(typedSurvey.open_date) > now) {
      setSurvey(typedSurvey);
      setIsBlocked(true);
      setBlockReason(`${t('surveyNotOpen')} ${new Date(typedSurvey.open_date).toLocaleString()}.`);
      setIsLoading(false);
      return;
    }

    if (typedSurvey.close_date && new Date(typedSurvey.close_date) < now) {
      setSurvey(typedSurvey);
      setIsBlocked(true);
      setBlockReason(`${t('surveyExpired')} ${new Date(typedSurvey.close_date).toLocaleString()}.`);
      setIsLoading(false);
      return;
    }

    setSurvey(typedSurvey);

    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('survey_id', surveyId)
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (questionsError) {
      showToast(t('errorLoadingSurvey'), 'error');
    } else {
      // Cast questions data with proper types
      const typedQuestions: Question[] = (questionsData || []).map(q => ({
        ...q,
        correct_answers: q.correct_answers as string[] | null | undefined,
        grading_type: q.grading_type as 'auto' | 'manual' | null | undefined
      }));
      setQuestions(typedQuestions);
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

    // Validate required fields for all questions across all sections
    const allQuestions = sections.flatMap(s => s.items).filter(q => q.block_type === 'question');
    const missingRequired = allQuestions
      .filter((q) => q.required)
      .filter((q) => !getAnswer(q.id));

    if (missingRequired.length > 0) {
      showToast(`${t('errorRequiredField')} (${missingRequired.length} questions)`, 'error');
      return;
    }

    setIsSubmitting(true);

    // Check if user already completed this survey before proceeding
    const { data: hasCompletedBeforeSubmit, error: completionCheckError } =
      await supabase.rpc('has_user_completed_survey', {
        p_survey_id: surveyId!,
        p_user_id: userId,
      });

    if (completionCheckError) {
      console.error('Completion check failed:', completionCheckError);
      showToast('Unable to verify submission status. Please try again.', 'error');
      setIsSubmitting(false);
      return;
    }

    if (hasCompletedBeforeSubmit) {
      setIsBlocked(true);
      setBlockReason(t('responseRecorded'));
      localStorage.setItem(`survey-completed-${surveyId}`, 'true');
      showToast(t('responseRecorded'), 'error');
      setIsSubmitting(false);
      return;
    }

    // Validate required parameters before calling RPC
    if (!surveyId) {
      console.error('Survey ID is missing');
      showToast('Survey ID is missing. Please refresh the page.', 'error');
      setIsSubmitting(false);
      return;
    }

    // For Quiz/Exam modes, use quiz/exam submission API
    if (isQuizOrExam) {
      await handleQuizExamSubmit(allQuestions);
      return;
    }

    // For regular surveys, use the normal submission flow
    await handleSurveySubmit(allQuestions);
  };

  // Separate handler for regular survey submission
  const handleSurveySubmit = async (allQuestions: Question[]) => {
    // Validate surveyId is available
    if (!surveyId) {
      showToast('Survey ID is missing', 'error');
      setIsSubmitting(false);
      return;
    }

    const cleanedEmail = email.trim();

    // Validate email format only if email is provided
    if (cleanedEmail && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(cleanedEmail)) {
      showToast(t('errorInvalidEmail'), 'error');
      setIsSubmitting(false);
      return;
    }

    // Record survey completion and email BEFORE inserting responses
    // Add retry logic for transient failures
    let completionResult = null;
    let completionError = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await supabase.rpc('record_survey_completion', {
        p_survey_id: surveyId,
        p_user_id: userId,
        p_fingerprint: fingerprint,
        p_ip_address: typeof window !== 'undefined' ? window.location.hostname : undefined,
        p_user_agent: navigator.userAgent,
        p_email: cleanedEmail || undefined,
        p_gender: userGender || undefined,
        p_age: userAge ? parseInt(userAge, 10) : undefined,
      });

      if (!result.error) {
        completionResult = result.data;
        completionError = null;
        break;
      }

      completionError = result.error;
      console.warn(`Attempt ${attempt} failed:`, result.error);

      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }

    if (completionError) {
      console.error('Failed to record survey completion after all retries:', completionError);
      console.error('Error details:', JSON.stringify(completionError, null, 2));
      console.error('Survey ID:', surveyId);
      console.error('User ID:', userId);
      console.error('Email:', cleanedEmail || '(not provided)');
      const errorMessage = completionError.message || completionError.details || 'Unable to record your submission. Please try again.';
      showToast(`Submission error: ${errorMessage}`, 'error');
      setIsSubmitting(false);
      return;
    }

    const completionRecorded = completionResult;

    if (!completionRecorded) {
      setIsBlocked(true);
      setBlockReason(t('responseRecorded'));
      localStorage.setItem(`survey-completed-${surveyId}`, 'true');
      showToast(t('responseRecorded'), 'error');
      setIsSubmitting(false);
      return;
    }

    // Now prepare and insert responses
    const now = new Date().toISOString();
    const allQuestionIds = new Set(allQuestions.map((q) => q.id));
    const responsesToInsert = answers
      .filter((a) => allQuestionIds.has(a.question_id))
      .map((a) => ({
        survey_id: surveyId!,
        user_id: userId,
        question_id: a.question_id,
        answer: a.answer,
        submitted_at: now
      }));

    // Insert responses only after survey session/email is recorded successfully
    const { error } = await supabase
      .from('responses')
      .insert(responsesToInsert)
      .select();

    if (error) {
      console.error('Failed to insert responses:', error);
      showToast('Failed to submit responses. Please try again.', 'error');
      setIsSubmitting(false);
      return;
    }

    // Response count is automatically updated by database trigger
    // No need to manually call increment_survey_response_count

    // Complete the live session
    if (liveSessionStarted) {
      try {
        await apiPost('/api/live-sessions/complete', {
          survey_id: surveyId,
          user_id: userId,
          email: cleanedEmail
        });
        console.log('Live session completed');
      } catch (error) {
        // Fail silently
        console.log('Live session completion failed (non-critical):', error);
      }
    }

    // Layer 1: Save to localStorage to block future attempts
    localStorage.setItem(`survey-completed-${surveyId}`, 'true');
    
    // Deduplicate questions by question_text to handle legacy data
    const seenQuestions = new Set<string>();
    const uniqueAllQuestions = sections.flatMap(s => s.items);
    const uniqueQuestions = uniqueAllQuestions.filter((q) => {
      const normalized = q.question_text.trim().toLowerCase();
      if (seenQuestions.has(normalized)) {
        return false;
      }
      seenQuestions.add(normalized);
      return true;
    });

    // Only include questions that have actual answers (filter out skipped/empty questions)
    const answeredQuestions = uniqueQuestions.filter((q) => {
      const answer = getAnswer(q.id);
      return answer && answer.trim() !== '';
    });

    setSubmissionPreview({
      email: cleanedEmail || undefined,
      answers: answeredQuestions.map((q) => ({
        questionText: q.question_text,
        answer: getAnswer(q.id)
      }))
    });

    showToast(t('success'), 'success');
    setHasSubmitted(true);
    setIsSubmitting(false);
  };

  // Handler for quiz/exam submission with scoring
  const handleQuizExamSubmit = async (allQuestions: Question[]) => {
    try {
      // Insert responses first
      const now = new Date().toISOString();
      const allQuestionIds = new Set(allQuestions.map((q: Question) => q.id));
      const responsesToInsert = answers
        .filter((a) => allQuestionIds.has(a.question_id))
        .map((a) => ({
          survey_id: surveyId!,
          user_id: userId,
          question_id: a.question_id,
          answer: a.answer,
          submitted_at: now
        }));

      const { error: insertError } = await supabase
        .from('responses')
        .insert(responsesToInsert);

      if (insertError) {
        console.error('Failed to insert responses:', insertError);
        showToast('Failed to submit responses. Please try again.', 'error');
        setIsSubmitting(false);
        return;
      }

      // Submit quiz/exam and get score
      const { data: scoreData, error: scoreError } = await apiPost<{
        success: boolean;
        score: number;
        totalPoints: number;
        percentage: number;
        passed: boolean;
        questionResults: Array<{
          question_id: string;
          question_text: string;
          user_answer: string;
          correct_answer: string;
          is_correct: boolean;
          points_earned: number;
          points_possible: number;
        }>;
        showCorrectAnswers: boolean;
        showExplanations: boolean;
      }>(
        `/api/surveys/${surveyId}/submit-quiz`,
        {
          userId,
          responses: answers
        }
      );

      if (scoreError || !scoreData) {
        console.error('Quiz submission failed:', scoreError);
        showToast(scoreError?.error || 'Failed to submit quiz. Please try again.', 'error');
        setIsSubmitting(false);
        return;
      }

      // Set quiz result for display
      setQuizResult({
        score: scoreData.score,
        totalPoints: scoreData.totalPoints,
        percentage: scoreData.percentage,
        passed: scoreData.passed,
        questionResults: scoreData.questionResults || [],
        showCorrectAnswers: scoreData.showCorrectAnswers,
        showExplanations: scoreData.showExplanations
      });

      // Save completion to localStorage
      localStorage.setItem(`survey-completed-${surveyId}`, 'true');

      showToast(`Quiz completed! Score: ${scoreData.score}/${scoreData.totalPoints}`, 'success');
      setHasSubmitted(true);
      setIsSubmitting(false);
    } catch (error) {
      console.error('Quiz exam submit error:', error);
      showToast('An error occurred. Please try again.', 'error');
      setIsSubmitting(false);
    }
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
    // Validate age (required)
    if (!userAge || userAge.trim() === '') {
      showToast('Please enter your age to continue', 'error');
      return;
    }
    const ageNum = parseInt(userAge, 10);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
      showToast('Please enter a valid age between 1 and 120', 'error');
      return;
    }
    
    // Validate email if provided (optional)
    if (email && !validateEmail(email)) {
      setEmailError('Please enter a valid Gmail address (e.g., user@gmail.com)');
      return;
    }
    setEmailError('');
    setShowWelcome(false);
  };

  const goToNextSection = () => {
    // Validate all required questions in current section
    const unansweredRequired = currentSection?.items.filter(
      (item) => item.block_type === 'question' && item.required && !getAnswer(item.id)
    );
    
    if (unansweredRequired && unansweredRequired.length > 0) {
      showToast(`${t('errorRequiredField')} (${unansweredRequired.length} question${unansweredRequired.length > 1 ? 's' : ''})`, 'error');
      return;
    }
    
    if (!isLastSection) {
      setCurrentSectionIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToPreviousSection = () => {
    if (!isFirstSection) {
      setCurrentSectionIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

  if (hasSubmitted && (submissionPreview || quizResult)) {
    return (
      <div className={`min-h-screen ${themeClasses.bg}`}>
        {/* Animated Background Theme */}
        <ThemedBackground theme={survey?.background_theme || 'default'} />
        
        <div className="w-full py-6 sm:py-10 px-4 sm:px-6">
          <div className="max-w-2xl mx-auto w-full">
            {/* Success Logo */}
            <div className="flex flex-col items-center gap-3 mb-6">
              <img 
                src="/logo.png" 
                alt="SurveyTest" 
                className="h-14 sm:h-16 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>

            {/* Success Message */}
            <div className="text-center space-y-2 mb-6">
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">
                {t('thankYou')}
              </h1>
              <p className="text-base sm:text-lg text-gray-600">
                Your response has been successfully submitted
              </p>
              <p className="text-sm text-gray-500">
                We appreciate your time and valuable feedback
              </p>
            </div>

            {/* Session ID */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4 mb-6 mx-auto max-w-xs">
              <p className="text-xs text-gray-500 text-center mb-1">
                Session ID
              </p>
              <p className="text-xs text-gray-400 text-center mb-2">
                Screenshots are traceable
              </p>
              <p className="text-center font-mono text-sm text-gray-700 break-all">
                {userId.substring(0, 12).toUpperCase()}
              </p>
            </div>

            {/* Success Stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
              <div className="text-center bg-green-50 rounded-xl p-3 border border-green-100">
                <div className="text-xl sm:text-2xl font-bold text-green-600">{submissionPreview?.answers?.length || 0}</div>
                <div className="text-xs sm:text-sm text-green-700 mt-1">Answered</div>
              </div>
              <div className="text-center bg-blue-50 rounded-xl p-3 border border-blue-100">
                <div className="text-xl sm:text-2xl font-bold text-blue-600">100%</div>
                <div className="text-xs sm:text-sm text-blue-700 mt-1">Done</div>
              </div>
              <div className="text-center bg-purple-50 rounded-xl p-3 border border-purple-100">
                <div className="text-xl sm:text-2xl font-bold text-purple-600">✓</div>
                <div className="text-xs sm:text-sm text-purple-700 mt-1">Success</div>
              </div>
            </div>

            {/* Quiz/Exam Results */}
            {quizResult && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6 shadow-sm">
                {/* Score Header */}
                <div className="text-center mb-6">
                  <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                    {isQuizOrExam ? (survey?.mode === 'exam' ? 'Exam Results' : 'Quiz Results') : 'Results'}
                  </h2>
                  <div className={`text-4xl sm:text-5xl font-bold mb-2 ${
                    quizResult.passed ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {quizResult.score}/{quizResult.totalPoints}
                  </div>
                  <div className="text-lg text-gray-600">
                    {quizResult.percentage}% {quizResult.passed ? '✓ Passed' : '✗ Did not pass'}
                  </div>
                </div>

                {/* Question-by-question breakdown */}
                {quizResult.questionResults.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-900 border-b pb-2">Question Breakdown</h3>
                    {quizResult.questionResults.map((q, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border ${
                          q.is_correct
                            ? 'bg-green-50 border-green-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className={`font-bold ${q.is_correct ? 'text-green-600' : 'text-red-600'}`}>
                            {q.is_correct ? '✓' : '✗'}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">{q.question_text}</p>
                            <div className="mt-1 text-sm">
                              <span className="text-gray-600">Your answer: </span>
                              <span className={q.is_correct ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                                {q.user_answer || '(no answer)'}
                              </span>
                            </div>
                            {!q.is_correct && quizResult.showCorrectAnswers && (
                              <div className="mt-1 text-sm">
                                <span className="text-gray-600">Correct answer: </span>
                                <span className="text-green-700 font-medium">{q.correct_answer}</span>
                              </div>
                            )}
                            <div className="mt-1 text-xs text-gray-500">
                              Points: {q.points_earned}/{q.points_possible}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {submissionPreview?.email && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm sm:text-lg">📧</span>
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-medium text-blue-900 break-words">
                      Summary sent to {submissionPreview?.email}
                    </p>
                    <p className="text-xs text-blue-700">
                      Check your inbox
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Response Summary Card */}
            <div ref={summaryRef} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="p-4 sm:p-6 border-b border-gray-100">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 text-center leading-tight break-words mb-2">
                  {survey?.title}
                </h2>
                <p className="text-sm sm:text-base text-gray-500 text-center">Response Summary</p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mt-4 text-xs sm:text-sm text-gray-500">
                  <span className="text-center">
                    <span className="text-gray-400">Submitted:</span>{' '}
                    {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {submissionPreview?.email && (
                    <span className="text-blue-600 text-center break-all">
                      <span className="text-gray-400">Email:</span> {submissionPreview?.email}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Response List Container */}
              <div className="space-y-4">
                {/* All Answers - Collapsible */}
                <button
                  onClick={() => setShowResponseSummary(!showResponseSummary)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-gray-700 font-medium"
                  aria-expanded={showResponseSummary}
                >
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  {showResponseSummary ? 'Hide' : 'View'} Your Responses ({submissionPreview?.answers?.length || 0})
                  <span className="ml-2">{showResponseSummary ? '▲' : '▼'}</span>
                </button>
                
                {showResponseSummary && (
                  <div className="space-y-3">
                    {submissionPreview?.answers?.map((item, index) => (
                      <div key={index} className="bg-gray-50 rounded-xl border border-gray-200 p-3 sm:p-4 break-inside-avoid">
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold text-blue-600 flex-shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <p className="text-sm font-medium text-gray-800 leading-relaxed break-words">{item.questionText}</p>
                            <div className="bg-white p-2 sm:p-3 rounded-lg border border-gray-200">
                              <p className="text-sm sm:text-base text-gray-900 font-medium break-words">
                                {item.answer}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Collapse button at bottom */}
                    <button
                      onClick={() => setShowResponseSummary(false)}
                      className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      ▲ Collapse responses
                    </button>
                  </div>
                )}
              </div>

              {/* PDF Footer */}
              <div className="mt-6 pt-4 border-t border-gray-200 text-center text-xs sm:text-sm text-gray-400">
                <p>Generated by Q-Dash Survey Platform</p>
                <p className="text-xs mt-1">q-dash.onrender.com</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-6 pb-8">
              <button
                onClick={downloadPDF}
                className="flex items-center justify-center gap-2 px-6 py-3 h-12 bg-slate-900 text-white rounded-xl hover:bg-slate-800 font-medium transition-all shadow-lg w-full sm:w-auto sm:flex-1"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center justify-center gap-2 px-6 py-3 h-12 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-all w-full sm:w-auto"
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
                  className="flex items-center justify-center gap-2 px-6 py-3 h-12 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-all w-full sm:w-auto"
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

  if (sections.length === 0) {
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

  return (
    <div 
      className={`min-h-screen ${themeClasses.bg} flex flex-col ${fontClass} relative select-none`}
      style={{ 
        WebkitUserSelect: 'none', 
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitTextSizeAdjust: 'none',
        touchAction: 'pan-y',
        overscrollBehavior: 'none'
      }}
    >
      {/* Security Warning Modal */}
      {showSecurityWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-pulse border-4 border-red-500">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-red-600">Security Alert!</h3>
                <p className="text-sm text-gray-500">Violation #{violationCount}</p>
              </div>
            </div>
            <p className="text-gray-800 text-lg mb-4 text-center font-medium">
              {securityViolation}
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700 text-center">
                This activity has been logged. Please focus on the survey.
              </p>
            </div>
            <button
              onClick={() => setShowSecurityWarning(false)}
              className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
            >
              I Understand - Continue Survey
            </button>
          </div>
        </div>
      )}

      {/* Screenshot Detection Overlay */}
      {isScreenCaptured && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-bounce">
            <Camera className="w-5 h-5" />
            <span className="font-semibold text-sm">Screenshot Detected!</span>
          </div>
        </div>
      )}

      {/* Floating Security Badge */}
      {!showWelcome && !hasSubmitted && survey?.anti_cheating_enabled && (
        <div className="fixed bottom-4 left-4 z-30 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-3 py-2 shadow-lg flex items-center gap-2">
          <Eye className="w-4 h-4 text-green-600" />
          <span className="text-xs font-medium text-gray-600">Secure Mode Active</span>
          {violationCount > 0 && (
            <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-bold">
              {violationCount}
            </span>
          )}
        </div>
      )}

      {/* Anti-Photo Watermark Overlay */}
      {!showWelcome && !hasSubmitted && survey?.anti_cheating_enabled && (
        <>
          {/* User ID Watermark - appears in photos */}
          <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden opacity-[0.08]">
            {/* Repeated watermark pattern */}
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="absolute text-red-900 font-mono text-sm font-bold rotate-[-45deg] whitespace-nowrap"
                style={{
                  top: `${(i % 5) * 25}%`,
                  left: `${Math.floor(i / 5) * 25}%`,
                  transform: 'rotate(-45deg)',
                }}
              >
                {userId.substring(0, 8).toUpperCase()} • NO PHOTOS • CONFIDENTIAL
              </div>
            ))}
          </div>
          
          {/* Photo Warning Banner - Bottom position */}
          <div className="fixed bottom-20 left-4 right-4 z-[90] bg-red-600/95 backdrop-blur-sm text-white text-center py-2 px-4 rounded-lg shadow-lg pointer-events-none">
            <p className="text-xs font-semibold tracking-wide uppercase">
              ⚠️ Taking photos of this survey is prohibited and traceable ⚠️
            </p>
          </div>
        </>
      )}

      {/* Animated Background Theme */}
      <ThemedBackground theme={survey?.background_theme || 'default'} />
      
      {/* Header with Logo & Progress */}
      <header className={`${themeClasses.card} border-b sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/95`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          {/* Top Row: Survey Title Only */}
          <div className="flex items-center justify-center mb-2">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate max-w-full">
              {survey.title}
            </h1>
          </div>
          
          {/* Progress Info - hidden during welcome screen */}
          {!showWelcome && (
            <>
              <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                <span className="font-medium">
                  Section {currentSectionIndex + 1} of {sections.length}
                </span>
                <span className="font-semibold text-gray-700">
                  {Math.round(progress)}% complete
                </span>
              </div>
              
              {/* Progress Bar - no animation for performance */}
              <div className={`h-3 ${themeClasses.progress} rounded-full overflow-hidden will-change-transform`}>
                <div 
                  className={`h-full ${themeClasses.progressFill} transition-all duration-300 ease-out`}
                  style={{ width: `${progress}%`, willChange: 'width' }}
                />
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Content - Welcome Screen or Questions */}
      <main className="flex-1 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-3xl mx-auto">
          {showWelcome ? (
            // Welcome Screen
            <div className="card space-y-8 text-center mb-8">
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

              {/* Demographics / Profiling Section */}
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-6 text-left space-y-6">
                <h3 className="font-semibold text-indigo-900 text-lg mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-sm">👤</span>
                  Quick Profile
                </h3>
                
                {/* Age - Required */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={userAge}
                    onChange={(e) => setUserAge(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-slate-900 focus:outline-none focus:border-indigo-400 transition-colors"
                    placeholder="Enter your age"
                    required
                  />
                  <p className="text-xs text-slate-500">Required to help us understand our audience</p>
                </div>
                
                {/* Gender - Optional */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Gender <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <select
                    value={userGender}
                    onChange={(e) => setUserGender(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-slate-900 focus:outline-none focus:border-indigo-400 transition-colors bg-white"
                  >
                    <option value="">Select gender (optional)</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-6 text-left space-y-4">
                <h3 className="font-semibold text-gray-900 text-lg">What to expect:</h3>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 mt-0.5 text-lg">✓</span>
                    <span>This survey takes approximately {Math.ceil(sections.reduce((acc, s) => acc + s.questionCount, 0) * 0.5)} minutes</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 mt-0.5 text-lg">✓</span>
                    <span>There are {sections.reduce((acc, s) => acc + s.questionCount, 0)} question{sections.reduce((acc, s) => acc + s.questionCount, 0) !== 1 ? 's' : ''} to complete</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 mt-0.5 text-lg">✓</span>
                    <span>Your responses are completely confidential</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-500 mt-0.5 text-lg">✓</span>
                    <span>You can navigate back to review previous answers</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 space-y-4">
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
                    emailError ? 'border-red-300 focus:border-red-400 bg-red-50' : 'border-gray-200 focus:border-slate-400'
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
                    Optional. Leave blank to proceed anonymously. Must be a valid @gmail.com address.
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
            // Section-based Questions
            currentSection && (
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
                
                {/* Section Title */}
                <div className="border-b-2 border-gray-100 pb-4">
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                    {currentSection.title}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Section {currentSectionIndex + 1} of {sections.length} • {currentSection.questionCount} question{currentSection.questionCount !== 1 ? 's' : ''}
                  </p>
                </div>
                
                {/* Render All Items in Section */}
                <div className="space-y-10">
                  {currentSection.items.map((item) => {
                    // INSTRUCTION - Info box, no number
                    if (item.block_type === 'instruction') {
                      return (
                        <div key={item.id} className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
                          <p className="text-blue-800 text-base leading-relaxed">{item.question_text}</p>
                        </div>
                      );
                    }
                    
                    // QUESTION - Numbered with input (headings are now section titles, not items)
                    if (item.block_type === 'question') {
                      return (
                        <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-sm space-y-5">
                          <div className="flex items-start gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-base font-bold shadow-md ${themeClasses.button}`}>
                              {item._questionNumber}
                            </div>
                            <div className="flex-1 pt-1">
                              <h3 className="text-lg sm:text-xl font-semibold text-slate-900 leading-snug break-words">
                                {item.question_text}
                                {item.required && (
                                  <span className="text-red-500 ml-1" title={t('required')}>*</span>
                                )}
                              </h3>
                              <div className="flex items-center gap-2 mt-2">
                                {item.required && (
                                  <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Required</span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Answer Input */}
                          <div className="space-y-4 pl-14">
                            {item.type === 'text' && (
                              <div className="relative">
                                <textarea
                                  value={getAnswer(item.id)}
                                  onChange={(e) => updateAnswer(item.id, e.target.value)}
                                  className="w-full p-4 border-2 border-gray-200 rounded-xl text-slate-900 min-h-[160px] focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100/50 resize-y transition-all text-base sm:text-lg"
                                  placeholder="Type your answer here..."
                                />
                                {getAnswer(item.id) && (
                                  <div className="absolute top-3 right-3">
                                    <CheckCircle className="w-6 h-6 text-green-500" />
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {item.type === 'choice' && item.options && (
                              <div className="space-y-3" role="radiogroup" aria-label={item.question_text}>
                                {item.options.map((option) => {
                                  const isSelected = getAnswer(item.id) === option;
                                  return (
                                    <button
                                      key={option}
                                      onClick={() => updateAnswer(item.id, option)}
                                      className={`w-full p-5 text-left border-2 rounded-xl transition-all duration-200 flex items-center gap-4 ${
                                        isSelected
                                          ? 'border-blue-500 bg-blue-50 shadow-md'
                                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                      }`}
                                      role="radio"
                                      aria-checked={isSelected}
                                      tabIndex={isSelected ? 0 : -1}
                                    >
                                      <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                        isSelected
                                          ? 'border-blue-500 bg-blue-500'
                                          : 'border-gray-300'
                                      }`}>
                                        {isSelected && (
                                          <div className="w-2.5 h-2.5 rounded-full bg-white" />
                                        )}
                                      </div>
                                      <span className={`text-base sm:text-lg ${isSelected ? 'font-medium text-slate-900' : 'text-slate-700'}`}>{option}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            
                            {item.type === 'likert' && (
                              <div className="space-y-4">
                                {/* Rating scale with aligned labels and numbers */}
                                <div className="grid grid-cols-5 gap-2 sm:gap-3">
                                  {[1, 2, 3, 4, 5].map((value) => {
                                    const isSelected = getAnswer(item.id) === value.toString();
                                    const labels = ['Strongly\nDisagree', 'Disagree', 'Neutral', 'Agree', 'Strongly\nAgree'];
                                    return (
                                      <div key={value} className="flex flex-col items-center gap-2">
                                        {/* Label above each button */}
                                        <span className={`text-[10px] sm:text-xs text-center font-medium leading-tight whitespace-pre-line min-h-[24px] sm:min-h-[28px] flex items-end ${
                                          isSelected ? themeClasses.accent : 'text-gray-500'
                                        }`}>
                                          {labels[value - 1]}
                                        </span>
                                        {/* Number button */}
                                        <button
                                          onClick={() => updateAnswer(item.id, value.toString())}
                                          className={`w-full aspect-square min-h-[44px] sm:min-h-[48px] border-2 rounded-xl transition-all duration-200 flex items-center justify-center ${
                                            isSelected
                                              ? 'border-transparent bg-slate-900 text-white shadow-md'
                                              : 'border-gray-300 hover:border-slate-400 hover:bg-gray-50'
                                          }`}
                                          role="radio"
                                          aria-checked={isSelected}
                                          tabIndex={isSelected ? 0 : -1}
                                          aria-label={`${value} - ${labels[value - 1].replace('\n', ' ')}`}
                                        >
                                          <span className="text-base sm:text-lg font-bold">{value}</span>
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    
                    return null;
                  })}
                </div>

                {/* Navigation - Section Based */}
                <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t-2 border-gray-100 mt-8">
                  {!isFirstSection && (
                    <button
                      onClick={goToPreviousSection}
                      className="flex items-center justify-center gap-2 px-6 py-3.5 border-2 border-gray-200 text-slate-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 font-medium transition-all active:scale-[0.98] touch-manipulation w-full sm:w-auto sm:order-1 order-2"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      Back
                    </button>
                  )}
                  
                  {isLastSection ? (
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className={`flex-1 flex items-center justify-center gap-3 ${themeClasses.button} text-white py-3.5 rounded-xl font-medium text-base sm:text-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg touch-manipulation w-full sm:w-auto order-1 sm:order-2`}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Submit Response
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={goToNextSection}
                      className={`flex-1 flex items-center justify-center gap-3 ${themeClasses.button} text-white py-3.5 rounded-xl font-medium text-base sm:text-lg transition-all active:scale-[0.98] shadow-lg touch-manipulation w-full sm:w-auto order-1 sm:order-2`}
                    >
                      Next
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 sm:py-6">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center gap-3">
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
