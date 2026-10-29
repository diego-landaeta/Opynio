import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseService';
import { NEW_PRICING_ENABLED } from '../utils/planPrices';

// Estado de la prueba gratuita del usuario («Prueba gratuita: te quedan X dias»).
//
// Hay dos pruebas:
//  - 'stripe': la del checkout con tarjeta. El dato sale de la tabla `subscriptions`
//    (la rellena el webhook de Stripe) con status = 'trialing'. Mientras dura la
//    prueba, Stripe pone current_period_end = trial_end, y el webhook ya lo guarda en
//    subscriptions.current_period_end. Depende de la politica RLS «Users can view own
//    subscriptions» (SELECT del propio usuario, docs/04-STRIPE-INTEGRATION.md seccion 1).
//  - 'noCard': la de 90 dias sin tarjeta que se concede al crear o reclamar la primera
//    empresa (issue #11, migracion 20261029100000). El plan sigue en 'free' y el fin
//    esta en profiles.trial_full_access_until.
// Si la lectura falla o no hay prueba, devuelve null y la web no muestra nada de
// prueba: nunca se inventa un dato.
//
// Con NEW_PRICING_ENABLED apagado no consulta nada.

export type TrialInfo = {
  /** Fin de la prueba: fecha del primer cobro ('stripe') o del fin del acceso completo ('noCard'). */
  endsAt: Date;
  /** Dias que quedan, redondeado hacia arriba (minimo 0). */
  daysLeft: number;
  /** De que prueba se trata (ver arriba). */
  kind: 'stripe' | 'noCard';
};

const DAY_MS = 24 * 60 * 60 * 1000;

const daysUntil = (end: Date): number => Math.max(0, Math.ceil((end.getTime() - Date.now()) / DAY_MS));

export function useTrialStatus(): TrialInfo | null {
  const { user, profile } = useAuth();
  const [info, setInfo] = useState<TrialInfo | null>(null);
  const userId = user?.id ?? null;
  const planKey = profile?.plan ?? null;
  const trialUntil = profile?.trial_full_access_until ?? null;

  useEffect(() => {
    if (!NEW_PRICING_ENABLED || !userId) {
      setInfo(null);
      return;
    }
    // Plan gratuito: solo puede estar en la prueba sin tarjeta.
    if (!planKey || planKey === 'free') {
      const end = trialUntil ? new Date(trialUntil) : null;
      setInfo(end && !Number.isNaN(end.getTime()) && end.getTime() > Date.now()
        ? { endsAt: end, daysLeft: daysUntil(end), kind: 'noCard' }
        : null);
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
        setInfo({ endsAt: end, daysLeft: daysUntil(end), kind: 'stripe' });
      } catch {
        if (!cancelled) setInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, planKey, trialUntil]);

  return info;
}
