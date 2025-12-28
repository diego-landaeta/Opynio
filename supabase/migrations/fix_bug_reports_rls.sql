-- Fix bug_reports table structure and policies

-- Delete all existing bug reports (they were test data anyway)
DELETE FROM bug_reports;

-- Drop the old constraint if it exists
ALTER TABLE bug_reports DROP CONSTRAINT IF EXISTS bug_reports_status_check;

-- Add the correct constraint with the right values
ALTER TABLE bug_reports ADD CONSTRAINT bug_reports_status_check
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));

-- Set default value for status
ALTER TABLE bug_reports ALTER COLUMN status SET DEFAULT 'open';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create bug reports" ON bug_reports;
DROP POLICY IF EXISTS "Users can view own bug reports" ON bug_reports;
DROP POLICY IF EXISTS "Admins can manage all bug reports" ON bug_reports;

-- Create new policies
CREATE POLICY "Users can create bug reports"
    ON bug_reports FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own bug reports"
    ON bug_reports FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all bug reports"
    ON bug_reports FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
