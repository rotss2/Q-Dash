import { useState, useCallback, useMemo } from 'react';
import { Plus, X, Check, FileText, Eye, Trash2, Upload, AlertCircle, CheckCircle, Copy, RefreshCw, Wand2, Sparkles } from 'lucide-react';
import { HighCapacityProcessor, ProcessingStats } from '../lib/highCapacityProcessor';
import { PatternRecognitionEngine } from '../lib/questionTypeRegistry';

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [organizeStats, setOrganizeStats] = useState<{ analyzed: number; organized: number; sections: string[] } | null>(null);
  
  // Super Genius processing state - reserved for future use
  const [, setIsSuperGeniusMode] = useState(false);
  const [, setIsProcessing] = useState(false);
  const [, setProcessingStats] = useState<ProcessingStats | null>(null);
  const [, setProcessingProgress] = useState(0);
  
  // Validation state
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

  // Check if a line is a question starter (enhanced detection)
  const isQuestionStarter = (line: string): boolean => {
    const trimmed = line.trim();
    if (trimmed.length < 5) return false;
    
    // Question words
    const questionWords = /^(how|what|when|where|why|who|which|whose|whom|is|are|do|does|did|will|would|should|can|could|has|have|was|were|am|shall|may|might|must|explain|describe|tell|give|list|name|identify|select|choose|pick|rate|rank|evaluate|assess|compare|contrast|discuss|analyze|justify|recommend|suggest|predict|estimate|calculate|determine|find|state|mention|define|clarify|elaborate)/i;
    
    // Numbered or lettered prefix: 1. or 1) or A) or a)
    const hasPrefix = /^\s*(\d+[\.\)]\s+|\d+\.\s+|\d+\)\s+|[A-Z][\.\)]\s+|[a-z][\.\)]\s+|\([a-zA-Z]\)\s+|Q\d*[\.:\)]\s*)/.test(trimmed);
    
    // Ends with question mark
    const hasQuestionMark = /\?\s*$/.test(trimmed);
    
    // Contains question words
    const hasQuestionWord = questionWords.test(trimmed);
    
    // Common question patterns
    const isQuestionPattern = hasQuestionMark || hasQuestionWord || hasPrefix;
    
    // Not a header/instruction line
    const nonQuestionPatterns = /^(question|instructions|directions|notes?|tips?|hints?|section|part|step|page|chapter|module|unit|lesson|exercise|activity|example|sample|demo|test|quiz|exam|assignment|project|task|note:|warning:|important:|tip:|hint:|remember:|please|thank|click|press|enter|type|select|choose|pick|fill|complete|submit|save|next|previous|back|continue|finish|done|start|begin|end|close|exit|cancel|delete|remove|add|edit|update|modify|change|create|make|generate|produce|develop|build|construct|design|form|shape|structure|organize|arrange|order|sort|group|classify|categorize|label|tag|mark|identify|recognize|distinguish|differentiate)\s*\d*[:\.)\s]/i;
    
    return isQuestionPattern && !nonQuestionPatterns.test(trimmed);
  };

  // Super Genius processing with high-capacity handling
  const parseText = useCallback(async (text: string) => {
    // Normalize line endings (handle Windows \r\n and Mac \r)
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n').filter(line => line.trim());
    setTotalLines(lines.length);
    
    // Check if we should use Super Genius mode (>10 questions or >2000 chars)
    const potentialQuestionCount = lines.filter(line => isQuestionStarter(line)).length;
    const shouldUseSuperGenius = potentialQuestionCount > 10 || normalizedText.length > 2000;
    setIsSuperGeniusMode(shouldUseSuperGenius);
    
    if (shouldUseSuperGenius) {
      // Use Super Genius processing
      setIsProcessing(true);
      setProcessingProgress(0);
      
      try {
        const result = await HighCapacityProcessor.processLargeDataset(normalizedText);
        
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
        fallbackProcessing(normalizedText);
      } finally {
        setIsProcessing(false);
        setProcessingProgress(100);
      }
    } else {
      // Use simple processing for smaller datasets
      fallbackProcessing(normalizedText);
    }
  }, []);
  
  // Enhanced fallback processing for smaller datasets
  const fallbackProcessing = useCallback((text: string) => {
    // Split by blank lines (double newlines) as primary separator, or single newlines
    const potentialBlocks = text.split(/\n\s*\n+/).filter(block => block.trim());
    
    const questionBlocks: string[] = [];
    
    // Process each potential block
    for (const block of potentialBlocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length === 0) continue;
      
      // Check if first line is a question starter
      if (isQuestionStarter(lines[0])) {
        questionBlocks.push(block.trim());
      } else {
        // Check if any line in the block is a question
        for (const line of lines) {
          if (isQuestionStarter(line) && line.length >= 10) {
            questionBlocks.push(line);
          }
        }
      }
    }
    
    // If no blocks found with blank-line separation, try line-by-line
    if (questionBlocks.length === 0) {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      for (const line of lines) {
        if (isQuestionStarter(line) && !isValidQuestion(line) === false) {
          // Check length constraints from isValidQuestion
          if (line.length >= 10 && line.length <= 200 && !/^\d+$/.test(line)) {
            questionBlocks.push(line);
          }
        }
      }
    }
    
    // Parse each question block
    const parsed = questionBlocks.map((block, index) => {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l);
      let questionText = lines[0];
      let optionsText = '';
      
      // Check if subsequent lines are options (indented or bullet points)
      if (lines.length > 1) {
        const optionLines = lines.slice(1).filter(l => 
          /^[-•·*\[\(\da-zA-Z][\.\):\]\s]/.test(l) || // Bullet points or numbered
          /^\s{2,}/.test(l) || // Indented lines
          l.includes(')') || l.includes(']')
        );
        if (optionLines.length >= 2) {
          optionsText = optionLines.join(', ');
        }
      }
      
      // Strip numbered prefixes (1. 1) A) a) etc)
      questionText = questionText.replace(/^\s*(\d+[\.\)]\s+|\d+\.\s+|\d+\)\s+|[A-Z][\.\)]\s+|[a-z][\.\)]\s+|\([a-zA-Z]\)\s+|Q\d*[\.:\)]\s*)/, '').trim();
      
      // Strip category labels
      questionText = questionText.replace(/^(Boolean|Multiple Choice|Yes\/No|Likert|Rating|Scale|Options|Technical|Contextual|Theoretical|Security|Logic)\s*\(?\w*\)?:\s*/i, '').trim();
      
      // Extract inline options: "What is X? (A) Option1 (B) Option2" or "[A] Option1 [B] Option2"
      let options: string[] = [];
      
      // Pattern: (A) Option1 (B) Option2 or [A] Option1 [B] Option2
      const inlineOptionsMatch = questionText.match(/[\(\[]([A-Z])\)[\]]([^[\(\]]+)(?:[\(\[]([A-Z])\)[\]]([^[\(\]]+))+/i);
      if (inlineOptionsMatch) {
        // Extract all options from inline format
        const allOptions = questionText.matchAll(/[\(\[]([A-Z])\)[\]]\s*([^[\(\]]+)(?=[\(\[]|$)/gi);
        for (const match of allOptions) {
          options.push(match[2].trim());
        }
        // Remove options from question text
        questionText = questionText.replace(/[\(\[]([A-Z])\)[\]]\s*[^[\(\]]+/gi, '').trim();
        questionText = questionText.replace(/\s+/g, ' ').trim();
      }
      
      // Parse options from separate lines
      if (options.length === 0 && optionsText) {
        // Parse formats: "A) Option", "A. Option", "- Option", "* Option", "[A] Option"
        const optionMatches = optionsText.matchAll(/(?:^|,\s*)\[?([A-Z\d])[\]\.\):]\s*([^,]+)/gi);
        for (const match of optionMatches) {
          options.push(match[2].trim());
        }
        
        // Parse bullet points
        if (options.length === 0) {
          const bullets = optionsText.matchAll(/[-•·*]\s*(.+?)(?=\s*[-•·*]|$)/gi);
          for (const match of bullets) {
            options.push(match[1].trim());
          }
        }
      }
      
      // Determine question type using PatternRecognitionEngine
      let type: QuestionType = 'text';
      const detected = PatternRecognitionEngine.detectQuestionType(questionText, '');
      
      if (options.length >= 2) {
        type = 'choice';
      } else if (detected.type === 'likert') {
        type = 'likert';
        options = ['1', '2', '3', '4', '5'];
      } else if (detected.type === 'boolean') {
        type = 'choice';
        options = ['Yes', 'No'];
      } else if (detected.type === 'choice') {
        type = 'choice';
        options = detected.options || ['Option 1', 'Option 2', 'Option 3'];
      } else if (/\?$/.test(questionText)) {
        // It's a question with ? but no specific type detected
        // Check for yes/no patterns
        if (/^(is|are|do|does|did|will|would|should|can|could|has|have|was|were|am)/i.test(questionText)) {
          type = 'choice';
          options = ['Yes', 'No'];
        }
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
    
    console.log('Parsed questions:', parsed.length, parsed.map(q => ({ text: q.text.substring(0, 50), type: q.type })));
    setQuestions(parsed);
    setSelectedQuestions(new Set());
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

  // Auto Organize & Analyze - Smart question detection and organization
  const autoOrganizeAndAnalyze = useCallback(async () => {
    console.log('Auto Organize clicked, questions count:', questions.length);
    if (questions.length === 0) {
      console.log('No questions to organize');
      return;
    }
    
    setIsAnalyzing(true);
    
    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const sections = new Set<string>();
    let organized = 0;
    
    const analyzedQuestions = questions.map((q, index) => {
      // Get surrounding context for better detection
      const context = questions
        .slice(Math.max(0, index - 2), Math.min(questions.length, index + 3))
        .map(q => q.text)
        .join(' ');
      
      // Detect question type using PatternRecognitionEngine
      const detected = PatternRecognitionEngine.detectQuestionType(q.text, context);
      
      // Map detected type to our supported types
      let newType: QuestionType = 'text';
      let newOptions: string[] = [];
      
      switch (detected.type) {
        case 'choice':
        case 'boolean':
          newType = 'choice';
          newOptions = detected.options || PatternRecognitionEngine.extractOptions(q.text, detected.type);
          if (newOptions.length < 2) {
            newOptions = ['Yes', 'No'];
          }
          break;
        case 'likert':
          newType = 'likert';
          newOptions = ['1', '2', '3', '4', '5'];
          break;
        case 'ranking':
        case 'matrix':
          newType = 'choice';
          newOptions = ['First', 'Second', 'Third', 'Fourth'];
          break;
        case 'long_text':
          newType = 'text';
          newOptions = [];
          break;
        default:
          newType = 'text';
          newOptions = [];
      }
      
      // Determine section based on content analysis
      let section = 'General';
      const text = q.text.toLowerCase();
      
      if (/name|email|phone|contact|address/i.test(text)) {
        section = 'Contact Information';
      } else if (/satisfied|satisfaction|rate|experience|feedback|quality/i.test(text)) {
        section = 'Satisfaction';
      } else if (/age|gender|education|occupation|income|demographic/i.test(text)) {
        section = 'Demographics';
      } else if (/usage|frequency|often|how.*many|when.*last/i.test(text)) {
        section = 'Usage Patterns';
      } else if (/recommend|refer|share|tell.*friend/i.test(text)) {
        section = 'Loyalty';
      } else if (/improve|suggestion|better|change|missing/i.test(text)) {
        section = 'Improvement';
      } else if (/price|cost|value|money|afford/i.test(text)) {
        section = 'Pricing';
      } else if (/feature|function|capability|work/i.test(text)) {
        section = 'Features';
      } else if (/problem|issue|difficult|challenge|frustrat/i.test(text)) {
        section = 'Pain Points';
      }
      
      sections.add(section);
      organized++;
      
      return {
        ...q,
        type: newType,
        options: newOptions,
        section
      };
    });
    
    // Sort questions by section for better organization
    const sortedQuestions = [...analyzedQuestions].sort((a, b) => {
      const sectionOrder = [
        'Contact Information',
        'Demographics', 
        'Usage Patterns',
        'Satisfaction',
        'Features',
        'Pricing',
        'Loyalty',
        'Pain Points',
        'Improvement',
        'General'
      ];
      
      const aIndex = sectionOrder.indexOf(a.section || 'General');
      const bIndex = sectionOrder.indexOf(b.section || 'General');
      
      if (aIndex !== bIndex) return aIndex - bIndex;
      return 0; // Keep original order within same section
    });
    
    setQuestions(sortedQuestions);
    setOrganizeStats({
      analyzed: questions.length,
      organized,
      sections: Array.from(sections)
    });
    
    setIsAnalyzing(false);
  }, [questions]);

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
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-700" />
            <h2 className="text-lg font-semibold text-slate-900">Bulk Question Importer</h2>
          </div>

          {/* Prominent Auto Organize Button - Always Visible */}
          <button
            onClick={autoOrganizeAndAnalyze}
            disabled={isAnalyzing}
            className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-violet-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg ${questions.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="AI-powered: Auto-detect question types, extract options, and organize into sections"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Auto Organize
              </>
            )}
          </button>
        </div>
        <p className="text-sm text-slate-600">
          Import multiple questions with validation, batch editing, and preview.
          <span className="text-indigo-600 font-medium ml-1">Click "Auto Organize" to automatically detect types and organize sections!</span>
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

                <div className="h-6 w-px bg-gray-300" />

                {/* Auto Organize & Analyze Button */}
                <button
                  onClick={autoOrganizeAndAnalyze}
                  disabled={isAnalyzing || questions.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-indigo-50 text-indigo-700 text-sm rounded hover:from-purple-100 hover:to-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-indigo-200"
                  title="AI-powered: Auto-detect question types, extract options, and organize into sections"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Auto Organize
                    </>
                  )}
                </button>

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

            {/* Organize Stats Display */}
            {organizeStats && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded p-3 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    Organized {organizeStats.organized} questions
                  </span>
                </div>
                <div className="h-4 w-px bg-green-300" />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-green-700 font-medium">Sections:</span>
                  {organizeStats.sections.map((section) => (
                    <span
                      key={section}
                      className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full"
                    >
                      {section}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => setOrganizeStats(null)}
                  className="ml-auto text-green-600 hover:text-green-800"
                >
                  <X className="w-4 h-4" />
                </button>
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

                      {/* Section Badge */}
                      {q.section && (
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                          {q.section}
                        </span>
                      )}

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
