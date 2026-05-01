# 🤖 Context-Aware Document Upload & Question Generation

## Overview

This feature allows users to upload research papers, articles, or any text documents (PDF, DOCX, TXT) and automatically generate research-grade survey questions based **strictly** on the document's content. The AI is constrained to prevent hallucination and only uses information explicitly present in the uploaded document.

---

## ✨ Features

### Frontend (DocumentQuestionGenerator Component)

**1. Configuration Panel**
- **Question Types**: Toggle between Multiple Choice, Boolean (Yes/No), Short Answer, and Likert Scale
- **Question Quantity**: Slider from 1-30 questions
- **Complexity Levels**: 
  - Academic: Tests understanding of concepts and theories
  - Research-Grade: Scholarly evaluation requiring critical analysis
  - Analytical: Evaluative questions requiring synthesis and application
- **Strict Grounding Toggle**: Enforces zero hallucination (recommended)

**2. Drag-and-Drop File Upload**
- Supports PDF, DOCX, and TXT files
- 10MB file size limit
- Visual feedback during drag operations
- File validation and error handling

**3. Question Preview & Review**
- Generated questions displayed in a preview panel
- Shows question type, options (for multiple choice), and source context
- Option to accept (add to survey) or discard questions
- Warning when fewer questions generated than requested (indicates strict grounding worked)

### Backend (Server API Routes)

**1. `/api/upload-document`**
- Accepts multipart/form-data file uploads
- Extracts text using appropriate parser:
  - PDF: `pdf-parse` library
  - DOCX: `mammoth` library
  - TXT: Direct UTF-8 decoding
- Implements intelligent text chunking:
  - Chunk size: 4,000 characters
  - Overlap: 500 characters for context preservation
  - Sentence boundary detection to prevent mid-sentence cuts
- Returns extracted text + metadata

**2. `/api/generate-questions`**
- Processes text chunks with OpenAI GPT-4
- Strict grounding system prompt prevents hallucination
- JSON schema validation using Zod
- Post-processing grounding check:
  - Verifies source context exists in original document
  - Fuzzy matching with 30% threshold
- Error handling for rate limits, quota exceeded, context length

---

## 🛡️ Anti-Hallucination Strategy

The system implements **multiple layers of protection** to ensure questions are grounded in the document:

### Layer 1: System Prompt Engineering
```
⚠️ STRICT GROUNDING ENFORCED ⚠️
- Generate questions SOLELY based on the provided document text
- ZERO external knowledge or assumptions allowed
- If the document lacks sufficient information for a question, STOP and return fewer questions
- NEVER hallucinate facts, statistics, or claims not explicitly in the text
- Each question must be verifiable by referencing specific content in the document
```

### Layer 2: Temperature Control
- AI temperature set to 0.3 (low creativity, high determinism)
- Forces the model to stick closely to the source text

### Layer 3: JSON Schema Enforcement
- Zod validation ensures output matches expected structure
- Required fields: type, question_text, options, required
- Optional: sourceContext for traceability

### Layer 4: Source Context Verification
- AI must provide sourceContext showing where in the document the question came from
- Post-processing checks that key phrases from sourceContext exist in original text
- 30% match threshold (allows for paraphrasing but catches hallucinations)

### Layer 5: Graceful Degradation
- If document lacks sufficient content, AI generates fewer questions rather than fabricating
- User is notified: "Only X questions could be generated from available content"
- This is a FEATURE, not a bug - proves the anti-hallucination system is working

---

## 📊 Testing Strategy

### Unit Tests (Recommended)

