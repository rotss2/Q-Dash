// High-Capacity Processing for 50+ Questions
// Iterative Chunking Parser with Error Recovery and Schema Validation

import { PatternRecognitionEngine } from './questionTypeRegistry';

export interface ProcessedQuestion {
  id: string;
  text: string;
  type: string;
  options: string[];
  required?: boolean;
  sort_order: number;
  section?: string;
  needsManualReview?: boolean;
  reviewReason?: string;
  duplicates?: string[];
}

export interface ProcessingStats {
  totalQuestions: number;
  processedQuestions: number;
  failedQuestions: number;
  needsReview: number;
  sections: string[];
  duplicates: number;
}

export class HighCapacityProcessor {
  private static readonly CHUNK_SIZE = 5000; // characters per chunk
  private static readonly HIGH_VOLUME_THRESHOLD = 50; // questions
  
  static async processLargeDataset(rawText: string): Promise<{
    questions: ProcessedQuestion[];
    stats: ProcessingStats;
  }> {
    console.log('Starting high-capacity processing...');
    
    // Step 1: Count question stems to determine processing mode
    const questionCount = this.countQuestionStems(rawText);
    const isHighVolume = questionCount > this.HIGH_VOLUME_THRESHOLD;
    
    console.log(`Detected ${questionCount} questions. High volume mode: ${isHighVolume}`);
    
    // Step 2: Split into chunks if necessary
    const chunks = isHighVolume ? this.splitIntoChunks(rawText) : [rawText];
    
    // Step 3: Process each chunk
    const allQuestions: ProcessedQuestion[] = [];
    let processedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
      
      try {
        const chunkQuestions = await this.processChunk(chunks[i], processedCount);
        allQuestions.push(...chunkQuestions);
        processedCount += chunkQuestions.length;
        
        // Update progress (would emit event in real implementation)
        const progress = ((i + 1) / chunks.length) * 100;
        console.log(`Progress: ${progress.toFixed(1)}%`);
        
      } catch (error) {
        console.error(`Error processing chunk ${i + 1}:`, error);
        failedCount++;
        
        // Add error recovery question
        allQuestions.push({
          id: `error-chunk-${i}-${Date.now()}`,
          text: `Error processing chunk ${i + 1}. Please review manually.`,
          type: 'text',
          options: [],
          sort_order: processedCount,
          needsManualReview: true,
          reviewReason: `Processing error: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
    
    // Step 4: Post-processing
    const finalQuestions = this.postProcessQuestions(allQuestions);
    
    // Step 5: Generate stats
    const stats: ProcessingStats = {
      totalQuestions: questionCount,
      processedQuestions: finalQuestions.filter(q => !q.needsManualReview).length,
      failedQuestions: finalQuestions.filter(q => q.needsManualReview).length,
      needsReview: finalQuestions.filter(q => q.needsManualReview).length,
      sections: [...new Set(finalQuestions.map(q => q.section).filter((s): s is string => !!s))],
      duplicates: finalQuestions.filter(q => q.duplicates && q.duplicates.length > 0).length
    };
    
    console.log('Processing complete:', stats);
    
    return { questions: finalQuestions, stats };
  }
  
  private static countQuestionStems(text: string): number {
    const stemPatterns = [
      /\b\d+[\.\)]\s+/g,           // 1. 2) 3.
      /\bQuestion\s*\d*:/gi,       // Question:, Question 1:
      /\b[A-Z]\)[\s]*/g,           // A) B) C)
      /^[A-Z][a-z]*\s*\([^)]+\):/gm, // Boolean (Technical):
      /^\s*[Qq]\d*[\.\:]?\s*/gm,   // Q1. Q2:
    ];
    
    let totalStems = 0;
    stemPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) totalStems += matches.length;
    });
    
    // Fallback: count question marks
    const questionMarks = text.match(/\?/g);
    if (questionMarks && totalStems === 0) {
      totalStems = questionMarks.length;
    }
    
    return totalStems;
  }
  
  private static splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    let currentPosition = 0;
    
    while (currentPosition < text.length) {
      let endPosition = currentPosition + this.CHUNK_SIZE;
      
      // Try to split at a natural boundary
      if (endPosition < text.length) {
        // Look for question boundaries
        const nextBoundary = text.indexOf('\n\n', endPosition - 100);
        if (nextBoundary !== -1 && nextBoundary < endPosition + 200) {
          endPosition = nextBoundary;
        } else {
          // Look for double newline
          const nextNewline = text.indexOf('\n', endPosition);
          if (nextNewline !== -1 && nextNewline < endPosition + 100) {
            endPosition = nextNewline;
          }
        }
      }
      
      chunks.push(text.slice(currentPosition, endPosition));
      currentPosition = endPosition;
    }
    
    return chunks;
  }
  
  private static async processChunk(chunk: string, startIndex: number): Promise<ProcessedQuestion[]> {
    const questions: ProcessedQuestion[] = [];
    
    // Split chunk into question blocks
    const blocks = this.identifyQuestionBlocks(chunk);
    
    for (let i = 0; i < blocks.length; i++) {
      try {
        const question = await this.parseQuestionBlock(blocks[i], startIndex + i);
        questions.push(question);
      } catch (error) {
        console.error(`Error parsing question block ${i}:`, error);
        
        // Error recovery: create a manual review question
        questions.push({
          id: `review-${startIndex + i}-${Date.now()}`,
          text: blocks[i].substring(0, 100) + (blocks[i].length > 100 ? '...' : ''),
          type: 'text',
          options: [],
          sort_order: startIndex + i,
          needsManualReview: true,
          reviewReason: `Parse error: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
    
    return questions;
  }
  
  private static identifyQuestionBlocks(text: string): string[] {
    const blocks: string[] = [];
    const lines = text.split('\n');
    let currentBlock = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this line starts a new question block
      const isNewQuestion = 
        /^(Question|Q\d*|Boolean|Multiple Choice|Yes\/No|Options|Expected Answer|Correct Answer)/i.test(line) ||
        /^\d+[\.\)]\s*/.test(line) ||
        /^[A-Z]\)[\s]*/.test(line);
      
      if (isNewQuestion && currentBlock) {
        blocks.push(currentBlock.trim());
        currentBlock = line;
      } else {
        currentBlock += (currentBlock ? '\n' : '') + line;
      }
    }
    
    if (currentBlock) {
      blocks.push(currentBlock.trim());
    }
    
    return blocks.filter(block => block.length > 10);
  }
  
