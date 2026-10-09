import type { LegalContent } from '../types';

// Versao em portugues europeu. Traducao informativa: prevalece a versao espanhola.
const pt: LegalContent = {
    actualizado: 'Última atualização',
    nota: 'Esta tradução é disponibilizada apenas a título informativo. Em caso de divergência, prevalece a versão em espanhol.',
    enlaces: {
        contacto: 'formulário de contacto',
        soporte: 'Suporte',
        privacidad: 'política de privacidade',
        terminos: 'Termos de utilização',
        avisoLegal: 'aviso legal',
    },

    privacidad: {
        titulo: 'Privacidade e cookies',
        meta: 'Como o Opynio trata os seus dados pessoais e que cookies utiliza.',
        secciones: [
            { t: 'Quem trata os seus dados', p: [
                'O Opynio, a plataforma de avaliações de empresas deste site. Para qualquer questão sobre os seus dados, escreva-nos através do {contacto}.',
            ] },
            { t: 'Que dados tratamos', p: [
                'Se criar uma conta: nome, nome de utilizador, e-mail, fotografia de perfil (opcional) e as suas preferências de idioma, país, tema e notificações.',
                'O que publica: avaliações, fotografias ou áudios que anexe, votos e respostas. As avaliações são públicas e podem ser mostradas no site da empresa avaliada através dos nossos widgets.',
                'Se gerir uma empresa: os dados da respetiva ficha e, se contratar um plano, os dados de faturação, geridos pela Stripe (o Opynio não guarda os dados do seu cartão).',
                'O que nos envia através do suporte ou do formulário de contacto.',
            ] },
            { t: 'Para que fins e com que fundamento', p: [
                'Prestar o serviço que solicita: a sua conta, publicar e moderar avaliações, gerir a sua empresa e os seus pagamentos.',
                'Segurança e prevenção de abusos (avaliações falsas, spam), com base no nosso interesse legítimo.',
                'Notificações por e-mail sobre a sua atividade (respostas do suporte, novas avaliações da sua empresa). Pode desativá-las nas Definições.',
                'Medir as nossas campanhas com a Meta, apenas se aceitar os cookies de medição e publicidade.',
            ] },
            { t: 'Com quem são partilhados', p: [
                'Com os fornecedores de que precisamos para funcionar: Supabase (alojamento e base de dados), Stripe (pagamentos), o nosso fornecedor de envio de e-mails e, apenas com a sua autorização, a Meta. Não vendemos os seus dados.',
            ] },
            { t: 'Durante quanto tempo', p: [
                'Enquanto mantiver a conta. Se pedir a sua eliminação, apagamos os seus dados, exceto o que a lei nos obrigue a conservar (por exemplo, faturas).',
            ] },
            { t: 'Os seus direitos', p: [
                'Pode solicitar o acesso, a retificação, o apagamento, a oposição, a limitação e a portabilidade dos seus dados através do {soporte} ou do {contacto}. Se não ficar satisfeito, pode apresentar reclamação à Agência Espanhola de Proteção de Dados (aepd.es).',
            ] },
        ],
        cookies: {
            t: 'Cookies',
            intro: 'Utilizamos o armazenamento do seu navegador para que o site funcione e, apenas se aceitar, cookies da Meta para medir as nossas campanhas.',
            filas: [
                ['Necessários (sempre ativos)', 'Manter a sua sessão iniciada e memorizar as suas preferências: idioma, país, tema e a sua escolha sobre cookies.'],
                ['Medição e publicidade (opcionais)', 'Meta Pixel (_fbp, _fbc). Só são ativados se aceitar no aviso de cookies ou em Definições › Privacidade.'],
            ],
            boton: 'Configurar cookies',
        },
    },

    avisoLegal: {
        titulo: 'Aviso legal',
        meta: 'Dados do titular do Opynio e condições de utilização do site.',
        secciones: [
            { t: 'Titular do site',
              intro: 'Em cumprimento da Lei espanhola 34/2002, relativa aos serviços da sociedade da informação e ao comércio eletrónico (LSSI-CE), estes são os dados do titular deste site:',
              p: [
                'Titular: {titular}',
                'Identificação fiscal (NIF): {nif}',
                'Morada: {domicilio}',
                'Dados de registo: {registro}',
                'E-mail: {email}',
                'Site: {web}',
            ] },
            { t: 'Objeto', p: [
                'O Opynio é uma plataforma onde os utilizadores publicam avaliações sobre empresas, e as empresas gerem a sua ficha, respondem às avaliações e podem mostrá-las no seu site através de widgets. A utilização do site implica a aceitação deste aviso legal e dos {terminos}.',
            ] },
            { t: 'Propriedade intelectual e industrial', p: [
                'O design, o código, a marca Opynio e os conteúdos próprios do site pertencem ao seu titular ou a terceiros que autorizaram a sua utilização. Não é permitido reproduzi-los, distribuí-los nem transformá-los sem autorização, exceto para uso pessoal e privado.',
                'As avaliações pertencem a quem as escreve, que concede ao Opynio uma licença para as publicar, conforme explicado nos {terminos}.',
                'Os nomes e marcas das empresas avaliadas pertencem aos respetivos titulares.',
            ] },
            { t: 'Responsabilidade', p: [
                'As avaliações exprimem a opinião de quem as escreve, não a do Opynio. Moderamos os conteúdos para retirar os que violem as nossas regras ou a lei, mas não podemos garantir a exatidão de cada opinião. O Opynio não se responsabiliza pelos danos resultantes de uma utilização indevida do site nem pelo conteúdo dos sites de terceiros para os quais este contenha ligações.',
            ] },
            { t: 'Conteúdos ilícitos', p: [
                'Se considerar que um conteúdo publicado no Opynio é ilícito ou viola os seus direitos, comunique-nos através do {soporte} ou do {contacto} e analisá-lo-emos o mais rapidamente possível.',
            ] },
            { t: 'Proteção de dados', p: [
                'A forma como tratamos os seus dados pessoais é explicada na {privacidad}.',
            ] },
            { t: 'Legislação aplicável', p: [
                'Este aviso legal rege-se pela legislação espanhola. Para qualquer litígio, serão competentes os tribunais que correspondam nos termos da lei; se for consumidor, os do seu domicílio.',
            ] },
        ],
    },

    terminos: {
        titulo: 'Termos de utilização',
        meta: 'Condições para utilizar o Opynio como utilizador ou como empresa: conta, avaliações, planos e regras.',
        secciones: [
            { t: 'Aceitação', p: [
                'Estes termos regulam a utilização do Opynio por utilizadores e empresas. Ao criar uma conta ou utilizar o serviço, aceita-os; se não concordar, não utilize a plataforma. Complementam o {avisoLegal} e a {privacidad}.',
            ] },
            { t: 'A sua conta', p: [
                'Para escrever avaliações ou gerir uma empresa, precisa de uma conta. Deve ter a idade mínima exigida pela lei do seu país (em Espanha, 14 anos), fornecer dados verdadeiros e manter a sua palavra-passe segura. É responsável pelo que for feito a partir da sua conta.',
            ] },
            { t: 'Avaliações', p: [
                'Escreva apenas sobre experiências reais com a empresa avaliada, com respeito e sem incluir dados pessoais de outras pessoas.',
                'Não são permitidas avaliações falsas ou pagas, sobre o seu próprio negócio ou o da concorrência, nem conteúdos ofensivos, discriminatórios, ilícitos ou publicitários.',
                'As avaliações continuam a ser suas, mas, ao publicá-las, concede ao Opynio uma licença gratuita, mundial e não exclusiva para as mostrar na plataforma e nos widgets que as empresas inserem no seu site, enquanto se mantiverem publicadas.',
                'Podemos moderar, ocultar ou retirar as avaliações que violem estes termos. Pode editar ou eliminar as suas a partir do seu perfil.',
            ] },
            { t: 'Empresas', p: [
                'Quem reivindica ou gere uma ficha declara que está autorizado a representar essa empresa.',
                'As empresas podem responder às avaliações, mas não podem modificá-las, pedir a sua retirada em troca de algo nem oferecer incentivos em troca de uma avaliação positiva.',
                'Os widgets mostram as avaliações tal como estão publicadas no Opynio.',
            ] },
            { t: 'Planos e pagamentos', p: [
                'Algumas funcionalidades requerem um plano pago. O preço e as condições são apresentados antes da contratação e a cobrança é gerida pela Stripe. Pode cancelar a renovação quando quiser a partir do seu painel; o plano mantém-se ativo até ao fim do período pago.',
            ] },
            { t: 'Utilizações não permitidas', p: [
                'Não é permitido utilizar o Opynio para enviar spam, extrair dados de forma automatizada sem autorização, fazer-se passar por outra pessoa ou empresa, nem interferir no funcionamento do serviço.',
            ] },
            { t: 'Suspensão e cancelamento da conta', p: [
                'Podemos suspender ou encerrar as contas que violem estes termos. Pode pedir a eliminação da sua conta a qualquer momento através do {soporte}.',
            ] },
            { t: 'Responsabilidade', p: [
                'Procuramos que o serviço esteja disponível e funcione sem erros, mas não podemos garanti-lo em todos os momentos. O Opynio não se responsabiliza pelas opiniões dos utilizadores nem pelas relações entre utilizadores e empresas.',
            ] },
            { t: 'Alterações aos termos', p: [
                'Podemos atualizar estes termos. Se a alteração for importante, iremos avisá-lo. A data da última atualização aparece no início desta página.',
            ] },
            { t: 'Legislação aplicável', p: [
                'Estes termos regem-se pela legislação espanhola. Se for consumidor, mantém os direitos que lhe sejam reconhecidos pela legislação do seu país de residência. Para qualquer dúvida, escreva-nos através do {soporte} ou do {contacto}.',
            ] },
        ],
    },
};

export default pt;
