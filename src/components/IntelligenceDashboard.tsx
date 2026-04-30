import { useState, useMemo } from 'react';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Lightbulb, TrendingUp, Users, FileText, Download, Filter } from 'lucide-react';
import type { Question, Response } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface IntelligenceDashboardProps {
  questions: Question[];
  responses: (Response & { question?: Question; profile?: { email: string } })[];
  surveyTitle: string;
}

interface Conclusion {
  questionId: string;
  questionText: string;
  type: string;
  finding: string;
  detail: string;
  confidence: 'high' | 'medium' | 'low';
}

interface Theme {
  keyword: string;
  count: number;
  responses: string[];
}

export default function IntelligenceDashboard({ questions, responses, surveyTitle }: IntelligenceDashboardProps) {
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'insights' | 'themes' | 'charts'>('insights');

  // Group responses by question
  const responsesByQuestion = useMemo(() => {
    const grouped: Record<string, typeof responses> = {};
    questions.forEach(q => {
      grouped[q.id] = responses.filter(r => r.question_id === q.id);
    });
    return grouped;
  }, [questions, responses]);

  // Generate automated conclusions
  const conclusions = useMemo((): Conclusion[] => {
    const results: Conclusion[] = [];
    
    questions.forEach(question => {
      const questionResponses = responsesByQuestion[question.id] || [];
      
      if (questionResponses.length === 0) return;

      if (question.type === 'choice') {
        // Multiple choice - find most frequent
        const counts: Record<string, number> = {};
        questionResponses.forEach(r => {
          const answer = r.answer as string;
          counts[answer] = (counts[answer] || 0) + 1;
        });
        
        const total = questionResponses.length;
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const topAnswer = sorted[0];
        
        if (topAnswer) {
          const percentage = Math.round((topAnswer[1] / total) * 100);
          results.push({
            questionId: question.id,
            questionText: question.question_text,
            type: 'choice',
            finding: `${percentage}% prefer "${topAnswer[0]}"`,
            detail: `Most popular choice out of ${sorted.length} options (${topAnswer[1]} of ${total} respondents)`,
            confidence: percentage > 60 ? 'high' : percentage > 40 ? 'medium' : 'low'
          });
        }
      } else if (question.type === 'likert') {
        // Rating - calculate average
        const ratings = questionResponses
          .map(r => parseInt(r.answer as string))
          .filter(n => !isNaN(n));
        
        if (ratings.length > 0) {
          const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
          const roundedAvg = avg.toFixed(1);
          
          let sentiment = '';
          if (avg >= 4.5) sentiment = 'High Satisfaction';
          else if (avg >= 3.5) sentiment = 'Moderate Satisfaction';
          else if (avg >= 2.5) sentiment = 'Neutral/Mixed';
          else sentiment = 'Low Satisfaction';
          
          results.push({
            questionId: question.id,
            questionText: question.question_text,
            type: 'rating',
            finding: `${roundedAvg}/5 - ${sentiment}`,
            detail: `Average rating from ${ratings.length} responses`,
            confidence: avg >= 4 || avg <= 2 ? 'high' : 'medium'
          });
        }
      } else if (question.type === 'text') {
        // Text responses - count them
        results.push({
          questionId: question.id,
          questionText: question.question_text,
          type: 'text',
          finding: `${questionResponses.length} text responses`,
          detail: 'See Thematic Analysis tab for keyword insights',
          confidence: 'medium'
        });
      }
    });
    
    return results;
  }, [questions, responsesByQuestion]);

  // Identify top insight (strongest consensus)
  const topInsight = useMemo(() => {
    const choiceConclusions = conclusions.filter(c => c.type === 'choice');
    if (choiceConclusions.length === 0) return null;
    
    return choiceConclusions.reduce((prev, current) => {
      const prevPct = parseInt(prev.finding);
      const currPct = parseInt(current.finding);
      return currPct > prevPct ? current : prev;
    });
  }, [conclusions]);

  // Generate themes from text responses
  const themes = useMemo((): Theme[] => {
    const textQuestions = questions.filter(q => q.type === 'text');
    const keywordCounts: Record<string, { count: number; responses: string[] }> = {};
    
    textQuestions.forEach(question => {
      const questionResponses = responsesByQuestion[question.id] || [];
      
      questionResponses.forEach(r => {
        const answer = (r.answer as string || '').toLowerCase();
        // Extract keywords (words longer than 3 chars)
        const words = answer.match(/\b[a-z]{4,}\b/g) || [];
        
        words.forEach(word => {
          // Skip common words
          if (['this', 'that', 'with', 'from', 'they', 'have', 'been', 'were', 'said', 'each', 'which', 'their', 'would', 'there', 'could', 'should', 'about', 'after', 'before', 'because', 'through', 'during', 'without', 'within', 'between', 'under', 'over', 'into', 'onto', 'upon', 'off', 'down', 'up', 'out', 'in', 'on', 'at', 'to', 'for', 'of', 'by', 'as', 'is', 'it', 'be', 'or', 'an', 'am', 'so', 'if', 'no', 'yes', 'what', 'when', 'where', 'why', 'how', 'who', 'all', 'any', 'both', 'can', 'had', 'has', 'her', 'him', 'his', 'how', 'its', 'may', 'our', 'she', 'the', 'was', 'you', 'and', 'but', 'for', 'are', 'not', 'was', 'had', 'have', 'has', 'did', 'does', 'will', 'shall', 'should', 'would', 'could', 'might', 'must', 'can', 'need', 'used', 'made', 'said', 'each', 'which', 'their', 'time', 'year', 'years', 'day', 'days', 'way', 'ways', 'thing', 'things', 'man', 'men', 'woman', 'women', 'life', 'world', 'school', 'state', 'family', 'student', 'group', 'country', 'problem', 'hand', 'part', 'place', 'case', 'week', 'company', 'system', 'program', 'question', 'work', 'government', 'number', 'night', 'point', 'home', 'water', 'room', 'mother', 'area', 'money', 'story', 'fact', 'month', 'lot', 'right', 'study', 'book', 'eye', 'job', 'word', 'business', 'issue', 'side', 'kind', 'head', 'house', 'service', 'friend', 'father', 'power', 'hour', 'game', 'line', 'end', 'member', 'law', 'car', 'city', 'community', 'name', 'president', 'team', 'minute', 'idea', 'kid', 'body', 'information', 'back', 'parent', 'face', 'others', 'level', 'office', 'door', 'health', 'person', 'art', 'war', 'history', 'party', 'result', 'change', 'morning', 'reason', 'research', 'girl', 'guy', 'moment', 'air', 'teacher', 'force', 'education'].includes(word)) return;
          
          if (!keywordCounts[word]) {
            keywordCounts[word] = { count: 0, responses: [] };
          }
          keywordCounts[word].count++;
          if (!keywordCounts[word].responses.includes(answer)) {
            keywordCounts[word].responses.push(answer);
          }
        });
      });
    });
    
    return Object.entries(keywordCounts)
      .filter(([_, data]) => data.count >= 2)
      .map(([keyword, data]) => ({
        keyword,
        count: data.count,
        responses: data.responses.slice(0, 3)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [questions, responsesByQuestion]);

  // Chart data preparation
  const chartData = useMemo(() => {
    const data: Record<string, {
      labels: string[];
      datasets: { label: string; data: number[]; backgroundColor: string }[];
    }> = {};
    
    questions.forEach(question => {
      if (question.type === 'choice') {
        const questionResponses = responsesByQuestion[question.id] || [];
        const counts: Record<string, number> = {};
        
        questionResponses.forEach(r => {
          const answer = r.answer as string;
          counts[answer] = (counts[answer] || 0) + 1;
        });
        
        data[question.id] = {
          labels: Object.keys(counts),
          datasets: [{
            label: 'Responses',
            data: Object.values(counts),
            backgroundColor: '#1e293b'
          }]
        };
      } else if (question.type === 'likert') {
        const questionResponses = responsesByQuestion[question.id] || [];
        const counts = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
        
        questionResponses.forEach(r => {
          const rating = r.answer as string;
          if (counts[rating as keyof typeof counts] !== undefined) {
            counts[rating as keyof typeof counts]++;
          }
        });
        
        data[question.id] = {
          labels: ['1 (Poor)', '2', '3', '4', '5 (Excellent)'],
          datasets: [{
            label: 'Responses',
            data: Object.values(counts),
            backgroundColor: ['#dc2626', '#f97316', '#facc15', '#84cc16', '#16a34a'] as unknown as string
          }]
        };
      }
    });
    
    return data;
  }, [questions, responsesByQuestion]);

  // Generate research report
  const generateReport = () => {
    const report = `
RESEARCH INTELLIGENCE REPORT
=============================
Survey: ${surveyTitle}
Generated: ${new Date().toLocaleDateString()}
Total Responses: ${responses.length}

EXECUTIVE SUMMARY
-----------------
${topInsight ? `KEY FINDING: ${topInsight.questionText}
→ ${topInsight.finding}
` : 'No clear consensus identified across multiple choice questions.'}

${conclusions.map(c => `• ${c.questionText}
  → ${c.finding} (${c.detail})`).join('\n\n')}

THEMATIC ANALYSIS
-----------------
${themes.slice(0, 10).map(t => `• "${t.keyword}" mentioned ${t.count} times`).join('\n')}

RECOMMENDATIONS
---------------
${conclusions.filter(c => c.confidence === 'high').map(c => `• ${c.questionText}: Strong consensus - ${c.finding}`).join('\n')}
`;
    
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-report-${surveyTitle.replace(/\s+/g, '-').toLowerCase()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download flattened CSV
  const downloadCSV = () => {
    // Group responses by user (using userLabel or fingerprint)
    const byRespondent: Record<string, { userLabel: string; responses: Record<string, string> }> = {};
    
    responses.forEach(r => {
      const userId = r.user_id || 'anonymous';
      const userLabel = (r as any).userLabel || `User-${userId.slice(0, 8)}`;
      if (!byRespondent[userId]) {
        byRespondent[userId] = { userLabel, responses: {} };
      }
      const questionText = r.question?.question_text || 'Unknown';
      byRespondent[userId].responses[questionText] = r.answer as string;
    });
    
    // Create CSV
    const headers = ['User', ...questions.map(q => q.question_text)];
    const rows = Object.values(byRespondent).map(r => [
      r.userLabel,
      ...questions.map(q => r.responses[q.question_text] || '')
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey-data-${surveyTitle.replace(/\s+/g, '-').toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          font: { family: 'system-ui', size: 11 },
          color: '#334155'
        }
      }
    },
    scales: {
      x: {
        ticks: {
          font: { family: 'system-ui', size: 11 },
          color: '#334155'
        },
        grid: {
          display: false
        }
      },
      y: {
        ticks: {
          font: { family: 'system-ui', size: 11 },
          color: '#334155'
        },
        grid: {
          color: '#e2e8f0'
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-slate-700" />
            Research Intelligence
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Automated insights and analysis from {responses.length} responses
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generateReport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
          >
            <FileText className="w-4 h-4" />
            Research Report
          </button>
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-slate-700 text-sm font-medium hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'insights', label: 'Insights & Conclusions', icon: Lightbulb },
          { id: 'themes', label: 'Thematic Analysis', icon: TrendingUp },
          { id: 'charts', label: 'Charts', icon: Filter }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Insights Tab */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {/* Top Insight Card */}
          {topInsight && (
            <div className="bg-slate-900 text-white p-6">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm font-medium uppercase tracking-wide">Top Insight</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">{topInsight.questionText}</h3>
              <p className="text-3xl font-bold mb-2">{topInsight.finding}</p>
              <p className="text-slate-300 text-sm">{topInsight.detail}</p>
            </div>
          )}

          {/* Conclusion Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {conclusions.map(conclusion => (
              <div
                key={conclusion.questionId}
                className={`border p-4 ${
                  conclusion.confidence === 'high'
                    ? 'border-slate-900 bg-slate-50'
                    : conclusion.confidence === 'medium'
                    ? 'border-gray-300'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium uppercase tracking-wide ${
                    conclusion.type === 'choice' ? 'text-blue-700' :
                    conclusion.type === 'rating' ? 'text-green-700' :
                    'text-slate-600'
                  }`}>
                    {conclusion.type === 'choice' ? 'Multiple Choice' :
                     conclusion.type === 'rating' ? 'Rating' : 'Text'}
                  </span>
                  <span className={`text-xs px-2 py-1 ${
                    conclusion.confidence === 'high'
                      ? 'bg-green-100 text-green-800'
                      : conclusion.confidence === 'medium'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {conclusion.confidence} confidence
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-2 line-clamp-2">{conclusion.questionText}</p>
                <p className="text-lg font-bold text-slate-900 mb-1">{conclusion.finding}</p>
                <p className="text-xs text-slate-500">{conclusion.detail}</p>
              </div>
            ))}
          </div>

          {conclusions.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No responses yet. Insights will appear once data is collected.</p>
            </div>
          )}
        </div>
      )}

      {/* Themes Tab */}
      {activeTab === 'themes' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-900">Keyword Themes</h3>
            <span className="text-sm text-slate-500">
              {themes.length} themes identified from text responses
            </span>
          </div>
          
          {themes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {themes.map(theme => (
                <div key={theme.keyword} className="border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-semibold text-slate-900 capitalize">
                      {theme.keyword}
                    </span>
                    <span className="text-2xl font-bold text-slate-900">
                      {theme.count}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    Mentioned in {theme.count} responses
                  </p>
                  <div className="space-y-1">
                    {theme.responses.map((resp, i) => (
                      <p key={i} className="text-xs text-slate-600 truncate border-l-2 border-slate-300 pl-2">
                        {resp.substring(0, 80)}...
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <p>No recurring themes found in text responses yet.</p>
              <p className="text-sm">Themes appear when keywords are mentioned multiple times.</p>
            </div>
          )}
        </div>
      )}

      {/* Charts Tab */}
      {activeTab === 'charts' && (
        <div className="space-y-6">
          {selectedFilter && (
            <div className="bg-blue-50 border border-blue-200 p-3 flex justify-between items-center">
              <span className="text-sm text-blue-800">
                Filtered by: <strong>{selectedFilter}</strong>
              </span>
              <button
                onClick={() => setSelectedFilter(null)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear Filter
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {questions.filter(q => q.type === 'choice' || q.type === 'likert').map(question => {
              const data = chartData[question.id];
              if (!data || data.labels.length === 0) return null;
              
              return (
                <div key={question.id} className="border border-gray-200 p-4">
                  <h4 className="text-sm font-semibold text-slate-900 mb-4 line-clamp-2">
                    {question.question_text}
                  </h4>
                  <div className="h-64">
                    {question.type === 'choice' ? (
                      <Bar
                        data={data}
                        options={{
                          ...chartOptions,
                          onClick: (_, elements) => {
                            if (elements.length > 0) {
                              const index = elements[0].index;
                              setSelectedFilter(`${question.question_text}: ${data.labels[index]}`);
                            }
                          }
                        }}
                      />
                    ) : (
                      <Pie
                        data={data}
                        options={{
                          ...chartOptions,
                          onClick: (_, elements) => {
                            if (elements.length > 0) {
                              const index = elements[0].index;
                              setSelectedFilter(`${question.question_text}: ${data.labels[index]}`);
                            }
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {questions.filter(q => q.type === 'choice' || q.type === 'likert').length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <p>No chartable questions available.</p>
              <p className="text-sm">Add Multiple Choice or Rating questions to see charts.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
