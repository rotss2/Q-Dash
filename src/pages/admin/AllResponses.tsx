import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { apiGet, apiDelete } from '../../lib/api';
import { Survey, Response, Question } from '../../types';
import { ArrowLeft, Users, FileText, Clock, User, Search, Filter, Download, Trash2, BarChart3 } from 'lucide-react';

interface GroupedSubmission {
  id: string; // Composite key: userId_surveyId
  user_id: string;
  user_email: string | null;
  survey_id: string;
  survey_title: string;
  answers: { question: string; answer: string }[];
  submitted_at: string;
  ip_address?: string;
  user_agent?: string;
}

export default function AllResponses() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [submissions, setSubmissions] = useState<GroupedSubmission[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSurvey, setFilterSurvey] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const timestamp = new Date().getTime();
    
    // Load all surveys first
    const surveysResponse = await apiGet<{ surveys: Survey[] }>(`/api/admin/surveys?_t=${timestamp}`);
    if (surveysResponse.error) {
      showToast(surveysResponse.error, 'error');
      setIsLoading(false);
      return;
    }

    const surveyList = surveysResponse.data?.surveys || [];
    setSurveys(surveyList);

    // Load responses for each survey and group by user+survey
    const submissionMap = new Map<string, GroupedSubmission>();
    
    for (const survey of surveyList) {
      const response = await apiGet<{
        responses: Array<Response & { question?: Question; profile?: { email?: string; age?: number; gender?: string } }>;
      }>(`/api/admin/surveys/${survey.id}/analytics?_t=${timestamp}`);
      
      if (!response.error && response.data?.responses) {
        console.log('API responses sample:', response.data.responses.slice(0, 3).map(r => ({ 
          user_id: r.user_id?.slice(0, 8), 
          profile: r.profile,
          question: r.question?.question_text?.slice(0, 30)
        })));
        for (const r of response.data?.responses) {
          const key = `${r.user_id}_${r.survey_id}`;
          
          if (!submissionMap.has(key)) {
            submissionMap.set(key, {
              id: key,
              user_id: r.user_id,
              user_email: r.profile?.email || null,
              survey_id: r.survey_id,
              survey_title: survey.title,
              answers: [],
              submitted_at: r.submitted_at,
              ip_address: (r as any).ip_address,
              user_agent: (r as any).user_agent,
            });
          }
          
          // Add answer to the submission
          const submission = submissionMap.get(key)!;
          submission.answers.push({
            question: r.question?.question_text || 'Unknown Question',
            answer: r.answer,
          });
          
          // Keep the latest timestamp
          if (new Date(r.submitted_at) > new Date(submission.submitted_at)) {
            submission.submitted_at = r.submitted_at;
          }
        }
      }
    }

    // Convert to array and sort by timestamp descending
    const groupedSubmissions = Array.from(submissionMap.values());
    groupedSubmissions.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    setSubmissions(groupedSubmissions);
    setIsLoading(false);
  };

  const deleteSubmission = async (userId: string, surveyId: string) => {
    if (!confirm('Are you sure you want to delete this entire submission? This will remove all answers from this user for this survey.')) return;

    // Find all response IDs for this user+survey combination
    const timestamp = new Date().getTime();
    const response = await apiGet<{
      responses: Array<Response>;
    }>(`/api/admin/surveys/${surveyId}/analytics?_t=${timestamp}`);
    
    if (response.error) {
      showToast(response.error, 'error');
      return;
    }

    // Delete all responses from this user for this survey
    const userResponses = response.data?.responses.filter(r => r.user_id === userId) || [];
    let deletedCount = 0;
    
    for (const r of userResponses) {
      const deleteResult = await apiDelete<{ success: boolean }>(
        `/api/admin/surveys/${surveyId}/responses/${r.id}`
      );
      if (!deleteResult.error) {
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      showToast(`Deleted ${deletedCount} response(s) successfully`, 'success');
      setSubmissions(prev => prev.filter(s => !(s.user_id === userId && s.survey_id === surveyId)));
    } else {
      showToast('Failed to delete responses', 'error');
    }
  };

  const exportToCSV = () => {
    const headers = ['User ID', 'Email', 'Survey', 'Answers', 'Submitted At', 'IP Address'];
    const rows = filteredSubmissions.map(s => [
      s.user_id,
      s.user_email || 'Anonymous',
      s.survey_title || 'Unknown',
      s.answers.map(a => `${a.question}: ${a.answer}`).join('; '),
      new Date(s.submitted_at).toLocaleString(),
      s.ip_address || 'N/A'
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-submissions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast(`${filteredSubmissions.length} submissions exported successfully`, 'success');
  };

  const filteredSubmissions = submissions.filter(submission => {
    const matchesSearch = 
      submission.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.survey_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.answers.some(a => 
        a.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.answer.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    const matchesSurvey = filterSurvey === 'all' || submission.survey_title === filterSurvey;
    
    return matchesSearch && matchesSurvey;
  });

  const uniqueSurveys = [...new Set(submissions.map(s => s.survey_title).filter(Boolean))];
  
  // Calculate filtered stats
  const filteredCount = filteredSubmissions.length;
  const activeSurveysCount = filterSurvey === 'all' 
    ? surveys.filter(s => s.status === 'open').length 
    : (surveys.find(s => s.title === filterSurvey)?.status === 'open' ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">All Responses</h1>
                <p className="text-xs text-gray-500">{submissions.length} total submissions across {surveys.length} surveys</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportToCSV}
                disabled={filteredSubmissions.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium transition-all hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by user, email, survey, or answer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterSurvey}
              onChange={(e) => setFilterSurvey(e.target.value)}
              className="px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
            >
              <option value="all">All Surveys</option>
              {uniqueSurveys.map(survey => (
                <option key={survey} value={survey}>{survey}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats Summary - Now shows filtered counts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className={`rounded-xl border p-4 transition-colors ${filterSurvey !== 'all' ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">
                  {filterSurvey === 'all' ? 'Total Submissions' : 'Filtered Submissions'}
                </p>
                <p className="text-xl font-bold text-gray-900">{filteredCount}</p>
                {filterSurvey !== 'all' && (
                  <p className="text-xs text-blue-600">of {submissions.length} total</p>
                )}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Surveys</p>
                <p className="text-xl font-bold text-gray-900">{activeSurveysCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Unique Users</p>
                <p className="text-xl font-bold text-gray-900">
                  {new Set(filteredSubmissions.map(s => s.user_id)).size}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Submissions Table */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions found</h3>
            <p className="text-gray-500">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Survey</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Answers</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Submitted</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSubmissions.map((submission) => (
                    <tr key={submission.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{submission.user_id?.slice(0, 12) || 'Anonymous'}</p>
                            {submission.user_email ? (
                              <p className="text-xs text-emerald-600 font-medium">{submission.user_email}</p>
                            ) : (
                              <p className="text-xs text-gray-400">No email provided</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{submission.survey_title || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {submission.answers.slice(0, 2).map((a, i) => (
                            <p key={i} className="text-sm text-gray-600 truncate max-w-xs">
                              <span className="font-medium text-gray-900">{a.question.slice(0, 30)}...</span>: {a.answer.slice(0, 50)}
                            </p>
                          ))}
                          {submission.answers.length > 2 && (
                            <p className="text-xs text-gray-400">+{submission.answers.length - 2} more answers</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="w-4 h-4" />
                          {new Date(submission.submitted_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => deleteSubmission(submission.user_id, submission.survey_id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete entire submission"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
