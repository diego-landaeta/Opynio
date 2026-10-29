# Plantillas de email — Supabase Auth

Diseño consistente con la marca Opynio (verde `#10b981`, tipografía Inter, layout
table-based para máxima compatibilidad cross-client). Sin emojis: todos los
iconos son PNG alojados en `https://web.opynio.com/email-icons/` (carpeta `public/email-icons`).

## Archivos

| # | Archivo | Plantilla en Supabase | Asunto recomendado |
|---|---|---|---|
| 1 | `01-confirm-signup.html` | **Confirm signup** | Confirma tu registro en Opynio |
| 1b | `01b-confirm-signup-business.html` | *(solo en send-auth-email)* | Confirma tu cuenta de empresa en Opynio |
| 2 | `02-magic-link.html` | **Magic link** | Tu enlace mágico de Opynio |
| 3 | `03-reset-password.html` | **Reset password** | Restablece tu contraseña en Opynio |
| 4 | `04-change-email.html` | **Change email address** | Confirma tu nuevo email en Opynio |
| 5 | `05-invite-user.html` | **Invite user** | Te han invitado a Opynio |
| 6 | `06-reauthentication.html` | **Reauthentication** | Tu código de seguridad de Opynio |

## Cómo aplicarlos

1. Abre **Supabase Dashboard → Authentication → Email Templates**:
   <https://supabase.com/dashboard/project/hvtrrhxeqrsnjxhngdsj/auth/templates>
2. Selecciona la plantilla en el desplegable.
3. Cambia el "**Subject**" según la tabla de arriba.
4. Pega el contenido completo del archivo `.html` correspondiente en el editor
   de body.
5. **Save changes**.
6. Pulsa "Send test email" para verificar.

Los cambios son inmediatos: no hace falta redeploy.

## Variables Supabase incluidas

Cada plantilla usa solo las variables que aplican a su flujo:

- `{{ .ConfirmationURL }}` — todas excepto reauthentication.
- `{{ .Token }}` — solo reauthentication (código de 6 dígitos).
- `{{ .Email }}` — change email (email actual).
- `{{ .NewEmail }}` — change email (email nuevo).

## Iconos

Los iconos son `<img>` PNG (24x24 y 16x16 px) con `alt=""` (decorativos). Se ven igual en Outlook de escritorio;
si se bloquean las imágenes, el correo sigue siendo legible (el botón y el enlace en claro no dependen de ellas).

## Personalización rápida

- **Color de marca**: busca `#10b981` y reemplaza por tu nuevo verde si cambias
  la identidad.
- **Logo**: el bloque `<a href="https://web.opynio.com">Opynio</a>` se puede
  sustituir por una etiqueta `<img>` con el logo (alojado en CDN público con
  buen alt text). Mantén `width` <= 600px.
- **Footer**: links a `web.opynio.com` y `web.opynio.com/soporte`. Si añades
  redes sociales o RGPD/dirección física, hazlo dentro de la celda del footer.

## Dark mode

Todas las plantillas tienen reglas `@media (prefers-color-scheme: dark)`. En
clientes que respetan la preferencia (Apple Mail, iOS Mail, algunos Outlook
365) los fondos se invertirán automáticamente. Gmail no respeta esa media
query — verá la versión clara siempre, lo cual es aceptable.

## Próximos pasos sugeridos

- Añadir una versión en inglés (Supabase no soporta múltiples templates por
  idioma de forma nativa; opciones: switching server-side antes de mandar el
  email, o un servicio de email transaccional como Resend/Postmark con
  templates por locale).

## Nota (15/10/2026)

Las plantillas se compactaron (issue #3): cabecera y tarjeta del mismo ancho (600 px) sin solape, icono pequeño
y el botón visible sin hacer scroll. La **1b** es la de **cuentas de empresa**: la usa `send-auth-email` cuando el alta
viene de `signUpBusiness` (`intended_role = business_owner` o `?type=business` en el redirect). Estos ficheros son la
copia de referencia; lo que se envía vive en `supabase/functions/send-auth-email/plantillas.ts`.

## Nota (23/10/2026, revisión de QA)

- Cabecera: `bgcolor` y `background-color` verde de respaldo. Sin él, en clientes que no pintan gradientes (Outlook de escritorio) el logo blanco quedaba sobre fondo claro e invisible.
- Botón: `mso-padding-alt` en la celda para que Outlook de escritorio conserve el relleno (ignora el `padding` del `<a>`).
- Modo oscuro: clases `text-brand`, `warn-text`, `text-strong` y `divider-bg` (antes el aviso amarillo de «Restablecer contraseña» y «El código expira en 5 minutos» eran casi ilegibles).
- Contraste en modo claro: texto verde `#047857` en eyebrows, enlace en claro y logo del pie; gris pequeño `#6b6b73`. El texto blanco del botón sobre `#10b981` (2,5:1) es decisión de marca y queda como está.
- Código de reautenticación centrado (compensa el `letter-spacing` final).
- Cabecera (29/10/2026): fondo de respaldo `#047857` y degradado `#065f46` a `#047857`; eslogan en `#ecfdf5` (sin `rgba`, que Outlook ignora). Con `#10b981` el blanco daba 2,5:1 (logo) y 2,1:1 (eslogan); ahora superan 4,5:1. Tablas de tarjeta y pie con `width:100%` en línea.
- Caducidad (23/10/2026): Supabase Auth usa un único «Email OTP Expiration» para todos los enlaces y códigos de correo. Valor REAL en producción, leído con la API de gestión: 86400 s = 24 horas. Todos los textos dicen «24 horas». Ojo: `otp_expiry = 3600` de `supabase/config.toml` es solo del entorno local y no refleja producción. Si se cambia el valor en el panel de Supabase, hay que cambiar a la vez estos textos.
