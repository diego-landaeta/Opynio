import type { LegalContent } from '../types';

// Filipino version (informational translation; the Spanish version prevails).
const tl: LegalContent = {
    actualizado: 'Huling update',
    nota: 'Ang salin na ito ay para sa impormasyon lamang. Kung may anumang hindi pagkakatugma, ang bersyong Espanyol ang masusunod.',
    enlaces: {
        contacto: 'contact form',
        soporte: 'Suporta',
        privacidad: 'patakaran sa privacy',
        terminos: 'Mga Tuntunin ng Paggamit',
        avisoLegal: 'Legal na Paunawa',
    },

    privacidad: {
        titulo: 'Privacy at cookies',
        meta: 'Kung paano pinoproseso ng Opynio ang iyong personal na data at kung anong mga cookie ang ginagamit nito.',
        secciones: [
            { t: 'Sino ang nagpoproseso ng iyong data', p: [
                'Ang Opynio, ang platform ng mga review ng negosyo sa site na ito. Para sa anumang tanong tungkol sa iyong data, sumulat sa amin sa pamamagitan ng {contacto}.',
            ] },
            { t: 'Anong data ang pinoproseso namin', p: [
                'Kung gagawa ka ng account: pangalan, username, email, larawan sa profile (opsyonal) at ang iyong mga kagustuhan sa wika, bansa, tema at mga abiso.',
                'Ang ipinapublish mo: mga review, mga larawan o audio na ilalakip mo, mga boto at mga sagot. Pampubliko ang mga review at maaaring ipakita sa website ng ni-review na negosyo sa pamamagitan ng aming mga widget.',
                'Kung namamahala ka ng negosyo: ang mga detalye ng page nito at, kung bibili ka ng plan, ang data sa pagsingil, na pinangangasiwaan ng Stripe (hindi iniimbak ng Opynio ang mga detalye ng iyong card).',
                'Ang ipinapadala mo sa amin sa pamamagitan ng Suporta o ng contact form.',
            ] },
            { t: 'Para saan at sa anong batayan', p: [
                'Para ibigay ang serbisyong hinihiling mo: ang iyong account, ang pag-publish at pag-moderate ng mga review, at ang pamamahala ng iyong negosyo at mga bayad.',
                'Seguridad at pag-iwas sa pang-aabuso (pekeng review, spam), batay sa aming lehitimong interes.',
                'Mga abiso sa email tungkol sa iyong aktibidad (mga sagot ng suporta, mga bagong review sa iyong negosyo). Maaari mo itong i-off sa Mga Setting.',
                'Pagsukat ng aming mga kampanya gamit ang Meta, kung tatanggapin mo lamang ang mga cookie para sa pagsukat at advertising.',
            ] },
            { t: 'Kanino ito ibinabahagi', p: [
                'Sa mga provider na kailangan namin para gumana: Supabase (hosting at database), Stripe (mga bayad), ang aming provider sa pagpapadala ng email at, kung may pahintulot mo lamang, Meta. Hindi namin ibinebenta ang iyong data.',
            ] },
            { t: 'Gaano katagal', p: [
                'Habang mayroon kang account. Kung hihilingin mong burahin ito, buburahin namin ang iyong data maliban sa kailangan naming itago ayon sa batas (halimbawa, mga invoice).',
            ] },
            { t: 'Ang iyong mga karapatan', p: [
                'Maaari kang humiling ng access, pagwawasto, pagbura, pagtutol, paglilimita at portability ng iyong data sa pamamagitan ng {soporte} o ng {contacto}. Kung hindi ka nasiyahan, maaari kang magreklamo sa Spanish Data Protection Agency (aepd.es).',
            ] },
        ],
        cookies: {
            t: 'Cookies',
            intro: 'Ginagamit namin ang storage ng iyong browser para gumana ang site at, kung tatanggapin mo lamang, ang mga cookie ng Meta para sukatin ang aming mga kampanya.',
            filas: [
                ['Kinakailangan (laging naka-on)', 'Panatilihing naka-sign in ka at tandaan ang iyong mga kagustuhan: wika, bansa, tema at ang pinili mo tungkol sa cookies.'],
                ['Pagsukat at advertising (opsyonal)', 'Meta Pixel (_fbp, _fbc). Naka-on lamang kung tatanggapin mo sa abiso ng cookies o sa Mga Setting › Privacy.'],
            ],
            boton: 'Mga setting ng cookie',
        },
    },

    avisoLegal: {
        titulo: 'Legal na Paunawa',
        meta: 'Mga detalye ng may-ari ng Opynio at ang mga kondisyon sa paggamit ng website.',
        secciones: [
            { t: 'May-ari ng website',
              intro: 'Alinsunod sa Spanish Law 34/2002 tungkol sa mga serbisyo ng information society at electronic commerce (LSSI-CE), ito ang mga detalye ng may-ari ng website na ito:',
              p: [
                'May-ari: {titular}',
                'Tax ID (NIF): {nif}',
                'Rehistradong address: {domicilio}',
                'Mga detalye ng rehistro: {registro}',
                'Email: {email}',
                'Website: {web}',
            ] },
            { t: 'Layunin', p: [
                'Ang Opynio ay isang platform kung saan nagpa-publish ang mga user ng mga review tungkol sa mga negosyo, at pinamamahalaan ng mga negosyo ang kanilang page, sumasagot sa mga review at maaaring ipakita ang mga ito sa sarili nilang website sa pamamagitan ng mga widget. Ang paggamit ng site ay nangangahulugang tinatanggap mo ang Legal na Paunawang ito at ang {terminos}.',
            ] },
            { t: 'Intelektwal at industriyal na ari-arian', p: [
                'Ang disenyo, ang code, ang brand na Opynio at ang sariling nilalaman ng site ay pag-aari ng may-ari nito o ng mga third party na nagpahintulot sa paggamit ng mga ito. Hindi pinapayagang kopyahin, ipamahagi o baguhin ang mga ito nang walang pahintulot, maliban para sa personal at pribadong paggamit.',
                'Ang mga review ay pag-aari ng mga sumulat nito, na nagbibigay sa Opynio ng lisensya para i-publish ang mga ito, gaya ng ipinaliwanag sa {terminos}.',
                'Ang mga pangalan at trademark ng mga ni-review na negosyo ay pag-aari ng kani-kanilang may-ari.',
            ] },
            { t: 'Pananagutan', p: [
                'Ang mga review ay nagpapahayag ng opinyon ng sumulat nito, hindi ng Opynio. Mino-moderate namin ang nilalaman para alisin ang lumalabag sa aming mga patakaran o sa batas, pero hindi namin magagarantiya na tumpak ang bawat opinyon. Walang pananagutan ang Opynio sa pinsalang dulot ng maling paggamit ng site o sa nilalaman ng mga website ng third party na naka-link mula rito.',
            ] },
            { t: 'Ilegal na nilalaman', p: [
                'Kung sa tingin mo ay ilegal o lumalabag sa iyong mga karapatan ang nilalamang na-publish sa Opynio, ipaalam sa amin sa pamamagitan ng {soporte} o ng {contacto} at susuriin namin ito sa lalong madaling panahon.',
            ] },
            { t: 'Proteksyon ng data', p: [
                'Ipinapaliwanag sa aming {privacidad} kung paano namin pinoproseso ang iyong personal na data.',
            ] },
            { t: 'Naaangkop na batas', p: [
                'Ang Legal na Paunawang ito ay sakop ng batas ng Spain. Ang anumang hindi pagkakasundo ay lulutasin ng mga hukuman na may hurisdiksyon ayon sa batas; kung ikaw ay consumer, ng mga hukuman sa lugar na iyong tinitirhan.',
            ] },
        ],
    },

    terminos: {
        titulo: 'Mga Tuntunin ng Paggamit',
        meta: 'Mga kondisyon sa paggamit ng Opynio bilang user o bilang negosyo: account, mga review, mga plan at mga patakaran.',
        secciones: [
            { t: 'Pagtanggap', p: [
                'Pinamamahalaan ng mga tuntuning ito ang paggamit ng Opynio ng mga user at negosyo. Sa paggawa ng account o paggamit ng serbisyo, tinatanggap mo ang mga ito; kung hindi ka sang-ayon, huwag gamitin ang platform. Kinukumpleto ng mga ito ang {avisoLegal} at ang {privacidad}.',
            ] },
            { t: 'Ang iyong account', p: [
                'Kailangan mo ng account para sumulat ng review o mamahala ng negosyo. Dapat ay nasa minimum na edad ka na itinakda ng batas ng iyong bansa (14 taong gulang sa Spain), magbigay ng totoong impormasyon at panatilihing ligtas ang iyong password. Pananagutan mo ang anumang ginagawa mula sa iyong account.',
            ] },
            { t: 'Mga review', p: [
                'Sumulat lamang tungkol sa totoong karanasan sa negosyong nire-review, nang may paggalang at nang hindi isinasama ang personal na data ng ibang tao.',
                'Hindi pinapayagan ang mga peke o bayad na review, mga review tungkol sa sarili mong negosyo o sa negosyo ng kakumpitensya, at ang nilalamang nakakasakit, mapang-diskrimina, ilegal o pang-advertising.',
                'Sa iyo pa rin ang iyong mga review, pero sa pag-publish ng mga ito ay binibigyan mo ang Opynio ng libre, pandaigdigan at hindi eksklusibong lisensya para ipakita ang mga ito sa platform at sa mga widget na inilalagay ng mga negosyo sa kanilang website, hangga’t nananatiling naka-publish ang mga ito.',
                'Maaari naming i-moderate, itago o alisin ang mga review na lumalabag sa mga tuntuning ito. Maaari mong i-edit o burahin ang sarili mong mga review mula sa iyong profile.',
            ] },
            { t: 'Mga negosyo', p: [
                'Ang sinumang nagke-claim o namamahala ng page ng negosyo ay nagpapahayag na awtorisado siyang kumatawan sa negosyong iyon.',
                'Maaaring sumagot ang mga negosyo sa mga review, pero hindi nila maaaring baguhin ang mga ito, hilingin ang pag-alis ng mga ito kapalit ng anumang bagay, o mag-alok ng insentibo kapalit ng positibong rating.',
                'Ipinapakita ng mga widget ang mga review nang eksakto kung paano naka-publish ang mga ito sa Opynio.',
            ] },
            { t: 'Mga plan at bayad', p: [
                'May ilang feature na nangangailangan ng bayad na plan. Ipinapakita ang presyo at mga kondisyon bago ka bumili, at ang Stripe ang nangangasiwa sa pagsingil. Maaari mong kanselahin ang renewal anumang oras mula sa iyong dashboard; mananatiling aktibo ang plan hanggang sa katapusan ng panahong binayaran mo.',
            ] },
            { t: 'Mga hindi pinapayagang paggamit', p: [
                'Hindi pinapayagang gamitin ang Opynio para magpadala ng spam, kumuha ng data nang awtomatiko nang walang pahintulot, magpanggap bilang ibang tao o negosyo, o makialam sa paggana ng serbisyo.',
            ] },
            { t: 'Suspensyon at pagsasara ng account', p: [
                'Maaari naming suspindihin o isara ang mga account na lumalabag sa mga tuntuning ito. Maaari mong hilingin ang pagbura ng iyong account anumang oras sa pamamagitan ng {soporte}.',
            ] },
            { t: 'Pananagutan', p: [
                'Sinisikap naming panatilihing available ang serbisyo at gumagana nang walang error, pero hindi namin ito magagarantiya sa lahat ng oras. Walang pananagutan ang Opynio sa mga opinyon ng mga user o sa mga ugnayan sa pagitan ng mga user at negosyo.',
            ] },
            { t: 'Mga pagbabago sa mga tuntunin', p: [
                'Maaari naming i-update ang mga tuntuning ito. Kung mahalaga ang pagbabago, ipapaalam namin sa iyo. Makikita ang petsa ng huling update sa itaas ng page na ito.',
            ] },
            { t: 'Naaangkop na batas', p: [
                'Ang mga tuntuning ito ay sakop ng batas ng Spain. Kung ikaw ay consumer, nananatili sa iyo ang mga karapatang ibinibigay sa iyo ng batas ng bansang iyong tinitirhan. Para sa anumang tanong, sumulat sa amin sa pamamagitan ng {soporte} o ng {contacto}.',
            ] },
        ],
    },
};

export default tl;
