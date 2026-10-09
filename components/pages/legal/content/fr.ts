import type { LegalContent } from '../types';

// Version francaise. Traduction informative : la version espagnole prevaut.
const fr: LegalContent = {
    actualizado: 'Dernière mise à jour',
    nota: 'Cette traduction est fournie à titre purement informatif. En cas de divergence, la version espagnole prévaut.',
    enlaces: {
        contacto: 'formulaire de contact',
        soporte: 'Support',
        privacidad: 'politique de confidentialité',
        terminos: 'Conditions d’utilisation',
        avisoLegal: 'mentions légales',
    },

    privacidad: {
        titulo: 'Confidentialité et cookies',
        meta: 'Comment Opynio traite vos données personnelles et quels cookies il utilise.',
        secciones: [
            { t: 'Qui traite vos données', p: [
                'Opynio, la plateforme d’avis sur les entreprises de ce site. Pour toute question concernant vos données, écrivez-nous via le {contacto}.',
            ] },
            { t: 'Quelles données nous traitons', p: [
                'Si vous créez un compte : nom, nom d’utilisateur, e-mail, photo de profil (facultative) et vos préférences de langue, de pays, de thème et de notifications.',
                'Ce que vous publiez : avis, photos ou fichiers audio que vous joignez, votes et réponses. Les avis sont publics et peuvent être affichés sur le site de l’entreprise évaluée au moyen de nos widgets.',
                'Si vous gérez une entreprise : les informations de sa fiche et, si vous souscrivez un plan, les données de facturation, gérées par Stripe (Opynio ne conserve pas les données de votre carte).',
                'Ce que vous nous envoyez via le support ou le formulaire de contact.',
            ] },
            { t: 'Finalités et base juridique', p: [
                'Fournir le service que vous demandez : votre compte, la publication et la modération des avis, la gestion de votre entreprise et de vos paiements.',
                'Sécurité et prévention des abus (faux avis, spam), sur la base de notre intérêt légitime.',
                'Notifications par e-mail concernant votre activité (réponses du support, nouveaux avis sur votre entreprise). Vous pouvez les désactiver dans les Paramètres.',
                'Mesurer nos campagnes avec Meta, uniquement si vous acceptez les cookies de mesure et de publicité.',
            ] },
            { t: 'Avec qui elles sont partagées', p: [
                'Avec les prestataires dont nous avons besoin pour fonctionner : Supabase (hébergement et base de données), Stripe (paiements), notre prestataire d’envoi d’e-mails et, uniquement avec votre autorisation, Meta. Nous ne vendons pas vos données.',
            ] },
            { t: 'Durée de conservation', p: [
                'Tant que vous conservez votre compte. Si vous demandez sa suppression, nous effaçons vos données, sauf celles que la loi nous oblige à conserver (par exemple, les factures).',
            ] },
            { t: 'Vos droits', p: [
                'Vous pouvez demander l’accès, la rectification, l’effacement, l’opposition, la limitation et la portabilité de vos données via {soporte} ou le {contacto}. Si vous n’êtes pas satisfait, vous pouvez introduire une réclamation auprès de l’Agence espagnole de protection des données (aepd.es).',
            ] },
        ],
        cookies: {
            t: 'Cookies',
            intro: 'Nous utilisons le stockage de votre navigateur pour que le site fonctionne et, uniquement si vous l’acceptez, des cookies de Meta pour mesurer nos campagnes.',
            filas: [
                ['Nécessaires (toujours actifs)', 'Maintenir votre session et mémoriser vos préférences : langue, pays, thème et votre choix concernant les cookies.'],
                ['Mesure et publicité (facultatifs)', 'Meta Pixel (_fbp, _fbc). Ils ne sont activés que si vous les acceptez dans le bandeau cookies ou dans Paramètres › Confidentialité.'],
            ],
            boton: 'Paramétrer les cookies',
        },
    },

    avisoLegal: {
        titulo: 'Mentions légales',
        meta: 'Informations sur le titulaire d’Opynio et conditions d’utilisation du site web.',
        secciones: [
            { t: 'Titulaire du site web',
              intro: 'Conformément à la loi espagnole 34/2002 sur les services de la société de l’information et le commerce électronique (LSSI-CE), voici les informations relatives au titulaire de ce site web :',
              p: [
                'Titulaire : {titular}',
                'Identifiant fiscal (NIF) : {nif}',
                'Adresse : {domicilio}',
                'Données d’immatriculation : {registro}',
                'E-mail : {email}',
                'Site web : {web}',
            ] },
            { t: 'Objet', p: [
                'Opynio est une plateforme sur laquelle les utilisateurs publient des avis sur des entreprises, et les entreprises gèrent leur fiche, répondent aux avis et peuvent les afficher sur leur site au moyen de widgets. L’utilisation du site implique l’acceptation des présentes mentions légales et des {terminos}.',
            ] },
            { t: 'Propriété intellectuelle et industrielle', p: [
                'Le design, le code, la marque Opynio et les contenus propres du site appartiennent à son titulaire ou à des tiers qui en ont autorisé l’utilisation. Il est interdit de les reproduire, de les distribuer ou de les transformer sans autorisation, sauf pour un usage personnel et privé.',
                'Les avis appartiennent à leurs auteurs, qui concèdent à Opynio une licence pour les publier, comme indiqué dans les {terminos}.',
                'Les noms et marques des entreprises évaluées appartiennent à leurs titulaires respectifs.',
            ] },
            { t: 'Responsabilité', p: [
                'Les avis expriment l’opinion de leur auteur, et non celle d’Opynio. Nous modérons les contenus afin de retirer ceux qui enfreignent nos règles ou la loi, mais nous ne pouvons pas garantir l’exactitude de chaque opinion. Opynio n’est pas responsable des dommages résultant d’une utilisation abusive du site ni du contenu des sites tiers vers lesquels il renvoie.',
            ] },
            { t: 'Contenus illicites', p: [
                'Si vous estimez qu’un contenu publié sur Opynio est illicite ou porte atteinte à vos droits, signalez-le-nous via {soporte} ou le {contacto} et nous l’examinerons dans les meilleurs délais.',
            ] },
            { t: 'Protection des données', p: [
                'La manière dont nous traitons vos données personnelles est expliquée dans notre {privacidad}.',
            ] },
            { t: 'Droit applicable', p: [
                'Les présentes mentions légales sont régies par le droit espagnol. Tout litige relèvera des juridictions compétentes conformément à la loi ; si vous êtes un consommateur, de celles de votre domicile.',
            ] },
        ],
    },

    terminos: {
        titulo: 'Conditions d’utilisation',
        meta: 'Conditions d’utilisation d’Opynio en tant qu’utilisateur ou entreprise : compte, avis, plans et règles.',
        secciones: [
            { t: 'Acceptation', p: [
                'Les présentes conditions régissent l’utilisation d’Opynio par les utilisateurs et les entreprises. En créant un compte ou en utilisant le service, vous les acceptez ; si vous n’êtes pas d’accord, n’utilisez pas la plateforme. Elles complètent les {avisoLegal} et la {privacidad}.',
            ] },
            { t: 'Votre compte', p: [
                'Vous avez besoin d’un compte pour rédiger des avis ou gérer une entreprise. Vous devez avoir l’âge minimum exigé par la loi de votre pays (14 ans en Espagne), fournir des informations exactes et protéger votre mot de passe. Vous êtes responsable de ce qui est fait depuis votre compte.',
            ] },
            { t: 'Avis', p: [
                'Ne parlez que d’expériences réelles avec l’entreprise évaluée, avec respect et sans inclure de données personnelles d’autres personnes.',
                'Sont interdits les faux avis ou les avis rémunérés, les avis sur votre propre entreprise ou sur celle d’un concurrent, ainsi que les contenus offensants, discriminatoires, illicites ou publicitaires.',
                'Vos avis restent les vôtres, mais en les publiant vous concédez à Opynio une licence gratuite, mondiale et non exclusive pour les afficher sur la plateforme et dans les widgets que les entreprises intègrent à leur site, tant qu’ils restent publiés.',
                'Nous pouvons modérer, masquer ou retirer les avis qui enfreignent les présentes conditions. Vous pouvez modifier ou supprimer les vôtres depuis votre profil.',
            ] },
            { t: 'Entreprises', p: [
                'Toute personne qui revendique ou gère une fiche déclare être autorisée à représenter cette entreprise.',
                'Les entreprises peuvent répondre aux avis, mais elles ne peuvent pas les modifier, demander leur retrait en échange d’une contrepartie ni offrir des incitations en échange d’une évaluation positive.',
                'Les widgets affichent les avis tels qu’ils sont publiés sur Opynio.',
            ] },
            { t: 'Plans et paiements', p: [
                'Certaines fonctionnalités nécessitent un plan payant. Le prix et les conditions sont indiqués avant la souscription et le paiement est géré par Stripe. Vous pouvez annuler le renouvellement à tout moment depuis votre tableau de bord ; le plan reste actif jusqu’à la fin de la période payée.',
            ] },
            { t: 'Utilisations interdites', p: [
                'Il est interdit d’utiliser Opynio pour envoyer du spam, extraire des données de manière automatisée sans autorisation, usurper l’identité d’une autre personne ou entreprise, ou perturber le fonctionnement du service.',
            ] },
            { t: 'Suspension et clôture du compte', p: [
                'Nous pouvons suspendre ou fermer les comptes qui enfreignent les présentes conditions. Vous pouvez demander la suppression de votre compte à tout moment via {soporte}.',
            ] },
            { t: 'Responsabilité', p: [
                'Nous nous efforçons de faire en sorte que le service soit disponible et fonctionne sans erreur, mais nous ne pouvons pas le garantir en permanence. Opynio n’est pas responsable des opinions des utilisateurs ni des relations entre utilisateurs et entreprises.',
            ] },
            { t: 'Modifications des conditions', p: [
                'Nous pouvons mettre à jour les présentes conditions. En cas de modification importante, nous vous en informerons. La date de la dernière mise à jour figure en haut de cette page.',
            ] },
            { t: 'Droit applicable', p: [
                'Les présentes conditions sont régies par le droit espagnol. Si vous êtes un consommateur, vous conservez les droits que vous accorde la réglementation de votre pays de résidence. Pour toute question, écrivez-nous via {soporte} ou le {contacto}.',
            ] },
        ],
    },
};

export default fr;
