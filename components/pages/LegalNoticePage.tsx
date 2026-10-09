import React from 'react';
import { useLegalContent } from './legal/useLegalContent';
import { useIdiomaLegal } from './legal/useIdiomaLegal';
import { LegalDocument, LegalCargando } from './legal/LegalDocument';

// Aviso legal (LSSI-CE). Texto en ./legal/content/<idioma>.ts y datos del
// titular en ./legal/titular.ts.
const LegalNoticePage: React.FC = () => {
    const idioma = useIdiomaLegal();
    const c = useLegalContent(idioma);
    if (!c) return <LegalCargando />;
    return <LegalDocument doc={c.avisoLegal} c={c} idioma={idioma} />;
};

export default LegalNoticePage;
