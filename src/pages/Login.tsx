import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toaster';
import { Eye, EyeOff, BarChart3, Users, Shield, FileText, Sparkles } from 'lucide-react';

export default function Login() {
  const [passkey, setPasskey] = useState('');
  const [showPasskey, setShowPasskey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(passkey.trim());

    if (error) {
      showToast(error.message, 'error');
      setIsLoading(false);
      return;
    }

    showToast('Login successful', 'success');
    navigate('/admin', { replace: true });
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Brand/Marketing (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-5/12 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-500 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">SurveyTest</span>
          </div>
          
          {/* Main Content */}
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
                Smart Data Insights
              </h1>
              <p className="text-lg text-slate-300">
                Manage surveys, quizzes, and exams in one powerful platform.
              </p>
            </div>
            
            {/* Feature Bullets */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-300" />
                </div>
                <span className="text-sm">Real-time responses</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-green-300" />
                </div>
                <span className="text-sm">Analytics dashboard</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <span className="text-sm">Quiz and exam scoring</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-red-300" />
                </div>
                <span className="text-sm">Secure admin access</span>
              </div>
            </div>
          </div>
          
          {/* Bottom */}
          <p className="text-xs text-slate-500">
            Professional survey and assessment management platform.
          </p>
        </div>
      </div>
      
      {/* Right Panel - Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center bg-slate-50 px-4 sm:px-6 lg:px-8 py-12">
        {/* Mobile Logo (visible only on mobile) */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900">SurveyTest</span>
        </div>
        
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8 sm:p-10">
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Admin Login</h2>
              <p className="mt-2 text-sm text-slate-500">
                Enter your admin passkey to continue.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Admin Passkey
                </label>
                <div className="relative">
                  <input
                    value={passkey}
                    onChange={(e) => setPasskey(e.target.value)}
                    type={showPasskey ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="Enter your passkey"
                    className="w-full h-11 rounded-xl border border-gray-300 bg-white px-4 pr-12 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasskey(!showPasskey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPasskey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in…
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
                <Shield className="w-3 h-3" />
                Authorized administrators only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
