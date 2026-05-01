import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toaster';
import { Eye, EyeOff } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/95 backdrop-blur-xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          {/* SurveyTest Logo */}
          <div className="flex flex-col items-center gap-2 mb-4">
            <img 
              src="/logo.png" 
              alt="SurveyTest" 
              className="h-24 sm:h-32 md:h-40 w-auto object-contain drop-shadow-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">SurveyTest</h1>
          <p className="mt-1 text-sm text-slate-500">Smart Data Insights</p>
          <p className="mt-4 text-sm text-slate-600 font-medium">Admin Login</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Passkey</span>
            <div className="relative mt-2">
              <input
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                type={showPasskey ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              />
              <button
                type="button"
                onClick={() => setShowPasskey(!showPasskey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPasskey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:from-blue-700 hover:to-blue-800 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Checking passkey…' : 'Enter'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          This page is only for admin access.
        </p>
      </div>
    </div>
  );
}
