import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { 
  AnalyticsOverview, 
  TopicPerformance, 
  MostMissedQuestion,
  ScoreTrend,
  StudentPerformance,
  SurveyAnalytics 
} from '../types/analytics';

interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  surveyId?: string;
  mode?: 'quiz' | 'exam' | 'survey' | 'all';
}

export function useAnalytics(_filters?: AnalyticsFilters) {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [topicPerformance, setTopicPerformance] = useState<TopicPerformance[]>([]);
  const [_mostMissed, _setMostMissed] = useState<MostMissedQuestion[]>([]);
  const [scoreTrends, setScoreTrends] = useState<ScoreTrend[]>([]);
  const [studentPerformance, setStudentPerformance] = useState<StudentPerformance[]>([]);
  const [_surveyAnalytics, _setSurveyAnalytics] = useState<SurveyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch overview stats
      const [studentsRes, quizzesRes, examsRes, surveysRes, attemptsRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user'),
        supabase.from('surveys').select('*', { count: 'exact', head: true }).eq('mode', 'quiz'),
        supabase.from('surveys').select('*', { count: 'exact', head: true }).eq('mode', 'exam'),
        supabase.from('surveys').select('*', { count: 'exact', head: true }).eq('mode', 'survey'),
        supabase.from('quiz_exam_results').select('*', { count: 'exact', head: true }),
      ]);

      // Fetch score data for averages
      const { data: scoresData } = await supabase
        .from('quiz_exam_results')
        .select('percentage, passed');

      const avgScore = scoresData?.length
        ? Math.round(scoresData.reduce((sum, s) => sum + (s.percentage || 0), 0) / scoresData.length)
        : 0;

      const passingRate = scoresData?.length
        ? Math.round((scoresData.filter(s => s.passed).length / scoresData.length) * 100)
        : 0;

      setOverview({
        total_students: studentsRes.count || 0,
        total_quizzes: quizzesRes.count || 0,
        total_exams: examsRes.count || 0,
        total_surveys: surveysRes.count || 0,
        total_attempts: attemptsRes.count || 0,
        average_score: avgScore,
        passing_rate: passingRate,
        completion_rate: 0, // Would need more complex calculation
      });

      // Fetch topic performance
      const { data: questionsData } = await supabase
        .from('questions')
        .select('id, topic, correct_answer');

      const topicMap = new Map<string, { correct: number; wrong: number; total: number; time: number }>();

      // Aggregate by topic
      questionsData?.forEach((q: { topic?: string | null }) => {
        const topic = q.topic || 'General';
        if (!topicMap.has(topic)) {
          topicMap.set(topic, { correct: 0, wrong: 0, total: 0, time: 0 });
        }
      });

      const topicPerf: TopicPerformance[] = Array.from(topicMap.entries()).map(([topic, data]) => ({
        topic,
        total_questions: data.total || 0,
        correct_answers: data.correct,
        wrong_answers: data.wrong,
        accuracy_rate: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
        avg_time_spent_seconds: data.total > 0 ? Math.round(data.time / data.total) : 0,
      }));

      setTopicPerformance(topicPerf.sort((a, b) => b.accuracy_rate - a.accuracy_rate));

      // Fetch score trends (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: trendData } = await supabase
        .from('quiz_exam_results')
        .select('submitted_at, percentage, passed')
        .gte('submitted_at', thirtyDaysAgo.toISOString())
        .order('submitted_at');

      // Group by date
      const trendMap = new Map<string, { scores: number[]; passed: number; total: number }>();
      
      trendData?.forEach(r => {
        const date = r.submitted_at ? new Date(r.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        if (!trendMap.has(date)) {
          trendMap.set(date, { scores: [], passed: 0, total: 0 });
        }
        const entry = trendMap.get(date)!;
        entry.scores.push(r.percentage || 0);
        entry.total++;
        if (r.passed) entry.passed++;
      });

      const trends: ScoreTrend[] = Array.from(trendMap.entries()).map(([date, data]) => ({
        date,
        avg_score: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
        total_attempts: data.total,
        passing_count: data.passed,
      }));

      setScoreTrends(trends);

      // Fetch student performance
      const { data: studentsData } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('role', 'user');

      const studentPerf: StudentPerformance[] = await Promise.all(
        (studentsData || []).map(async (student: { id: string; email: string }) => {
          const { data: studentAttempts } = await supabase
            .from('quiz_exam_results')
            .select('percentage, time_spent_seconds')
            .eq('user_id', student.id);

          const attempts = (studentAttempts || []) as { percentage: number | null; time_spent_seconds: number | null }[];
          const scores = attempts.map(a => a.percentage || 0);

          return {
            user_id: student.id,
            display_name: student.email || 'Unknown',
            total_attempts: attempts.length,
            avg_score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
            highest_score: scores.length ? Math.max(...scores) : 0,
            lowest_score: scores.length ? Math.min(...scores) : 0,
            total_time_spent_seconds: attempts.reduce((sum, a) => sum + (a.time_spent_seconds || 0), 0),
            rank: 0,
          };
        })
      );

      // Sort by average score and assign ranks
      const sortedStudents = studentPerf
        .sort((a, b) => b.avg_score - a.avg_score)
        .map((s, i) => ({ ...s, rank: i + 1 }));

      setStudentPerformance(sortedStudents.slice(0, 50));

    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const refresh = useCallback(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    overview,
    topicPerformance,
    mostMissed,
    scoreTrends,
    studentPerformance,
    surveyAnalytics,
    loading,
    error,
    refresh,
  };
}

