import type { LegalContent } from '../types';

// Wersja polska. Tlumaczenie z es.ts; w razie rozbieznosci rozstrzyga wersja hiszpanska.
const pl: LegalContent = {
    actualizado: 'Ostatnia aktualizacja',
    nota: 'To tłumaczenie ma wyłącznie charakter informacyjny. W razie jakichkolwiek rozbieżności rozstrzygająca jest wersja hiszpańska.',
    enlaces: {
        contacto: 'formularz kontaktowy',
        soporte: 'Pomoc',
        privacidad: 'polityka prywatności',
        terminos: 'Regulamin',
        avisoLegal: 'informacje prawne',
    },

    privacidad: {
        titulo: 'Prywatność i pliki cookie',
        meta: 'Jak Opynio przetwarza Twoje dane osobowe i jakich plików cookie używa.',
        secciones: [
            { t: 'Kto przetwarza Twoje dane', p: [
                'Opynio, platforma z opiniami o firmach dostępna w tym serwisie. W każdej sprawie dotyczącej Twoich danych napisz do nas przez {contacto}.',
            ] },
            { t: 'Jakie dane przetwarzamy', p: [
                'Jeśli zakładasz konto: imię, nazwę użytkownika, adres e-mail, zdjęcie profilowe (opcjonalnie) oraz Twoje preferencje dotyczące języka, kraju, motywu i powiadomień.',
                'To, co publikujesz: opinie, dołączone zdjęcia lub nagrania audio, głosy i odpowiedzi. Opinie są publiczne i mogą być wyświetlane na stronie internetowej ocenianej firmy za pomocą naszych widżetów.',
                'Jeśli zarządzasz firmą: dane jej strony w serwisie oraz, jeśli wykupisz plan, dane rozliczeniowe, którymi zarządza Stripe (Opynio nie przechowuje danych Twojej karty).',
                'To, co wysyłasz nam przez Pomoc lub formularz kontaktowy.',
            ] },
            { t: 'W jakim celu i na jakiej podstawie', p: [
                'Świadczenie usługi, o którą prosisz: obsługa Twojego konta, publikowanie i moderowanie opinii, zarządzanie Twoją firmą i płatnościami.',
                'Bezpieczeństwo i zapobieganie nadużyciom (fałszywe opinie, spam) na podstawie naszego prawnie uzasadnionego interesu.',
                'Powiadomienia e-mail o Twojej aktywności (odpowiedzi Pomocy, nowe opinie o Twojej firmie). Możesz je wyłączyć w Ustawieniach.',
                'Mierzenie skuteczności naszych kampanii z pomocą Meta, wyłącznie jeśli zaakceptujesz analityczne i reklamowe pliki cookie.',
            ] },
            { t: 'Komu udostępniamy dane', p: [
                'Dostawcom, których potrzebujemy do działania serwisu: Supabase (hosting i baza danych), Stripe (płatności), naszemu dostawcy usługi wysyłki e-maili oraz, wyłącznie za Twoją zgodą, Meta. Nie sprzedajemy Twoich danych.',
            ] },
            { t: 'Jak długo', p: [
                'Dopóki masz konto. Jeśli poprosisz o jego usunięcie, usuniemy Twoje dane, z wyjątkiem tych, które musimy przechowywać na mocy prawa (na przykład faktur).',
            ] },
            { t: 'Twoje prawa', p: [
                'Przez {soporte} lub {contacto} możesz zażądać dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia przetwarzania i przeniesienia, a także wnieść sprzeciw wobec ich przetwarzania. W razie braku satysfakcji możesz złożyć skargę do Hiszpańskiej Agencji Ochrony Danych (aepd.es).',
            ] },
        ],
        cookies: {
            t: 'Pliki cookie',
            intro: 'Korzystamy z pamięci Twojej przeglądarki, aby strona działała, a wyłącznie za Twoją zgodą także z plików cookie Meta, aby mierzyć skuteczność naszych kampanii.',
            filas: [
                ['Niezbędne (zawsze włączone)', 'Utrzymują Twoją sesję i zapamiętują Twoje preferencje: język, kraj, motyw i Twój wybór dotyczący plików cookie.'],
                ['Analityczne i reklamowe (opcjonalne)', 'Meta Pixel (_fbp, _fbc). Są włączane tylko wtedy, gdy wyrazisz zgodę w komunikacie o plikach cookie lub w sekcji Ustawienia › Prywatność.'],
            ],
            boton: 'Ustawienia plików cookie',
        },
    },

    avisoLegal: {
        titulo: 'Informacje prawne',
        meta: 'Dane właściciela Opynio i warunki korzystania ze strony internetowej.',
        secciones: [
            { t: 'Właściciel strony internetowej',
              intro: 'Zgodnie z hiszpańską ustawą 34/2002 o usługach społeczeństwa informacyjnego i handlu elektronicznym (LSSI-CE) poniżej podajemy dane właściciela tej strony internetowej:',
              p: [
                'Właściciel: {titular}',
                'Numer identyfikacji podatkowej (NIF): {nif}',
                'Adres siedziby: {domicilio}',
                'Dane rejestrowe: {registro}',
                'E-mail: {email}',
                'Strona internetowa: {web}',
            ] },
            { t: 'Przedmiot', p: [
                'Opynio to platforma, na której użytkownicy publikują opinie o firmach, a firmy zarządzają swoją stroną, odpowiadają na opinie i mogą wyświetlać je na swojej stronie internetowej za pomocą widżetów. Korzystając z serwisu, akceptujesz niniejsze informacje prawne oraz {terminos}.',
            ] },
            { t: 'Własność intelektualna i przemysłowa', p: [
                'Projekt graficzny, kod, marka Opynio i własne treści serwisu należą do jego właściciela lub do osób trzecich, które zezwoliły na ich wykorzystanie. Nie wolno ich powielać, rozpowszechniać ani przetwarzać bez zgody, z wyjątkiem użytku osobistego i prywatnego.',
                'Opinie należą do ich autorów, którzy udzielają Opynio licencji na ich publikację na zasadach, które określa {terminos}.',
                'Nazwy i znaki towarowe ocenianych firm należą do ich właścicieli.',
            ] },
            { t: 'Odpowiedzialność', p: [
                'Opinie wyrażają zdanie ich autorów, a nie Opynio. Moderujemy treści, aby usuwać te, które naruszają nasze zasady lub prawo, ale nie możemy zagwarantować prawdziwości każdej opinii. Opynio nie odpowiada za szkody wynikające z niewłaściwego korzystania z serwisu ani za treść stron internetowych osób trzecich, do których prowadzą z niego linki.',
            ] },
            { t: 'Treści niezgodne z prawem', p: [
                'Jeśli uważasz, że treść opublikowana w Opynio jest niezgodna z prawem lub narusza Twoje prawa, zgłoś to nam przez {soporte} lub {contacto}, a sprawdzimy ją najszybciej, jak to możliwe.',
            ] },
            { t: 'Ochrona danych', p: [
                'Sposób przetwarzania Twoich danych osobowych opisuje {privacidad}.',
            ] },
            { t: 'Prawo właściwe', p: [
                'Niniejsze informacje prawne podlegają prawu hiszpańskiemu. Spory rozstrzygają sądy właściwe zgodnie z przepisami prawa; jeśli jesteś konsumentem — sądy właściwe dla Twojego miejsca zamieszkania.',
            ] },
        ],
    },

    terminos: {
        titulo: 'Regulamin',
        meta: 'Zasady korzystania z Opynio jako użytkownik lub firma: konto, opinie, plany i reguły.',
        secciones: [
            { t: 'Akceptacja', p: [
                'Niniejszy Regulamin określa zasady korzystania z Opynio przez użytkowników i firmy. Zakładając konto lub korzystając z usługi, akceptujesz go; jeśli się z nim nie zgadzasz, nie korzystaj z platformy. Niniejszy Regulamin uzupełniają {avisoLegal} oraz {privacidad}.',
            ] },
            { t: 'Twoje konto', p: [
                'Aby pisać opinie lub zarządzać firmą, potrzebujesz konta. Musisz mieć ukończony minimalny wiek wymagany przez prawo Twojego kraju (w Hiszpanii 14 lat), podawać prawdziwe dane i dbać o bezpieczeństwo swojego hasła. Odpowiadasz za wszystko, co dzieje się na Twoim koncie.',
            ] },
            { t: 'Opinie', p: [
                'Pisz wyłącznie o prawdziwych doświadczeniach z ocenianą firmą, z szacunkiem i bez podawania danych osobowych innych osób.',
                'Niedozwolone są fałszywe lub opłacone opinie, opinie o własnej firmie lub o firmie konkurencji, a także treści obraźliwe, dyskryminujące, niezgodne z prawem lub reklamowe.',
                'Opinie pozostają Twoje, ale publikując je, udzielasz Opynio nieodpłatnej, światowej i niewyłącznej licencji na wyświetlanie ich na platformie oraz w widżetach, które firmy umieszczają na swoich stronach internetowych, dopóki pozostają opublikowane.',
                'Możemy moderować, ukrywać lub usuwać opinie naruszające niniejszy Regulamin. Swoje opinie możesz edytować lub usuwać w swoim profilu.',
            ] },
            { t: 'Firmy', p: [
                'Osoba, która przejmuje lub zarządza stroną firmy, oświadcza, że jest upoważniona do reprezentowania tej firmy.',
                'Firmy mogą odpowiadać na opinie, ale nie mogą ich zmieniać, żądać ich usunięcia w zamian za jakąkolwiek korzyść ani oferować zachęt w zamian za pozytywną ocenę.',
                'Widżety wyświetlają opinie w takiej postaci, w jakiej zostały opublikowane w Opynio.',
            ] },
            { t: 'Plany i płatności', p: [
                'Niektóre funkcje wymagają płatnego planu. Cena i warunki są wyświetlane przed zakupem, a płatności obsługuje Stripe. Możesz w każdej chwili anulować odnowienie w swoim panelu; plan pozostaje aktywny do końca opłaconego okresu.',
            ] },
            { t: 'Niedozwolone działania', p: [
                'Nie wolno używać Opynio do wysyłania spamu, automatycznego pobierania danych bez zgody, podszywania się pod inną osobę lub firmę ani zakłócania działania usługi.',
            ] },
            { t: 'Zawieszenie i usunięcie konta', p: [
                'Możemy zawiesić lub zamknąć konta naruszające niniejszy Regulamin. W każdej chwili możesz poprosić o usunięcie swojego konta przez {soporte}.',
            ] },
            { t: 'Odpowiedzialność', p: [
                'Dokładamy starań, aby usługa była dostępna i działała bez błędów, ale nie możemy tego zagwarantować w każdym momencie. Opynio nie odpowiada za opinie użytkowników ani za relacje między użytkownikami a firmami.',
            ] },
            { t: 'Zmiany Regulaminu', p: [
                'Możemy aktualizować niniejszy Regulamin. Jeśli zmiana będzie istotna, poinformujemy Cię o tym. Data ostatniej aktualizacji znajduje się na początku tej strony.',
            ] },
            { t: 'Prawo właściwe', p: [
                'Niniejszy Regulamin podlega prawu hiszpańskiemu. Jeśli jesteś konsumentem, zachowujesz prawa przysługujące Ci na mocy przepisów kraju Twojego zamieszkania. W razie pytań napisz do nas przez {soporte} lub {contacto}.',
            ] },
        ],
    },
};

export default pl;
