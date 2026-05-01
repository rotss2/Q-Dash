import { useState, useCallback, useRef } from 'react';
import { useToast } from './Toaster';
import { 
  Upload, FileText, X, CheckCircle, AlertCircle, 
  Settings, ChevronDown, ChevronUp, Loader2, Sparkles,
  FileType, ListChecks, ToggleLeft, AlignLeft, SlidersHorizontal
} from 'lucide-react';

interface GenerationConfig {
  questionTypes: {
    multipleChoice: boolean;
    boolean: boolean;
    shortAnswer: boolean;
    likert: boolean;
  };
  questionCount: number;
  complexity: 'academic' | 'research' | 'analytical';
  strictGrounding: boolean;
}

interface GeneratedQuestion {
  id?: string;
  type: 'choice' | 'text' | 'likert';
  question_text: string;
  options: string[] | null;
  required: boolean;
  sourceContext?: string; // Tracks which part of document this came from
}

interface DocumentQuestionGeneratorProps {
  onQuestionsGenerated: (questions: GeneratedQuestion[]) => void;
}

const DEFAULT_CONFIG: GenerationConfig = {
  questionTypes: {
    multipleChoice: true,
    boolean: true,
    shortAnswer: true,
    likert: true,
  },
  questionCount: 10,
  complexity: 'research',
  strictGrounding: true,
};

