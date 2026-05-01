import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toaster';

export default function Login() {
  const [passkey, setPasskey] = useState('');
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center mb-8">
          {/* SurveyTest Logo */}
          <div className="flex flex-col items-center gap-2 mb-4">
            <img 
              src="/logo.png" 
              alt="SurveyTest" 
              className="h-16 sm:h-20 w-auto object-contain"
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
            <input
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
