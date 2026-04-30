-- Migration: Scheduling Engine
-- Adds database functions and triggers for automatic survey scheduling

-- Function to auto-open surveys when open_date is reached
CREATE OR REPLACE FUNCTION auto_open_surveys()
RETURNS void AS $$
BEGIN
    UPDATE surveys 
    SET status = 'open'
    WHERE status = 'closed' 
      AND open_date IS NOT NULL 
      AND open_date <= NOW();
    
    -- Log how many were opened
    RAISE NOTICE 'Auto-opened % surveys', (SELECT COUNT(*) FROM surveys 
                                           WHERE status = 'open' 
                                             AND open_date IS NOT NULL 
                                             AND open_date <= NOW()
                                             AND open_date > NOW() - INTERVAL '1 minute');
END;
$$ LANGUAGE plpgsql;

-- Function to auto-close surveys when close_date is reached
CREATE OR REPLACE FUNCTION auto_close_surveys()
RETURNS void AS $$
BEGIN
    UPDATE surveys 
    SET status = 'closed'
    WHERE status = 'open' 
      AND close_date IS NOT NULL 
      AND close_date <= NOW();
    
    -- Log how many were closed
    RAISE NOTICE 'Auto-closed % surveys', (SELECT COUNT(*) FROM surveys 
                                           WHERE status = 'closed' 
                                             AND close_date IS NOT NULL 
                                             AND close_date <= NOW()
                                             AND close_date > NOW() - INTERVAL '1 minute');
END;
$$ LANGUAGE plpgsql;

-- Combined scheduler function that runs both operations
CREATE OR REPLACE FUNCTION run_survey_scheduler()
RETURNS TABLE(
    opened_count integer,
    closed_count integer,
    processed_at timestamp with time zone
) AS $$
DECLARE
    v_opened integer;
    v_closed integer;
BEGIN
    -- Count before changes
    SELECT COUNT(*) INTO v_opened FROM surveys 
    WHERE status = 'closed' 
      AND open_date IS NOT NULL 
      AND open_date <= NOW();
      
    SELECT COUNT(*) INTO v_closed FROM surveys 
    WHERE status = 'open' 
      AND close_date IS NOT NULL 
      AND close_date <= NOW();
    
    -- Perform updates
    PERFORM auto_open_surveys();
    PERFORM auto_close_surveys();
    
    RETURN QUERY SELECT v_opened, v_closed, NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a table to track scheduler runs (for monitoring)
CREATE TABLE IF NOT EXISTS scheduler_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opened_count INTEGER DEFAULT 0,
    closed_count INTEGER DEFAULT 0,
    run_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function that logs scheduler runs
CREATE OR REPLACE FUNCTION run_scheduled_survey_updates()
RETURNS TRIGGER AS $$
DECLARE
    result RECORD;
BEGIN
    SELECT * INTO result FROM run_survey_scheduler();
    
    INSERT INTO scheduler_logs (opened_count, closed_count, run_at)
    VALUES (result.opened_count, result.closed_count, result.processed_at);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comment explaining the scheduling mechanism
COMMENT ON FUNCTION run_survey_scheduler() IS 
'Scheduler function that automatically opens surveys when open_date is reached and closes surveys when close_date is reached.
This should be called by an external cron job or the application server every minute.';
