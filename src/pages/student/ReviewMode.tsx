import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toaster';
import { SkeletonCard } from '../../components/LoadingSkeleton';
import { 
  CheckCircle, 
  XCircle, 
  ArrowRight, 
  ArrowLeft,
  RotateCcw,
  Home,
  Trophy,
  Target,
  AlertCircle,
  Lightbulb,
  BarChart3
} from 'lucide-react';

interface ReviewQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: {
    id: string;
    option_text: string;
    is_correct: boolean;
  }[] | null;
  correct_answer: string | null;
  explanation: string | null;
  points: number;
  topic: string;
}

interface UserAnswer {
  question_id: string;
  answer: string;
  is_correct: boolean;
  points_earned: number;
}

interface ReviewData {
  surveyId: string;
  surveyTitle: string;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  percentage: number;
  timeSpent: number;
  questions: ReviewQuestion[];
  answers: UserAnswer[];
  passed: boolean;
  passingScore: number;
}

export default function ReviewMode() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);

  const fetchReviewData = useCallback(async () => {
    if (!surveyId) return;
    
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast('Please log in to view review', 'error');
        navigate('/login');
        return;
      }

      // Fetch quiz result
      const { data: result, error: resultError } = await supabase
        .from('quiz_exam_results')
        .select('*')
        .eq('survey_id', surveyId)
        .eq('user_id', user.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .single();

      if (resultError || !result) {
        showToast('No results found for this quiz', 'error');
        navigate('/student/quizzes');
        return;
      }

      // Fetch survey details
      const { data: survey, error: surveyError } = await supabase
        .from('surveys')
        .select('title, passing_score')
        .eq('id', surveyId)
        .single();

      if (surveyError) throw surveyError;

      // Fetch questions
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('id, question_text, question_type, options, correct_answer, explanation, points, topic')
        .eq('survey_id', surveyId)
        .order('order_index');

      if (questionsError) throw questionsError;

      // Parse responses
      const responses = result.responses as Record<string, { answer: string; is_correct: boolean; points_earned: number }> || {};
      
      const answers: UserAnswer[] = Object.entries(responses).map(([questionId, data]) => ({
        question_id: questionId,
        answer: data.answer,
        is_correct: data.is_correct,
        points_earned: data.points_earned,
      }));

      const correctCount = answers.filter(a => a.is_correct).length;

      setReviewData({
        surveyId,
        surveyTitle: survey?.title || 'Quiz',
        totalQuestions: questions?.length || 0,
        correctAnswers: correctCount,
        score: result.score || 0,
        percentage: result.percentage || 0,
        timeSpent: 0, // Would need to track time
        questions: questions || [],
        answers,
        passed: result.passed || false,
        passingScore: survey?.passing_score || 70,
      });
    } catch (error) {
      console.error('Error fetching review data:', error);
      showToast('Failed to load review data', 'error');
    } finally {
      setLoading(false);
    }
  }, [surveyId, navigate, showToast]);

  useEffect(() => {
    fetchReviewData();
  }, [fetchReviewData]);

  const getUserAnswer = (questionId: string): UserAnswer | undefined => {
    return reviewData?.answers.find(a => a.question_id === questionId);
  };

  const getOptionLabel = (index: number): string => {
    return ['A', 'B', 'C', 'D', 'E', 'F'][index] || String(index + 1);
  };

  const handleNext = () => {
    if (reviewData && currentIndex < reviewData.questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowExplanation(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowExplanation(false);
    }
  };

  const handleRetry = () => {
    if (confirm('Would you like to retake this quiz?')) {
      navigate(`/survey/${surveyId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <SkeletonCard count={3} />
        </div>
      </div>
    );
  }

  if (!reviewData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Review Not Available</h2>
          <p className="text-gray-500 mb-4">Unable to load review data</p>
          <button
            onClick={() => navigate('/student/quizzes')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium"
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = reviewData.questions[currentIndex];
  const userAnswer = getUserAnswer(currentQuestion.id);
  const isCorrect = userAnswer?.is_correct || false;
  const progress = ((currentIndex + 1) / reviewData.totalQuestions) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/student/quizzes')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Home className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="font-bold text-gray-900">Review: {reviewData.surveyTitle}</h1>
                <p className="text-xs text-gray-500">
                  Question {currentIndex + 1} of {reviewData.totalQuestions}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Score: {reviewData.percentage}%</p>
                <p className={`text-xs ${reviewData.passed ? 'text-green-600' : 'text-red-600'}`}>
                  {reviewData.passed ? 'Passed' : 'Failed'}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                reviewData.passed ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {reviewData.passed ? (
                  <Trophy className="w-6 h-6 text-green-600" />
                ) : (
                  <Target className="w-6 h-6 text-red-600" />
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="h-1 bg-gray-100">
          <div 
            className="h-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Score Summary Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-indigo-50 rounded-xl">
              <p className="text-2xl font-bold text-indigo-600">{reviewData.percentage}%</p>
              <p className="text-xs text-gray-600">Final Score</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-xl">
              <p className="text-2xl font-bold text-green-600">{reviewData.correctAnswers}</p>
              <p className="text-xs text-gray-600">Correct</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-xl">
              <p className="text-2xl font-bold text-red-600">
                {reviewData.totalQuestions - reviewData.correctAnswers}
              </p>
              <p className="text-xs text-gray-600">Incorrect</p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-xl">
              <p className="text-2xl font-bold text-amber-600">{reviewData.score}</p>
              <p className="text-xs text-gray-600">Points</p>
            </div>
          </div>
        </div>

        {/* Question Review Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Question Header */}
          <div className={`p-4 border-b ${isCorrect ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
            <div className="flex items-center gap-3">
              {isCorrect ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600" />
              )}
              <div>
                <p className={`font-medium ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                  {isCorrect ? 'Correct' : 'Incorrect'}
                </p>
                <p className="text-xs text-gray-500">
                  {userAnswer?.points_earned || 0} / {currentQuestion.points} points
                </p>
              </div>
              <span className="ml-auto px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-600">
                {currentQuestion.topic}
              </span>
            </div>
          </div>

          {/* Question Content */}
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              {currentQuestion.question_text}
            </h2>

            {/* Options */}
            {currentQuestion.options && currentQuestion.options.length > 0 && (
              <div className="space-y-3 mb-6">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = userAnswer?.answer === option.id || userAnswer?.answer === getOptionLabel(index);
                  const isCorrectOption = option.is_correct;
                  
                  let bgColor = 'bg-gray-50';
                  let borderColor = 'border-gray-200';
                  let icon = null;
                  
                  if (isCorrectOption) {
                    bgColor = 'bg-green-50';
                    borderColor = 'border-green-300';
                    icon = <CheckCircle className="w-5 h-5 text-green-600" />;
                  } else if (isSelected && !isCorrectOption) {
                    bgColor = 'bg-red-50';
                    borderColor = 'border-red-300';
                    icon = <XCircle className="w-5 h-5 text-red-600" />;
                  }
                  
                  return (
                    <div
                      key={option.id}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 ${bgColor} ${borderColor}`}
                    >
                      <span className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-medium text-sm text-gray-600">
                        {getOptionLabel(index)}
                      </span>
                      <span className="flex-1">{option.option_text}</span>
                      {icon}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Text Answer */}
            {currentQuestion.question_type === 'identification' && (
              <div className="space-y-3 mb-6">
                <div className={`p-4 rounded-xl border-2 ${
                  isCorrect ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
                }`}>
                  <p className="text-sm text-gray-600 mb-1">Your answer:</p>
                  <p className="font-medium">{userAnswer?.answer || 'No answer'}</p>
                </div>
                <div className="p-4 rounded-xl border-2 bg-green-50 border-green-300">
                  <p className="text-sm text-gray-600 mb-1">Correct answer:</p>
                  <p className="font-medium text-green-800">{currentQuestion.correct_answer}</p>
                </div>
              </div>
            )}

            {/* Explanation */}
            {currentQuestion.explanation && (
              <div className="mt-6">
                <button
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="flex items-center gap-2 text-indigo-600 font-medium hover:text-indigo-700"
                >
                  <Lightbulb className="w-5 h-5" />
                  {showExplanation ? 'Hide Explanation' : 'Show Explanation'}
                </button>
                
                {showExplanation && (
                  <div className="mt-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                    <p className="text-gray-700">{currentQuestion.explanation}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>
            
            <div className="flex gap-1">
              {reviewData.questions.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrentIndex(i); setShowExplanation(false); }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentIndex 
                      ? 'bg-indigo-600 w-6' 
                      : getUserAnswer(reviewData.questions[i].id)?.is_correct
                        ? 'bg-green-400'
                        : 'bg-red-400'
                  }`}
                />
              ))}
            </div>
            
            <button
              onClick={handleNext}
              disabled={currentIndex === reviewData.totalQuestions - 1}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <button
            onClick={handleRetry}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all"
          >
            <RotateCcw className="w-5 h-5" />
            Retake Quiz
          </button>
          <button
            onClick={() => navigate('/student/quizzes')}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
          >
            <BarChart3 className="w-5 h-5" />
            Back to Quizzes
          </button>
        </div>
      </main>
    </div>
  );
}
