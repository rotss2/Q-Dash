interface DashboardWidgetProps {
  title: string;
  value: string | number;
  suffix?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export default function DashboardWidget({ 
  title, 
  value, 
  suffix, 
  icon,
  trend 
}: DashboardWidgetProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 transition-all hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {suffix && (
              <span className="text-lg text-gray-600">{suffix}</span>
            )}
          </div>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span 
                className={`text-sm font-medium ${
                  trend.isPositive ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {trend.isPositive ? '+' : '-'}{trend.value}%
              </span>
              <span className="text-sm text-gray-400">vs last week</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
