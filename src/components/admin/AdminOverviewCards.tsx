import React from 'react';
import { 
  Users, 
  FileText, 
  CheckSquare, 
  GraduationCap, 
  Radio, 
  BarChart3,
  TrendingUp,
  Activity
} from 'lucide-react';

interface StatsData {
  totalStudents: number;
  totalSurveys: number;
  totalQuizzes: number;
  totalExams: number;
  activeLiveRooms: number;
  totalResponses: number;
  averageScore: number;
  completionRate: number;
}

interface AdminOverviewCardsProps {
  stats: StatsData;
  loading?: boolean;
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'indigo' | 'emerald' | 'cyan';
  trend?: string;
  suffix?: string;
}

const colorMap = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
  green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-100' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
  red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-100' },
};

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, trend, suffix = '' }) => {
  const colors = colorMap[color];
  
  return (
    <div className={`bg-white rounded-2xl border ${colors.border} p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div className={`${colors.bg} rounded-xl p-3`}>
          <Icon className={`w-6 h-6 ${colors.text}`} />
        </div>
        {trend && (
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">
          {value}{suffix}
        </p>
      </div>
    </div>
  );
};

export const AdminOverviewCards: React.FC<AdminOverviewCardsProps> = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 bg-gray-200 rounded-xl" />
              <div className="w-16 h-5 bg-gray-200 rounded-full" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Students"
        value={stats.totalStudents}
        icon={Users}
        color="blue"
      />
      <StatCard
        title="Surveys"
        value={stats.totalSurveys}
        icon={FileText}
        color="indigo"
      />
      <StatCard
        title="Quizzes"
        value={stats.totalQuizzes}
        icon={CheckSquare}
        color="green"
      />
      <StatCard
        title="Exams"
        value={stats.totalExams}
        icon={GraduationCap}
        color="purple"
      />
      <StatCard
        title="Active Live Rooms"
        value={stats.activeLiveRooms}
        icon={Radio}
        color="red"
      />
      <StatCard
        title="Total Responses"
        value={stats.totalResponses}
        icon={Activity}
        color="cyan"
      />
      <StatCard
        title="Average Score"
        value={stats.averageScore}
        icon={BarChart3}
        color="amber"
        suffix="%"
      />
      <StatCard
        title="Completion Rate"
        value={stats.completionRate}
        icon={TrendingUp}
        color="emerald"
        suffix="%"
      />
    </div>
  );
};

export default AdminOverviewCards;
