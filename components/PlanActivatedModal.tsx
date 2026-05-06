// components/PlanActivatedModal.tsx
//
// Modal pantalla completa que celebra la activación de un plan tras:
//   • Registro free desde el wizard CompleteBusinessRegistrationPage
//   • Compra de plan pago vía Stripe (PaymentSuccessPage)
//
// Trigger: localStorage.setItem('opynio_pending_plan_welcome', '<plan>') en el
// flujo correspondiente. Este componente se monta global desde App.tsx y se
// auto-muestra cuando detecta el flag, animándose y limpiando el flag tras
// cerrar para que no aparezca dos veces.

import React, { useEffect, useState } from 'react';
import type { Plan } from '../types';
import { useTranslation } from '../contexts/i18nContext';

// Datos visuales del plan (color, icono) — estáticos, no se traducen.
// Las strings (title/tagline/features) viven en los locales bajo el namespace
// `planBenefits.<plan>` y se resuelven en runtime con t() vía getPlanBenefits().
const PLAN_VISUALS: Record<Plan, { color: string; icon: string }> = {
    free:       { color: 'from-emerald-400 via-brand-green to-teal-500', icon: 'fa-store' },
    starter:    { color: 'from-emerald-400 via-brand-green to-teal-500', icon: 'fa-paper-plane' },
    growth:     { color: 'from-blue-400 via-indigo-500 to-purple-500',   icon: 'fa-chart-line' },
    pro:        { color: 'from-purple-500 via-pink-500 to-rose-500',     icon: 'fa-crown' },
    v2:         { color: 'from-pink-500 via-fuchsia-500 to-purple-600',  icon: 'fa-rocket' },
    enterprise: { color: 'from-amber-400 via-orange-500 to-red-500',     icon: 'fa-building-shield' },
};

// Cuenta de features por plan — necesaria para iterar sobre las claves
// `planBenefits.<plan>.feature{1..N}`. free/v2/enterprise tienen 4, starter/growth 5, pro 6.
const PLAN_FEATURE_COUNT: Record<Plan, number> = {
    free: 4,
    starter: 5,
    growth: 5,
    pro: 6,
    v2: 4,
    enterprise: 4,
};

// Resuelve los beneficios traducidos del plan en runtime. Devuelve la
// estructura completa que esperan el modal y la PaymentSuccessPage.
export function getPlanBenefits(plan: Plan, t: (key: string) => string) {
    const visual = PLAN_VISUALS[plan];
    const count = PLAN_FEATURE_COUNT[plan];
    const features: string[] = [];
    for (let i = 1; i <= count; i++) {
        features.push(t(`planBenefits.${plan}.feature${i}`));
    }
    return {
        title: t(`planBenefits.${plan}.title`),
        tagline: t(`planBenefits.${plan}.tagline`),
        color: visual.color,
        icon: visual.icon,
        features,
    };
}

const STORAGE_KEY = 'opynio_pending_plan_welcome';

