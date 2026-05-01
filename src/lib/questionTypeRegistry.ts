// Universal Type Registry - Pattern Recognition Engine for Super Genius Bulk Import

export interface QuestionTypePattern {
  type: 'choice' | 'boolean' | 'likert' | 'ranking' | 'matrix' | 'text' | 'long_text';
  patterns: RegExp[];
  priority: number; // Higher priority = checked first
  options?: string[]; // Default options for this type
  validator?: (text: string, context: string) => boolean;
}

export const QUESTION_TYPE_REGISTRY: QuestionTypePattern[] = [
  {
    type: 'choice',
    priority: 10,
    patterns: [
      /\[A\][^\[]*\[B\][^\[]*\[C\]/i,           // [A] Option1 [B] Option2 [C] Option3
      /\d+\)\s*[^\d]+\d+\)\s*[^\d]+\d+\)/i,       // 1) Option1 2) Option2 3) Option3
      /Options:\s*\[.*?\]/i,                       // Options: [A]..., [B]...
      /\([A-Z]\)\s*[^\(]+\([B-Z]\)\s*[^\(]+/i,    // (A) Option1 (B) Option2
      /a\)\s*[^a]+b\)\s*[^b]+c\)/i,               // a) Option1 b) Option2 c) Option3
    ],
    validator: (text, _context) => {
      // Additional validation for multiple choice
      return text.includes('?') || /which|what|where|when|how|why/i.test(text);
    }
  },
  
  {
    type: 'boolean',
    priority: 9,
    patterns: [
      /\b(True|False)\b/i,
      /\b(Yes|No)\b/i,
      /\b(T\/F|Y\/N)\b/i,
      /\b(Correct|Incorrect)\b/i,
    ],
    options: ['True', 'False'],
    validator: (text, _context) => {
      // Must be a yes/no question
      return /^(is|are|do|does|did|will|would|should|can|could|has|have|was|were)/i.test(text.trim());
    }
  },
  
  {
    type: 'likert',
    priority: 8,
    patterns: [
      /\b(Strongly Agree|Agree|Neutral|Disagree|Strongly Disagree)\b/i,
      /\b(Very Satisfied|Satisfied|Neutral|Dissatisfied|Very Dissatisfied)\b/i,
      /\b(1-5|1 to 5|scale.*1.*5)\b/i,
      /\b(Rate|Scale|Level)\b.*\b(1|2|3|4|5)\b/i,
      // Standalone keywords that indicate Likert-type questions
      /\bhow (satisfied|likely|confident|comfortable|important|useful|easy|difficult)\b/i,
      /\bto what extent.*\b(agree|disagree)\b/i,
      /\bhow would you rate\b/i,
      /\bhow (often|frequently|much|well)\b/i,
    ],
    options: ['1', '2', '3', '4', '5'],
    validator: (text, _context) => {
      // Should contain rating/satisfaction/agreement keywords
      return /\b(rate|scale|level|agree|disagree|satisfied|dissatisfied|likely|extent|often|frequently)\b/i.test(text);
    }
  },
  
  {
    type: 'ranking',
    priority: 7,
    patterns: [
      /\b(Rank|Order|Arrange|Sort|Prioritize)\b/i,
      /\b(from.*highest.*to.*lowest|from.*most.*to.*least)\b/i,
      /\b(1st|2nd|3rd|first|second|third)\b.*\b(rank|order)\b/i,
    ],
    validator: (_text, context) => {
      // Must have multiple items to rank
      const items = context.split(/[,\n]/).filter((item: string) => item.trim().length > 5);
      return items.length >= 3;
    }
  },
  
  {
    type: 'matrix',
    priority: 6,
    patterns: [
      /\|\s*[^|]+\s*\|\s*[^|]+\s*\|/,           // Table format
      /\b(rows|columns|grid|table)\b/i,
      /\b(For each|Select one for each)\b/i,
    ],
    validator: (_text, context) => {
      // Should have multiple sub-questions
      return /\b(and|or|each|for|select)\b.*\b(row|column|item)\b/i.test(context);
    }
  },
  
  {
    type: 'long_text',
    priority: 5,
    patterns: [
      /\b(Explain|Describe|Elaborate|Discuss|Analyze|Evaluate)\b/i,
      /\b(in detail|in depth|comprehensive|thorough)\b/i,
      /\b(paragraph|essay|detailed response)\b/i,
      /\.{3,}/, // Multiple dots indicating long answer expected
    ],
    validator: (text, _context) => {
      // Should ask for detailed explanation
      return /\b(explain|describe|discuss|analyze|why|how)\b/i.test(text) && 
             text.length > 50;
    }
  },
  
  {
    type: 'text',
    priority: 1, // Lowest priority - fallback
    patterns: [
      /\?/, // Any question mark
    ],
    validator: () => true // Always valid as fallback
  }
];

