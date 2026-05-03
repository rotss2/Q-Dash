import { BuilderMode, ModeConfig } from '../../config/builderModes';

interface PreviewTabProps {
  mode: BuilderMode;
  modeConfig: ModeConfig;
}

export default function PreviewTab({
  mode,
  modeConfig,
}: PreviewTabProps) {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
            <span className="text-xl">👁️</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
            <p className="text-sm text-gray-500">See how your {modeConfig.label.toLowerCase()} will look</p>
          </div>
        </div>
        <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <p className="mb-4">Preview mode would show the {modeConfig.label.toLowerCase()} as respondents will see it.</p>
          <p className="text-sm">
            This will display the {modeConfig.label.toLowerCase()} with all {mode === 'exam' ? 'security controls and timer' : 'styling and questions'} applied.
          </p>
        </div>
      </div>
    </div>
  );
}
