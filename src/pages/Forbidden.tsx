import { Link } from 'react-router-dom';

export default function Forbidden() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-semibold text-gray-900">403</h1>
        <p className="mt-4 text-gray-700">Access denied. This area is reserved for admins only.</p>
        <div className="mt-6 space-y-3">
          <Link
            to="/login"
            className="block w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
          >
            Go to login page
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
