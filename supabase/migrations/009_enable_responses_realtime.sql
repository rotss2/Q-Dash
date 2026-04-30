-- Enable Realtime for responses table
-- This allows the live feed to show responses as they come in

-- Add responses table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE responses;

-- Verify it's enabled
SELECT 
    schemaname,
    tablename,
    pubname
FROM pg_publication_tables
WHERE tablename = 'responses';
