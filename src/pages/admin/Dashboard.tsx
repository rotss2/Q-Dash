import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toaster';
import LiveBoard from '../../components/admin/LiveBoard';
import { apiGet, apiDelete, apiPost } from '../../lib/api';
import { Survey } from '../../types';
import { Plus, BarChart3, Edit2, Trash2, Copy, LogOut, Users, FileText, Radio, Activity, Calendar, Loader2, User, Search, LayoutDashboard, MoreVertical, ChevronDown, GraduationCap, HelpCircle, CheckSquare, X } from 'lucide-react';

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'live'>('overview');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [modeFilter, setModeFilter] = useState<'all' | 'survey' | 'quiz' | 'exam'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');

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

  // Filter surveys based on search query, mode, and status
  const filteredSurveys = surveys.filter(survey => {
    const matchesSearch = searchQuery === '' || 
      survey.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (survey.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMode = modeFilter === 'all' || survey.mode === modeFilter;
    const matchesStatus = statusFilter === 'all' || survey.status === statusFilter;
    return matchesSearch && matchesMode && matchesStatus;
  });

  // Calculate counts by mode
  const surveyCount = surveys.filter(s => s.mode === 'survey' || !s.mode).length;
  const quizCount = surveys.filter(s => s.mode === 'quiz').length;
  const examCount = surveys.filter(s => s.mode === 'exam').length;


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
                  Live Board
                </button>
              </nav>
              
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
            {/* Summary Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {/* Total Surveys */}
              <div className="col-span-2 sm:col-span-1 bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 bg-slate-100 rounded-xl flex items-center justify-center">
                    <FileText className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Total</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{surveys.length}</p>
                  </div>
                </div>
              </div>

              {/* Surveys */}
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 bg-blue-50 rounded-xl flex items-center justify-center">
                    <HelpCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Surveys</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{surveyCount}</p>
                  </div>
                </div>
              </div>

              {/* Quizzes */}
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 bg-green-50 rounded-xl flex items-center justify-center">
                    <CheckSquare className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Quizzes</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{quizCount}</p>
                  </div>
                </div>
              </div>

              {/* Exams */}
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 bg-purple-50 rounded-xl flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Exams</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{examCount}</p>
                  </div>
                </div>
              </div>

              {/* Responses */}
              <div className="col-span-2 sm:col-span-1 bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Responses</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalResponses}</p>
                  </div>
                </div>
              </div>

              {/* Open */}
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 bg-amber-50 rounded-xl flex items-center justify-center">
                    <Activity className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Open</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{openSurveys}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Page Title */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-1">Manage your surveys, quizzes, exams, and responses.</p>
              </div>
              
              {/* Create Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 h-11 bg-slate-900 text-white rounded-xl font-medium transition-all hover:bg-slate-800"
                >
                  <Plus className="w-4 h-4" />
                  Create New
                  <ChevronDown className={`w-4 h-4 transition-transform ${showCreateDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showCreateDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowCreateDropdown(false)} />
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-2">
                      <button
                        onClick={() => { navigate('/admin/surveys/new'); setShowCreateDropdown(false); }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-3"
                      >
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <HelpCircle className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">Survey</p>
                          <p className="text-xs text-gray-500">Collect feedback and research responses</p>
                        </div>
                      </button>
                      <button
                        onClick={() => { navigate('/admin/surveys/new?mode=quiz'); setShowCreateDropdown(false); }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-3"
                      >
                        <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <CheckSquare className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">Quiz</p>
                          <p className="text-xs text-gray-500">Create scored practice quizzes</p>
                        </div>
                      </button>
                      <button
                        onClick={() => { navigate('/admin/surveys/new?mode=exam'); setShowCreateDropdown(false); }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-start gap-3"
                      >
                        <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <GraduationCap className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">Exam</p>
                          <p className="text-xs text-gray-500">Formal assessments with time limits</p>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Filters Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              {/* Search */}
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {/* Mode Filter */}
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 overflow-x-auto">
                {(['all', 'survey', 'quiz', 'exam'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setModeFilter(mode)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      modeFilter === mode
                        ? 'bg-slate-900 text-white'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {mode === 'all' ? 'All' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
              
              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
                {(['all', 'open', 'closed'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      statusFilter === status
                        ? 'bg-slate-900 text-white'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
              
              {/* Refresh */}
              <button
                onClick={() => loadSurveys()}
                disabled={isLoading}
                className="h-10 px-3 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50"
                title="Refresh"
              >
                <Loader2 className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
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
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No surveys yet</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
              Create your first survey, quiz, or exam to start collecting responses.
            </p>
            <button
              onClick={() => setShowCreateDropdown(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-medium text-sm transition-all hover:bg-slate-800"
            >
              <Plus className="w-4 h-4" />
              Create New
            </button>
          </div>
        ) : filteredSurveys.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No results found</h3>
            <p className="text-sm text-gray-500 mb-4">
              Try adjusting your search or filters.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setModeFilter('all'); setStatusFilter('all'); }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredSurveys.map((survey) => (
              <div key={survey.id} className="group bg-white rounded-xl sm:rounded-2xl border border-gray-200 p-4 sm:p-5 transition-all hover:shadow-lg hover:border-gray-300">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 group-hover:text-slate-700 transition-colors">{survey.title}</h3>
                      
                      {/* Mode Badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                        survey.mode === 'quiz'
                          ? 'bg-green-50 text-green-700 border border-green-100'
                          : survey.mode === 'exam'
                          ? 'bg-purple-50 text-purple-700 border border-purple-100'
                          : 'bg-blue-50 text-blue-700 border border-blue-100'
                      }`}>
                        {survey.mode === 'quiz' ? (
                          <><CheckSquare className="w-3 h-3" /> Quiz</>
                        ) : survey.mode === 'exam' ? (
                          <><GraduationCap className="w-3 h-3" /> Exam</>
                        ) : (
                          <><HelpCircle className="w-3 h-3" /> Survey</>
                        )}
                      </span>
                      
                      {/* Status Badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                        survey.status === 'open'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${survey.status === 'open' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {survey.status === 'open' ? 'Open' : 'Closed'}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm mb-3 line-clamp-1">{survey.description || 'No description'}</p>
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
                  
                  {/* Actions - Mobile: Primary + More menu, Desktop: All actions */}
                  <div className="flex items-center gap-2 sm:pt-1">
                    {/* Primary: Analytics */}
                    <button
                      onClick={() => navigate(`/admin/surveys/${survey.id}/analytics`)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-medium text-sm transition-all hover:bg-slate-800 active:scale-95"
                    >
                      <BarChart3 className="w-4 h-4" />
                      <span className="hidden sm:inline">Analytics</span>
                      <span className="sm:hidden">View</span>
                    </button>
                    
                    {/* More Menu Button */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === survey.id ? null : survey.id)}
                        className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                        title="More actions"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      
                      {/* Dropdown Menu */}
                      {openMenuId === survey.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1">
                            <button
                              onClick={() => {
                                copySurveyLink(survey.id);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Copy className="w-4 h-4" />
                              Copy Link
                            </button>
                            <button
                              onClick={() => {
                                navigate(`/admin/surveys/${survey.id}/edit`);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit Survey
                            </button>
                            <button
                              onClick={() => {
                                toggleStatus(survey);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              {survey.status === 'open' ? (
                                <><span className="w-4 h-4 flex items-center justify-center">⏸</span> Close Survey</>
                              ) : (
                                <><span className="w-4 h-4 flex items-center justify-center">▶</span> Open Survey</>
                              )}
                            </button>
                            <div className="border-t border-gray-100 my-1" />
                            <button
                              onClick={() => {
                                deleteSurvey(survey.id);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
        )}
        
        {/* Mobile Sticky Bottom Action Bar */}
        {activeTab !== 'live' && (
          <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50 shadow-lg">
            <button
              onClick={() => setShowCreateDropdown(!showCreateDropdown)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl font-medium transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" />
              Create New
            </button>
            
            {/* Mobile Create Dropdown */}
            {showCreateDropdown && (
              <div className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-gray-200 rounded-xl shadow-xl py-2">
                <button
                  onClick={() => { navigate('/admin/surveys/new'); setShowCreateDropdown(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
                >
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                    <HelpCircle className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-medium text-gray-900">Survey</span>
                </button>
                <button
                  onClick={() => { navigate('/admin/surveys/new?mode=quiz'); setShowCreateDropdown(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
                >
                  <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                    <CheckSquare className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="font-medium text-gray-900">Quiz</span>
                </button>
                <button
                  onClick={() => { navigate('/admin/surveys/new?mode=exam'); setShowCreateDropdown(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3"
                >
                  <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="font-medium text-gray-900">Exam</span>
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Bottom padding for mobile sticky bar */}
        {activeTab !== 'live' && <div className="sm:hidden h-20" />}
      </main>
    </div>
  );
}
