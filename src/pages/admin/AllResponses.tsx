import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { apiGet, apiDelete } from '../../lib/api';
import { Survey, Response } from '../../types';
import { ArrowLeft, Users, FileText, Clock, User, Search, Filter, Download, Trash2, BarChart3 } from 'lucide-react';

interface ResponseWithDetails extends Response {
  survey_title?: string;
  user_email?: string;
  user_fingerprint?: string;
}

export default function AllResponses() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [responses, setResponses] = useState<ResponseWithDetails[]>([]);
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

    // Load responses for each survey
    const allResponses: ResponseWithDetails[] = [];
    for (const survey of surveyList) {
      const response = await apiGet<{ responses: Response[] }>(
        `/api/admin/surveys/${survey.id}/analytics?_t=${timestamp}`
      );
      if (!response.error && response.data?.responses) {
        const surveyResponses = response.data.responses.map(r => ({
          ...r,
          survey_title: survey.title,
          user_email: r.user_id, // Will be updated if we have profile data
        }));
        allResponses.push(...surveyResponses);
      }
    }

    // Sort by timestamp descending
    allResponses.sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime());
    setResponses(allResponses);
    setIsLoading(false);
  };

  const deleteResponse = async (responseId: string, surveyId: string) => {
    if (!confirm('Are you sure you want to delete this response?')) return;

    const response = await apiDelete<{ success: boolean }>(
      `/api/admin/surveys/${surveyId}/responses/${responseId}`
    );

    if (response.error) {
      showToast(response.error, 'error');
    } else {
      showToast('Response deleted successfully', 'success');
      setResponses(prev => prev.filter(r => r.id !== responseId));
    }
  };

  const exportToCSV = () => {
    const headers = ['User ID', 'Email', 'Survey', 'Answer', 'Submitted At'];
    const rows = filteredResponses.map(r => [
      r.user_id,
      r.user_email || 'Anonymous',
      r.survey_title || 'Unknown',
      r.answer,
      new Date(r.submitted_at).toLocaleString()
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-responses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Responses exported successfully', 'success');
  };

  const filteredResponses = responses.filter(response => {
    const matchesSearch = 
      response.user_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      response.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      response.survey_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      response.answer?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSurvey = filterSurvey === 'all' || response.survey_title === filterSurvey;
    
    return matchesSearch && matchesSurvey;
  });

  const uniqueSurveys = [...new Set(responses.map(r => r.survey_title).filter(Boolean))];

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
                <p className="text-xs text-gray-500">{responses.length} total responses across {surveys.length} surveys</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportToCSV}
                disabled={filteredResponses.length === 0}
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

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Responses</p>
                <p className="text-xl font-bold text-gray-900">{responses.length}</p>
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
                <p className="text-xl font-bold text-gray-900">{surveys.filter(s => s.status === 'open').length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Filtered Results</p>
                <p className="text-xl font-bold text-gray-900">{filteredResponses.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Responses Table */}
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
        ) : filteredResponses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No responses found</h3>
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
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Answer</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Submitted</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredResponses.map((response) => (
                    <tr key={response.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{response.user_id?.slice(0, 12) || 'Anonymous'}</p>
                            <p className="text-xs text-gray-500">{response.user_email || 'No email'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">{response.survey_title || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900 max-w-xs truncate" title={response.answer}>
                          {response.answer || '-'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="w-4 h-4" />
                          {new Date(response.submitted_at).toLocaleString('en-US', {
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
                          onClick={() => deleteResponse(response.id, response.survey_id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete response"
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
