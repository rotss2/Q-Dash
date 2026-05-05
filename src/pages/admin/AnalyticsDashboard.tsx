import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalytics } from '../../hooks/useAnalytics';
import { SkeletonCard } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  BookOpen, 
  GraduationCap,
  Target,
  ArrowLeft,
  RefreshCw,
  Calendar,
  Trophy,
  Percent,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

export default function AnalyticsDashboard() {
  const navigate = useNavigate();
  const { 
    overview, 
    topicPerformance, 
    scoreTrends, 
    studentPerformance, 
    loading, 
    error,
    refresh 
  } = useAnalytics();

  const [dateRange, setDateRange] = useState('30');
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'topics'>('overview');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <SkeletonCard count={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <EmptyState
          type="error"
          title="Failed to Load Analytics"
          description={error}
          action={{
            label: 'Try Again',
            onClick: refresh,
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Analytics Dashboard</h1>
                <p className="text-xs text-gray-500">Insights & Performance Metrics</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
              <button
                onClick={refresh}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-8 w-fit">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'students', label: 'Students', icon: Users },
            { id: 'topics', label: 'Topics', icon: BookOpen },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Users}
                label="Total Students"
                value={overview?.total_students || 0}
                trend={+12}
                color="indigo"
              />
              <StatCard
                icon={BookOpen}
                label="Total Quizzes"
                value={overview?.total_quizzes || 0}
                trend={+5}
                color="emerald"
              />
              <StatCard
                icon={GraduationCap}
                label="Total Exams"
                value={overview?.total_exams || 0}
                trend={+2}
                color="amber"
              />
              <StatCard
                icon={Target}
                label="Total Attempts"
                value={overview?.total_attempts || 0}
                trend={+28}
                color="rose"
              />
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Average Score */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Percent className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Average Score</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {overview?.average_score || 0}%
                    </p>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                    style={{ width: `${overview?.average_score || 0}%` }}
                  />
                </div>
              </div>

              {/* Passing Rate */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Passing Rate</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {overview?.passing_rate || 0}%
                    </p>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full transition-all duration-1000"
                    style={{ width: `${overview?.passing_rate || 0}%` }}
                  />
                </div>
              </div>

              {/* Total Surveys */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Surveys</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {overview?.total_surveys || 0}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Including quizzes and exams
                </p>
              </div>
            </div>

            {/* Score Trends Chart */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                Score Trends (Last 30 Days)
              </h2>
              
              {scoreTrends.length === 0 ? (
                <EmptyState
                  type="default"
                  title="No Data Available"
                  description="Score trends will appear once students start taking quizzes"
                />
              ) : (
                <div className="space-y-3">
                  {scoreTrends.slice(-10).map((trend, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <span className="w-20 text-sm text-gray-500">{trend.date}</span>
                      <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                        <div 
                          className="h-full bg-indigo-500 rounded-lg transition-all duration-500 flex items-center justify-end pr-2"
                          style={{ width: `${Math.min(trend.avg_score, 100)}%` }}
                        >
                          <span className="text-xs font-bold text-white">
                            {trend.avg_score}%
                          </span>
                        </div>
                      </div>
                      <span className="w-16 text-sm text-gray-500 text-right">
                        {trend.total_attempts} attempts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Student Performance Leaderboard
              </h2>
            </div>
            
            {studentPerformance.length === 0 ? (
              <EmptyState
                type="default"
                title="No Student Data"
                description="Student performance will appear once they start taking quizzes"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attempts</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Best Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {studentPerformance.slice(0, 20).map((student) => (
                      <tr key={student.user_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {student.rank <= 3 ? (
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                              student.rank === 1 ? 'bg-amber-100 text-amber-700' :
                              student.rank === 2 ? 'bg-gray-100 text-gray-700' :
                              'bg-orange-100 text-orange-700'
                            }`}>
                              {student.rank}
                            </span>
                          ) : (
                            <span className="text-gray-500 font-medium">{student.rank}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                              <span className="font-bold text-indigo-600 text-sm">
                                {student.display_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium text-gray-900">{student.display_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                          {student.total_attempts}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`font-bold ${
                            student.avg_score >= 80 ? 'text-green-600' :
                            student.avg_score >= 60 ? 'text-amber-600' :
                            'text-red-600'
                          }`}>
                            {student.avg_score}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                          {student.highest_score}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                          {Math.round(student.total_time_spent_seconds / 60)}m
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'topics' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                Topic Performance Analysis
              </h2>
            </div>
            
            {topicPerformance.length === 0 ? (
              <EmptyState
                type="default"
                title="No Topic Data"
                description="Topic performance will appear once questions are categorized"
              />
            ) : (
              <div className="p-6 space-y-6">
                {topicPerformance.map((topic) => (
                  <div key={topic.topic} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">{topic.topic}</span>
                        <span className="text-sm text-gray-500">
                          ({topic.total_questions} questions)
                        </span>
                      </div>
                      <span className={`font-bold ${
                        topic.accuracy_rate >= 70 ? 'text-green-600' :
                        topic.accuracy_rate >= 50 ? 'text-amber-600' :
                        'text-red-600'
                      }`}>
                        {topic.accuracy_rate}% accuracy
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          topic.accuracy_rate >= 70 ? 'bg-green-500' :
                          topic.accuracy_rate >= 50 ? 'bg-amber-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${topic.accuracy_rate}%` }}
                      />
                    </div>
                    <div className="flex gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        {topic.correct_answers} correct
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full" />
                        {topic.wrong_answers} wrong
                      </span>
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

// Stat Card Component
function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  trend,
  color 
}: { 
  icon: React.ElementType;
  label: string;
  value: number;
  trend: number;
  color: 'indigo' | 'emerald' | 'amber' | 'rose';
}) {
  const colors = {
    indigo: 'bg-indigo-100 text-indigo-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
    rose: 'bg-rose-100 text-rose-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium ${
          trend > 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          {trend > 0 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {Math.abs(trend)}%
        </div>
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
        <p className="text-sm text-gray-500 mt-1">{label}</p>
      </div>
    </div>
  );
}
