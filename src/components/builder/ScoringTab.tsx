import { BuilderMode } from '../../config/builderModes';

interface ScoringTabProps {
  mode: BuilderMode;
  timeLimitMinutes: number | null;
  setTimeLimitMinutes: (value: number | null) => void;
  passingScore: number | null;
  setPassingScore: (value: number | null) => void;
  maxAttempts: number | null;
  setMaxAttempts: (value: number | null) => void;
  showScoreImmediately: boolean;
  setShowScoreImmediately: (value: boolean) => void;
  showCorrectAnswers: boolean;
  setShowCorrectAnswers: (value: boolean) => void;
  showExplanations: boolean;
  setShowExplanations: (value: boolean) => void;
  shuffleQuestions: boolean;
  setShuffleQuestions: (value: boolean) => void;
  shuffleOptions: boolean;
  setShuffleOptions: (value: boolean) => void;
  releaseResultsMode?: 'immediate' | 'after_close' | 'manual';
  setReleaseResultsMode?: (value: 'immediate' | 'after_close' | 'manual') => void;
}

export default function ScoringTab({
  mode,
  timeLimitMinutes,
  setTimeLimitMinutes,
  passingScore,
  setPassingScore,
  maxAttempts,
  setMaxAttempts,
  showScoreImmediately,
  setShowScoreImmediately,
  showCorrectAnswers,
  setShowCorrectAnswers,
  showExplanations,
  setShowExplanations,
  shuffleQuestions,
  setShuffleQuestions,
  shuffleOptions,
  setShuffleOptions,
  releaseResultsMode,
  setReleaseResultsMode,
}: ScoringTabProps) {
  if (mode === 'survey') return null;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <span className="text-xl">🎯</span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">
              {mode === 'quiz' ? 'Quiz Settings' : 'Exam Settings'}
            </h2>
            <p className="text-sm text-gray-500">
              {mode === 'quiz' ? 'Configure scoring and attempts' : 'Configure scoring, time limits, and result release'}
            </p>
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Time Limit */}
          <div>
            <label className="label">Time Limit (minutes)</label>
            <input
              type="number"
              min="1"
              value={timeLimitMinutes || ''}
              onChange={(e) => setTimeLimitMinutes(e.target.value ? parseInt(e.target.value) : null)}
              className="input"
              placeholder="No limit"
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty for no time limit</p>
          </div>

          {/* Passing Score */}
          <div>
            <label className="label">Passing Score (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={passingScore || ''}
              onChange={(e) => setPassingScore(e.target.value ? parseInt(e.target.value) : null)}
              className="input"
              placeholder="No passing score"
            />
            <p className="text-xs text-gray-500 mt-1">Percentage needed to pass</p>
          </div>

          {/* Max Attempts */}
          <div>
            <label className="label">Max Attempts</label>
            <input
              type="number"
              min="1"
              value={maxAttempts || ''}
              onChange={(e) => setMaxAttempts(e.target.value ? parseInt(e.target.value) : null)}
              className="input"
              placeholder="Unlimited"
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty for unlimited</p>
          </div>
        </div>

        {/* Quiz/Exam Toggles */}
        <div className="mt-6 pt-6 border-t border-gray-200 grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showScoreImmediately}
              onChange={(e) => setShowScoreImmediately(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">Show Score Immediately</span>
              <p className="text-xs text-gray-500">Show score right after submission</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showCorrectAnswers}
              onChange={(e) => setShowCorrectAnswers(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">Show Correct Answers</span>
              <p className="text-xs text-gray-500">Reveal correct answers after submission</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showExplanations}
              onChange={(e) => setShowExplanations(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">Show Explanations</span>
              <p className="text-xs text-gray-500">Show answer explanations after submission</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={shuffleQuestions}
              onChange={(e) => setShuffleQuestions(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">Shuffle Questions</span>
              <p className="text-xs text-gray-500">Randomize question order</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={shuffleOptions}
              onChange={(e) => setShuffleOptions(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="font-medium text-gray-900">Shuffle Options</span>
              <p className="text-xs text-gray-500">Randomize answer options</p>
            </div>
          </label>
        </div>

        {/* Result Release Mode - Only for Exam */}
        {mode === 'exam' && setReleaseResultsMode && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <label className="label">Result Release Mode</label>
            <select
              value={releaseResultsMode || 'immediate'}
              onChange={(e) => setReleaseResultsMode(e.target.value as 'immediate' | 'after_close' | 'manual')}
              className="input"
            >
              <option value="immediate">Immediate - Show results right after submission</option>
              <option value="after_close">After Close - Show results when exam closes</option>
              <option value="manual">Manual - Admin releases results manually</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
