import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toaster';
import LiveBoard from '../../components/admin/LiveBoard';
import { apiGet, apiDelete, apiPost } from '../../lib/api';
import { Survey } from '../../types';
import { Plus, BarChart3, Edit2, Trash2, Copy, LogOut, Users, FileText, Radio, Activity, Sparkles, Calendar, ArrowUpRight, Loader2, User, Search, Clock, LayoutDashboard } from 'lucide-react';

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'live'>('overview');

  useEffect(() => {
    loadSurveys();
    
    // Refresh when window regains focus (user returns from create page)
    const handleFocus = () => {
      console.log('Dashboard: Window focused, refreshing surveys...');
      loadSurveys();
    };
    
    window.addEventListener('focus', handleFocus);
    
    // Poll every 10 seconds to update response counts in real-time
    const pollInterval = setInterval(() => {
      console.log('Dashboard: Polling for updates...');
      loadSurveys();
    }, 10000);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(pollInterval);
    };
  }, []);

  // (Live tracking now handled via Live Board tab)

  const loadSurveys = async () => {
    console.log('Dashboard: Loading surveys...');
    // Add cache-busting timestamp to force fresh data
    const timestamp = new Date().getTime();
    const response = await apiGet<{ surveys: Survey[] }>(`/api/admin/surveys?_t=${timestamp}`);
    console.log('Dashboard: API response:', response);

    if (response.error) {
      console.error('Dashboard: Error loading surveys:', response.error);
      showToast(response.error, 'error');
      setIsLoading(false);
      return;
    }

    const surveyCount = response.data?.surveys?.length || 0;
    console.log(`Dashboard: Loaded ${surveyCount} surveys`);
    setSurveys(response.data?.surveys || []);
    setLastUpdated(new Date());
    setIsLoading(false);
  };

  const deleteSurvey = async (surveyId: string) => {
    if (!confirm('Are you sure you want to delete this survey? This action cannot be undone.')) {
      return;
    }

    console.log('Dashboard: Deleting survey', surveyId);
    
    // Optimistically remove from UI immediately
    setSurveys(prev => prev.filter(s => s.id !== surveyId));

    const response = await apiDelete<{ success: boolean }>(`/api/admin/surveys/${surveyId}`);
    console.log('Dashboard: Delete response', response);

    if (response.error) {
      showToast('Failed to delete: ' + response.error, 'error');
      // Re-fetch to restore correct state
      await loadSurveys();
    } else if (response.data?.success) {
      showToast('Survey deleted successfully', 'success');
      // UI already updated, just verify with server
      setTimeout(() => loadSurveys(), 500);
    } else {
      showToast('Survey deleted', 'success');
      setTimeout(() => loadSurveys(), 500);
    }
  };

  const toggleStatus = async (survey: Survey) => {
    const newStatus = survey.status === 'open' ? 'closed' : 'open';

    // Optimistically update UI
    setSurveys(prev => prev.map(s => s.id === survey.id ? { ...s, status: newStatus } : s));

    const response = await apiPost<{ success: boolean }>(`/api/admin/surveys/${survey.id}/status`, { status: newStatus });

    if (response.error) {
      showToast(response.error, 'error');
      await loadSurveys();
    } else {
      showToast(`Survey ${newStatus === 'open' ? 'opened' : 'closed'}`, 'success');
      setTimeout(() => loadSurveys(), 500);
    }
  };

  const copySurveyLink = (surveyId: string) => {
    const link = `${window.location.origin}/survey/${surveyId}`;
    navigator.clipboard.writeText(link);
    showToast('Survey link copied to clipboard', 'success');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const totalResponses = surveys.reduce((sum, s) => sum + s.total_responses, 0);
  const openSurveys = surveys.filter(s => s.status === 'open').length;

  // Filter surveys based on search query
  const filteredSurveys = surveys.filter(survey => 
    searchQuery === '' || 
    survey.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (survey.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Enhanced */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* SurveyTest Logo - Responsive */}
              <div className="flex items-center gap-2 sm:gap-3">
                <img 
                  src="/logo.png" 
                  alt="SurveyTest" 
                  className="h-16 sm:h-20 md:h-24 w-auto object-contain drop-shadow-md hover:scale-105 transition-transform"
                  onError={(e) => {
                    // Fallback if logo.png doesn't exist
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="hidden sm:block">
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900">SurveyTest</h1>
                  <p className="text-xs text-gray-500">Smart Data Insights</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Tabs */}
              <div className="hidden sm:flex items-center bg-gray-100 rounded-xl p-1 mr-2">
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
                  Live Board
                </button>
              </div>
              
              {/* Mobile tabs dropdown */}
              <div className="sm:hidden">
                <select
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value as 'overview' | 'live')}
                  className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-700 border-0 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="overview">Overview</option>
                  <option value="live">Live Board</option>
                </select>
              </div>
              
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
        {activeTab === 'live' ? (
          <LiveBoard surveys={surveys} />
        ) : (
          <div className="space-y-8">
            {/* Stats - Mobile-first responsive grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <button
            onClick={() => navigate('/admin/surveys/all')}
            className="relative overflow-hidden bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 transition-all hover:shadow-lg hover:-translate-y-1 text-left cursor-pointer group active:scale-95"
          >
            <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-gradient-to-br from-blue-50 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 flex-shrink-0">
                <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-500 mb-0.5">Total Surveys</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{surveys.length}</p>
              </div>
            </div>
            <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4">
              <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/responses/all')}
            className="relative overflow-hidden bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 transition-all hover:shadow-lg hover:-translate-y-1 text-left cursor-pointer group active:scale-95"
          >
            <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-gradient-to-br from-emerald-50 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 flex-shrink-0">
                <Users className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-500 mb-0.5">Total Responses</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{totalResponses}</p>
              </div>
            </div>
            <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4">
              <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </div>
          </button>

          <div className="relative overflow-hidden bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 transition-all hover:shadow-lg hover:-translate-y-1 sm:col-span-2 lg:col-span-1">
            <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-gradient-to-br from-violet-50 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-200 flex-shrink-0">
                <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-500 mb-0.5">Open Surveys</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{openSurveys}</p>
              </div>
            </div>
            <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4">
              <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-violet-400" />
            </div>
          </div>
        </div>

            {/* Search Bar - NEW */}
            {surveys.length > 0 && (
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search surveys by title or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        )}

            {/* Actions - Enhanced */}
            <div className="flex flex-col gap-3 justify-between items-start md:flex-row md:items-center">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900">Your Surveys</h2>
            {surveys.length > 0 && (
              <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
                {filteredSurveys.length} of {surveys.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {lastUpdated && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <>
              <button
                onClick={() => loadSurveys()}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium transition-all hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed group"
                title="Refresh survey list"
              >
                <Loader2 className={`w-4 h-4 transition-transform duration-700 ${isLoading ? 'animate-spin' : 'group-hover:rotate-180'}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={() => navigate('/admin/surveys/new')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-medium transition-all hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-200"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Survey</span>
              </button>
            </>
          </div>
        </div>

            {/* Surveys List - Enhanced */}
            {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="h-5 bg-gray-200 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="flex gap-4">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                      <div className="h-4 bg-gray-200 rounded w-24" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                    <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                    <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : surveys.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Create your first survey</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">Start collecting valuable feedback and insights from your audience in minutes.</p>
            <button
              onClick={() => navigate('/admin/surveys/new')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-medium transition-all hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-200"
            >
              <Plus className="w-5 h-5" />
              Create Survey
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredSurveys.map((survey) => (
              <div key={survey.id} className="group bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 transition-all hover:shadow-xl hover:-translate-y-0.5 hover:border-gray-200">
                {/* Mobile: Stack vertically, Desktop: Horizontal */}
                <div className="flex flex-col gap-4">
                  {/* Top row: Title, status, and mobile menu */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-slate-700 transition-colors">{survey.title}</h3>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                          survey.status === 'open'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-gray-50 text-gray-600 border border-gray-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${survey.status === 'open' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                          {survey.status === 'open' ? 'Open' : 'Closed'}
                        </span>
                      </div>
                      <p className="text-gray-500 text-sm mb-3 line-clamp-1">{survey.description || 'No description'}</p>
                      
                      {/* Stats row */}
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <Users className="w-4 h-4 text-blue-600" />
                          <span className="font-medium">{survey.total_responses} responses</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-gray-400">
                          <Calendar className="w-4 h-4" />
                          {new Date(survey.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    
                    {/* Mobile: Simple action dropdown or stacked buttons */}
                    <div className="sm:hidden">
                      <button
                        onClick={() => navigate(`/admin/surveys/${survey.id}/analytics`)}
                        className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="View analytics"
                      >
                        <BarChart3 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Actions row - Mobile: full width buttons, Desktop: icon buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-1 sm:justify-end pt-3 border-t border-gray-100">
                    {/* Mobile: Full width action buttons */}
                    <div className="grid grid-cols-2 gap-2 sm:hidden">
                      <button
                        onClick={() => copySurveyLink(survey.id)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium transition-all hover:bg-gray-200 active:scale-95"
                      >
                        <Copy className="w-4 h-4" />
                        Copy Link
                      </button>
                      <button
                        onClick={() => navigate(`/admin/surveys/${survey.id}/edit`)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium transition-all hover:bg-gray-200 active:scale-95"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => toggleStatus(survey)}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all active:scale-95 ${
                          survey.status === 'open'
                            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        }`}
                      >
                        {survey.status === 'open' ? 'Close Survey' : 'Open Survey'}
                      </button>
                      <button
                        onClick={() => deleteSurvey(survey.id)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl font-medium transition-all hover:bg-red-100 active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                    
                    {/* Desktop: Compact icon buttons */}
                    <div className="hidden sm:flex items-center gap-1">
                      <button
                        onClick={() => copySurveyLink(survey.id)}
                        className="p-2.5 text-gray-400 hover:text-slate-600 hover:bg-gray-50 rounded-xl transition-all"
                        title="Copy survey link"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => navigate(`/admin/surveys/${survey.id}/analytics`)}
                        className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="View analytics"
                      >
                        <BarChart3 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => navigate(`/admin/surveys/${survey.id}/edit`)}
                        className="p-2.5 text-gray-400 hover:text-slate-600 hover:bg-gray-50 rounded-xl transition-all"
                        title="Edit survey"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => toggleStatus(survey)}
                        className={`px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                          survey.status === 'open'
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        }`}
                      >
                        {survey.status === 'open' ? 'Close' : 'Open'}
                      </button>
                      <button
                        onClick={() => deleteSurvey(survey.id)}
                        className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Delete survey"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
          </div>
        )}
      </main>
    </div>
  );
}