export function useSurveyAnalytics(surveyId: string) {
  const [analytics, setAnalytics] = useState<SurveyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSurveyAnalytics = async () => {
      try {
        setLoading(true);

        // Fetch survey details
        const { data: surveyData, error: surveyError } = await supabase
          .from('surveys')
          .select('id, title')
          .eq('id', surveyId)
          .single();

        if (surveyError || !surveyData) {
          setError('Survey not found');
          return;
        }

        // Fetch responses
        const { data: responsesData, error: responsesError } = await supabase
          .from('responses')
          .select('id, submitted_at, completion_time_seconds')
          .eq('survey_id', surveyId);

        if (responsesError) throw responsesError;

        const responses = responsesData || [];
        const totalResponses = responses.length;
        
        // Calculate avg time
        const avgTime = totalResponses > 0
          ? Math.round(responses.reduce((sum, r) => sum + (r.completion_time_seconds || 0), 0) / totalResponses)
          : 0;

        // Fetch questions
        const { data: questionsData } = await supabase
          .from('questions')
          .select('id, question_text, block_type')
          .eq('survey_id', surveyId)
          .order('order_index');

        // Build response breakdown
        const responseBreakdown = await Promise.all(
          (questionsData || []).map(async (q) => {
            const { data: answersData } = await supabase
              .from('responses')
              .select('answers')
              .eq('survey_id', surveyId);

            const answers = answersData || [];
            const valueCounts = new Map<string, number>();
            
            answers.forEach((a: { answers?: Record<string, unknown> }) => {
              const answerObj = a.answers || {};
              const value = String(answerObj[q.id] || '');
              if (value) {
                valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
              }
            });

            const answerBreakdown = Array.from(valueCounts.entries()).map(([value, count]) => ({
              value,
              count,
              percentage: Math.round((count / answers.length) * 100) || 0,
            }));

            return {
              question_id: q.id,
              question_text: q.question_text,
              type: q.block_type,
              answers: answerBreakdown,
            };
          })
        );

        setAnalytics({
          survey_id: surveyData.id,
          title: surveyData.title,
          total_responses: totalResponses,
          completion_rate: 0, // Would need started count
          avg_time_spent_seconds: avgTime,
          response_breakdown: responseBreakdown,
        });

      } catch (err) {
        console.error('Error fetching survey analytics:', err);
        setError('Failed to load survey analytics');
      } finally {
        setLoading(false);
      }
    };

    if (surveyId) {
      fetchSurveyAnalytics();
    }
  }, [surveyId]);

  return { analytics, loading, error };
}
