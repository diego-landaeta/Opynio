-- =============================================================================
-- businesses: slug de las empresas con URL problematica
-- 2026-10-20 (Opynio #4: enlaces sin tildes, mayusculas, emojis ni ideogramas)
--
-- Revisadas las 1.024 empresas con la API publica, solo 4 tienen un enlace malo:
--
--   Sin slug (el enlace cae al nombre con tildes y mayusculas):
--     - Auto Escuela Trébol   -> auto_escuela_trebol
--     - Diana cosméticos      -> diana_cosmeticos
--   Slug con emoji o ideogramas (URL tipo /empresa/via_brasil_boutique%E2%9C%A8):
--     - Via Brasil Boutique✨ : via_brasil_boutique✨ -> via_brasil_boutique
--     - CHILA 湘遇湖南菜      : chila_湘遇湖南菜      -> chila
--
-- Para las dos ultimas se guarda la redireccion del slug antiguo en url_redirects
-- (old_slug tal cual, sin codificar: BusinessPage busca con el identificador
-- decodificado), asi los enlaces ya compartidos o indexados siguen abriendo la ficha.
--
-- NO se tocan: gutec-university, podera-academy y gourclair-culinary-university
-- (guiones, no tienen ningun caracter problematico y ya estan compartidas).
--
-- Comprobado antes de escribir esto: ninguno de los 4 slugs nuevos existe ya.
-- Idempotente: cada UPDATE exige el slug antiguo y que el nuevo no exista; cada
-- redireccion exige que no exista ya.
--
-- Vuelta atras:
--   UPDATE public.businesses SET slug = NULL
--    WHERE id IN ('ab51b04c-7631-44de-8a7f-c6852ac8ef40', '0f4f50df-7d26-423e-82ba-4d89685421f7');
--   UPDATE public.businesses SET slug = 'via_brasil_boutique✨' WHERE id = '68515814-af07-4087-92da-8fd0a80e5827';
--   UPDATE public.businesses SET slug = 'chila_湘遇湖南菜'      WHERE id = '50e4fbff-57f8-4c0b-8173-a751096a402f';
--   DELETE FROM public.url_redirects
--    WHERE (business_id, old_slug) IN (('68515814-af07-4087-92da-8fd0a80e5827', 'via_brasil_boutique✨'),
--                                      ('50e4fbff-57f8-4c0b-8173-a751096a402f', 'chila_湘遇湖南菜'));
-- =============================================================================

-- 1. Empresas sin slug
UPDATE public.businesses
   SET slug = 'auto_escuela_trebol'
 WHERE id = 'ab51b04c-7631-44de-8a7f-c6852ac8ef40'
   AND slug IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.businesses WHERE slug = 'auto_escuela_trebol');

UPDATE public.businesses
   SET slug = 'diana_cosmeticos'
 WHERE id = '0f4f50df-7d26-423e-82ba-4d89685421f7'
   AND slug IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.businesses WHERE slug = 'diana_cosmeticos');

-- 2. Redireccion del enlace antiguo (antes de cambiar el slug)
INSERT INTO public.url_redirects (old_slug, business_id, hits)
SELECT v.old_slug, b.id, 0
  FROM public.businesses b
  JOIN (VALUES
          ('via_brasil_boutique✨', '68515814-af07-4087-92da-8fd0a80e5827'),
          ('chila_湘遇湖南菜',      '50e4fbff-57f8-4c0b-8173-a751096a402f')
       ) AS v(old_slug, business_id)
    ON b.id::text = v.business_id AND b.slug = v.old_slug
 WHERE NOT EXISTS (SELECT 1 FROM public.url_redirects r WHERE r.old_slug = v.old_slug);

-- 3. Slug limpio
UPDATE public.businesses
   SET slug = 'via_brasil_boutique'
 WHERE id = '68515814-af07-4087-92da-8fd0a80e5827'
   AND slug = 'via_brasil_boutique✨'
   AND NOT EXISTS (SELECT 1 FROM public.businesses WHERE slug = 'via_brasil_boutique');

UPDATE public.businesses
   SET slug = 'chila'
 WHERE id = '50e4fbff-57f8-4c0b-8173-a751096a402f'
   AND slug = 'chila_湘遇湖南菜'
   AND NOT EXISTS (SELECT 1 FROM public.businesses WHERE slug = 'chila');
