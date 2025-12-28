-- Create RPC function to get businesses with review stats for directory
-- This function is used by getAllPublicBusinessesForDirectory()

-- Drop existing function if it exists (required when changing return type)
DROP FUNCTION IF EXISTS get_businesses_with_review_stats();

-- Drop existing view/materialized view if it exists (in case we need to recreate it)
-- Try materialized view FIRST, then regular view
DROP MATERIALIZED VIEW IF EXISTS business_metrics CASCADE;
DROP VIEW IF EXISTS business_metrics CASCADE;

CREATE OR REPLACE FUNCTION get_businesses_with_review_stats()
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    category TEXT,
    country TEXT,
    logo_url TEXT,
    avg_rating NUMERIC,
    review_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id,
        b.name,
        b.description,
        b.category,
        b.country::TEXT,
        b.logo_url,
        COALESCE(AVG(r.rating), 0)::NUMERIC AS avg_rating,
        COUNT(r.id) FILTER (WHERE r.status = 'approved')::BIGINT AS review_count
    FROM
        businesses b
    LEFT JOIN
        reviews r ON b.id = r.business_id AND r.status = 'approved'
    GROUP BY
        b.id, b.name, b.description, b.category, b.country, b.logo_url
    ORDER BY
        review_count DESC,
        avg_rating DESC,
        b.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and anonymous
GRANT EXECUTE ON FUNCTION get_businesses_with_review_stats() TO authenticated, anon;

-- Create business_metrics materialized view for faster widget loading
CREATE MATERIALIZED VIEW IF NOT EXISTS business_metrics AS
SELECT
    b.id,
    COALESCE(AVG(r.rating), 0) AS avg_rating,
    COUNT(r.id) FILTER (WHERE r.status = 'approved') AS review_count
FROM
    businesses b
LEFT JOIN
    reviews r ON b.id = r.business_id AND r.status = 'approved'
GROUP BY
    b.id;

-- Create unique index on business_metrics for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_metrics_id ON business_metrics(id);

-- Create function to refresh business_metrics
CREATE OR REPLACE FUNCTION refresh_business_metrics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY business_metrics;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_business_metrics() TO authenticated;

-- Note: To keep business_metrics up to date, you can:
-- 1. Call refresh_business_metrics() manually when needed
-- 2. Set up a cron job to refresh it periodically
-- 3. Create triggers on reviews table to refresh on INSERT/UPDATE/DELETE

-- ========================================
-- PERFORMANCE OPTIMIZATION: Create indexes
-- ========================================

-- Index for reviews.business_id (speeds up JOIN)
CREATE INDEX IF NOT EXISTS idx_reviews_business_id_status
    ON reviews(business_id, status)
    WHERE status = 'approved';

-- Index for reviews.status (speeds up FILTER)
CREATE INDEX IF NOT EXISTS idx_reviews_status_approved
    ON reviews(status)
    WHERE status = 'approved';

-- Index for reviews.rating (speeds up AVG calculation)
CREATE INDEX IF NOT EXISTS idx_reviews_rating_business
    ON reviews(rating, business_id)
    WHERE status = 'approved';

-- Composite index for businesses (speeds up directory queries)
CREATE INDEX IF NOT EXISTS idx_businesses_country_category
    ON businesses(country, category);

-- Analyze tables to update statistics
ANALYZE businesses;
ANALYZE reviews;
