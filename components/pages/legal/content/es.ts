import type { LegalContent } from '../types';

// Version en español: es la que prevalece. Las traducciones parten de aqui.
const es: LegalContent = {
    actualizado: 'Última actualización',
    nota: '',
    enlaces: {
        contacto: 'formulario de contacto',
        soporte: 'Soporte',
        privacidad: 'política de privacidad',
        terminos: 'Términos de uso',
        avisoLegal: 'aviso legal',
    },

    privacidad: {
        titulo: 'Privacidad y cookies',
        meta: 'Cómo trata Opynio tus datos personales y qué cookies usa.',
        secciones: [
            { t: 'Quién trata tus datos', p: [
                'Opynio, la plataforma de reseñas de empresas de este sitio. Para cualquier cuestión sobre tus datos escríbenos desde el {contacto}.',
            ] },
            { t: 'Qué datos tratamos', p: [
                'Si creas una cuenta: nombre, nombre de usuario, email, foto de perfil (opcional) y tus preferencias de idioma, país, tema y avisos.',
                'Lo que publicas: reseñas, fotos o audios que adjuntes, votos y respuestas. Las reseñas son públicas y pueden mostrarse en la web de la empresa reseñada mediante nuestros widgets.',
                'Si gestionas una empresa: sus datos de ficha y, si contratas un plan, los datos de facturación, que gestiona Stripe (Opynio no guarda los datos de tu tarjeta).',
                'Lo que nos envías por soporte o por el formulario de contacto.',
            ] },
            { t: 'Para qué y con qué base', p: [
                'Prestar el servicio que pides: tu cuenta, publicar y moderar reseñas, gestionar tu empresa y tus pagos.',
                'Seguridad y prevención de abusos (reseñas falsas, spam), por nuestro interés legítimo.',
                'Avisos por correo sobre tu actividad (respuestas de soporte, reseñas nuevas en tu empresa). Puedes desactivarlos en Ajustes.',
                'Medir nuestras campañas con Meta, solo si aceptas las cookies de medición y publicidad.',
            ] },
            { t: 'Con quién se comparten', p: [
                'Con los proveedores que necesitamos para funcionar: Supabase (alojamiento y base de datos), Stripe (pagos), nuestro proveedor de envío de correos y, solo con tu permiso, Meta. No vendemos tus datos.',
            ] },
            { t: 'Cuánto tiempo', p: [
                'Mientras tengas la cuenta. Si pides eliminarla, borramos tus datos salvo lo que la ley nos obligue a conservar (por ejemplo, facturas).',
            ] },
            { t: 'Tus derechos', p: [
                'Puedes pedir acceso, rectificación, supresión, oposición, limitación y portabilidad de tus datos desde {soporte} o el {contacto}. Si no quedas conforme, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).',
            ] },
        ],
        cookies: {
            t: 'Cookies',
            intro: 'Usamos el almacenamiento de tu navegador para que la web funcione y, solo si lo aceptas, cookies de Meta para medir nuestras campañas.',
            filas: [
                ['Necesarias (siempre activas)', 'Mantener tu sesión y recordar tus preferencias: idioma, país, tema y tu elección sobre cookies.'],
                ['Medición y publicidad (opcionales)', 'Meta Pixel (_fbp, _fbc). Solo se activan si aceptas en el aviso de cookies o en Ajustes › Privacidad.'],
            ],
            boton: 'Configurar cookies',
        },
    },

    avisoLegal: {
        titulo: 'Aviso legal',
        meta: 'Datos del titular de Opynio y condiciones de uso del sitio web.',
        secciones: [
            { t: 'Titular del sitio web',
              intro: 'En cumplimiento de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE), estos son los datos del titular de este sitio web:',
              p: [
                'Titular: {titular}',
                'NIF: {nif}',
                'Domicilio: {domicilio}',
                'Datos registrales: {registro}',
                'Email: {email}',
                'Sitio web: {web}',
            ] },
            { t: 'Objeto', p: [
                'Opynio es una plataforma en la que los usuarios publican reseñas sobre empresas, y las empresas gestionan su ficha, responden a las reseñas y pueden mostrarlas en su web mediante widgets. Usar el sitio implica aceptar este aviso legal y los {terminos}.',
            ] },
            { t: 'Propiedad intelectual e industrial', p: [
                'El diseño, el código, la marca Opynio y los contenidos propios del sitio pertenecen a su titular o a terceros que han autorizado su uso. No se permite reproducirlos, distribuirlos ni transformarlos sin autorización, salvo para uso personal y privado.',
                'Las reseñas pertenecen a quien las escribe, que concede a Opynio una licencia para publicarlas, como se explica en los {terminos}.',
                'Los nombres y marcas de las empresas reseñadas pertenecen a sus respectivos titulares.',
            ] },
            { t: 'Responsabilidad', p: [
                'Las reseñas expresan la opinión de quien las escribe, no la de Opynio. Moderamos los contenidos para retirar los que incumplen nuestras normas o la ley, pero no podemos garantizar la exactitud de cada opinión. Opynio no responde de los daños derivados de un uso indebido del sitio ni del contenido de las webs de terceros enlazadas desde él.',
            ] },
            { t: 'Contenidos ilícitos', p: [
                'Si crees que un contenido publicado en Opynio es ilícito o vulnera tus derechos, comunícanoslo desde {soporte} o el {contacto} y lo revisaremos lo antes posible.',
            ] },
            { t: 'Protección de datos', p: [
                'Cómo tratamos tus datos personales se explica en la {privacidad}.',
            ] },
            { t: 'Legislación aplicable', p: [
                'Este aviso legal se rige por la legislación española. Para cualquier controversia serán competentes los juzgados y tribunales que correspondan según la ley; si eres consumidor, los de tu domicilio.',
            ] },
        ],
    },

    terminos: {
        titulo: 'Términos de uso',
        meta: 'Condiciones para usar Opynio como usuario o como empresa: cuenta, reseñas, planes y normas.',
        secciones: [
            { t: 'Aceptación', p: [
                'Estos términos regulan el uso de Opynio por parte de usuarios y empresas. Al crear una cuenta o usar el servicio los aceptas; si no estás de acuerdo, no utilices la plataforma. Complementan el {avisoLegal} y la {privacidad}.',
            ] },
            { t: 'Tu cuenta', p: [
                'Para escribir reseñas o gestionar una empresa necesitas una cuenta. Debes tener la edad mínima que exija la ley de tu país (en España, 14 años), dar datos verdaderos y mantener segura tu contraseña. Eres responsable de lo que se haga desde tu cuenta.',
            ] },
            { t: 'Reseñas', p: [
                'Escribe solo sobre experiencias reales con la empresa reseñada, con respeto y sin incluir datos personales de otras personas.',
                'No se permiten reseñas falsas o pagadas, sobre tu propio negocio o el de la competencia, ni contenidos ofensivos, discriminatorios, ilícitos o publicitarios.',
                'Las reseñas siguen siendo tuyas, pero al publicarlas concedes a Opynio una licencia gratuita, mundial y no exclusiva para mostrarlas en la plataforma y en los widgets que las empresas insertan en su web, mientras sigan publicadas.',
                'Podemos moderar, ocultar o retirar las reseñas que incumplan estos términos. Puedes editar o eliminar las tuyas desde tu perfil.',
            ] },
            { t: 'Empresas', p: [
                'Quien reclama o gestiona una ficha declara que está autorizado para representar a esa empresa.',
                'Las empresas pueden responder a las reseñas, pero no pueden modificarlas, pedir su retirada a cambio de algo ni ofrecer incentivos a cambio de una valoración positiva.',
                'Los widgets muestran las reseñas tal como están publicadas en Opynio.',
            ] },
            { t: 'Planes y pagos', p: [
                'Algunas funciones requieren un plan de pago. El precio y las condiciones se muestran antes de contratar y el cobro lo gestiona Stripe. Puedes cancelar la renovación cuando quieras desde tu panel; el plan sigue activo hasta el final del periodo pagado.',
            ] },
            { t: 'Usos no permitidos', p: [
                'No se permite usar Opynio para enviar spam, extraer datos de forma automatizada sin permiso, hacerse pasar por otra persona o empresa, ni interferir en el funcionamiento del servicio.',
            ] },
            { t: 'Suspensión y baja', p: [
                'Podemos suspender o cerrar las cuentas que incumplan estos términos. Puedes pedir la eliminación de tu cuenta en cualquier momento desde {soporte}.',
            ] },
            { t: 'Responsabilidad', p: [
                'Procuramos que el servicio esté disponible y funcione sin errores, pero no podemos garantizarlo en todo momento. Opynio no responde de las opiniones de los usuarios ni de las relaciones entre usuarios y empresas.',
            ] },
            { t: 'Cambios en los términos', p: [
                'Podemos actualizar estos términos. Si el cambio es importante, te avisaremos. La fecha de la última actualización aparece al principio de esta página.',
            ] },
            { t: 'Legislación aplicable', p: [
                'Estos términos se rigen por la legislación española. Si eres consumidor, conservas los derechos que te reconozca la normativa de tu país de residencia. Para cualquier duda, escríbenos desde {soporte} o el {contacto}.',
            ] },
        ],
    },
};

export default es;
