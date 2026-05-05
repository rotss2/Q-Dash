// Question Bank Bulk Import Parser
// Parses questions in the following format:
//
// Question: What is DTFT?
// A. Discrete-Time Fourier Transform
// B. Digital Time Frequency Table
// C. Direct Transfer Function Theory
// D. Dynamic Transform Formula
// Answer: A
// Topic: DTFT
// Difficulty: Easy
// Explanation: DTFT means Discrete-Time Fourier Transform.

import type { BulkImportQuestion, BulkImportResult, BankQuestionType, DifficultyLevel } from '../types/questionBank';

const VALID_QUESTION_TYPES: BankQuestionType[] = ['multiple_choice', 'true_false', 'identification', 'essay'];
const VALID_DIFFICULTIES: DifficultyLevel[] = ['easy', 'medium', 'hard'];
const VALID_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function parseBulkImportText(text: string): BulkImportResult {
  const questions: BulkImportQuestion[] = [];
  const blocks = text.split(/\n\n+/).filter(block => block.trim());

  for (const block of blocks) {
    const question = parseQuestionBlock(block);
    questions.push(question);
  }

  const validCount = questions.filter(q => q.is_valid).length;
  const invalidCount = questions.filter(q => !q.is_valid).length;

  return {
    questions,
    valid_count: validCount,
    invalid_count: invalidCount,
    total_count: questions.length,
  };
}

function parseQuestionBlock(block: string): BulkImportQuestion {
  const lines = block.split('\n').map(line => line.trim()).filter(line => line);
  
  const errors: string[] = [];
  let questionText = '';
  const options: string[] = [];
  let correctAnswer = '';
  let topic = 'General';
  let difficulty: DifficultyLevel = 'medium';
  let explanation = '';
  let points = 1;

  let currentField: string | null = null;
  let currentValue: string = '';

  for (const line of lines) {
    // Check for field headers
    const questionMatch = line.match(/^Question:\s*(.+)/i);
    const optionMatch = line.match(/^([A-F])\.\s*(.+)/i);
    const answerMatch = line.match(/^Answer:\s*([A-F])/i);
    const topicMatch = line.match(/^Topic:\s*(.+)/i);
    const difficultyMatch = line.match(/^Difficulty:\s*(.+)/i);
    const explanationMatch = line.match(/^Explanation:\s*(.+)/i);
    const pointsMatch = line.match(/^Points?:\s*(\d+)/i);

    if (questionMatch) {
      if (currentField && currentValue) {
        saveField(currentField, currentValue, { options, correctAnswer, topic, difficulty, explanation, errors });
      }
      currentField = 'question';
      currentValue = questionMatch[1];
    } else if (optionMatch) {
      if (currentField && currentValue) {
        saveField(currentField, currentValue, { options, correctAnswer, topic, difficulty, explanation, errors });
      }
      const optionLetter = optionMatch[1].toUpperCase();
      const optionText = optionMatch[2];
      
      // Map letter to index
      const index = VALID_OPTIONS.indexOf(optionLetter);
      if (index >= 0) {
        options[index] = optionText;
      }
      currentField = null;
    } else if (answerMatch) {
      if (currentField && currentValue) {
        saveField(currentField, currentValue, { options, correctAnswer, topic, difficulty, explanation, errors });
      }
      correctAnswer = answerMatch[1].toUpperCase();
      currentField = null;
    } else if (topicMatch) {
      if (currentField && currentValue) {
        saveField(currentField, currentValue, { options, correctAnswer, topic, difficulty, explanation, errors });
      }
      topic = topicMatch[1].trim();
      currentField = null;
    } else if (difficultyMatch) {
      if (currentField && currentValue) {
        saveField(currentField, currentValue, { options, correctAnswer, topic, difficulty, explanation, errors });
      }
      const parsedDifficulty = difficultyMatch[1].toLowerCase().trim() as DifficultyLevel;
      if (VALID_DIFFICULTIES.includes(parsedDifficulty)) {
        difficulty = parsedDifficulty;
      } else {
        errors.push(`Invalid difficulty: ${parsedDifficulty}`);
      }
      currentField = null;
    } else if (explanationMatch) {
      if (currentField && currentValue) {
        saveField(currentField, currentValue, { options, correctAnswer, topic, difficulty, explanation, errors });
      }
      currentField = 'explanation';
      currentValue = explanationMatch[1];
    } else if (pointsMatch) {
      if (currentField && currentValue) {
        saveField(currentField, currentValue, { options, correctAnswer, topic, difficulty, explanation, errors });
      }
      points = parseInt(pointsMatch[1], 10) || 1;
      currentField = null;
    } else if (currentField) {
      // Continuation of multi-line field
      currentValue += ' ' + line;
    }
  }

  // Save last field
  if (currentField && currentValue) {
    saveField(currentField, currentValue, { options, correctAnswer, topic, difficulty, explanation, errors });
  }

  // Determine question type based on options
  let questionType: BankQuestionType = 'multiple_choice';
  if (options.filter(Boolean).length === 0) {
    questionType = 'identification';
  } else if (options.filter(Boolean).length === 2 && 
             options[0]?.toLowerCase().includes('true') && 
             options[1]?.toLowerCase().includes('false')) {
    questionType = 'true_false';
  }

  // Validation
  if (!questionText.trim()) {
    errors.push('Question text is required');
  }

  if (questionType === 'multiple_choice' || questionType === 'true_false') {
    const validOptions = options.filter(Boolean);
    if (validOptions.length < 2) {
      errors.push('At least 2 options required for choice questions');
    }
    if (!correctAnswer) {
      errors.push('Correct answer is required');
    } else if (!VALID_OPTIONS.includes(correctAnswer) || !options[VALID_OPTIONS.indexOf(correctAnswer)]) {
      errors.push(`Correct answer ${correctAnswer} does not match any option`);
    }
  }

  return {
    question_text: questionText,
    question_type: questionType,
    options,
    correct_answer: correctAnswer,
    topic,
    difficulty,
    explanation: explanation || undefined,
    points,
    is_valid: errors.length === 0,
    errors,
  };
}

function saveField(
  field: string, 
  value: string, 
  context: { 
    options: string[], 
    correctAnswer: string, 
    topic: string, 
    difficulty: DifficultyLevel, 
    explanation: string, 
    errors: string[] 
  }
) {
  const trimmedValue = value.trim();
  if (field === 'explanation') {
    context.explanation = trimmedValue;
  }
}

// Helper function to convert parsed question to database format
export function convertToQuestionBankItem(
  question: BulkImportQuestion,
  userId: string
): Omit<QuestionBankItem, 'id' | 'created_at' | 'updated_at' | 'usage_count'> {
  const options = question.options
    .filter((opt, index) => opt && VALID_OPTIONS[index])
    .map((opt, index) => ({
      id: crypto.randomUUID(),
      option_text: opt,
      is_correct: VALID_OPTIONS[index] === question.correct_answer,
      order_index: index,
    }));

  return {
    question_text: question.question_text,
    question_type: question.question_type,
    topic: question.topic,
    difficulty: question.difficulty,
    explanation: question.explanation || null,
    points: question.points ?? 1,
    correct_answer: question.correct_answer,
    correct_answers: question.correct_answer ? [question.correct_answer] : null,
    options,
    mode_compatibility: ['quiz', 'exam'],
    created_by: userId,
  };
}

// Import types
import type { QuestionBankItem } from '../types/questionBank';
