-- =====================================================
-- FIX CLAIMS FOREIGN KEYS
-- =====================================================
-- This migration fixes the foreign key naming to resolve
-- the "more than one relationship" error in Supabase queries

-- Drop existing foreign key constraints (if they have auto-generated names)
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Find and drop all foreign key constraints on user_id and resolved_by
    FOR constraint_record IN
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'claims'
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name LIKE '%user_id%'
    LOOP
        EXECUTE 'ALTER TABLE claims DROP CONSTRAINT IF EXISTS ' || constraint_record.constraint_name;
    END LOOP;

    FOR constraint_record IN
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'claims'
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name LIKE '%resolved_by%'
    LOOP
        EXECUTE 'ALTER TABLE claims DROP CONSTRAINT IF EXISTS ' || constraint_record.constraint_name;
    END LOOP;
END $$;

-- Add foreign keys with explicit, predictable names
-- Note: user_id and resolved_by reference profiles.id (which is the same as auth.users.id)
ALTER TABLE claims
  ADD CONSTRAINT claims_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE;

ALTER TABLE claims
  ADD CONSTRAINT claims_resolved_by_fkey
    FOREIGN KEY (resolved_by)
    REFERENCES profiles(id)
    ON DELETE SET NULL;

-- Also add FK for business_id if it doesn't exist
ALTER TABLE claims
  DROP CONSTRAINT IF EXISTS claims_business_id_fkey;

ALTER TABLE claims
  ADD CONSTRAINT claims_business_id_fkey
    FOREIGN KEY (business_id)
    REFERENCES businesses(id)
    ON DELETE CASCADE;

-- Verify the constraints were created
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
  AND tc.table_name = 'claims';
