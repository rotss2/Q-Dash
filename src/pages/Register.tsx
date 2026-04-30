import { Link } from 'react-router-dom';

export default function Register() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Registration disabled</h1>
          <p className="mt-3 text-sm text-slate-600">
            Admin accounts are managed by the site owner. Use the admin login page instead.
          </p>
        </div>
        <div className="mt-8 space-y-3">
          <Link
            to="/login"
            className="block rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
          >
            Back to login
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="block w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