const PlanActivatedModal: React.FC = () => {
    const t = useTranslation();
    const [plan, setPlan] = useState<Plan | null>(null);
    const [visible, setVisible] = useState(false);
    const [closing, setClosing] = useState(false);

    // Lee el flag de localStorage y, si encuentra un plan válido, monta el modal.
    useEffect(() => {
        const checkFlag = () => {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) return;
                if (Object.prototype.hasOwnProperty.call(PLAN_VISUALS, raw)) {
                    setPlan(raw as Plan);
                    // Pequeño delay para que la animación de entrada se vea.
                    requestAnimationFrame(() => setVisible(true));
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                }
            } catch {
                /* ignore */
            }
        };
        checkFlag();
        // Si se setea el flag mientras el componente ya está montado (otra ruta).
        const onStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) checkFlag();
        };
        window.addEventListener('storage', onStorage);
        // Y también un evento custom para misma pestaña.
        const onCustom = () => checkFlag();
        window.addEventListener('opynio:plan-activated', onCustom);
        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('opynio:plan-activated', onCustom);
        };
    }, []);

    const handleClose = () => {
        if (!plan) return;
        setClosing(true);
        // Limpiamos el flag inmediatamente para que recargas no re-disparen.
        localStorage.removeItem(STORAGE_KEY);
        // Tras la animación de salida desmontamos.
        setTimeout(() => {
            setPlan(null);
            setVisible(false);
            setClosing(false);
        }, 350);
    };

    // Cierre con Escape.
    useEffect(() => {
        if (!plan) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [plan]);

    if (!plan) return null;
    const data = getPlanBenefits(plan, t);

    const overlayClasses = closing
        ? 'opacity-0'
        : visible
            ? 'opacity-100'
            : 'opacity-0';
    const cardClasses = closing
        ? 'opacity-0 scale-95 translate-y-4'
        : visible
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-90 translate-y-8';

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="plan-activated-title"
            className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-300 ease-out ${overlayClasses}`}
        >
            {/* Backdrop con blur */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={handleClose}
                aria-hidden="true"
            ></div>

            {/* Confeti decorativo (CSS puro, sin libs) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
                {Array.from({ length: 24 }).map((_, i) => (
                    <span
                        key={i}
                        className="confetti-piece"
                        style={{
                            left: `${(i * 4.2) % 100}%`,
                            animationDelay: `${(i % 8) * 0.15}s`,
                            backgroundColor: ['#10B981', '#3B82F6', '#A855F7', '#EC4899', '#F59E0B'][i % 5],
                        }}
                    ></span>
                ))}
            </div>

            {/* Card */}
            <div
                className={`relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ease-out transform ${cardClasses}`}
            >
                {/* Top gradient ribbon */}
                <div className={`h-2 bg-gradient-to-r ${data.color}`}></div>

                <div className="p-6 sm:p-10 text-center">
                    {/* Icon */}
                    <div className={`mx-auto w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br ${data.color} flex items-center justify-center shadow-2xl mb-5 ring-8 ring-white/30 dark:ring-zinc-800/50 animate-bounce-in`}>
                        <i className={`fa-solid ${data.icon} text-white text-3xl sm:text-4xl`}></i>
                    </div>

                    {/* Title + tagline */}
                    <h2 id="plan-activated-title" className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
                        {data.title}
                    </h2>
                    <p className="mt-2 text-sm sm:text-base text-gray-500 dark:text-gray-400">
                        {data.tagline}
                    </p>

                    {/* Plan badge */}
                    <div className={`inline-flex items-center gap-2 mt-5 px-4 py-1.5 rounded-full bg-gradient-to-r ${data.color} text-white text-xs font-bold uppercase tracking-wider shadow-lg`}>
                        <i className="fa-solid fa-check-circle"></i>
                        <span>Plan {plan === 'v2' ? 'v.2' : plan} activo</span>
                    </div>

                    {/* Features list */}
                    <div className="mt-7 text-left">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3 text-center">
                            Lo que ya puedes hacer
                        </p>
                        <ul className="space-y-2.5">
                            {data.features.map((feat, i) => (
                                <li
                                    key={i}
                                    className="flex items-start gap-3 text-sm sm:text-base text-gray-700 dark:text-gray-200 animate-fade-in-up"
                                    style={{ animationDelay: `${100 + i * 60}ms` }}
                                >
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center mt-0.5">
                                        <i className="fa-solid fa-check text-[10px]"></i>
                                    </span>
                                    <span>{feat}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* CTA */}
                    <button
                        type="button"
                        onClick={handleClose}
                        className={`mt-8 w-full bg-gradient-to-r ${data.color} text-white font-bold py-3.5 rounded-xl text-base sm:text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2`}
                    >
                        <span>Empezar ahora</span>
                        <i className="fa-solid fa-arrow-right text-sm"></i>
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes bounce-in {
                    0%   { transform: scale(0.3); opacity: 0; }
                    60%  { transform: scale(1.1); opacity: 1; }
                    80%  { transform: scale(0.95); }
                    100% { transform: scale(1); }
                }
                .animate-bounce-in { animation: bounce-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    opacity: 0;
                    animation: fade-in-up 0.4s ease-out forwards;
                }

                @keyframes confetti-fall {
                    0%   { transform: translateY(-10vh) rotate(0deg); opacity: 0; }
                    10%  { opacity: 1; }
                    100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
                }
                .confetti-piece {
                    position: absolute;
                    top: -10vh;
                    width: 8px;
                    height: 14px;
                    border-radius: 2px;
                    animation: confetti-fall 3.2s linear forwards;
                }
            `}</style>
        </div>
    );
};

export default PlanActivatedModal;

// Helper para disparar el modal desde cualquier parte del código.
// Setea el flag en localStorage y emite un evento custom para que el modal
// (montado globalmente) se entere aunque ya esté en pantalla.
export function triggerPlanActivatedModal(plan: Plan): void {
    try {
        localStorage.setItem(STORAGE_KEY, plan);
        window.dispatchEvent(new Event('opynio:plan-activated'));
    } catch {
        /* ignore */
    }
}
