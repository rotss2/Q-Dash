import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toaster';
import { useAuth } from '../../hooks/useAuth';
import { SkeletonCard, SkeletonStat } from '../../components/LoadingSkeleton';
import EmptyState from '../../components/EmptyState';
import { 
  User, 
  Mail, 
  Award, 
  Trophy, 
  Target as TargetIcon,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle,
  BookOpen,
  Zap,
  Star,
  ChevronRight,
  ArrowLeft,
  Edit3,
  Flame,
  BarChart3,
  Gamepad2,
  FileText,
  GraduationCap,
  Medal,
  Crown
} from 'lucide-react';

// Types
interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  role: 'admin' | 'user';
  avatar_url: string | null;
  level: number;
  xp: number;
  rank: string | null;
  streak_days: number;
  total_quizzes: number;
  total_exams: number;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earned_at: string;
  is_earned: boolean;
}

interface Attempt {
  id: string;
  survey_id: string;
  survey_title: string;
  mode: 'quiz' | 'exam' | string;
  score: number;
  percentage: number;
  submitted_at: string | null;
  passed: boolean;
}

interface Activity {
  id: string;
  action: string;
  entity_type: string;
  entity_name?: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface TopicMastery {
  topic: string;
  correct: number;
  total: number;
  percentage: number;
}

interface ScoreTrend {
  date: string;
  score: number;
  mode: 'quiz' | 'exam';
}

export default function StudentProfilePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user: authUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [topicMastery, setTopicMastery] = useState<TopicMastery[]>([]);
  const [scoreTrend, setScoreTrend] = useState<ScoreTrend[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'history'>('overview');

  const fetchProfileData = useCallback(async () => {
    if (!authUser?.id) return;
    
    try {
      setLoading(true);
      
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError) throw profileError;

      // Fetch quiz/exam results
      const { data: resultsData, error: resultsError } = await supabase
        .from('quiz_exam_results')
        .select('*, survey:surveys(title)')
        .eq('user_id', authUser.id)
        .order('submitted_at', { ascending: false });

      if (resultsError) throw resultsError;

      // Fetch badges
      const { data: badgesData, error: badgesError } = await supabase
        .from('student_badges')
        .select('*, badge:badges(*)')
        .eq('student_id', authUser.id)
        .order('earned_at', { ascending: false });

      if (badgesError && badgesError.code !== '42P01') throw badgesError;

      // Fetch activity logs
      const { data: activityData, error: activityError } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('actor_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (activityError && activityError.code !== '42P01') throw activityError;

      // Calculate stats
      // Mode is not in quiz_exam_results, fetch from surveys instead
      const { data: surveyModes } = await supabase
        .from('surveys')
        .select('id, mode')
        .in('id', resultsData?.map(r => r.survey_id) || []);
      
      const surveyModeMap = new Map(surveyModes?.map(s => [s.id, s.mode]) || []);
      
      const quizAttempts = resultsData?.filter(r => surveyModeMap.get(r.survey_id) === 'quiz') || [];
      const examAttempts = resultsData?.filter(r => surveyModeMap.get(r.survey_id) === 'exam') || [];
      
      const totalQuizzes = quizAttempts.length;
      const totalExams = examAttempts.length;

      // Calculate XP (10 XP per correct answer + bonus for perfect scores)
      const totalXP = resultsData?.reduce((sum, r) => {
        const baseXP = Math.round((r.percentage || 0) / 10);
        const bonus = r.percentage === 100 ? 50 : 0;
        return sum + baseXP + bonus;
      }, 0) || 0;

      // Calculate level (every 100 XP = 1 level)
      const level = Math.floor(totalXP / 100) + 1;

      // Determine rank
      let rank = 'Novice';
      if (level >= 20) rank = 'Legend';
      else if (level >= 15) rank = 'Master';
      else if (level >= 10) rank = 'Expert';
      else if (level >= 5) rank = 'Advanced';

      setProfile({
        id: profileData.id,
        full_name: (profileData as { full_name?: string }).full_name || null,
        email: profileData.email,
        role: profileData.role,
        avatar_url: (profileData as { avatar_url?: string }).avatar_url || null,
        level,
        xp: totalXP,
        rank,
        streak_days: (profileData as { streak_days?: number }).streak_days || 0,
        total_quizzes: totalQuizzes,
        total_exams: totalExams,
      });

      // Map attempts
      const mappedAttempts: Attempt[] = resultsData?.map(r => ({
        id: r.id,
        survey_id: r.survey_id,
        survey_title: (r.survey as { title: string })?.title || 'Unknown',
        mode: (surveyModeMap.get(r.survey_id) || 'quiz') as 'quiz' | 'exam',
        score: r.score || 0,
        percentage: r.percentage || 0,
        submitted_at: r.submitted_at,
        passed: r.passed || false,
      })) || [];
      setAttempts(mappedAttempts);

      // Map badges - handle nested structure safely
      const mappedBadges: Badge[] = badgesData?.map(b => {
        const badgeData = b.badge as { id: string; name: string; description: string; icon: string; color: string } | undefined;
        return {
          id: badgeData?.id || b.id,
          name: badgeData?.name || 'Unknown Badge',
          description: badgeData?.description || '',
          icon: badgeData?.icon || 'default',
          color: badgeData?.color || 'gray',
          earned_at: b.earned_at,
          is_earned: true,
        };
      }) || [];
      setBadges(mappedBadges);

      // Map activities
      const mappedActivities: Activity[] = activityData?.map(a => ({
        id: a.id,
        action: a.action,
        entity_type: a.entity_type,
        entity_name: (a as { entity_name?: string }).entity_name || '',
        created_at: a.created_at,
        metadata: a.metadata as Record<string, unknown>,
      })) || [];
      setActivities(mappedActivities);

      // Calculate topic mastery from responses
      const topicStats: Record<string, { correct: number; total: number }> = {};
      resultsData?.forEach(result => {
        const responses = result.responses as Record<string, { is_correct: boolean; topic?: string }> || {};
        Object.entries(responses).forEach(([_, data]) => {
          const topic = data.topic || 'General';
          if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 };
          topicStats[topic].total++;
          if (data.is_correct) topicStats[topic].correct++;
        });
      });

      const masteryData: TopicMastery[] = Object.entries(topicStats)
        .map(([topic, stats]) => ({
          topic,
          correct: stats.correct,
          total: stats.total,
          percentage: Math.round((stats.correct / stats.total) * 100) || 0,
        }))
        .sort((a, b) => b.percentage - a.percentage);
      setTopicMastery(masteryData);

      // Calculate score trend
      const trendData: ScoreTrend[] = resultsData
        ?.slice(0, 10)
        .reverse()
        .map(r => ({
          date: r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
          score: r.percentage || 0,
          mode: (surveyModeMap.get(r.survey_id) || 'quiz') as 'quiz' | 'exam',
        })) || [];
      setScoreTrend(trendData);

    } catch (error) {
      console.error('Error fetching profile:', error);
      showToast('Failed to load profile data', 'error');
    } finally {
      setLoading(false);
    }
  }, [authUser?.id, showToast]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getActivityIcon = (action: string, entityType: string) => {
    if (action.includes('completed') || action.includes('submitted')) {
      return entityType === 'exam' ? <GraduationCap className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />;
    }
    if (action.includes('earned')) return <Award className="w-4 h-4" />;
    if (action.includes('joined')) return <Gamepad2 className="w-4 h-4" />;
    if (action.includes('improved')) return <TrendingUp className="w-4 h-4" />;
    return <Star className="w-4 h-4" />;
  };

  const getBadgeIcon = (iconName: string) => {
    const icons: Record<string, React.ReactNode> = {
      'first-quiz': <BookOpen className="w-6 h-6" />,
      'perfect-score': <Trophy className="w-6 h-6" />,
      'fast-thinker': <Zap className="w-6 h-6" />,
      'streak-7': <Flame className="w-6 h-6" />,
      'top-1': <Crown className="w-6 h-6" />,
      'exam-finisher': <GraduationCap className="w-6 h-6" />,
      'survey-contributor': <FileText className="w-6 h-6" />,
      'default': <Medal className="w-6 h-6" />,
    };
    return icons[iconName] || icons['default'];
  };

  const strongestTopic = topicMastery[0];
  const weakestTopic = topicMastery[topicMastery.length - 1];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <SkeletonStat count={4} />
          <div className="mt-8">
            <SkeletonCard count={3} />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <EmptyState
          type="error"
          title="Profile Not Found"
          description="Unable to load your profile data"
          action={{
            label: 'Go Back',
            onClick: () => navigate('/student'),
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/student')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
            </div>
            <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
              <Edit3 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.full_name || ''} className="w-full h-full rounded-2xl object-cover" />
                ) : (
                  getInitials(profile.full_name)
                )}
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center border-2 border-white">
                <Trophy className="w-4 h-4 text-amber-600" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-gray-900">{profile.full_name || 'Student'}</h2>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {profile.email}
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {profile.role === 'admin' ? 'Administrator' : 'Student'}
                </span>
              </div>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                  Level {profile.level}
                </span>
                <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                  {profile.rank}
                </span>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                  {profile.xp} XP
                </span>
                {profile.streak_days > 0 && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium flex items-center gap-1">
                    <Flame className="w-4 h-4" />
                    {profile.streak_days} Day Streak
                  </span>
                )}
              </div>
            </div>

            {/* XP Progress */}
            <div className="w-full md:w-48">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Level Progress</span>
                <span className="font-medium text-indigo-600">{profile.xp % 100}/100</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                  style={{ width: `${(profile.xp % 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{100 - (profile.xp % 100)} XP to next level</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">Quizzes Taken</p>
              <BookOpen className="w-5 h-5 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{profile.total_quizzes}</p>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">Exams Taken</p>
              <GraduationCap className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{profile.total_exams}</p>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">Average Score</p>
              <BarChart3 className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {attempts.length ? Math.round(attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length) : 0}%
            </p>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">Highest Score</p>
              <Trophy className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {attempts.length ? Math.max(...attempts.map(a => a.percentage)) : 0}%
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {(['overview', 'badges', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab 
                  ? 'border-indigo-600 text-indigo-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Topic Mastery */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TargetIcon className="w-5 h-5 text-indigo-600" />
                Topic Mastery
              </h3>
              
              {topicMastery.length === 0 ? (
                <EmptyState
                  type="default"
                  title="No Topic Data Yet"
                  description="Complete quizzes and exams to see your topic mastery breakdown"
                />
              ) : (
                <div className="space-y-3">
                  {topicMastery.slice(0, 5).map((topic) => (
                    <div key={topic.topic} className="flex items-center gap-4">
                      <span className="w-24 text-sm font-medium text-gray-700 truncate">{topic.topic}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            topic.percentage >= 80 ? 'bg-green-500' :
                            topic.percentage >= 60 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${topic.percentage}%` }}
                        />
                      </div>
                      <span className="w-16 text-sm text-gray-500 text-right">{topic.percentage}%</span>
                      <span className="text-xs text-gray-400">{topic.correct}/{topic.total}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Learning Summary */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Strengths & Weaknesses */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Learning Insights
                </h3>
                
                {topicMastery.length === 0 ? (
                  <p className="text-sm text-gray-500">Complete more assessments to get personalized insights</p>
                ) : (
                  <div className="space-y-4">
                    {strongestTopic && (
                      <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                        <p className="text-sm text-green-600 font-medium mb-1">Strongest Topic</p>
                        <p className="font-bold text-green-800">{strongestTopic.topic}</p>
                        <p className="text-sm text-green-600">{strongestTopic.percentage}% accuracy</p>
                      </div>
                    )}
                    
                    {weakestTopic && weakestTopic.percentage < 70 && (
                      <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                        <p className="text-sm text-red-600 font-medium mb-1">Needs Practice</p>
                        <p className="font-bold text-red-800">{weakestTopic.topic}</p>
                        <p className="text-sm text-red-600 mb-3">{weakestTopic.percentage}% accuracy</p>
                        <button 
                          onClick={() => navigate('/student/quizzes')}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Practice this topic →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  Recent Activity
                </h3>
                
                {activities.length === 0 ? (
                  <p className="text-sm text-gray-500">No recent activity recorded</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {activities.slice(0, 5).map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                          {getActivityIcon(activity.action, activity.entity_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {activity.action.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-gray-500">{activity.entity_name}</p>
                          <p className="text-xs text-gray-400">{formatDate(activity.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Score Trend Chart */}
            {scoreTrend.length > 1 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                  Score Trend
                </h3>
                <div className="h-48 flex items-end gap-2">
                  {scoreTrend.map((point, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div 
                        className={`w-full rounded-t-lg transition-all ${
                          point.mode === 'exam' ? 'bg-purple-400' : 'bg-indigo-400'
                        }`}
                        style={{ height: `${point.score}%` }}
                      />
                      <span className="text-xs text-gray-400 rotate-0">{point.date}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 mt-4 justify-center">
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-3 h-3 bg-indigo-400 rounded" /> Quiz
                  </span>
                  <span className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-3 h-3 bg-purple-400 rounded" /> Exam
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Badges Tab */}
        {activeTab === 'badges' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              Badge Collection
            </h3>
            
            {badges.length === 0 ? (
              <EmptyState
                type="default"
                title="No Badges Yet"
                description="Complete quizzes, exams, and challenges to earn badges"
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {badges.map((badge) => (
                  <div 
                    key={badge.id}
                    className="p-4 rounded-xl border-2 border-amber-100 bg-amber-50/50 text-center hover:shadow-md transition-shadow"
                  >
                    <div className="w-12 h-12 mx-auto mb-3 bg-white rounded-xl flex items-center justify-center text-amber-600 shadow-sm">
                      {getBadgeIcon(badge.icon)}
                    </div>
                    <h4 className="font-bold text-gray-900 text-sm">{badge.name}</h4>
                    <p className="text-xs text-gray-500 mt-1">{badge.description}</p>
                    <p className="text-xs text-amber-600 mt-2">{formatDate(badge.earned_at)}</p>
                  </div>
                ))}
                
                {/* Locked Badges Placeholders */}
                {[1, 2, 3].map((i) => (
                  <div 
                    key={`locked-${i}`}
                    className="p-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 text-center opacity-50"
                  >
                    <div className="w-12 h-12 mx-auto mb-3 bg-gray-200 rounded-xl flex items-center justify-center text-gray-400">
                      <Medal className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-gray-400 text-sm">Locked</h4>
                    <p className="text-xs text-gray-400 mt-1">Keep learning to unlock</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                Attempt History
              </h3>
            </div>
            
            {attempts.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  type="default"
                  title="No Attempts Yet"
                  description="Start taking quizzes and exams to see your history here"
                  action={{
                    label: 'Browse Quizzes',
                    onClick: () => navigate('/student/quizzes'),
                  }}
                />
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {attempts.map((attempt) => (
                  <div key={attempt.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            attempt.mode === 'exam' 
                              ? 'bg-purple-100 text-purple-700' 
                              : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {attempt.mode === 'exam' ? 'Exam' : 'Quiz'}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            attempt.passed 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {attempt.passed ? 'Passed' : 'Failed'}
                          </span>
                        </div>
                        <h4 className="font-medium text-gray-900">{attempt.survey_title}</h4>
                        <p className="text-sm text-gray-500">{formatDate(attempt.submitted_at)}</p>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gray-900">{attempt.percentage}%</p>
                          <p className="text-xs text-gray-500">{attempt.score} pts</p>
                        </div>
                        
                        <button
                          onClick={() => navigate(`/review/${attempt.survey_id}`)}
                          className="flex items-center gap-1 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg font-medium text-sm transition-colors"
                        >
                          Review
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
