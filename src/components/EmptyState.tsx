import React from 'react';
import { 
  FileText, 
  Search, 
  Inbox, 
  Users, 
  BarChart3, 
  Trophy,
  HelpCircle,
  AlertCircle,
  LucideIcon
} from 'lucide-react';

type EmptyStateType = 'default' | 'search' | 'data' | 'users' | 'analytics' | 'trophy' | 'help' | 'error';

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  icon?: LucideIcon;
}

const iconMap: Record<EmptyStateType, LucideIcon> = {
  default: FileText,
  search: Search,
  data: Inbox,
  users: Users,
  analytics: BarChart3,
  trophy: Trophy,
  help: HelpCircle,
  error: AlertCircle,
};

const colorMap: Record<EmptyStateType, string> = {
  default: 'bg-slate-100 text-slate-400',
  search: 'bg-blue-50 text-blue-400',
  data: 'bg-gray-100 text-gray-400',
  users: 'bg-emerald-50 text-emerald-400',
  analytics: 'bg-purple-50 text-purple-400',
  trophy: 'bg-amber-50 text-amber-400',
  help: 'bg-cyan-50 text-cyan-400',
  error: 'bg-red-50 text-red-400',
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'default',
  title,
  description,
  action,
  secondaryAction,
  className = '',
  icon: CustomIcon,
}) => {
  const Icon = CustomIcon || iconMap[type];
  const colors = colorMap[type];
  
  const defaultTitles: Record<EmptyStateType, string> = {
    default: 'No items found',
    search: 'No results found',
    data: 'No data available',
    users: 'No users yet',
    analytics: 'No analytics data',
    trophy: 'No achievements yet',
    help: 'No help available',
    error: 'Something went wrong',
  };
  
  const defaultDescriptions: Record<EmptyStateType, string> = {
    default: 'Get started by creating your first item.',
    search: 'Try adjusting your search or filters to find what you\'re looking for.',
    data: 'Data will appear here once it\'s collected.',
    users: 'Users will appear here once they join.',
    analytics: 'Analytics will be available once there\'s activity.',
    trophy: 'Complete activities to earn achievements.',
    help: 'Help documentation is being prepared.',
    error: 'We couldn\'t load the data. Please try again.',
  };

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 text-center ${className}`}>
      <div className={`w-16 h-16 ${colors} rounded-2xl flex items-center justify-center mx-auto mb-6`}>
        <Icon className="w-8 h-8" />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {title || defaultTitles[type]}
      </h3>
      
      <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
        {description || defaultDescriptions[type]}
      </p>
      
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {action && (
            <button
              onClick={action.onClick}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-medium text-sm transition-all hover:bg-slate-800 active:scale-95"
            >
              {action.icon && <action.icon className="w-4 h-4" />}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm transition-all hover:bg-gray-200 active:scale-95"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const CompactEmptyState: React.FC<{
  icon?: LucideIcon;
  message: string;
  className?: string;
}> = ({ icon: Icon = Inbox, message, className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center py-8 text-center ${className}`}>
      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-gray-400" />
      </div>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
};

export default EmptyState;
