-- Add anti-cheating toggle column to surveys table
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS anti_cheating_enabled BOOLEAN DEFAULT false;

-- Add comment explaining the feature
COMMENT ON COLUMN surveys.anti_cheating_enabled IS 'When enabled, prevents screenshots, copying, tab switching, and adds traceable watermarks';
