import { Plus, FileText } from 'lucide-react';
import { BuilderMode, ModeConfig } from '../../config/builderModes';
import { QuestionType } from '../../types';

interface QuestionsTabProps {
  mode: BuilderMode;
  modeConfig: ModeConfig;
  questions: unknown[];
  showBulkImporter: boolean;
  setShowBulkImporter: (show: boolean) => void;
  addQuestion: (type: QuestionType, options?: string[], blockType?: 'question' | 'heading' | 'instruction' | 'page_break', insertAfterIndex?: number) => void;
}

export default function QuestionsTab({
  mode,
  modeConfig,
  questions,
  showBulkImporter,
  setShowBulkImporter,
  addQuestion,
}: QuestionsTabProps) {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <span className="text-xl">❓</span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">{modeConfig.labels.questions}</h2>
            <p className="text-sm text-gray-500">{questions?.length || 0} items total • Build your {modeConfig.label.toLowerCase()}</p>
          </div>
        </div>
        
        {/* Editor Toolbar */}
        <div className="mb-6 p-5 bg-gray-50/80 rounded-2xl border border-gray-200">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Add:</span>
            <button
              onClick={() => addQuestion('text', [], 'question')}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-sm"
            >
              <span className="text-blue-500">T</span>
              <span className="font-medium">Text</span>
            </button>
            <button
              onClick={() => addQuestion('choice', ['Option 1', 'Option 2'], 'question')}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-sm"
            >
              <span className="text-lg">☐</span>
              <span className="font-medium">Choice</span>
            </button>
            <button
              onClick={() => addQuestion('text', [], 'heading')}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all text-sm"
            >
              <span className="text-lg">H</span>
              <span className="font-medium">Heading</span>
            </button>
            <div className="flex-1"></div>
            <button
              onClick={() => setShowBulkImporter(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition-all text-sm"
            >
              <span className="text-lg">📄</span>
              <span className="font-medium">Bulk Import</span>
            </button>
          </div>
        </div>

        {/* Empty State */}
        {questions.length === 0 && !showBulkImporter && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
            <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
              mode === 'survey' ? 'bg-blue-50' :
              mode === 'quiz' ? 'bg-green-50' :
              'bg-purple-50'
            }`}>
              <Plus className={`w-6 h-6 ${
                mode === 'survey' ? 'text-blue-600' :
                mode === 'quiz' ? 'text-green-600' :
                'text-purple-600'
              }`} />
            </div>
            <h3 className="text-base font-semibold text-gray-900">
              {modeConfig.emptyState.title}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
              {modeConfig.emptyState.description}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => addQuestion('text', [], 'question')}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 ${
                  mode === 'survey' ? 'bg-blue-600 hover:bg-blue-700' :
                  mode === 'quiz' ? 'bg-green-600 hover:bg-green-700' :
                  'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                <Plus className="w-4 h-4" />
                {modeConfig.emptyState.buttonText}
              </button>
              <button
                onClick={() => setShowBulkImporter(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <FileText className="w-4 h-4" />
                Bulk Import
              </button>
            </div>
          </div>
        )}

        {/* Question List Placeholder */}
        {questions.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 text-center py-8">
              Questions list would appear here ({questions.length} questions)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
