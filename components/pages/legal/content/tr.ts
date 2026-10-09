import type { LegalContent } from '../types';

// Turkce surum, es.ts dosyasindan cevrilmistir; farklilik halinde Ispanyolca surum esastir.
// Baglanti metinlerine ek gelmemesi icin belge baglantilari "metni", iletisim/destek baglantilari "uzerinden" ile kullanilir.
const tr: LegalContent = {
    actualizado: 'Son güncelleme',
    nota: 'Bu çeviri yalnızca bilgilendirme amacıyla sunulmaktadır. Herhangi bir farklılık olması hâlinde İspanyolca metin esas alınır.',
    enlaces: {
        contacto: 'iletişim formu',
        soporte: 'Destek',
        privacidad: 'Gizlilik Politikası',
        terminos: 'Kullanım Koşulları',
        avisoLegal: 'Yasal Uyarı',
    },

    privacidad: {
        titulo: 'Gizlilik ve çerezler',
        meta: 'Opynio’nun kişisel verilerinizi nasıl işlediği ve hangi çerezleri kullandığı.',
        secciones: [
            { t: 'Verilerinizi kim işler', p: [
                'Bu sitedeki işletme yorumları platformu Opynio. Verilerinizle ilgili her türlü soru için bize {contacto} üzerinden yazın.',
            ] },
            { t: 'Hangi verileri işliyoruz', p: [
                'Hesap oluşturursanız: ad, kullanıcı adı, e-posta, profil fotoğrafı (isteğe bağlı) ve dil, ülke, tema ve bildirim tercihleriniz.',
                'Yayımladıklarınız: yorumlar, eklediğiniz fotoğraflar veya ses kayıtları, oylar ve yanıtlar. Yorumlar herkese açıktır ve widget’larımız aracılığıyla yorum yapılan işletmenin web sitesinde gösterilebilir.',
                'Bir işletmeyi yönetiyorsanız: işletme sayfasındaki bilgiler ve bir plan satın alırsanız Stripe tarafından yönetilen fatura bilgileri (Opynio kart bilgilerinizi saklamaz).',
                'Destek veya iletişim formu üzerinden bize gönderdikleriniz.',
            ] },
            { t: 'Hangi amaçla ve hangi hukuki dayanakla', p: [
                'Talep ettiğiniz hizmeti sunmak: hesabınız, yorumların yayımlanması ve denetlenmesi, işletmenizin ve ödemelerinizin yönetimi.',
                'Meşru menfaatimize dayanarak güvenlik ve kötüye kullanımın önlenmesi (sahte yorumlar, spam).',
                'Etkinliğinizle ilgili e-posta bildirimleri (destek yanıtları, işletmenize gelen yeni yorumlar). Bunları Ayarlar’dan kapatabilirsiniz.',
                'Kampanyalarımızın Meta ile ölçülmesi; yalnızca ölçüm ve reklam çerezlerini kabul ederseniz.',
            ] },
            { t: 'Verileriniz kimlerle paylaşılır', p: [
                'Hizmetin işleyişi için ihtiyaç duyduğumuz sağlayıcılarla: Supabase (barındırma ve veritabanı), Stripe (ödemeler), e-posta gönderim sağlayıcımız ve yalnızca izninizle Meta. Verilerinizi satmayız.',
            ] },
            { t: 'Ne kadar süreyle', p: [
                'Hesabınız olduğu sürece. Hesabınızın silinmesini isterseniz, yasal olarak saklamakla yükümlü olduklarımız (örneğin faturalar) dışında verilerinizi sileriz.',
            ] },
            { t: 'Haklarınız', p: [
                '{soporte} veya {contacto} üzerinden verilerinize erişim, verilerinizin düzeltilmesi, silinmesi, işlenmesine itiraz edilmesi, işlenmesinin kısıtlanması ve taşınması talebinde bulunabilirsiniz. Sonuçtan memnun kalmazsanız İspanya Veri Koruma Ajansı’na (aepd.es) şikâyette bulunabilirsiniz.',
            ] },
        ],
        cookies: {
            t: 'Çerezler',
            intro: 'Sitenin çalışması için tarayıcınızın depolama alanını, yalnızca kabul ederseniz de kampanyalarımızı ölçmek için Meta çerezlerini kullanırız.',
            filas: [
                ['Gerekli (her zaman açık)', 'Oturumunuzu açık tutar ve tercihlerinizi hatırlar: dil, ülke, tema ve çerezlerle ilgili seçiminiz.'],
                ['Ölçüm ve reklam (isteğe bağlı)', 'Meta Pixel (_fbp, _fbc). Yalnızca çerez bildiriminde veya Ayarlar › Gizlilik bölümünde kabul ederseniz etkinleşir.'],
            ],
            boton: 'Çerezleri ayarla',
        },
    },

    avisoLegal: {
        titulo: 'Yasal Uyarı',
        meta: 'Opynio’nun sahibine ilişkin bilgiler ve web sitesinin kullanım koşulları.',
        secciones: [
            { t: 'Web sitesinin sahibi',
              intro: 'İspanya’nın bilgi toplumu hizmetleri ve elektronik ticarete ilişkin 34/2002 sayılı Kanunu (LSSI-CE) uyarınca bu web sitesinin sahibine ait bilgiler aşağıdadır:',
              p: [
                'Sahibi: {titular}',
                'Vergi numarası (NIF): {nif}',
                'Adres: {domicilio}',
                'Sicil bilgileri: {registro}',
                'E-posta: {email}',
                'Web sitesi: {web}',
            ] },
            { t: 'Amaç', p: [
                'Opynio, kullanıcıların işletmeler hakkında yorum yayımladığı; işletmelerin ise sayfalarını yönettiği, yorumlara yanıt verdiği ve bunları widget’lar aracılığıyla kendi web sitelerinde gösterebildiği bir platformdur. Siteyi kullanmanız, bu yasal uyarıyı ve {terminos} metnini kabul ettiğiniz anlamına gelir.',
            ] },
            { t: 'Fikri ve sınai mülkiyet', p: [
                'Sitenin tasarımı, kodu, Opynio markası ve siteye ait içerikler, sitenin sahibine veya kullanımına izin vermiş üçüncü kişilere aittir. Kişisel ve özel kullanım dışında, izin alınmadan çoğaltılamaz, dağıtılamaz veya değiştirilemez.',
                'Yorumlar, onları yazan kişilere aittir; bu kişiler, {terminos} metninde açıklandığı üzere, yorumları yayımlaması için Opynio’ya lisans verir.',
                'Yorum yapılan işletmelerin adları ve markaları ilgili sahiplerine aittir.',
            ] },
            { t: 'Sorumluluk', p: [
                'Yorumlar, Opynio’nun değil, onları yazan kişinin görüşünü yansıtır. Kurallarımıza veya yasaya aykırı içerikleri kaldırmak için içerikleri denetleriz, ancak her görüşün doğruluğunu garanti edemeyiz. Opynio, sitenin usulsüz kullanımından doğan zararlardan ve siteden bağlantı verilen üçüncü taraf web sitelerinin içeriğinden sorumlu değildir.',
            ] },
            { t: 'Hukuka aykırı içerikler', p: [
                'Opynio’da yayımlanan bir içeriğin hukuka aykırı olduğunu veya haklarınızı ihlal ettiğini düşünüyorsanız, bunu {soporte} veya {contacto} üzerinden bize bildirin; en kısa sürede inceleyeceğiz.',
            ] },
            { t: 'Verilerin korunması', p: [
                'Kişisel verilerinizi nasıl işlediğimiz {privacidad} metninde açıklanmaktadır.',
            ] },
            { t: 'Uygulanacak hukuk', p: [
                'Bu yasal uyarı İspanya hukukuna tabidir. Her türlü uyuşmazlıkta kanuna göre yetkili mahkemeler yetkilidir; tüketiciyseniz yerleşim yerinizdeki mahkemeler.',
            ] },
        ],
    },

    terminos: {
        titulo: 'Kullanım Koşulları',
        meta: 'Opynio’yu kullanıcı veya işletme olarak kullanma koşulları: hesap, yorumlar, planlar ve kurallar.',
        secciones: [
            { t: 'Kabul', p: [
                'Bu koşullar, Opynio’nun kullanıcılar ve işletmeler tarafından kullanımını düzenler. Bir hesap oluşturarak veya hizmeti kullanarak bu koşulları kabul etmiş olursunuz; kabul etmiyorsanız platformu kullanmayın. Bu koşullar, {avisoLegal} ve {privacidad} metinlerini tamamlar.',
            ] },
            { t: 'Hesabınız', p: [
                'Yorum yazmak veya bir işletmeyi yönetmek için bir hesaba ihtiyacınız vardır. Ülkenizin yasalarının öngördüğü asgari yaşta olmalı (İspanya’da 14), doğru bilgiler vermeli ve şifrenizi güvende tutmalısınız. Hesabınızdan yapılan her şeyden siz sorumlusunuz.',
            ] },
            { t: 'Yorumlar', p: [
                'Yalnızca yorum yaptığınız işletmeyle ilgili gerçek deneyimleriniz hakkında, saygılı bir dille ve başka kişilerin kişisel verilerine yer vermeden yazın.',
                'Sahte veya ücretli yorumlara, kendi işletmeniz ya da rakiplerinizin işletmeleri hakkındaki yorumlara ve saldırgan, ayrımcı, hukuka aykırı veya reklam amaçlı içeriklere izin verilmez.',
                'Yorumlarınız size ait olmaya devam eder; ancak bunları yayımlayarak Opynio’ya, yayında kaldıkları sürece platformda ve işletmelerin web sitelerine yerleştirdiği widget’larda gösterilmeleri için ücretsiz, dünya çapında ve münhasır olmayan bir lisans vermiş olursunuz.',
                'Bu koşulları ihlal eden yorumları denetleyebilir, gizleyebilir veya kaldırabiliriz. Kendi yorumlarınızı profilinizden düzenleyebilir veya silebilirsiniz.',
            ] },
            { t: 'İşletmeler', p: [
                'Bir işletme sayfasını sahiplenen veya yöneten kişi, o işletmeyi temsil etmeye yetkili olduğunu beyan eder.',
                'İşletmeler yorumlara yanıt verebilir, ancak yorumları değiştiremez, herhangi bir karşılık sunarak kaldırılmalarını isteyemez veya olumlu bir değerlendirme karşılığında teşvik sunamaz.',
                'Widget’lar, yorumları Opynio’da yayımlandıkları hâliyle gösterir.',
            ] },
            { t: 'Planlar ve ödemeler', p: [
                'Bazı özellikler ücretli bir plan gerektirir. Fiyat ve koşullar satın almadan önce gösterilir ve ödeme Stripe tarafından yönetilir. Yenilemeyi istediğiniz zaman panelinizden iptal edebilirsiniz; plan, ödenen dönemin sonuna kadar etkin kalır.',
            ] },
            { t: 'İzin verilmeyen kullanımlar', p: [
                'Opynio’yu spam göndermek, izinsiz olarak otomatik yollarla veri toplamak, başka bir kişi veya işletmenin kimliğine bürünmek ya da hizmetin işleyişine müdahale etmek için kullanmak yasaktır.',
            ] },
            { t: 'Askıya alma ve hesabın kapatılması', p: [
                'Bu koşulları ihlal eden hesapları askıya alabilir veya kapatabiliriz. Hesabınızın silinmesini istediğiniz zaman {soporte} üzerinden talep edebilirsiniz.',
            ] },
            { t: 'Sorumluluk', p: [
                'Hizmetin erişilebilir olması ve hatasız çalışması için çaba gösteririz, ancak bunu her an garanti edemeyiz. Opynio, kullanıcıların görüşlerinden ve kullanıcılar ile işletmeler arasındaki ilişkilerden sorumlu değildir.',
            ] },
            { t: 'Koşullardaki değişiklikler', p: [
                'Bu koşulları güncelleyebiliriz. Önemli bir değişiklik olursa sizi bilgilendiririz. Son güncelleme tarihi bu sayfanın başında yer alır.',
            ] },
            { t: 'Uygulanacak hukuk', p: [
                'Bu koşullar İspanya hukukuna tabidir. Tüketiciyseniz, ikamet ettiğiniz ülkenin mevzuatının size tanıdığı haklar saklıdır. Her türlü sorunuz için bize {soporte} veya {contacto} üzerinden yazın.',
            ] },
        ],
    },
};

export default tr;