export default function DocumentQuestionGenerator({ 
  onQuestionsGenerated
}: DocumentQuestionGeneratorProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [config, setConfig] = useState<GenerationConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [, setTextChunks] = useState<string[]>([]);

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }, []);

  const validateAndSetFile = (file: File) => {
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    const validExtensions = ['.pdf', '.docx', '.txt'];
    
    const isValidType = validTypes.includes(file.type);
    const hasValidExt = validExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );
    
    if (!isValidType && !hasValidExt) {
      showToast('Please upload a PDF, DOCX, or TXT file', 'error');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      showToast('File size must be less than 10MB', 'error');
      return;
    }
    
    setFile(file);
    setGeneratedQuestions([]); // Reset previous questions
    showToast(`File "${file.name}" ready for processing`, 'success');
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    setExtractedText('');
    setTextChunks([]);
    setGeneratedQuestions([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload and extract text
  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload-document', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload and process document');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setExtractedText(data.text);
        setTextChunks(data.chunks || []);
        showToast(`Extracted ${data.text.length.toLocaleString()} characters from document`, 'success');
        
        // Auto-start generation if text was extracted
        if (data.text.length > 0) {
          await generateQuestions(data.text, data.chunks);
        }
      } else {
        throw new Error(data.error || 'Failed to extract text');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showToast(error instanceof Error ? error.message : 'Failed to process document', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Generate questions using AI
  const generateQuestions = async (text: string, chunks: string[]) => {
    // Validate at least one question type is selected
    const selectedTypes = Object.entries(config.questionTypes)
      .filter(([, enabled]) => enabled)
      .map(([type]) => type);
    
    if (selectedTypes.length === 0) {
      showToast('Please select at least one question type', 'error');
      return;
    }

    setIsGenerating(true);
    
    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: chunks.length > 0 ? chunks : [text], // Send chunks for large documents
          config: {
            questionTypes: config.questionTypes,
            questionCount: config.questionCount,
            complexity: config.complexity,
            strictGrounding: config.strictGrounding,
          },
          fileName: file?.name,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate questions');
      }
      
      const data = await response.json();
      
      if (data.questions && data.questions.length > 0) {
        setGeneratedQuestions(data.questions);
        showToast(`Generated ${data.questions.length} questions from document`, 'success');
        
        // Show warning if fewer questions than requested
        if (data.questions.length < config.questionCount) {
          showToast(
            `Note: Only ${data.questions.length} questions could be generated from the available content. ` +
            `The AI stopped to avoid hallucinating information.`, 
            'info'
          );
        }
      } else {
        showToast('No questions could be generated. The document may not contain sufficient content.', 'info');
      }
    } catch (error) {
      console.error('Generation error:', error);
      showToast(error instanceof Error ? error.message : 'Failed to generate questions', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Accept questions and pass to parent
  const handleAcceptQuestions = () => {
    if (generatedQuestions.length === 0) return;
    
    onQuestionsGenerated(generatedQuestions);
    showToast(`${generatedQuestions.length} questions added to survey`, 'success');
    
    // Reset state
    setFile(null);
    setGeneratedQuestions([]);
    setExtractedText('');
    setTextChunks([]);
  };

  const handleRejectQuestions = () => {
    setGeneratedQuestions([]);
    showToast('Questions discarded. You can upload a different document.', 'info');
  };

  // Toggle question type selection
  const toggleQuestionType = (type: keyof typeof config.questionTypes) => {
    setConfig(prev => ({
      ...prev,
      questionTypes: {
        ...prev.questionTypes,
        [type]: !prev.questionTypes[type]
      }
    }));
  };

  const getFileIcon = () => {
    if (!file) return <FileText className="w-8 h-8 text-gray-400" />;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileType className="w-8 h-8 text-red-500" />;
    if (ext === 'docx') return <FileType className="w-8 h-8 text-blue-500" />;
    return <FileType className="w-8 h-8 text-gray-500" />;
  };

  return (
    <div className="w-full space-y-6">
      {/* Configuration Panel */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-gray-600" />
            <span className="font-semibold text-gray-900">Generation Configuration</span>
          </div>
          {showConfig ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </button>
        
        {showConfig && (
          <div className="p-6 space-y-6">
            {/* Question Types */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-3 block">
                Question Types to Generate
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => toggleQuestionType('multipleChoice')}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${
                    config.questionTypes.multipleChoice 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <ListChecks className="w-5 h-5" />
                  <span className="text-xs font-medium">Multiple Choice</span>
                </button>
                
                <button
                  onClick={() => toggleQuestionType('boolean')}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${
                    config.questionTypes.boolean 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <ToggleLeft className="w-5 h-5" />
                  <span className="text-xs font-medium">Yes/No</span>
                </button>
                
                <button
                  onClick={() => toggleQuestionType('shortAnswer')}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${
                    config.questionTypes.shortAnswer 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <AlignLeft className="w-5 h-5" />
                  <span className="text-xs font-medium">Short Answer</span>
                </button>
                
                <button
                  onClick={() => toggleQuestionType('likert')}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${
                    config.questionTypes.likert 
                      ? 'border-blue-500 bg-blue-50 text-blue-700' 
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <SlidersHorizontal className="w-5 h-5" />
                  <span className="text-xs font-medium">Likert Scale</span>
                </button>
              </div>
            </div>

            {/* Question Count */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Number of Questions: <span className="text-blue-600 font-semibold">{config.questionCount}</span>
              </label>
              <input
                type="range"
                min="1"
                max="30"
                value={config.questionCount}
                onChange={(e) => setConfig(prev => ({ ...prev, questionCount: parseInt(e.target.value) }))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1</span>
                <span>15</span>
                <span>30</span>
              </div>
            </div>

            {/* Complexity & Grounding */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Question Complexity
                </label>
                <select
                  value={config.complexity}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    complexity: e.target.value as GenerationConfig['complexity']
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="academic">Academic</option>
                  <option value="research">Research-Grade</option>
                  <option value="analytical">Analytical/Evaluative</option>
                </select>
              </div>
              
              <div className="flex items-center">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.strictGrounding}
                    onChange={(e) => setConfig(prev => ({ ...prev, strictGrounding: e.target.checked }))}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700 block">Strict Grounding</span>
                    <span className="text-xs text-gray-500">Prevent AI hallucination</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* File Upload Area */}
      {!generatedQuestions.length && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative border-3 border-dashed rounded-xl p-8 text-center transition-all ${
            dragActive 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileInput}
            className="hidden"
          />
          
          {!file ? (
            <div className="space-y-4">
              <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto">
                <Upload className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">
                  Drag & drop your document here
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  or <button onClick={() => fileInputRef.current?.click()} className="text-blue-600 hover:underline font-medium">browse files</button>
                </p>
              </div>
              <p className="text-xs text-gray-400">
                Supports PDF, DOCX, TXT (max 10MB)
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-4">
                {getFileIcon()}
                <div className="text-left">
                  <p className="font-medium text-gray-900 truncate max-w-xs">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <button
                onClick={removeFile}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                disabled={isUploading || isGenerating}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload & Generate Button */}
      {file && !generatedQuestions.length && !extractedText && (
        <button
          onClick={handleUpload}
          disabled={isUploading || isGenerating}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {isUploading || isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {isUploading ? 'Extracting text...' : 'Generating questions...'}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Upload & Generate Questions
            </>
          )}
        </button>
      )}

      {/* Progress Indicator */}
      {(isUploading || isGenerating) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                {isUploading ? 'Extracting text from document...' : 'AI is analyzing and generating questions...'}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {isUploading 
                  ? 'Parsing document structure and extracting content' 
                  : 'Using strict grounding to prevent hallucination'}
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 bg-blue-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 animate-pulse rounded-full" style={{ width: isUploading ? '40%' : '70%' }} />
          </div>
        </div>
      )}

      {/* Generated Questions Preview */}
      {generatedQuestions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Generated Questions ({generatedQuestions.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleRejectQuestions}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleAcceptQuestions}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Add to Survey
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {generatedQuestions.map((q, index) => (
              <div 
                key={index} 
                className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{q.question_text}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        q.type === 'choice' ? 'bg-purple-100 text-purple-700' :
                        q.type === 'text' ? 'bg-green-100 text-green-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {q.type === 'choice' ? 'Multiple Choice' :
                         q.type === 'text' ? 'Short Answer' : 'Likert Scale'}
                      </span>
                      {q.required && (
                        <span className="text-xs text-red-600 font-medium">Required</span>
                      )}
                    </div>
                    {q.options && q.options.length > 0 && (
                      <div className="mt-3 pl-4 border-l-2 border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Options:</p>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {q.options.map((opt, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                              {opt}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {q.sourceContext && (
                      <p className="mt-2 text-xs text-gray-400 italic">
                        Source: "{q.sourceContext.substring(0, 100)}..."
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">How it works</p>
            <ul className="space-y-1 text-amber-700">
              <li>• Upload a research paper, article, or any text document</li>
              <li>• AI extracts text and chunks it for processing</li>
              <li>• Questions are generated based ONLY on document content</li>
              <li>• If content is insufficient, generation stops to prevent hallucination</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
