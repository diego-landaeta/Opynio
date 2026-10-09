import type { LegalContent } from '../types';

// Svensk version. Oversatt fran es.ts; vid avvikelser galler den spanska versionen.
const sv: LegalContent = {
    actualizado: 'Senast uppdaterad',
    nota: 'Denna översättning tillhandahålls endast i informationssyfte. Vid eventuella avvikelser har den spanska versionen företräde.',
    enlaces: {
        contacto: 'kontaktformuläret',
        soporte: 'Support',
        privacidad: 'integritetspolicyn',
        terminos: 'användarvillkoren',
        avisoLegal: 'den juridiska informationen',
    },

    privacidad: {
        titulo: 'Integritet och cookies',
        meta: 'Hur Opynio behandlar dina personuppgifter och vilka cookies som används.',
        secciones: [
            { t: 'Vem som behandlar dina uppgifter', p: [
                'Opynio, plattformen för recensioner av företag på den här webbplatsen. Om du har frågor om dina uppgifter kan du skriva till oss via {contacto}.',
            ] },
            { t: 'Vilka uppgifter vi behandlar', p: [
                'Om du skapar ett konto: namn, användarnamn, e-postadress, profilbild (valfritt) och dina inställningar för språk, land, tema och notiser.',
                'Det du publicerar: recensioner, foton eller ljudfiler som du bifogar, röster och svar. Recensionerna är offentliga och kan visas på det recenserade företagets webbplats via våra widgets.',
                'Om du hanterar ett företag: uppgifterna på dess sida och, om du tecknar en plan, faktureringsuppgifterna, som hanteras av Stripe (Opynio sparar inte dina kortuppgifter).',
                'Det du skickar till oss via Support eller kontaktformuläret.',
            ] },
            { t: 'Ändamål och rättslig grund', p: [
                'Att tillhandahålla den tjänst du begär: ditt konto, publicering och moderering av recensioner samt hantering av ditt företag och dina betalningar.',
                'Säkerhet och förebyggande av missbruk (falska recensioner, spam), på grundval av vårt berättigade intresse.',
                'E-postnotiser om din aktivitet (svar från Support, nya recensioner av ditt företag). Du kan stänga av dem under Inställningar.',
                'Mätning av våra kampanjer med Meta, endast om du godkänner mät- och annonscookies.',
            ] },
            { t: 'Vilka vi delar uppgifterna med', p: [
                'Med de leverantörer vi behöver för att fungera: Supabase (hosting och databas), Stripe (betalningar), vår leverantör av e-postutskick och, endast med ditt samtycke, Meta. Vi säljer inte dina uppgifter.',
            ] },
            { t: 'Hur länge', p: [
                'Så länge du har kvar ditt konto. Om du begär att kontot raderas tar vi bort dina uppgifter, utom det som lagen kräver att vi sparar (till exempel fakturor).',
            ] },
            { t: 'Dina rättigheter', p: [
                'Du kan begära tillgång till, rättelse, radering, invändning mot, begränsning av och dataportabilitet för dina uppgifter via {soporte} eller {contacto}. Om du inte är nöjd kan du lämna in ett klagomål till den spanska dataskyddsmyndigheten (aepd.es).',
            ] },
        ],
        cookies: {
            t: 'Cookies',
            intro: 'Vi använder din webbläsares lagring för att webbplatsen ska fungera och, endast om du godkänner det, cookies från Meta för att mäta våra kampanjer.',
            filas: [
                ['Nödvändiga (alltid aktiva)', 'Håller dig inloggad och kommer ihåg dina inställningar: språk, land, tema och ditt val om cookies.'],
                ['Mätning och annonsering (valfria)', 'Meta Pixel (_fbp, _fbc). Aktiveras endast om du godkänner dem i cookiemeddelandet eller under Inställningar › Integritet.'],
            ],
            boton: 'Cookieinställningar',
        },
    },

    avisoLegal: {
        titulo: 'Juridisk information',
        meta: 'Uppgifter om innehavaren av Opynio och villkor för användning av webbplatsen.',
        secciones: [
            { t: 'Webbplatsens innehavare',
              intro: 'I enlighet med den spanska lagen 34/2002 om informationssamhällets tjänster och elektronisk handel (LSSI-CE) är detta uppgifterna om innehavaren av denna webbplats:',
              p: [
                'Innehavare: {titular}',
                'Skatte-ID (NIF): {nif}',
                'Adress: {domicilio}',
                'Registreringsuppgifter: {registro}',
                'E-post: {email}',
                'Webbplats: {web}',
            ] },
            { t: 'Syfte', p: [
                'Opynio är en plattform där användare publicerar recensioner om företag, och där företag hanterar sin sida, svarar på recensioner och kan visa dem på sin webbplats via widgets. Genom att använda webbplatsen godkänner du denna juridiska information och {terminos}.',
            ] },
            { t: 'Immateriella rättigheter', p: [
                'Webbplatsens design, kod, varumärket Opynio och webbplatsens eget innehåll tillhör dess innehavare eller tredje parter som har tillåtit användningen. De får inte återges, spridas eller bearbetas utan tillstånd, utom för personligt och privat bruk.',
                'Recensionerna tillhör den som skriver dem, och denne ger Opynio en licens att publicera dem enligt vad som förklaras i {terminos}.',
                'De recenserade företagens namn och varumärken tillhör sina respektive innehavare.',
            ] },
            { t: 'Ansvar', p: [
                'Recensionerna uttrycker skribentens åsikt, inte Opynios. Vi modererar innehållet för att ta bort det som bryter mot våra regler eller mot lagen, men vi kan inte garantera att varje åsikt är korrekt. Opynio ansvarar inte för skador till följd av felaktig användning av webbplatsen eller för innehållet på tredje parters webbplatser som länkas härifrån.',
            ] },
            { t: 'Olagligt innehåll', p: [
                'Om du anser att innehåll som publicerats på Opynio är olagligt eller kränker dina rättigheter kan du meddela oss via {soporte} eller {contacto}, så granskar vi det så snart som möjligt.',
            ] },
            { t: 'Dataskydd', p: [
                'Hur vi behandlar dina personuppgifter förklaras i {privacidad}.',
            ] },
            { t: 'Tillämplig lag', p: [
                'Denna juridiska information regleras av spansk lag. Tvister avgörs av de domstolar som är behöriga enligt lag; om du är konsument, av domstolarna där du har din hemvist.',
            ] },
        ],
    },

    terminos: {
        titulo: 'Användarvillkor',
        meta: 'Villkor för att använda Opynio som användare eller som företag: konto, recensioner, planer och regler.',
        secciones: [
            { t: 'Godkännande', p: [
                'Dessa villkor reglerar användares och företags användning av Opynio. Genom att skapa ett konto eller använda tjänsten godkänner du dem; om du inte samtycker ska du inte använda plattformen. De kompletterar {avisoLegal} och {privacidad}.',
            ] },
            { t: 'Ditt konto', p: [
                'För att skriva recensioner eller hantera ett företag behöver du ett konto. Du måste ha uppnått den minimiålder som lagen i ditt land kräver (i Spanien 14 år), lämna korrekta uppgifter och skydda ditt lösenord. Du ansvarar för allt som görs från ditt konto.',
            ] },
            { t: 'Recensioner', p: [
                'Skriv bara om verkliga upplevelser av det recenserade företaget, med respekt och utan att ta med andra personers personuppgifter.',
                'Falska eller betalda recensioner, recensioner av ditt eget företag eller av en konkurrents, samt kränkande, diskriminerande, olagligt eller reklammässigt innehåll är inte tillåtna.',
                'Dina recensioner är fortfarande dina, men när du publicerar dem ger du Opynio en kostnadsfri, världsomfattande och icke-exklusiv licens att visa dem på plattformen och i de widgets som företagen bäddar in på sin webbplats, så länge de är publicerade.',
                'Vi kan moderera, dölja eller ta bort recensioner som bryter mot dessa villkor. Du kan redigera eller radera dina egna recensioner från din profil.',
            ] },
            { t: 'Företag', p: [
                'Den som gör anspråk på eller hanterar en företagssida intygar att hen har behörighet att företräda företaget.',
                'Företag får svara på recensioner, men får inte ändra dem, begära att de tas bort mot någon form av ersättning eller erbjuda förmåner i utbyte mot ett positivt betyg.',
                'Widgetarna visar recensionerna exakt så som de är publicerade på Opynio.',
            ] },
            { t: 'Planer och betalningar', p: [
                'Vissa funktioner kräver en betald plan. Pris och villkor visas innan du tecknar planen, och betalningen hanteras av Stripe. Du kan när som helst avbryta förnyelsen från din panel; planen förblir aktiv till slutet av den betalda perioden.',
            ] },
            { t: 'Otillåten användning', p: [
                'Det är inte tillåtet att använda Opynio för att skicka spam, automatiskt hämta data utan tillstånd, utge sig för att vara en annan person eller ett annat företag eller störa tjänstens funktion.',
            ] },
            { t: 'Avstängning och avslutat konto', p: [
                'Vi kan stänga av eller avsluta konton som bryter mot dessa villkor. Du kan när som helst begära att ditt konto raderas via {soporte}.',
            ] },
            { t: 'Ansvar', p: [
                'Vi strävar efter att tjänsten ska vara tillgänglig och fungera utan fel, men vi kan inte garantera det vid varje tidpunkt. Opynio ansvarar inte för användarnas åsikter eller för förhållandet mellan användare och företag.',
            ] },
            { t: 'Ändringar av villkoren', p: [
                'Vi kan uppdatera dessa villkor. Om ändringen är väsentlig meddelar vi dig. Datumet för den senaste uppdateringen visas högst upp på den här sidan.',
            ] },
            { t: 'Tillämplig lag', p: [
                'Dessa villkor regleras av spansk lag. Om du är konsument behåller du de rättigheter som lagstiftningen i ditt bosättningsland ger dig. Om du har frågor kan du skriva till oss via {soporte} eller {contacto}.',
            ] },
        ],
    },
};

export default sv;
