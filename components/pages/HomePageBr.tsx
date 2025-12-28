import HomePage from './HomePage';
import React from 'react';

// This component re-uses the main HomePage logic for the /br route.
// Internationalization is handled by the I18nProvider based on the URL.
const HomePageBr: React.FC = () => {
    return <HomePage />;
};

export default HomePageBr;
