import { useState, useCallback, useMemo } from 'react';
import { Plus, X, Check, FileText, Eye, Trash2, Upload, AlertCircle, CheckCircle, Copy, RefreshCw, Wand2 } from 'lucide-react';
import { HighCapacityProcessor, ProcessingStats } from '../lib/highCapacityProcessor';

type QuestionType = 'text' | 'choice' | 'likert';
type ImportTab = 'paste' | 'validate' | 'preview' | 'import';

interface ParsedQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options: string[];
  required?: boolean;
  validationError?: string;
  validationWarning?: string;
  section?: string;
  needsManualReview?: boolean;
  reviewReason?: string;
  duplicates?: string[];
}

interface ValidationIssue {
  id: string;
  type: 'error' | 'warning';
  message: string;
  suggestion?: string;
}


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

// Validation Functions (Option 9)
const validateQuestion = (q: ParsedQuestion, allQuestions: ParsedQuestion[]): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  
  // Check for duplicates
  const duplicates = allQuestions.filter(other => 
    other.id !== q.id && 
    other.text.toLowerCase().trim() === q.text.toLowerCase().trim()
  );
  if (duplicates.length > 0) {
    issues.push({
      id: q.id,
      type: 'error',
      message: 'Duplicate question detected',
      suggestion: 'Remove or rephrase this question'
    });
  }
  
  // Check for biased/leading language
  const biasedPatterns = [
    { pattern: /\b(excellent|amazing|fantastic|best)\b/i, message: 'Contains positively loaded words' },
    { pattern: /\b(terrible|awful|worst|horrible)\b/i, message: 'Contains negatively loaded words' },
    { pattern: /\b(don't you think|isn't it|shouldn't we)\b/i, message: 'Leading question structure' },
  ];
  
  biasedPatterns.forEach(({ pattern, message }) => {
    if (pattern.test(q.text)) {
      issues.push({
        id: q.id,
        type: 'warning',
        message,
        suggestion: 'Consider neutral phrasing for unbiased results'
      });
    }
  });
  
  // Check for proper grammar
  if (!q.text.endsWith('?') && q.type === 'choice') {
    issues.push({
      id: q.id,
      type: 'warning',
      message: 'Question may be missing a question mark',
      suggestion: 'Add ? at the end for clarity'
    });
  }
  
  // Check length
  if (q.text.length < 10) {
    issues.push({
      id: q.id,
      type: 'error',
      message: 'Question is too short',
      suggestion: 'Add more detail to make it clear'
    });
  }
  
  if (q.text.length > 200) {
    issues.push({
      id: q.id,
      type: 'warning',
      message: 'Question is quite long',
      suggestion: 'Consider breaking into smaller questions'
    });
  }
  
  // Check options balance for choice questions
  if (q.type === 'choice' && q.options.length > 0) {
    const positiveCount = q.options.filter(o => /\b(yes|agree|good|positive|satisfied)\b/i.test(o)).length;
    const negativeCount = q.options.filter(o => /\b(no|disagree|bad|negative|dissatisfied)\b/i.test(o)).length;
    
    if (positiveCount > 0 && negativeCount === 0) {
      issues.push({
        id: q.id,
        type: 'warning',
        message: 'Options appear one-sided (only positive)',
        suggestion: 'Add balanced negative options'
      });
    }
    if (negativeCount > 0 && positiveCount === 0) {
      issues.push({
        id: q.id,
        type: 'warning',
        message: 'Options appear one-sided (only negative)',
        suggestion: 'Add balanced positive options'
      });
    }
  }
  
  return issues;
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
  const [activeTab, setActiveTab] = useState<ImportTab>('paste');
  const [rawText, setRawText] = useState('');
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [totalLines, setTotalLines] = useState(0);
  const [globalType, setGlobalType] = useState<QuestionType>('text');
  const [showAutoFix, setShowAutoFix] = useState(true);
  
  // Super Genius processing state - reserved for future use
  const [, setIsSuperGeniusMode] = useState(false);
  const [, setIsProcessing] = useState(false);
  const [, setProcessingStats] = useState<ProcessingStats | null>(null);
  const [, setProcessingProgress] = useState(0);
  
  // Validation state
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

  // Super Genius processing with high-capacity handling
  const parseText = useCallback(async (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    setTotalLines(lines.length);
    
    // Check if we should use Super Genius mode
    const questionCount = lines.filter(line => 
      /^(Question|Q\d*|Boolean|Multiple Choice|Yes\/No|Options|Expected Answer|Correct Answer)/i.test(line.trim()) ||
      /^\d+[\.\)]\s*/.test(line.trim()) ||
      /^[A-Z]\)[\s]*/.test(line.trim())
    ).length;
    
    const shouldUseSuperGenius = questionCount > 10 || text.length > 2000;
    setIsSuperGeniusMode(shouldUseSuperGenius);
    
    if (shouldUseSuperGenius) {
      // Use Super Genius processing
      setIsProcessing(true);
      setProcessingProgress(0);
      
      try {
        const result = await HighCapacityProcessor.processLargeDataset(text);
        
        // Convert ProcessedQuestion to ParsedQuestion format
        const parsed: ParsedQuestion[] = result.questions.map(q => ({
          id: q.id,
          text: q.text,
          type: q.type as QuestionType,
          options: q.options,
          required: false,
          section: q.section,
          needsManualReview: q.needsManualReview,
          reviewReason: q.reviewReason,
          duplicates: q.duplicates
        }));
        
        setQuestions(parsed);
        setProcessingStats(result.stats);
        setSelectedQuestions(new Set());
        
      } catch (error) {
        console.error('Super Genius processing failed:', error);
        // Fallback to simple processing
        fallbackProcessing(text);
      } finally {
        setIsProcessing(false);
        setProcessingProgress(100);
      }
    } else {
      // Use simple processing for smaller datasets
      fallbackProcessing(text);
    }
  }, []);
  
  // Fallback processing for smaller datasets
  const fallbackProcessing = useCallback((text: string) => {
    // Group lines into question blocks using regex patterns
    const questionBlocks: string[] = [];
    let currentBlock = '';
    
    const lines = text.split('\n').filter(line => line.trim());
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this line starts a new question block
      const isQuestionStart = /^(Question:|Boolean|Multiple Choice|Yes\/No|Options:|Expected Answer:|Correct Answer:)/i.test(line);
      
      if (isQuestionStart && currentBlock) {
        // Save previous block and start new one
        questionBlocks.push(currentBlock.trim());
        currentBlock = line;
      } else {
        // Add to current block
        currentBlock += (currentBlock ? '\n' : '') + line;
      }
    }
    
    // Don't forget the last block
    if (currentBlock) {
      questionBlocks.push(currentBlock.trim());
    }
    
    // Parse each question block
    const parsed = questionBlocks.map((block, index) => {
      // Extract question text
      const questionMatch = block.match(/Question:\s*(.+?)(?=\n(?:Options:|Expected Answer:|Correct Answer:)|$)/i);
      let questionText = questionMatch ? questionMatch[1].trim() : block;
      
      // Strip category labels like "Boolean (Technical):"
      questionText = questionText.replace(/^(Boolean|Multiple Choice|Yes\/No|Options|Technical|Contextual|Theoretical|Security|Logic)\s*\(?\w*\)?:\s*/i, '').trim();
      
      // Extract options
      let options: string[] = [];
      const optionsMatch = block.match(/Options:\s*\[(.+?)\]/i);
      if (optionsMatch) {
        // Parse [A] Option1, [B] Option2 format
        const optionsText = optionsMatch[1];
        options = optionsText.split(/\s*,\s*\[?\w*\]?\s*/).filter(opt => opt.trim());
      }
      
      // Extract expected/correct answer (for reference, not used in current implementation)
      // Note: Could extract answer here for future features like validation
      
      // Determine question type
      let type: QuestionType = 'text';
      if (options.length > 0) {
        type = 'choice';
      } else if (/^(do you|would you|have you|is it|are you|should you|can you|will you|does the|are the|is the)/i.test(questionText)) {
        type = 'choice';
        options = ['Yes', 'No'];
      } else if (questionText.toLowerCase().includes('rate') || questionText.toLowerCase().includes('scale')) {
        type = 'likert';
        options = ['1', '2', '3', '4', '5'];
      }
      
      // Clean question text
      questionText = cleanQuestionText(questionText);
      
      return {
        id: `bulk-${index}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        text: questionText,
        type,
        options,
        required: false
      };
    }).filter(q => isValidQuestion(q.text));
    
    setQuestions(parsed);
    setSelectedQuestions(new Set()); // Clear selection on new parse
  }, []);

  // Run validation when questions change
  useMemo(() => {
    const allIssues: ValidationIssue[] = [];
    questions.forEach(q => {
      const issues = validateQuestion(q, questions);
      allIssues.push(...issues);
    });
    setValidationIssues(allIssues);
  }, [questions]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setRawText(text);
    parseText(text);
  };

  // Batch Operations (Option 10)
  const toggleSelectAll = () => {
    if (selectedQuestions.size === questions.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(questions.map(q => q.id)));
    }
  };

  const toggleSelectQuestion = (id: string) => {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedQuestions(newSelected);
  };

  const deleteSelected = () => {
    setQuestions(prev => prev.filter(q => !selectedQuestions.has(q.id)));
    setSelectedQuestions(new Set());
  };

  const setSelectedType = (type: QuestionType) => {
    setQuestions(prev => prev.map(q => 
      selectedQuestions.has(q.id) ? { ...q, type, options: defaultOptionsForType(type) } : q
    ));
  };

  const duplicateSelected = () => {
    const toDuplicate = questions.filter(q => selectedQuestions.has(q.id));
    const newQuestions = toDuplicate.map(q => ({
      ...q,
      id: `${q.id}-copy-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text: `${q.text} (Copy)`
    }));
    setQuestions(prev => [...prev, ...newQuestions]);
  };

  // Auto-fix issues (Option 9)
  const autoFixIssues = () => {
    let fixedCount = 0;
    
    setQuestions(prev => prev.map(q => {
      let newText = q.text;
      let modified = false;
      
      // Fix missing question marks
      if (!newText.endsWith('?') && q.type === 'choice') {
        newText = newText + '?';
        modified = true;
      }
      
      // Fix excessive whitespace
      if (/\s{2,}/.test(newText)) {
        newText = newText.replace(/\s{2,}/g, ' ');
        modified = true;
      }
      
      if (modified) {
        fixedCount++;
      }
      
      return { ...q, text: newText };
    }));
    
    return fixedCount;
  };

  const updateQuestionType = (id: string, type: QuestionType) => {
    setQuestions(prev => prev.map(q => 
      q.id === id ? { ...q, type, options: defaultOptionsForType(type) } : q
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
    setSelectedQuestions(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const applyGlobalType = () => {
    setQuestions(prev => prev.map(q => 
      selectedQuestions.has(q.id) ? { ...q, type: globalType, options: defaultOptionsForType(globalType) } : q
    ));
  };

  const handleImport = () => {
    if (questions.length === 0) return;
    onImport(questions);
    setRawText('');
    setQuestions([]);
    setSelectedQuestions(new Set());
    setValidationIssues([]);
  };

  const getTypeLabel = (type: QuestionType) => {
    switch (type) {
      case 'text': return 'Short Text';
      case 'choice': return 'Multiple Choice / Boolean';
      case 'likert': return 'Scaling (Likert)';
    }
  };

  // Get issues for a specific question
  const getIssuesForQuestion = (id: string): ValidationIssue[] => {
    return validationIssues.filter(issue => issue.id === id);
  };

  // Render validation summary
  const renderValidationSummary = () => {
    const errors = validationIssues.filter(i => i.type === 'error');
    const warnings = validationIssues.filter(i => i.type === 'warning');
    
    return (
      <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {errors.length > 0 && (
              <span className="flex items-center gap-1 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                {errors.length} error{errors.length !== 1 ? 's' : ''}
              </span>
            )}
            {warnings.length > 0 && (
              <span className="flex items-center gap-1 text-amber-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
              </span>
            )}
            {errors.length === 0 && warnings.length === 0 && (
              <span className="flex items-center gap-1 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                All questions look good!
              </span>
            )}
          </div>
          {(errors.length > 0 || warnings.length > 0) && showAutoFix && (
            <button
              onClick={() => {
                const fixed = autoFixIssues();
                if (fixed > 0) {
                  alert(`Fixed ${fixed} issue${fixed !== 1 ? 's' : ''} automatically!`);
                } else {
                  alert('No automatic fixes available. Please review manually.');
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white text-sm rounded hover:bg-slate-800"
            >
              <Wand2 className="w-4 h-4" />
              Auto-Fix Issues
            </button>
          )}
        </div>
      </div>
    );
  };

  // Render live preview (Option 11)
  const renderPreview = () => {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <p className="text-sm text-blue-700">
            <Eye className="w-4 h-4 inline mr-1" />
            This is how your questions will appear to respondents
          </p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-6 max-h-96 overflow-y-auto">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Survey Preview</h3>
          {questions.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No questions to preview</p>
          ) : (
            <div className="space-y-4">
              {questions.map((q, index) => (
                <div key={q.id} className="border-b border-gray-100 pb-4 last:border-0">
                  <p className="font-medium text-slate-900 mb-2">
                    {index + 1}. {q.text}
                    {q.required && <span className="text-red-500 ml-1">*</span>}
                  </p>
                  {q.type === 'text' && (
                    <input 
                      type="text" 
                      disabled 
                      placeholder="Enter your answer..."
                      className="w-full px-3 py-2 border border-gray-200 rounded bg-gray-50 text-sm"
                    />
                  )}
                  {q.type === 'likert' && (
                    <div className="flex gap-2">
                      {['1', '2', '3', '4', '5'].map(num => (
                        <label key={num} className="flex items-center gap-1">
                          <input type="radio" disabled name={q.id} className="w-4 h-4" />
                          <span className="text-sm">{num}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === 'choice' && (
                    <div className="space-y-2">
                      {q.options.map((opt, i) => (
                        <label key={i} className="flex items-center gap-2">
                          <input type="radio" disabled name={q.id} className="w-4 h-4" />
                          <span className="text-sm">{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button disabled className="w-full py-2.5 bg-gray-300 text-white rounded font-medium">
                Submit Survey
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render external import (Option 12)
  const renderExternalImport = () => {
    return (
      <div className="space-y-4">
        <div className="bg-gray-50 border border-gray-200 rounded p-4">
          <h3 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import from External Sources
          </h3>
          
          <div className="space-y-3">
            <div className="p-3 bg-white border border-gray-200 rounded">
              <p className="text-sm font-medium text-slate-900">Google Forms</p>
              <p className="text-xs text-slate-500 mb-2">Paste a Google Forms URL or exported CSV</p>
              <input 
                type="text" 
                placeholder="https://docs.google.com/forms/d/..."
                className="w-full px-3 py-2 border border-gray-200 rounded text-sm"
                onChange={(e) => {
                  // Future: Implement Google Forms import
                  if (e.target.value.includes('docs.google.com/forms')) {
                    alert('Google Forms import would be implemented here. For now, export as CSV and paste the questions.');
                  }
                }}
              />
            </div>
            
            <div className="p-3 bg-white border border-gray-200 rounded">
              <p className="text-sm font-medium text-slate-900">CSV File Upload</p>
              <p className="text-xs text-slate-500 mb-2">Upload a CSV with columns: Question, Type, Options</p>
              <input 
                type="file" 
                accept=".csv,.txt"
                className="w-full text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const text = event.target?.result as string;
                      if (text) {
                        setRawText(text);
                        parseText(text);
                        setActiveTab('paste');
                      }
                    };
                    reader.readAsText(file);
                  }
                }}
              />
            </div>
            
            <div className="p-3 bg-white border border-gray-200 rounded">
              <p className="text-sm font-medium text-slate-900">Copy from Spreadsheet</p>
              <p className="text-xs text-slate-500">Copy cells from Excel/Google Sheets and paste in the &quot;Paste Questions&quot; tab</p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-center">
          <button
            onClick={() => setActiveTab('paste')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm rounded hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4" />
            Back to Paste Mode
          </button>
        </div>
      </div>
    );
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
          Import multiple questions with validation, batch editing, and preview.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { id: 'paste', label: 'Paste Questions', icon: FileText },
          { id: 'validate', label: 'Validate', icon: AlertCircle, badge: validationIssues.length },
          { id: 'preview', label: 'Preview', icon: Eye },
          { id: 'import', label: 'Import Sources', icon: Upload }
        ].map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as ImportTab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id 
                ? 'border-slate-900 text-slate-900' 
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {badge !== undefined && badge > 0 && (
              <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'paste' && (
          <div className="space-y-4">
            {/* Batch Operations Toolbar (Option 10) */}
            {questions.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded p-3 flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedQuestions.size === questions.length && questions.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  Select All ({selectedQuestions.size}/{questions.length})
                </label>
                
                {selectedQuestions.size > 0 && (
                  <>
                    <div className="h-6 w-px bg-gray-300" />
                    <button
                      onClick={deleteSelected}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 text-sm rounded hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete ({selectedQuestions.size})
                    </button>
                    <button
                      onClick={duplicateSelected}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 text-sm rounded hover:bg-blue-100"
                    >
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </button>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedType(e.target.value as QuestionType);
                          e.target.value = '';
                        }
                      }}
                      className="px-3 py-1.5 border border-gray-200 rounded text-sm text-slate-900"
                    >
                      <option value="">Set Type...</option>
                      <option value="text">Text</option>
                      <option value="choice">Choice</option>
                      <option value="likert">Likert</option>
                    </select>
                  </>
                )}
              </div>
            )}

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
              <div className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded">
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
                  disabled={selectedQuestions.size === 0}
                  className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply to Selected
                </button>
              </div>
            )}

            {/* Question Cards */}
            <div className="space-y-3">
              {questions.map((q, index) => {
                const issues = getIssuesForQuestion(q.id);
                const isSelected = selectedQuestions.has(q.id);
                
                return (
                  <div key={q.id} className={`border rounded bg-white transition-all ${
                    isSelected ? 'border-slate-900 ring-1 ring-slate-900' : 'border-gray-200'
                  }`}>
                    {/* Card Header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectQuestion(q.id)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
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
                    
                    {/* Validation Issues */}
                    {issues.length > 0 && (
                      <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                        {issues.map((issue, i) => (
                          <div key={i} className={`flex items-start gap-2 text-sm ${
                            issue.type === 'error' ? 'text-red-600' : 'text-amber-600'
                          }`}>
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <p>{issue.message}</p>
                              {issue.suggestion && (
                                <p className="text-xs opacity-80 mt-0.5">{issue.suggestion}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Card Body */}
                    <div className="p-4 space-y-4">
                      {/* Question Text */}
                      <div>
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Question</label>
                        <input
                          type="text"
                          value={q.text}
                          onChange={(e) => updateQuestionText(q.id, e.target.value)}
                          className={`w-full mt-1 px-3 py-2 border rounded text-slate-900 focus:outline-none focus:border-slate-400 ${
                            issues.some(i => i.type === 'error') ? 'border-red-300 bg-red-50' : 'border-gray-200'
                          }`}
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
                );
              })}
            </div>

            {/* Import Button */}
            {questions.length > 0 && (
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={handleImport}
                  disabled={validationIssues.filter(i => i.type === 'error').length > 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  Import {questions.length} Question{questions.length !== 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'validate' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Validation Results</h3>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={showAutoFix}
                  onChange={(e) => setShowAutoFix(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                Show Auto-Fix Options
              </label>
            </div>
            
            {renderValidationSummary()}
            
            {validationIssues.length === 0 ? (
              <div className="text-center py-12 bg-green-50 rounded border border-green-200">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-medium text-green-900">All questions look great!</p>
                <p className="text-sm text-green-700 mt-1">No issues detected</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map(q => {
                  const issues = getIssuesForQuestion(q.id);
                  if (issues.length === 0) return null;
                  
                  return (
                    <div key={q.id} className="bg-white border border-gray-200 rounded p-4">
                      <p className="font-medium text-slate-900 mb-2">{q.text}</p>
                      <div className="space-y-2">
                        {issues.map((issue, i) => (
                          <div key={i} className={`flex items-start gap-2 p-2 rounded ${
                            issue.type === 'error' ? 'bg-red-50' : 'bg-amber-50'
                          }`}>
                            <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                              issue.type === 'error' ? 'text-red-600' : 'text-amber-600'
                            }`} />
                            <div className="text-sm">
                              <p className={issue.type === 'error' ? 'text-red-700' : 'text-amber-700'}>
                                {issue.message}
                              </p>
                              {issue.suggestion && (
                                <p className="text-xs text-slate-600 mt-0.5">{issue.suggestion}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'preview' && renderPreview()}

        {activeTab === 'import' && renderExternalImport()}
      </div>
    </div>
  );
}
