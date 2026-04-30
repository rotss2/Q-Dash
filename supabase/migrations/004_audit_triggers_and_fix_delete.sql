-- CRITICAL: Audit and Fix Delete Persistence
-- Check for triggers, soft-delete columns, and foreign key constraints

-- 1. Check if surveys table has deleted_at (soft delete) column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'surveys' AND column_name = 'deleted_at'
    ) THEN
        RAISE NOTICE 'No deleted_at column found - hard delete should work';
    ELSE
        RAISE WARNING 'deleted_at column exists - soft delete logic may be interfering!';
    END IF;
END $$;

-- 2. Check for triggers on surveys table that might prevent delete
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'surveys';

-- 3. Check foreign key constraints that might block delete
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND ccu.table_name = 'surveys';

-- 4. Create a proper cascade delete function
CREATE OR REPLACE FUNCTION cascade_delete_survey()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete all responses for this survey
    DELETE FROM responses WHERE survey_id = OLD.id;
    
    -- Delete all questions for this survey
    DELETE FROM questions WHERE survey_id = OLD.id;
    
    -- Return the old record to allow the delete to proceed
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger to cascade delete (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'cascade_delete_survey_trigger'
    ) THEN
        CREATE TRIGGER cascade_delete_survey_trigger
            BEFORE DELETE ON surveys
            FOR EACH ROW
            EXECUTE FUNCTION cascade_delete_survey();
        RAISE NOTICE 'Created cascade delete trigger';
    ELSE
        RAISE NOTICE 'Cascade delete trigger already exists';
    END IF;
END $$;

-- 6. Verify RLS is properly disabled or policies allow delete
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE tablename = 'surveys' AND cmd = 'DELETE';

-- 7. Add explicit delete policy for service role if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'surveys' 
        AND policyname = 'Service role delete bypass'
    ) THEN
        CREATE POLICY "Service role delete bypass" 
        ON surveys FOR DELETE 
        TO service_role 
        USING (true);
        RAISE NOTICE 'Created service role delete bypass policy';
    END IF;
END $$;

-- 8. Test delete by creating and immediately deleting a test survey (manual verification)
-- Uncomment to run test:
/*
WITH test_insert AS (
    INSERT INTO surveys (title, admin_id, status, total_responses)
    VALUES ('__TEST_DELETE_ME__', 'c6ae1256-0bda-4a98-8fcc-8765446f9d32', 'closed', 0)
    RETURNING id
)
SELECT id FROM test_insert;

-- Then manually delete and check if it persists:
-- DELETE FROM surveys WHERE title = '__TEST_DELETE_ME__';
-- SELECT * FROM surveys WHERE title = '__TEST_DELETE_ME__';  -- Should return 0 rows
*/

-- Summary: Show current state
SELECT 'Surveys table RLS status:' as info, 
       (SELECT relrowsecurity FROM pg_class WHERE relname = 'surveys') as rls_enabled;
