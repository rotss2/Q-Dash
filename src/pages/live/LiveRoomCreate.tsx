import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toaster';
import { useAuth } from '../../hooks/useAuth';
import { useCreateLiveRoom } from '../../hooks/useLiveRoom';
import { SkeletonCard } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { 
  Gamepad2, 
  ArrowLeft, 
  Plus, 
  Clock, 
  Play,
  CheckCircle
} from 'lucide-react';

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  question_count: number;
}

export default function LiveRoomCreate() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { createRoom, creating } = useCreateLiveRoom();
  
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(20);
  const [createdRoom, setCreatedRoom] = useState<{ room_code: string; id: string } | null>(null);

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('surveys')
          .select('id, title, description, mode')
          .eq('mode', 'quiz')
          .eq('status', 'open');

        if (error) throw error;

        // Fetch question counts
        const quizzesWithCount = await Promise.all(
          (data || []).map(async (quiz) => {
            const { count } = await supabase
              .from('questions')
              .select('*', { count: 'exact', head: true })
              .eq('survey_id', quiz.id);
            return {
              id: quiz.id,
              title: quiz.title,
              description: quiz.description,
              question_count: count || 0,
            };
          })
        );

        setQuizzes(quizzesWithCount);
      } catch (error) {
        console.error('Error fetching quizzes:', error);
        showToast('Failed to load quizzes', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, [showToast]);

  const handleCreateRoom = async () => {
    if (!selectedQuiz || !user?.id) {
      showToast('Please select a quiz', 'error');
      return;
    }

    const room = await createRoom({
      quizId: selectedQuiz,
      hostId: user.id,
      timerSeconds,
    });

    if (room) {
      setCreatedRoom({ room_code: room.room_code, id: room.id });
      showToast('Live room created!', 'success');
    }
  };

  const copyRoomCode = () => {
    if (createdRoom?.room_code) {
      navigator.clipboard.writeText(createdRoom.room_code);
      showToast('Room code copied!', 'success');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <SkeletonCard count={3} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-indigo-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Create Live Quiz</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {createdRoom ? (
          /* Success State - Room Created */
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-lg">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Room Created!</h2>
            <p className="text-gray-500 mb-6">Share this code with your students to join</p>
            
            <div 
              onClick={copyRoomCode}
              className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 cursor-pointer hover:bg-indigo-100 transition-colors mb-6"
            >
              <p className="text-sm text-indigo-600 font-medium mb-2">Room Code</p>
              <p className="text-5xl font-bold text-indigo-900 tracking-widest">
                {createdRoom.room_code}
              </p>
              <p className="text-sm text-indigo-500 mt-2">Click to copy</p>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate(`/live/host/${createdRoom.id}`)}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all"
              >
                <Play className="w-5 h-5" />
                Go to Host Dashboard
              </button>
              <button
                onClick={() => {
                  setCreatedRoom(null);
                  setSelectedQuiz(null);
                }}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
              >
                Create Another
              </button>
            </div>
          </div>
        ) : (
          /* Create Room Form */
          <div className="space-y-6">
            {/* Quiz Selection */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Select Quiz</h2>
              
              {quizzes.length === 0 ? (
                <EmptyState
                  type="default"
                  title="No Published Quizzes"
                  description="Create and publish a quiz first to start a live battle"
                  action={{
                    label: 'Create Quiz',
                    onClick: () => navigate('/admin/surveys'),
                  }}
                />
              ) : (
                <div className="grid gap-3">
                  {quizzes.map((quiz) => (
                    <button
                      key={quiz.id}
                      onClick={() => setSelectedQuiz(quiz.id)}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
                        selectedQuiz === quiz.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <div>
                        <h3 className="font-bold text-gray-900">{quiz.title}</h3>
                        <p className="text-sm text-gray-500">
                          {quiz.question_count} questions
                          {quiz.description && ` • ${quiz.description}`}
                        </p>
                      </div>
                      {selectedQuiz === quiz.id && (
                        <CheckCircle className="w-6 h-6 text-indigo-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Timer Settings */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Timer Settings
              </h2>
              
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-24">Time per question:</span>
                <div className="flex items-center gap-2">
                  {[10, 15, 20, 30, 45, 60].map((seconds) => (
                    <button
                      key={seconds}
                      onClick={() => setTimerSeconds(seconds)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        timerSeconds === seconds
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {seconds}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Create Button */}
            <button
              onClick={handleCreateRoom}
              disabled={!selectedQuiz || creating}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {creating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-6 h-6" />
                  Create Live Room
                </>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
