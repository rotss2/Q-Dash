import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { useLiveRoomStudent } from '../../hooks/useLiveRoom';
import { SkeletonCard } from '../../components/LoadingSkeleton';
import { 
  Gamepad2, 
  Clock, 
  CheckCircle, 
  Trophy,
  Users,
  Crown,
  ArrowRight
} from 'lucide-react';

export default function LiveRoomStudent() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const { 
    room, 
    participant, 
    currentQuestion, 
    hasAnswered,
    leaderboard,
    loading, 
    error,
    submitAnswer
  } = useLiveRoomStudent(roomCode || null);
  
  const [selectedOption] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(20);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [showPodium, setShowPodium] = useState(false);

  // Timer effect
  useEffect(() => {
    if (!room || room.status !== 'active' || !currentQuestion || hasAnswered) return;

    const timer = room.timer_seconds || 20;
    setTimeRemaining(timer);
    setQuestionStartTime(Date.now());

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto-submit if time runs out
          if (selectedOption) {
            handleSubmit(selectedOption);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [room?.status, currentQuestion?.id, hasAnswered, room?.timer_seconds]);

  const handleSubmit = useCallback(async (option: string) => {
    if (!currentQuestion || !participant || hasAnswered) return;

    const responseTimeMs = Date.now() - questionStartTime;
    const timerSeconds = room?.timer_seconds || 20;

    // Determine if answer is correct
    const isCorrect = currentQuestion.correct_answer === option;

    await submitAnswer({
      questionId: currentQuestion.id,
      selectedOptionId: option,
      answerText: option,
      isCorrect,
      responseTimeMs,
      timerSeconds,
    });

    showToast(isCorrect ? 'Correct! +' + (1000 + Math.round((timerSeconds * 1000 - responseTimeMs) / (timerSeconds * 1000) * 500)) : 'Incorrect', isCorrect ? 'success' : 'info');
  }, [currentQuestion, participant, hasAnswered, questionStartTime, room?.timer_seconds, submitAnswer, showToast]);

  // Show podium when quiz ends
  useEffect(() => {
    if (room?.status === 'finished') {
      setShowPodium(true);
    }
  }, [room?.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
        <SkeletonCard count={2} />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Gamepad2 className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Room Not Available</h2>
          <p className="text-gray-400 mb-6">{error || "The room may have ended or doesn't exist"}</p>
          <button
            onClick={() => navigate('/student/quizzes')}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  // Podium / Results
  if (showPodium || room.status === 'finished') {
    const myRank = leaderboard.findIndex(l => l.participant_id === participant?.id) + 1;
    const topThree = leaderboard.slice(0, 3);

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-white/10 backdrop-blur rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-10 h-10 text-amber-400" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Quiz Complete!</h1>
            {myRank > 0 && (
              <p className="text-2xl text-white/80">
                You ranked <span className="font-bold text-amber-400">#{myRank}</span>
              </p>
            )}
          </div>

          {/* Podium */}
          <div className="flex items-end justify-center gap-4 mb-12">
            {/* 2nd Place */}
            {topThree[1] && (
              <div className="flex flex-col items-center">
                <div className="w-32 h-32 bg-gray-300 rounded-full border-4 border-white flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-3xl font-bold text-gray-600">
                    {topThree[1].display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="bg-gray-200 rounded-t-lg p-4 w-28 text-center">
                  <p className="font-bold text-gray-800 truncate">{topThree[1].display_name}</p>
                  <p className="text-2xl font-bold text-gray-600">{topThree[1].score.toLocaleString()}</p>
                </div>
                <div className="bg-gray-300 w-28 h-8 rounded-b-lg flex items-center justify-center">
                  <span className="font-bold text-gray-700">2nd</span>
                </div>
              </div>
            )}

            {/* 1st Place */}
            {topThree[0] && (
              <div className="flex flex-col items-center -mt-8">
                <div className="w-40 h-40 bg-amber-300 rounded-full border-4 border-amber-100 flex items-center justify-center mb-4 shadow-lg">
                  <Crown className="w-16 h-16 text-amber-700" />
                </div>
                <div className="bg-amber-100 rounded-t-lg p-4 w-36 text-center">
                  <p className="font-bold text-amber-900 truncate text-lg">{topThree[0].display_name}</p>
                  <p className="text-3xl font-bold text-amber-700">{topThree[0].score.toLocaleString()}</p>
                </div>
                <div className="bg-amber-300 w-36 h-12 rounded-b-lg flex items-center justify-center">
                  <span className="font-bold text-amber-800 text-lg">1st</span>
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {topThree[2] && (
              <div className="flex flex-col items-center">
                <div className="w-28 h-28 bg-amber-600 rounded-full border-4 border-amber-200 flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-2xl font-bold text-amber-100">
                    {topThree[2].display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="bg-amber-200 rounded-t-lg p-4 w-24 text-center">
                  <p className="font-bold text-amber-900 truncate">{topThree[2].display_name}</p>
                  <p className="text-xl font-bold text-amber-700">{topThree[2].score.toLocaleString()}</p>
                </div>
                <div className="bg-amber-600 w-24 h-6 rounded-b-lg flex items-center justify-center">
                  <span className="font-bold text-amber-100">3rd</span>
                </div>
              </div>
            )}
          </div>

          {/* My Score */}
          {participant && (
            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center mb-8">
              <p className="text-white/60 mb-2">Your Score</p>
              <p className="text-4xl font-bold text-white">{participant.score.toLocaleString()}</p>
              <p className="text-indigo-300 mt-2">Rank #{myRank}</p>
            </div>
          )}

          <button
            onClick={() => navigate('/student/quizzes')}
            className="w-full px-6 py-4 bg-white text-indigo-900 rounded-xl font-bold hover:bg-white/90 transition-all"
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  // Waiting Lobby
  if (room.status === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Users className="w-12 h-12 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Waiting for Host...</h1>
          <p className="text-gray-500 mb-8">The quiz will start when the host is ready</p>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-sm mx-auto">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Users className="w-5 h-5 text-indigo-600" />
              <span className="font-bold text-gray-900">{leaderboard.length} players joined</span>
            </div>
            
            {participant && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="font-bold text-indigo-600">
                    {participant.display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="font-medium text-gray-900">{participant.display_name}</span>
                <span className="ml-auto text-sm text-gray-400">You</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Active Quiz
  const timerColor = timeRemaining > 10 ? 'text-green-400' : timeRemaining > 5 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Question {room.current_question_index + 1}</p>
              </div>
            </div>
            
            {/* Timer */}
            <div className={`flex items-center gap-2 font-bold text-2xl ${timerColor}`}>
              <Clock className="w-6 h-6" />
              {timeRemaining}s
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentQuestion ? (
          <div className="space-y-6">
            {/* Question */}
            <div className="bg-white rounded-2xl p-6 text-gray-900">
              <h2 className="text-xl font-bold mb-6">{currentQuestion.question_text}</h2>
              
              {hasAnswered ? (
                /* Submitted State */
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-lg font-medium text-gray-900">Answer Submitted!</p>
                  <p className="text-gray-500 mt-2">Waiting for next question...</p>
                </div>
              ) : (
                /* Options */
                <div className="space-y-3">
                  {currentQuestion.options?.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleSubmit(option)}
                      disabled={timeRemaining <= 0}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                        selectedOption === option
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                      } ${timeRemaining <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className="w-10 h-10 bg-white rounded-lg flex items-center justify-center font-bold text-gray-600 border border-gray-200">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="flex-1 font-medium">{option}</span>
                      {selectedOption === option && (
                        <ArrowRight className="w-5 h-5 text-indigo-600" />
                      )}
                    </button>
                  )) || (
                    <div className="text-center py-8 text-gray-500">
                      No options available for this question
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Leaderboard */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-4">
              <h3 className="font-bold text-sm text-gray-400 mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Live Leaderboard
              </h3>
              <div className="flex flex-wrap gap-2">
                {leaderboard.slice(0, 5).map((entry, index) => (
                  <div 
                    key={entry.participant_id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      entry.participant_id === participant?.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    {index === 0 && <Crown className="w-4 h-4 text-amber-400" />}
                    <span className="font-medium">{entry.display_name}</span>
                    <span className="font-bold">{entry.score.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* My Score */}
            {participant && (
              <div className="flex items-center justify-between bg-indigo-900/50 rounded-xl p-4 border border-indigo-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
                    <span className="font-bold">{participant.display_name.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="font-medium">{participant.display_name}</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-indigo-400">{participant.score.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">Your Score</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Gamepad2 className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-400">Loading question...</p>
          </div>
        )}
      </main>
    </div>
  );
}
