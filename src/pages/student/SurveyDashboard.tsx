import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toaster';
import { SkeletonStat, SkeletonCard } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { 
  FileText, 
  MessageSquare, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  BarChart3,
  PieChart,
  Users,
  ArrowRight,
  Search,
  RefreshCw
} from 'lucide-react';

interface SurveyStats {
  totalSurveys: number;
  completedSurveys: number;
  pendingSurveys: number;
  totalResponses: number;
  responseRate: number;
}

interface SurveyItem {
  id: string;
  title: string;
  description: string | null;
  status: 'open' | 'closed';
  total_responses: number;
  hasCompleted: boolean;
  created_at: string;
}

export default function SurveyDashboard() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [stats, setStats] = useState<SurveyStats>({
    totalSurveys: 0,
    completedSurveys: 0,
    pendingSurveys: 0,
    totalResponses: 0,
    responseRate: 0,
  });
  const [surveys, setSurveys] = useState<SurveyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSurveyData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch all surveys
      const { data: surveysData, error: surveysError } = await supabase
        .from('surveys')
        .select('id, title, description, status, total_responses, created_at')
        .eq('mode', 'survey')
        .or('mode.is.null')
        .order('created_at', { ascending: false });

      if (surveysError) throw surveysError;

      // Get user ID for checking completion
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      // Check completion status for each survey
      const surveysWithStatus: SurveyItem[] = await Promise.all(
        (surveysData || []).map(async (survey) => {
          let hasCompleted = false;
          if (userId) {
            const { data: completed } = await supabase
              .rpc('has_user_completed_survey', {
                p_survey_id: survey.id,
                p_user_id: userId,
              });
            hasCompleted = !!completed;
          }
          return {
            ...survey,
            hasCompleted,
          };
        })
      );

      const totalResponses = surveysWithStatus.reduce((sum, s) => sum + s.total_responses, 0);
      const completedCount = surveysWithStatus.filter(s => s.hasCompleted).length;
      const openCount = surveysWithStatus.filter(s => s.status === 'open' && !s.hasCompleted).length;
      
      setStats({
        totalSurveys: surveysWithStatus.length,
        completedSurveys: completedCount,
        pendingSurveys: openCount,
        totalResponses,
        responseRate: surveysWithStatus.length > 0 
          ? Math.round((completedCount / surveysWithStatus.length) * 100) 
          : 0,
      });

      setSurveys(surveysWithStatus);
    } catch (error) {
      console.error('Error fetching survey data:', error);
      showToast('Failed to load survey data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSurveyData();
  }, [fetchSurveyData]);

  const filteredSurveys = surveys.filter(survey => {
    const matchesFilter = filter === 'all' 
      ? true 
      : filter === 'completed' 
        ? survey.hasCompleted 
        : filter === 'open'
          ? survey.status === 'open' && !survey.hasCompleted
          : true;
    
    const matchesSearch = searchQuery === '' || 
      survey.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (survey.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const handleStartSurvey = (surveyId: string) => {
    navigate(`/survey/${surveyId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-blue-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Survey Dashboard</h1>
                <p className="text-xs text-blue-600 font-medium">Share your feedback</p>
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
        {/* Stats Overview */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <SkeletonStat count={5} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-2xl border border-blue-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Surveys</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalSurveys}</p>
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
                  <p className="text-2xl font-bold text-gray-900">{stats.completedSurveys}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pendingSurveys}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-indigo-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Responses</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalResponses.toLocaleString()}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-purple-100 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Your Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.responseRate}%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-blue-100 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Completion Overview
            </h3>
            <div className="flex items-center justify-around py-4">
              <div className="text-center">
                <div className="w-32 h-32 rounded-full border-8 border-green-100 flex items-center justify-center mb-2">
                  <span className="text-2xl font-bold text-green-600">
                    {stats.completedSurveys}
                  </span>
                </div>
                <p className="text-sm text-gray-500">Completed</p>
              </div>
              <div className="text-center">
                <div className="w-32 h-32 rounded-full border-8 border-amber-100 flex items-center justify-center mb-2">
                  <span className="text-2xl font-bold text-amber-600">
                    {stats.pendingSurveys}
                  </span>
                </div>
                <p className="text-sm text-gray-500">Pending</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-indigo-100 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-600" />
              Survey Status
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-gray-900">Completed</span>
                </div>
                <span className="text-lg font-bold text-green-600">
                  {Math.round((stats.completedSurveys / Math.max(stats.totalSurveys, 1)) * 100)}%
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <span className="font-medium text-gray-900">Available</span>
                </div>
                <span className="text-lg font-bold text-amber-600">
                  {Math.round((stats.pendingSurveys / Math.max(stats.totalSurveys, 1)) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Survey List */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl font-bold text-gray-900">Available Surveys</h2>
              
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search surveys..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                  />
                </div>
                
                {/* Filter */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                  {(['all', 'open', 'completed'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        filter === f
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>

                <button
                  onClick={fetchSurveyData}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Survey Cards */}
          <div className="p-6">
            {loading ? (
              <div className="space-y-4">
                <SkeletonCard count={3} />
              </div>
            ) : filteredSurveys.length === 0 ? (
              <EmptyState
                type="search"
                title={searchQuery ? "No surveys found" : "No surveys available"}
                description={searchQuery 
                  ? "Try adjusting your search or filters" 
                  : "Check back later for new surveys"
                }
              />
            ) : (
              <div className="grid gap-4">
                {filteredSurveys.map((survey) => (
                  <div
                    key={survey.id}
                    className={`flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-xl border transition-all ${
                      survey.hasCompleted
                        ? 'bg-green-50 border-green-100'
                        : survey.status === 'open'
                          ? 'bg-white border-blue-100 hover:border-blue-300 hover:shadow-md'
                          : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{survey.title}</h3>
                        {survey.hasCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            Completed
                          </span>
                        ) : survey.status === 'open' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            <Clock className="w-3 h-3" />
                            Open
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                            Closed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {survey.description || 'No description available'}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {survey.total_responses} responses
                        </span>
                        <span>
                          Created {new Date(survey.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {!survey.hasCompleted && survey.status === 'open' ? (
                        <button
                          onClick={() => handleStartSurvey(survey.id)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm transition-all hover:bg-blue-700 active:scale-95"
                        >
                          Start Survey
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      ) : survey.hasCompleted ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-medium text-sm">Thank you!</span>
                        </div>
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
