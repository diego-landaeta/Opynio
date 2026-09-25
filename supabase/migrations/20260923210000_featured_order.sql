-- =============================================================================
-- Orden de las empresas destacadas. 2026-09-23
--
-- /admin/destacados deja arrastrar para reordenar, pero no habia donde guardar
-- el orden: se perdia al guardar (el admin lista por nombre) y la home ademas
-- barajaba al azar. featured_order lo guarda; solo admin/service_role lo cambia
-- (esta en la lista protegida de guard_business_sensitive_columns).
-- =============================================================================
BEGIN;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS featured_order integer;
CREATE INDEX IF NOT EXISTS idx_businesses_featured_order
  ON public.businesses (featured_order) WHERE is_featured;
COMMIT;
