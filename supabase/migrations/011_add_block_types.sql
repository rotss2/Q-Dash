-- Migration: Add block types and section support for structured surveys
-- Fixes: Auto-numbering errors, analytics pollution, hardcoded sections

-- Step 1: Create question_sections table FIRST (before referencing it)
CREATE TABLE IF NOT EXISTS question_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Step 2: Add block_type column to questions
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS block_type TEXT NOT NULL DEFAULT 'question' 
CHECK (block_type IN ('question', 'heading', 'instruction', 'page_break'));

-- Step 3: Add section_id for grouping (table now exists)
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES question_sections(id);

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_questions_block_type ON questions(block_type);
CREATE INDEX IF NOT EXISTS idx_questions_section ON questions(survey_id, section_id, order_index);
CREATE INDEX IF NOT EXISTS idx_sections_survey ON question_sections(survey_id, order_index);

-- Step 5: Update existing data - mark all existing as 'question'
UPDATE questions SET block_type = 'question' WHERE block_type IS NULL;

-- Step 6: Add comment for documentation
COMMENT ON COLUMN questions.block_type IS 'Type of block: question (numbered, requires answer), heading (section title), instruction (info text), page_break';
COMMENT ON COLUMN questions.section_id IS 'Groups questions into sections/pages for pagination';
