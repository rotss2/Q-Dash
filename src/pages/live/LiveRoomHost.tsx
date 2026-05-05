import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { useLiveRoomHost } from '../../hooks/useLiveRoom';
import { SkeletonCard } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { 
  Gamepad2, 
  Users, 
  Play, 
  ChevronRight, 
  Trophy,
  Copy,
  CheckCircle,
  Clock,
  Crown,
  Medal,
  Award
} from 'lucide-react';

export default function LiveRoomHost() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const { 
    room, 
    participants, 
    questions, 
    currentQuestion, 
    leaderboard, 
    loading, 
    error, 
    startQuiz, 
    nextQuestion,
    endQuiz 
  } = useLiveRoomHost(roomId || null);
  
  const [copied, setCopied] = useState(false);
  const [showFinalResults, setShowFinalResults] = useState(false);

  const copyRoomCode = () => {
    if (room?.room_code) {
      navigator.clipboard.writeText(room.room_code);
      setCopied(true);
      showToast('Room code copied!', 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEndQuiz = async () => {
    await endQuiz();
    setShowFinalResults(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <SkeletonCard count={3} />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <EmptyState
          type="error"
          title="Room Not Found"
          description={error || "The room you're looking for doesn't exist"}
        />
      </div>
    );
  }

  // Final Results / Podium
  if (showFinalResults || room.status === 'finished') {
    const topThree = leaderboard.slice(0, 3);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-white/10 backdrop-blur rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-10 h-10 text-amber-400" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Quiz Complete!</h1>
            <p className="text-white/60">Here are the final results</p>
          </div>

          {/* Podium */}
          <div className="flex items-end justify-center gap-4 mb-12">
            {/* 2nd Place */}
            {topThree[1] && (
              <div className="flex flex-col items-center">
                <div className="w-32 h-32 bg-gray-300 rounded-full border-4 border-white flex items-center justify-center mb-4 shadow-lg">
                  <Medal className="w-12 h-12 text-gray-600" />
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
                  <Award className="w-10 h-10 text-amber-100" />
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

          {/* Full Leaderboard */}
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Full Leaderboard</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {leaderboard.map((entry, index) => (
                <div 
                  key={entry.participant_id}
                  className={`flex items-center gap-4 p-3 rounded-xl ${
                    index < 3 ? 'bg-white/20' : 'bg-white/5'
                  }`}
                >
                  <span className="w-8 text-center font-bold text-white/60">{index + 1}</span>
                  <span className="flex-1 font-medium text-white">{entry.display_name}</span>
                  <span className="font-bold text-white">{entry.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => navigate('/admin')}
            className="w-full mt-8 px-6 py-4 bg-white text-indigo-900 rounded-xl font-bold hover:bg-white/90 transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Waiting Lobby
  if (room.status === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Gamepad2 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Live Quiz Host</h1>
                  <p className="text-xs text-gray-500">Waiting for players...</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-lg">
                <Users className="w-4 h-4 text-indigo-600" />
                <span className="font-bold text-indigo-900">{participants.length}</span>
                <span className="text-indigo-600">joined</span>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Room Code Card */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border-2 border-indigo-200 p-6 shadow-lg sticky top-24">
                <h2 className="text-sm font-medium text-gray-500 mb-2">Room Code</h2>
                <div 
                  onClick={copyRoomCode}
                  className="bg-indigo-50 rounded-xl p-6 text-center cursor-pointer hover:bg-indigo-100 transition-colors mb-4"
                >
                  <p className="text-5xl font-bold text-indigo-900 tracking-widest mb-2">
                    {room.room_code}
                  </p>
                  <p className="text-sm text-indigo-600 flex items-center justify-center gap-1">
                    {copied ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Click to copy
                      </>
                    )}
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Timer</span>
                    <span className="font-medium text-gray-900 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {room.timer_seconds}s per question
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Questions</span>
                    <span className="font-medium text-gray-900">{questions.length}</span>
                  </div>
                </div>

                <button
                  onClick={startQuiz}
                  disabled={participants.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-5 h-5" />
                  Start Quiz
                </button>

                {participants.length === 0 && (
                  <p className="text-sm text-gray-500 text-center mt-3">
                    Wait for at least 1 player to join
                  </p>
                )}
              </div>
            </div>

            {/* Participants List */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Players ({participants.length})
                  </h2>
                </div>
                
                {participants.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500">No players have joined yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Share the room code to invite players
                    </p>
                  </div>
                ) : (
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {participants.map((p) => (
                      <div 
                        key={p.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                      >
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="font-bold text-indigo-600">
                            {p.display_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900 truncate">
                          {p.display_name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Active Quiz
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold">Live Quiz in Progress</h1>
                <p className="text-xs text-gray-400">
                  Question {room.current_question_index + 1} of {questions.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-lg">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="font-bold">{participants.length}</span>
              </div>
              <button
                onClick={handleEndQuiz}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                End Quiz
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Current Question */}
          <div className="lg:col-span-2">
            {currentQuestion ? (
              <div className="bg-white rounded-2xl p-6 text-gray-900">
                <h2 className="text-xl font-bold mb-4">{currentQuestion.question_text}</h2>
                
                {currentQuestion.options && (
                  <div className="space-y-3">
                    {currentQuestion.options.map((option, index) => (
                      <div 
                        key={index}
                        className={`p-4 rounded-xl border-2 ${
                          option === currentQuestion.correct_answer
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-bold text-gray-600">
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="flex-1 font-medium">{option}</span>
                          {option === currentQuestion.correct_answer && (
                            <CheckCircle className="w-6 h-6 text-green-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={nextQuestion}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                  >
                    {room.current_question_index + 1 >= questions.length ? (
                      <>
                        <Trophy className="w-5 h-5" />
                        Show Results
                      </>
                    ) : (
                      <>
                        Next Question
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-2xl p-12 text-center">
                <p className="text-gray-400">Loading question...</p>
              </div>
            )}
          </div>

          {/* Live Leaderboard */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden sticky top-24">
              <div className="p-4 border-b border-gray-700">
                <h2 className="font-bold flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Live Leaderboard
                </h2>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {leaderboard.map((entry, index) => (
                  <div 
                    key={entry.participant_id}
                    className={`flex items-center gap-3 p-3 border-b border-gray-700 last:border-0 ${
                      index < 3 ? 'bg-gray-700/50' : ''
                    }`}
                  >
                    <span className={`w-6 text-center font-bold ${
                      index === 0 ? 'text-amber-400' :
                      index === 1 ? 'text-gray-300' :
                      index === 2 ? 'text-amber-600' :
                      'text-gray-500'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="flex-1 font-medium truncate">{entry.display_name}</span>
                    <span className="font-bold text-indigo-400">{entry.score.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