```typescript
// 1. File Parsing Tests
describe('Text Extraction', () => {
  test('PDF extraction returns text', async () => {
    const pdfBuffer = fs.readFileSync('test.pdf');
    const result = await extractTextFromFile(pdfBuffer, 'test.pdf');
    expect(result.text.length).toBeGreaterThan(0);
  });
  
  test('DOCX extraction returns text', async () => {
    const docxBuffer = fs.readFileSync('test.docx');
    const result = await extractTextFromFile(docxBuffer, 'test.docx');
    expect(result.text.length).toBeGreaterThan(0);
  });
});

// 2. Text Chunking Tests
describe('Text Chunking', () => {
  test('chunks maintain context with overlap', () => {
    const text = 'A'.repeat(5000);
    const chunks = chunkText(text, 2000, 500);
    expect(chunks.length).toBeGreaterThan(1);
    // Verify overlap
    expect(chunks[0].slice(-500)).toBe(chunks[1].slice(0, 500));
  });
});

// 3. Schema Validation Tests
describe('Question Validation', () => {
  test('valid questions pass schema', () => {
    const validQuestions = [{
      type: 'choice',
      question_text: 'What is the main finding?',
      options: ['A', 'B', 'C'],
      required: true
    }];
    const result = GeneratedQuestionSchema.safeParse(validQuestions);
    expect(result.success).toBe(true);
  });
  
  test('invalid questions fail schema', () => {
    const invalidQuestions = [{
      type: 'invalid_type', // Invalid
      question_text: 'Test',
      options: null,
      required: true
    }];
    const result = GeneratedQuestionSchema.safeParse(invalidQuestions);
    expect(result.success).toBe(false);
  });
});
```

### Integration Tests (Recommended)

```typescript
// 4. End-to-End Hallucination Test
describe('Anti-Hallucination', () => {
  test('AI does not generate questions for insufficient content', async () => {
    const shortText = ['This is a very short document.'];
    const config = { questionCount: 10, questionTypes: { multipleChoice: true }, complexity: 'research', strictGrounding: true };
    
    const response = await request(app)
      .post('/api/generate-questions')
      .send({ text: shortText, config, fileName: 'test.txt' });
    
    expect(response.body.questions.length).toBeLessThan(10);
    expect(response.body.meta.requested).toBe(10);
    expect(response.body.meta.generated).toBeLessThan(10);
  });
  
  test('grounding check filters hallucinated questions', async () => {
    // Mock AI response with hallucinated source context
    const mockAIResponse = [{
      type: 'choice',
      question_text: 'What is XYZ theory?', // XYZ not in document
      options: ['A', 'B', 'C'],
      required: true,
      sourceContext: 'The XYZ theory was developed in 2025 by Dr. Smith' // Fabricated
    }];
    
    // Grounding check should filter this out
    const filtered = mockAIResponse.filter(q => {
      const keyPhrases = q.sourceContext.toLowerCase().split(' ').filter(w => w.length > 4);
      const matchCount = keyPhrases.filter(phrase => 
        'This is a very short document.'.toLowerCase().includes(phrase)
      ).length;
      return (matchCount / keyPhrases.length) > 0.3;
    });
    
    expect(filtered.length).toBe(0);
  });
});
```

### Manual Testing Checklist

- [ ] Upload a 10MB PDF document
- [ ] Upload a DOCX with images (verify text extraction works)
- [ ] Upload a TXT file with UTF-8 characters
- [ ] Generate questions with strict grounding ON (verify fewer questions than requested for short docs)
- [ ] Generate questions with strict grounding OFF (may generate more, potentially hallucinated)
- [ ] Test with "Academic", "Research-Grade", and "Analytical" complexity settings
- [ ] Verify all question types appear in output when enabled
- [ ] Verify sourceContext is present and verifiable
- [ ] Test error handling: no API key, rate limit, quota exceeded

---

## 🔧 Installation & Setup

### 1. Install Dependencies

```bash
npm install openai pdf-parse mammoth zod
```

### 2. Environment Variables

Add to your `.env` file:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
```

Get your API key at: https://platform.openai.com/api-keys

### 3. Deploy Environment Variable

For production deployment (Render, Vercel, etc.), add `OPENAI_API_KEY` to your environment variables in the dashboard.

---

## 📁 File Structure

```
src/
├── components/
│   └── DocumentQuestionGenerator.tsx    # Main frontend component
├── pages/
│   └── admin/
│       └── SurveyBuilder.tsx           # Integration example
└── lib/
    └── database.types.ts               # TypeScript types

