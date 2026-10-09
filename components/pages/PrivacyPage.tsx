import React, { useState } from 'react';
import SettingsDrawer from '../SettingsDrawer';
import { useLegalContent } from './legal/useLegalContent';
import { useIdiomaLegal } from './legal/useIdiomaLegal';
import { LegalDocument, LegalCargando } from './legal/LegalDocument';

// Privacidad y cookies. El texto vive en ./legal/content/<idioma>.ts (el
// español prevalece; el resto son traducciones informativas). Breve a
// proposito: que datos se tratan, para que, con quien, cuanto tiempo,
// derechos y cookies. Al cambiar el texto, actualizar LEGAL_ACTUALIZADO.
const PrivacyPage: React.FC = () => {
    const idioma = useIdiomaLegal();
    const c = useLegalContent(idioma);
    const [ajustes, setAjustes] = useState(false);

    if (!c) return <LegalCargando />;
    const cookies = c.privacidad.cookies;

    return (
        <>
            <LegalDocument doc={c.privacidad} c={c} idioma={idioma}>
                <section id="cookies" className="scroll-mt-24">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{cookies.t}</h2>
                    <p className="mb-3">{cookies.intro}</p>
                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-zinc-700">
                        <table className="w-full text-sm">
                            <tbody>
                                {cookies.filas.map(([a, b]) => (
                                    <tr key={a} className="border-b last:border-0 border-gray-200 dark:border-zinc-700">
                                        <th scope="row" className="text-left align-top font-semibold p-3 w-1/3 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100">{a}</th>
                                        <td className="p-3">{b}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAjustes(true)}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-green text-white font-semibold hover:bg-brand-green/90"
                    >
                        <i className="fa-solid fa-cookie-bite" aria-hidden="true"></i>{cookies.boton}
                    </button>
                </section>
            </LegalDocument>
            {ajustes && <SettingsDrawer onClose={() => setAjustes(false)} />}
        </>
    );
};

export default PrivacyPage;
