import React from 'react';
import { Link } from 'react-router-dom';
import Meta from '../../Meta';
import { useI18n, localizedPathOrRoot, Language } from '../../../contexts/i18nContext';
import { useCountry } from '../../../contexts/CountryContext';
import { TITULAR, LEGAL_ACTUALIZADO } from './titular';
import { langAttr } from './useIdiomaLegal';
import type { DocLegal, LegalContent } from './types';

type ClaveEnlace = keyof LegalContent['enlaces'];
type Enlaces = Record<ClaveEnlace, { texto: string; to: string }>;

const DATOS_TITULAR: Record<string, string> = {
    titular: TITULAR.nombre,
    nif: TITULAR.nif,
    domicilio: TITULAR.domicilio,
    registro: TITULAR.registro,
    email: TITULAR.email,
    web: TITULAR.web,
};

const ENLACE = 'text-brand-green font-semibold hover:underline';

/** Enlaces de los marcadores, con las rutas del idioma y pais activos. */
export function useEnlaces(c: LegalContent): Enlaces {
    const { language } = useI18n();
    const { country } = useCountry();
    const ruta = (k: 'about' | 'support' | 'privacy' | 'terms' | 'legal') => localizedPathOrRoot(k, language, country);
    return {
        contacto: { texto: c.enlaces.contacto, to: `${ruta('about')}#contacto` },
        soporte: { texto: c.enlaces.soporte, to: ruta('support') },
        privacidad: { texto: c.enlaces.privacidad, to: ruta('privacy') },
        terminos: { texto: c.enlaces.terminos, to: ruta('terms') },
        avisoLegal: { texto: c.enlaces.avisoLegal, to: ruta('legal') },
    };
}

/** Sustituye los marcadores {…} por enlaces o por los datos del titular. */
export function Texto({ texto, enlaces }: { texto: string; enlaces: Enlaces }) {
    const trozos = texto.split(/(\{[a-zA-Z]+\})/g).filter(Boolean);
    return (
        <>
            {trozos.map((trozo, i) => {
                const clave = /^\{([a-zA-Z]+)\}$/.exec(trozo)?.[1];
                if (!clave) return <React.Fragment key={i}>{trozo}</React.Fragment>;
                if (clave in enlaces) {
                    const e = enlaces[clave as ClaveEnlace];
                    return <Link key={i} to={e.to} className={ENLACE}>{e.texto}</Link>;
                }
                if (clave === 'email' && TITULAR.email.includes('@')) {
                    return <a key={i} href={`mailto:${TITULAR.email}`} className={ENLACE}>{TITULAR.email}</a>;
                }
                if (clave in DATOS_TITULAR) return <React.Fragment key={i}>{DATOS_TITULAR[clave]}</React.Fragment>;
                return <React.Fragment key={i}>{trozo}</React.Fragment>;
            })}
        </>
    );
}

/** Mientras se descarga el texto de un idioma que no es el español. */
export const LegalCargando: React.FC = () => (
    <div className="max-w-3xl mx-auto min-h-[60vh]" aria-busy="true">
        <div className="h-10 w-2/3 rounded-lg bg-gray-100 dark:bg-zinc-800 animate-pulse" />
    </div>
);

const RTL = ['ar', 'fa'];

/** Plantilla comun de las paginas legales; `children` va al final (tabla de cookies). */
export const LegalDocument: React.FC<{ doc: DocLegal; c: LegalContent; idioma: Language; children?: React.ReactNode }> = ({ doc, c, idioma, children }) => {
    const enlaces = useEnlaces(c);
    // Una linea con un dato del titular vacio o aun sin rellenar ([…] en
    // titular.ts) no se publica: mejor sin la linea que con corchetes.
    const visible = (x: string) => !Object.entries(DATOS_TITULAR).some(([k, v]) =>
        x.includes(`{${k}}`) && (!v.trim() || v.trim().startsWith('[')));

    return (
        // lang/dir del texto legal, que puede no ser el idioma de la interfaz.
        <div className="max-w-3xl mx-auto" lang={langAttr(idioma)} dir={RTL.includes(idioma) ? 'rtl' : 'ltr'}>
            <Meta title={`${doc.titulo} | Opynio`} description={doc.meta} />
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-2">{doc.titulo}</h1>
            <div className="mb-8 space-y-1">
                <p className="text-sm text-gray-500 dark:text-gray-400">{c.actualizado}: {LEGAL_ACTUALIZADO}</p>
                {c.nota && <p className="text-sm italic text-gray-500 dark:text-gray-400">{c.nota}</p>}
            </div>

            <div className="space-y-7 text-gray-700 dark:text-gray-300 leading-relaxed">
                {doc.secciones.map(s => {
                    const puntos = s.p.filter(visible);
                    return (
                        <section key={s.t}>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{s.t}</h2>
                            {s.intro && <p className="mb-2"><Texto texto={s.intro} enlaces={enlaces} /></p>}
                            {puntos.length === 1 && !s.intro ? (
                                <p><Texto texto={puntos[0]} enlaces={enlaces} /></p>
                            ) : (
                                <ul className="list-disc pl-5 space-y-1.5">
                                    {puntos.map((x, i) => <li key={i}><Texto texto={x} enlaces={enlaces} /></li>)}
                                </ul>
                            )}
                        </section>
                    );
                })}
                {children}
            </div>
        </div>
    );
};
