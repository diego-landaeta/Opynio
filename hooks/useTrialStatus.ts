import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseService';
import { NEW_PRICING_ENABLED } from '../utils/planPrices';

// Estado de la prueba gratuita del usuario («Prueba gratuita: te quedan X dias»).
//
// De donde sale el dato: la tabla `subscriptions` (la rellena el webhook de
// Stripe) con status = 'trialing'. Mientras dura la prueba, Stripe pone
// current_period_end = trial_end, y el webhook ya lo guarda en
// subscriptions.current_period_end, asi que no hace falta columna nueva.
// Depende de la politica RLS «Users can view own subscriptions» (SELECT del
// propio usuario, docs/04-STRIPE-INTEGRATION.md seccion 1). Si la lectura falla
// o no hay fila trialing, devuelve null y la web no muestra nada de prueba:
// nunca se inventa un dato.
//
// Con NEW_PRICING_ENABLED apagado no consulta nada.

export type TrialInfo = {
  /** Fin de la prueba = fecha del primer cobro. */
  endsAt: Date;
  /** Dias que quedan, redondeado hacia arriba (minimo 0). */
  daysLeft: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function useTrialStatus(): TrialInfo | null {
  const { user, profile } = useAuth();
  const [info, setInfo] = useState<TrialInfo | null>(null);
  const userId = user?.id ?? null;
  const planKey = profile?.plan ?? null;

  useEffect(() => {
    if (!NEW_PRICING_ENABLED || !userId || !planKey || planKey === 'free') {
      setInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('current_period_end')
          .eq('user_id', userId)
          .eq('status', 'trialing')
          .order('current_period_end', { ascending: false })
          .limit(1);
        if (cancelled) return;
        const raw = !error && data && data.length > 0 ? (data[0] as { current_period_end?: string | null }).current_period_end : null;
        const end = raw ? new Date(raw) : null;
        if (!end || Number.isNaN(end.getTime())) {
          setInfo(null);
          return;
        }
        setInfo({ endsAt: end, daysLeft: Math.max(0, Math.ceil((end.getTime() - Date.now()) / DAY_MS)) });
      } catch {
        if (!cancelled) setInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, planKey]);

  return info;
}
