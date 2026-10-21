-- Limpia los espacios sobrantes al principio o al final del nombre de 3 empresas
-- (ISEIH, ISEIM y Nutricionista IA). Antes obligaban a resolver sus fichas por
-- nombre con espacios; el front ya lo tolera, esto solo deja los datos limpios.
--
-- Salvaguarda: ninguna URL puede cambiar. Si el UPDATE (o un trigger de
-- normalizacion) modificara algun slug, se aborta y no se aplica nada.
--
-- Copia previa de los nombres: backup-businesses-nombres.json
-- Marcha atras: restaurar name desde esa copia (los ids estan en el fichero).

DO $$
DECLARE
  antes   jsonb;
  despues jsonb;
  tocadas integer;
BEGIN
  SELECT coalesce(jsonb_object_agg(id::text, slug), '{}'::jsonb) INTO antes
    FROM public.businesses WHERE name <> btrim(name);

  UPDATE public.businesses SET name = btrim(name) WHERE name <> btrim(name);
  GET DIAGNOSTICS tocadas = ROW_COUNT;

  SELECT coalesce(jsonb_object_agg(id::text, slug), '{}'::jsonb) INTO despues
    FROM public.businesses WHERE id::text IN (SELECT jsonb_object_keys(antes));

  IF antes IS DISTINCT FROM despues THEN
    RAISE EXCEPTION 'btrim_business_names: cambiaria algun slug (%) -> %', antes, despues;
  END IF;
  RAISE NOTICE 'btrim_business_names: % filas limpiadas, slugs intactos', tocadas;
END $$;
