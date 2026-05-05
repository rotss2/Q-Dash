import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toaster';
import { SkeletonStat, SkeletonCard } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { 
  CheckSquare, 
  Target, 
  Zap, 
  Trophy,
  Star,
  TrendingUp,
  Clock,
  ArrowRight,
  Search,
  RefreshCw,
  Award,
  Play,
  BarChart3,
  BookOpen,
  Target as TargetIcon
} from 'lucide-react';

interface QuizStats {
  totalQuizzes: number;
  completedQuizzes: number;
  availableQuizzes: number;
  averageScore: number;
  totalXP: number;
  currentRank: number;
  strongestTopic: string;
  weakestTopic: string;
}

interface QuizItem {
  id: string;
  title: string;
  description: string | null;
  status: 'open' | 'closed';
  total_responses: number;
  hasCompleted: boolean;
  score?: number | null;
  passing_score?: number | null;
  time_limit_minutes?: number | null;
  created_at: string;
}

export default function QuizDashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [stats, setStats] = useState<QuizStats>({
    totalQuizzes: 0,
    completedQuizzes: 0,
    availableQuizzes: 0,
    averageScore: 0,
    totalXP: 1250, // Placeholder - would fetch from profile
    currentRank: 42, // Placeholder
    strongestTopic: 'DTFT Properties',
    weakestTopic: 'Frequency Shifting',
  });
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchQuizData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch all quizzes
      const { data: quizzesData, error: quizzesError } = await supabase
        .from('surveys')
        .select('id, title, description, status, total_responses, passing_score, time_limit_minutes, created_at')
        .eq('mode', 'quiz')
        .order('created_at', { ascending: false });

      if (quizzesError) throw quizzesError;

      // Get user ID for checking completion
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      // Check completion status and fetch scores
      const quizzesWithStatus: QuizItem[] = await Promise.all(
        (quizzesData || []).map(async (quiz) => {
          let hasCompleted = false;
          let score = null;
          
          if (userId) {
            // Check if completed via survey_sessions
            const { data: completed } = await supabase
              .rpc('has_user_completed_survey', {
                p_survey_id: quiz.id,
                p_user_id: userId,
              });
            hasCompleted = !!completed;
            
            // Try to get score from quiz results
            if (hasCompleted) {
              try {
                const { data: result } = await supabase
                  .from('quiz_exam_results')
                  .select('percentage')
                  .eq('survey_id', quiz.id)
                  .eq('user_id', userId)
                  .single();
                score = result?.percentage || null;
              } catch {
                score = null;
              }
            }
          }
          
          return {
            ...quiz,
            hasCompleted,
            score,
          };
        })
      );

      const completedCount = quizzesWithStatus.filter(q => q.hasCompleted).length;
      const availableCount = quizzesWithStatus.filter(q => q.status === 'open' && !q.hasCompleted).length;
      
      // Calculate average score
      const completedQuizzes = quizzesWithStatus.filter(q => q.score !== null && q.score !== undefined);
      const avgScore = completedQuizzes.length > 0
        ? Math.round(completedQuizzes.reduce((sum, q) => sum + (q.score || 0), 0) / completedQuizzes.length)
        : 0;

      setStats(prev => ({
        ...prev,
        totalQuizzes: quizzesWithStatus.length,
        completedQuizzes: completedCount,
        availableQuizzes: availableCount,
        averageScore: avgScore,
      }));

      setQuizzes(quizzesWithStatus);
    } catch (error) {
      console.error('Error fetching quiz data:', error);
      showToast('Failed to load quiz data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchQuizData();
  }, [fetchQuizData]);

  const filteredQuizzes = quizzes.filter(quiz => 
    searchQuery === '' || 
    quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (quiz.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartQuiz = (quizId: string) => {
    navigate(`/survey/${quizId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-emerald-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <CheckSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Quiz Dashboard</h1>
                <p className="text-xs text-emerald-600 font-medium">Practice & Learn</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/student')}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              Back to Home
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* XP and Rank Banner */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white mb-8 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-emerald-100 text-sm">Your Progress</p>
                <p className="text-3xl font-bold">{stats.totalXP.toLocaleString()} XP</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-emerald-100 text-xs">Current Rank</p>
                <p className="text-2xl font-bold">#{stats.currentRank}</p>
              </div>
              <div className="h-12 w-px bg-white/20" />
              <div className="text-center">
                <p className="text-emerald-100 text-xs">Next Level</p>
                <div className="w-24 h-2 bg-white/20 rounded-full mt-1">
                  <div className="w-3/4 h-full bg-white rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <SkeletonStat count={4} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <Target className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Quizzes</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalQuizzes}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-green-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                  <CheckSquare className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.completedQuizzes}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-blue-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg Score</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.averageScore}%</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                  <Play className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Available</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.availableQuizzes}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Topic Mastery & Badges */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              Topic Mastery
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-gray-900">Strongest Topic</span>
                </div>
                <p className="text-green-700 font-semibold">{stats.strongestTopic}</p>
                <div className="mt-2 w-full bg-green-200 rounded-full h-2">
                  <div className="w-[85%] h-full bg-green-500 rounded-full" />
                </div>
                <p className="text-xs text-green-600 mt-1">85% mastery</p>
              </div>
              
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                <div className="flex items-center gap-2 mb-2">
                  <TargetIcon className="w-5 h-5 text-amber-600" />
                  <span className="font-medium text-gray-900">Needs Practice</span>
                </div>
                <p className="text-amber-700 font-semibold">{stats.weakestTopic}</p>
                <div className="mt-2 w-full bg-amber-200 rounded-full h-2">
                  <div className="w-[45%] h-full bg-amber-500 rounded-full" />
                </div>
                <p className="text-xs text-amber-600 mt-1">45% mastery - Keep practicing!</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-amber-100 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              Recent Achievements
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-4 bg-amber-50 rounded-xl">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Trophy className="w-6 h-6 text-amber-600" />
                </div>
                <p className="text-xs font-medium text-gray-700">First Quiz</p>
                <p className="text-xs text-gray-500">Completed</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-xl">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-xs font-medium text-gray-700">Quick Thinker</p>
                <p className="text-xs text-gray-500">Fast answer</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-xl">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <p className="text-xs font-medium text-gray-700">Improving</p>
                <p className="text-xs text-gray-500">+15% avg</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quiz List */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl font-bold text-gray-900">Available Quizzes</h2>
              
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search quizzes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-64"
                  />
                </div>
                <button
                  onClick={fetchQuizData}
                  className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="space-y-4">
                <SkeletonCard count={3} />
              </div>
            ) : filteredQuizzes.length === 0 ? (
              <EmptyState
                type="search"
                title={searchQuery ? "No quizzes found" : "No quizzes available"}
                description={searchQuery 
                  ? "Try adjusting your search" 
                  : "Check back later for new quizzes"
                }
              />
            ) : (
              <div className="grid gap-4">
                {filteredQuizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className={`flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-xl border transition-all ${
                      quiz.hasCompleted
                        ? 'bg-green-50 border-green-100'
                        : quiz.status === 'open'
                          ? 'bg-white border-emerald-100 hover:border-emerald-300 hover:shadow-md'
                          : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{quiz.title}</h3>
                        {quiz.hasCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            <CheckSquare className="w-3 h-3" />
                            {quiz.score}% Score
                          </span>
                        ) : quiz.status === 'open' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                            <Play className="w-3 h-3" />
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                            Closed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {quiz.description || 'Test your knowledge with this practice quiz'}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                        {quiz.time_limit_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {quiz.time_limit_minutes} min
                          </span>
                        )}
                        {quiz.passing_score && (
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            Pass: {quiz.passing_score}%
                          </span>
                        )}
                        <span>
                          {quiz.total_responses} attempts
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {!quiz.hasCompleted && quiz.status === 'open' ? (
                        <button
                          onClick={() => handleStartQuiz(quiz.id)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium text-sm transition-all hover:bg-emerald-700 active:scale-95"
                        >
                          Start Quiz
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      ) : quiz.hasCompleted ? (
                        <button
                          onClick={() => handleStartQuiz(quiz.id)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-100 text-green-700 rounded-xl font-medium text-sm transition-all hover:bg-green-200"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Retry
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm">Unavailable</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
