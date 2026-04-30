import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { supabase } from '../../lib/supabase';
import { Survey, Question, Response, ResponseAggregation } from '../../types';
import { ArrowLeft, FileSpreadsheet, FileJson, Users, Calendar, Lightbulb } from 'lucide-react';
import IntelligenceDashboard from '../../components/IntelligenceDashboard';
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
  const [aggregations, setAggregations] = useState<ResponseAggregation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<'analytics' | 'intelligence' | 'raw'>('analytics');

  useEffect(() => {
    if (surveyId) {
      loadData();
    }
  }, [surveyId]);

  const loadData = async () => {
    if (!surveyId) return;
    setIsLoading(true);
    
    // Load survey
    const { data: surveyData, error: surveyError } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError || !surveyData) {
      showToast('Failed to load survey', 'error');
      navigate('/admin');
      return;
    }
    setSurvey(surveyData);

    // Load questions
    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('survey_id', surveyId)
      .order('order_index', { ascending: true });

    if (questionsError) {
      showToast('Failed to load questions', 'error');
    } else {
      setQuestions(questionsData || []);
    }

    // Load responses with user info
    const { data: responsesData, error: responsesError } = await supabase
      .from('responses')
      .select(`
        *,
        question:questions(*),
        profile:profiles(email)
      `)
      .eq('survey_id', surveyId);

    if (responsesError) {
      showToast('Failed to load responses', 'error');
    } else {
      const typedResponses = (responsesData || []).map((r: Response & { question: unknown; profile: unknown }) => ({
        ...r,
        question: r.question as Question,
        profile: r.profile as { email: string }
      }));
      setResponses(typedResponses);
      
      // Calculate aggregations
      const aggs = calculateAggregations(questionsData || [], typedResponses);
      setAggregations(aggs);
    }

    setIsLoading(false);
  };

  const calculateAggregations = (questions: Question[], responses: Array<Response & { question?: Question; profile?: { email: string } }>): ResponseAggregation[] => {
    return questions.map(question => {
      const questionResponses = responses.filter(r => r.question_id === question.id);
      const answers: { [key: string]: number } = {};
      
      questionResponses.forEach(r => {
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

  const exportToCSV = () => {
    if (!questions.length || !responses.length) return;

    // Build CSV rows
    const headers = ['User Email', 'Submitted At', ...questions.map(q => q.question_text)];
    
    // Group responses by user_id and submitted_at
    const grouped: { [key: string]: { email: string; submitted_at: string; answers: { [qid: string]: string } } } = {};
    
    responses.forEach(r => {
      const key = `${r.user_id}_${r.submitted_at}`;
      if (!grouped[key]) {
        grouped[key] = {
          email: (r as any).profile?.email || 'Unknown',
          submitted_at: r.submitted_at,
          answers: {}
        };
      }
      grouped[key].answers[r.question_id] = r.answer;
    });

    const rows = Object.values(grouped).map(g => [
      g.email,
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
      responses: responses.map(r => ({
        ...r,
        user_email: (r as any).profile?.email
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
          <div className="flex justify-between items-center h-16">
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={exportToCSV}
                disabled={!responses.length}
                className="btn-secondary flex items-center gap-2 disabled:opacity-50"
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
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {survey?.total_responses} total responses
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Created {survey && new Date(survey.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-4 mb-6 border-b border-gray-200">
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
        ) : activeView === 'raw' ? (
          /* Raw Data View */
          <div className="card overflow-hidden">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Response Data</h2>
            {responses.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No responses yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                      {questions.map(q => (
                        <th key={q.id} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          {q.question_text}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {/* Group responses by submission */}
                    {Object.entries(
                      responses.reduce((acc, r) => {
                        const key = `${r.user_id}_${r.submitted_at}`;
                        if (!acc[key]) {
                          acc[key] = { user_id: r.user_id, submitted_at: r.submitted_at, email: (r as any).profile?.email, answers: {} };
                        }
                        acc[key].answers[r.question_id] = r.answer;
                        return acc;
                      }, {} as { [key: string]: { user_id: string; submitted_at: string; email: string; answers: { [qid: string]: string } } })
                    ).map(([key, submission]) => (
                      <tr key={key}>
                        <td className="px-4 py-3 text-sm text-gray-900">{submission.email || 'Unknown'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{new Date(submission.submitted_at).toLocaleString()}</td>
                        {questions.map(q => (
                          <td key={q.id} className="px-4 py-3 text-sm text-gray-900">{submission.answers[q.id] || '-'}</td>
                        ))}
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
              aggregations.map((agg) => (
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
