import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Business } from '../../../../../types';
import StaticStarRating from './StaticStarRating';

interface PreviewProps {
    business: Business;
    theme: 'light' | 'dark';
}

const DEMO_REVIEWS = [
    {
      "id": 1,
      "title": "¡Superó nuestras expectativas!",
      "original_author_name": "Elena Rodríguez",
      "rating": 5,
      "review_text": "Contacté con ellos para crear nuestra tienda online y el resultado ha superado todas nuestras expectativas. El equipo demostró una profesionalidad increíble, cuidando cada detalle y asesorándonos en todo momento.",
      "source": "google"
    },
    {
      "id": 2,
      "title": "Diseño limpio y profesional",
      "original_author_name": "Carlos Sánchez",
      "rating": 5,
      "review_text": "El diseño web que nos hicieron es limpio, profesional y muy funcional. ¡Me encantó el resultado!",
      "source": "opynio"
    },
     {
      "id": 3,
      "title": "Atención al cliente de 10",
      "original_author_name": "Laura Gómez",
      "rating": 5,
      "review_text": "El soporte post-lanzamiento ha sido fantástico. Responden rápido y solucionan cualquier duda que tengamos. Se nota que se preocupan por sus clientes.",
      "source": "opynio"
    },
    {
      "id": 4,
      "title": "Una gran inversión",
      "original_author_name": "Javier Martín",
      "rating": 4,
      "review_text": "Aunque la inversión inicial fue considerable, ha merecido la pena. Nuestras ventas online han aumentado un 40% desde el lanzamiento de la nueva web. Muy recomendables.",
      "source": "google"
    }
];


export const HorizontalCarouselPreview: React.FC<PreviewProps> = ({ business, theme }) => {
    const ratingText = (business.avg_rating || 5) >= 4.5 ? 'EXCELENTE' : (business.avg_rating || 5) >= 3.5 ? 'MUY BUENO' : 'BUENO';
    const themeClass = theme === 'dark' ? 'opynio-theme-dark' : 'opynio-theme-light';
    
    const trackRef = useRef<HTMLDivElement>(null);
    const [currentIndex, setCurrentIndex] = useState(1);
    const transitionEnabledRef = useRef(true);

    const duplicatedReviews = useMemo(() => {
        if (DEMO_REVIEWS.length === 0) return [];
        // Create an "infinite" loop by cloning items at the beginning and end
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
        const interval = setInterval(scrollNext, 5000);
        return () => clearInterval(interval);
    }, [scrollNext]);

    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;
    
        const cardWidth = 350; // From CSS
        const gap = 20;
        const moveDistance = cardWidth + gap;

        if (transitionEnabledRef.current) {
            track.style.transition = 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        } else {
            track.style.transition = 'none';
        }
    
        track.style.transform = `translateX(-${currentIndex * moveDistance}px)`;
    
        const handleTransitionEnd = () => {
            if (currentIndex === 0) { // If we're at the clone of the last item
                transitionEnabledRef.current = false;
                setCurrentIndex(DEMO_REVIEWS.length);
            } else if (currentIndex === DEMO_REVIEWS.length + 1) { // If we're at the clone of the first item
                transitionEnabledRef.current = false;
                setCurrentIndex(1);
            }
        };
    
        track.addEventListener('transitionend', handleTransitionEnd);
        return () => {
            track.removeEventListener('transitionend', handleTransitionEnd);
        };
    }, [currentIndex, DEMO_REVIEWS.length]);


    return (
        <div className={`opynio-widget ${themeClass}`}>
            <div className="opynio-horizontal-widget" style={{padding: '1.5rem', boxShadow: 'none', maxWidth: '100%'}}>
                <div className="opynio-horizontal-wrapper">
                    <div className="opynio-rating-panel-wrapper">
                        <div className="opynio-rating-panel" style={{minWidth: '280px', padding: '2rem 1.5rem'}}>
                            <div className="opynio-rating-badge">{ratingText}</div>
                            <div className="opynio-stars-display" style={{ letterSpacing: '4px' }}>
                                <StaticStarRating rating={business.avg_rating || 5} />
                            </div>
                            <p className="opynio-rating-count">A base de <strong>{business.review_count || 123} reseñas</strong></p>
                            <div className="opynio-logo">
                                <div className="opynio-logo-text">Opynio</div>
                            </div>
                        </div>
                    </div>

                    <div className="opynio-cards-container">
                        <div className="opynio-cards-track" ref={trackRef}>
                            {duplicatedReviews.map((review, index) => {
                                const isGoogle = review.source === 'google';
                                return (
                                    <div key={`${review.id}-${index}`} className="opynio-review-card" style={{boxShadow: 'var(--shadow)', border: '1px solid var(--border-color)' }}>
                                        <div className="opynio-review-header">
                                            <div className="opynio-review-user">
                                                <div className="opynio-avatar-placeholder">{review.original_author_name.charAt(0)}</div>
                                                <div className="opynio-user-content">
                                                    <div className="opynio-username">{review.original_author_name}</div>
                                                    {isGoogle && (
                                                        <div className="opynio-google-badge">
                                                            <svg className="opynio-google-logo" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"></path><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"></path><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"></path><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"></path></svg>
                                                            <span className="opynio-google-text">Opinión de Google</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {!isGoogle && (
                                                <div className="opynio-platform-badge">
                                                    <svg viewBox="0 0 24 24" fill="#00b67a">
                                                        <circle cx="12" cy="12" r="10" fill="var(--opynio-green)"></circle>
                                                        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"></path>
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="opynio-review-stars">
                                            <div className="opynio-stars"><StaticStarRating rating={review.rating} /></div>
                                        </div>
                                        <h4 className="opynio-review-title">{review.title}</h4>
                                        <p className="opynio-review-text">{review.review_text}</p>
                                    </div>
                                );
                            })}
                        </div>
                        <button onClick={scrollPrev} className="opynio-nav-arrow opynio-nav-prev" type="button"><svg style={{transform: 'rotate(180deg)'}} viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button>
                        <button onClick={scrollNext} className="opynio-nav-arrow opynio-nav-next" type="button"><svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button>
                    </div>
                </div>
            </div>
        </div>
    );
};
