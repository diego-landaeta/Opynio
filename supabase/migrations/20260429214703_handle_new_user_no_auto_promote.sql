-- =============================================================================
-- handle_new_user — no auto-promote, no auto-create business
-- =============================================================================
-- La versión anterior de este trigger leía `raw_user_meta_data ->> 'role'` y, si
-- valía 'business_owner', insertaba directamente un negocio con campos NULL
-- (porque signUpBusiness nunca mandó `businessName`/`country` en metadata) y
-- promovía el rol antes de que el usuario completara el formulario.
--
-- El nuevo trigger es deliberadamente mudo: siempre crea el profile como
-- 'authenticated' y nunca toca `businesses`. La promoción a business_owner +
-- creación del negocio la hace ahora explícitamente:
--   • CompleteBusinessRegistrationPage → RPC public.upgrade_user_to_business_owner
--     (planes free/enterprise)
--   • Webhook de Stripe → checkout.session.completed (planes pagos)
--
-- Bonus: el campo `name` ahora prefiere `full_name` (que es lo que envían
-- signUpUser/signUpBusiness en supabaseService.ts) y cae a `name` si no existe.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, role, username, plan)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      'Nuevo Usuario'
    ),
    'authenticated'::public.user_role,
    new.raw_user_meta_data ->> 'username',
    'free'
  );
  RETURN new;
END;
$function$;
