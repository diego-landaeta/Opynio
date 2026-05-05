// scripts/update-email-templates.mjs
//
// Sube las plantillas de email (en docs/email-templates/) a Supabase Auth
// mediante la Management API. Idempotente: vuelve a correr y sobreescribe.
//
// Requisitos:
//   - Node 18+ (fetch nativo).
//   - Variable de entorno SUPABASE_ACCESS_TOKEN con un PAT del owner del
//     proyecto: https://supabase.com/dashboard/account/tokens
//
// Uso:
//   SUPABASE_ACCESS_TOKEN=sb_pat_xxxxx node scripts/update-email-templates.mjs
//
// O en Windows PowerShell:
//   $env:SUPABASE_ACCESS_TOKEN="sb_pat_xxxxx"
//   node scripts/update-email-templates.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = 'hvtrrhxeqrsnjxhngdsj';
const TEMPLATES_DIR = path.resolve(__dirname, '..', 'docs', 'email-templates');

const PAT = process.env.SUPABASE_ACCESS_TOKEN;
if (!PAT) {
    console.error('Falta la variable de entorno SUPABASE_ACCESS_TOKEN (PAT de Supabase).');
    console.error('Generala en https://supabase.com/dashboard/account/tokens');
    process.exit(1);
}

function readTemplate(filename) {
    const fullPath = path.join(TEMPLATES_DIR, filename);
    return fs.readFileSync(fullPath, 'utf8');
}

// Mapeo Supabase Auth Config keys → archivos locales + asuntos.
const config = {
    // Confirm signup
    mailer_subjects_confirmation: 'Confirma tu registro en Opynio',
    mailer_templates_confirmation_content: readTemplate('01-confirm-signup.html'),

    // Magic link
    mailer_subjects_magic_link: 'Tu enlace mágico de Opynio',
    mailer_templates_magic_link_content: readTemplate('02-magic-link.html'),

    // Reset password (recovery)
    mailer_subjects_recovery: 'Restablece tu contraseña en Opynio',
    mailer_templates_recovery_content: readTemplate('03-reset-password.html'),

    // Change email
    mailer_subjects_email_change: 'Confirma tu nuevo email en Opynio',
    mailer_templates_email_change_content: readTemplate('04-change-email.html'),

    // Invite user
    mailer_subjects_invite: 'Te han invitado a Opynio',
    mailer_templates_invite_content: readTemplate('05-invite-user.html'),

    // Reauthentication
    mailer_subjects_reauthentication: 'Tu código de seguridad de Opynio',
    mailer_templates_reauthentication_content: readTemplate('06-reauthentication.html'),
};

const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;

console.log(`PATCH ${url}`);
console.log(`  ${Object.keys(config).length} fields (templates + subjects)`);

const res = await fetch(url, {
    method: 'PATCH',
    headers: {
        Authorization: `Bearer ${PAT}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
});

const text = await res.text();
if (!res.ok) {
    console.error(`Failed (${res.status}):`, text);
    process.exit(1);
}

console.log('OK — templates aplicados a Supabase Auth.');
console.log('Verificalo en https://supabase.com/dashboard/project/' + PROJECT_REF + '/auth/templates');
