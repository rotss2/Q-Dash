import React from 'react';
import { 
  Plus, 
  FileQuestion, 
  Library, 
  Radio, 
  BarChart3, 
  Upload,
  Users
} from 'lucide-react';

interface QuickAction {
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  onClick: () => void;
}

interface QuickActionGridProps {
  onCreateSurvey: () => void;
  onCreateQuiz: () => void;
  onCreateExam: () => void;
  onOpenQuestionBank: () => void;
  onStartLiveBattle: () => void;
  onViewAnalytics: () => void;
  onImportQuestions: () => void;
  onManageStudents?: () => void;
}

export const QuickActionGrid: React.FC<QuickActionGridProps> = ({
  onCreateSurvey,
  onCreateQuiz,
  onCreateExam,
  onOpenQuestionBank,
  onStartLiveBattle,
  onViewAnalytics,
  onImportQuestions,
  onManageStudents,
}) => {
  const actions: QuickAction[] = [
    {
      label: 'Create Survey',
      description: 'Collect feedback & data',
      icon: Plus,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 hover:bg-blue-100',
      onClick: onCreateSurvey,
    },
    {
      label: 'Create Quiz',
      description: 'Build practice quizzes',
      icon: FileQuestion,
      color: 'text-green-600',
      bgColor: 'bg-green-50 hover:bg-green-100',
      onClick: onCreateQuiz,
    },
    {
      label: 'Create Exam',
      description: 'Formal assessments',
      icon: Plus,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 hover:bg-purple-100',
      onClick: onCreateExam,
    },
    {
      label: 'Question Bank',
      description: 'Manage questions',
      icon: Library,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 hover:bg-indigo-100',
      onClick: onOpenQuestionBank,
    },
    {
      label: 'Live Battle',
      description: 'Host live quiz room',
      icon: Radio,
      color: 'text-red-600',
      bgColor: 'bg-red-50 hover:bg-red-100',
      onClick: onStartLiveBattle,
    },
    {
      label: 'Analytics',
      description: 'View insights',
      icon: BarChart3,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 hover:bg-amber-100',
      onClick: onViewAnalytics,
    },
    {
      label: 'Import Questions',
      description: 'Bulk import via text',
      icon: Upload,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50 hover:bg-cyan-100',
      onClick: onImportQuestions,
    },
    {
      label: 'Students',
      description: 'Manage learners',
      icon: Users,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 hover:bg-emerald-100',
      onClick: onManageStudents || (() => {}),
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={`flex flex-col items-center p-4 rounded-xl transition-all ${action.bgColor} group`}
          >
            <div className={`${action.color} mb-2 group-hover:scale-110 transition-transform`}>
              <action.icon className="w-6 h-6" />
            </div>
            <span className={`text-sm font-medium ${action.color}`}>
              {action.label}
            </span>
            <span className="text-xs text-gray-500 mt-1 text-center">
              {action.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActionGrid;
