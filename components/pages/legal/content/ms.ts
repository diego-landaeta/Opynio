import type { LegalContent } from '../types';

const ms: LegalContent = {
    actualizado: 'Kemas kini terakhir',
    nota: 'Terjemahan ini disediakan untuk makluman sahaja. Jika terdapat sebarang percanggahan, versi bahasa Sepanyol akan diguna pakai.',
    enlaces: {
        contacto: 'borang hubungan',
        soporte: 'Sokongan',
        privacidad: 'dasar privasi',
        terminos: 'Terma Penggunaan',
        avisoLegal: 'Notis Undang-undang',
    },

    privacidad: {
        titulo: 'Privasi dan kuki',
        meta: 'Cara Opynio memproses data peribadi anda dan kuki yang digunakannya.',
        secciones: [
            { t: 'Siapa yang memproses data anda', p: [
                'Opynio, platform ulasan perniagaan di laman web ini. Untuk sebarang pertanyaan tentang data anda, hubungi kami melalui {contacto}.',
            ] },
            { t: 'Data yang kami proses', p: [
                'Jika anda membuat akaun: nama, nama pengguna, e-mel, foto profil (pilihan) serta pilihan bahasa, negara, tema dan pemberitahuan anda.',
                'Apa yang anda terbitkan: ulasan, foto atau audio yang anda lampirkan, undian dan balasan. Ulasan adalah awam dan boleh dipaparkan di laman web perniagaan yang diulas melalui widget kami.',
                'Jika anda mengurus perniagaan: butiran profilnya dan, jika anda melanggan pelan, data pengebilan yang diuruskan oleh Stripe (Opynio tidak menyimpan butiran kad anda).',
                'Apa yang anda hantar kepada kami melalui sokongan atau borang hubungan.',
            ] },
            { t: 'Tujuan dan asas', p: [
                'Menyediakan perkhidmatan yang anda minta: akaun anda, penerbitan dan moderasi ulasan, serta pengurusan perniagaan dan pembayaran anda.',
                'Keselamatan dan pencegahan penyalahgunaan (ulasan palsu, spam), berdasarkan kepentingan sah kami.',
                'Pemberitahuan e-mel tentang aktiviti anda (balasan sokongan, ulasan baharu untuk perniagaan anda). Anda boleh menyahaktifkannya dalam Tetapan.',
                'Mengukur kempen kami dengan Meta, hanya jika anda menerima kuki pengukuran dan iklan.',
            ] },
            { t: 'Dengan siapa data dikongsi', p: [
                'Dengan penyedia yang kami perlukan untuk beroperasi: Supabase (pengehosan dan pangkalan data), Stripe (pembayaran), penyedia perkhidmatan penghantaran e-mel kami dan, hanya dengan kebenaran anda, Meta. Kami tidak menjual data anda.',
            ] },
            { t: 'Berapa lama', p: [
                'Selagi anda mempunyai akaun. Jika anda meminta untuk memadamnya, kami memadam data anda kecuali apa yang diwajibkan oleh undang-undang untuk kami simpan (contohnya, invois).',
            ] },
            { t: 'Hak anda', p: [
                'Anda boleh meminta akses, pembetulan, pemadaman, bantahan, sekatan dan kemudahalihan data anda melalui {soporte} atau {contacto}. Jika anda tidak berpuas hati, anda boleh membuat aduan kepada Agensi Perlindungan Data Sepanyol (aepd.es).',
            ] },
        ],
        cookies: {
            t: 'Kuki',
            intro: 'Kami menggunakan storan pelayar anda supaya laman web berfungsi dan, hanya jika anda menerimanya, kuki Meta untuk mengukur kempen kami.',
            filas: [
                ['Diperlukan (sentiasa aktif)', 'Mengekalkan sesi anda dan mengingati pilihan anda: bahasa, negara, tema dan pilihan kuki anda.'],
                ['Pengukuran dan iklan (pilihan)', 'Meta Pixel (_fbp, _fbc). Hanya diaktifkan jika anda menerimanya dalam notis kuki atau dalam Tetapan › Privasi.'],
            ],
            boton: 'Tetapkan kuki',
        },
    },

    avisoLegal: {
        titulo: 'Notis Undang-undang',
        meta: 'Butiran pemilik Opynio dan syarat penggunaan laman web.',
        secciones: [
            { t: 'Pemilik laman web',
              intro: 'Selaras dengan Undang-undang Sepanyol 34/2002 mengenai perkhidmatan masyarakat maklumat dan perdagangan elektronik (LSSI-CE), berikut ialah butiran pemilik laman web ini:',
              p: [
                'Pemilik: {titular}',
                'No. cukai (NIF): {nif}',
                'Alamat berdaftar: {domicilio}',
                'Butiran pendaftaran: {registro}',
                'E-mel: {email}',
                'Laman web: {web}',
            ] },
            { t: 'Tujuan', p: [
                'Opynio ialah platform tempat pengguna menerbitkan ulasan tentang perniagaan, dan perniagaan mengurus profil mereka, membalas ulasan dan boleh memaparkannya di laman web mereka melalui widget. Menggunakan laman web ini bermakna anda menerima Notis Undang-undang ini dan {terminos}.',
            ] },
            { t: 'Harta intelek dan perindustrian', p: [
                'Reka bentuk, kod, jenama Opynio dan kandungan asal laman web ini adalah milik pemiliknya atau pihak ketiga yang telah membenarkan penggunaannya. Semua ini tidak boleh diterbitkan semula, diedarkan atau diubah tanpa kebenaran, kecuali untuk kegunaan peribadi dan persendirian.',
                'Ulasan adalah milik penulisnya, yang memberikan lesen kepada Opynio untuk menerbitkannya, seperti yang diterangkan dalam {terminos}.',
                'Nama dan tanda dagangan perniagaan yang diulas adalah milik pemilik masing-masing.',
            ] },
            { t: 'Liabiliti', p: [
                'Ulasan menyatakan pendapat penulisnya, bukan pendapat Opynio. Kami memoderasi kandungan untuk menarik balik kandungan yang melanggar peraturan kami atau undang-undang, tetapi kami tidak dapat menjamin ketepatan setiap pendapat. Opynio tidak bertanggungjawab atas kerosakan akibat penyalahgunaan laman web ini atau atas kandungan laman web pihak ketiga yang dipautkan daripadanya.',
            ] },
            { t: 'Kandungan yang menyalahi undang-undang', p: [
                'Jika anda percaya bahawa kandungan yang diterbitkan di Opynio menyalahi undang-undang atau melanggar hak anda, maklumkan kepada kami melalui {soporte} atau {contacto} dan kami akan menyemaknya secepat mungkin.',
            ] },
            { t: 'Perlindungan data', p: [
                'Cara kami memproses data peribadi anda diterangkan dalam {privacidad}.',
            ] },
            { t: 'Undang-undang yang terpakai', p: [
                'Notis Undang-undang ini ditadbir oleh undang-undang Sepanyol. Sebarang pertikaian akan diputuskan oleh mahkamah yang berbidang kuasa menurut undang-undang; jika anda seorang pengguna (dalam erti kata undang-undang perlindungan pengguna), oleh mahkamah di tempat tinggal anda.',
            ] },
        ],
    },

    terminos: {
        titulo: 'Terma Penggunaan',
        meta: 'Syarat untuk menggunakan Opynio sebagai pengguna atau perniagaan: akaun, ulasan, pelan dan peraturan.',
        secciones: [
            { t: 'Penerimaan', p: [
                'Terma ini mengawal penggunaan Opynio oleh pengguna dan perniagaan. Dengan membuat akaun atau menggunakan perkhidmatan, anda menerimanya; jika anda tidak bersetuju, jangan gunakan platform ini. Terma ini melengkapkan {avisoLegal} dan {privacidad}.',
            ] },
            { t: 'Akaun anda', p: [
                'Untuk menulis ulasan atau mengurus perniagaan, anda memerlukan akaun. Anda mesti mencapai umur minimum yang ditetapkan oleh undang-undang negara anda (di Sepanyol, 14 tahun), memberikan maklumat yang benar dan memastikan kata laluan anda selamat. Anda bertanggungjawab atas apa yang dilakukan melalui akaun anda.',
            ] },
            { t: 'Ulasan', p: [
                'Tulis hanya tentang pengalaman sebenar dengan perniagaan yang diulas, dengan hormat dan tanpa memasukkan data peribadi orang lain.',
                'Ulasan palsu atau berbayar, ulasan tentang perniagaan anda sendiri atau perniagaan pesaing, serta kandungan yang menyinggung, diskriminatif, menyalahi undang-undang atau bersifat pengiklanan tidak dibenarkan.',
                'Ulasan anda kekal milik anda, tetapi dengan menerbitkannya anda memberikan Opynio lesen percuma, di seluruh dunia dan bukan eksklusif untuk memaparkannya di platform dan dalam widget yang dibenamkan oleh perniagaan di laman web mereka, selagi ulasan itu kekal diterbitkan.',
                'Kami boleh memoderasi, menyembunyikan atau menarik balik ulasan yang melanggar terma ini. Anda boleh menyunting atau memadam ulasan anda dari profil anda.',
            ] },
            { t: 'Perniagaan', p: [
                'Sesiapa yang menuntut atau mengurus profil perniagaan mengisytiharkan bahawa dia diberi kuasa untuk mewakili perniagaan tersebut.',
                'Perniagaan boleh membalas ulasan, tetapi tidak boleh mengubahnya, meminta ulasan ditarik balik sebagai pertukaran untuk apa-apa, atau menawarkan insentif sebagai pertukaran untuk penilaian positif.',
                'Widget memaparkan ulasan sebagaimana ia diterbitkan di Opynio.',
            ] },
            { t: 'Pelan dan pembayaran', p: [
                'Sesetengah ciri memerlukan pelan berbayar. Harga dan syarat dipaparkan sebelum anda melanggan, dan pembayaran diuruskan oleh Stripe. Anda boleh membatalkan pembaharuan pada bila-bila masa dari papan pemuka anda; pelan kekal aktif sehingga akhir tempoh yang telah dibayar.',
            ] },
            { t: 'Penggunaan yang dilarang', p: [
                'Opynio tidak boleh digunakan untuk menghantar spam, mengekstrak data secara automatik tanpa kebenaran, menyamar sebagai orang atau perniagaan lain, atau mengganggu fungsi perkhidmatan.',
            ] },
            { t: 'Penggantungan dan penutupan akaun', p: [
                'Kami boleh menggantung atau menutup akaun yang melanggar terma ini. Anda boleh meminta pemadaman akaun anda pada bila-bila masa melalui {soporte}.',
            ] },
            { t: 'Liabiliti', p: [
                'Kami berusaha memastikan perkhidmatan tersedia dan berfungsi tanpa ralat, tetapi kami tidak dapat menjaminnya pada setiap masa. Opynio tidak bertanggungjawab atas pendapat pengguna atau atas hubungan antara pengguna dan perniagaan.',
            ] },
            { t: 'Perubahan pada terma', p: [
                'Kami boleh mengemas kini terma ini. Jika perubahan itu penting, kami akan memaklumkan anda. Tarikh kemas kini terakhir dipaparkan di bahagian atas halaman ini.',
            ] },
            { t: 'Undang-undang yang terpakai', p: [
                'Terma ini ditadbir oleh undang-undang Sepanyol. Jika anda seorang pengguna (dalam erti kata undang-undang perlindungan pengguna), anda mengekalkan hak yang diberikan kepada anda oleh peraturan negara tempat tinggal anda. Jika ada sebarang pertanyaan, hubungi kami melalui {soporte} atau {contacto}.',
            ] },
        ],
    },
};

export default ms;
