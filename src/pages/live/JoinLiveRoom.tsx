import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toaster';
import { useLiveRoomStudent } from '../../hooks/useLiveRoom';
import { 
  Gamepad2, 
  ArrowLeft, 
  LogIn,
  Users,
  AlertCircle
} from 'lucide-react';

export default function JoinLiveRoom() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [roomCode, setRoomCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [step, setStep] = useState<'code' | 'name'>('code');
  const [checking, setChecking] = useState(false);
  
  const { room, loading, error, joinRoom } = useLiveRoomStudent(
    step === 'name' ? roomCode : null
  );

  const handleCheckRoom = async () => {
    if (!roomCode.trim() || roomCode.length !== 6) {
      showToast('Please enter a valid 6-character room code', 'error');
      return;
    }
    
    setChecking(true);
    // The hook will automatically fetch the room
    setTimeout(() => {
      setChecking(false);
      if (!error && !loading) {
        setStep('name');
      }
    }, 500);
  };

  const handleJoin = async () => {
    if (!displayName.trim() || displayName.length < 2) {
      showToast('Please enter your name (at least 2 characters)', 'error');
      return;
    }

    const participant = await joinRoom(displayName);
    
    if (participant && room) {
      showToast('Joined successfully!', 'success');
      navigate(`/live/room/${room.room_code}`, {
        state: { participantId: participant.id }
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate('/student/quizzes')}
            className="p-2 hover:bg-white/50 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Gamepad2 className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Join Live Quiz</h1>
            <p className="text-sm text-gray-500">Enter a room code to join</p>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          {step === 'code' ? (
            /* Enter Room Code */
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room Code
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="XXXXXX"
                  maxLength={6}
                  className="w-full px-4 py-4 text-3xl font-bold text-center tracking-widest bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-all uppercase"
                />
                <p className="text-sm text-gray-400 mt-2 text-center">
                  Ask your teacher for the room code
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <button
                onClick={handleCheckRoom}
                disabled={checking || roomCode.length !== 6}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checking ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Continue
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Enter Display Name */
            <div className="space-y-6">
              {room && (
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-4">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Room Found
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">{room.quiz?.title || 'Live Quiz'}</h2>
                  <p className="text-sm text-gray-500 flex items-center justify-center gap-1 mt-1">
                    <Users className="w-4 h-4" />
                    Room Code: {room.room_code}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  maxLength={20}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                />
                <p className="text-sm text-gray-400 mt-2">
                  This is how others will see you on the leaderboard
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('code')}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleJoin}
                  disabled={!displayName.trim() || displayName.length < 2}
                  className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LogIn className="w-5 h-5" />
                  Join Room
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Having trouble? Ask your teacher for help
          </p>
        </div>
      </div>
    </div>
  );
}
