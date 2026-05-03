import { useMemo, useState } from 'react';
import { Users, Mail, Calendar, UserCircle, BarChart3, PieChart, Filter } from 'lucide-react';
import { Bar, Pie } from 'react-chartjs-2';
import type { Question, Response } from '../types';

interface DemographicsDashboardProps {
  questions: Question[];
  responses: Array<Response & { question?: Question; profile?: { email?: string; age?: number; gender?: string } }>;
  sessions: Array<{ user_id: string; email?: string; age?: number; gender?: string; completed_at?: string; response_count: number }>;
  counts: {
    completed_submissions: number;
    unique_response_users: number;
    answer_rows: number;
    valid_answer_rows: number;
    orphan_answer_rows: number;
  };
}

interface RespondentProfile {
  user_id: string;
  email: string | null;
  age: number | null;
  age_group: string | null;
  gender: string | null;
  completed_at: string | null;
  answer_rows: number;
  completion_status: 'complete' | 'incomplete';
}

const AGE_GROUPS = [
  { label: 'Under 18', min: 0, max: 17 },
  { label: '18–24', min: 18, max: 24 },
  { label: '25–34', min: 25, max: 34 },
  { label: '35–44', min: 35, max: 44 },
  { label: '45–54', min: 45, max: 54 },
  { label: '55–64', min: 55, max: 64 },
  { label: '65+', min: 65, max: 120 },
  { label: 'Unknown', min: null, max: null }
];

