import { useMemo } from 'react';
import { FileText, TrendingUp, BarChart3, AlertCircle, CheckCircle, Zap } from 'lucide-react';
import type { Question, Response } from '../types';

interface ResearchConclusionProps {
  questions: Question[];
  responses: (Response & { question?: Question })[];
  surveyTitle: string;
}

interface ScoreMetric {
  questionText: string;
  average: number;
  median: number;
  stdDev: number;
  count: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  distribution: { [key: number]: number };
}

interface TextInsight {
  questionText: string;
  responseCount: number;
  sampleResponses: string[];
}

export default function ResearchConclusion({ questions, responses, surveyTitle }: ResearchConclusionProps) {
  const mapLikertAnswer = (answer: string): number | null => {
    const normalized = (answer || '').trim().toLowerCase();
    const likertMap: Record<string, number> = {
      'strongly disagree': 1,
      'disagree': 2,
      'neutral': 3,
      'agree': 4,
      'strongly agree': 5,
      'very dissatisfied': 1,
      'dissatisfied': 2,
      'somewhat dissatisfied': 2,
      'somewhat satisfied': 4,
      'satisfied': 4,
      'very satisfied': 5,
      'very poor': 1,
      'poor': 2,
      'fair': 3,
      'good': 4,
      'excellent': 5,
      'never': 1,
      'rarely': 2,
      'sometimes': 3,
      'often': 4,
      'always': 5,
      '1': 1,
      '2': 2,
      '3': 3,
      '4': 4,
      '5': 5
    };

    if (normalized in likertMap) return likertMap[normalized];
    const parsed = parseFloat(normalized);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) return parsed;
    return null;
  };

  // Calculate comprehensive satisfaction metrics
  const satisfactionMetrics = useMemo((): ScoreMetric[] => {
    const metrics: ScoreMetric[] = [];
    
    questions.forEach(question => {
      if (question.type === 'likert') {
        const questionResponses = responses.filter(r => r.question_id === question.id);
        const ratings = questionResponses
          .map(r => mapLikertAnswer(r.answer as string))
          .filter((n): n is number => n !== null && n >= 1 && n <= 5);
        
        if (ratings.length > 0) {
          const sorted = [...ratings].sort((a, b) => a - b);
          const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
          const median = sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];
          
          const variance = ratings.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / ratings.length;
          const stdDev = Math.sqrt(variance);
          
          // Calculate distribution
          const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
          ratings.forEach(r => distribution[r]++);
          
          let sentiment: 'positive' | 'neutral' | 'negative';
          if (avg >= 4) sentiment = 'positive';
          else if (avg >= 3) sentiment = 'neutral';
          else sentiment = 'negative';
          
          metrics.push({
            questionText: question.question_text,
            average: avg,
            median,
            stdDev,
            count: ratings.length,
            sentiment,
            distribution
          });
        }
      }
    });
    
    return metrics.sort((a, b) => b.average - a.average);
  }, [questions, responses]);

  // Extract text insights
  const textInsights = useMemo((): TextInsight[] => {
    return questions
      .filter(q => q.type === 'text')
      .map(question => {
        const textResponses = responses
          .filter(r => r.question_id === question.id && r.answer)
          .map(r => r.answer as string);
        
        return {
          questionText: question.question_text,
          responseCount: textResponses.length,
          sampleResponses: textResponses.slice(0, 3)
        };
      });
  }, [questions, responses]);

  const uniqueRespondents = useMemo(() => {
    const unique = new Set(responses.map(r => r.user_id).filter(Boolean));
    return unique.size;
  }, [responses]);

  const isPreliminary = uniqueRespondents < 3;

  // Generate comprehensive conclusion
  const conclusion = useMemo(() => {
    const textResponseCount = textInsights.reduce((sum, insight) => sum + insight.responseCount, 0);
    const answerRowCount = responses.length;
    
    // Count responses for non-likert questions (multiple_choice, text, etc.)
    const nonLikertResponses = responses.filter(r => {
      const q = questions.find(q => q.id === r.question_id);
      return q && q.type !== 'likert';
    });
    
    // Total meaningful responses = unique respondents (actual submissions)
    const totalMeaningfulResponses = uniqueRespondents;
    
    // Generate conclusion with 2+ responses of any type
    if (totalMeaningfulResponses >= 1) {
      // If we have satisfaction metrics (likert), use them
      if (satisfactionMetrics.length > 0) {
        const overallAverage = satisfactionMetrics.reduce((sum, m) => sum + m.average, 0) / satisfactionMetrics.length;
        const roundedScore = overallAverage.toFixed(1);
        const avgStdDev = satisfactionMetrics.reduce((sum, m) => sum + m.stdDev, 0) / satisfactionMetrics.length;
        const consistencyScore = Math.max(0, 100 - (avgStdDev * 20));
        const highest = satisfactionMetrics[0];
        const lowest = satisfactionMetrics[satisfactionMetrics.length - 1];
        
        const keyFindings: string[] = [];
        if (isPreliminary) {
          keyFindings.push(`Initial indicator: average score of ${roundedScore}/5 across ${uniqueRespondents} respondent${uniqueRespondents === 1 ? '' : 's'}`);
          keyFindings.push(`Early signal from "${highest.questionText}" and "${lowest.questionText}" -- more responses are needed for confirmation.`);
        } else if (overallAverage >= 4.0) {
          keyFindings.push(`Strong overall satisfaction with average score of ${roundedScore}/5`);
          keyFindings.push(`Best performing area: "${highest.questionText}" (${highest.average.toFixed(2)}/5)`);
        } else if (overallAverage >= 3.0) {
          keyFindings.push(`Moderate satisfaction with average score of ${roundedScore}/5`);
          keyFindings.push(`Improvement opportunity: "${lowest.questionText}" (${lowest.average.toFixed(2)}/5)`);
        } else {
          keyFindings.push(`Low satisfaction levels with average score of ${roundedScore}/5`);
          keyFindings.push(`Critical area needing attention: "${lowest.questionText}" (${lowest.average.toFixed(2)}/5)`);
        }
        
        if (textResponseCount > 0) {
          keyFindings.push(`${textResponseCount} qualitative text responses collected for deeper insights`);
        }
        
        let summary = '';
        let nextSteps = '';
        
        if (isPreliminary) {
          summary = `Preliminary findings from ${uniqueRespondents} respondent${uniqueRespondents === 1 ? '' : 's'} are available. Trends are early and should be validated with more responses before making final decisions.`;
          nextSteps = 'Collect more responses before drawing definitive conclusions. Continue monitoring response trends.';
        } else if (uniqueRespondents < 5) {
          summary = `Preliminary analysis from ${uniqueRespondents} respondents indicates an average satisfaction score of ${roundedScore}/5. More data will improve confidence in these findings.`;
          nextSteps = 'Continue collecting responses to reach a more reliable sample size for actionable insights.';
        } else {
          summary = `Analysis of ${uniqueRespondents} respondents reveals an average satisfaction score of ${roundedScore}/5 with ${consistencyScore.toFixed(0)}% consistency across metrics.`;
          nextSteps = `Focus on improving "${lowest.questionText}" while maintaining strengths in "${highest.questionText}".`;
        }
        
        return {
          summary,
          keyFindings,
          nextSteps,
          overallScore: roundedScore,
          highest,
          lowest,
          consistencyScore: consistencyScore.toFixed(0),
          totalResponses: uniqueRespondents,
          answerRows: answerRowCount,
          likertResponses: satisfactionMetrics.reduce((sum, m) => sum + m.count, 0)
        };
      }

      // No likert questions, but have text/other responses
      if (textResponseCount > 0 || nonLikertResponses.length > 0) {
        const hasText = textResponseCount > 0;
        const hasChoice = nonLikertResponses.some(r => {
          const q = questions.find(q => q.id === r.question_id);
          return q && q.type === 'choice';
        });
        
        const keyFindings: string[] = [];
        
        if (hasText) {
          keyFindings.push(`${textResponseCount} qualitative text responses available for thematic analysis`);
          textInsights.slice(0, 3).forEach(insight => {
            if (insight.responseCount > 0) {
              keyFindings.push(`"${insight.questionText}" - ${insight.responseCount} responses`);
            }
          });
        }
        
        if (hasChoice) {
          // Count choice responses by question
          const choiceQuestions = questions.filter(q => q.type === 'choice');
          choiceQuestions.forEach(q => {
            const count = responses.filter(r => r.question_id === q.id).length;
            if (count > 0) {
              keyFindings.push(`"${q.question_text}" - ${count} responses`);
            }
          });
        }
        
        let summary = '';
        if (isPreliminary) {
          summary = `Preliminary findings from ${uniqueRespondents} respondent${uniqueRespondents === 1 ? '' : 's'} are available. These observations are early and should be confirmed with additional responses.`;
        } else if (uniqueRespondents < 5) {
          summary = `Preliminary insights from ${uniqueRespondents} respondents show early engagement across ${questions.length} survey questions. More responses will improve reliability.`;
        } else {
          summary = `Analysis of ${uniqueRespondents} respondents across ${questions.length} questions reveals meaningful engagement. ${hasText ? 'Rich qualitative data is available for deeper insights.' : 'Response distribution patterns are emerging.'}`;
        }
        
        return {
          summary,
          keyFindings,
          nextSteps: `Continue collecting responses to strengthen data reliability. ${hasText ? 'Begin thematic analysis of text responses.' : 'Monitor for emerging patterns in choice questions.'}`,
          overallScore: null,
          highest: null,
          lowest: null,
          consistencyScore: '0',
          totalResponses: uniqueRespondents,
          answerRows: answerRowCount,
          likertResponses: 0
        };
      }
    }
    
    // Less than 2 responses or no meaningful data
    return {
      summary: 'Insufficient data to generate a conclusion.',
      keyFindings: [],
      limitation: `Only ${uniqueRespondents} respondent(s) received. Need at least 2 respondents for analysis.`,
      nextSteps: 'Collect more responses to enable automated analysis. Share survey link with participants.',
      overallScore: null,
      responseRate: uniqueRespondents,
      consistencyScore: 0,
      highest: null,
      lowest: null,
      totalResponses: uniqueRespondents,
      answerRows: answerRowCount,
      likertResponses: 0
    };
  }, [satisfactionMetrics, textInsights, responses, questions]);

  if (responses.length === 0) {
    return (
      <div className="card">
        <p className="text-gray-500 text-center py-8">
          No data available. Collect responses to generate research conclusions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Research Paper Header - Mobile First */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl border-0 overflow-hidden p-5 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 leading-tight break-words max-w-full">Research Analysis Report</h2>
            <p className="text-sm sm:text-base text-white/80 mb-4 leading-relaxed break-words whitespace-normal max-w-full">{surveyTitle}</p>
            
            {/* Metrics - Stacked on mobile, grid on larger screens */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="rounded-xl bg-white/10 p-3 min-w-0">
                <p className="text-xs sm:text-sm text-slate-300 break-words">Participants</p>
                <p className="text-lg sm:text-xl font-bold break-words">{uniqueRespondents}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3 min-w-0">
                <p className="text-xs sm:text-sm text-slate-300 break-words">Answer Rows</p>
                <p className="text-lg sm:text-xl font-bold break-words">{conclusion.answerRows}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3 min-w-0">
                <p className="text-xs sm:text-sm text-slate-300 break-words">Overall Score</p>
                <p className="text-lg sm:text-xl font-bold text-yellow-400 break-words whitespace-normal">
                  {conclusion.overallScore ? `${conclusion.overallScore} / 5` : 'N/A'}
                </p>
              </div>
              <div className="rounded-xl bg-white/10 p-3 min-w-0">
                <p className="text-xs sm:text-sm text-slate-300 break-words">Consistency</p>
                <p className="text-lg sm:text-xl font-bold break-words">{conclusion.consistencyScore}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 overflow-hidden">
        <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-600 shrink-0" />
          Executive Summary
        </h3>
        <p className="text-base sm:text-lg leading-relaxed text-gray-700 break-words whitespace-normal">
          {conclusion.summary}
        </p>
      </div>

      {/* Key Findings */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 overflow-hidden">
        <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          Key Findings
        </h3>
        <ul className="space-y-4">
          {conclusion.keyFindings.map((finding, index) => (
            <li key={index} className="flex items-start gap-3 text-gray-700">
              <span className="text-green-600 font-bold mt-1 shrink-0">•</span>
              <span className="text-base sm:text-lg leading-relaxed break-words whitespace-normal min-w-0">{finding}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Satisfaction Metrics Breakdown */}
      {satisfactionMetrics.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 overflow-hidden">
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600 shrink-0" />
            Detailed Metrics Analysis
          </h3>
          <div className="space-y-6">
            {satisfactionMetrics.map((metric, index) => (
              <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 break-words leading-snug">{metric.questionText}</p>
                    <p className="text-xs text-gray-500 mt-1">n={metric.count} responses</p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className={`text-2xl font-bold ${
                      metric.sentiment === 'positive' ? 'text-green-600' :
                      metric.sentiment === 'negative' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {metric.average.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">/ 5</p>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="mb-3">
                  <div className="h-2 bg-gray-300 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        metric.sentiment === 'positive' ? 'bg-green-500' :
                        metric.sentiment === 'negative' ? 'bg-red-500' : 'bg-yellow-500'
                      }`}
                      style={{ width: `${(metric.average / 5) * 100}%` }}
                    />
                  </div>
                </div>
                
                {/* Statistics */}
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <p className="text-gray-500 text-xs">Mean</p>
                    <p className="font-semibold text-gray-900">{metric.average.toFixed(2)}</p>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <p className="text-gray-500 text-xs">Median</p>
                    <p className="font-semibold text-gray-900">{metric.median.toFixed(2)}</p>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-200">
                    <p className="text-gray-500 text-xs">Std Dev</p>
                    <p className="font-semibold text-gray-900">{metric.stdDev.toFixed(2)}</p>
                  </div>
                </div>

                {/* Distribution */}
                <div className="mt-3 flex gap-1">
                  {[1, 2, 3, 4, 5].map(level => (
                    <div key={level} className="flex-1">
                      <div className="h-6 bg-gray-200 rounded flex items-center justify-center text-xs font-semibold text-gray-700"
                        title={`Level ${level}: ${metric.distribution[level]} responses`}
                        style={{
                          backgroundColor: level <= 2 ? '#fee2e2' : level === 3 ? '#fef3c7' : '#dcfce7',
                          color: level <= 2 ? '#991b1b' : level === 3 ? '#92400e' : '#166534'
                        }}>
                        {metric.distribution[level]}
                      </div>
                      <p className="text-xs text-center text-gray-500 mt-1">{level}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Qualitative Insights */}
      {textInsights.some(insight => insight.responseCount > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 overflow-hidden">
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600 shrink-0" />
            Qualitative Insights
          </h3>
          <div className="space-y-4">
            {textInsights.map((insight, index) => (
              insight.responseCount > 0 && (
                <div key={index} className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                    <p className="font-medium text-gray-900 break-words leading-snug flex-1 min-w-0">{insight.questionText}</p>
                    <span className="text-xs sm:text-sm bg-purple-200 text-purple-900 px-2 py-1 rounded shrink-0">
                      {insight.responseCount} responses
                    </span>
                  </div>
                  {insight.sampleResponses.length > 0 && (
                    <div className="space-y-2">
                      {insight.sampleResponses.map((response, idx) => (
                        <p key={idx} className="text-sm text-gray-700 italic border-l-2 border-purple-400 pl-3 break-words whitespace-normal">
                          "{response}"
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* Recommendations & Next Steps */}
      <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5 sm:p-6 overflow-hidden">
        <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600 shrink-0" />
          Recommendations & Next Steps
        </h3>
        <p className="text-base sm:text-lg text-gray-700 leading-relaxed break-words whitespace-normal">
          {conclusion.nextSteps}
        </p>
      </div>

      {/* Methodology Note */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 sm:p-6 overflow-hidden">
        <div className="flex gap-3 text-sm sm:text-base text-gray-600">
          <AlertCircle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          <p className="break-words whitespace-normal leading-relaxed">
            <span className="font-medium">Methodology:</span> This analysis is based on {uniqueRespondents} unique respondent{uniqueRespondents === 1 ? '' : 's'} ({conclusion.answerRows} answer rows analyzed). Statistical measures include mean, median, and standard deviation. Results should be interpreted within the context of sample size and response distribution.
          </p>
        </div>
      </div>
    </div>
  );
}
