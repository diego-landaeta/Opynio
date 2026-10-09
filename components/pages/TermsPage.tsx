import React from 'react';
import { useLegalContent } from './legal/useLegalContent';
import { useIdiomaLegal } from './legal/useIdiomaLegal';
import { LegalDocument, LegalCargando } from './legal/LegalDocument';

// Terminos de uso. Texto en ./legal/content/<idioma>.ts.
const TermsPage: React.FC = () => {
    const idioma = useIdiomaLegal();
    const c = useLegalContent(idioma);
    if (!c) return <LegalCargando />;
    return <LegalDocument doc={c.terminos} c={c} idioma={idioma} />;
};

export default TermsPage;
