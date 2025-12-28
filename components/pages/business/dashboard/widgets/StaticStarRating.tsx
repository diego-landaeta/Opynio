import React from 'react';

const StaticStarRating: React.FC<{ rating: number, sizeClass?: string }> = ({ rating, sizeClass }) => {
    const fullStars = Math.round(rating);
    const stars = [];
    for (let i = 0; i < 5; i++) {
        stars.push(<span key={i} className={i < fullStars ? 'full' : 'empty'}>★</span>);
    }
    // Apply sizeClass for font-size, and use the opynio-stars class which handles colors via CSS variables.
    return <div className={`opynio-stars ${sizeClass || ''}`}>{stars}</div>;
};

export default StaticStarRating;
