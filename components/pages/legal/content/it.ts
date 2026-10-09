import type { LegalContent } from '../types';

// Versione italiana. Traduzione informativa: prevale la versione spagnola.
const it: LegalContent = {
    actualizado: 'Ultimo aggiornamento',
    nota: 'Questa traduzione è fornita solo a titolo informativo. In caso di discrepanze, prevale la versione spagnola.',
    enlaces: {
        contacto: 'modulo di contatto',
        soporte: 'Supporto',
        privacidad: 'informativa sulla privacy',
        terminos: 'Termini di utilizzo',
        avisoLegal: 'avviso legale',
    },

    privacidad: {
        titulo: 'Privacy e cookie',
        meta: 'Come Opynio tratta i tuoi dati personali e quali cookie utilizza.',
        secciones: [
            { t: 'Chi tratta i tuoi dati', p: [
                'Opynio, la piattaforma di recensioni di aziende di questo sito. Per qualsiasi domanda sui tuoi dati, scrivici tramite il {contacto}.',
            ] },
            { t: 'Quali dati trattiamo', p: [
                'Se crei un account: nome, nome utente, email, foto del profilo (facoltativa) e le tue preferenze di lingua, paese, tema e notifiche.',
                'Ciò che pubblichi: recensioni, foto o audio che alleghi, voti e risposte. Le recensioni sono pubbliche e possono essere mostrate sul sito dell’azienda recensita tramite i nostri widget.',
                'Se gestisci un’azienda: i dati della sua scheda e, se sottoscrivi un piano, i dati di fatturazione, gestiti da Stripe (Opynio non conserva i dati della tua carta).',
                'Ciò che ci invii tramite il supporto o il modulo di contatto.',
            ] },
            { t: 'Finalità e base giuridica', p: [
                'Fornire il servizio che richiedi: il tuo account, la pubblicazione e la moderazione delle recensioni, la gestione della tua azienda e dei tuoi pagamenti.',
                'Sicurezza e prevenzione degli abusi (recensioni false, spam), sulla base del nostro legittimo interesse.',
                'Notifiche via email sulla tua attività (risposte del supporto, nuove recensioni sulla tua azienda). Puoi disattivarle nelle Impostazioni.',
                'Misurare le nostre campagne con Meta, solo se accetti i cookie di misurazione e pubblicità.',
            ] },
            { t: 'Con chi vengono condivisi', p: [
                'Con i fornitori di cui abbiamo bisogno per funzionare: Supabase (hosting e database), Stripe (pagamenti), il nostro fornitore di invio email e, solo con il tuo consenso, Meta. Non vendiamo i tuoi dati.',
            ] },
            { t: 'Per quanto tempo', p: [
                'Finché mantieni l’account. Se ne chiedi l’eliminazione, cancelliamo i tuoi dati, salvo quelli che la legge ci obbliga a conservare (ad esempio, le fatture).',
            ] },
            { t: 'I tuoi diritti', p: [
                'Puoi chiedere l’accesso, la rettifica, la cancellazione, l’opposizione, la limitazione e la portabilità dei tuoi dati tramite {soporte} o il {contacto}. Se non sei soddisfatto, puoi presentare reclamo all’Agenzia spagnola per la protezione dei dati (aepd.es).',
            ] },
        ],
        cookies: {
            t: 'Cookie',
            intro: 'Usiamo la memoria del tuo browser per far funzionare il sito e, solo se accetti, i cookie di Meta per misurare le nostre campagne.',
            filas: [
                ['Necessari (sempre attivi)', 'Mantenere la tua sessione e ricordare le tue preferenze: lingua, paese, tema e la tua scelta sui cookie.'],
                ['Misurazione e pubblicità (facoltativi)', 'Meta Pixel (_fbp, _fbc). Si attivano solo se accetti nell’avviso sui cookie o in Impostazioni › Privacy.'],
            ],
            boton: 'Configura i cookie',
        },
    },

    avisoLegal: {
        titulo: 'Avviso legale',
        meta: 'Dati del titolare di Opynio e condizioni di utilizzo del sito web.',
        secciones: [
            { t: 'Titolare del sito web',
              intro: 'In conformità con la legge spagnola 34/2002 sui servizi della società dell’informazione e sul commercio elettronico (LSSI-CE), questi sono i dati del titolare di questo sito web:',
              p: [
                'Titolare: {titular}',
                'Codice fiscale (NIF): {nif}',
                'Domicilio: {domicilio}',
                'Dati di registrazione: {registro}',
                'Email: {email}',
                'Sito web: {web}',
            ] },
            { t: 'Oggetto', p: [
                'Opynio è una piattaforma in cui gli utenti pubblicano recensioni sulle aziende, e le aziende gestiscono la propria scheda, rispondono alle recensioni e possono mostrarle sul proprio sito tramite widget. L’uso del sito implica l’accettazione del presente avviso legale e dei {terminos}.',
            ] },
            { t: 'Proprietà intellettuale e industriale', p: [
                'Il design, il codice, il marchio Opynio e i contenuti propri del sito appartengono al suo titolare o a terzi che ne hanno autorizzato l’uso. Non è consentito riprodurli, distribuirli o trasformarli senza autorizzazione, salvo per uso personale e privato.',
                'Le recensioni appartengono a chi le scrive, che concede a Opynio una licenza per pubblicarle, come spiegato nei {terminos}.',
                'I nomi e i marchi delle aziende recensite appartengono ai rispettivi titolari.',
            ] },
            { t: 'Responsabilità', p: [
                'Le recensioni esprimono l’opinione di chi le scrive, non quella di Opynio. Moderiamo i contenuti per rimuovere quelli che violano le nostre regole o la legge, ma non possiamo garantire l’esattezza di ogni opinione. Opynio non risponde dei danni derivanti da un uso improprio del sito né del contenuto dei siti di terzi collegati da esso.',
            ] },
            { t: 'Contenuti illeciti', p: [
                'Se ritieni che un contenuto pubblicato su Opynio sia illecito o violi i tuoi diritti, segnalacelo tramite {soporte} o il {contacto} e lo esamineremo il prima possibile.',
            ] },
            { t: 'Protezione dei dati', p: [
                'Il modo in cui trattiamo i tuoi dati personali è spiegato nell’{privacidad}.',
            ] },
            { t: 'Legge applicabile', p: [
                'Il presente avviso legale è regolato dalla legge spagnola. Per qualsiasi controversia saranno competenti i giudici e i tribunali previsti dalla legge; se sei un consumatore, quelli del tuo domicilio.',
            ] },
        ],
    },

    terminos: {
        titulo: 'Termini di utilizzo',
        meta: 'Condizioni per usare Opynio come utente o come azienda: account, recensioni, piani e regole.',
        secciones: [
            { t: 'Accettazione', p: [
                'Questi termini regolano l’uso di Opynio da parte di utenti e aziende. Creando un account o usando il servizio li accetti; se non sei d’accordo, non utilizzare la piattaforma. Integrano l’{avisoLegal} e l’{privacidad}.',
            ] },
            { t: 'Il tuo account', p: [
                'Per scrivere recensioni o gestire un’azienda hai bisogno di un account. Devi avere l’età minima richiesta dalla legge del tuo paese (in Spagna, 14 anni), fornire dati veritieri e mantenere sicura la tua password. Sei responsabile di ciò che viene fatto dal tuo account.',
            ] },
            { t: 'Recensioni', p: [
                'Scrivi solo di esperienze reali con l’azienda recensita, con rispetto e senza includere dati personali di altre persone.',
                'Non sono consentite recensioni false o a pagamento, sulla tua attività o su quella della concorrenza, né contenuti offensivi, discriminatori, illeciti o pubblicitari.',
                'Le recensioni restano tue, ma pubblicandole concedi a Opynio una licenza gratuita, mondiale e non esclusiva per mostrarle sulla piattaforma e nei widget che le aziende inseriscono nel proprio sito, finché restano pubblicate.',
                'Possiamo moderare, nascondere o rimuovere le recensioni che violano questi termini. Puoi modificare o eliminare le tue dal tuo profilo.',
            ] },
            { t: 'Aziende', p: [
                'Chi rivendica o gestisce una scheda dichiara di essere autorizzato a rappresentare quell’azienda.',
                'Le aziende possono rispondere alle recensioni, ma non possono modificarle, chiederne la rimozione in cambio di qualcosa né offrire incentivi in cambio di una valutazione positiva.',
                'I widget mostrano le recensioni così come sono pubblicate su Opynio.',
            ] },
            { t: 'Piani e pagamenti', p: [
                'Alcune funzioni richiedono un piano a pagamento. Il prezzo e le condizioni vengono mostrati prima della sottoscrizione e il pagamento è gestito da Stripe. Puoi annullare il rinnovo quando vuoi dalla tua dashboard; il piano resta attivo fino alla fine del periodo pagato.',
            ] },
            { t: 'Usi non consentiti', p: [
                'Non è consentito usare Opynio per inviare spam, estrarre dati in modo automatizzato senza autorizzazione, spacciarsi per un’altra persona o azienda, né interferire con il funzionamento del servizio.',
            ] },
            { t: 'Sospensione e cancellazione', p: [
                'Possiamo sospendere o chiudere gli account che violano questi termini. Puoi chiedere l’eliminazione del tuo account in qualsiasi momento tramite {soporte}.',
            ] },
            { t: 'Responsabilità', p: [
                'Ci impegniamo affinché il servizio sia disponibile e funzioni senza errori, ma non possiamo garantirlo in ogni momento. Opynio non risponde delle opinioni degli utenti né dei rapporti tra utenti e aziende.',
            ] },
            { t: 'Modifiche ai termini', p: [
                'Possiamo aggiornare questi termini. Se la modifica è importante, ti avviseremo. La data dell’ultimo aggiornamento compare all’inizio di questa pagina.',
            ] },
            { t: 'Legge applicabile', p: [
                'Questi termini sono regolati dalla legge spagnola. Se sei un consumatore, conservi i diritti che ti riconosce la normativa del tuo paese di residenza. Per qualsiasi dubbio, scrivici tramite {soporte} o il {contacto}.',
            ] },
        ],
    },
};

export default it;