export class PatternRecognitionEngine {
  static detectQuestionType(text: string, context: string = ''): QuestionTypePattern {
    const scored = QUESTION_TYPE_REGISTRY.map(pattern => {
      let score = 0;
      
      // Check each pattern
      pattern.patterns.forEach(regex => {
        if (regex.test(text) || regex.test(context)) {
          score += pattern.priority;
        }
      });
      
      // Apply validator if exists
      if (pattern.validator && !pattern.validator(text, context)) {
        score = 0; // Disqualify if validation fails
      }
      
      return { pattern, score };
    });
    
    // Return highest scoring pattern
    const best = scored.reduce((prev, curr) => 
      curr.score > prev.score ? curr : prev
    );
    
    return best.score > 0 ? best.pattern : QUESTION_TYPE_REGISTRY[QUESTION_TYPE_REGISTRY.length - 1]; // Fallback to text
  }
  
  static extractOptions(text: string, type: string): string[] {
    switch (type) {
      case 'choice':
        // Extract [A] Option1, [B] Option2 format
        const bracketMatch = text.match(/\[([A-Z])\]\s*([^,\[\]]+)(?:,\s*\[([A-Z])\]\s*([^,\[\]]+))*/i);
        if (bracketMatch) {
          const options = [];
          for (let i = 1; i < bracketMatch.length; i += 2) {
            if (bracketMatch[i] && bracketMatch[i + 1]) {
              options.push(bracketMatch[i + 1].trim());
            }
          }
          return options;
        }
        
        // Extract 1) Option1, 2) Option2 format
        const numberMatch = text.match(/\d+\)\s*([^,\d]+(?:,\s*\d+\)\s*[^,\d]+)*)/i);
        if (numberMatch) {
          return numberMatch[1].split(/\s*,\s*\d+\)\s*/).map(opt => opt.trim());
        }
        
        // Extract comma-separated options
        const commaMatch = text.match(/Options:\s*(.+)/i);
        if (commaMatch) {
          return commaMatch[1].split(/,\s*/).map(opt => opt.trim());
        }
        
        return ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
        
      case 'boolean':
        return ['True', 'False'];
        
      case 'likert':
        return ['1', '2', '3', '4', '5'];
        
      default:
        return [];
    }
  }
  
  static generateAutoDistractors(question: string, correctAnswer: string): string[] {
    // Simple distractor generation based on question context
    const distractors = [];
    
    // Number-based questions
    if (/\d+/.test(correctAnswer)) {
      const num = parseInt(correctAnswer);
      distractors.push(String(num + 1));
      distractors.push(String(num - 1));
      distractors.push(String(num + 2));
    }
    
    // Text-based questions
    else {
      const words = question.split(/\s+/).filter(w => w.length > 4);
      if (words.length >= 3) {
        distractors.push(words[0]);
        distractors.push(words[1]);
        distractors.push(words[2]);
      }
    }
    
    // Ensure we have exactly 3 distractors
    while (distractors.length < 3) {
      distractors.push(`Option ${distractors.length + 2}`);
    }
    
    return distractors.slice(0, 3);
  }
}
