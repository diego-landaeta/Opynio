import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../contexts/i18nContext';
import { sendContactMessage, CONTACT_KINDS, ContactKind } from '../services/supabaseService';

// Formulario de contacto de «Sobre nosotros» (#contacto). No es soporte al
// cliente: para quien quiere contactar, colaborar o trabajar con Opynio. Lo
// lee el admin en /admin/soporte, pestana «Contacto».
const FIELD = 'w-full p-2.5 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-green focus:border-transparent';
const LABEL = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const MIN_MESSAGE = 10;

const ContactForm: React.FC<{ initialKind?: ContactKind }> = ({ initialKind = 'contact' }) => {
    const t = useTranslation();
    const { user, profile } = useAuth();
    const [kind, setKind] = useState<ContactKind>(initialKind);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    // Campo trampa: invisible para personas; si llega relleno es un bot.
    const [website, setWebsite] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { setKind(initialKind); }, [initialKind]);
    useEffect(() => {
        if (profile?.name && !name) setName(profile.name);
        if (user?.email && !email) setEmail(user.email);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.name, user?.email]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (sending) return;
        setError(null);
        if (website) { setSent(true); return; }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setError(t('aboutPage.formInvalidEmail')); return; }
        if (message.trim().length < MIN_MESSAGE) { setError(t('aboutPage.formMessageTooShort', { min: MIN_MESSAGE })); return; }
        setSending(true);
        try {
            await sendContactMessage({ kind, name, email, message });
            setSent(true);
            setMessage('');
        } catch (err) {
            setError(err instanceof Error && err.message === 'CONTACT_RATE_LIMITED'
                ? t('aboutPage.formRateLimited')
                : t('aboutPage.formErrorGeneric'));
        } finally {
            setSending(false);
        }
    };

    if (sent) {
        return (
            <div role="status" className="max-w-xl mx-auto p-6 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-900 dark:text-green-100">
                <i className="fa-solid fa-circle-check text-2xl text-brand-green mb-2" aria-hidden="true"></i>
                <p className="font-semibold">{t('aboutPage.formSent')}</p>
                <button type="button" onClick={() => setSent(false)} className="mt-3 text-sm font-semibold text-brand-green hover:underline">
                    {t('aboutPage.formSendAnother')}
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="max-w-xl mx-auto text-left space-y-4" noValidate>
            <div>
                <label htmlFor="contact-kind" className={LABEL}>{t('aboutPage.formKind')}</label>
                <select id="contact-kind" value={kind} onChange={(e) => setKind(e.target.value as ContactKind)} className={FIELD}>
                    {CONTACT_KINDS.map(k => <option key={k} value={k}>{t(`aboutPage.kind_${k}`)}</option>)}
                </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="contact-name" className={LABEL}>{t('aboutPage.formName')}</label>
                    <input id="contact-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} autoComplete="name" className={FIELD} />
                </div>
                <div>
                    <label htmlFor="contact-email" className={LABEL}>{t('aboutPage.formEmail')}</label>
                    <input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} autoComplete="email" className={FIELD} />
                </div>
            </div>
            <div>
                <label htmlFor="contact-message" className={LABEL}>{t('aboutPage.formMessage')}</label>
                <textarea id="contact-message" value={message} onChange={(e) => setMessage(e.target.value)} required rows={5} maxLength={5000} placeholder={t('aboutPage.formMessagePlaceholder')} className={FIELD} />
            </div>
            <div aria-hidden="true" className="hidden">
                <label htmlFor="contact-website">Website</label>
                <input id="contact-website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" disabled={sending} className="w-full inline-flex items-center justify-center gap-2 bg-brand-green text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-60">
                {sending ? <i className="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> : <i className="fa-regular fa-paper-plane" aria-hidden="true"></i>}
                {sending ? t('aboutPage.formSending') : t('aboutPage.formSend')}
            </button>
        </form>
    );
};

export default ContactForm;
