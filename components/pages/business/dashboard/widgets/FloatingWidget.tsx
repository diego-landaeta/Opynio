import React from 'react';
import type { Business } from '../../../../../types';
import StaticStarRating from './StaticStarRating';

interface PreviewProps {
    business: Business;
    theme: 'light' | 'dark';
}

export const FloatingPreview: React.FC<PreviewProps> = ({ business, theme }) => {
    const themeClass = theme === 'dark' ? 'opynio-theme-dark' : 'opynio-theme-light';

    return (
        <div className={`relative h-24 w-full opynio-widget ${themeClass}`}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--card-bg)', padding: '0.75rem 1rem', borderRadius: '50px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--opynio-green)' }}>Opynio</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-color)' }}>{(business.avg_rating || 0).toFixed(1)}</span>
                    <div className="opynio-stars"><StaticStarRating rating={business.avg_rating || 5} sizeClass="text-sm" /></div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--subtext-color)', marginLeft: '4px' }}>({business.review_count || 0})</span>
                </div>
            </div>
        </div>
    );
};
