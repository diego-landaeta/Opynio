import type { LegalContent } from '../types';

// English version. Also used for gb, au, ie and sg.
const en: LegalContent = {
    actualizado: 'Last updated',
    nota: 'This translation is provided for information only. If there is any discrepancy, the Spanish version prevails.',
    enlaces: {
        contacto: 'contact form',
        soporte: 'Support',
        privacidad: 'privacy policy',
        terminos: 'Terms of Use',
        avisoLegal: 'legal notice',
    },

    privacidad: {
        titulo: 'Privacy and cookies',
        meta: 'How Opynio processes your personal data and which cookies it uses.',
        secciones: [
            { t: 'Who processes your data', p: [
                'Opynio, the business review platform on this site. For any question about your data, write to us through the {contacto}.',
            ] },
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
            { t: 'Your rights', p: [
                'You can request access, rectification, erasure, objection, restriction and portability of your data through {soporte} or the {contacto}. You may also complain to the Spanish Data Protection Agency (aepd.es).',
            ] },
        ],
        cookies: {
            t: 'Cookies',
            intro: 'We use your browser storage to make the site work and, only if you accept, Meta cookies to measure our campaigns.',
            filas: [
                ['Necessary (always on)', 'Keep you signed in and remember your preferences: language, country, theme and your cookie choice.'],
                ['Measurement and advertising (optional)', 'Meta Pixel (_fbp, _fbc). Only enabled if you accept in the cookie notice or in Settings › Privacy.'],
            ],
            boton: 'Cookie settings',
        },
    },

    avisoLegal: {
        titulo: 'Legal notice',
        meta: 'Details of the owner of Opynio and the conditions for using the website.',
        secciones: [
            { t: 'Website owner',
              intro: 'In accordance with Spanish Law 34/2002 on information society services and electronic commerce (LSSI-CE), these are the details of the owner of this website:',
              p: [
                'Owner: {titular}',
                'Tax ID (NIF): {nif}',
                'Registered address: {domicilio}',
                'Registration details: {registro}',
                'Email: {email}',
                'Website: {web}',
            ] },
            { t: 'Purpose', p: [
                'Opynio is a platform where users publish reviews of businesses, and businesses manage their listing, reply to reviews and can show them on their own website through widgets. Using the site means you accept this legal notice and the {terminos}.',
            ] },
            { t: 'Intellectual and industrial property', p: [
                'The design, code, the Opynio brand and the site’s own content belong to its owner or to third parties who have authorised their use. They may not be reproduced, distributed or transformed without permission, except for personal and private use.',
                'Reviews belong to the people who write them, who grant Opynio a licence to publish them, as explained in the {terminos}.',
                'The names and trademarks of the reviewed businesses belong to their respective owners.',
            ] },
            { t: 'Liability', p: [
                'Reviews express the opinion of the person who writes them, not Opynio’s. We moderate content to remove anything that breaks our rules or the law, but we cannot guarantee that every opinion is accurate. Opynio is not liable for damage caused by misuse of the site or for the content of third-party websites linked from it.',
            ] },
            { t: 'Unlawful content', p: [
                'If you believe that content published on Opynio is unlawful or infringes your rights, let us know through {soporte} or the {contacto} and we will review it as soon as possible.',
            ] },
            { t: 'Data protection', p: [
                'How we process your personal data is explained in our {privacidad}.',
            ] },
            { t: 'Applicable law', p: [
                'This legal notice is governed by Spanish law. Any dispute will be settled by the courts that have jurisdiction under the law; if you are a consumer, by the courts of your place of residence.',
            ] },
        ],
    },

    terminos: {
        titulo: 'Terms of Use',
        meta: 'Conditions for using Opynio as a user or a business: account, reviews, plans and rules.',
        secciones: [
            { t: 'Acceptance', p: [
                'These terms govern the use of Opynio by users and businesses. By creating an account or using the service you accept them; if you do not agree, do not use the platform. They complement the {avisoLegal} and the {privacidad}.',
            ] },
            { t: 'Your account', p: [
                'You need an account to write reviews or manage a business. You must meet the minimum age required by the law of your country (14 in Spain), provide accurate information and keep your password secure. You are responsible for what is done from your account.',
            ] },
            { t: 'Reviews', p: [
                'Only write about real experiences with the reviewed business, respectfully and without including other people’s personal data.',
                'Fake or paid reviews, reviews of your own business or a competitor’s, and offensive, discriminatory, unlawful or promotional content are not allowed.',
                'Your reviews remain yours, but by publishing them you grant Opynio a free, worldwide, non-exclusive licence to show them on the platform and in the widgets that businesses embed on their website, for as long as they stay published.',
                'We may moderate, hide or remove reviews that break these terms. You can edit or delete your own reviews from your profile.',
            ] },
            { t: 'Businesses', p: [
                'Anyone who claims or manages a listing declares that they are authorised to represent that business.',
                'Businesses may reply to reviews, but they may not edit them, ask for their removal in exchange for anything, or offer incentives in exchange for a positive rating.',
                'Widgets show reviews exactly as they are published on Opynio.',
            ] },
            { t: 'Plans and payments', p: [
                'Some features require a paid plan. The price and conditions are shown before you buy, and payments are handled by Stripe. You can cancel the renewal at any time from your dashboard; the plan stays active until the end of the period you paid for.',
            ] },
            { t: 'Prohibited uses', p: [
                'You may not use Opynio to send spam, extract data automatically without permission, impersonate another person or business, or interfere with how the service works.',
            ] },
            { t: 'Suspension and closing your account', p: [
                'We may suspend or close accounts that break these terms. You can ask us to delete your account at any time through {soporte}.',
            ] },
            { t: 'Liability', p: [
                'We work to keep the service available and free of errors, but we cannot guarantee this at all times. Opynio is not liable for users’ opinions or for dealings between users and businesses.',
            ] },
            { t: 'Changes to these terms', p: [
                'We may update these terms. If a change is significant, we will let you know. The date of the last update appears at the top of this page.',
            ] },
            { t: 'Applicable law', p: [
                'These terms are governed by Spanish law. If you are a consumer, you keep the rights granted to you by the law of your country of residence. If you have any questions, write to us through {soporte} or the {contacto}.',
            ] },
        ],
    },
};

export default en;