server.js                                # Backend API routes
.env.example                             # Environment template
AI_QUESTION_GENERATOR.md                 # This documentation
```

---

## 🔌 API Reference

### POST `/api/upload-document`

**Request**: `multipart/form-data` with file field

**Response**:
```json
{
  "success": true,
  "text": "extracted text content...",
  "chunks": ["chunk1...", "chunk2..."],
  "meta": {
    "fileName": "document.pdf",
    "fileType": "application/pdf",
    "size": 1024567,
    "pageCount": 15,
    "charCount": 45000,
    "chunkCount": 12
  }
}
```

### POST `/api/generate-questions`

**Request Body**:
```json
{
  "text": ["chunk1...", "chunk2..."],
  "config": {
    "questionTypes": {
      "multipleChoice": true,
      "boolean": true,
      "shortAnswer": true,
      "likert": true
    },
    "questionCount": 10,
    "complexity": "research",
    "strictGrounding": true
  },
  "fileName": "document.pdf"
}
```

**Response**:
```json
{
  "success": true,
  "questions": [
    {
      "type": "choice",
      "question_text": "What is the primary research question addressed in this paper?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "required": true,
      "sourceContext": "This paper investigates the relationship between..."
    }
  ],
  "meta": {
    "requested": 10,
    "generated": 8,
    "usedTokens": 2847,
    "model": "gpt-4-turbo-preview"
  }
}
```

---

## 💡 Usage Tips

### Best Practices

1. **Use Research-Grade Complexity** for academic papers
2. **Keep Strict Grounding ON** unless you have a specific reason
3. **Upload complete documents** - partial documents may result in questions about missing context
4. **Review sourceContext** for each question to verify grounding
5. **Start with 5-10 questions** for better quality over quantity

### Optimizing Results

- **For better multiple choice**: Ensure document has clear factual statements
- **For better Likert scales**: Use documents with evaluative claims or methodologies
- **For short answer**: Documents with explanatory content work best
- **Chunk size**: The default 4,000 char chunks work well for most research papers

### Cost Considerations

- Uses GPT-4 Turbo which is cost-effective
- Typical cost: ~$0.01-0.05 per document (varies by length)
- Set usage limits in OpenAI dashboard to prevent unexpected charges

---

## 🐛 Troubleshooting

### Common Issues

**"AI service quota exceeded"**
- You've hit OpenAI rate limits. Wait a moment and try again.
- Check your OpenAI billing dashboard.

**"Could not extract text from document"**
- PDF may be scanned images (not text-based)
- Try converting to TXT or DOCX first
- Check if PDF is password-protected

**"No questions could be generated"**
- Document may be too short or lack substantive content
- Try a longer document or reduce question count
- Check if strict grounding is too aggressive for this document

**Questions seem hallucinated**
- Verify strict grounding is enabled in config
- Check sourceContext fields in generated questions
- Report to maintainers if grounding check is failing

---

## 🔮 Future Enhancements

- [ ] Support for scanned PDFs (OCR integration)
- [ ] Support for additional formats (EPUB, HTML, Markdown)
- [ ] Question deduplication across chunks
- [ ] Custom prompt templates for specific domains
- [ ] Batch processing multiple documents
- [ ] Export generated questions as JSON/CSV
- [ ] Integration with other LLM providers (Claude, Gemini)

---

## 📝 Changelog

### v1.0.0 (Initial Release)
- PDF, DOCX, TXT file upload and parsing
- Intelligent text chunking with overlap
- AI question generation with GPT-4
- Strict grounding to prevent hallucination
- Multiple question type support
- SurveyBuilder integration
- Zod schema validation
- Source context verification

---

**Built for Q-Dash | Research-Grade Survey Platform**
