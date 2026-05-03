import { useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';

interface AnalyticsData {
  totalUsers: number;
  activeSessions: number;
}

interface AnalyticsDashboardProps {
  data?: AnalyticsData;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export default function AnalyticsDashboard({ 
  data, 
  isLoading = false,
  onRefresh 
}: AnalyticsDashboardProps) {
  const [chartData] = useState({
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    values: [120, 190, 150, 250, 220, 300, 280],
  });

  return (
    <div className="bg-white rounded-xl shadow-md p-6 h-96">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Real-time Analytics</h3>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center">
          {/* Placeholder Chart Visualization */}
          <div className="w-full h-full flex items-end justify-between gap-2 px-4">
            {chartData.values.map((value, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div 
                  className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-md transition-all duration-500 hover:from-blue-600 hover:to-blue-500"
                  style={{ height: `${(value / 300) * 100}%` }}
                />
                <span className="text-xs text-gray-500">{chartData.labels[index]}</span>
              </div>
            ))}
          </div>
          
          {/* Stats Summary */}
          {data && (
            <div className="flex items-center gap-8 mt-4 pt-4 border-t border-gray-100 w-full justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{data.totalUsers.toLocaleString()}</p>
                <p className="text-sm text-gray-500">Total Users</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{data.activeSessions}</p>
                <p className="text-sm text-gray-500">Active Sessions</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
