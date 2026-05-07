import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Business } from '../../../../../types';
import StaticStarRating from './StaticStarRating';
import { getPreviewStrings } from './widgetShared';

interface PreviewProps {
    business: Business;
    theme: 'light' | 'dark';
    lang: string;
}

const DEMO_REVIEWS = [
    { id: 1, original_author_name: "Elena Rodríguez", rating: 5 },
    { id: 2, original_author_name: "Carlos Sánchez", rating: 5 },
    { id: 3, original_author_name: "Laura Gómez", rating: 5 },
];

export const StarsCarouselPreview: React.FC<PreviewProps> = ({ business, theme, lang }) => {
    const s = getPreviewStrings(lang);
    const themeClass = theme === 'dark' ? 'opynio-theme-dark' : 'opynio-theme-light';
    const reviewCount = business.review_count || 123;
    const score = (business.avg_rating || 5).toFixed(1);
    const ratingText = (business.avg_rating || 5) >= 4.5 ? s.ratingExcellent : (business.avg_rating || 5) >= 3.5 ? s.ratingVeryGood : s.ratingGood;

    const trackRef = useRef<HTMLDivElement>(null);
    const pausedRef = useRef(false);
    const [currentIndex, setCurrentIndex] = useState(1);
    const transitionEnabledRef = useRef(true);

    const duplicated = useMemo(() => {
        if (DEMO_REVIEWS.length === 0) return [];
        return [DEMO_REVIEWS[DEMO_REVIEWS.length - 1], ...DEMO_REVIEWS, DEMO_REVIEWS[0]];
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
        const interval = setInterval(() => {
            if (!pausedRef.current) scrollNext();
        }, 3500);
        return () => clearInterval(interval);
    }, [scrollNext]);

    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;

        const cardWidth = 165;
        const gap = 14;
        const moveDistance = cardWidth + gap;

        if (transitionEnabledRef.current) {
            track.style.transition = 'transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        } else {
            track.style.transition = 'none';
        }
        track.style.transform = `translateX(-${currentIndex * moveDistance}px)`;

        const handleTransitionEnd = () => {
            if (currentIndex === 0) {
                transitionEnabledRef.current = false;
                setCurrentIndex(DEMO_REVIEWS.length);
            } else if (currentIndex === DEMO_REVIEWS.length + 1) {
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
                className="opynio-stars-carousel-widget"
                onMouseEnter={() => { pausedRef.current = true; }}
                onMouseLeave={() => { pausedRef.current = false; }}
            >
                <div className="opynio-stars-carousel-wrapper">
                    <a
                        href="#"
                        className="opynio-stars-carousel-cta-link"
                        onClick={(e) => e.preventDefault()}
                    >
                        <div className="opynio-stars-carousel-cta">
                            <div className="opynio-stars-carousel-score">{score}</div>
                            <div className="opynio-stars-carousel-score-stars">
                                <StaticStarRating rating={business.avg_rating || 5} />
                            </div>
                            <div className="opynio-stars-carousel-count">
                                <strong>{reviewCount}</strong> {s.reviews}
                            </div>
                            <div className="opynio-stars-carousel-rating-label">{ratingText}</div>
                        </div>
                    </a>

                    <div className="opynio-stars-carousel-right">
                        <div className="opynio-stars-carousel-cards-area">
                            <button onClick={scrollPrev} className="opynio-stars-carousel-nav opynio-stars-carousel-nav-prev" type="button" aria-label="Anterior">
                                <svg style={{ transform: 'rotate(180deg)' }} viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
                            </button>
                            <div className="opynio-stars-carousel-cards-container" role="region" aria-label="Reseñas" aria-live="polite" aria-roledescription="carrusel">
                                <div className="opynio-stars-carousel-track" ref={trackRef}>
                                    {duplicated.map((review, index) => (
                                        <a
                                            key={`${review.id}-${index}`}
                                            href="#"
                                            className="opynio-stars-carousel-card"
                                            onClick={(e) => e.preventDefault()}
                                            title={review.original_author_name}
                                        >
                                            <div className="opynio-avatar-placeholder opynio-stars-carousel-card-avatar">
                                                {review.original_author_name.charAt(0)}
                                            </div>
                                            <div className="opynio-stars-carousel-card-name">{review.original_author_name.split(' ')[0]}</div>
                                            <div className="opynio-stars-carousel-card-stars">
                                                <StaticStarRating rating={review.rating} />
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                            <button onClick={scrollNext} className="opynio-stars-carousel-nav opynio-stars-carousel-nav-next" type="button" aria-label="Siguiente">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>
                            </button>
                        </div>
                        <div className="opynio-stars-carousel-footer">
                            <a
                                href="#"
                                className="opynio-stars-carousel-footer-btn"
                                onClick={(e) => e.preventDefault()}
                            >
                                {s.seeAllReviews || 'Ver reseñas completas'}
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