  private static async parseQuestionBlock(block: string, index: number): Promise<ProcessedQuestion> {
    // Extract question text
    const questionMatch = block.match(/Question:\s*(.+?)(?=\n(?:Options|Expected Answer|Correct Answer)|$)/i);
    let questionText = questionMatch ? questionMatch[1].trim() : block;
    
    // Strip category labels
    questionText = questionText.replace(/^(Boolean|Multiple Choice|Yes\/No|Technical|Contextual|Theoretical|Security|Logic)\s*\(?\w*\)?:\s*/i, '').trim();
    
    // Clean question text
    questionText = this.cleanQuestionText(questionText);
    
    // Detect question type using pattern recognition
    const typePattern = PatternRecognitionEngine.detectQuestionType(questionText, block);
    
    // Extract options
    const options = PatternRecognitionEngine.extractOptions(block, typePattern.type);
    
    // Auto-generate options if needed
    let finalOptions = options;
    if (typePattern.type === 'choice' && options.length === 0) {
      // Check if there's a correct answer to generate distractors
      const answerMatch = block.match(/(?:Expected Answer|Correct Answer|Ans):\s*(.+)/i);
      if (answerMatch) {
        const correctAnswer = answerMatch[1].trim();
        const distractors = PatternRecognitionEngine.generateAutoDistractors(questionText, correctAnswer);
        finalOptions = [correctAnswer, ...distractors];
      } else {
        finalOptions = typePattern.options || ['Option 1', 'Option 2', 'Option 3'];
      }
    }
    
    // Determine section based on position
    const section = this.determineSection(index, questionText);
    
    return {
      id: `bulk-${index}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      text: questionText,
      type: typePattern.type,
      options: finalOptions,
      required: false,
      sort_order: index,
      section
    };
  }
  
  private static cleanQuestionText(text: string): string {
    return text
      .replace(/^(\s*[\d]+[\.\)\-]\s*)/, '')
      .replace(/^(\s*[-•*]\s*)/, '')
      .replace(/^(\s*[A-Z]\)[\s]*)/, '')
      .trim();
  }
  
  private static determineSection(index: number, _questionText: string): string {
    // Simple section determination based on position and content
    if (index < 10) return 'Introduction';
    if (index < 30) return 'Methodology';
    if (index < 40) return 'Analysis';
    return 'Conclusion';
  }
  
  private static postProcessQuestions(questions: ProcessedQuestion[]): ProcessedQuestion[] {
    // 1. Detect duplicates
    const duplicates = this.detectDuplicates(questions);
    
    // 2. Ensure unique IDs and sort_order
    questions.forEach((q, index) => {
      q.sort_order = index;
      q.id = `bulk-${index}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    });
    
    // 3. Apply duplicate flags
    duplicates.forEach(({ original, duplicates: dupList }) => {
      const originalQuestion = questions.find(q => q.id === original);
      if (originalQuestion) {
        originalQuestion.duplicates = dupList;
      }
    });
    
    return questions;
  }
  
  private static detectDuplicates(questions: ProcessedQuestion[]): { original: string; duplicates: string[] }[] {
    const duplicates: { original: string; duplicates: string[] }[] = [];
    const seen = new Map<string, string[]>();
    
    questions.forEach(q => {
      const normalized = q.text.toLowerCase().replace(/[^\w\s]/g, '').trim();
      
      if (seen.has(normalized)) {
        seen.get(normalized)!.push(q.id);
      } else {
        seen.set(normalized, [q.id]);
      }
    });
    
    seen.forEach((ids, _text) => {
      if (ids.length > 1) {
        duplicates.push({
          original: ids[0],
          duplicates: ids.slice(1)
        });
      }
    });
    
    return duplicates;
  }
}
