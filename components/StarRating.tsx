import React, { useState } from 'react';

interface StarRatingProps {
    rating: number;
    onRating?: (rating: number) => void;
    size?: 'small' | 'medium' | 'large';
}

const StarRating: React.FC<StarRatingProps> = ({ rating, onRating, size = 'medium' }) => {
    const starSizeClasses = {
        small: 'text-sm',
        medium: 'text-xl',
        large: 'text-3xl'
    };

    // --- Interactive Version (for forms) ---
    if (onRating) {
        const [hoverRating, setHoverRating] = useState(0);
        
        const handleStarClick = (starValue: number) => {
            // Si la estrella clickeada ya está seleccionada, deseleccionar (poner en 0)
            if (rating === starValue) {
                onRating(0);
            } else {
                onRating(starValue);
            }
        };
        
        return (
            <div className={`flex items-center gap-1 ${starSizeClasses[size]}`}>
                {[1, 2, 3, 4, 5].map((starValue) => (
                    <button
                        type="button"
                        key={starValue}
                        className="cursor-pointer transition-transform hover:scale-110"
                        onClick={() => handleStarClick(starValue)}
                        onMouseEnter={() => setHoverRating(starValue)}
                        onMouseLeave={() => setHoverRating(0)}
                        aria-label={`Rate ${starValue} stars`}
                    >
                        <i className={`fa-solid fa-star transition-colors 
                            ${starValue <= (hoverRating || rating) 
                                ? 'text-yellow-400' 
                                : 'text-gray-300 dark:text-gray-600'}`
                        }></i>
                    </button>
                ))}
            </div>
        );
    }

    // --- Display-Only Version (with half-star support) ---
    const roundedRating = Math.round(rating * 2) / 2; // Rounds to the nearest 0.5

    return (
        <div className={`flex items-center gap-1 ${starSizeClasses[size]}`} title={`${rating.toFixed(1)} de 5 estrellas`}>
            {[1, 2, 3, 4, 5].map((starIndex) => {
                let iconClass = 'fa-regular fa-star text-gray-300 dark:text-gray-600'; // Empty star
                if (roundedRating >= starIndex) {
                    iconClass = 'fa-solid fa-star text-yellow-400'; // Full star
                } else if (roundedRating >= starIndex - 0.5) {
                    iconClass = 'fa-solid fa-star-half-stroke text-yellow-400'; // Half star
                }
                
                return (
                    <span key={starIndex}>
                        <i className={iconClass}></i>
                    </span>
                );
            })}
        </div>
    );
};

export default StarRating;