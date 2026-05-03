import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { apiGet } from '../../lib/api';
import { Survey } from '../../types';
import { ArrowLeft, FileText, Users, Calendar, Edit2, Copy, ArrowUpRight } from 'lucide-react';

export default function AllSurveys() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadSurveys();
  }, []);

  const loadSurveys = async () => {
    setIsLoading(true);
    const timestamp = new Date().getTime();
    const response = await apiGet<{ surveys: Survey[] }>(`/api/admin/surveys?_t=${timestamp}`);

    if (response.error) {
      showToast(response.error, 'error');
      setIsLoading(false);
      return;
    }

    setSurveys(response.data?.surveys || []);
    setIsLoading(false);
  };

  const copySurveyLink = (surveyId: string) => {
    const link = `${window.location.origin}/survey/${surveyId}`;
    navigator.clipboard.writeText(link);
    showToast('Survey link copied to clipboard', 'success');
  };

  const filteredSurveys = surveys.filter(survey =>
    survey.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (survey.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalResponses = surveys.reduce((sum, s) => sum + s.total_responses, 0);

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
                <h1 className="text-xl font-bold text-gray-900">All Surveys</h1>
                <p className="text-xs text-gray-500">{surveys.length} surveys • {totalResponses} total responses</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/admin/surveys/new')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-medium transition-all hover:bg-slate-800"
            >
              + New Survey
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search surveys..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-md px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
          />
        </div>

        {/* Surveys Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
                <div className="h-4 bg-gray-200 rounded w-full mb-4" />
                <div className="flex gap-2">
                  <div className="h-4 bg-gray-200 rounded w-20" />
                  <div className="h-4 bg-gray-200 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredSurveys.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No surveys found</h3>
            <p className="text-gray-500">Try adjusting your search or create a new survey</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSurveys.map((survey) => (
              <div
                key={survey.id}
                className="group bg-white rounded-2xl border border-gray-100 p-6 transition-all hover:shadow-xl hover:-translate-y-0.5 hover:border-gray-200 cursor-pointer"
                onClick={() => navigate(`/admin/surveys/${survey.id}/analytics`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    survey.status === 'open'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-gray-50 text-gray-600 border border-gray-200'
                  }`}>
                    {survey.status === 'open' ? 'Open' : 'Closed'}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-slate-700 transition-colors">
                  {survey.title}
                </h3>
                <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                  {survey.description || 'No description'}
                </p>

                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {survey.total_responses} responses
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {new Date(survey.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copySurveyLink(survey.id);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 sm:py-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium min-h-[44px]"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/surveys/${survey.id}/edit`);
                      }}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-0 px-3 py-2.5 sm:p-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium sm:text-[0px] min-h-[44px]"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span className="sm:hidden">Edit</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/admin/surveys/${survey.id}/analytics`);
                      }}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-0 px-3 py-2.5 sm:p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium sm:text-[0px] min-h-[44px]"
                      title="Analytics"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      <span className="sm:hidden">Analytics</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
