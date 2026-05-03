import { useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from '../Toaster';
import { apiGet } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/database.types';
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
  FileText,
} from 'lucide-react';

type LiveSessionRow = Database['public']['Tables']['survey_live_sessions']['Row'];

interface LiveSession extends LiveSessionRow {
  surveys?: { title: string } | null;
}

interface SessionSummary {
  total: number;
  active: number;
  completed: number;
  abandoned: number;
  blocked: number;
}

interface ApiResponse {
  sessions: LiveSession[];
  globalSummary: SessionSummary;
  filteredSummary: SessionSummary;
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

const POLLING_INTERVAL = 5000; // 5 seconds
const BACKGROUND_POLLING_INTERVAL = 30000; // 30 seconds when hidden

/**
 * Defensive deduplication of sessions
 * - Prefer session.id as primary key
 * - Fallback to `${survey_id}:${user_id}` composite key
 * - Keep the newest record by updated_at or last_activity_at
 */
const deduplicateSessions = (sessions: LiveSession[]): LiveSession[] => {
  const seen = new Map<string, LiveSession>();
  
  for (const session of sessions) {
    // Create composite key as fallback
    const compositeKey = `${session.survey_id}:${session.user_id}`;
    const primaryKey = session.id || compositeKey;
    
    const existing = seen.get(primaryKey);
    if (!existing) {
      seen.set(primaryKey, session);
      continue;
    }
    
    // Keep the newest record
    const existingTime = new Date(existing.updated_at || existing.last_activity_at).getTime();
    const newTime = new Date(session.updated_at || session.last_activity_at).getTime();
    
    if (newTime > existingTime) {
      seen.set(primaryKey, session);
    }
  }
  
  // Also check for composite key collisions (same user+survey but different IDs)
  const compositeSeen = new Map<string, LiveSession>();
  const result: LiveSession[] = [];
  
  for (const session of seen.values()) {
    const compositeKey = `${session.survey_id}:${session.user_id}`;
    const existing = compositeSeen.get(compositeKey);
    
    if (!existing) {
      compositeSeen.set(compositeKey, session);
      result.push(session);
      continue;
    }
    
    // Keep the newest
    const existingTime = new Date(existing.updated_at || existing.last_activity_at).getTime();
    const newTime = new Date(session.updated_at || session.last_activity_at).getTime();
    
    if (newTime > existingTime) {
      compositeSeen.set(compositeKey, session);
      // Replace in result
      const idx = result.findIndex(s => s.survey_id === session.survey_id && s.user_id === session.user_id);
      if (idx !== -1) {
        result[idx] = session;
      }
    }
  }
  
  return result;
};

export default function LiveBoard({ surveys = [] }: LiveBoardProps) {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [globalSummary, setGlobalSummary] = useState<SessionSummary>({
    total: 0,
    active: 0,
    completed: 0,
    abandoned: 0,
    blocked: 0
  });
  const [filteredSummary, setFilteredSummary] = useState<SessionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [surveyFilter, setSurveyFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(false);
  
  // Refs for race condition prevention
  const requestIdRef = useRef(0);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabaseChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch sessions with race condition prevention
   */
  const fetchSessions = useCallback(async (silent = false) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    // Increment request ID
    const currentRequestId = ++requestIdRef.current;
    
    if (!silent) {
      setIsRefreshing(true);
    }
    
    // Only clear error on manual refresh, keep polling errors silent
    if (!silent) {
      setError(null);
    }
    setPollingError(null);

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

      const response = await apiGet<ApiResponse>(url);

      // Check if this is still the latest request
      if (currentRequestId !== requestIdRef.current) {
        console.log('[LiveBoard] Discarding stale response');
        return;
      }

      if (response.error) {
        throw new Error(response.error);
      }

      // Defensive deduplication before setting state
      const dedupedSessions = deduplicateSessions(response.data?.sessions || []);
      
      setSessions(dedupedSessions);
      setGlobalSummary(response.data?.globalSummary || { total: 0, active: 0, completed: 0, abandoned: 0, blocked: 0 });
      setFilteredSummary(response.data?.filteredSummary || null);
      setLastUpdated(new Date());
      
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    } catch (err) {
      // Check if this is still the latest request
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      
      // Don't update state if request was aborted
      if (abortController.signal.aborted) {
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch sessions';
      
      if (silent) {
        // Silent polling error - keep last known data and show warning
        setPollingError(errorMessage);
      } else {
        // Manual refresh error - show full error
        setError(errorMessage);
        showToast(errorMessage, 'error');
      }
    } finally {
      // Only update loading states if this is the latest request
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [statusFilter, surveyFilter, showToast, isInitialLoad]);

  /**
   * Handle realtime updates from Supabase
   */
  const handleRealtimeUpdate = useCallback((payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: LiveSessionRow;
    old: LiveSessionRow;
  }) => {
    console.log('[LiveBoard] Realtime update:', payload.eventType, payload.new?.id || payload.old?.id);
    
    setSessions(prev => {
      let updated = [...prev];
      
      switch (payload.eventType) {
        case 'INSERT': {
          if (payload.new) {
            // Check if session already exists
            const exists = updated.some(s => s.id === payload.new.id);
            if (!exists) {
              updated.unshift(payload.new as LiveSession);
            }
          }
          break;
        }
        case 'UPDATE': {
          if (payload.new) {
            const idx = updated.findIndex(s => s.id === payload.new.id);
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], ...payload.new } as LiveSession;
            } else {
              // Session not in list, add it
              updated.unshift(payload.new as LiveSession);
            }
          }
          break;
        }
        case 'DELETE': {
          if (payload.old) {
            updated = updated.filter(s => s.id !== payload.old.id);
          }
          break;
        }
      }
      
      // Re-deduplicate after realtime update
      return deduplicateSessions(updated);
    });
    
    setLastUpdated(new Date());
  }, []);

  /**
   * Setup Supabase realtime subscription
   */
  useEffect(() => {
    // Check if realtime is configured
    const channel = supabase
      .channel('live-board-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'survey_live_sessions'
        },
        (payload) => {
          handleRealtimeUpdate({
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            new: payload.new as LiveSessionRow,
            old: payload.old as LiveSessionRow
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[LiveBoard] Realtime subscription active');
          setIsRealtimeEnabled(true);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[LiveBoard] Realtime subscription failed');
          setIsRealtimeEnabled(false);
        }
      });
    
    supabaseChannelRef.current = channel;
    
    return () => {
      if (supabaseChannelRef.current) {
        supabase.removeChannel(supabaseChannelRef.current);
        supabaseChannelRef.current = null;
      }
    };
  }, [handleRealtimeUpdate]);

  /**
   * Visibility change handler
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsTabVisible(isVisible);
      
      if (isVisible) {
        // Tab became visible - immediately refresh
        console.log('[LiveBoard] Tab visible, refreshing...');
        fetchSessions(true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchSessions]);

  /**
   * Initial load
   */
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  /**
   * Auto-refresh with visibility-aware polling
   */
  useEffect(() => {
    // Clear existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    
    // Use different intervals based on visibility and realtime status
    const interval = !isTabVisible 
      ? BACKGROUND_POLLING_INTERVAL 
      : isRealtimeEnabled 
        ? BACKGROUND_POLLING_INTERVAL // Less frequent if realtime is active
        : POLLING_INTERVAL;
    
    refreshIntervalRef.current = setInterval(() => {
      fetchSessions(true);
    }, interval);
    
    console.log(`[LiveBoard] Polling interval set to ${interval}ms (visible: ${isTabVisible}, realtime: ${isRealtimeEnabled})`);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [fetchSessions, isTabVisible, isRealtimeEnabled]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Clear interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      // Remove Supabase channel
      if (supabaseChannelRef.current) {
        supabase.removeChannel(supabaseChannelRef.current);
      }
    };
  }, []);

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

  const formatTimeSpent = (seconds: number, status: string, startedAt: string, submittedAt?: string | null, abandonedAt?: string | null): string => {
    let totalSeconds = seconds;
    
    if (status === 'active') {
      // For active sessions, calculate live time from started_at to now
      const start = new Date(startedAt).getTime();
      const now = new Date().getTime();
      totalSeconds = Math.floor((now - start) / 1000);
    } else if (status === 'completed' && submittedAt) {
      // For completed sessions, use submitted_at - started_at
      const start = new Date(startedAt).getTime();
      const submitted = new Date(submittedAt).getTime();
      totalSeconds = Math.floor((submitted - start) / 1000);
    } else if (status === 'abandoned' && abandonedAt) {
      // For abandoned sessions, use abandoned_at - started_at
      const start = new Date(startedAt).getTime();
      const abandoned = new Date(abandonedAt).getTime();
      totalSeconds = Math.floor((abandoned - start) / 1000);
    }
    // For other cases, use the stored time_spent_seconds
    
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

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Radio className="w-6 h-6 text-red-500 animate-pulse" />
            Live Board
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
            <p className="text-sm text-gray-500">
              Monitor respondents in real-time
            </p>
            {lastUpdated && (
              <span className="text-xs text-gray-400">
                Last updated {formatTimeAgo(lastUpdated.toISOString())}
              </span>
            )}
            <div className="flex items-center gap-2">
              {/* Realtime status indicator */}
              <span 
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                  isRealtimeEnabled 
                    ? 'bg-emerald-50 text-emerald-600' 
                    : 'bg-gray-100 text-gray-500'
                }`}
                title={isRealtimeEnabled ? 'Realtime updates active' : 'Polling mode'}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isRealtimeEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                {isRealtimeEnabled ? 'Live' : 'Polling'}
              </span>
              
              {/* Visibility status */}
              {!isTabVisible && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Paused (background)
                </span>
              )}
              
              {/* Refresh indicator */}
              {isRefreshing && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Refreshing...
                </span>
              )}
            </div>
          </div>
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
            {filteredSummary && (
              <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                {filteredSummary.total}
              </span>
            )}
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
              <p className="text-2xl font-bold text-gray-900">{globalSummary.active}</p>
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
              <p className="text-2xl font-bold text-gray-900">{globalSummary.completed}</p>
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
              <p className="text-2xl font-bold text-gray-900">{globalSummary.abandoned}</p>
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
              <p className="text-2xl font-bold text-gray-900">{globalSummary.total}</p>
              <p className="text-xs text-gray-500">Total Sessions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error states */}
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
      
      {/* Silent polling error warning */}
      {pollingError && !error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            Connection issue. Showing last known data. Will retry automatically.
          </p>
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
                        {formatTimeSpent(session.time_spent_seconds, session.status, session.started_at, session.submitted_at, session.abandoned_at)}
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-400">
        <p>
          Sessions are marked abandoned after 30 minutes of inactivity
        </p>
        <div className="flex items-center gap-3">
          <span>
            {isRealtimeEnabled 
              ? 'Realtime updates enabled' 
              : `Auto-refreshes every ${!isTabVisible ? '30' : '5'} seconds${!isTabVisible ? ' (background)' : ''}`
            }
          </span>
          {filteredSummary && (statusFilter !== 'all' || surveyFilter !== 'all') && (
            <span className="text-blue-600">
              Showing {filteredSummary.total} of {globalSummary.total} sessions
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
