import type { LegalContent } from '../types';

// Nederlandse versie. Informatieve vertaling: de Spaanse versie heeft voorrang.
const nl: LegalContent = {
    actualizado: 'Laatst bijgewerkt',
    nota: 'Deze vertaling wordt uitsluitend ter informatie verstrekt. Bij eventuele verschillen heeft de Spaanse versie voorrang.',
    enlaces: {
        contacto: 'contactformulier',
        soporte: 'Support',
        privacidad: 'privacybeleid',
        terminos: 'Gebruiksvoorwaarden',
        avisoLegal: 'juridische kennisgeving',
    },

    privacidad: {
        titulo: 'Privacy en cookies',
        meta: 'Hoe Opynio je persoonsgegevens verwerkt en welke cookies het gebruikt.',
        secciones: [
            { t: 'Wie je gegevens verwerkt', p: [
                'Opynio, het beoordelingsplatform voor bedrijven op deze site. Voor vragen over je gegevens kun je ons schrijven via het {contacto}.',
            ] },
            { t: 'Welke gegevens we verwerken', p: [
                'Als je een account aanmaakt: naam, gebruikersnaam, e-mailadres, profielfoto (optioneel) en je voorkeuren voor taal, land, thema en meldingen.',
                'Wat je publiceert: beoordelingen, foto’s of audio die je toevoegt, stemmen en reacties. Beoordelingen zijn openbaar en kunnen via onze widgets op de website van het beoordeelde bedrijf worden getoond.',
                'Als je een bedrijf beheert: de gegevens van de bedrijfspagina en, als je een abonnement afsluit, de factuurgegevens, die door Stripe worden verwerkt (Opynio bewaart je kaartgegevens niet).',
                'Wat je ons stuurt via support of het contactformulier.',
            ] },
            { t: 'Waarvoor en op welke grondslag', p: [
                'Het leveren van de dienst die je vraagt: je account, het publiceren en modereren van beoordelingen, het beheer van je bedrijf en je betalingen.',
                'Beveiliging en het voorkomen van misbruik (nepbeoordelingen, spam), op basis van ons gerechtvaardigd belang.',
                'E-mailmeldingen over je activiteit (antwoorden van support, nieuwe beoordelingen van je bedrijf). Je kunt ze uitschakelen in Instellingen.',
                'Het meten van onze campagnes met Meta, alleen als je analyse- en advertentiecookies accepteert.',
            ] },
            { t: 'Met wie we ze delen', p: [
                'Met de leveranciers die we nodig hebben om te functioneren: Supabase (hosting en database), Stripe (betalingen), onze e-mailverzendprovider en, alleen met je toestemming, Meta. We verkopen je gegevens niet.',
            ] },
            { t: 'Hoe lang', p: [
                'Zolang je je account hebt. Als je vraagt om het te verwijderen, wissen we je gegevens, behalve wat we wettelijk moeten bewaren (bijvoorbeeld facturen).',
            ] },
            { t: 'Je rechten', p: [
                'Je kunt via {soporte} of het {contacto} om inzage, rectificatie, wissing, bezwaar, beperking en overdraagbaarheid van je gegevens vragen. Als je niet tevreden bent, kun je een klacht indienen bij de Spaanse gegevensbeschermingsautoriteit (aepd.es).',
            ] },
        ],
        cookies: {
            t: 'Cookies',
            intro: 'We gebruiken de opslag van je browser om de site te laten werken en, alleen als je dat accepteert, cookies van Meta om onze campagnes te meten.',
            filas: [
                ['Noodzakelijk (altijd actief)', 'Je ingelogd houden en je voorkeuren onthouden: taal, land, thema en je keuze over cookies.'],
                ['Analyse en advertenties (optioneel)', 'Meta Pixel (_fbp, _fbc). Worden alleen geactiveerd als je dat accepteert in de cookiemelding of in Instellingen › Privacy.'],
            ],
            boton: 'Cookie-instellingen',
        },
    },

    avisoLegal: {
        titulo: 'Juridische kennisgeving',
        meta: 'Gegevens van de eigenaar van Opynio en de voorwaarden voor het gebruik van de website.',
        secciones: [
            { t: 'Eigenaar van de website',
              intro: 'Overeenkomstig de Spaanse wet 34/2002 inzake diensten van de informatiemaatschappij en elektronische handel (LSSI-CE) zijn dit de gegevens van de eigenaar van deze website:',
              p: [
                'Eigenaar: {titular}',
                'Fiscaal nummer (NIF): {nif}',
                'Adres: {domicilio}',
                'Registratiegegevens: {registro}',
                'E-mail: {email}',
                'Website: {web}',
            ] },
            { t: 'Doel', p: [
                'Opynio is een platform waarop gebruikers beoordelingen over bedrijven publiceren, en bedrijven hun bedrijfspagina beheren, op beoordelingen reageren en deze via widgets op hun eigen website kunnen tonen. Door de site te gebruiken, aanvaard je deze juridische kennisgeving en de {terminos}.',
            ] },
            { t: 'Intellectueel en industrieel eigendom', p: [
                'Het ontwerp, de code, het merk Opynio en de eigen inhoud van de site behoren toe aan de eigenaar ervan of aan derden die toestemming voor het gebruik ervan hebben gegeven. Het is niet toegestaan deze zonder toestemming te verveelvoudigen, te verspreiden of te bewerken, behalve voor persoonlijk en privégebruik.',
                'Beoordelingen behoren toe aan degene die ze schrijft, die Opynio een licentie verleent om ze te publiceren, zoals uitgelegd in de {terminos}.',
                'De namen en merken van de beoordeelde bedrijven behoren toe aan hun respectieve eigenaars.',
            ] },
            { t: 'Aansprakelijkheid', p: [
                'Beoordelingen geven de mening weer van degene die ze schrijft, niet die van Opynio. We modereren de inhoud om alles te verwijderen wat in strijd is met onze regels of de wet, maar we kunnen niet garanderen dat elke mening juist is. Opynio is niet aansprakelijk voor schade als gevolg van oneigenlijk gebruik van de site, noch voor de inhoud van websites van derden waarnaar de site linkt.',
            ] },
            { t: 'Onrechtmatige inhoud', p: [
                'Als je denkt dat inhoud op Opynio onrechtmatig is of inbreuk maakt op je rechten, laat het ons dan weten via {soporte} of het {contacto}, dan bekijken we het zo snel mogelijk.',
            ] },
            { t: 'Gegevensbescherming', p: [
                'Hoe we je persoonsgegevens verwerken, lees je in ons {privacidad}.',
            ] },
            { t: 'Toepasselijk recht', p: [
                'Op deze juridische kennisgeving is het Spaanse recht van toepassing. Geschillen worden voorgelegd aan de rechter die volgens de wet bevoegd is; als je consument bent, aan de rechter van je woonplaats.',
            ] },
        ],
    },

    terminos: {
        titulo: 'Gebruiksvoorwaarden',
        meta: 'Voorwaarden voor het gebruik van Opynio als gebruiker of als bedrijf: account, beoordelingen, abonnementen en regels.',
        secciones: [
            { t: 'Aanvaarding', p: [
                'Deze voorwaarden regelen het gebruik van Opynio door gebruikers en bedrijven. Door een account aan te maken of de dienst te gebruiken, aanvaard je ze; als je het er niet mee eens bent, gebruik het platform dan niet. Ze vormen een aanvulling op de {avisoLegal} en het {privacidad}.',
            ] },
            { t: 'Je account', p: [
                'Om beoordelingen te schrijven of een bedrijf te beheren, heb je een account nodig. Je moet de minimumleeftijd hebben die de wet van je land vereist (in Spanje 14 jaar), juiste gegevens verstrekken en je wachtwoord veilig bewaren. Je bent verantwoordelijk voor wat er vanaf je account gebeurt.',
            ] },
            { t: 'Beoordelingen', p: [
                'Schrijf alleen over echte ervaringen met het beoordeelde bedrijf, respectvol en zonder persoonsgegevens van anderen op te nemen.',
                'Nep- of betaalde beoordelingen, beoordelingen van je eigen bedrijf of dat van een concurrent, en aanstootgevende, discriminerende, onrechtmatige of reclame-inhoud zijn niet toegestaan.',
                'Je beoordelingen blijven van jou, maar door ze te publiceren verleen je Opynio een kosteloze, wereldwijde, niet-exclusieve licentie om ze te tonen op het platform en in de widgets die bedrijven op hun website plaatsen, zolang ze gepubliceerd blijven.',
                'We kunnen beoordelingen die in strijd zijn met deze voorwaarden modereren, verbergen of verwijderen. Je kunt je eigen beoordelingen bewerken of verwijderen via je profiel.',
            ] },
            { t: 'Bedrijven', p: [
                'Wie een bedrijfspagina claimt of beheert, verklaart bevoegd te zijn om dat bedrijf te vertegenwoordigen.',
                'Bedrijven mogen op beoordelingen reageren, maar mogen ze niet wijzigen, niet in ruil voor iets om verwijdering ervan vragen en geen voordelen aanbieden in ruil voor een positieve beoordeling.',
                'Widgets tonen beoordelingen precies zoals ze op Opynio zijn gepubliceerd.',
            ] },
            { t: 'Abonnementen en betalingen', p: [
                'Sommige functies vereisen een betaald abonnement. De prijs en voorwaarden worden getoond voordat je afsluit en de betaling wordt afgehandeld door Stripe. Je kunt de verlenging op elk moment opzeggen via je dashboard; het abonnement blijft actief tot het einde van de betaalde periode.',
            ] },
            { t: 'Niet-toegestaan gebruik', p: [
                'Het is niet toegestaan Opynio te gebruiken om spam te versturen, zonder toestemming geautomatiseerd gegevens te verzamelen, je voor te doen als een andere persoon of een ander bedrijf, of de werking van de dienst te verstoren.',
            ] },
            { t: 'Opschorting en opzegging', p: [
                'We kunnen accounts die in strijd zijn met deze voorwaarden opschorten of sluiten. Je kunt op elk moment via {soporte} vragen om je account te verwijderen.',
            ] },
            { t: 'Aansprakelijkheid', p: [
                'We doen ons best om de dienst beschikbaar en foutloos te houden, maar we kunnen dat niet altijd garanderen. Opynio is niet aansprakelijk voor de meningen van gebruikers of voor de relaties tussen gebruikers en bedrijven.',
            ] },
            { t: 'Wijzigingen in de voorwaarden', p: [
                'We kunnen deze voorwaarden bijwerken. Bij een belangrijke wijziging laten we het je weten. De datum van de laatste update staat bovenaan deze pagina.',
            ] },
            { t: 'Toepasselijk recht', p: [
                'Op deze voorwaarden is het Spaanse recht van toepassing. Als je consument bent, behoud je de rechten die de wetgeving van je woonland je toekent. Heb je vragen? Schrijf ons via {soporte} of het {contacto}.',
            ] },
        ],
    },
};

export default nl;
