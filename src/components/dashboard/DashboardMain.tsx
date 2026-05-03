import { useEffect, useState } from 'react';
import { LayoutDashboard, Users, FileText, Activity } from 'lucide-react';
import DashboardWidget from './DashboardWidget';
import QuickLinks from './QuickLinks';
import AnalyticsDashboard from './AnalyticsDashboard';
import QuizStats from './QuizStats';

// TypeScript interfaces for data structures
interface StatsData {
  analytics?: {
    totalUsers: number;
    activeSessions: number;
  };
  quiz?: {
    activeQuizzes: number;
    completionRate: number;
    averageScore: number;
  };
  overview?: {
    totalSurveys: number;
    totalResponses: number;
    openSurveys: number;
  };
}

// Mock API function - replace with actual Supabase or API integration
const fetchDashboardData = async (): Promise<StatsData> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock data - replace with actual API response
  return {
    analytics: {
      totalUsers: 12543,
      activeSessions: 892,
    },
    quiz: {
      activeQuizzes: 24,
      completionRate: 78,
      averageScore: 84.5,
    },
    overview: {
      totalSurveys: 156,
      totalResponses: 8934,
      openSurveys: 12,
    },
  };
};

export default function DashboardMain() {
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Centralized data fetching
  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await fetchDashboardData();
      setStatsData(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    
    // Optional: Set up polling for real-time updates
    const interval = setInterval(() => {
      loadDashboardData();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !statsData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600 font-medium">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (error && !statsData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 font-medium mb-4">{error}</p>
          <button
            onClick={loadDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
                {lastUpdated && (
                  <p className="text-xs text-gray-500">
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={loadDashboardData}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Quick Links Panel */}
          <QuickLinks />

          {/* Main Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Key Stats (1 column on mobile, 1 on desktop) */}
            <div className="lg:col-span-1 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Key Metrics</h2>
              <div className="space-y-4">
                <DashboardWidget
                  title="Total Surveys"
                  value={statsData?.overview?.totalSurveys ?? 0}
                  icon={<FileText className="w-6 h-6" />}
                  trend={{ value: 12, isPositive: true }}
                />
                <DashboardWidget
                  title="Total Responses"
                  value={statsData?.overview?.totalResponses?.toLocaleString() ?? 0}
                  icon={<Users className="w-6 h-6" />}
                  trend={{ value: 8, isPositive: true }}
                />
                <DashboardWidget
                  title="Open Surveys"
                  value={statsData?.overview?.openSurveys ?? 0}
                  icon={<Activity className="w-6 h-6" />}
                  suffix="active"
                />
              </div>
            </div>

            {/* Right Column: Charts (1 column on mobile, 2 on desktop) */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Analytics & Insights</h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <AnalyticsDashboard
                  data={statsData?.analytics}
                  isLoading={isLoading}
                  onRefresh={loadDashboardData}
                />
                <QuizStats
                  data={statsData?.quiz}
                  isLoading={isLoading}
                  onRefresh={loadDashboardData}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
