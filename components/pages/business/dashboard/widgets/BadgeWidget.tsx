import React from 'react';
import type { Business } from '../../../../../types';
import StaticStarRating from './StaticStarRating';
import { getPreviewStrings } from './widgetShared';

interface PreviewProps {
    business: Business;
    theme: 'light' | 'dark';
    lang: string;
}

export const BadgePreview: React.FC<PreviewProps> = ({ business, theme, lang }) => {
    const s = getPreviewStrings(lang);
    const themeClass = theme === 'dark' ? 'opynio-theme-dark' : 'opynio-theme-light';

    return (
        <div className={`opynio-widget ${themeClass}`}>
            <div style={{ display: 'inline-block', background: 'var(--card-bg)', padding: '1rem 1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--opynio-green)' }}>Opynio</div>
                    <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
                        <div className="opynio-stars"><StaticStarRating rating={business.avg_rating || 5} /></div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--subtext-color)', marginTop: '0.25rem' }}>
                            <strong>{(business.avg_rating || 0).toFixed(1)}</strong> {s.outOf5}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--subtext-color)', marginTop: '2px' }}>
                            {business.review_count || 0} {s.reviews}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
