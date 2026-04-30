import { useMemo } from 'react';

interface ThemedBackgroundProps {
  theme: string;
}

export const ThemedBackground = ({ theme }: ThemedBackgroundProps) => {
  const backgroundStyles = useMemo(() => {
    switch (theme) {
      case 'ocean':
        return (
          <div className="fixed inset-0 -z-10 overflow-hidden">
            {/* Base gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 via-blue-500 to-blue-700" />
            
            {/* Wave animations */}
            <div className="absolute bottom-0 left-0 right-0 h-64">
              <svg className="absolute bottom-0 w-full h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                <path
                  fill="rgba(255,255,255,0.1)"
                  d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
                  className="animate-pulse"
                  style={{ animationDuration: '4s' }}
                />
              </svg>
              <svg className="absolute bottom-0 w-full h-3/4" viewBox="0 0 1440 320" preserveAspectRatio="none">
                <path
                  fill="rgba(255,255,255,0.15)"
                  d="M0,64L48,80C96,96,192,128,288,128C384,128,480,96,576,106.7C672,117,768,171,864,176C960,181,1056,139,1152,128C1248,117,1344,139,1392,149.3L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
                  className="animate-pulse"
                  style={{ animationDuration: '6s', animationDelay: '1s' }}
                />
              </svg>
            </div>
            
            {/* Floating bubbles */}
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-white/20 animate-bounce"
                style={{
                  width: `${20 + i * 10}px`,
                  height: `${20 + i * 10}px`,
                  left: `${10 + i * 15}%`,
                  bottom: `${20 + i * 10}%`,
                  animationDuration: `${3 + i * 0.5}s`,
                  animationDelay: `${i * 0.3}s`,
                }}
              />
            ))}
          </div>
        );

      case 'sunset':
        return (
          <div className="fixed inset-0 -z-10 overflow-hidden">
            {/* Shifting gradient */}
            <div 
              className="absolute inset-0 animate-pulse"
              style={{
                background: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 25%, #ff9ff3 50%, #54a0ff 75%, #5f27cd 100%)',
                backgroundSize: '400% 400%',
                animation: 'gradientShift 8s ease infinite',
              }}
            />
            
            {/* Sun glow */}
            <div 
              className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full animate-pulse"
              style={{
                background: 'radial-gradient(circle, rgba(255,200,100,0.4) 0%, rgba(255,100,100,0.2) 50%, transparent 70%)',
                animationDuration: '4s',
              }}
            />
            
            {/* Stars */}
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
                style={{
                  top: `${Math.random() * 60}%`,
                  left: `${Math.random() * 100}%`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                  animationDelay: `${Math.random() * 2}s`,
                }}
              />
            ))}
            
            <style>{`
              @keyframes gradientShift {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
            `}</style>
          </div>
        );

      case 'forest':
        return (
          <div className="fixed inset-0 -z-10 overflow-hidden">
            {/* Base gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-green-300 via-green-500 to-green-700" />
            
            {/* Floating leaves */}
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute animate-bounce"
                style={{
                  width: '20px',
                  height: '20px',
                  background: 'rgba(255,255,255,0.3)',
                  borderRadius: '0 50% 0 50%',
                  left: `${5 + i * 12}%`,
                  top: `${10 + i * 8}%`,
                  animationDuration: `${4 + i * 0.3}s`,
                  animationDelay: `${i * 0.4}s`,
                  transform: `rotate(${45 + i * 15}deg)`,
                }}
              />
            ))}
            
            {/* Tree silhouettes at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-48 opacity-20">
              <svg viewBox="0 0 1440 200" className="w-full h-full" preserveAspectRatio="none">
                <path
                  fill="#1a472a"
                  d="M0,200 L0,150 Q50,100 100,150 T200,150 T300,150 T400,150 T500,150 T600,150 T700,150 T800,150 T900,150 T1000,150 T1100,150 T1200,150 T1300,150 T1400,150 L1440,150 L1440,200 Z"
                />
              </svg>
            </div>
          </div>
        );

      case 'galaxy':
        return (
          <div className="fixed inset-0 -z-10 overflow-hidden">
            {/* Deep space gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-purple-700 to-pink-600" />
            
            {/* Stars */}
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-white animate-pulse"
                style={{
                  width: `${1 + Math.random() * 2}px`,
                  height: `${1 + Math.random() * 2}px`,
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  animationDuration: `${2 + Math.random() * 3}s`,
                  animationDelay: `${Math.random() * 2}s`,
                }}
              />
            ))}
            
            {/* Nebula effect */}
            <div 
              className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-30 blur-3xl"
              style={{
                background: 'radial-gradient(circle, rgba(255,100,200,0.5) 0%, rgba(100,100,255,0.3) 50%, transparent 70%)',
              }}
            />
            <div 
              className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-30 blur-3xl"
              style={{
                background: 'radial-gradient(circle, rgba(100,200,255,0.5) 0%, rgba(200,100,255,0.3) 50%, transparent 70%)',
              }}
            />
          </div>
        );

      case 'minimal':
        return (
          <div className="fixed inset-0 -z-10">
            {/* Clean subtle gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100" />
            
            {/* Subtle dot pattern */}
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `radial-gradient(circle, #d1d5db 1px, transparent 1px)`,
                backgroundSize: '20px 20px',
              }}
            />
          </div>
        );

      default:
        return null;
    }
  }, [theme]);

  if (theme === 'default') return null;
  
  return backgroundStyles;
};
