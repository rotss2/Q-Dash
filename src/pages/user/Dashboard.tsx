import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/Toaster';
import { supabase } from '../../lib/supabase';
import { Survey } from '../../types';
import { LogOut, ClipboardList, CheckCircle, Clock, ExternalLink } from 'lucide-react';

export default function UserDashboard() {
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [completedSurveys, setCompletedSurveys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSurveys();
  }, [user]);

  const loadSurveys = async () => {
    setIsLoading(true);

    // Load open surveys
    const { data: surveysData, error: surveysError } = await supabase
      .from('surveys')
      .select('*')
      .eq('status', 'open');

    if (surveysError) {
      showToast('Failed to load surveys', 'error');
    } else {
      setSurveys(surveysData || []);
    }

    // Load user's completed responses
    if (user) {
      const { data: responsesData } = await supabase
        .from('responses')
        .select('survey_id')
        .eq('user_id', user.id);

      if (responsesData) {
        const completed = new Set<string>(responsesData.map((r: { survey_id: string }) => r.survey_id));
        setCompletedSurveys(completed);
      }
    }

    setIsLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const openSurvey = (surveyId: string) => {
    navigate(`/survey/${surveyId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between h-auto md:h-16">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Respondent Portal</h1>
            </div>
            <div className="flex flex-col gap-3 items-start sm:flex-row sm:items-center">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <button onClick={handleSignOut} className="btn-secondary flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Available Surveys</h2>
          <p className="text-gray-600">Complete surveys to share your feedback</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : surveys.length === 0 ? (
          <div className="card text-center py-12">
            <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No surveys available</h3>
            <p className="text-gray-600">Check back later for new surveys</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {surveys.map((survey) => {
              const isCompleted = completedSurveys.has(survey.id);
              return (
                <div key={survey.id} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{survey.title}</h3>
                        {isCompleted ? (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Completed
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Available
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm mb-4">{survey.description || 'No description'}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{survey.total_responses} responses collected</span>
                        <span>Created {new Date(survey.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => openSurvey(survey.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                        isCompleted
                          ? 'text-gray-600 hover:bg-gray-100'
                          : 'btn-primary'
                      }`}
                    >
                      {isCompleted ? (
                        <>
                          View Again
                          <ExternalLink className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          Start Survey
                          <ExternalLink className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
