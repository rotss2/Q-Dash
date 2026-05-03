import { useEffect, useState, useCallback, useRef } from 'react';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { RefreshCw, BarChart3, LineChart, PieChart } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

type ChartType = 'bar' | 'line' | 'pie';

interface DatasetConfig {
  label: string;
  data: number[];
  backgroundColor: string;
  borderColor: string;
  borderWidth?: number;
  type: ChartType;
  yAxisID?: string;
}

interface MappedChartData {
  labels: string[];
  datasets: DatasetConfig[];
}

/**
 * Utility: dynamically maps Supabase data to Chart.js mixed-chart format
 * @param data Array of Supabase records
 * @param xField Optional X-axis field (defaults to first string field)
 * @returns Chart.js data object with multiple datasets and mixed chart types
 */
const mapToChartJsMixed = (data: Record<string, unknown>[], xField?: string): MappedChartData => {
  if (!data || data.length === 0) return { labels: [], datasets: [] };

  const firstItem = data[0];
  const allFields = Object.keys(firstItem);
  
  const stringFields = allFields.filter(k => {
    const val = firstItem[k];
    return typeof val === 'string' && !isNumericString(val);
  });
  
  const numericFields = allFields.filter(k => {
    const val = firstItem[k];
    return typeof val === 'number' || (typeof val === 'string' && isNumericString(val));
  });

  const xKey = xField || stringFields[0] || 'id';

  const colorPalette = [
    { bg: 'rgba(59, 130, 246, 0.5)', border: 'rgb(59, 130, 246)' },
    { bg: 'rgba(16, 185, 129, 0.5)', border: 'rgb(16, 185, 129)' },
    { bg: 'rgba(245, 158, 11, 0.5)', border: 'rgb(245, 158, 11)' },
    { bg: 'rgba(239, 68, 68, 0.5)', border: 'rgb(239, 68, 68)' },
    { bg: 'rgba(139, 92, 246, 0.5)', border: 'rgb(139, 92, 246)' },
    { bg: 'rgba(236, 72, 153, 0.5)', border: 'rgb(236, 72, 153)' },
    { bg: 'rgba(6, 182, 212, 0.5)', border: 'rgb(6, 182, 212)' },
    { bg: 'rgba(249, 115, 22, 0.5)', border: 'rgb(249, 115, 22)' },
  ];

  const datasets: DatasetConfig[] = numericFields.map((numField, index) => {
    const colors = colorPalette[index % colorPalette.length];
    
    let type: ChartType = 'bar';
    const fieldLower = numField.toLowerCase();
    
    if (fieldLower.includes('trend') || fieldLower.includes('line') || 
        fieldLower.includes('avg') || fieldLower.includes('average') ||
        fieldLower.includes('history') || fieldLower.includes('time')) {
      type = 'line';
    } else if (fieldLower.includes('percentage') || fieldLower.includes('share') || 
               fieldLower.includes('distribution') || fieldLower.includes('ratio')) {
      type = 'pie';
    }

    const values = data.map(item => {
      const val = item[numField];
      if (typeof val === 'number') return val;
      if (typeof val === 'string' && isNumericString(val)) return parseFloat(val);
      return 0;
    });

    return {
      label: numField.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      data: values,
      backgroundColor: type === 'line' ? colors.border : colors.bg,
      borderColor: colors.border,
      borderWidth: 2,
      type,
      yAxisID: type === 'line' ? 'y-line' : 'y-bar',
    };
  });

  const labels = data.map(item => {
    const val = item[xKey];
    return typeof val === 'string' ? val : String(val);
  });

  return { labels, datasets };
};

/**
 * Check if a string value is numeric
 */
const isNumericString = (value: string): boolean => {
  if (!value) return false;
  return !isNaN(parseFloat(value)) && isFinite(Number(value));
};

/**
 * Deduplicate array by key (id by default)
 */
