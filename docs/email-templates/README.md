# Plantillas de email — Supabase Auth

Diseño consistente con la marca Opynio (verde `#10b981`, tipografía Inter, layout
table-based para máxima compatibilidad cross-client). Sin emojis: todos los
iconos son SVG inline al estilo Heroicons / Feather.

## Archivos

| # | Archivo | Plantilla en Supabase | Asunto recomendado |
|---|---|---|---|
| 1 | `01-confirm-signup.html` | **Confirm signup** | Confirma tu registro en Opynio |
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

## Compatibilidad de los SVG

Los SVG inline funcionan en:
- Apple Mail (macOS, iOS) — perfecto.
- Gmail web — perfecto.
- Outlook 365 web — perfecto.
- Outlook desktop (Windows) — **degrada**: muestra el icono como rectángulo
  vacío. El resto del diseño se ve correctamente. Si la mayor parte de tus
  usuarios viven en Outlook desktop, hay que migrar los iconos a PNG en CDN.

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

- Subir los iconos a un CDN propio (ej. `cdn.opynio.com/email/`) y migrar los
  `<svg>` a `<img>` para soporte universal en Outlook desktop.
- Añadir una versión en inglés (Supabase no soporta múltiples templates por
  idioma de forma nativa; opciones: switching server-side antes de mandar el
  email, o un servicio de email transaccional como Resend/Postmark con
  templates por locale).
