import type { LegalContent } from '../types';

const id: LegalContent = {
    actualizado: 'Terakhir diperbarui',
    nota: 'Terjemahan ini disediakan hanya sebagai informasi. Jika terdapat perbedaan, versi bahasa Spanyol yang berlaku.',
    enlaces: {
        contacto: 'formulir kontak',
        soporte: 'Dukungan',
        privacidad: 'kebijakan privasi',
        terminos: 'Ketentuan Penggunaan',
        avisoLegal: 'Pemberitahuan Hukum',
    },

    privacidad: {
        titulo: 'Privasi dan cookie',
        meta: 'Bagaimana Opynio memproses data pribadi Anda dan cookie apa saja yang digunakannya.',
        secciones: [
            { t: 'Siapa yang memproses data Anda', p: [
                'Opynio, platform ulasan bisnis di situs ini. Untuk pertanyaan apa pun tentang data Anda, hubungi kami melalui {contacto}.',
            ] },
            { t: 'Data apa yang kami proses', p: [
                'Jika Anda membuat akun: nama, nama pengguna, email, foto profil (opsional), serta preferensi bahasa, negara, tema, dan notifikasi Anda.',
                'Apa yang Anda publikasikan: ulasan, foto atau audio yang Anda lampirkan, suara, dan balasan. Ulasan bersifat publik dan dapat ditampilkan di situs web bisnis yang diulas melalui widget kami.',
                'Jika Anda mengelola bisnis: data profil bisnisnya dan, jika Anda berlangganan paket, data penagihan yang dikelola oleh Stripe (Opynio tidak menyimpan data kartu Anda).',
                'Apa yang Anda kirimkan kepada kami melalui dukungan atau formulir kontak.',
            ] },
            { t: 'Untuk apa dan atas dasar apa', p: [
                'Menyediakan layanan yang Anda minta: akun Anda, publikasi dan moderasi ulasan, serta pengelolaan bisnis dan pembayaran Anda.',
                'Keamanan dan pencegahan penyalahgunaan (ulasan palsu, spam), berdasarkan kepentingan sah kami.',
                'Notifikasi email tentang aktivitas Anda (balasan dukungan, ulasan baru untuk bisnis Anda). Anda dapat menonaktifkannya di Pengaturan.',
                'Mengukur kampanye kami dengan Meta, hanya jika Anda menerima cookie pengukuran dan iklan.',
            ] },
            { t: 'Dengan siapa data dibagikan', p: [
                'Dengan penyedia yang kami perlukan untuk beroperasi: Supabase (hosting dan basis data), Stripe (pembayaran), penyedia layanan pengiriman email kami, dan, hanya dengan izin Anda, Meta. Kami tidak menjual data Anda.',
            ] },
            { t: 'Berapa lama', p: [
                'Selama Anda memiliki akun. Jika Anda meminta penghapusan akun, kami menghapus data Anda kecuali data yang wajib kami simpan menurut hukum (misalnya, faktur).',
            ] },
            { t: 'Hak-hak Anda', p: [
                'Anda dapat meminta akses, perbaikan, penghapusan, keberatan, pembatasan, dan portabilitas data Anda melalui {soporte} atau {contacto}. Jika Anda tidak puas, Anda dapat mengajukan pengaduan kepada Badan Perlindungan Data Spanyol (aepd.es).',
            ] },
        ],
        cookies: {
            t: 'Cookie',
            intro: 'Kami menggunakan penyimpanan browser Anda agar situs berfungsi dan, hanya jika Anda menyetujuinya, cookie Meta untuk mengukur kampanye kami.',
            filas: [
                ['Diperlukan (selalu aktif)', 'Menjaga sesi Anda dan mengingat preferensi Anda: bahasa, negara, tema, dan pilihan cookie Anda.'],
                ['Pengukuran dan iklan (opsional)', 'Meta Pixel (_fbp, _fbc). Hanya diaktifkan jika Anda menyetujuinya di pemberitahuan cookie atau di Pengaturan › Privasi.'],
            ],
            boton: 'Atur cookie',
        },
    },

    avisoLegal: {
        titulo: 'Pemberitahuan Hukum',
        meta: 'Data pemilik Opynio dan ketentuan penggunaan situs web.',
        secciones: [
            { t: 'Pemilik situs web',
              intro: 'Sesuai dengan Undang-Undang Spanyol 34/2002 tentang layanan masyarakat informasi dan perdagangan elektronik (LSSI-CE), berikut adalah data pemilik situs web ini:',
              p: [
                'Pemilik: {titular}',
                'Nomor pajak (NIF): {nif}',
                'Alamat terdaftar: {domicilio}',
                'Data pendaftaran: {registro}',
                'Email: {email}',
                'Situs web: {web}',
            ] },
            { t: 'Tujuan', p: [
                'Opynio adalah platform tempat pengguna memublikasikan ulasan tentang bisnis, sementara bisnis mengelola profilnya, membalas ulasan, dan dapat menampilkannya di situs web mereka melalui widget. Menggunakan situs ini berarti Anda menerima Pemberitahuan Hukum ini dan {terminos}.',
            ] },
            { t: 'Kekayaan intelektual dan industri', p: [
                'Desain, kode, merek Opynio, dan konten milik situs ini adalah milik pemiliknya atau pihak ketiga yang telah mengizinkan penggunaannya. Semua itu tidak boleh direproduksi, didistribusikan, atau diubah tanpa izin, kecuali untuk penggunaan pribadi dan privat.',
                'Ulasan adalah milik penulisnya, yang memberikan lisensi kepada Opynio untuk memublikasikannya, sebagaimana dijelaskan dalam {terminos}.',
                'Nama dan merek bisnis yang diulas adalah milik pemiliknya masing-masing.',
            ] },
            { t: 'Tanggung jawab', p: [
                'Ulasan mencerminkan pendapat penulisnya, bukan pendapat Opynio. Kami memoderasi konten untuk menghapus konten yang melanggar aturan kami atau hukum, tetapi kami tidak dapat menjamin keakuratan setiap pendapat. Opynio tidak bertanggung jawab atas kerugian akibat penyalahgunaan situs ini atau atas konten situs web pihak ketiga yang ditautkan dari situs ini.',
            ] },
            { t: 'Konten ilegal', p: [
                'Jika Anda yakin bahwa konten yang dipublikasikan di Opynio melanggar hukum atau melanggar hak Anda, beri tahu kami melalui {soporte} atau {contacto} dan kami akan meninjaunya sesegera mungkin.',
            ] },
            { t: 'Perlindungan data', p: [
                'Cara kami memproses data pribadi Anda dijelaskan dalam {privacidad}.',
            ] },
            { t: 'Hukum yang berlaku', p: [
                'Pemberitahuan Hukum ini diatur oleh hukum Spanyol. Setiap sengketa akan diselesaikan oleh pengadilan yang berwenang menurut hukum; jika Anda adalah konsumen, oleh pengadilan di tempat tinggal Anda.',
            ] },
        ],
    },

    terminos: {
        titulo: 'Ketentuan Penggunaan',
        meta: 'Ketentuan untuk menggunakan Opynio sebagai pengguna atau bisnis: akun, ulasan, paket, dan aturan.',
        secciones: [
            { t: 'Penerimaan', p: [
                'Ketentuan ini mengatur penggunaan Opynio oleh pengguna dan bisnis. Dengan membuat akun atau menggunakan layanan, Anda menerimanya; jika Anda tidak setuju, jangan gunakan platform ini. Ketentuan ini melengkapi {avisoLegal} dan {privacidad}.',
            ] },
            { t: 'Akun Anda', p: [
                'Untuk menulis ulasan atau mengelola bisnis, Anda memerlukan akun. Anda harus memenuhi usia minimum yang ditetapkan oleh hukum negara Anda (di Spanyol, 14 tahun), memberikan data yang benar, dan menjaga keamanan kata sandi Anda. Anda bertanggung jawab atas apa pun yang dilakukan dari akun Anda.',
            ] },
            { t: 'Ulasan', p: [
                'Tulislah hanya tentang pengalaman nyata dengan bisnis yang diulas, dengan sopan dan tanpa menyertakan data pribadi orang lain.',
                'Tidak diperbolehkan ulasan palsu atau berbayar, ulasan tentang bisnis Anda sendiri atau bisnis pesaing, maupun konten yang menyinggung, diskriminatif, melanggar hukum, atau bersifat iklan.',
                'Ulasan tetap menjadi milik Anda, tetapi dengan memublikasikannya Anda memberi Opynio lisensi gratis, berlaku di seluruh dunia, dan noneksklusif untuk menampilkannya di platform dan di widget yang dipasang bisnis di situs web mereka, selama ulasan tersebut tetap dipublikasikan.',
                'Kami dapat memoderasi, menyembunyikan, atau menghapus ulasan yang melanggar ketentuan ini. Anda dapat mengedit atau menghapus ulasan Anda dari profil Anda.',
            ] },
            { t: 'Bisnis', p: [
                'Siapa pun yang mengklaim atau mengelola profil bisnis menyatakan bahwa ia berwenang mewakili bisnis tersebut.',
                'Bisnis dapat membalas ulasan, tetapi tidak boleh mengubahnya, meminta penghapusannya dengan imbalan apa pun, atau menawarkan insentif sebagai imbalan atas penilaian positif.',
                'Widget menampilkan ulasan persis seperti yang dipublikasikan di Opynio.',
            ] },
            { t: 'Paket dan pembayaran', p: [
                'Beberapa fitur memerlukan paket berbayar. Harga dan ketentuannya ditampilkan sebelum Anda berlangganan, dan pembayarannya dikelola oleh Stripe. Anda dapat membatalkan perpanjangan kapan saja dari dasbor Anda; paket tetap aktif hingga akhir periode yang telah dibayar.',
            ] },
            { t: 'Penggunaan yang dilarang', p: [
                'Opynio tidak boleh digunakan untuk mengirim spam, mengambil data secara otomatis tanpa izin, menyamar sebagai orang atau bisnis lain, atau mengganggu berfungsinya layanan.',
            ] },
            { t: 'Penangguhan dan penutupan akun', p: [
                'Kami dapat menangguhkan atau menutup akun yang melanggar ketentuan ini. Anda dapat meminta penghapusan akun Anda kapan saja melalui {soporte}.',
            ] },
            { t: 'Tanggung jawab', p: [
                'Kami berupaya agar layanan tersedia dan berfungsi tanpa kesalahan, tetapi kami tidak dapat menjaminnya setiap saat. Opynio tidak bertanggung jawab atas pendapat pengguna atau atas hubungan antara pengguna dan bisnis.',
            ] },
            { t: 'Perubahan ketentuan', p: [
                'Kami dapat memperbarui ketentuan ini. Jika perubahannya penting, kami akan memberi tahu Anda. Tanggal pembaruan terakhir tercantum di bagian atas halaman ini.',
            ] },
            { t: 'Hukum yang berlaku', p: [
                'Ketentuan ini diatur oleh hukum Spanyol. Jika Anda adalah konsumen, Anda tetap memiliki hak yang diberikan kepada Anda oleh peraturan di negara tempat tinggal Anda. Jika ada pertanyaan, hubungi kami melalui {soporte} atau {contacto}.',
            ] },
        ],
    },
};

export default id;
