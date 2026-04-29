import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toaster';
import { supabase } from '../lib/supabase';
import { ClipboardList } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { signIn, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Test Supabase connection on load
  useEffect(() => {
    const testConnection = async () => {
      try {
        const { error } = await supabase.from('surveys').select('count', { count: 'exact', head: true });
        if (error) {
          console.error('Connection test failed:', error);
          setConnectionError('Cannot connect to Supabase. Check console.');
        } else {
          console.log('Supabase connected!');
        }
      } catch (err) {
        console.error('Connection test error:', err);
        setConnectionError('Supabase connection failed');
      }
    };
    testConnection();
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin' : '/user', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log('Signing in with:', email);

    const { error } = await signIn(email, password);
    console.log('Sign in result:', { error });

    if (error) {
      showToast(error.message, 'error');
      setIsLoading(false);
    } else {
      showToast('Login successful!', 'success');
      // Wait for auth state to update user
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="card w-full max-w-md">
        {connectionError && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
            <strong>Connection Error:</strong> {connectionError}
            <p className="mt-1">Check browser console (F12) for details.</p>
          </div>
        )}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-xl mb-4">
            <ClipboardList className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Q-Dash</h1>
          <p className="text-gray-600 mt-2">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
