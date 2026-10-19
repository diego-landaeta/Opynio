import React from 'react';
import type { Business } from '../../../../../types';
import StaticStarRating from './StaticStarRating';
import { getPreviewStrings, useTranslatedReviews } from './widgetShared';
import { ProductPillSlot } from './ProductPill';

interface PreviewProps {
    business: Business;
    theme: 'light' | 'dark';
    lang: string;
    isProduct?: boolean;
    productName?: string;
}

const DEMO_REVIEWS = [
    { id: 1, name: "María G.", rating: 5, text: "Los contenidos son claros y los tutores responden rápido. Terminé trabajando y pude aplicar lo aprendido desde el primer módulo. Totalmente recomendable.", source: 'opynio', title: "Me ayudó a dar el salto profesional" },
    { id: 2, name: "Javier R.", rating: 5, text: "Pude estudiar a mi ritmo y el soporte resolvió todas mis dudas el mismo día. El diploma llegó en el plazo prometido.", source: 'opynio', title: "Plataforma cómoda y soporte cercano" },
    { id: 3, name: "Laura P.", rating: 5, text: "Temario actualizado, ejemplos reales y un equipo docente que se nota que conoce el sector. Repetiré con otro curso.", source: 'google', title: "Muy bien organizado" },
];

const CheckIcon: React.FC<{ size: number }> = ({ size }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="10" fill="#00b67a" />
        <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// Misma maqueta que el renderer 'testimonials' de public/widget.js: si cambias
// una, cambia la otra. Los estilos (.opynio-testi-*) viven en WIDGET_CSS.
export const TestimonialsPreview: React.FC<PreviewProps> = ({ business, theme, lang, isProduct, productName }) => {
    const s = getPreviewStrings(lang);
    const reviews = useTranslatedReviews(DEMO_REVIEWS, lang, ['title', 'text']);
    const themeClass = theme === 'dark' ? 'opynio-theme-dark' : 'opynio-theme-light';
    // Como en el resto de vistas previas: sin datos, cifras de ejemplo.
    const avg = business.avg_rating || 5;
    const count = business.review_count || 123;

    return (
        <div className={`opynio-widget ${themeClass}`}>
            <div className="opynio-testi">
                {isProduct && <ProductPillSlot label={s.productBadge} name={productName} />}
                <div className="opynio-testi-summary">
                    <div className="opynio-testi-score">{avg.toFixed(1)}</div>
                    <div className="opynio-stars opynio-testi-stars" role="img" aria-label={`${avg.toFixed(1)} ${s.outOf5}`}>
                        {[0, 1, 2, 3, 4].map(i => <span key={i} className={i < Math.round(avg) ? 'full' : 'empty'}>★</span>)}
                    </div>
                    <div className="opynio-testi-count">
                        <CheckIcon size={16} />
                        <span>{s.basedOn.replace('{n}', String(count))}</span>
                    </div>
                </div>

                <div className="opynio-testi-cards">
                    {reviews.map(review => (
                        <div key={review.id} className="opynio-testi-card">
                            <div className="opynio-testi-head">
                                <div className="opynio-avatar-placeholder">{review.name.charAt(0)}</div>
                                <div>
                                    <div className="opynio-username">{review.name}</div>
                                    <StaticStarRating rating={review.rating} />
                                </div>
                            </div>
                            <h3 className="opynio-testi-title">{review.title}</h3>
                            <p className="opynio-testi-text">{review.text}</p>
                            <div className="opynio-testi-foot">
                                {review.source === 'google' ? (
                                    <div className="opynio-google-badge">
                                        <svg className="opynio-google-logo" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                                        <span className="opynio-google-text">{s.googleReview}</span>
                                    </div>
                                ) : (
                                    <div className="opynio-opynio-badge">
                                        <svg viewBox="0 0 24 24" fill="#00b67a" style={{ width: '14px', height: '14px' }} aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                        <span className="opynio-opynio-text">{s.opynioReview}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="opynio-testi-band">
                    <CheckIcon size={26} />
                    <span className="opynio-testi-band-text">{s.verifiedByOpynio}</span>
                    <span className="opynio-testi-band-brand">Opynio</span>
                </div>

                <div className="opynio-testi-footer">
                    <span className="opynio-testi-btn">
                        {s.seeAllReviews}
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 5.3 15.3 12l-6.7 6.7-1.4-1.4L12.5 12 7.2 6.7z" /></svg>
                    </span>
                </div>
            </div>
        </div>
    );
};
