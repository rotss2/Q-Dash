import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toaster';
import { LiveRoom } from '../../types/live';
import AdminOverviewCards from '../../components/admin/AdminOverviewCards';
import QuickActionGrid from '../../components/admin/QuickActionGrid';
import AdminActivityFeed from '../../components/admin/AdminActivityFeed';
import RecentSubmissionsPanel from '../../components/admin/RecentSubmissionsPanel';
import ActiveLiveRoomsPanel from '../../components/admin/ActiveLiveRoomsPanel';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { 
  LayoutDashboard, 
  Plus, 
  LogOut, 
  User,
  BarChart3,
  Radio,
  Library,
  Users
} from 'lucide-react';

interface DashboardStats {
  totalStudents: number;
  totalSurveys: number;
  totalQuizzes: number;
  totalExams: number;
  activeLiveRooms: number;
  totalResponses: number;
  averageScore: number;
  completionRate: number;
}

interface Submission {
  id: string;
  respondent_name: string;
  survey_title: string;
  mode: 'survey' | 'quiz' | 'exam';
  submitted_at: string;
  score?: number | null;
  percentage?: number | null;
}

export default function AdminCommandCenter() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { activities, loading: activitiesLoading } = useActivityFeed({ limit: 10 });
  
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalSurveys: 0,
    totalQuizzes: 0,
    totalExams: 0,
    activeLiveRooms: 0,
    totalResponses: 0,
    averageScore: 0,
    completionRate: 0,
  });
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [liveRooms, setLiveRooms] = useState<LiveRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'live'>('overview');

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch surveys with counts
      const { data: surveys, error: surveysError } = await supabase
        .from('surveys')
        .select('id, mode, status, total_responses');

      if (surveysError) throw surveysError;

      // Calculate stats
      const totalSurveys = surveys?.filter(s => s.mode === 'survey' || !s.mode).length || 0;
      const totalQuizzes = surveys?.filter(s => s.mode === 'quiz').length || 0;
      const totalExams = surveys?.filter(s => s.mode === 'exam').length || 0;
      const totalResponses = surveys?.reduce((sum, s) => sum + (s.total_responses || 0), 0) || 0;

      // Fetch active live rooms
      const { data: rooms, error: roomsError } = await supabase
        .from('live_rooms')
        .select('*, quiz:surveys(id, title, mode)')
        .in('status', ['waiting', 'active']);

      if (roomsError) throw roomsError;

      // Fetch recent submissions from survey_sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('survey_sessions')
        .select('*, survey:surveys(id, title, mode)')
        .order('completed_at', { ascending: false })
        .limit(10);

      if (sessionsError) throw sessionsError;

      const recentSubmissions: Submission[] = (sessions || []).map(session => ({
        id: session.id,
        respondent_name: session.email || 'Anonymous',
        survey_title: session.survey?.title || 'Untitled',
        mode: session.survey?.mode || 'survey',
        submitted_at: session.completed_at,
      }));

      // Calculate average score from quiz results
      let avgScore = 0;
      try {
        const { data: results } = await supabase
          .from('quiz_exam_results')
          .select<'percentage,score,total_points', { percentage: number | null; score: number; total_points: number }>('percentage,score,total_points');
        
        if (results && results.length > 0) {
          const validResults = results.filter((r): r is typeof r & { percentage: number } => r.percentage !== null);
          if (validResults.length > 0) {
            avgScore = Math.round(validResults.reduce((sum, r) => sum + r.percentage, 0) / validResults.length);
          }
        }
      } catch {
        // Table might not exist yet, ignore
        avgScore = 0;
      }

      setStats({
        totalStudents: sessions?.length || 0, // Approximation
        totalSurveys,
        totalQuizzes,
        totalExams,
        activeLiveRooms: rooms?.length || 0,
        totalResponses,
        averageScore: avgScore,
        completionRate: 85, // Placeholder - would calculate from actual data
      });

      setSubmissions(recentSubmissions);
      // Cast rooms to LiveRoom type, handling status as string from database
      setLiveRooms((rooms || []).map(room => ({
        ...room,
        status: room.status as import('../../types/live').LiveRoomStatus,
      })) as LiveRoom[]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      showToast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const quickActions = {
    onCreateSurvey: () => navigate('/admin/surveys/new'),
    onCreateQuiz: () => navigate('/admin/surveys/new?mode=quiz'),
    onCreateExam: () => navigate('/admin/surveys/new?mode=exam'),
    onOpenQuestionBank: () => navigate('/admin/question-bank'),
    onStartLiveBattle: () => navigate('/admin/live/create'),
    onViewAnalytics: () => navigate('/admin/analytics'),
    onImportQuestions: () => navigate('/admin/question-bank?import=true'),
    onManageStudents: () => navigate('/admin/students'),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="Q-Dash" 
                className="h-16 w-auto object-contain drop-shadow-md"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-gray-900">Q-Dash</h1>
                <p className="text-xs text-gray-500">Admin Command Center</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Navigation Tabs */}
              <nav className="hidden sm:flex items-center bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'overview'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('live')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'live'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Radio className={`w-4 h-4 ${activeTab === 'live' ? 'text-red-500 animate-pulse' : ''}`} />
                  Live
                </button>
              </nav>

              {/* User Menu */}
              <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <span className="hidden lg:block text-sm font-medium text-gray-700">{user?.email}</span>
                </div>
                <button 
                  onClick={handleSignOut} 
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <LoadingSkeleton.Page />
        ) : (
          <div className="space-y-8">
            {/* Welcome Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Welcome back, Admin</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Manage your learning platform, track progress, and engage students.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/admin/surveys/new')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-medium text-sm transition-all hover:bg-slate-800 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Create New
                </button>
              </div>
            </div>

            {/* Overview Cards */}
            <AdminOverviewCards stats={stats} loading={loading} />

            {/* Quick Actions */}
            <QuickActionGrid {...quickActions} />

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Activity Feed */}
              <div className="lg:col-span-1">
                <AdminActivityFeed 
                  activities={activities} 
                  loading={activitiesLoading}
                  maxItems={10}
                />
              </div>

              {/* Recent Submissions */}
              <div className="lg:col-span-1">
                <RecentSubmissionsPanel 
                  submissions={submissions}
                  loading={loading}
                  onViewAll={() => navigate('/admin/responses/all')}
                />
              </div>

              {/* Active Live Rooms */}
              <div className="lg:col-span-1">
                <ActiveLiveRoomsPanel 
                  rooms={liveRooms}
                  loading={loading}
                  onViewAll={() => navigate('/admin/live')}
                  onJoinRoom={(code) => navigate(`/admin/live/${code}`)}
                />
              </div>
            </div>

            {/* Bottom Section - Additional Links */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <button
                onClick={() => navigate('/admin/surveys/all')}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-left"
              >
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <LayoutDashboard className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">All Surveys</p>
                  <p className="text-xs text-gray-500">Manage content</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/admin/analytics')}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all text-left"
              >
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Analytics</p>
                  <p className="text-xs text-gray-500">Deep insights</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/admin/question-bank')}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all text-left"
              >
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <Library className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Question Bank</p>
                  <p className="text-xs text-gray-500">Manage questions</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/admin/students')}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-emerald-300 hover:shadow-sm transition-all text-left"
              >
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Students</p>
                  <p className="text-xs text-gray-500">Manage learners</p>
                </div>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
