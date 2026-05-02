import { useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from '../Toaster';
import { apiGet } from '../../lib/api';
import { 
  Radio, 
  RefreshCw, 
  Users, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Clock,
  Filter,
  ChevronDown,
  Activity,
  BarChart3,
  FileText
} from 'lucide-react';

interface LiveSession {
  id: string;
  survey_id: string;
  user_id: string;
  email: string | null;
  status: 'active' | 'completed' | 'abandoned' | 'blocked';
  total_questions: number;
  answered_questions: number;
  progress_percentage: number;
  started_at: string;
  last_activity_at: string;
  submitted_at: string | null;
  abandoned_at: string | null;
  time_spent_seconds: number;
  fingerprint: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
  surveys?: { title: string } | null;
}

interface SessionSummary {
  total: number;
  active: number;
  completed: number;
  abandoned: number;
  blocked: number;
}

interface Survey {
  id: string;
  title: string;
}

interface LiveBoardProps {
  surveys?: Survey[];
}

const STATUS_CONFIG = {
  active: {
    label: 'Active',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: Activity,
    dotColor: 'bg-emerald-500'
  },
  completed: {
    label: 'Completed',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: CheckCircle,
    dotColor: 'bg-blue-500'
  },
  abandoned: {
    label: 'Abandoned',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: XCircle,
    dotColor: 'bg-amber-500'
  },
  blocked: {
    label: 'Blocked',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: AlertTriangle,
    dotColor: 'bg-red-500'
  }
};

export default function LiveBoard({ surveys = [] }: LiveBoardProps) {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [summary, setSummary] = useState<SessionSummary>({
    total: 0,
    active: 0,
    completed: 0,
    abandoned: 0,
    blocked: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [surveyFilter, setSurveyFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSessions = useCallback(async (silent = false) => {
    if (!silent) {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (surveyFilter !== 'all') {
        params.append('survey_id', surveyFilter);
      }

      const queryString = params.toString();
      const url = `/api/admin/live-sessions${queryString ? `?${queryString}` : ''}`;

      const response = await apiGet<{ sessions: LiveSession[]; summary: SessionSummary }>(url);

      if (response.error) {
        setError(response.error);
        if (!silent) {
          showToast(response.error, 'error');
        }
        return;
      }

      setSessions(response.data?.sessions || []);
      setSummary(response.data?.summary || { total: 0, active: 0, completed: 0, abandoned: 0, blocked: 0 });
      setLastUpdated(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch sessions';
      setError(errorMessage);
      if (!silent) {
        showToast(errorMessage, 'error');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter, surveyFilter, showToast]);

  // Initial load
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      fetchSessions(true);
    }, 5000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchSessions]);

  const handleManualRefresh = () => {
    fetchSessions();
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 10) return 'Just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const formatTimeSpent = (seconds: number, status: string, startedAt: string): string => {
    // For active sessions, calculate live time
    let totalSeconds = seconds;
    if (status === 'active') {
      const start = new Date(startedAt).getTime();
      const now = new Date().getTime();
      totalSeconds = Math.floor((now - start) / 1000);
    }
    
    if (totalSeconds < 0) totalSeconds = 0;
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getRespondentLabel = (session: LiveSession): string => {
    if (session.email) {
      return session.email;
    }
    return `Anonymous-${session.user_id.slice(0, 8)}`;
  };

  const getRespondentInitial = (session: LiveSession): string => {
    if (session.email) {
      return session.email.charAt(0).toUpperCase();
    }
    return 'A';
  };

  const StatusBadge = ({ status }: { status: keyof typeof STATUS_CONFIG }) => {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${config.color}`}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
        {status === 'active' && (
          <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor} animate-pulse`} />
        )}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Loading live sessions...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Radio className="w-6 h-6 text-red-500 animate-pulse" />
            Live Board
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Monitor respondents in real-time
            {lastUpdated && (
              <span className="ml-2 text-gray-400">
                · Updated {formatTimeAgo(lastUpdated.toISOString())}
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              showFilters 
                ? 'bg-slate-900 text-white' 
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-all hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="abandoned">Abandoned</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Survey</label>
              <select
                value={surveyFilter}
                onChange={(e) => setSurveyFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="all">All Surveys</option>
                {surveys.map((survey) => (
                  <option key={survey.id} value={survey.id}>
                    {survey.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.active}</p>
              <p className="text-xs text-gray-500">Active Now</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.completed}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.abandoned}</p>
              <p className="text-xs text-gray-500">Abandoned</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
              <p className="text-xs text-gray-500">Total Sessions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button 
            onClick={handleManualRefresh}
            className="ml-auto text-sm font-medium text-red-600 hover:text-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Sessions Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No live sessions</h3>
            <p className="text-sm text-gray-500 text-center max-w-md">
              When respondents start taking your surveys, their sessions will appear here in real-time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Respondent
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Survey
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Activity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time Spent
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">
                            {getRespondentInitial(session)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {getRespondentLabel(session)}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            ID: {session.user_id.slice(0, 12)}...
                          </p>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate max-w-[150px]">
                          {session.surveys?.title || 'Unknown Survey'}
                        </span>
                      </div>
                    </td>
                    
                    <td className="px-4 py-3">
                      <StatusBadge status={session.status} />
                    </td>
                    
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-[80px] max-w-[120px]">
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                session.status === 'completed'
                                  ? 'bg-blue-500'
                                  : session.status === 'active'
                                  ? 'bg-emerald-500'
                                  : 'bg-gray-400'
                              }`}
                              style={{ width: `${session.progress_percentage}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs font-medium text-gray-600 w-10">
                          {Math.round(session.progress_percentage)}%
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {session.answered_questions} / {session.total_questions} questions
                      </p>
                    </td>
                    
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        {formatTimeAgo(session.started_at)}
                      </div>
                    </td>
                    
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Activity className="w-3.5 h-3.5 text-gray-400" />
                        {formatTimeAgo(session.last_activity_at)}
                      </div>
                    </td>
                    
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {formatTimeSpent(session.time_spent_seconds, session.status, session.started_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <p>
          Sessions are marked abandoned after 30 minutes of inactivity
        </p>
        <p>
          Auto-refreshes every 5 seconds
        </p>
      </div>
    </div>
  );
}
