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
  
  // Calculate comprehensive satisfaction metrics
  const satisfactionMetrics = useMemo((): ScoreMetric[] => {
    const metrics: ScoreMetric[] = [];
    
    questions.forEach(question => {
      if (question.type === 'likert') {
        const questionResponses = responses.filter(r => r.question_id === question.id);
        const ratings = questionResponses
          .map(r => parseInt(r.answer as string))
          .filter(n => !isNaN(n) && n >= 1 && n <= 5);
        
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

  // Generate comprehensive conclusion
  const conclusion = useMemo(() => {
    const textResponseCount = textInsights.reduce((sum, insight) => sum + insight.responseCount, 0);
    const uniqueRespondents = new Set(responses.map(r => r.user_id).filter(Boolean)).size;
    const answerRowCount = responses.length;
    
    // Count responses for non-likert questions (multiple_choice, text, etc.)
    const nonLikertResponses = responses.filter(r => {
      const q = questions.find(q => q.id === r.question_id);
      return q && q.type !== 'likert';
    });
    
    // Total meaningful responses = unique respondents (actual submissions)
    const totalMeaningfulResponses = uniqueRespondents;
    
    // Generate conclusion with 2+ responses of any type
    if (totalMeaningfulResponses >= 2 || uniqueRespondents >= 1) {
      // If we have satisfaction metrics (likert), use them
      if (satisfactionMetrics.length > 0) {
        const overallAverage = satisfactionMetrics.reduce((sum, m) => sum + m.average, 0) / satisfactionMetrics.length;
        const roundedScore = overallAverage.toFixed(1);
        const avgStdDev = satisfactionMetrics.reduce((sum, m) => sum + m.stdDev, 0) / satisfactionMetrics.length;
        const consistencyScore = Math.max(0, 100 - (avgStdDev * 20));
        const highest = satisfactionMetrics[0];
        const lowest = satisfactionMetrics[satisfactionMetrics.length - 1];
        
        const keyFindings: string[] = [];
        if (overallAverage >= 4.0) {
          keyFindings.push(`Strong overall satisfaction with average score of ${roundedScore}/5`);
          keyFindings.push(`Best performing area: "${highest.questionText}" (${highest.average.toFixed(2)}/5)`);
        } else if (overallAverage >= 3.0) {
          keyFindings.push(`Moderate satisfaction with average score of ${roundedScore}/5`);
          keyFindings.push(`Improvement opportunity: "${lowest.questionText}" (${lowest.average.toFixed(2)}/5)`);
        } else {
          keyFindings.push(`Low satisfaction levels with average score of ${roundedScore}/5`);
          keyFindings.push(`Critical area needing attention: "${lowest.questionText}" (${lowest.average.toFixed(2)}/5)`);
        }
        
        // Add text response insights if available
        if (textResponseCount > 0) {
          keyFindings.push(`${textResponseCount} qualitative text responses collected for deeper insights`);
        }
        
        let summary = '';
        let nextSteps = '';
        
        if (uniqueRespondents === 1) {
          summary = `Initial data from ${uniqueRespondents} respondent shows an average satisfaction score of ${roundedScore}/5. While the sample size is small, early indicators suggest ${overallAverage >= 4.0 ? 'positive sentiment' : overallAverage >= 3.0 ? 'mixed sentiment' : 'areas for improvement'}.`;
          nextSteps = 'Collect more responses for statistically significant conclusions. Share survey with broader audience.';
        } else if (uniqueRespondents < 5) {
          summary = `Preliminary analysis from ${uniqueRespondents} respondents indicates an average satisfaction score of ${roundedScore}/5. Early trends are emerging but more data is needed for definitive conclusions.`;
          nextSteps = 'Continue collecting responses to reach minimum threshold of 5+ respondents for reliable insights.';
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
        if (uniqueRespondents === 1) {
          summary = `Initial data collected from ${uniqueRespondents} respondent across ${questions.length} questions. ${hasText ? 'Qualitative feedback captured for thematic analysis.' : 'Response patterns are being established.'}`;
        } else if (uniqueRespondents < 5) {
          summary = `Preliminary insights from ${uniqueRespondents} respondents showing engagement across ${questions.length} survey questions. Data collection in progress.`;
        } else {
          summary = `Analysis of ${uniqueRespondents} respondents across ${questions.length} questions reveals meaningful engagement. ${hasText ? 'Rich qualitative data available for deeper insights.' : 'Response distribution patterns emerging.'}`;
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

  // Count unique respondents
  const uniqueRespondents = useMemo(() => {
    const unique = new Set(responses.map(r => r.user_id));
    return unique.size;
  }, [responses]);

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
      {/* Research Paper Header */}
      <div className="card bg-gradient-to-r from-slate-900 to-slate-800 text-white border-0">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">Research Analysis Report</h2>
            <p className="text-white/80 mb-4">{surveyTitle}</p>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-white/60">Participants:</span>
                <span className="ml-2 font-semibold">{uniqueRespondents}</span>
              </div>
              <div>
                <span className="text-white/60">Answer Rows:</span>
                <span className="ml-2 font-semibold">{conclusion.answerRows}</span>
              </div>
              <div>
                <span className="text-white/60">Overall Score:</span>
                <span className="ml-2 font-semibold text-yellow-400">{conclusion.overallScore}/5.0</span>
              </div>
              <div>
                <span className="text-white/60">Consistency:</span>
                <span className="ml-2 font-semibold">{conclusion.consistencyScore}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="card border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-600" />
          Executive Summary
        </h3>
        <p className="text-gray-700 leading-relaxed italic">
          {conclusion.summary}
        </p>
      </div>

      {/* Key Findings */}
      <div className="card border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          Key Findings
        </h3>
        <ul className="space-y-2">
          {conclusion.keyFindings.map((finding, index) => (
            <li key={index} className="flex gap-3 text-gray-700">
              <span className="text-green-600 font-bold mt-0.5">•</span>
              <span>{finding}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Satisfaction Metrics Breakdown */}
      {satisfactionMetrics.length > 0 && (
        <div className="card border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Detailed Metrics Analysis
          </h3>
          <div className="space-y-6">
            {satisfactionMetrics.map((metric, index) => (
              <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-medium text-gray-900">{metric.questionText}</p>
                    <p className="text-xs text-gray-500 mt-1">n={metric.count} responses</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${
                      metric.sentiment === 'positive' ? 'text-green-600' :
                      metric.sentiment === 'negative' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {metric.average.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">/5.0</p>
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
        <div className="card border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            Qualitative Insights
          </h3>
          <div className="space-y-4">
            {textInsights.map((insight, index) => (
              insight.responseCount > 0 && (
                <div key={index} className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex justify-between items-center mb-3">
                    <p className="font-medium text-gray-900">{insight.questionText}</p>
                    <span className="text-sm bg-purple-200 text-purple-900 px-2 py-1 rounded">
                      {insight.responseCount} responses
                    </span>
                  </div>
                  {insight.sampleResponses.length > 0 && (
                    <div className="space-y-2">
                      {insight.sampleResponses.map((response, idx) => (
                        <p key={idx} className="text-sm text-gray-700 italic border-l-2 border-purple-400 pl-3">
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
      <div className="card bg-blue-50 border border-blue-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Recommendations & Next Steps
        </h3>
        <p className="text-gray-700 leading-relaxed">
          {conclusion.nextSteps}
        </p>
      </div>

      {/* Methodology Note */}
      <div className="card bg-slate-50 border border-slate-200">
        <div className="flex gap-2 text-sm text-gray-600">
          <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <p>
            <span className="font-medium">Methodology:</span> This analysis is based on {uniqueRespondents} unique respondent{uniqueRespondents === 1 ? '' : 's'} ({conclusion.answerRows} answer rows analyzed). Statistical measures include mean, median, and standard deviation. Results should be interpreted within the context of sample size and response distribution.
          </p>
        </div>
      </div>
    </div>
  );
}
