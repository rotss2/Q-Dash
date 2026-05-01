import { useState, useEffect } from 'react';

interface AvatarMascotProps {
  progress: number;
  currentQuestion: number;
  totalQuestions: number;
}

export const AvatarMascot = ({ progress, currentQuestion, totalQuestions }: AvatarMascotProps) => {
  const [message, setMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [mood, setMood] = useState<'neutral' | 'happy' | 'excited' | 'celebrating'>('neutral');

  useEffect(() => {
    // Determine mood based on progress
    if (progress === 0) {
      setMood('neutral');
      setMessage("Hi there! Let's get started! 👋");
    } else if (progress < 25) {
      setMood('happy');
      setMessage("Great start! You're doing awesome! 🌟");
    } else if (progress < 50) {
      setMood('happy');
      setMessage("Keep going! You're making progress! 💪");
    } else if (progress < 75) {
      setMood('excited');
      setMessage("Halfway there! You're on fire! 🔥");
    } else if (progress < 100) {
      setMood('excited');
      setMessage("Almost done! You can do it! 🚀");
    } else {
      setMood('celebrating');
      setMessage("You did it! Amazing work! 🎉");
    }

    setShowMessage(true);
    const timer = setTimeout(() => setShowMessage(false), 4000);
    return () => clearTimeout(timer);
  }, [progress]);

  
  const getMoodEmoji = () => {
    switch (mood) {
      case 'neutral':
        return (
          <div className="relative">
            {/* Face */}
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-300 to-yellow-400 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-3xl">🙂</span>
            </div>
            {/* Wave animation */}
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center text-sm animate-bounce">
              👋
            </div>
          </div>
        );
      case 'happy':
        return (
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center shadow-lg animate-bounce" style={{ animationDuration: '2s' }}>
              <span className="text-3xl">😊</span>
            </div>
            <div className="absolute -top-2 -left-2 text-xl animate-pulse">✨</div>
            <div className="absolute -bottom-1 -right-2 text-xl animate-pulse" style={{ animationDelay: '0.5s' }}>✨</div>
          </div>
        );
      case 'excited':
        return (
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-pink-400 rounded-full flex items-center justify-center shadow-lg animate-bounce" style={{ animationDuration: '0.8s' }}>
              <span className="text-3xl">🤩</span>
            </div>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl animate-pulse">🎉</div>
            <div className="absolute -bottom-2 -left-3 text-lg animate-bounce">✨</div>
            <div className="absolute -bottom-2 -right-3 text-lg animate-bounce" style={{ animationDelay: '0.3s' }}>🌟</div>
          </div>
        );
      case 'celebrating':
        return (
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-400 via-purple-400 to-indigo-400 rounded-full flex items-center justify-center shadow-lg animate-spin" style={{ animationDuration: '3s' }}>
              <span className="text-3xl">🥳</span>
            </div>
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute text-xl"
                style={{
                  top: `${50 - 40 * Math.cos((i * 45 * Math.PI) / 180)}%`,
                  left: `${50 + 40 * Math.sin((i * 45 * Math.PI) / 180)}%`,
                  transform: 'translate(-50%, -50%)',
                  animation: 'float 1s ease-in-out infinite',
                  animationDelay: `${i * 0.1}s`,
                }}
              >
                {['🎊', '🎈', '🎉', '✨', '🌟', '🎁', '🏆', '🎆'][i]}
              </div>
            ))}
          </div>
        );
    }
  };

  if (progress === 100) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
        {/* Speech bubble */}
        <div 
          className={`mb-3 bg-white px-4 py-3 rounded-2xl rounded-br-md shadow-lg max-w-xs transition-all duration-500 transform ${
            showMessage ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <p className="text-sm font-medium text-gray-800">{message}</p>
        </div>
        
        {/* Mascot */}
        <div className="relative">
          {getMoodEmoji()}
        </div>
        
        <style>{`
          @keyframes float {
            0%, 100% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -70%) scale(1.2); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {/* Speech bubble */}
      <div 
        className={`mb-3 bg-white px-4 py-3 rounded-2xl rounded-br-md shadow-lg max-w-xs transition-all duration-500 transform ${
          showMessage ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        }`}
      >
        <p className="text-sm font-medium text-gray-800">{message}</p>
        <div className="mt-2 text-xs text-gray-500">
          Question {currentQuestion} of {totalQuestions}
        </div>
      </div>
      
      {/* Mascot */}
      <div className="relative group cursor-pointer" onClick={() => setShowMessage(!showMessage)}>
        {getMoodEmoji()}
        
        {/* Click hint */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Click me!
        </div>
      </div>
    </div>
  );
};
