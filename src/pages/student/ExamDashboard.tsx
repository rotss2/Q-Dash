import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toaster';
import { SkeletonStat, SkeletonCard } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { 
  GraduationCap, 
  Clock, 
  AlertCircle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Calendar,
  ArrowRight,
  Search,
  RefreshCw,
  Shield,
  FileCheck,
  Timer,
  Lock,
  AlertTriangle
} from 'lucide-react';

interface ExamStats {
  totalExams: number;
  completedExams: number;
  upcomingExams: number;
  averageScore: number;
  passRate: number;
  totalTimeSpent: number; // in minutes
}

interface ExamItem {
  id: string;
  title: string;
  description: string | null;
  status: 'open' | 'closed';
  total_responses: number;
  hasCompleted: boolean;
  score?: number | null;
  passed?: boolean | null;
  passing_score?: number | null;
  time_limit_minutes?: number | null;
  open_date?: string | null;
  close_date?: string | null;
  max_attempts?: number | null;
  attemptCount?: number;
  created_at: string;
}

export default function ExamDashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [stats, setStats] = useState<ExamStats>({
    totalExams: 0,
    completedExams: 0,
    upcomingExams: 0,
    averageScore: 0,
    passRate: 0,
    totalTimeSpent: 0,
  });
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'upcoming'>('all');

  const fetchExamData = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: examsData, error: examsError } = await supabase
        .from('surveys')
        .select('id, title, description, status, total_responses, passing_score, time_limit_minutes, open_date, close_date, max_attempts, created_at')
        .eq('mode', 'exam')
        .order('created_at', { ascending: false });

      if (examsError) throw examsError;

      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      const examsWithStatus: ExamItem[] = await Promise.all(
        (examsData || []).map(async (exam) => {
          let hasCompleted = false;
          let score = null;
          let passed = null;
          let attemptCount = 0;
          
          if (userId) {
            const { data: completed } = await supabase
              .rpc('has_user_completed_survey', {
                p_survey_id: exam.id,
                p_user_id: userId,
              });
            hasCompleted = !!completed;
            
            if (hasCompleted) {
              try {
                const { data: result } = await supabase
                  .from('quiz_exam_results')
                  .select('percentage, passed')
                  .eq('survey_id', exam.id)
                  .eq('user_id', userId)
                  .single();
                score = result?.percentage || null;
                passed = result?.passed || null;
              } catch {
                score = null;
                passed = null;
              }
            }

            // Count attempts from live sessions
            try {
              const { data: sessions } = await supabase
                .from('survey_live_sessions')
                .select('id')
                .eq('survey_id', exam.id)
                .eq('user_id', userId);
              attemptCount = sessions?.length || 0;
            } catch {
              attemptCount = 0;
            }
          }
          
          return {
            ...exam,
            hasCompleted,
            score,
            passed,
            attemptCount,
          };
        })
      );

      const now = new Date();
      const completedCount = examsWithStatus.filter(e => e.hasCompleted).length;
      const upcomingCount = examsWithStatus.filter(e => {
        if (e.open_date && new Date(e.open_date) > now) return true;
        return false;
      }).length;
      
      const completedExams = examsWithStatus.filter(e => e.score !== null && e.score !== undefined);
      const avgScore = completedExams.length > 0
        ? Math.round(completedExams.reduce((sum, e) => sum + (e.score || 0), 0) / completedExams.length)
        : 0;
      
      const passedCount = examsWithStatus.filter(e => e.passed === true).length;
      const passRate = completedCount > 0 ? Math.round((passedCount / completedCount) * 100) : 0;

      setStats({
        totalExams: examsWithStatus.length,
        completedExams: completedCount,
        upcomingExams: upcomingCount,
        averageScore: avgScore,
        passRate,
        totalTimeSpent: 0, // Would calculate from session data
      });

      setExams(examsWithStatus);
    } catch (error) {
      console.error('Error fetching exam data:', error);
      showToast('Failed to load exam data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchExamData();
  }, [fetchExamData]);

  const now = new Date();
  
  const filteredExams = exams.filter(exam => {
    const matchesSearch = searchQuery === '' || 
      exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exam.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesFilter = true;
    if (filter === 'completed') matchesFilter = exam.hasCompleted;
    else if (filter === 'active') matchesFilter = exam.status === 'open' && !exam.hasCompleted;
    else if (filter === 'upcoming') matchesFilter = !!(exam.open_date && new Date(exam.open_date) > now);
    
    return matchesSearch && matchesFilter;
  });

  const handleStartExam = (examId: string) => {
    // Show confirmation for exams
    if (confirm('Starting an exam will begin the timer. Make sure you have enough time to complete it. Continue?')) {
      navigate(`/survey/${examId}`);
    }
  };

  const formatTimeRemaining = (closeDate: string | null): string => {
    if (!closeDate) return 'No deadline';
    const end = new Date(closeDate);
    const diff = end.getTime() - now.getTime();
    if (diff <= 0) return 'Closed';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days} days left`;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return `${hours} hours left`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-orange-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Exam Dashboard</h1>
                <p className="text-xs text-orange-600 font-medium">Formal Assessment Center</p>
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
        {/* Security Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-8 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-900">Important Notice</p>
            <p className="text-sm text-amber-700">
              Exams are formal assessments. Once started, the timer cannot be paused. 
              Ensure you have a stable internet connection and sufficient time before beginning.
            </p>
          </div>
        </div>

        {/* Stats Overview */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <SkeletonStat count={5} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-2xl border border-orange-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Exams</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalExams}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-green-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.completedExams}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-blue-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Upcoming</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.upcomingExams}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-purple-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg Score</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.averageScore}%</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pass Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.passRate}%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Exam List */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl font-bold text-gray-900">Exams</h2>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search exams..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 w-full sm:w-64"
                  />
                </div>
                
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                  {(['all', 'active', 'completed', 'upcoming'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        filter === f
                          ? 'bg-white text-orange-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>

                <button
                  onClick={fetchExamData}
                  className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
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
            ) : filteredExams.length === 0 ? (
              <EmptyState
                type="search"
                title={searchQuery ? "No exams found" : "No exams available"}
                description={searchQuery 
                  ? "Try adjusting your search or filters" 
                  : "Check back later for scheduled exams"
                }
              />
            ) : (
              <div className="grid gap-4">
                {filteredExams.map((exam) => (
                  <div
                    key={exam.id}
                    className={`flex flex-col lg:flex-row lg:items-center gap-4 p-5 rounded-xl border transition-all ${
                      exam.hasCompleted
                        ? exam.passed 
                          ? 'bg-green-50 border-green-100'
                          : 'bg-red-50 border-red-100'
                        : exam.open_date && new Date(exam.open_date) > now
                          ? 'bg-blue-50 border-blue-100'
                          : exam.status === 'open'
                            ? 'bg-white border-orange-100 hover:border-orange-300 hover:shadow-md'
                            : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{exam.title}</h3>
                        {exam.hasCompleted ? (
                          exam.passed ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              <CheckCircle className="w-3 h-3" />
                              Passed {exam.score}%
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                              <XCircle className="w-3 h-3" />
                              Failed {exam.score}%
                            </span>
                          )
                        ) : exam.open_date && new Date(exam.open_date) > now ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            <Calendar className="w-3 h-3" />
                            Opens {new Date(exam.open_date).toLocaleDateString()}
                          </span>
                        ) : exam.status === 'open' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                            <Timer className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                            Closed
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {exam.description || 'Formal assessment with time limit'}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
                        {exam.time_limit_minutes && (
                          <span className="flex items-center gap-1 text-gray-500">
                            <Clock className="w-3 h-3" />
                            {exam.time_limit_minutes} minutes
                          </span>
                        )}
                        {exam.passing_score && (
                          <span className="flex items-center gap-1 text-gray-500">
                            <FileCheck className="w-3 h-3" />
                            Pass: {exam.passing_score}%
                          </span>
                        )}
                        {exam.max_attempts && (
                          <span className="flex items-center gap-1 text-gray-500">
                            <RefreshCw className="w-3 h-3" />
                            {exam.attemptCount || 0}/{exam.max_attempts} attempts
                          </span>
                        )}
                        {exam.close_date && (
                          <span className={`flex items-center gap-1 ${
                            new Date(exam.close_date) < now ? 'text-red-500' : 'text-orange-600'
                          }`}>
                            <AlertCircle className="w-3 h-3" />
                            {formatTimeRemaining(exam.close_date)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {exam.open_date && new Date(exam.open_date) > now ? (
                        <div className="flex items-center gap-2 text-blue-600 text-sm">
                          <Lock className="w-4 h-4" />
                          <span>Locked</span>
                        </div>
                      ) : exam.hasCompleted ? (
                        <div className={`flex items-center gap-2 ${exam.passed ? 'text-green-600' : 'text-red-600'}`}>
                          {exam.passed ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : (
                            <XCircle className="w-5 h-5" />
                          )}
                          <span className="font-medium text-sm">
                            {exam.passed ? 'Passed' : 'Failed'}
                          </span>
                        </div>
                      ) : exam.status === 'open' ? (
                        <button
                          onClick={() => handleStartExam(exam.id)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 text-white rounded-xl font-medium text-sm transition-all hover:bg-orange-700 active:scale-95"
                        >
                          <Shield className="w-4 h-4" />
                          Start Exam
                          <ArrowRight className="w-4 h-4" />
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
