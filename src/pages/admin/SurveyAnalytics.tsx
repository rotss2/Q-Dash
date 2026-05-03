import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { apiGet, apiPost, apiDelete } from '../../lib/api';
import { Survey, Question, Response, ResponseAggregation } from '../../types';
import { ArrowLeft, FileSpreadsheet, FileJson, Users, Calendar, Lightbulb, Trash2, Calculator, Table, BarChart3, RotateCcw, Download, MoreVertical } from 'lucide-react';
import IntelligenceDashboard from '../../components/IntelligenceDashboard';
import ResearchConclusion from '../../components/ResearchConclusion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  ChartData
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function SurveyAnalytics() {
  const params = useParams<{ surveyId: string }>();
  const surveyId = params.surveyId;
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Array<Response & { question?: Question; profile?: { email: string } }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'analytics' | 'intelligence' | 'conclusion' | 'raw' | 'statistics'>('analytics');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Check if a question is a placeholder/hidden question that should not be analyzed
  const isPlaceholderQuestion = (question: Question): boolean => {
    const text = question.question_text?.trim().toLowerCase() || '';
    if (!text) return true;
    if (text === 'test') return true;
    if (text === 'test question') return true;
    if (text === 'placeholder') return true;
    if (text.startsWith('dummy')) return true;
    if (text.includes('hidden') || text.includes('layout') || text.includes('system-generated')) return true;
    return false;
  };

  // Only real, visible answerable questions should be included in analytics
  // This is the single source of truth for which questions to analyze
  const validQuestions = useMemo(() => {
    return questions.filter((q) => {
      // Must be a question block type
      if (q.block_type !== 'question') return false;
      // Must be a valid question type
      if (!['text', 'choice', 'likert'].includes(q.type)) return false;
      // Must be active
      if (q.is_active === false) return false;
      // Must not be a placeholder
      if (isPlaceholderQuestion(q)) return false;
      // Must have valid question text
      if (!q.question_text || q.question_text.trim() === '') return false;
      return true;
    });
  }, [questions]);

  // Create a Set of valid question IDs for fast lookup
  const validQuestionIds = useMemo(() => new Set(validQuestions.map(q => q.id)), [validQuestions]);

  // Always use question.id as source of truth - never dedupe by text
  // Multiple questions with the same text are different questions and must both be analyzed

  useEffect(() => {
    if (surveyId) {
      loadData();
    }
  }, [surveyId]);

  const loadData = async () => {
    if (!surveyId) return;
    setIsLoading(true);
    setPageError(null);
    console.log('Analytics: Loading data for survey:', surveyId);

    try {
      // Add cache-busting timestamp to force fresh data
      const timestamp = new Date().getTime();
      const { data, error } = await apiGet<{
        survey: Survey;
        questions: Question[];
        responses: Array<Response & { question?: Question; profile?: { email: string } }>;
      }>(`/api/admin/surveys/${surveyId}/analytics?_t=${timestamp}`);

      if (error || !data?.survey) {
        console.error('Analytics: Failed to load survey:', error);
        const errorMsg = error || 'Failed to load survey';
        setPageError(errorMsg);
        showToast(errorMsg, 'error');
        return;
      }

      console.log('Analytics: Loaded survey:', data.survey.title);
      console.log('Analytics: Questions count:', data.questions?.length || 0);
      console.log('Analytics: Responses count:', data.responses?.length || 0);
      console.log('Analytics: Response sample:', data.responses?.slice(0, 2));

      setSurvey(data.survey);
      setQuestions(data.questions || []);

      const typedResponses = (data.responses || []).map((r: any) => ({
        ...r,
        question: r.question as Question,
        userLabel: r.user_id ? `User-${r.user_id.slice(0, 8)}` : 'Anonymous'
      }));

      setResponses(typedResponses);
    } catch (err) {
      console.error('Analytics: Exception during load:', err);
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setPageError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetResponses = async () => {
    if (!surveyId) return;

    const confirmed = window.confirm(
      'Are you sure you want to reset all responses for this survey? This will delete all submitted answers and allow respondents to answer again. This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsResetting(true);

      const { data, error } = await apiPost<{ success: boolean; message: string }>(
        `/api/admin/surveys/${surveyId}/reset-responses`,
        {}
      );

      if (error || !data?.success) {
        throw new Error(error || 'Failed to reset responses.');
      }

      showToast('Survey responses have been reset.', 'success');

      // Refresh the page data after reset
      await loadData();
    } catch (error) {
      console.error('Failed to reset survey responses:', error);
      showToast(
        error instanceof Error ? error.message : 'Failed to reset responses.',
        'error'
      );
    } finally {
      setIsResetting(false);
    }
  };

  // ===== STATISTICAL HELPER FUNCTIONS =====
  // These MUST be defined before useMemo hooks to avoid temporal dead zone errors

  // Map text answers to numeric values for correlation analysis
  const answerToNumeric = (answer: string, questionType: string, options?: string[]): number | null => {
    if (!answer || answer.trim() === '') return null;

    const trimmed = answer.trim().toLowerCase();

    // Likert scale mappings
    const likertMap: { [key: string]: number } = {
      'strongly disagree': 1, 'disagree': 2, 'neutral': 3, 'agree': 4, 'strongly agree': 5,
      '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
      'very dissatisfied': 1, 'dissatisfied': 2, 'somewhat dissatisfied': 2,
      'somewhat satisfied': 4, 'satisfied': 4, 'very satisfied': 5,
      'very poor': 1, 'poor': 2, 'fair': 3, 'good': 4, 'excellent': 5,
      'never': 1, 'rarely': 2, 'sometimes': 3, 'often': 4, 'always': 5,
      'yes': 1, 'no': 0
    };

    // Check likert map first
    if (likertMap[trimmed] !== undefined) {
      return likertMap[trimmed];
    }

    // For choice questions, map option index to numeric value (1-based)
    if (questionType === 'choice' && options && options.length > 0) {
      const optionIndex = options.findIndex(opt => opt.toLowerCase().trim() === trimmed);
      if (optionIndex !== -1) {
        // Map to 1-based scale, or use the position relative to total options
        return optionIndex + 1;
      }
    }

    // Try parsing as direct number
    const parsed = parseFloat(answer);
    if (!isNaN(parsed)) {
      return parsed;
    }

    return null;
  };

  // Statistical Analysis Functions
  const calculateMean = (values: number[]): number => {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  const calculateMedian = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };

  const calculateMode = (values: number[]): number | null => {
    if (values.length === 0) return null;
    const frequency: { [key: number]: number } = {};
    values.forEach(v => { frequency[v] = (frequency[v] || 0) + 1; });
    let mode = values[0];
    let maxFreq = 0;
    Object.entries(frequency).forEach(([value, freq]) => {
      if (freq > maxFreq) {
        maxFreq = freq;
        mode = Number(value);
      }
    });
    return maxFreq > 1 ? mode : null;
  };

  const calculateStdDev = (values: number[]): number => {
    if (values.length < 2) return 0;
    const mean = calculateMean(values);
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(variance);
  };

  const filteredResponses = useMemo(() => {
    return responses.filter((response) => {
      const submittedAt = new Date(response.submitted_at);
      const fromDate = filterFrom ? new Date(filterFrom) : null;
      const toDate = filterTo ? new Date(filterTo) : null;

      if (fromDate && submittedAt < fromDate) return false;
      if (toDate && submittedAt > toDate) return false;
      // CRITICAL: Only include responses for valid questions (matched by question_id)
      if (!validQuestionIds.has(response.question_id)) return false;

      return true;
    });
  }, [responses, filterFrom, filterTo, validQuestionIds]);

  const aggregationData = useMemo((): ResponseAggregation[] => {
    return validQuestions.map((question) => {
      // Match responses by exact question_id - NEVER by text or index
      const questionResponses = filteredResponses.filter((r) => r.question_id === question.id);

      if (question.type === 'likert') {
        const counts: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
        questionResponses.forEach((r) => {
          const numeric = answerToNumeric(r.answer, question.type, question.options || undefined);
          if (numeric !== null && numeric >= 1 && numeric <= 5) {
            counts[String(numeric)] = (counts[String(numeric)] || 0) + 1;
          }
        });

        return {
          question_id: question.id,
          question_text: question.question_text,
          type: question.type,
          answers: ['1', '2', '3', '4', '5'].map((value) => ({ value, count: counts[value] || 0 })),
          total_responses: questionResponses.length
        };
      }

      if (question.type === 'choice') {
        const answers: { [key: string]: number } = {};
        questionResponses.forEach((r) => {
          answers[r.answer] = (answers[r.answer] || 0) + 1;
        });

        return {
          question_id: question.id,
          question_text: question.question_text,
          type: question.type,
          answers: Object.entries(answers).map(([value, count]) => ({ value, count })),
          total_responses: questionResponses.length
        };
      }

      return {
        question_id: question.id,
        question_text: question.question_text,
        type: question.type,
        answers: questionResponses.map((r) => ({ value: r.answer, count: 1 })),
        total_responses: questionResponses.length
      };
    });
  }, [validQuestions, filteredResponses]);

  const surveyUrl = surveyId ? `${window.location.origin}/survey/${surveyId}` : '';

  // Helper function to extract user name/email from their responses
  const getUserIdentifier = (submission: any) => {
    const userId = submission.user_id?.slice(0, 8) || 'Unknown';
    let identifier = `User-${userId}`;
    
    // Look for name/email in responses
    const nameResponses: string[] = [];
    const emailResponses: string[] = [];
    
    // Get all responses for this user from the submission
    const submissionResponses = filteredResponses.filter(r => 
      r.user_id === submission.user_id && 
      r.submitted_at === submission.submitted_at
    );
    
    submissionResponses.forEach(r => {
      const question = questions.find(q => q.id === r.question_id);
      if (question && r.answer && r.answer.trim()) {
        const questionText = question.question_text.toLowerCase();
        
        // Check if this is a name question
        if (questionText.includes('name') && 
            !questionText.includes('username') && 
            !questionText.includes('surname')) {
          nameResponses.push(r.answer.trim());
        }
        
        // Check if this is an email question
        if (questionText.includes('email') || questionText.includes('gmail') || questionText.includes('mail')) {
          emailResponses.push(r.answer.trim());
        }
      }
    });
    
    // Build identifier string
    const parts: string[] = [];
    if (nameResponses.length > 0) {
      parts.push(nameResponses[0]); // Use first name found
    }
    if (emailResponses.length > 0) {
      parts.push(emailResponses[0]); // Use first email found
    }
    
    if (parts.length > 0) {
      identifier += ` (${parts.join(' / ')})`;
    }
    
    return identifier;
  };

  const deleteSubmission = async (responseIds: string[]) => {
    if (!surveyId || responseIds.length === 0) return;
    if (!confirm('Delete this full submission? This cannot be undone.')) return;

    for (const responseId of responseIds) {
      const { error } = await apiDelete<{ success: boolean }>(`/api/admin/surveys/${surveyId}/responses/${responseId}`);
      if (error) {
        showToast(`Failed to delete response ${responseId}: ${error}`, 'error');
        return;
      }
    }

    showToast('Submission deleted successfully', 'success');
    loadData();
  };

  const exportToCSV = () => {
    if (!validQuestions.length || !responses.length) return;

    // Build CSV rows
    const headers = ['User', 'Submitted At', ...validQuestions.map(q => q.question_text)];
    
    // Group responses by user_id and submitted_at
    const grouped: { [key: string]: { userLabel: string; submitted_at: string; answers: { [qid: string]: string } } } = {};
    
    filteredResponses.forEach(r => {
      const key = `${r.user_id}_${r.submitted_at}`;
      if (!grouped[key]) {
        grouped[key] = {
          userLabel: (r as any).userLabel || `User-${r.user_id?.slice(0, 8) || 'Unknown'}`,
          submitted_at: r.submitted_at,
          answers: {}
        };
      }
      grouped[key].answers[r.question_id] = r.answer;
    });

    const rows = Object.values(grouped).map(g => [
      g.userLabel,
      new Date(g.submitted_at).toLocaleString(),
      ...validQuestions.map(q => g.answers[q.id] || '')
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${survey?.title.replace(/\s+/g, '_')}_responses.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showToast('CSV exported successfully', 'success');
  };

  const exportToJSON = () => {
    const data = {
      survey,
      questions: validQuestions,
      responses: filteredResponses.map(r => ({
        ...r,
        user_label: (r as any).userLabel || `User-${r.user_id?.slice(0, 8) || 'Unknown'}`
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${survey?.title.replace(/\s+/g, '_')}_data.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showToast('JSON exported successfully', 'success');
  };

  const getLikertResponses = (questionId: string, questionType: string = 'likert', options?: string[]): number[] => {
    return filteredResponses
      .filter(r => r.question_id === questionId)
      .map(r => answerToNumeric(r.answer, questionType, options))
      .filter((n): n is number => n !== null);
  };

  // Get paired responses for correlation (only users who answered both questions)
  const getPairedResponses = (q1Id: string, q2Id: string): { x: number[]; y: number[] } => {
    const q1 = questions.find(q => q.id === q1Id);
    const q2 = questions.find(q => q.id === q2Id);
    
    if (!q1 || !q2) return { x: [], y: [] };
    
    // Group responses by user_id
    const userResponses: { [userId: string]: { [questionId: string]: number } } = {};
    
    filteredResponses.forEach(r => {
      if (r.question_id !== q1Id && r.question_id !== q2Id) return;
      
      const question = r.question_id === q1Id ? q1 : q2;
      const numValue = answerToNumeric(r.answer, question.type, question.options || undefined);
      
      if (numValue !== null) {
        if (!userResponses[r.user_id]) {
          userResponses[r.user_id] = {};
        }
        userResponses[r.user_id][r.question_id] = numValue;
      }
    });
    
    // Extract paired values (users who answered both questions)
    const x: number[] = [];
    const y: number[] = [];
    
    Object.values(userResponses).forEach(userData => {
      if (userData[q1Id] !== undefined && userData[q2Id] !== undefined) {
        x.push(userData[q1Id]);
        y.push(userData[q2Id]);
      }
    });
    
    return { x, y };
  };

  const calculateQuestionStats = (questionId: string, questionType: string) => {
    const question = questions.find(q => q.id === questionId);
    const values = getLikertResponses(questionId, questionType, question?.options || undefined);
    if (values.length === 0) return null;
    return {
      n: values.length,
      mean: calculateMean(values),
      median: calculateMedian(values),
      mode: calculateMode(values),
      stdDev: calculateStdDev(values),
      min: Math.min(...values),
      max: Math.max(...values)
    };
  };

  // Correlation Analysis (Pearson) - properly paired by user
  const calculateCorrelation = (q1Id: string, q2Id: string): number | null => {
    const { x, y } = getPairedResponses(q1Id, q2Id);
    
    // Need at least 3 paired responses for reliable correlation
    if (x.length < 3 || y.length < 3 || x.length !== y.length) return null;
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? null : numerator / denominator;
  };

  const eligibleCorrelationQuestions = useMemo(
    () => validQuestions.filter(q => q.type === 'likert' || q.type === 'choice'),
    [validQuestions]
  );

  const completeCorrelationRows = useMemo(() => {
    const rows: Record<string, { answers: Record<string, string> }> = {};
    filteredResponses.forEach((r) => {
      const key = `${r.user_id}_${r.submitted_at}`;
      if (!rows[key]) rows[key] = { answers: {} };
      rows[key].answers[r.question_id] = r.answer;
    });

    return Object.values(rows).filter((row) =>
      eligibleCorrelationQuestions.every((q) => row.answers[q.id] !== undefined)
    ).length;
  }, [filteredResponses, eligibleCorrelationQuestions]);

  // Export to Excel (CSV with multiple sheets simulated)
  const exportToExcel = () => {
    if (!validQuestions.length || !filteredResponses.length) return;
    
    // Sheet 1: Raw Data
    const rawHeaders = ['User ID', 'Submitted At', ...validQuestions.map(q => q.question_text)];
    const grouped: any = {};
    filteredResponses.forEach(r => {
      const key = `${r.user_id}_${r.submitted_at}`;
      if (!grouped[key]) {
        grouped[key] = { userId: r.user_id, submittedAt: r.submitted_at, answers: {} };
      }
      grouped[key].answers[r.question_id] = r.answer;
    });
    const rawRows = Object.values(grouped).map((g: any) => [
      g.userId,
      new Date(g.submittedAt).toLocaleString(),
      ...validQuestions.map(q => g.answers[q.id] || '')
    ]);

    // Sheet 2: Statistics Summary
    const statsRows = validQuestions
      .filter(q => q.type === 'likert')
      .map(q => {
        const stats = calculateQuestionStats(q.id, q.type);
        return stats ? [
          q.question_text,
          stats.n,
          stats.mean.toFixed(2),
          stats.median.toFixed(2),
          stats.mode?.toFixed(2) || 'N/A',
          stats.stdDev.toFixed(2),
          stats.min,
          stats.max
        ] : [q.question_text, 'No numeric data', '', '', '', '', '', ''];
      });

    const csv = [
      '=== RAW DATA ===',
      rawHeaders.join(','),
      ...rawRows.map(r => r.map(c => `"${c}"`).join(',')),
      '',
      '=== STATISTICS SUMMARY ===',
      'Question,N,Mean,Median,Mode,Std Dev,Min,Max',
      ...statsRows.map(r => r.map(c => `"${c}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${survey?.title.replace(/\s+/g, '_')}_analysis.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Excel-compatible CSV exported', 'success');
  };

  // Export SPSS-compatible CSV
  const exportToSPSS = () => {
    if (!validQuestions.length || !filteredResponses.length) return;
    
    // SPSS requires numeric codes for categorical data
    const questionCodes: { [key: string]: { [key: string]: number } } = {};
    validQuestions.forEach(q => {
      const uniqueAnswers = [...new Set(filteredResponses.filter(r => r.question_id === q.id).map(r => r.answer))];
      questionCodes[q.id] = {};
      uniqueAnswers.forEach((ans, idx) => {
        questionCodes[q.id][ans] = idx + 1;
      });
    });

    const headers = ['user_id', 'submitted_at', ...validQuestions.map(q => `Q${q.id.slice(0, 6)}`)];
    const valueLabels = validQuestions.map(q => {
      const codes = questionCodes[q.id];
      return `${q.question_text}: ${Object.entries(codes).map(([ans, code]) => `${code}=${ans}`).join(', ')}`;
    });

    const grouped: any = {};
    filteredResponses.forEach(r => {
      const key = `${r.user_id}_${r.submitted_at}`;
      if (!grouped[key]) {
        grouped[key] = { userId: r.user_id, submittedAt: r.submitted_at, answers: {} };
      }
      grouped[key].answers[r.question_id] = questionCodes[r.question_id][r.answer];
    });

    const rows = Object.values(grouped).map((g: any) => [
      g.userId,
      new Date(g.submittedAt).toISOString(),
      ...validQuestions.map(q => g.answers[q.id] || '')
    ]);

    const csv = [
      '* VALUE LABELS INFO (for SPSS):',
      ...valueLabels.map(vl => `* ${vl}`),
      '*',
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${survey?.title.replace(/\s+/g, '_')}_spss.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('SPSS-compatible CSV exported with value labels', 'success');
  };

  // Export LaTeX Table
  const exportToLaTeX = () => {
    if (!validQuestions.length || !filteredResponses.length) return;
    
    const aggregations = aggregationData;
    
    let latex = `\\begin{table}[h]\n`;
    latex += `\\centering\n`;
    latex += `\\caption{${survey?.title} - Response Summary}\n`;
    latex += `\\begin{tabular}{|l|c|c|}\n`;
    latex += `\\hline\n`;
    latex += `\\textbf{Question} & \\textbf{Response} & \\textbf{Count} \\\\\n`;
    latex += `\\hline\n`;
    
    aggregations.forEach((agg: ResponseAggregation) => {
      agg.answers.forEach((ans: {value: string, count: number}, idx: number) => {
        const question = idx === 0 ? agg.question_text.replace(/&/g, '\\&') : '';
        latex += `${question} & ${ans.value.replace(/&/g, '\\&')} & ${ans.count} \\\\\n`;
      });
      latex += `\\hline\n`;
    });
    
    latex += `\\end{tabular}\n`;
    latex += `\\label{tab:survey_${survey?.id?.slice(0, 8)}}\n`;
    latex += `\\end{table}`;

    const blob = new Blob([latex], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${survey?.title.replace(/\s+/g, '_')}_table.tex`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('LaTeX table exported', 'success');
  };

  // Export Charts as PNG
  const exportChartsPNG = () => {
    const canvases = document.querySelectorAll('canvas');
    if (canvases.length === 0) {
      showToast('No charts available to export', 'error');
      return;
    }
    
    canvases.forEach((canvas, index) => {
      const link = document.createElement('a');
      link.download = `${survey?.title.replace(/\s+/g, '_')}_chart_${index + 1}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
    
    showToast(`${canvases.length} chart(s) exported as PNG`, 'success');
  };

  const getChartData = (aggregation: ResponseAggregation): ChartData<'bar' | 'pie'> => {
    const colors = [
      'rgba(59, 130, 246, 0.8)',
      'rgba(16, 185, 129, 0.8)',
      'rgba(245, 158, 11, 0.8)',
      'rgba(239, 68, 68, 0.8)',
      'rgba(139, 92, 246, 0.8)',
      'rgba(236, 72, 153, 0.8)',
    ];

    return {
      labels: aggregation.answers.map(a => a.value),
      datasets: [{
        data: aggregation.answers.map(a => a.count),
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('0.8', '1')),
        borderWidth: 1
      }]
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </button>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card bg-red-50 border border-red-200">
            <h2 className="text-xl font-semibold text-red-900 mb-2">Analytics Failed to Load</h2>
            <p className="text-red-800 mb-4">{pageError}</p>
            <div className="flex gap-2">
              <button
                onClick={() => loadData()}
                className="btn-primary flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={() => navigate('/admin')}
                className="btn-secondary"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header - Simple navigation only */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Survey Info Card */}
        <div className="card mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{survey?.title}</h1>
              <p className="text-gray-600 mb-4">{survey?.description || 'No description'}</p>
            </div>

            {/* Export Toolbar - Desktop: buttons, Mobile: dropdown */}
            <div className="flex items-center gap-2">
              {/* Desktop: Individual export buttons */}
              <div className="hidden sm:flex flex-wrap gap-2">
                <button
                  onClick={exportToCSV}
                  disabled={!responses.length}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50 text-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  CSV
                </button>
                <button
                  onClick={exportToJSON}
                  disabled={!responses.length}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50 text-sm"
                >
                  <FileJson className="w-4 h-4" />
                  JSON
                </button>
                <button
                  onClick={exportToExcel}
                  disabled={!responses.length}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50 text-sm"
                >
                  <Table className="w-4 h-4" />
                  Excel
                </button>
              </div>
              
              {/* Mobile: Export Dropdown */}
              <div className="sm:hidden relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={!responses.length}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-medium text-sm disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Export
                  <MoreVertical className="w-4 h-4" />
                </button>
                
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1">
                      <button
                        onClick={() => { exportToCSV(); setShowExportMenu(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        Export CSV
                      </button>
                      <button
                        onClick={() => { exportToJSON(); setShowExportMenu(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <FileJson className="w-4 h-4" />
                        Export JSON
                      </button>
                      <button
                        onClick={() => { exportToExcel(); setShowExportMenu(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Table className="w-4 h-4" />
                        Export Excel
                      </button>
                      <button
                        onClick={() => { exportToSPSS(); setShowExportMenu(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Export SPSS
                      </button>
                      <button
                        onClick={() => { exportChartsPNG(); setShowExportMenu(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <BarChart3 className="w-4 h-4" />
                        Export Charts
                      </button>
                    </div>
                  </>
                )}
              </div>
              
              {/* Desktop: Additional export options */}
              <div className="hidden lg:flex flex-wrap gap-2">
                <button
                  onClick={exportToSPSS}
                  disabled={!responses.length}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50 text-sm"
                >
                  <BarChart3 className="w-4 h-4" />
                  SPSS
                </button>
                <button
                  onClick={exportToLaTeX}
                  disabled={!responses.length}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50 text-sm"
                >
                  <span className="text-xs font-bold">TeX</span>
                  LaTeX
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {new Set(filteredResponses.map(r => r.user_id)).size} unique responses
                {survey?.total_responses !== new Set(filteredResponses.map(r => r.user_id)).size && (
                  <span className="text-xs text-gray-400">(cached: {survey?.total_responses})</span>
                )}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Created {survey && new Date(survey.created_at).toLocaleDateString()}
              </span>
            </div>

            <div className="flex flex-col gap-3 sm:items-end">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs uppercase tracking-wide text-gray-400">Share</span>
                <button
                  onClick={() => navigator.clipboard.writeText(surveyUrl)}
                  disabled={!surveyUrl}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                >
                  Copy Link
                </button>
                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(surveyUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                >
                  QR Code
                </a>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <label className="text-xs uppercase tracking-wide text-gray-400">Filter responses</label>
                <input
                  type="date"
                  value={filterFrom}
                  onChange={e => setFilterFrom(e.target.value)}
                  className="input-sm"
                  placeholder="From"
                />
                <input
                  type="date"
                  value={filterTo}
                  onChange={e => setFilterTo(e.target.value)}
                  className="input-sm"
                  placeholder="To"
                />
              </div>
              <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-gray-100 mt-2">
                <span className="text-xs uppercase tracking-wide text-red-400">Danger Zone</span>
                <button
                  type="button"
                  onClick={handleResetResponses}
                  disabled={isResetting}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-1.5"
                  title="Clear all responses and allow respondents to answer again"
                >
                  <RotateCcw className="w-4 h-4" />
                  {isResetting ? 'Resetting...' : 'Reset Responses'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveView('analytics')}
            className={`px-4 py-2 font-medium ${activeView === 'analytics' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveView('intelligence')}
            className={`px-4 py-2 font-medium flex items-center gap-2 ${activeView === 'intelligence' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}
          >
            <Lightbulb className="w-4 h-4" />
            Intelligence
          </button>
          <button
            onClick={() => setActiveView('conclusion')}
            className={`px-4 py-2 font-medium ${activeView === 'conclusion' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}
          >
            Conclusion
          </button>
          <button
            onClick={() => setActiveView('raw')}
            className={`px-4 py-2 font-medium ${activeView === 'raw' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}
          >
            Raw Data
          </button>
          <button
            onClick={() => setActiveView('statistics')}
            className={`px-4 py-2 font-medium flex items-center gap-2 ${activeView === 'statistics' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500'}`}
          >
            <Calculator className="w-4 h-4" />
            Statistics
          </button>
        </div>

        {activeView === 'intelligence' ? (
          /* Intelligence Dashboard */
          <IntelligenceDashboard
            questions={validQuestions}
            responses={filteredResponses}
            surveyTitle={survey?.title || 'Survey'}
          />
        ) : activeView === 'statistics' ? (
          /* Statistics View */
          <div className="space-y-6">
            {/* Descriptive Statistics */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-blue-600" />
                Descriptive Statistics (Likert Scale Questions)
              </h2>
              
              {/* Small sample warning */}
              {new Set(filteredResponses.map(r => r.user_id)).size < 3 && (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 mb-4 text-sm text-yellow-800">
                  <strong>Preliminary statistics only.</strong> Sample size is small (N = {new Set(filteredResponses.map(r => r.user_id)).size}).
                  Standard deviation requires at least 2 responses. Treat these values as early indicators only.
                </div>
              )}
              
              {validQuestions.filter(q => q.type === 'likert').length === 0 ? (
                <p className="text-gray-500">No Likert scale questions available for statistical analysis</p>
              ) : filteredResponses.length === 0 ? (
                <p className="text-gray-500">No responses available for analysis</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Question</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">N</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mean</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Median</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Mode</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Std Dev</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Min</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Max</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {validQuestions.filter(q => q.type === 'likert').map(q => {
                        const stats = calculateQuestionStats(q.id, q.type);
                        return stats ? (
                          <tr key={q.id}>
                            <td className="px-4 py-3 text-sm text-gray-900 max-w-md truncate">{q.question_text}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600">{stats.n}</td>
                            <td className="px-4 py-3 text-sm text-center font-semibold text-blue-600">{stats.mean.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600">{stats.median.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600">{stats.mode?.toFixed(2) || 'N/A'}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600">{stats.n < 2 ? 'N/A' : stats.stdDev.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600">{stats.min}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600">{stats.max}</td>
                          </tr>
                        ) : null;
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Correlation Matrix */}
            {eligibleCorrelationQuestions.length >= 2 && (
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                  Correlation Analysis (Pearson r)
                </h2>
                {completeCorrelationRows < 3 ? (
                  <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 text-sm text-yellow-800">
                    Correlation analysis requires at least 3 complete responses across the selected questions. 
                    Currently {completeCorrelationRows} complete respondent row{completeCorrelationRows === 1 ? '' : 's'} are available.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Questions</th>
                          {eligibleCorrelationQuestions.map((q, index) => (
                            <th key={q.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase max-w-[8rem] truncate">
                              Q{index + 1}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {eligibleCorrelationQuestions.map((q1, i) => (
                          <tr key={q1.id}>
                            <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                              Q{i + 1}: {q1.question_text}
                            </td>
                            {eligibleCorrelationQuestions.map((q2, j) => {
                              if (i === j) {
                                return <td key={q2.id} className="px-4 py-3 text-center text-sm text-gray-300 bg-gray-50">—</td>;
                              }
                              const corr = calculateCorrelation(q1.id, q2.id);
                              const color = corr === null ? 'text-gray-300' :
                                Math.abs(corr) >= 0.7 ? 'text-green-600 font-bold' :
                                Math.abs(corr) >= 0.4 ? 'text-blue-600 font-semibold' : 'text-gray-500';
                              return (
                                <td key={q2.id} className={`px-4 py-3 text-center text-sm ${color}`}>
                                  {corr !== null ? corr.toFixed(2) : '—'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-4 text-sm text-gray-500">
                  <p className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    <strong>Strong correlation</strong> (|r| ≥ 0.7)
                  </p>
                  <p className="flex items-center gap-2 mt-1">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                    <strong>Moderate correlation</strong> (0.4 {'≤'} |r| {'<'} 0.7)
                  </p>
                  <p className="flex items-center gap-2 mt-1">
                    <span className="w-3 h-3 rounded-full bg-gray-400"></span>
                    <strong>Weak/No correlation</strong> (|r| {'<'} 0.4)
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : activeView === 'conclusion' ? (
          /* Research Conclusion */
          <ResearchConclusion
            questions={validQuestions}
            responses={filteredResponses}
            surveyTitle={survey?.title || 'Survey'}
          />
        ) : activeView === 'raw' ? (
          /* Raw Data View */
          <div className="card overflow-hidden">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Response Data</h2>
            {filteredResponses.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No responses match the selected filter</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                      {validQuestions.map(q => (
                        <th key={q.id} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase break-words max-w-[14rem]">
                          {q.question_text}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {/* Group responses by submission */}
                    {Object.entries(
                      filteredResponses.reduce((acc, r) => {
                        const key = `${r.user_id}_${r.submitted_at}`;
                        if (!acc[key]) {
                          acc[key] = {
                            user_id: r.user_id,
                            submitted_at: r.submitted_at,
                            responseIds: [],
                            userLabel: (r as any).userLabel || `User-${r.user_id?.slice(0, 8) || 'Unknown'}`,
                            answers: {}
                          };
                        }
                        acc[key].responseIds.push(r.id);
                        acc[key].answers[r.question_id] = r.answer;
                        return acc;
                      }, {} as { [key: string]: { user_id: string; submitted_at: string; responseIds: string[]; userLabel: string; answers: { [qid: string]: string } } })
                    ).map(([key, submission]) => (
                      <tr key={key}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{getUserIdentifier(submission)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{new Date(submission.submitted_at).toLocaleString()}</td>
                        {validQuestions.map((q) => (
                          <td key={q.id} className="px-4 py-3 text-sm text-gray-900">{submission.answers[q.id] || '-'}</td>
                        ))}
                        <td className="px-4 py-3 text-sm text-gray-500">
                          <button
                            onClick={() => deleteSubmission(submission.responseIds)}
                            className="inline-flex items-center gap-2 text-red-600 hover:text-red-800 text-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* Analytics View - Show visible, answerable questions only */
          <div className="space-y-6">
            {validQuestions.length === 0 ? (
              <div className="card text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No visible questions found</h3>
                <p className="text-gray-600">Only real, answerable questions are shown in analytics.</p>
              </div>
            ) : (
              validQuestions.map((question) => {
                const agg = aggregationData.find(a => a.question_id === question.id);
                const hasResponses = agg && agg.total_responses > 0;
                const stats = question.type === 'likert' ? calculateQuestionStats(question.id, question.type) : null;
                const questionResponses = filteredResponses
                  .filter(r => r.question_id === question.id)
                  .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
                const latestTextResponses = question.type === 'text'
                  ? questionResponses.map(r => r.answer).filter(Boolean).slice(0, 3)
                  : [];

                return (
                  <div key={question.id} className="card">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{question.question_text}</h3>
                        <p className="text-sm text-gray-500">
                          {hasResponses
                            ? `${agg!.total_responses} responses • ${question.type === 'text' ? 'Text responses' : question.type === 'likert' ? 'Rating distribution' : 'Choice distribution'}`
                            : 'No responses yet'
                          }
                        </p>
                      </div>
                      {question.type === 'likert' && stats && hasResponses && (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                          <p className="font-medium text-gray-900">Rating Summary</p>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                              <p className="text-xs uppercase text-gray-500">N</p>
                              <p className="font-semibold text-gray-900">{stats.n}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-gray-500">Mean</p>
                              <p className="font-semibold text-gray-900">{stats.mean.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-gray-500">Median</p>
                              <p className="font-semibold text-gray-900">{stats.median.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-gray-500">Std Dev</p>
                              <p className="font-semibold text-gray-900">{stats.stdDev.toFixed(2)}</p>
                            </div>
                          </div>
                          {stats.n < 3 && (
                            <p className="mt-2 text-xs text-yellow-700">Sample size is small; treat these values as preliminary.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {!hasResponses ? (
                      <div className="h-32 flex items-center justify-center bg-gray-50 rounded-lg">
                        <p className="text-gray-400 text-sm">Waiting for responses...</p>
                      </div>
                    ) : question.type === 'text' ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <p className="text-xs uppercase text-gray-500">Response Count</p>
                            <p className="mt-2 text-xl font-semibold text-gray-900">{agg!.total_responses}</p>
                          </div>
                          <div className="rounded-2xl border border-gray-200 bg-white p-4">
                            <p className="text-xs uppercase text-gray-500">Latest Responses</p>
                            <div className="mt-3 space-y-2">
                              {latestTextResponses.map((answer, idx) => (
                                <p key={idx} className="text-sm text-gray-700 border-l-2 border-slate-200 pl-3">{answer}</p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                        <div className="h-64">
                          {agg && agg.answers.length > 0 && agg.total_responses > 0 ? (
                            <Bar
                              data={getChartData(agg) as ChartData<'bar'>}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                              plugins: {
                                legend: { display: false },
                                tooltip: {
                                  callbacks: {
                                    label: (context) => {
                                      const count = context.raw as number;
                                      return `${count} response${count !== 1 ? 's' : ''}`;
                                    }
                                  }
                                }
                              },
                              scales: {
                                y: {
                                  beginAtZero: true,
                                  ticks: { stepSize: 1 }
                                }
                              }
                            }}
                          />
                          ) : (
                            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                              <p className="text-gray-400">No data to display</p>
                            </div>
                          )}
                        </div>
                        {question.type === 'likert' && stats && (
                          <div className="rounded-2xl border border-gray-200 bg-white p-4">
                            <p className="text-xs uppercase text-gray-500">Rating Details</p>
                            <div className="mt-3 space-y-2 text-sm text-gray-700">
                              <p>N: {stats.n}</p>
                              <p>Mean: {stats.mean.toFixed(2)}</p>
                              <p>Median: {stats.median.toFixed(2)}</p>
                              <p>Mode: {stats.mode !== null ? stats.mode.toFixed(0) : 'N/A'}</p>
                              <p>Min: {stats.min}</p>
                              <p>Max: {stats.max}</p>
                              <p>{stats.n < 2 ? 'Sample size too small for stable deviation.' : `Std Dev: ${stats.stdDev.toFixed(2)}`}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
