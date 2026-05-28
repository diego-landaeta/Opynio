-- Garantiza que cada usuario pueda dejar como máximo 1 reseña por empresa.
--
-- Excluye dos casos del UNIQUE:
--   1. user_id IS NULL: reseñas anónimas/importadas (se identifican con
--      original_author_name). Pueden coexistir múltiples por empresa.
--   2. user_id = 'c741a0e5-6751-4fbe-b6d9-de73a50d857e' (diego.a.programmer@gmail.com):
--      cuenta histórica de seeding con 361 pares (user, business) duplicados
--      anteriores a esta regla. La excepción es deuda técnica; si en el futuro se
--      limpia o se desactiva ese seeder, retirar esta cláusula y rehacer el índice.

CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_per_user_business
ON public.reviews (user_id, business_id)
WHERE user_id IS NOT NULL
  AND user_id <> 'c741a0e5-6751-4fbe-b6d9-de73a50d857e'::uuid;
