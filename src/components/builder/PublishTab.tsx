import { Save, Globe, QrCode } from 'lucide-react';
import { BuilderMode, ModeConfig } from '../../config/builderModes';

interface PublishTabProps {
  mode: BuilderMode;
  modeConfig: ModeConfig;
  questions: unknown[];
  isEditing: boolean;
  isSaving: boolean;
  saveSurvey: () => void;
}

export default function PublishTab({
  mode,
  modeConfig,
  questions,
  isEditing,
  isSaving,
  saveSurvey,
}: PublishTabProps) {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <span className="text-xl">🚀</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Ready to Publish</h2>
            <p className="text-sm text-gray-500">Review and publish your {modeConfig.label.toLowerCase()}</p>
          </div>
        </div>
        
        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <p className="text-2xl font-bold text-gray-900">{questions.length}</p>
            <p className="text-sm text-gray-500">Questions</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <p className="text-2xl font-bold text-gray-900">{modeConfig.label}</p>
            <p className="text-sm text-gray-500">Mode</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <p className="text-2xl font-bold text-gray-900">{isEditing ? 'Draft' : 'New'}</p>
            <p className="text-sm text-gray-500">Status</p>
          </div>
        </div>

        {/* Publish Actions */}
        <div className="p-6 bg-gray-50 rounded-xl">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={saveSurvey}
              disabled={isSaving}
              className={`flex-1 w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-all ${
                mode === 'survey' ? 'bg-blue-600 hover:bg-blue-700' :
                mode === 'quiz' ? 'bg-green-600 hover:bg-green-700' :
                'bg-purple-600 hover:bg-purple-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Save className="w-5 h-5" />
              {isSaving ? `Saving ${modeConfig.label}...` : (isEditing ? modeConfig.labels.save : modeConfig.labels.create)}
            </button>
            
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-sm font-medium text-gray-700">
                <Globe className="w-4 h-4" />
                Copy Link
              </button>
              <button className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-sm font-medium text-gray-700">
                <QrCode className="w-4 h-4" />
                QR Code
              </button>
            </div>
          </div>
          
          <p className="mt-4 text-sm text-gray-500 text-center">
            After publishing, you can share the link or embed the {modeConfig.label.toLowerCase()} on your website.
          </p>
        </div>
      </div>
    </div>
  );
}
