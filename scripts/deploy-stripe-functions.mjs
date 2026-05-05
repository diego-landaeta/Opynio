// scripts/deploy-stripe-functions.mjs
//
// Despliega las 4 edge functions relacionadas con Stripe a Supabase.
// Usado tras edits locales para sincronizar producción sin pasar por la
// herramienta MCP (que requiere pegar el contenido inline).
//
// Uso:
//   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/deploy-stripe-functions.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_REF = 'hvtrrhxeqrsnjxhngdsj';
const PAT = process.env.SUPABASE_ACCESS_TOKEN;
if (!PAT) { console.error('SUPABASE_ACCESS_TOKEN required'); process.exit(1); }

const FUNCTIONS = [
    { slug: 'stripe-webhook',           verify_jwt: false },
    { slug: 'create-checkout-session',  verify_jwt: true },
    { slug: 'create-portal-session',    verify_jwt: true },
    { slug: 'repair-stripe-orphans',    verify_jwt: true },
];

const FUNCTIONS_DIR = path.resolve(__dirname, '..', 'supabase', 'functions');

for (const fn of FUNCTIONS) {
    const filePath = path.join(FUNCTIONS_DIR, fn.slug, 'index.ts');
    if (!fs.existsSync(filePath)) {
        console.error(`MISSING: ${filePath}`);
        process.exit(1);
    }
    const content = fs.readFileSync(filePath, 'utf8');

    // Endpoint: POST /v1/projects/{ref}/functions/deploy?slug={slug}
    // Body: multipart/form-data con metadata + archivos.
    const meta = {
        entrypoint_path: 'index.ts',
        name: fn.slug,
        verify_jwt: fn.verify_jwt,
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: 'application/typescript' }), 'index.ts');

    const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/deploy?slug=${encodeURIComponent(fn.slug)}`;

    process.stdout.write(`Deploying ${fn.slug}… `);
    const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${PAT}` },
        body: form,
    });
    const text = await res.text();
    if (!res.ok) {
        console.log(`FAILED (${res.status})`);
        console.log('  ', text.slice(0, 500));
        process.exit(1);
    }
    try {
        const data = JSON.parse(text);
        console.log(`OK (v${data.version})`);
    } catch {
        console.log(`OK`);
    }
}

console.log('\nAll 4 stripe functions deployed.');
