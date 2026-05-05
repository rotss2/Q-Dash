import React from 'react';
import { 
  User, 
  FileText, 
  CheckSquare, 
  GraduationCap, 
  Radio, 
  Trophy,
  Star,
  Upload,
  Clock
} from 'lucide-react';
import { ActivityLog } from '../../types/activity';
import { EmptyState } from '../EmptyState';

interface AdminActivityFeedProps {
  activities: ActivityLog[];
  loading?: boolean;
  maxItems?: number;
}

const actionConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  user_login: { icon: User, color: 'text-blue-600', label: 'User logged in' },
  user_logout: { icon: User, color: 'text-gray-500', label: 'User logged out' },
  quiz_submitted: { icon: CheckSquare, color: 'text-green-600', label: 'Quiz submitted' },
  exam_submitted: { icon: GraduationCap, color: 'text-purple-600', label: 'Exam submitted' },
  survey_response: { icon: FileText, color: 'text-indigo-600', label: 'Survey response' },
  quiz_created: { icon: CheckSquare, color: 'text-green-600', label: 'Quiz created' },
  exam_created: { icon: GraduationCap, color: 'text-purple-600', label: 'Exam created' },
  survey_created: { icon: FileText, color: 'text-indigo-600', label: 'Survey created' },
  live_battle_joined: { icon: Radio, color: 'text-red-600', label: 'Joined live battle' },
  live_room_started: { icon: Radio, color: 'text-red-600', label: 'Live room started' },
  live_room_ended: { icon: Radio, color: 'text-red-600', label: 'Live room ended' },
  badge_earned: { icon: Trophy, color: 'text-amber-600', label: 'Badge earned' },
  perfect_score: { icon: Star, color: 'text-yellow-600', label: 'Perfect score' },
  question_imported: { icon: Upload, color: 'text-cyan-600', label: 'Questions imported' },
  result_generated: { icon: FileText, color: 'text-blue-600', label: 'Results generated' },
  profile_updated: { icon: User, color: 'text-emerald-600', label: 'Profile updated' },
};

const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

export const AdminActivityFeed: React.FC<AdminActivityFeedProps> = ({ 
  activities, 
  loading,
  maxItems = 10 
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Feed</h3>
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

  if (activities.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Feed</h3>
        <EmptyState 
          type="data" 
          title="No activity yet"
          description="Activity will appear here when students and admins take actions."
          className="border-0 p-0"
        />
      </div>
    );
  }

  const displayActivities = activities.slice(0, maxItems);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Activity Feed</h3>
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          Live
        </div>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {displayActivities.map((activity) => {
          const config = actionConfig[activity.action] || { 
            icon: User, 
            color: 'text-gray-600',
            label: activity.action 
          };
          const Icon = config.icon;

          return (
            <div 
              key={activity.id} 
              className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <div className={`${config.color} bg-gray-100 rounded-full p-2`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{activity.actor_name}</span>
                  {' '}
                  <span className="text-gray-600">{config.label.toLowerCase()}</span>
                  {activity.entity_id && (
                    <span className="text-gray-500"> {activity.entity_type}</span>
                  )}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatTimeAgo(activity.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      
      {activities.length > maxItems && (
        <button className="w-full mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium py-2">
          View all activity
        </button>
      )}
    </div>
  );
};

export default AdminActivityFeed;
