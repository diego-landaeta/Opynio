import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Meta from '../Meta';
import SettingsDrawer from '../SettingsDrawer';
import { useI18n, localizedPathOrRoot } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';

// Privacidad y cookies. Texto legal en español (el que prevalece) y en inglés;
// el resto de idiomas ve el inglés. Breve a proposito: que datos se tratan,
// para que, con quien se comparten, cuanto tiempo, derechos y cookies.
// Actualizar la fecha al cambiar el contenido.

type Seccion = { t: string; p: (string | React.ReactNode)[] };

const ACTUALIZADO = '28/09/2026';

const Contacto: React.FC<{ texto: string; to: string }> = ({ texto, to }) => (
    <Link to={to} className="text-brand-green font-semibold hover:underline">{texto}</Link>
);

const PrivacyPage: React.FC = () => {
    const { language } = useI18n();
    const { country } = useCountry();
    const [ajustes, setAjustes] = useState(false);
    const es = language === 'es' || language === 'ca';
    const contacto = `${localizedPathOrRoot('about', language, country)}#contacto`;
    const soporte = localizedPathOrRoot('support', language, country);

    const titulo = es ? 'Privacidad y cookies' : 'Privacy and cookies';
    const secciones: Seccion[] = es ? [
        { t: 'Quién trata tus datos', p: [<>Opynio, la plataforma de reseñas de empresas de este sitio. Para cualquier cuestión sobre tus datos escríbenos desde el <Contacto texto="formulario de contacto" to={contacto} />.</>] },
        { t: 'Qué datos tratamos', p: [
            'Si creas una cuenta: nombre, nombre de usuario, email, foto de perfil (opcional) y tus preferencias de idioma, país, tema y avisos.',
            'Lo que publicas: reseñas, fotos o audios que adjuntes, votos y respuestas. Las reseñas son públicas y pueden mostrarse en la web de la empresa reseñada mediante nuestros widgets.',
            'Si gestionas una empresa: sus datos de ficha y, si contratas un plan, los datos de facturación, que gestiona Stripe (Opynio no guarda los datos de tu tarjeta).',
            'Lo que nos envías por soporte o por el formulario de contacto.',
        ] },
        { t: 'Para qué y con qué base', p: [
            'Prestar el servicio que pides: tu cuenta, publicar y moderar reseñas, gestionar tu empresa y tus pagos.',
            'Seguridad y prevención de abusos (reseñas falsas, spam), por nuestro interés legítimo.',
            'Avisos por correo sobre tu actividad (respuestas de soporte, reseñas nuevas en tu empresa). Puedes desactivarlos en Ajustes.',
            'Medir nuestras campañas con Meta, solo si aceptas las cookies de medición y publicidad.',
        ] },
        { t: 'Con quién se comparten', p: [
            'Con los proveedores que necesitamos para funcionar: Supabase (alojamiento y base de datos), Stripe (pagos), nuestro proveedor de envío de correos y, solo con tu permiso, Meta. No vendemos tus datos.',
        ] },
        { t: 'Cuánto tiempo', p: [
            'Mientras tengas la cuenta. Si pides eliminarla, borramos tus datos salvo lo que la ley nos obligue a conservar (por ejemplo, facturas).',
        ] },
        { t: 'Tus derechos', p: [<>Puedes pedir acceso, rectificación, supresión, oposición, limitación y portabilidad de tus datos desde <Contacto texto="Soporte" to={soporte} /> o el formulario de contacto. Si no quedas conforme, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).</>] },
    ] : [
        { t: 'Who processes your data', p: [<>Opynio, the business review platform on this site. For any question about your data, write to us through the <Contacto texto="contact form" to={contacto} />.</>] },
        { t: 'What data we process', p: [
            'If you create an account: name, username, email, profile photo (optional) and your language, country, theme and notification preferences.',
            'What you publish: reviews, photos or audio you attach, votes and replies. Reviews are public and may be shown on the reviewed business’s website through our widgets.',
            'If you manage a business: its listing details and, if you buy a plan, billing data handled by Stripe (Opynio does not store your card details).',
            'What you send us through support or the contact form.',
        ] },
        { t: 'Why and on what basis', p: [
            'To provide the service you ask for: your account, publishing and moderating reviews, managing your business and payments.',
            'Security and abuse prevention (fake reviews, spam), based on our legitimate interest.',
            'Email notifications about your activity (support replies, new reviews for your business). You can turn them off in Settings.',
            'Measuring our campaigns with Meta, only if you accept measurement and advertising cookies.',
        ] },
        { t: 'Who we share it with', p: [
            'With the providers we need to operate: Supabase (hosting and database), Stripe (payments), our email delivery provider and, only with your permission, Meta. We do not sell your data.',
        ] },
        { t: 'How long', p: [
            'While you keep your account. If you ask us to delete it, we erase your data except what the law requires us to keep (for example, invoices).',
        ] },
        { t: 'Your rights', p: [<>You can request access, rectification, erasure, objection, restriction and portability of your data through <Contacto texto="Support" to={soporte} /> or the contact form. You may also complain to the Spanish Data Protection Agency (aepd.es).</>] },
    ];

    const cookies = es ? {
        t: 'Cookies',
        intro: 'Usamos el almacenamiento de tu navegador para que la web funcione y, solo si lo aceptas, cookies de Meta para medir nuestras campañas.',
        filas: [
            ['Necesarias (siempre activas)', 'Mantener tu sesión y recordar tus preferencias: idioma, país, tema y tu elección sobre cookies.'],
            ['Medición y publicidad (opcionales)', 'Meta Pixel (_fbp, _fbc). Solo se activan si aceptas en el aviso de cookies o en Ajustes › Privacidad.'],
        ],
        boton: 'Configurar cookies',
    } : {
        t: 'Cookies',
        intro: 'We use your browser storage to make the site work and, only if you accept, Meta cookies to measure our campaigns.',
        filas: [
            ['Necessary (always on)', 'Keep you signed in and remember your preferences: language, country, theme and your cookie choice.'],
            ['Measurement and advertising (optional)', 'Meta Pixel (_fbp, _fbc). Only enabled if you accept in the cookie notice or in Settings › Privacy.'],
        ],
        boton: 'Cookie settings',
    };

    return (
        <div className="max-w-3xl mx-auto">
            <Meta
                title={`${titulo} | Opynio`}
                description={es ? 'Cómo trata Opynio tus datos personales y qué cookies usa.' : 'How Opynio processes your personal data and which cookies it uses.'}
            />
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-2">{titulo}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">{es ? 'Última actualización' : 'Last updated'}: {ACTUALIZADO}</p>

            <div className="space-y-7 text-gray-700 dark:text-gray-300 leading-relaxed">
                {secciones.map(s => (
                    <section key={s.t}>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{s.t}</h2>
                        {s.p.length === 1 ? <p>{s.p[0]}</p> : (
                            <ul className="list-disc pl-5 space-y-1.5">{s.p.map((x, i) => <li key={i}>{x}</li>)}</ul>
                        )}
                    </section>
                ))}

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
            </div>
            {ajustes && <SettingsDrawer onClose={() => setAjustes(false)} />}
        </div>
    );
};

export default PrivacyPage;
