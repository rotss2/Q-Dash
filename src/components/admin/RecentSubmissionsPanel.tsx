import React from 'react';
import { 
  FileText, 
  CheckSquare, 
  GraduationCap, 
  Clock,
  ChevronRight
} from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface Submission {
  id: string;
  respondent_name: string;
  survey_title: string;
  mode: 'survey' | 'quiz' | 'exam';
  submitted_at: string;
  score?: number | null;
  percentage?: number | null;
}

interface RecentSubmissionsPanelProps {
  submissions: Submission[];
  loading?: boolean;
  onViewAll?: () => void;
  onViewSubmission?: (id: string) => void;
}

const modeConfig = {
  survey: { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
  quiz: { icon: CheckSquare, color: 'text-green-600', bg: 'bg-green-50' },
  exam: { icon: GraduationCap, color: 'text-purple-600', bg: 'bg-purple-50' },
};

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString();
};

export const RecentSubmissionsPanel: React.FC<RecentSubmissionsPanelProps> = ({
  submissions,
  loading,
  onViewAll,
  onViewSubmission,
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Submissions</h3>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Submissions</h3>
        <EmptyState
          type="data"
          title="No submissions yet"
          description="Submissions will appear here when students complete surveys, quizzes, or exams."
          className="border-0 p-0"
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Submissions</h3>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View all
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {submissions.slice(0, 5).map((submission) => {
          const config = modeConfig[submission.mode];
          const Icon = config.icon;

          return (
            <button
              key={submission.id}
              onClick={() => onViewSubmission?.(submission.id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
            >
              <div className={`${config.bg} ${config.color} rounded-full p-2`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {submission.respondent_name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {submission.survey_title}
                </p>
              </div>
              <div className="text-right">
                {submission.score !== null && submission.score !== undefined && (
                  <p className="text-sm font-medium text-gray-900">
                    {submission.score}%
                  </p>
                )}
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimeAgo(submission.submitted_at)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RecentSubmissionsPanel;
