import { useState, useCallback } from 'react';
import { Plus, X, Check, FileText } from 'lucide-react';

type QuestionType = 'text' | 'choice' | 'likert';

interface ParsedQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options: string[];
}

const detectQuestionType = (text: string): QuestionType => {
  const lower = text.toLowerCase();

  const booleanTriggers = [/^(do you\b)/i, /^(would you\b)/i, /^(have you\b)/i, /^(is it\b)/i, /^(are you\b)/i, /^(should you\b)/i, /^(can you\b)/i, /^(will you\b)/i];
  if (booleanTriggers.some((pattern) => pattern.test(text.trim())) || text.trim().endsWith('?')) {
    return 'choice';
  }
  if (lower.includes('rate') || lower.includes('scale') || lower.includes('level')) return 'likert';
  return 'text';
};

const defaultOptionsForType = (type: QuestionType) => {
  if (type === 'choice') return ['Option 1', 'Option 2'];
  if (type === 'likert') return ['1', '2', '3', '4', '5'];
  return [];
};

const cleanQuestionText = (text: string): string => {
  return text
    .replace(/^(\s*[\d]+[\.\)\-]\s*)/, '')
    .replace(/^(\s*[-•*]\s*)/, '')
    .trim();
};

// Check if text looks like a valid question
const isValidQuestion = (text: string): boolean => {
  const trimmed = text.trim();
  
  // Too short
  if (trimmed.length < 10) return false;
  
  // Too long (probably a paragraph)
  if (trimmed.length > 200) return false;
  
  // Just numbers/symbols
  if (/^[\d\s\W]+$/.test(trimmed)) return false;
  
  // Common non-question headers/labels
  const nonQuestionPatterns = [
    /^thank/i, /^please/i, /^note:/i, /^important:/i, /^disclaimer/i,
    /^warning/i, /^section/i, /^part\s+\d/i, /^step\s+\d/i,
    /^introduction/i, /^conclusion/i, /^summary/i, /^feedback/i,
    /^comments?/i, /^additional/i, /^optional/i, /^required/i,
    /^instructions?/i, /^directions?/i, /^guidelines?/i, /^information/i,
    /^details/i, /^description/i, /^notes/i, /^tips/i, /^hints/i,
    /^example/i, /^sample/i, /^demo/i, /^test/i,
    /^click/i, /^press/i, /^enter/i, /^type/i, /^select/i,
    /^choose/i, /^pick/i, /^fill/i, /^complete/i, /^submit/i,
    /^save/i, /^next/i, /^previous/i, /^back/i, /^continue/i,
    /^finish/i, /^done/i, /^start/i, /^begin/i, /^end/i, /^close/i,
    /^exit/i, /^cancel/i, /^delete/i, /^remove/i, /^add/i, /^edit/i,
    /^update/i, /^modify/i, /^change/i, /^create/i, /^make/i,
    /^generate/i, /^produce/i, /^develop/i, /^build/i, /^construct/i,
    /^design/i, /^form/i, /^shape/i, /^structure/i, /^organize/i,
    /^arrange/i, /^order/i, /^sort/i, /^group/i, /^classify/i,
    /^categorize/i, /^label/i, /^tag/i, /^mark/i, /^identify/i,
    /^recognize/i, /^distinguish/i, /^differentiate/i, /^tell$/i,
    /^name$/i, /^list$/i, /^describe$/i, /^explain$/i, /^what$/i,
  ];
  
  for (const pattern of nonQuestionPatterns) {
    if (pattern.test(trimmed)) return false;
  }
  
  return true;
};

