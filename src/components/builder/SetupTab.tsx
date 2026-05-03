import { HelpCircle, CheckSquare, GraduationCap, AlertTriangle } from 'lucide-react';
import { BuilderMode, ModeConfig } from '../../config/builderModes';

interface SetupTabProps {
  mode: BuilderMode;
  modeConfig: ModeConfig;
  title: string;
  setTitle: (title: string) => void;
  description: string;
  setDescription: (description: string) => void;
  handleModeChange: (newMode: BuilderMode) => void;
  modeChanged: boolean;
}

export default function SetupTab({
  mode,
  modeConfig,
  title,
  setTitle,
  description,
  setDescription,
  handleModeChange,
  modeChanged,
}: SetupTabProps) {
  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            mode === 'survey' ? 'bg-blue-100' :
            mode === 'quiz' ? 'bg-green-100' :
            'bg-purple-100'
          }`}>
            <span className="text-xl">📋</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
            <p className="text-sm text-gray-500">Define your {modeConfig.label.toLowerCase()} identity</p>
          </div>
        </div>
        <div className="space-y-6">
          <div>
            <label className="label flex items-center gap-1">
              {modeConfig.labels.title}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input text-lg font-medium"
              placeholder={`e.g., ${modeConfig.label} 2024`}
            />
            <p className="text-xs text-gray-500 mt-2">Give your {modeConfig.label.toLowerCase()} a clear, descriptive title.</p>
          </div>
          <div>
            <label className="label">{modeConfig.labels.description}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input min-h-[100px] resize-y"
              placeholder={`Briefly explain the purpose of this ${modeConfig.label.toLowerCase()}...`}
            />
            <p className="text-xs text-gray-500 mt-2">Optional context shown to respondents before they start.</p>
          </div>
        </div>
      </div>

      {/* Mode Selector - Survey / Quiz / Exam */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Assessment Mode</h2>
            <p className="text-sm text-gray-500">Choose your assessment type</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <button
            onClick={() => handleModeChange('survey')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              mode === 'survey'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <HelpCircle className="w-4 h-4 text-blue-600" />
              </div>
              <div className="font-semibold text-gray-900">Survey</div>
            </div>
            <div className="text-xs text-gray-500">Feedback and research. No scoring.</div>
          </button>
          <button
            onClick={() => handleModeChange('quiz')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              mode === 'quiz'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-green-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckSquare className="w-4 h-4 text-green-600" />
              </div>
              <div className="font-semibold text-gray-900">Quiz</div>
            </div>
            <div className="text-xs text-gray-500">Practice assessment with scores.</div>
          </button>
          <button
            onClick={() => handleModeChange('exam')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              mode === 'exam'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-purple-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-purple-600" />
              </div>
              <div className="font-semibold text-gray-900">Exam</div>
            </div>
            <div className="text-xs text-gray-500">Timed formal assessment with security.</div>
          </button>
        </div>
        {modeChanged && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Switching to {modeConfig.label} mode will hide scoring fields, but your scoring data is preserved.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