const deduplicateById = <T extends Record<string, unknown>>(
  data: T[], 
  key = 'id'
): T[] => {
  const seen = new Set<string>();
  return data.filter(item => {
    const id = String(item[key] ?? '');
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

type TableName = keyof Database['public']['Tables'];

interface AnalyticsDashboardProps {
  tableName: TableName;
  xField?: string;
  title?: string;
  refreshInterval?: number;
}

const AnalyticsDashboard = ({ 
  tableName, 
  xField, 
  title = 'Analytics Dashboard',
  refreshInterval = 0 
}: AnalyticsDashboardProps) => {
  const [chartData, setChartData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isMountedRef = useRef(true);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch initial data from Supabase
   */
  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      
      if (fetchError) throw fetchError;
      
      if (isMountedRef.current) {
        const uniqueData = deduplicateById(data || []);
        setChartData(uniqueData);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Initial fetch error:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [tableName]);

  /**
   * Hard refresh - re-fetch all data
   */
  const handleHardRefresh = useCallback(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  /**
   * Update chart data based on realtime payload
   */
  const updateChartData = useCallback((payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new: Record<string, unknown>;
    old: Record<string, unknown>;
  }) => {
    setChartData(prev => {
      let updatedData = [...prev];
      const targetId = payload.new?.id ?? payload.old?.id;
      const index = updatedData.findIndex(item => item.id === targetId);

      switch (payload.eventType) {
        case 'INSERT': {
          if (index === -1 && payload.new) {
            updatedData = [payload.new, ...updatedData];
          }
          break;
        }
        case 'UPDATE': {
          if (index !== -1 && payload.new) {
            updatedData[index] = { ...updatedData[index], ...payload.new };
          } else if (payload.new) {
            updatedData = [payload.new, ...updatedData];
          }
          break;
        }
        case 'DELETE': {
          if (index !== -1) {
            updatedData.splice(index, 1);
          }
          break;
        }
      }

      return deduplicateById(updatedData);
    });
    
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    
    fetchInitialData();

    // Setup realtime subscription using modern channel API
    const channel = supabase
      .channel(`analytics-${tableName}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
        },
        (payload) => {
          if (!isMountedRef.current) return;
          
          updateChartData({
            eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            new: payload.new as Record<string, unknown>,
            old: payload.old as Record<string, unknown>,
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`AnalyticsDashboard: Subscribed to ${tableName}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`AnalyticsDashboard: Channel error for ${tableName}`);
        }
      });

    channelRef.current = channel;

    // Optional refresh interval
    if (refreshInterval > 0) {
      refreshTimerRef.current = setInterval(() => {
        if (isMountedRef.current) {
          fetchInitialData();
        }
      }, refreshInterval);
    }

    return () => {
      isMountedRef.current = false;
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [tableName, fetchInitialData, updateChartData, refreshInterval]);

  const chartJsData = mapToChartJsMixed(chartData, xField);

  const chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: chartJsData.datasets.some((d: DatasetConfig) => d.type === 'line') 
      ? {
          x: {
            grid: {
              display: false,
            },
          },
          'y-bar': {
            type: 'linear',
            display: true,
            position: 'left',
            grid: {
              color: 'rgba(0, 0, 0, 0.1)',
            },
          },
          'y-line': {
            type: 'linear',
            display: true,
            position: 'right',
            grid: {
              drawOnChartArea: false,
            },
          },
        }
      : {
          x: {
            grid: {
              display: false,
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.1)',
            },
          },
        },
  };

  const getChartTypeIcon = (type: ChartType) => {
    switch (type) {
      case 'line': return <LineChart className="w-4 h-4" />;
      case 'pie': return <PieChart className="w-4 h-4" />;
      default: return <BarChart3 className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="p-8 bg-white rounded-lg shadow-md">
        <div className="flex items-center justify-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
          <span className="text-gray-600">Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-white rounded-lg shadow-md">
        <div className="text-red-500 text-center">
          <p className="font-semibold">Error loading analytics</p>
          <p className="text-sm mt-1">{error}</p>
          <button
            onClick={handleHardRefresh}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-500 mt-1">
            Table: <code className="bg-gray-100 px-2 py-1 rounded">{tableName}</code>
            {lastUpdated && (
              <span className="ml-3">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleHardRefresh}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          title="Hard refresh"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {chartData.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No data available</p>
        </div>
      ) : chartJsData.datasets.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No numeric fields detected for visualization</p>
          <p className="text-sm mt-2">
            Detected fields: {Object.keys(chartData[0] || {}).join(', ')}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {chartJsData.datasets.map((dataset, idx) => (
              <div
                key={idx}
                className="flex items-center space-x-2 px-3 py-1 bg-gray-50 rounded-full text-sm"
              >
                {getChartTypeIcon(dataset.type as ChartType)}
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: dataset.borderColor as string }}
                />
                <span className="text-gray-700">{dataset.label}</span>
                <span className="text-xs text-gray-400">({dataset.type})</span>
              </div>
            ))}
          </div>

          <div className="h-96">
            <Chart type="bar" data={chartJsData as unknown as Parameters<typeof Chart>[0]['data']} options={chartOptions} />
          </div>

          <div className="mt-4 text-sm text-gray-500">
            <p>Total records: <strong>{chartData.length}</strong></p>
            <p>Datasets: <strong>{chartJsData.datasets.length}</strong> numeric fields detected</p>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
