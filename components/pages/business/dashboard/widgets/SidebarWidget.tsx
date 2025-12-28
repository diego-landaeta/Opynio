import React from 'react';
import type { Business } from '../../../../../types';
import StaticStarRating from './StaticStarRating';

interface PreviewProps {
    business: Business;
    theme: 'light' | 'dark';
}

export const SidebarPreview: React.FC<PreviewProps> = ({ business, theme }) => {
    const themeClass = theme === 'dark' ? 'opynio-theme-dark' : 'opynio-theme-light';

    return (
        <div className={`opynio-widget ${themeClass}`}>
            <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)', maxWidth: '300px', margin: 'auto', textAlign: 'center' }}>
                <a href="#" style={{ textDecoration: 'none' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--opynio-green)' }}>Opynio</div>
                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-color)', marginTop: '1rem' }}>Opiniones para {business.name}</h3>
                </a>
                <div style={{ background: 'var(--bg-color)', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-color)' }}>{(business.avg_rating || 0).toFixed(1)}</div>
                    <div className="opynio-stars" style={{ justifyContent: 'center', marginTop: '0.25rem' }}>
                        <StaticStarRating rating={business.avg_rating || 5} />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--subtext-color)', marginTop: '0.25rem' }}>Basado en {business.review_count || 0} reseñas</p>
                </div>
                <a href="#" style={{ display: 'block', background: 'var(--opynio-green)', color: '#fff', fontWeight: '600', padding: '0.75rem', borderRadius: '8px', marginTop: '1rem', textDecoration: 'none' }}>
                    Escribe tu reseña
                </a>
            </div>
        </div>
    );
};
