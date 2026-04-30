-- Migration: Fix Schema Cache Issues
-- Run this in Supabase SQL Editor if you encounter 'column not found in schema cache' errors

-- Ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add close_date column if it doesn't exist (for surveys table)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'surveys' AND column_name = 'close_date'
    ) THEN
        ALTER TABLE surveys ADD COLUMN close_date TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added close_date column to surveys table';
    ELSE
        RAISE NOTICE 'close_date column already exists';
    END IF;
END $$;

-- Add open_date column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'surveys' AND column_name = 'open_date'
    ) THEN
        ALTER TABLE surveys ADD COLUMN open_date TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added open_date column to surveys table';
    ELSE
        RAISE NOTICE 'open_date column already exists';
    END IF;
END $$;

-- Add theme_color column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'surveys' AND column_name = 'theme_color'
    ) THEN
        ALTER TABLE surveys ADD COLUMN theme_color TEXT;
        RAISE NOTICE 'Added theme_color column to surveys table';
    END IF;
END $$;

-- Add logo_url column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'surveys' AND column_name = 'logo_url'
    ) THEN
        ALTER TABLE surveys ADD COLUMN logo_url TEXT;
        RAISE NOTICE 'Added logo_url column to surveys table';
    END IF;
END $$;

-- Add default_language column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'surveys' AND column_name = 'default_language'
    ) THEN
        ALTER TABLE surveys ADD COLUMN default_language TEXT;
        RAISE NOTICE 'Added default_language column to surveys table';
    END IF;
END $$;

-- Add supported_languages column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'surveys' AND column_name = 'supported_languages'
    ) THEN
        ALTER TABLE surveys ADD COLUMN supported_languages TEXT[];
        RAISE NOTICE 'Added supported_languages column to surveys table';
    END IF;
END $$;

-- Add missing columns to questions table (if needed)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'question_group_id'
    ) THEN
        ALTER TABLE questions ADD COLUMN question_group_id UUID DEFAULT uuid_generate_v4();
        RAISE NOTICE 'Added question_group_id column to questions table';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'version'
    ) THEN
        ALTER TABLE questions ADD COLUMN version INTEGER DEFAULT 1;
        RAISE NOTICE 'Added version column to questions table';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE questions ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added is_active column to questions table';
    END IF;
END $$;

-- Add show_when_question_id column for conditional logic
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'show_when_question_id'
    ) THEN
        ALTER TABLE questions ADD COLUMN show_when_question_id UUID REFERENCES questions(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added show_when_question_id column to questions table';
    END IF;
END $$;

-- Add show_when_answer_value column for conditional logic
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'show_when_answer_value'
    ) THEN
        ALTER TABLE questions ADD COLUMN show_when_answer_value TEXT;
        RAISE NOTICE 'Added show_when_answer_value column to questions table';
    END IF;
END $$;

-- Verify all expected columns exist
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name IN ('surveys', 'questions', 'responses', 'profiles')
ORDER BY table_name, ordinal_position;
