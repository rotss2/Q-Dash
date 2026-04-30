import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toaster';
import { apiGet, apiDelete, apiPost } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { Survey, Response } from '../../types';
import { Plus, BarChart3, Edit2, Trash2, Copy, LogOut, Users, FileText, Radio, X, Maximize2, Minimize2 } from 'lucide-react';

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [liveFeed, setLiveFeed] = useState<Array<{ 
    id: string; 
    surveyTitle: string; 
    timestamp: string; 
    userId: string; 
    userLabel: string;
    currentQuestion: number;
    totalQuestions: number;
    progress: number;
    isComplete: boolean;
  }>>([]);
  const [showLiveFeed, setShowLiveFeed] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const activeUsers = 0;
  const activeUsersBySurvey: Record<string, number> = {};
  const subscriptionRef = useRef<any>(null);

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

  // Real-time subscription for live feed
  useEffect(() => {
    if (!showLiveFeed) return;

    console.log('Setting up real-time subscription for responses...');

    // Track user response counts
    const userResponseCounts = new Map<string, number>(); // key: userId_surveyId

    // Subscribe to responses table changes
    const subscription = supabase
      .channel('responses-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'responses'
        },
        (payload) => {
          console.log('New response received:', payload);
          const newResponse = payload.new as Response;

          // Get survey info
          const survey = surveys.find(s => s.id === newResponse.survey_id);
          if (!survey) return;

          const userKey = `${newResponse.user_id}_${newResponse.survey_id}`;
          
          // Increment user's response count for this survey
          const currentCount = userResponseCounts.get(userKey) || 0;
          const newCount = currentCount + 1;
          userResponseCounts.set(userKey, newCount);

          // Estimate total questions (use max of 5 or cached count)
          const totalQuestions = Math.max(survey.total_responses || 0, 5);
          const progress = Math.min((newCount / totalQuestions) * 100, 100);

          const entry = {
            id: newResponse.id,
            surveyTitle: survey.title,
            timestamp: newResponse.submitted_at || new Date().toISOString(),
            userId: newResponse.user_id,
            userLabel: `User-${newResponse.user_id?.slice(0, 8) || 'Anonymous'}`,
            currentQuestion: newCount,
            totalQuestions: totalQuestions,
            progress: Math.round(progress),
            isComplete: newCount >= totalQuestions
          };

          setLiveFeed(prev => {
            // Remove any existing entry for this user+survey
            const filtered = prev.filter(e => 
              !(e.userId === newResponse.user_id && e.surveyTitle === survey.title)
            );
            // Add new entry at the top
            return [entry, ...filtered].slice(0, 50);
          });

          // Also refresh survey counts
          loadSurveys();
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    subscriptionRef.current = subscription;

    return () => {
      console.log('Cleaning up subscription...');
      subscription.unsubscribe();
    };
  }, [showLiveFeed, surveys]);

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

  const toggleLiveMode = () => {
    setLiveMode(!liveMode);
    if (!liveMode) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50 ${liveMode ? 'fixed inset-0 z-50 overflow-auto' : ''}`}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between h-auto md:h-16">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Creator Studio</h1>
              {activeUsers > 0 && (
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                  {activeUsers} active
                </span>
              )}
              {liveMode && (
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded animate-pulse">
                  LIVE MODE
                </span>
              )}
            </div>
            <div className="flex flex-col gap-3 items-start sm:flex-row sm:items-center sm:gap-4 flex-wrap">
              <button
                onClick={() => setShowLiveFeed(!showLiveFeed)}
                className={`flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showLiveFeed ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Radio className="w-4 h-4" />
                Live Feed
                {liveFeed.length > 0 && (
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </button>
              <button
                onClick={toggleLiveMode}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  liveMode ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {liveMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                {liveMode ? 'Exit Live' : 'Live Mode'}
              </button>
              {!liveMode && (
                <>
                  <span className="text-sm text-gray-600">{user?.email}</span>
                  <button onClick={handleSignOut} className="btn-secondary flex items-center gap-2">
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className={`${liveMode ? 'max-w-full p-8' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}`}>
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Main Content */}
          <div className="flex-1">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Surveys</p>
                <p className="text-2xl font-bold text-gray-900">{surveys.length}</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Responses</p>
                <p className="text-2xl font-bold text-gray-900">{totalResponses}</p>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Open Surveys</p>
                <p className="text-2xl font-bold text-gray-900">{openSurveys}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 justify-between items-start md:flex-row md:items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {liveMode ? 'Live Dashboard' : 'Your Surveys'}
          </h2>
          {!liveMode && (
            <div className="flex gap-2">
              <button
                onClick={() => loadSurveys()}
                disabled={isLoading}
                className="btn-secondary flex items-center gap-2"
                title="Refresh survey list"
              >
                <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <button
                onClick={() => navigate('/admin/surveys/new')}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Survey
              </button>
            </div>
          )}
        </div>

        {/* Surveys List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : surveys.length === 0 ? (
          <div className="card text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No surveys yet</h3>
            <p className="text-gray-600 mb-6">Create your first survey to start collecting responses</p>
            <button
              onClick={() => navigate('/admin/surveys/new')}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Survey
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {surveys.map((survey) => (
              <div key={survey.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{survey.title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        survey.status === 'open' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {survey.status === 'open' ? 'Open' : 'Closed'}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">{survey.description || 'No description'}</p>
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {survey.total_responses} responses
                      </span>
                      {activeUsersBySurvey[survey.id] > 0 && (
                        <span className="flex items-center gap-1 text-green-600">
                          <Radio className="w-4 h-4 animate-pulse" />
                          {activeUsersBySurvey[survey.id]} active
                        </span>
                      )}
                      <span>Created {new Date(survey.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copySurveyLink(survey.id)}
                      className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                      title="Copy survey link"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => navigate(`/admin/surveys/${survey.id}/analytics`)}
                      className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                      title="View analytics"
                    >
                      <BarChart3 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => navigate(`/admin/surveys/${survey.id}/edit`)}
                      className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                      title="Edit survey"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => toggleStatus(survey)}
                      className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                        survey.status === 'open'
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {survey.status === 'open' ? 'Close' : 'Open'}
                    </button>
                    <button
                      onClick={() => deleteSurvey(survey.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete survey"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
          </div>

          {/* Live Feed Sidebar */}
          {showLiveFeed && (
            <div className="w-80 bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-red-400" />
                  <span className="font-medium">Live Feed</span>
                </div>
                <button 
                  onClick={() => setShowLiveFeed(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {liveFeed.length === 0 ? (
                  <p className="p-4 text-sm text-gray-500 text-center">
                    Waiting for responses...
                  </p>
                ) : (
                  liveFeed.map((entry) => (
                    <div key={entry.id} className="p-3 border-b border-gray-100 hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {entry.userLabel}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          entry.isComplete 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {entry.isComplete ? 'Complete' : `Q${entry.currentQuestion}`}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        {entry.surveyTitle}
                      </p>
                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                        <div 
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            entry.isComplete ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${entry.progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400">
                        {entry.progress}% • {new Date(entry.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
