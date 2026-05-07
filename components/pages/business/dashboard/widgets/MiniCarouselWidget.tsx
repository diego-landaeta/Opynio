import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Business } from '../../../../../types';
import StaticStarRating from './StaticStarRating';
import { getPreviewStrings } from './widgetShared';

interface PreviewProps {
    business: Business;
    theme: 'light' | 'dark';
    lang: string;
}

const DEMO_AUTHORS = [
    { id: 1, original_author_name: "Elena Rodríguez", rating: 5 },
    { id: 2, original_author_name: "Carlos Sánchez", rating: 5 },
    { id: 3, original_author_name: "Laura Gómez", rating: 5 },
];

export const MiniCarouselPreview: React.FC<PreviewProps> = ({ business, theme, lang }) => {
    const s = getPreviewStrings(lang);
    const themeClass = theme === 'dark' ? 'opynio-theme-dark' : 'opynio-theme-light';
    const ratingText = (business.avg_rating || 5) >= 4.5 ? s.ratingExcellent : (business.avg_rating || 5) >= 3.5 ? s.ratingVeryGood : s.ratingGood;

    const trackRef = useRef<HTMLDivElement>(null);
    const widgetRef = useRef<HTMLDivElement>(null);
    const pausedRef = useRef(false);
    const [currentIndex, setCurrentIndex] = useState(1);
    const [entered, setEntered] = useState(false);
    const transitionEnabledRef = useRef(true);

    const duplicatedReviews = useMemo(() => {
        if (DEMO_AUTHORS.length === 0) return [];
        return [DEMO_AUTHORS[DEMO_AUTHORS.length - 1], ...DEMO_AUTHORS, DEMO_AUTHORS[0]];
    }, []);

    const scrollNext = useCallback(() => {
        if (!transitionEnabledRef.current) return;
        setCurrentIndex(prev => prev + 1);
        transitionEnabledRef.current = true;
    }, []);

    const scrollPrev = useCallback(() => {
        if (!transitionEnabledRef.current) return;
        setCurrentIndex(prev => prev - 1);
        transitionEnabledRef.current = true;
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setEntered(true), 30);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            if (!pausedRef.current) scrollNext();
        }, 4000);
        return () => clearInterval(interval);
    }, [scrollNext]);

    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;

        const cardWidth = 180;
        const gap = 14;
        const moveDistance = cardWidth + gap;

        if (transitionEnabledRef.current) {
            track.style.transition = 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        } else {
            track.style.transition = 'none';
        }
        track.style.transform = `translateX(-${currentIndex * moveDistance}px)`;

        const handleTransitionEnd = () => {
            if (currentIndex === 0) {
                transitionEnabledRef.current = false;
                setCurrentIndex(DEMO_AUTHORS.length);
            } else if (currentIndex === DEMO_AUTHORS.length + 1) {
                transitionEnabledRef.current = false;
                setCurrentIndex(1);
            }
        };

        track.addEventListener('transitionend', handleTransitionEnd);
        return () => { track.removeEventListener('transitionend', handleTransitionEnd); };
    }, [currentIndex]);

    return (
        <div className={`opynio-widget ${themeClass}`}>
            <div
                ref={widgetRef}
                className={`opynio-mini-widget${entered ? ' opynio-mini-entered' : ''}`}
                onMouseEnter={() => { pausedRef.current = true; }}
                onMouseLeave={() => { pausedRef.current = false; }}
            >
                <div className="opynio-mini-wrapper">
                    <div className="opynio-mini-rating-wrapper">
                        <div className="opynio-mini-rating-panel">
                            <div className="opynio-mini-rating-badge">{ratingText}</div>
                            <div className="opynio-mini-stars-display">
                                <StaticStarRating rating={business.avg_rating || 5} />
                            </div>
                            <p className="opynio-mini-rating-count" dangerouslySetInnerHTML={{ __html: s.basedOnAlt.replace('{n}', String(business.review_count || 123)) }} />
                            <div className="opynio-mini-logo">
                                <div className="opynio-mini-logo-text">Opynio</div>
                            </div>
                        </div>
                    </div>

                    <div className="opynio-mini-cards-area">
                        <button onClick={scrollPrev} className="opynio-mini-nav-arrow opynio-mini-nav-prev" type="button" aria-label="Anterior">
                            <svg style={{ transform: 'rotate(180deg)' }} viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
                        </button>
                        <div className="opynio-mini-cards-container" role="region" aria-label="Reseñas" aria-live="polite" aria-roledescription="carrusel">
                            <div className="opynio-mini-cards-track" ref={trackRef}>
                                {duplicatedReviews.map((review, index) => (
                                    <a
                                        key={`${review.id}-${index}`}
                                        href="#"
                                        className="opynio-mini-review-card"
                                        onClick={(e) => e.preventDefault()}
                                        style={{ animationDelay: `${(index % DEMO_AUTHORS.length) * 90}ms` }}
                                    >
                                        <div className="opynio-avatar-placeholder opynio-mini-review-avatar">
                                            {review.original_author_name.charAt(0)}
                                        </div>
                                        <div className="opynio-mini-review-name">{review.original_author_name}</div>
                                        <div className="opynio-mini-review-stars">
                                            <StaticStarRating rating={review.rating} />
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                        <button onClick={scrollNext} className="opynio-mini-nav-arrow opynio-mini-nav-next" type="button" aria-label="Siguiente">
                            <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
