-- Explorar (getPublicReviews): reseñas aprobadas por fecha, filtradas por país o
-- categoría de la empresa. Sin este índice la consulta leía las ~50.000 reseñas para
-- quedarse con 10 y pasaba del statement_timeout de anon (3 s) en producción.
-- Con él recorre el índice en orden y para al llenar la página (~1 ms en la réplica).
-- CONCURRENTLY: no bloquea escrituras; no puede ir dentro de una transacción.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_approved_created_desc
  ON public.reviews (created_at DESC, id)
  WHERE status = 'approved';