export default function BulkQuestionImporter({
  onImport
}: {
  onImport: (questions: ParsedQuestion[]) => void;
}) {
  const [rawText, setRawText] = useState('');
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [totalLines, setTotalLines] = useState(0);
  const [globalType, setGlobalType] = useState<QuestionType>('text');

  const parseText = useCallback((text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    setTotalLines(lines.length);
    
    // Filter valid questions and parse
    const parsed = lines
      .map((line, index) => {
        const cleaned = cleanQuestionText(line);
        const type = detectQuestionType(cleaned);
        const options = defaultOptionsForType(type);
        if (type === 'choice' && /^(do you\b|would you\b|have you\b|is it\b|are you\b|should you\b|can you\b|will you\b)/i.test(cleaned.trim())) {
          options.splice(0, options.length, 'Yes', 'No');
        }
        return {
          id: `bulk-${index}-${Date.now()}`,
          text: cleaned,
          type,
          options
        };
      })
      .filter(q => isValidQuestion(q.text)); // Only keep valid questions
    
    setQuestions(parsed);
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setRawText(text);
    parseText(text);
  };

  const updateQuestionType = (id: string, type: QuestionType) => {
    setQuestions(prev => prev.map(q => 
      q.id === id ? { ...q, type } : q
    ));
  };

  const updateQuestionText = (id: string, text: string) => {
    setQuestions(prev => prev.map(q => 
      q.id === id ? { ...q, text } : q
    ));
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    setQuestions(prev => prev.map(q => 
      q.id === questionId 
        ? { ...q, options: q.options.map((opt, i) => i === optionIndex ? value : opt) }
        : q
    ));
  };

  const addOption = (questionId: string) => {
    setQuestions(prev => prev.map(q => 
      q.id === questionId 
        ? { ...q, options: [...q.options, `Option ${q.options.length + 1}`] }
        : q
    ));
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    setQuestions(prev => prev.map(q => 
      q.id === questionId && q.options.length > 2
        ? { ...q, options: q.options.filter((_, i) => i !== optionIndex) }
        : q
    ));
  };

  const removeQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const applyGlobalType = () => {
    setQuestions(prev => prev.map(q => ({ ...q, type: globalType })));
  };

  const handleImport = () => {
    if (questions.length === 0) return;
    onImport(questions);
    setRawText('');
    setQuestions([]);
  };

  const getTypeLabel = (type: QuestionType) => {
    switch (type) {
      case 'text': return 'Short Text';
      case 'choice': return 'Multiple Choice / Boolean';
      case 'likert': return 'Scaling (Likert)';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-5 h-5 text-slate-700" />
          <h2 className="text-lg font-semibold text-slate-900">Bulk Question Importer</h2>
        </div>
        <p className="text-sm text-slate-600">
          Paste multiple questions (one per line). Leading numbers and bullets will be auto-removed.
        </p>
      </div>

      {/* Input Area */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-900">Paste Questions</label>
        <textarea
          value={rawText}
          onChange={handleTextChange}
          placeholder="1. How satisfied are you with our service?&#10;2. Rate the quality of support&#10;3. Would you recommend us?&#10;- Any additional comments?"
          className="w-full h-40 p-3 border border-gray-200 rounded text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 resize-none"
        />
        <p className="text-xs text-slate-500">
          {questions.length} question{questions.length !== 1 ? 's' : ''} detected
          {totalLines > questions.length && ` (${totalLines - questions.length} non-question lines filtered)`}
        </p>
      </div>

      {/* Global Method */}
      {questions.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200">
          <span className="text-sm font-medium text-slate-900">Set All To:</span>
          <select
            value={globalType}
            onChange={(e) => setGlobalType(e.target.value as QuestionType)}
            className="px-3 py-1.5 border border-gray-200 rounded text-sm text-slate-900 bg-white focus:outline-none focus:border-slate-400"
          >
            <option value="text">Short Text</option>
            <option value="choice">Multiple Choice / Boolean</option>
            <option value="likert">Scaling (Likert)</option>
          </select>
          <button
            type="button"
            onClick={applyGlobalType}
            className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-gray-200 hover:bg-gray-50"
          >
            Apply
          </button>
        </div>
      )}

      {/* Question Cards */}
      <div className="space-y-3">
        {questions.map((q, index) => (
          <div key={q.id} className="border border-gray-200 bg-white">
            {/* Card Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50">
              <span className="text-sm font-medium text-slate-500 w-8">#{index + 1}</span>
              
              <select
                value={q.type}
                onChange={(e) => updateQuestionType(q.id, e.target.value as QuestionType)}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded text-sm text-slate-900 bg-white focus:outline-none focus:border-slate-400"
              >
                <option value="text">Short Text</option>
                <option value="choice">Multiple Choice / Boolean</option>
                <option value="likert">Scaling (Likert)</option>
              </select>
              
              <button
                onClick={() => removeQuestion(q.id)}
                className="p-1.5 text-slate-400 hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Card Body */}
            <div className="p-4 space-y-4">
              {/* Question Text */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Question</label>
                <input
                  type="text"
                  value={q.text}
                  onChange={(e) => updateQuestionText(q.id, e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded text-slate-900 focus:outline-none focus:border-slate-400"
                />
              </div>
              
              {/* Options for Multiple Choice */}
              {q.type === 'choice' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Options</label>
                  {q.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(q.id, i, e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-gray-200 rounded text-sm text-slate-900 focus:outline-none focus:border-slate-400"
                      />
                      <button
                        onClick={() => removeOption(q.id, i)}
                        disabled={q.options.length <= 2}
                        className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addOption(q.id)}
                    className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
                  >
                    <Plus className="w-4 h-4" />
                    Add Option
                  </button>
                </div>
              )}
              
              {/* Type Preview */}
              <div className="pt-2 border-t border-gray-100">
                <span className="text-xs text-slate-500">
                  Type: <span className="font-medium text-slate-700">{getTypeLabel(q.type)}</span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Import Button */}
      {questions.length > 0 && (
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
          >
            <Check className="w-4 h-4" />
            Import {questions.length} Question{questions.length !== 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}
