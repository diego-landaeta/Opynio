import type { LegalContent } from '../types';

// Deutsche Fassung (auch fuer at). Uebersetzung aus es.ts; bei Abweichungen gilt die spanische Fassung.
const de: LegalContent = {
    actualizado: 'Zuletzt aktualisiert',
    nota: 'Diese Übersetzung dient ausschließlich zur Information. Bei Abweichungen ist die spanische Fassung maßgeblich.',
    enlaces: {
        contacto: 'Kontaktformular',
        soporte: 'Support',
        privacidad: 'Datenschutzerklärung',
        terminos: 'Nutzungsbedingungen',
        avisoLegal: 'Impressum',
    },

    privacidad: {
        titulo: 'Datenschutz und Cookies',
        meta: 'Wie Opynio deine personenbezogenen Daten verarbeitet und welche Cookies verwendet werden.',
        secciones: [
            { t: 'Wer deine Daten verarbeitet', p: [
                'Opynio, die Plattform für Unternehmensbewertungen auf dieser Website. Bei Fragen zu deinen Daten schreib uns über das {contacto}.',
            ] },
            { t: 'Welche Daten wir verarbeiten', p: [
                'Wenn du ein Konto erstellst: Name, Benutzername, E-Mail-Adresse, Profilfoto (optional) sowie deine Einstellungen zu Sprache, Land, Design und Benachrichtigungen.',
                'Was du veröffentlichst: Bewertungen, angehängte Fotos oder Audios, Stimmen und Antworten. Bewertungen sind öffentlich und können über unsere Widgets auf der Website des bewerteten Unternehmens angezeigt werden.',
                'Wenn du ein Unternehmen verwaltest: die Angaben in seinem Profil und, wenn du einen Plan abschließt, die Rechnungsdaten, die Stripe verarbeitet (Opynio speichert deine Kartendaten nicht).',
                'Was du uns über den Support oder das Kontaktformular schickst.',
            ] },
            { t: 'Zwecke und Rechtsgrundlagen', p: [
                'Erbringung des Dienstes, den du anforderst: dein Konto, das Veröffentlichen und Moderieren von Bewertungen sowie die Verwaltung deines Unternehmens und deiner Zahlungen.',
                'Sicherheit und Verhinderung von Missbrauch (gefälschte Bewertungen, Spam) auf Grundlage unseres berechtigten Interesses.',
                'E-Mail-Benachrichtigungen über deine Aktivität (Antworten des Supports, neue Bewertungen zu deinem Unternehmen). Du kannst sie in den Einstellungen deaktivieren.',
                'Messung unserer Kampagnen mit Meta, nur wenn du die Analyse- und Werbe-Cookies akzeptierst.',
            ] },
            { t: 'An wen Daten weitergegeben werden', p: [
                'An die Anbieter, die wir für den Betrieb benötigen: Supabase (Hosting und Datenbank), Stripe (Zahlungen), unseren Dienstleister für den E-Mail-Versand und, nur mit deiner Einwilligung, Meta. Wir verkaufen deine Daten nicht.',
            ] },
            { t: 'Wie lange', p: [
                'Solange du dein Konto hast. Wenn du die Löschung beantragst, löschen wir deine Daten, mit Ausnahme der Daten, die wir gesetzlich aufbewahren müssen (zum Beispiel Rechnungen).',
            ] },
            { t: 'Deine Rechte', p: [
                'Du kannst über den {soporte} oder das {contacto} Auskunft, Berichtigung, Löschung, Widerspruch, Einschränkung der Verarbeitung und Übertragbarkeit deiner Daten verlangen. Wenn du damit nicht zufrieden bist, kannst du dich bei der spanischen Datenschutzbehörde (aepd.es) beschweren.',
            ] },
        ],
        cookies: {
            t: 'Cookies',
            intro: 'Wir nutzen den Speicher deines Browsers, damit die Website funktioniert, und – nur wenn du zustimmst – Cookies von Meta, um unsere Kampagnen zu messen.',
            filas: [
                ['Notwendig (immer aktiv)', 'Halten dich angemeldet und speichern deine Einstellungen: Sprache, Land, Design und deine Auswahl zu Cookies.'],
                ['Analyse und Werbung (optional)', 'Meta Pixel (_fbp, _fbc). Werden nur aktiviert, wenn du im Cookie-Hinweis oder unter Einstellungen › Datenschutz zustimmst.'],
            ],
            boton: 'Cookie-Einstellungen',
        },
    },

    avisoLegal: {
        titulo: 'Impressum',
        meta: 'Angaben zum Inhaber von Opynio und Bedingungen für die Nutzung der Website.',
        secciones: [
            { t: 'Inhaber der Website',
              intro: 'Gemäß dem spanischen Gesetz 34/2002 über Dienste der Informationsgesellschaft und den elektronischen Geschäftsverkehr (LSSI-CE) sind dies die Angaben zum Inhaber dieser Website:',
              p: [
                'Inhaber: {titular}',
                'Steuernummer (NIF): {nif}',
                'Anschrift: {domicilio}',
                'Registerangaben: {registro}',
                'E-Mail: {email}',
                'Website: {web}',
            ] },
            { t: 'Gegenstand', p: [
                'Opynio ist eine Plattform, auf der Nutzer Bewertungen über Unternehmen veröffentlichen und Unternehmen ihr Profil verwalten, auf Bewertungen antworten und diese über Widgets auf ihrer Website anzeigen können. Mit der Nutzung der Website akzeptierst du dieses Impressum und die {terminos}.',
            ] },
            { t: 'Geistiges und gewerbliches Eigentum', p: [
                'Das Design, der Code, die Marke Opynio und die eigenen Inhalte der Website gehören ihrem Inhaber oder Dritten, die ihre Nutzung gestattet haben. Sie dürfen ohne Genehmigung weder vervielfältigt noch verbreitet oder umgestaltet werden, außer zum persönlichen und privaten Gebrauch.',
                'Bewertungen gehören denjenigen, die sie verfassen; diese räumen Opynio eine Lizenz zu ihrer Veröffentlichung ein, wie in den {terminos} erläutert.',
                'Die Namen und Marken der bewerteten Unternehmen gehören ihren jeweiligen Inhabern.',
            ] },
            { t: 'Haftung', p: [
                'Bewertungen geben die Meinung ihrer Verfasser wieder, nicht die von Opynio. Wir moderieren Inhalte, um diejenigen zu entfernen, die gegen unsere Regeln oder das Gesetz verstoßen, können aber nicht für die Richtigkeit jeder einzelnen Meinung einstehen. Opynio haftet weder für Schäden infolge einer missbräuchlichen Nutzung der Website noch für den Inhalt von Websites Dritter, auf die von hier aus verlinkt wird.',
            ] },
            { t: 'Rechtswidrige Inhalte', p: [
                'Wenn du der Meinung bist, dass ein auf Opynio veröffentlichter Inhalt rechtswidrig ist oder deine Rechte verletzt, teile uns das über den {soporte} oder das {contacto} mit, und wir prüfen ihn so schnell wie möglich.',
            ] },
            { t: 'Datenschutz', p: [
                'Wie wir deine personenbezogenen Daten verarbeiten, erfährst du in der {privacidad}.',
            ] },
            { t: 'Anwendbares Recht', p: [
                'Dieses Impressum unterliegt spanischem Recht. Für Streitigkeiten sind die nach dem Gesetz zuständigen Gerichte zuständig; wenn du Verbraucher bist, die Gerichte an deinem Wohnsitz.',
            ] },
        ],
    },

    terminos: {
        titulo: 'Nutzungsbedingungen',
        meta: 'Bedingungen für die Nutzung von Opynio als Nutzer oder als Unternehmen: Konto, Bewertungen, Pläne und Regeln.',
        secciones: [
            { t: 'Annahme', p: [
                'Diese Bedingungen regeln die Nutzung von Opynio durch Nutzer und Unternehmen. Indem du ein Konto erstellst oder den Dienst nutzt, akzeptierst du sie; wenn du nicht einverstanden bist, nutze die Plattform nicht. Sie ergänzen das {avisoLegal} und die {privacidad}.',
            ] },
            { t: 'Dein Konto', p: [
                'Um Bewertungen zu schreiben oder ein Unternehmen zu verwalten, brauchst du ein Konto. Du musst das Mindestalter erreicht haben, das das Recht deines Landes vorschreibt (in Spanien 14 Jahre), wahrheitsgemäße Angaben machen und dein Passwort sicher aufbewahren. Du bist für alles verantwortlich, was über dein Konto geschieht.',
            ] },
            { t: 'Bewertungen', p: [
                'Schreib nur über echte Erfahrungen mit dem bewerteten Unternehmen, respektvoll und ohne personenbezogene Daten anderer Personen.',
                'Nicht erlaubt sind gefälschte oder bezahlte Bewertungen, Bewertungen über dein eigenes Unternehmen oder das der Konkurrenz sowie beleidigende, diskriminierende, rechtswidrige oder werbliche Inhalte.',
                'Deine Bewertungen bleiben deine, aber mit ihrer Veröffentlichung räumst du Opynio eine unentgeltliche, weltweite und nicht ausschließliche Lizenz ein, sie auf der Plattform und in den Widgets anzuzeigen, die Unternehmen auf ihrer Website einbinden, solange sie veröffentlicht bleiben.',
                'Wir können Bewertungen, die gegen diese Bedingungen verstoßen, moderieren, ausblenden oder entfernen. Deine eigenen Bewertungen kannst du in deinem Profil bearbeiten oder löschen.',
            ] },
            { t: 'Unternehmen', p: [
                'Wer ein Unternehmensprofil beansprucht oder verwaltet, erklärt, dass er berechtigt ist, dieses Unternehmen zu vertreten.',
                'Unternehmen können auf Bewertungen antworten, dürfen sie aber weder ändern noch ihre Entfernung gegen eine Gegenleistung verlangen noch Anreize für eine positive Bewertung anbieten.',
                'Die Widgets zeigen die Bewertungen so an, wie sie auf Opynio veröffentlicht sind.',
            ] },
            { t: 'Pläne und Zahlungen', p: [
                'Einige Funktionen erfordern einen kostenpflichtigen Plan. Preis und Bedingungen werden vor dem Abschluss angezeigt, und die Zahlung wird über Stripe abgewickelt. Du kannst die Verlängerung jederzeit in deinem Dashboard kündigen; der Plan bleibt bis zum Ende des bezahlten Zeitraums aktiv.',
            ] },
            { t: 'Unzulässige Nutzung', p: [
                'Es ist nicht erlaubt, Opynio zu nutzen, um Spam zu versenden, ohne Erlaubnis automatisiert Daten auszulesen, sich als eine andere Person oder ein anderes Unternehmen auszugeben oder den Betrieb des Dienstes zu stören.',
            ] },
            { t: 'Sperrung und Kontolöschung', p: [
                'Wir können Konten, die gegen diese Bedingungen verstoßen, sperren oder schließen. Du kannst die Löschung deines Kontos jederzeit über den {soporte} beantragen.',
            ] },
            { t: 'Haftung', p: [
                'Wir bemühen uns, dass der Dienst verfügbar ist und fehlerfrei funktioniert, können dies aber nicht jederzeit garantieren. Opynio haftet weder für die Meinungen der Nutzer noch für die Beziehungen zwischen Nutzern und Unternehmen.',
            ] },
            { t: 'Änderungen der Bedingungen', p: [
                'Wir können diese Bedingungen aktualisieren. Bei wesentlichen Änderungen informieren wir dich. Das Datum der letzten Aktualisierung steht oben auf dieser Seite.',
            ] },
            { t: 'Anwendbares Recht', p: [
                'Diese Bedingungen unterliegen spanischem Recht. Wenn du Verbraucher bist, behältst du die Rechte, die dir das Recht deines Wohnsitzlandes gewährt. Bei Fragen schreib uns über den {soporte} oder das {contacto}.',
            ] },
        ],
    },
};

export default de;
