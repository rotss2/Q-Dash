import { useNavigate } from 'react-router-dom';
import { Plus, BarChart3, Users } from 'lucide-react';

interface QuickLink {
  label: string;
  path: string;
  icon: React.ReactNode;
  variant: 'primary' | 'secondary' | 'outline';
}

interface QuickLinksProps {
  links?: QuickLink[];
}

const defaultLinks: QuickLink[] = [
  {
    label: 'Create Quiz',
    path: '/admin/surveys/new',
    icon: <Plus className="w-5 h-5" />,
    variant: 'primary',
  },
  {
    label: 'View Analytics',
    path: '/admin/surveys/all',
    icon: <BarChart3 className="w-5 h-5" />,
    variant: 'secondary',
  },
  {
    label: 'Manage Users',
    path: '/admin/responses/all',
    icon: <Users className="w-5 h-5" />,
    variant: 'outline',
  },
];

const variantStyles = {
  primary: 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200',
  secondary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200',
  outline: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300',
};

export default function QuickLinks({ links = defaultLinks }: QuickLinksProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {links.map((link) => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${variantStyles[link.variant]}`}
          >
            {link.icon}
            <span>{link.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
