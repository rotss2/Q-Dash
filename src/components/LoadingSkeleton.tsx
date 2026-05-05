import React from 'react';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export const SkeletonCard: React.FC<SkeletonProps> = ({ className = '', count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`bg-white rounded-2xl border border-gray-100 p-6 animate-pulse ${className}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-3">
              <div className="h-5 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              <div className="flex gap-4">
                <div className="h-4 bg-gray-200 rounded w-24" />
                <div className="h-4 bg-gray-200 rounded w-24" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="w-10 h-10 bg-gray-200 rounded-lg" />
              <div className="w-10 h-10 bg-gray-200 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

export const SkeletonStat: React.FC<SkeletonProps> = ({ className = '', count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`bg-white rounded-2xl border border-gray-100 p-5 animate-pulse ${className}`}
        >
          <div className="flex flex-col gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-xl" />
            <div>
              <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="p-4 border-b border-gray-100">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 rounded flex-1" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="p-4 border-b border-gray-50 last:border-0">
          <div className="flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, colIdx) => (
              <div
                key={colIdx}
                className="h-4 bg-gray-200 rounded flex-1"
                style={{ width: `${Math.random() * 30 + 70}%` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 3, 
  className = '' 
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-200 rounded animate-pulse"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
};

export const SkeletonCircle: React.FC<{ size?: number; className?: string }> = ({ 
  size = 40, 
  className = '' 
}) => {
  return (
    <div
      className={`bg-gray-200 rounded-full animate-pulse ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

export const SkeletonPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <SkeletonText lines={2} className="w-64" />
          <SkeletonCircle size={40} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonStat count={4} />
        </div>
        <SkeletonTable rows={5} cols={4} />
      </div>
    </div>
  );
};

export default {
  Card: SkeletonCard,
  Stat: SkeletonStat,
  Table: SkeletonTable,
  Text: SkeletonText,
  Circle: SkeletonCircle,
  Page: SkeletonPage,
};
