import React from 'react';
import type { Business } from '../../../../../types';
import StaticStarRating from './StaticStarRating';

interface PreviewProps {
    business: Business;
    theme: 'light' | 'dark';
}

const DEMO_REVIEW = {
  id: 1,
  original_author_name: "Elena Rodríguez",
  rating: 5,
  title: "¡Superó nuestras expectativas!",
  review_text: "Contacté con ellos para crear nuestra tienda online y el resultado ha superado todas nuestras expectativas. El equipo demostró una profesionalidad increíble, cuidando cada detalle y asesorándonos en todo momento.",
  source: 'google'
};

export const LargeCarouselPreview: React.FC<PreviewProps> = ({ business, theme }) => {
    const themeClass = theme === 'dark' ? 'opynio-theme-dark' : 'opynio-theme-light';

    return (
        <div className={`opynio-widget ${themeClass}`}>
            <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '16px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)', maxWidth: '450px', margin: 'auto', textAlign: 'center' }}>
                <span style={{ fontSize: '4rem', color: 'var(--opynio-green)', lineHeight: 0.5, display: 'block' }}>"</span>
                <div style={{ marginTop: '1rem' }} className="opynio-stars">
                    <StaticStarRating rating={DEMO_REVIEW.rating} sizeClass="text-2xl" />
                </div>
                <h4 className="opynio-large-carousel-title">{DEMO_REVIEW.title}</h4>
                <p style={{ fontStyle: 'italic', fontSize: '1.1rem', color: 'var(--text-color)', marginTop: '1rem' }}>
                    "{DEMO_REVIEW.review_text}"
                </p>
                <p style={{ fontWeight: '600', color: 'var(--subtext-color)', marginTop: '1.5rem' }}>
                    — {DEMO_REVIEW.original_author_name}
                </p>
                {DEMO_REVIEW.source === 'google' && (
                    <div className="opynio-google-badge" style={{ marginTop: '1rem', display: 'inline-flex' }}>
                        <svg className="opynio-google-logo" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        <span className="opynio-google-text">Opinión de Google</span>
                    </div>
                )}
            </div>
        </div>
    );
};
