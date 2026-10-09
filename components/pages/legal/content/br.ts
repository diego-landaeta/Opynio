import type { LegalContent } from '../types';

// Versao em portugues do Brasil. Traducao informativa: prevalece a versao espanhola.
const br: LegalContent = {
    actualizado: 'Última atualização',
    nota: 'Esta tradução é fornecida apenas para fins informativos. Em caso de divergência, prevalece a versão em espanhol.',
    enlaces: {
        contacto: 'formulário de contato',
        soporte: 'Suporte',
        privacidad: 'política de privacidade',
        terminos: 'Termos de uso',
        avisoLegal: 'aviso legal',
    },

    privacidad: {
        titulo: 'Privacidade e cookies',
        meta: 'Como o Opynio trata seus dados pessoais e quais cookies utiliza.',
        secciones: [
            { t: 'Quem trata seus dados', p: [
                'O Opynio, a plataforma de avaliações de empresas deste site. Para qualquer questão sobre seus dados, escreva para nós pelo {contacto}.',
            ] },
            { t: 'Quais dados tratamos', p: [
                'Se você criar uma conta: nome, nome de usuário, e-mail, foto de perfil (opcional) e suas preferências de idioma, país, tema e notificações.',
                'O que você publica: avaliações, fotos ou áudios que anexar, votos e respostas. As avaliações são públicas e podem ser exibidas no site da empresa avaliada por meio dos nossos widgets.',
                'Se você gerencia uma empresa: os dados da página dela e, se contratar um plano, os dados de cobrança, que são processados pela Stripe (o Opynio não armazena os dados do seu cartão).',
                'O que você nos envia pelo suporte ou pelo formulário de contato.',
            ] },
            { t: 'Para que e com qual base legal', p: [
                'Prestar o serviço que você solicita: sua conta, publicar e moderar avaliações, gerenciar sua empresa e seus pagamentos.',
                'Segurança e prevenção de abusos (avaliações falsas, spam), com base no nosso legítimo interesse.',
                'Notificações por e-mail sobre sua atividade (respostas do suporte, novas avaliações da sua empresa). Você pode desativá-las em Configurações.',
                'Medir nossas campanhas com a Meta, somente se você aceitar os cookies de medição e publicidade.',
            ] },
            { t: 'Com quem são compartilhados', p: [
                'Com os fornecedores de que precisamos para funcionar: Supabase (hospedagem e banco de dados), Stripe (pagamentos), nosso provedor de envio de e-mails e, somente com sua permissão, a Meta. Não vendemos seus dados.',
            ] },
            { t: 'Por quanto tempo', p: [
                'Enquanto você mantiver a conta. Se você pedir a exclusão dela, apagamos seus dados, exceto o que a lei nos obrigar a conservar (por exemplo, faturas).',
            ] },
            { t: 'Seus direitos', p: [
                'Você pode solicitar acesso, retificação, eliminação, oposição, limitação e portabilidade dos seus dados pelo {soporte} ou pelo {contacto}. Se não ficar satisfeito, pode apresentar reclamação à Agência Espanhola de Proteção de Dados (aepd.es).',
            ] },
        ],
        cookies: {
            t: 'Cookies',
            intro: 'Usamos o armazenamento do seu navegador para que o site funcione e, somente se você aceitar, cookies da Meta para medir nossas campanhas.',
            filas: [
                ['Necessários (sempre ativos)', 'Manter você conectado e lembrar suas preferências: idioma, país, tema e sua escolha sobre cookies.'],
                ['Medição e publicidade (opcionais)', 'Meta Pixel (_fbp, _fbc). Só são ativados se você aceitar no aviso de cookies ou em Configurações › Privacidade.'],
            ],
            boton: 'Configurar cookies',
        },
    },

    avisoLegal: {
        titulo: 'Aviso legal',
        meta: 'Dados do titular do Opynio e condições de uso do site.',
        secciones: [
            { t: 'Titular do site',
              intro: 'Em cumprimento da Lei espanhola 34/2002, de serviços da sociedade da informação e de comércio eletrônico (LSSI-CE), estes são os dados do titular deste site:',
              p: [
                'Titular: {titular}',
                'Identificação fiscal (NIF): {nif}',
                'Endereço: {domicilio}',
                'Dados de registro: {registro}',
                'E-mail: {email}',
                'Site: {web}',
            ] },
            { t: 'Objeto', p: [
                'O Opynio é uma plataforma em que os usuários publicam avaliações sobre empresas, e as empresas gerenciam sua página, respondem às avaliações e podem exibi-las em seu site por meio de widgets. Usar o site implica aceitar este aviso legal e os {terminos}.',
            ] },
            { t: 'Propriedade intelectual e industrial', p: [
                'O design, o código, a marca Opynio e os conteúdos próprios do site pertencem ao seu titular ou a terceiros que autorizaram seu uso. Não é permitido reproduzi-los, distribuí-los nem transformá-los sem autorização, exceto para uso pessoal e privado.',
                'As avaliações pertencem a quem as escreve, que concede ao Opynio uma licença para publicá-las, conforme explicado nos {terminos}.',
                'Os nomes e marcas das empresas avaliadas pertencem a seus respectivos titulares.',
            ] },
            { t: 'Responsabilidade', p: [
                'As avaliações expressam a opinião de quem as escreve, não a do Opynio. Moderamos os conteúdos para remover os que violam nossas regras ou a lei, mas não podemos garantir a exatidão de cada opinião. O Opynio não se responsabiliza por danos decorrentes do uso indevido do site nem pelo conteúdo de sites de terceiros com links a partir dele.',
            ] },
            { t: 'Conteúdos ilícitos', p: [
                'Se você acredita que um conteúdo publicado no Opynio é ilícito ou viola seus direitos, avise-nos pelo {soporte} ou pelo {contacto} e vamos analisá-lo o quanto antes.',
            ] },
            { t: 'Proteção de dados', p: [
                'A forma como tratamos seus dados pessoais está explicada na {privacidad}.',
            ] },
            { t: 'Legislação aplicável', p: [
                'Este aviso legal é regido pela legislação espanhola. Para qualquer controvérsia, serão competentes os tribunais que correspondam nos termos da lei; se você for consumidor, os do seu domicílio.',
            ] },
        ],
    },

    terminos: {
        titulo: 'Termos de uso',
        meta: 'Condições para usar o Opynio como usuário ou como empresa: conta, avaliações, planos e regras.',
        secciones: [
            { t: 'Aceitação', p: [
                'Estes termos regulam o uso do Opynio por usuários e empresas. Ao criar uma conta ou usar o serviço, você os aceita; se não concordar, não utilize a plataforma. Eles complementam o {avisoLegal} e a {privacidad}.',
            ] },
            { t: 'Sua conta', p: [
                'Para escrever avaliações ou gerenciar uma empresa, você precisa de uma conta. Você deve ter a idade mínima exigida pela lei do seu país (na Espanha, 14 anos), fornecer dados verdadeiros e manter sua senha segura. Você é responsável pelo que for feito a partir da sua conta.',
            ] },
            { t: 'Avaliações', p: [
                'Escreva apenas sobre experiências reais com a empresa avaliada, com respeito e sem incluir dados pessoais de outras pessoas.',
                'Não são permitidas avaliações falsas ou pagas, sobre o seu próprio negócio ou o da concorrência, nem conteúdos ofensivos, discriminatórios, ilícitos ou publicitários.',
                'As avaliações continuam sendo suas, mas, ao publicá-las, você concede ao Opynio uma licença gratuita, mundial e não exclusiva para exibi-las na plataforma e nos widgets que as empresas inserem em seus sites, enquanto continuarem publicadas.',
                'Podemos moderar, ocultar ou remover as avaliações que violarem estes termos. Você pode editar ou excluir as suas pelo seu perfil.',
            ] },
            { t: 'Empresas', p: [
                'Quem reivindica ou gerencia a página de uma empresa declara que está autorizado a representá-la.',
                'As empresas podem responder às avaliações, mas não podem modificá-las, pedir sua remoção em troca de algo nem oferecer incentivos em troca de uma avaliação positiva.',
                'Os widgets exibem as avaliações exatamente como estão publicadas no Opynio.',
            ] },
            { t: 'Planos e pagamentos', p: [
                'Algumas funcionalidades exigem um plano pago. O preço e as condições são exibidos antes da contratação, e a cobrança é processada pela Stripe. Você pode cancelar a renovação quando quiser pelo seu painel; o plano continua ativo até o fim do período pago.',
            ] },
            { t: 'Usos não permitidos', p: [
                'Não é permitido usar o Opynio para enviar spam, extrair dados de forma automatizada sem permissão, se passar por outra pessoa ou empresa, nem interferir no funcionamento do serviço.',
            ] },
            { t: 'Suspensão e encerramento da conta', p: [
                'Podemos suspender ou encerrar as contas que violarem estes termos. Você pode solicitar a exclusão da sua conta a qualquer momento pelo {soporte}.',
            ] },
            { t: 'Responsabilidade', p: [
                'Procuramos manter o serviço disponível e funcionando sem erros, mas não podemos garantir isso o tempo todo. O Opynio não se responsabiliza pelas opiniões dos usuários nem pelas relações entre usuários e empresas.',
            ] },
            { t: 'Alterações nos termos', p: [
                'Podemos atualizar estes termos. Se a alteração for importante, avisaremos você. A data da última atualização aparece no início desta página.',
            ] },
            { t: 'Legislação aplicável', p: [
                'Estes termos são regidos pela legislação espanhola. Se você for consumidor, mantém os direitos que lhe forem reconhecidos pela legislação do seu país de residência. Em caso de dúvida, escreva para nós pelo {soporte} ou pelo {contacto}.',
            ] },
        ],
    },
};

export default br;
