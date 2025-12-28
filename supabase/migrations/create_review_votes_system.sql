-- =====================================================
-- REVIEW VOTES SYSTEM - Complete Implementation
-- =====================================================
-- This script creates a proper voting system for reviews
-- with vote tracking and automatic counter updates

-- 1. Create the review_votes table
-- =====================================================
CREATE TABLE IF NOT EXISTS review_votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one vote per user per review
  UNIQUE(review_id, user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_review_votes_review_id ON review_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_user_id ON review_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_is_helpful ON review_votes(is_helpful);

-- Add comments
COMMENT ON TABLE review_votes IS 'Stores user votes (helpful/not helpful) for reviews';
COMMENT ON COLUMN review_votes.is_helpful IS 'true = helpful vote, false = not helpful vote';

-- 2. Add helpful_votes and not_helpful_votes columns to reviews table if they don't exist
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'helpful_votes'
  ) THEN
    ALTER TABLE reviews ADD COLUMN helpful_votes INTEGER DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'not_helpful_votes'
  ) THEN
    ALTER TABLE reviews ADD COLUMN not_helpful_votes INTEGER DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN reviews.helpful_votes IS 'Number of helpful votes for this review';
COMMENT ON COLUMN reviews.not_helpful_votes IS 'Number of not helpful votes for this review';

-- 3. Create function to update vote counts
-- =====================================================
CREATE OR REPLACE FUNCTION update_review_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Count helpful and not helpful votes for the review
  UPDATE reviews
  SET
    helpful_votes = (
      SELECT COUNT(*)
      FROM review_votes
      WHERE review_id = COALESCE(NEW.review_id, OLD.review_id)
        AND is_helpful = true
    ),
    not_helpful_votes = (
      SELECT COUNT(*)
      FROM review_votes
      WHERE review_id = COALESCE(NEW.review_id, OLD.review_id)
        AND is_helpful = false
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.review_id, OLD.review_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 4. Create triggers to automatically update vote counts
-- =====================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_review_votes_on_insert ON review_votes;
DROP TRIGGER IF EXISTS trigger_update_review_votes_on_update ON review_votes;
DROP TRIGGER IF EXISTS trigger_update_review_votes_on_delete ON review_votes;

-- Trigger on INSERT
CREATE TRIGGER trigger_update_review_votes_on_insert
  AFTER INSERT ON review_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_review_vote_counts();

-- Trigger on UPDATE
CREATE TRIGGER trigger_update_review_votes_on_update
  AFTER UPDATE ON review_votes
  FOR EACH ROW
  WHEN (OLD.is_helpful IS DISTINCT FROM NEW.is_helpful)
  EXECUTE FUNCTION update_review_vote_counts();

-- Trigger on DELETE
CREATE TRIGGER trigger_update_review_votes_on_delete
  AFTER DELETE ON review_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_review_vote_counts();

-- 5. Set up Row Level Security (RLS)
-- =====================================================

-- Enable RLS on review_votes table
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view votes
CREATE POLICY "Anyone can view review votes"
  ON review_votes
  FOR SELECT
  TO public
  USING (true);

-- Policy: Authenticated users can insert their own votes
CREATE POLICY "Authenticated users can insert their own votes"
  ON review_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own votes
CREATE POLICY "Users can update their own votes"
  ON review_votes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own votes
CREATE POLICY "Users can delete their own votes"
  ON review_votes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. Create helper function to get user's vote on a review
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_vote_on_review(p_review_id UUID, p_user_id UUID)
RETURNS TABLE (
  has_voted BOOLEAN,
  is_helpful BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXISTS(SELECT 1 FROM review_votes WHERE review_id = p_review_id AND user_id = p_user_id) AS has_voted,
    COALESCE((SELECT rv.is_helpful FROM review_votes rv WHERE rv.review_id = p_review_id AND rv.user_id = p_user_id), NULL) AS is_helpful;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Initialize vote counts for existing reviews
-- =====================================================
-- This ensures that any existing reviews have their vote counts set to 0
UPDATE reviews
SET
  helpful_votes = COALESCE(helpful_votes, 0),
  not_helpful_votes = COALESCE(not_helpful_votes, 0)
WHERE helpful_votes IS NULL OR not_helpful_votes IS NULL;

-- 8. Grant necessary permissions
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON review_votes TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- The review voting system is now fully configured with:
-- ✓ review_votes table for tracking individual votes
-- ✓ Automatic vote count updates via triggers
-- ✓ Row Level Security policies
-- ✓ Helper functions for querying vote status
-- ✓ Proper indexes for performance
