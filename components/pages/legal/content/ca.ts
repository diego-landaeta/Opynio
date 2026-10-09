import type { LegalContent } from '../types';

// Versio en catala. Traduccio informativa: prevaleix la versio en espanyol.
const ca: LegalContent = {
    actualizado: 'Darrera actualització',
    nota: 'Aquesta traducció es proporciona només a títol informatiu. En cas de discrepància, preval la versió en castellà.',
    enlaces: {
        contacto: 'formulari de contacte',
        soporte: 'Suport',
        privacidad: 'política de privadesa',
        terminos: 'Termes d’ús',
        avisoLegal: 'avís legal',
    },

    privacidad: {
        titulo: 'Privadesa i galetes',
        meta: 'Com tracta Opynio les teves dades personals i quines galetes fa servir.',
        secciones: [
            { t: 'Qui tracta les teves dades', p: [
                'Opynio, la plataforma de ressenyes d’empreses d’aquest lloc web. Per a qualsevol qüestió sobre les teves dades, escriu-nos des del {contacto}.',
            ] },
            { t: 'Quines dades tractem', p: [
                'Si crees un compte: nom, nom d’usuari, correu electrònic, foto de perfil (opcional) i les teves preferències d’idioma, país, tema i avisos.',
                'El que publiques: ressenyes, fotos o àudios que hi adjuntis, vots i respostes. Les ressenyes són públiques i es poden mostrar al web de l’empresa ressenyada mitjançant els nostres widgets.',
                'Si gestiones una empresa: les dades de la seva fitxa i, si contractes un pla, les dades de facturació, que gestiona Stripe (Opynio no desa les dades de la teva targeta).',
                'El que ens envies a través de suport o del formulari de contacte.',
            ] },
            { t: 'Per a què i amb quina base', p: [
                'Prestar el servei que demanes: el teu compte, publicar i moderar ressenyes, gestionar la teva empresa i els teus pagaments.',
                'Seguretat i prevenció d’abusos (ressenyes falses, spam), pel nostre interès legítim.',
                'Avisos per correu sobre la teva activitat (respostes de suport, ressenyes noves a la teva empresa). Els pots desactivar a Configuració.',
                'Mesurar les nostres campanyes amb Meta, només si acceptes les galetes de mesurament i publicitat.',
            ] },
            { t: 'Amb qui es comparteixen', p: [
                'Amb els proveïdors que necessitem per funcionar: Supabase (allotjament i base de dades), Stripe (pagaments), el nostre proveïdor d’enviament de correus i, només amb el teu permís, Meta. No venem les teves dades.',
            ] },
            { t: 'Quant de temps', p: [
                'Mentre tinguis el compte. Si en demanes l’eliminació, esborrem les teves dades excepte el que la llei ens obligui a conservar (per exemple, factures).',
            ] },
            { t: 'Els teus drets', p: [
                'Pots demanar l’accés, la rectificació, la supressió, l’oposició, la limitació i la portabilitat de les teves dades des de {soporte} o des del {contacto}. Si no hi estàs conforme, pots presentar una reclamació davant l’Agència Espanyola de Protecció de Dades (aepd.es).',
            ] },
        ],
        cookies: {
            t: 'Galetes',
            intro: 'Fem servir l’emmagatzematge del teu navegador perquè el web funcioni i, només si ho acceptes, galetes de Meta per mesurar les nostres campanyes.',
            filas: [
                ['Necessàries (sempre actives)', 'Mantenir la teva sessió i recordar les teves preferències: idioma, país, tema i la teva elecció sobre galetes.'],
                ['Mesurament i publicitat (opcionals)', 'Meta Pixel (_fbp, _fbc). Només s’activen si ho acceptes a l’avís de galetes o a Configuració › Privadesa.'],
            ],
            boton: 'Configura les galetes',
        },
    },

    avisoLegal: {
        titulo: 'Avís legal',
        meta: 'Dades del titular d’Opynio i condicions d’ús del lloc web.',
        secciones: [
            { t: 'Titular del lloc web',
              intro: 'En compliment de la Llei espanyola 34/2002, de serveis de la societat de la informació i de comerç electrònic (LSSI-CE), aquestes són les dades del titular d’aquest lloc web:',
              p: [
                'Titular: {titular}',
                'NIF: {nif}',
                'Domicili: {domicilio}',
                'Dades registrals: {registro}',
                'Correu electrònic: {email}',
                'Lloc web: {web}',
            ] },
            { t: 'Objecte', p: [
                'Opynio és una plataforma en què els usuaris publiquen ressenyes sobre empreses, i les empreses gestionen la seva fitxa, responen a les ressenyes i les poden mostrar al seu web mitjançant widgets. Fer servir el lloc implica acceptar aquest avís legal i els {terminos}.',
            ] },
            { t: 'Propietat intel·lectual i industrial', p: [
                'El disseny, el codi, la marca Opynio i els continguts propis del lloc pertanyen al seu titular o a tercers que n’han autoritzat l’ús. No es permet reproduir-los, distribuir-los ni transformar-los sense autorització, excepte per a ús personal i privat.',
                'Les ressenyes pertanyen a qui les escriu, que concedeix a Opynio una llicència per publicar-les, tal com s’explica als {terminos}.',
                'Els noms i les marques de les empreses ressenyades pertanyen als seus respectius titulars.',
            ] },
            { t: 'Responsabilitat', p: [
                'Les ressenyes expressen l’opinió de qui les escriu, no la d’Opynio. Moderem els continguts per retirar els que incompleixen les nostres normes o la llei, però no podem garantir l’exactitud de cada opinió. Opynio no respon dels danys derivats d’un ús indegut del lloc ni del contingut dels webs de tercers enllaçats des d’aquest.',
            ] },
            { t: 'Continguts il·lícits', p: [
                'Si creus que un contingut publicat a Opynio és il·lícit o vulnera els teus drets, fes-nos-ho saber des de {soporte} o des del {contacto} i el revisarem com més aviat millor.',
            ] },
            { t: 'Protecció de dades', p: [
                'Com tractem les teves dades personals s’explica a la {privacidad}.',
            ] },
            { t: 'Legislació aplicable', p: [
                'Aquest avís legal es regeix per la legislació espanyola. Per a qualsevol controvèrsia seran competents els jutjats i tribunals que corresponguin segons la llei; si ets consumidor, els del teu domicili.',
            ] },
        ],
    },

    terminos: {
        titulo: 'Termes d’ús',
        meta: 'Condicions per fer servir Opynio com a usuari o com a empresa: compte, ressenyes, plans i normes.',
        secciones: [
            { t: 'Acceptació', p: [
                'Aquests termes regulen l’ús d’Opynio per part d’usuaris i empreses. En crear un compte o fer servir el servei, els acceptes; si no hi estàs d’acord, no utilitzis la plataforma. Complementen l’{avisoLegal} i la {privacidad}.',
            ] },
            { t: 'El teu compte', p: [
                'Per escriure ressenyes o gestionar una empresa necessites un compte. Has de tenir l’edat mínima que exigeixi la llei del teu país (a Espanya, 14 anys), donar dades veritables i mantenir segura la teva contrasenya. Ets responsable del que es faci des del teu compte.',
            ] },
            { t: 'Ressenyes', p: [
                'Escriu només sobre experiències reals amb l’empresa ressenyada, amb respecte i sense incloure dades personals d’altres persones.',
                'No es permeten ressenyes falses o pagades, sobre el teu propi negoci o el de la competència, ni continguts ofensius, discriminatoris, il·lícits o publicitaris.',
                'Les ressenyes continuen sent teves, però en publicar-les concedeixes a Opynio una llicència gratuïta, mundial i no exclusiva per mostrar-les a la plataforma i als widgets que les empreses insereixen al seu web, mentre continuïn publicades.',
                'Podem moderar, amagar o retirar les ressenyes que incompleixin aquests termes. Pots editar o eliminar les teves des del teu perfil.',
            ] },
            { t: 'Empreses', p: [
                'Qui reclama o gestiona una fitxa declara que està autoritzat per representar aquesta empresa.',
                'Les empreses poden respondre a les ressenyes, però no les poden modificar, demanar-ne la retirada a canvi d’alguna cosa ni oferir incentius a canvi d’una valoració positiva.',
                'Els widgets mostren les ressenyes tal com estan publicades a Opynio.',
            ] },
            { t: 'Plans i pagaments', p: [
                'Algunes funcions requereixen un pla de pagament. El preu i les condicions es mostren abans de contractar i el cobrament el gestiona Stripe. Pots cancel·lar la renovació quan vulguis des del teu tauler; el pla continua actiu fins al final del període pagat.',
            ] },
            { t: 'Usos no permesos', p: [
                'No es permet fer servir Opynio per enviar spam, extreure dades de manera automatitzada sense permís, fer-se passar per una altra persona o empresa, ni interferir en el funcionament del servei.',
            ] },
            { t: 'Suspensió i baixa', p: [
                'Podem suspendre o tancar els comptes que incompleixin aquests termes. Pots demanar l’eliminació del teu compte en qualsevol moment des de {soporte}.',
            ] },
            { t: 'Responsabilitat', p: [
                'Procurem que el servei estigui disponible i funcioni sense errors, però no ho podem garantir en tot moment. Opynio no respon de les opinions dels usuaris ni de les relacions entre usuaris i empreses.',
            ] },
            { t: 'Canvis en els termes', p: [
                'Podem actualitzar aquests termes. Si el canvi és important, t’avisarem. La data de l’última actualització apareix al principi d’aquesta pàgina.',
            ] },
            { t: 'Legislació aplicable', p: [
                'Aquests termes es regeixen per la legislació espanyola. Si ets consumidor, conserves els drets que et reconegui la normativa del teu país de residència. Per a qualsevol dubte, escriu-nos des de {soporte} o des del {contacto}.',
            ] },
        ],
    },
};

export default ca;
