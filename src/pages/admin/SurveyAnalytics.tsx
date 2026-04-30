import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { apiGet, apiDelete } from '../../lib/api';
import { Survey, Question, Response, ResponseAggregation } from '../../types';
import { ArrowLeft, FileSpreadsheet, FileJson, Users, Calendar, Lightbulb, Trash2 } from 'lucide-react';
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
  const [activeView, setActiveView] = useState<'analytics' | 'intelligence' | 'conclusion' | 'raw'>('analytics');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  useEffect(() => {
    if (surveyId) {
      loadData();
    }
  }, [surveyId]);

  const loadData = async () => {
    if (!surveyId) return;
    setIsLoading(true);

    const { data, error } = await apiGet<{
      survey: Survey;
      questions: Question[];
      responses: Array<Response & { question?: Question; profile?: { email: string } }>;
    }>(`/api/admin/surveys/${surveyId}/analytics`);

    if (error || !data?.survey) {
      showToast(error || 'Failed to load survey', 'error');
      navigate('/admin');
      return;
    }

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
        </div>

        {activeView === 'intelligence' ? (
          /* Intelligence Dashboard */
          <IntelligenceDashboard
            questions={questions}
            responses={responses}
            surveyTitle={survey?.title || 'Survey'}
          />
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
                        <td className="px-4 py-3 text-sm text-gray-900">{submission.userLabel}</td>
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
