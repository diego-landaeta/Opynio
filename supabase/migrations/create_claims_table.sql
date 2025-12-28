-- =====================================================
-- CLAIMS TABLE MIGRATION
-- =====================================================
-- This migration creates the claims table if it doesn't exist
-- and ensures all required columns are present

-- STEP 1: Create claims table if not exists
-- =====================================================
CREATE TABLE IF NOT EXISTS claims (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  user_id UUID NOT NULL,
  business_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'in_review', 'approved', 'rejected')),
  opynio_url TEXT,
  user_provided_info JSONB,
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);

-- Add foreign keys with explicit names
ALTER TABLE claims
  DROP CONSTRAINT IF EXISTS claims_user_id_fkey,
  ADD CONSTRAINT claims_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

ALTER TABLE claims
  DROP CONSTRAINT IF EXISTS claims_resolved_by_fkey,
  ADD CONSTRAINT claims_resolved_by_fkey
    FOREIGN KEY (resolved_by)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

-- STEP 2: Create indexes for better query performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_claims_user_id ON claims(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_business_id ON claims(business_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_created_at ON claims(created_at DESC);

-- STEP 3: Enable Row Level Security (RLS)
-- =====================================================
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create RLS Policies
-- =====================================================

-- Policy: Users can view their own claims
DROP POLICY IF EXISTS "Users can view own claims" ON claims;
CREATE POLICY "Users can view own claims"
  ON claims FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create their own claims
DROP POLICY IF EXISTS "Users can create claims" ON claims;
CREATE POLICY "Users can create claims"
  ON claims FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all claims
DROP POLICY IF EXISTS "Admins can view all claims" ON claims;
CREATE POLICY "Admins can view all claims"
  ON claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can update claims
DROP POLICY IF EXISTS "Admins can update claims" ON claims;
CREATE POLICY "Admins can update claims"
  ON claims FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- STEP 5: Add helpful comments
-- =====================================================
COMMENT ON TABLE claims IS 'Stores business ownership claims from users';
COMMENT ON COLUMN claims.user_provided_info IS 'JSON object containing websiteUrl, phone, and comments for verification';
COMMENT ON COLUMN claims.status IS 'Claim status: pending, in_review, approved, or rejected';
COMMENT ON COLUMN claims.resolved_by IS 'Admin user ID who resolved the claim';
