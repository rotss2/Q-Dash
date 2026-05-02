import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { apiGet, apiPost, apiDelete } from '../../lib/api';
import { Survey, Question, Response, ResponseAggregation } from '../../types';
import { ArrowLeft, FileSpreadsheet, FileJson, Users, Calendar, Lightbulb, Trash2, Calculator, Download, Table, FileCode, BarChart3, RotateCcw } from 'lucide-react';
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
import { Bar, Pie } from 'react-chartjs-2';

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
  const [activeView, setActiveView] = useState<'analytics' | 'intelligence' | 'conclusion' | 'raw' | 'statistics'>('analytics');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (surveyId) {
      loadData();
    }
  }, [surveyId]);

  const loadData = async () => {
    if (!surveyId) return;
    setIsLoading(true);
    console.log('Analytics: Loading data for survey:', surveyId);

    // Add cache-busting timestamp to force fresh data
    const timestamp = new Date().getTime();
    const { data, error } = await apiGet<{
      survey: Survey;
      questions: Question[];
      responses: Array<Response & { question?: Question; profile?: { email: string } }>;
    }>(`/api/admin/surveys/${surveyId}/analytics?_t=${timestamp}`);

    if (error || !data?.survey) {
      console.error('Analytics: Failed to load survey:', error);
      showToast(error || 'Failed to load survey', 'error');
      navigate('/admin');
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
    setIsLoading(false);
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

  const calculateAggregations = (): ResponseAggregation[] => {
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    responses.forEach((r) => {
      if (r.question && !questionMap.has(r.question_id)) {
        questionMap.set(r.question_id, r.question);
      }
    });

    return Array.from(questionMap.values()).map((question) => {
      const questionResponses = filteredResponses.filter((r) => r.question_id === question.id);
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
    });
  };

  const filteredResponses = responses.filter((response) => {
    const submittedAt = new Date(response.submitted_at);
    const fromDate = filterFrom ? new Date(filterFrom) : null;
    const toDate = filterTo ? new Date(filterTo) : null;

    if (fromDate && submittedAt < fromDate) return false;
    if (toDate && submittedAt > toDate) return false;
    return true;
  });

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
    if (!questions.length || !responses.length) return;

    // Build CSV rows
    const headers = ['User', 'Submitted At', ...questions.map(q => q.question_text)];
    
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
      ...questions.map(q => g.answers[q.id] || '')
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
      questions,
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

  const getNumericResponses = (questionId: string): number[] => {
    return filteredResponses
      .filter(r => r.question_id === questionId)
      .map(r => {
        const num = parseFloat(r.answer);
        return isNaN(num) ? null : num;
      })
      .filter((n): n is number => n !== null);
  };

  const getLikertResponses = (questionId: string): number[] => {
    const likertMap: { [key: string]: number } = {
      'strongly disagree': 1, 'disagree': 2, 'neutral': 3, 'agree': 4, 'strongly agree': 5,
      '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
      'very dissatisfied': 1, 'dissatisfied': 2, 'somewhat dissatisfied': 2, 'somewhat satisfied': 4, 'satisfied': 4, 'very satisfied': 5
    };
    return filteredResponses
      .filter(r => r.question_id === questionId)
      .map(r => likertMap[r.answer.toLowerCase().trim()] || parseFloat(r.answer))
      .filter((n): n is number => !isNaN(n));
  };

  const calculateQuestionStats = (questionId: string, questionType: string) => {
    const values = questionType === 'likert' ? getLikertResponses(questionId) : getNumericResponses(questionId);
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

  // Correlation Analysis (Pearson)
  const calculateCorrelation = (q1Id: string, q2Id: string): number | null => {
    const x = getLikertResponses(q1Id);
    const y = getLikertResponses(q2Id);
    if (x.length !== y.length || x.length < 2) return null;
    
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

  // Export to Excel (CSV with multiple sheets simulated)
  const exportToExcel = () => {
    if (!questions.length || !responses.length) return;
    
    // Sheet 1: Raw Data
    const rawHeaders = ['User ID', 'Submitted At', ...questions.map(q => q.question_text)];
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
      ...questions.map(q => g.answers[q.id] || '')
    ]);

    // Sheet 2: Statistics Summary
    const statsRows = questions
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
    if (!questions.length || !responses.length) return;
    
    // SPSS requires numeric codes for categorical data
    const questionCodes: { [key: string]: { [key: string]: number } } = {};
    questions.forEach(q => {
      const uniqueAnswers = [...new Set(filteredResponses.filter(r => r.question_id === q.id).map(r => r.answer))];
      questionCodes[q.id] = {};
      uniqueAnswers.forEach((ans, idx) => {
        questionCodes[q.id][ans] = idx + 1;
      });
    });

    const headers = ['user_id', 'submitted_at', ...questions.map(q => `Q${q.id.slice(0, 6)}`)];
    const valueLabels = questions.map(q => {
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
      ...questions.map(q => g.answers[q.id] || '')
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
    if (!questions.length || !responses.length) return;
    
    const aggregations = calculateAggregations();
    
    let latex = `\\begin{table}[h]\n`;
    latex += `\\centering\n`;
    latex += `\\caption{${survey?.title} - Response Summary}\n`;
    latex += `\\begin{tabular}{|l|c|c|}\n`;
    latex += `\\hline\n`;
    latex += `\\textbf{Question} & \\textbf{Response} & \\textbf{Count} \\\\\n`;
    latex += `\\hline\n`;
    
    aggregations.forEach(agg => {
      agg.answers.forEach((ans, idx) => {
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between h-auto md:h-16">
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={exportToCSV}
                disabled={!responses.length}
                className="btn-secondary flex flex-wrap items-center gap-2 disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={exportToJSON}
                disabled={!responses.length}
                className="btn-secondary flex items-center gap-2 disabled:opacity-50"
              >
                <FileJson className="w-4 h-4" />
                Export JSON
              </button>
              <div className="relative group">
                <button
                  disabled={!responses.length}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Research Export
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <button
                    onClick={exportToExcel}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2"
                  >
                    <Table className="w-4 h-4" />
                    Excel + Stats
                  </button>
                  <button
                    onClick={exportToSPSS}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    SPSS CSV
                  </button>
                  <button
                    onClick={exportToLaTeX}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2"
                  >
                    <FileCode className="w-4 h-4" />
                    LaTeX Table
                  </button>
                  <button
                    onClick={exportChartsPNG}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center gap-2"
                  >
                    <BarChart3 className="w-4 h-4" />
                    Charts PNG
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Survey Info */}
        <div className="card mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{survey?.title}</h1>
          <p className="text-gray-600 mb-4">{survey?.description || 'No description'}</p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-500">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {new Set(responses.map(r => r.user_id)).size} unique responses
                {survey?.total_responses !== new Set(responses.map(r => r.user_id)).size && (
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
                  disabled={isResetting || responses.length === 0}
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
            questions={questions}
            responses={responses}
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
              {questions.filter(q => q.type === 'likert').length === 0 ? (
                <p className="text-gray-500">No Likert scale questions available for statistical analysis</p>
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
                      {questions.filter(q => q.type === 'likert').map(q => {
                        const stats = calculateQuestionStats(q.id, q.type);
                        return stats ? (
                          <tr key={q.id}>
                            <td className="px-4 py-3 text-sm text-gray-900 max-w-md truncate">{q.question_text}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600">{stats.n}</td>
                            <td className="px-4 py-3 text-sm text-center font-semibold text-blue-600">{stats.mean.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600">{stats.median.toFixed(2)}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600">{stats.mode?.toFixed(2) || 'N/A'}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600">{stats.stdDev.toFixed(2)}</td>
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
            {questions.filter(q => q.type === 'likert').length >= 2 && (
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-green-600" />
                  Correlation Analysis (Pearson r)
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Questions</th>
                        {questions.filter(q => q.type === 'likert').map(q => (
                          <th key={q.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase max-w-[8rem] truncate">
                            Q{questions.filter(q2 => q2.type === 'likert').indexOf(q) + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {questions.filter(q => q.type === 'likert').map((q1, i) => (
                        <tr key={q1.id}>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                            Q{i + 1}: {q1.question_text}
                          </td>
                          {questions.filter(q => q.type === 'likert').map((q2, j) => {
                            if (i === j) {
                              return <td key={q2.id} className="px-4 py-3 text-center text-sm text-gray-400 bg-gray-50">—</td>;
                            }
                            const corr = calculateCorrelation(q1.id, q2.id);
                            const color = corr === null ? 'text-gray-400' : 
                              Math.abs(corr) >= 0.7 ? 'text-green-600 font-bold' :
                              Math.abs(corr) >= 0.4 ? 'text-blue-600' : 'text-gray-600';
                            return (
                              <td key={q2.id} className={`px-4 py-3 text-center text-sm ${color}`}>
                                {corr !== null ? corr.toFixed(3) : 'N/A'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
            questions={questions}
            responses={responses}
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
                      {questions.map(q => (
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
                        {questions.map((q) => (
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
          /* Analytics View */
          <div className="space-y-6">
            {responses.length === 0 ? (
              <div className="card text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No responses yet</h3>
                <p className="text-gray-600">Share your survey link to start collecting responses</p>
              </div>
            ) : (
              calculateAggregations().map((agg) => (
                <div key={agg.question_id} className="card">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{agg.question_text}</h3>
                    <p className="text-sm text-gray-500">
                      {agg.total_responses} responses • {agg.type === 'text' ? 'Text responses' : 'Choice distribution'}
                    </p>
                  </div>

                  {agg.type === 'text' ? (
                    /* Text Responses List */
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {agg.answers.map((answer, idx) => (
                        <div key={idx} className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                          <span className="font-medium text-gray-500 mr-2">#{idx + 1}</span>
                          {answer.value}
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Chart for Choice/Likert */
                    <div className="h-64">
                      {agg.type === 'likert' ? (
                        <Bar
                          data={getChartData(agg) as ChartData<'bar'>}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { display: false }
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
                        <Pie
                          data={getChartData(agg) as ChartData<'pie'>}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
