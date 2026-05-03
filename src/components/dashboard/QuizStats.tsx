import { useEffect, useState } from 'react';
import { Trophy, Target, TrendingUp, RefreshCw } from 'lucide-react';

interface QuizData {
  activeQuizzes: number;
  completionRate: number;
  averageScore: number;
}

interface QuizStatsProps {
  data?: QuizData;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export default function QuizStats({ 
  data, 
  isLoading = false,
  onRefresh 
}: QuizStatsProps) {
  const [animatedCompletion, setAnimatedCompletion] = useState(0);
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    if (data) {
      // Animate the numbers
      const duration = 1000;
      const steps = 30;
      const completionStep = data.completionRate / steps;
      const scoreStep = data.averageScore / steps;
      let currentStep = 0;

      const timer = setInterval(() => {
        currentStep++;
        setAnimatedCompletion(Math.min(Math.round(completionStep * currentStep), data.completionRate));
        setAnimatedScore(Math.min(Math.round(scoreStep * currentStep * 10) / 10, data.averageScore));
        
        if (currentStep >= steps) {
          clearInterval(timer);
          setAnimatedCompletion(data.completionRate);
          setAnimatedScore(data.averageScore);
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [data]);

  return (
    <div className="bg-white rounded-xl shadow-md p-6 h-96">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="text-lg font-semibold text-gray-900">Quiz & Exam Metrics</h3>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : (
        <div className="h-64 flex flex-col">
          {data ? (
            <div className="grid grid-cols-1 gap-4 flex-1">
              {/* Active Quizzes */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-transparent rounded-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{data.activeQuizzes}</p>
                  <p className="text-sm text-gray-500">Active Quizzes</p>
                </div>
              </div>

              {/* Completion Rate */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50 to-transparent rounded-lg">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-1">
                    <p className="text-2xl font-bold text-gray-900">{animatedCompletion}%</p>
                  </div>
                  <p className="text-sm text-gray-500">Completion Rate</p>
                  <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                      style={{ width: `${animatedCompletion}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Average Score */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-amber-50 to-transparent rounded-lg">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-1">
                    <p className="text-2xl font-bold text-gray-900">{animatedScore.toFixed(1)}%</p>
                  </div>
                  <p className="text-sm text-gray-500">Average Score</p>
                  <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                      style={{ width: `${animatedScore}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <Trophy className="w-12 h-12 mb-3 opacity-50" />
              <p>No quiz data available</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
