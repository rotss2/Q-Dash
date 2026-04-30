import { useMemo } from 'react';
import { FileText, TrendingUp, Star, Users } from 'lucide-react';
import type { Question, Response } from '../types';

interface ResearchConclusionProps {
  questions: Question[];
  responses: (Response & { question?: Question })[];
  surveyTitle: string;
}

interface ScoreMetric {
  questionText: string;
  average: number;
  count: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export default function ResearchConclusion({ questions, responses, surveyTitle }: ResearchConclusionProps) {
  
  // Calculate satisfaction metrics from likert-scale questions
  const satisfactionMetrics = useMemo((): ScoreMetric[] => {
    const metrics: ScoreMetric[] = [];
    
    questions.forEach(question => {
      if (question.type === 'likert') {
        const questionResponses = responses.filter(r => r.question_id === question.id);
        const ratings = questionResponses
          .map(r => parseInt(r.answer as string))
          .filter(n => !isNaN(n) && n >= 1 && n <= 5);
        
        if (ratings.length > 0) {
          const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
          
          let sentiment: 'positive' | 'neutral' | 'negative';
          if (avg >= 4) sentiment = 'positive';
          else if (avg >= 3) sentiment = 'neutral';
          else sentiment = 'negative';
          
          metrics.push({
            questionText: question.question_text,
            average: avg,
            count: ratings.length,
            sentiment
          });
        }
      }
    });
    
    return metrics.sort((a, b) => b.average - a.average);
  }, [questions, responses]);

  // Generate overall conclusion
  const conclusion = useMemo(() => {
    if (satisfactionMetrics.length === 0) {
      return {
        summary: 'Insufficient rating data to generate a conclusion.',
        recommendation: 'Collect more Likert-scale responses for automated analysis.',
        overallScore: null
      };
    }

    const overallAverage = satisfactionMetrics.reduce((sum, m) => sum + m.average, 0) / satisfactionMetrics.length;
    const roundedScore = overallAverage.toFixed(1);
    
    // Find highest and lowest scoring areas
    const highest = satisfactionMetrics[0];
    const lowest = satisfactionMetrics[satisfactionMetrics.length - 1];
    
    // Generate summary based on overall score
    let summary = '';
    let recommendation = '';
    
    if (overallAverage >= 4.5) {
      summary = `Based on an average satisfaction score of ${roundedScore}/5, the user base shows exceptional approval. The highest-rated aspect is "${highest.questionText}" at ${highest.average.toFixed(1)}/5.`;
      recommendation = `Maintain current standards. Consider ${lowest.questionText} as an area for incremental improvement (scored ${lowest.average.toFixed(1)}/5).`;
    } else if (overallAverage >= 4.0) {
      summary = `With an average satisfaction score of ${roundedScore}/5, users demonstrate strong satisfaction overall. "${highest.questionText}" leads at ${highest.average.toFixed(1)}/5.`;
      recommendation = `System performance is solid. Address ${lowest.questionText} (scored ${lowest.average.toFixed(1)}/5) to push overall satisfaction above 4.5.`;
    } else if (overallAverage >= 3.5) {
      summary = `The average satisfaction score of ${roundedScore}/5 indicates moderate satisfaction with room for improvement. "${highest.questionText}" performs best at ${highest.average.toFixed(1)}/5.`;
      recommendation = `Priority should be given to improving ${lowest.questionText} (scored ${lowest.average.toFixed(1)}/5) to elevate the overall user experience.`;
    } else if (overallAverage >= 3.0) {
      summary = `An average score of ${roundedScore}/5 suggests neutral to mixed user sentiment. "${highest.questionText}" (${highest.average.toFixed(1)}/5) is the relative strength.`;
      recommendation = `Significant improvements needed in ${lowest.questionText} (scored ${lowest.average.toFixed(1)}/5). Conduct follow-up research to identify specific pain points.`;
    } else {
      summary = `The low average score of ${roundedScore}/5 indicates user dissatisfaction. Even the highest-rated aspect ("${highest.questionText}" at ${highest.average.toFixed(1)}/5) is below acceptable thresholds.`;
      recommendation = `Immediate comprehensive review required. Critical issues identified in ${lowest.questionText} (scored ${lowest.average.toFixed(1)}/5).`;
    }

    return {
      summary,
      recommendation,
      overallScore: roundedScore,
      highest,
      lowest
    };
  }, [satisfactionMetrics]);

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
      {/* Executive Summary Card */}
      <div className="card bg-slate-50 border-slate-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Executive Summary: {surveyTitle}
            </h3>
            
            {conclusion.overallScore && (
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <span className="text-2xl font-bold text-slate-900">{conclusion.overallScore}/5</span>
                  <span className="text-sm text-gray-600">Overall Score</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>{uniqueRespondents} participants</span>
                </div>
              </div>
            )}
            
            <p className="text-gray-700 leading-relaxed mb-4">
              {conclusion.summary}
            </p>
            
            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-slate-900">Recommendation</span>
              </div>
              <p className="text-gray-700">{conclusion.recommendation}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Individual Metrics */}
      {satisfactionMetrics.length > 0 && (
        <div className="card">
          <h4 className="font-medium text-slate-900 mb-4">Satisfaction Breakdown</h4>
          <div className="space-y-3">
            {satisfactionMetrics.map((metric, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{metric.questionText}</span>
                    <span className={`text-sm font-bold ${
                      metric.sentiment === 'positive' ? 'text-green-600' :
                      metric.sentiment === 'negative' ? 'text-red-600' : 'text-yellow-600'
                    }`}>
                      {metric.average.toFixed(1)}/5
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        metric.sentiment === 'positive' ? 'bg-green-500' :
                        metric.sentiment === 'negative' ? 'bg-red-500' : 'bg-yellow-500'
                      }`}
                      style={{ width: `${(metric.average / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{metric.count} responses</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Text Response Summary */}
      {questions.filter(q => q.type === 'text').length > 0 && (
        <div className="card">
          <h4 className="font-medium text-slate-900 mb-2">Qualitative Data</h4>
          <p className="text-sm text-gray-600">
            {questions.filter(q => q.type === 'text').length} text response questions available. 
            Review individual responses in the Raw Data tab for detailed qualitative insights.
          </p>
        </div>
      )}
    </div>
  );
}