export default function DemographicsDashboard({ sessions, counts }: DemographicsDashboardProps) {
  const [ageGroupFilter, setAgeGroupFilter] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState<string | null>(null);
  const [emailFilter, setEmailFilter] = useState<'all' | 'with_email' | 'anonymous'>('all');

  // Build respondent profiles from sessions
  const profiles: RespondentProfile[] = useMemo(() => {
    return sessions.map(session => {
      const age = session.age || null;
      let age_group: string | null = null;
      
      if (age !== null) {
        const group = AGE_GROUPS.find(g => g.min !== null && g.max !== null && age >= g.min && age <= g.max);
        age_group = group?.label || 'Unknown';
      } else {
        age_group = 'Unknown';
      }

      return {
        user_id: session.user_id,
        email: session.email || null,
        age,
        age_group,
        gender: session.gender || null,
        completed_at: session.completed_at || null,
        answer_rows: session.response_count,
        completion_status: session.response_count > 0 ? 'complete' : 'incomplete'
      };
    });
  }, [sessions]);

  // Apply filters
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      if (ageGroupFilter && p.age_group !== ageGroupFilter) return false;
      if (genderFilter && p.gender !== genderFilter) return false;
      if (emailFilter === 'with_email' && !p.email) return false;
      if (emailFilter === 'anonymous' && p.email) return false;
      return true;
    });
  }, [profiles, ageGroupFilter, genderFilter, emailFilter]);

  // Summary statistics
  const stats = useMemo(() => {
    const total = profiles.length;
    const withAge = profiles.filter(p => p.age !== null).length;
    const withGender = profiles.filter(p => p.gender !== null).length;
    const withEmail = profiles.filter(p => p.email !== null).length;
    const anonymous = total - withEmail;
    const complete = profiles.filter(p => p.completion_status === 'complete').length;
    const incomplete = profiles.filter(p => p.completion_status === 'incomplete').length;

    return { total, withAge, withGender, withEmail, anonymous, complete, incomplete };
  }, [profiles]);

  // Age distribution
  const ageDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    AGE_GROUPS.forEach(g => distribution[g.label] = 0);
    
    profiles.forEach(p => {
      const group = p.age_group || 'Unknown';
      distribution[group] = (distribution[group] || 0) + 1;
    });

    return distribution;
  }, [profiles]);

  // Gender distribution
  const genderDistribution = useMemo(() => {
    const distribution: Record<string, number> = {
      'male': 0,
      'female': 0,
      'non-binary': 0,
      'prefer-not-to-say': 0,
      'unknown': 0
    };

    profiles.forEach(p => {
      const gender = p.gender || 'unknown';
      distribution[gender] = (distribution[gender] || 0) + 1;
    });

    return distribution;
  }, [profiles]);

  // Chart data
  const ageChartData = {
    labels: Object.keys(ageDistribution),
    datasets: [{
      label: 'Respondents',
      data: Object.values(ageDistribution),
      backgroundColor: [
        '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#9ca3af'
      ],
      borderRadius: 4
    }]
  };

  const genderChartData = {
    labels: ['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Unknown'],
    datasets: [{
      data: [
        genderDistribution['male'],
        genderDistribution['female'],
        genderDistribution['non-binary'],
        genderDistribution['prefer-not-to-say'],
        genderDistribution['unknown']
      ],
      backgroundColor: ['#3b82f6', '#ec4899', '#8b5cf6', '#f59e0b', '#9ca3af'],
      borderWidth: 0
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: { font: { size: 11 } }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { font: { size: 11 }, color: '#64748b' },
        grid: { color: '#e2e8f0' }
      },
      x: {
        ticks: { font: { size: 10 }, color: '#64748b' },
        grid: { display: false }
      }
    }
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: { font: { size: 11 }, padding: 15 }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-xs text-slate-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-xs text-slate-500">With Age</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.withAge}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <UserCircle className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-xs text-slate-500">With Gender</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.withGender}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <Mail className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-xs text-slate-500">With Email</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.withEmail}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-slate-600" />
            </div>
            <span className="text-xs text-slate-500">Anonymous</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.anonymous}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-xs text-slate-500">Complete</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{stats.complete}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Filters</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={ageGroupFilter || ''}
            onChange={(e) => setAgeGroupFilter(e.target.value || null)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
          >
            <option value="">All Age Groups</option>
            {AGE_GROUPS.map(g => (
              <option key={g.label} value={g.label}>{g.label}</option>
            ))}
          </select>

          <select
            value={genderFilter || ''}
            onChange={(e) => setGenderFilter(e.target.value || null)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
          >
            <option value="">All Genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non-binary">Non-binary</option>
            <option value="prefer-not-to-say">Prefer not to say</option>
          </select>

          <select
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
          >
            <option value="all">All Respondents</option>
            <option value="with_email">With Email</option>
            <option value="anonymous">Anonymous Only</option>
          </select>

          {(ageGroupFilter || genderFilter || emailFilter !== 'all') && (
            <button
              onClick={() => {
                setAgeGroupFilter(null);
                setGenderFilter(null);
                setEmailFilter('all');
              }}
              className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
            >
              Clear filters
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Showing {filteredProfiles.length} of {profiles.length} respondents
        </p>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Age Distribution
          </h3>
          <div className="h-64">
            <Bar data={ageChartData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-purple-600" />
            Gender Distribution
          </h3>
          <div className="h-64">
            <Pie data={genderChartData} options={pieOptions} />
          </div>
        </div>
      </div>

      {/* Respondent Profiles Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Respondent Profiles</h3>
          <p className="text-sm text-slate-500 mt-1">
            {filteredProfiles.length} respondents match current filters
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">User ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Age</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Age Group</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Gender</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Submitted At</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Answer Rows</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredProfiles.slice(0, 100).map((profile) => (
                <tr key={profile.user_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-mono text-slate-600">
                    {profile.user_id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {profile.email || <span className="text-slate-400 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {profile.age || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {profile.age_group || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {profile.gender ? (
                      <span className="capitalize">{profile.gender.replace(/-/g, ' ')}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {profile.completed_at ? new Date(profile.completed_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {profile.answer_rows}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {profile.completion_status === 'complete' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Complete
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Incomplete
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredProfiles.length > 100 && (
          <div className="p-4 border-t border-slate-200 text-center text-sm text-slate-500">
            Showing first 100 of {filteredProfiles.length} respondents
          </div>
        )}
      </div>

      {/* Count Comparison */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Response Count Analysis</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Completed Submissions</p>
            <p className="text-xl font-bold text-slate-900">{counts.completed_submissions}</p>
            <p className="text-xs text-slate-400">From survey_sessions</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Participants</p>
            <p className="text-xl font-bold text-slate-900">{counts.unique_response_users}</p>
            <p className="text-xs text-slate-400">Unique user_ids in responses</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Answer Rows</p>
            <p className="text-xl font-bold text-slate-900">{counts.answer_rows}</p>
            <p className="text-xs text-slate-400">Total response rows</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Valid Answer Rows</p>
            <p className="text-xl font-bold text-green-600">{counts.valid_answer_rows}</p>
            <p className="text-xs text-slate-400">For active questions</p>
          </div>
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Orphan Rows</p>
            <p className="text-xl font-bold text-amber-600">{counts.orphan_answer_rows}</p>
            <p className="text-xs text-slate-400">Deleted/inactive questions</p>
          </div>
        </div>

        {counts.completed_submissions !== counts.unique_response_users && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Count mismatch detected:</strong> {counts.completed_submissions} completed submissions but {counts.unique_response_users} participants in responses.
              {counts.completed_submissions > counts.unique_response_users 
                ? ` ${counts.completed_submissions - counts.unique_response_users} submissions may have incomplete or missing response data.`
                : ` ${counts.unique_response_users - counts.completed_submissions} participants have responses but no completion record.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
