// scripts/send-test-emails.mjs
//
// Dispara 4 de los 6 templates de auth contra un email real para verificar
// el render en bandeja. Los 2 que no se pueden enviar sin sesión activa
// (Change email + Reauthentication) hay que probarlos desde el Dashboard.
//
// Uso:
//   SUPABASE_ACCESS_TOKEN=sbp_xxx TARGET_EMAIL=tu@email.com node scripts/send-test-emails.mjs

import path from 'node:path';

const PROJECT_REF = 'hvtrrhxeqrsnjxhngdsj';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

const PAT = process.env.SUPABASE_ACCESS_TOKEN;
const TARGET = process.env.TARGET_EMAIL;
if (!PAT || !TARGET) {
    console.error('Required: SUPABASE_ACCESS_TOKEN, TARGET_EMAIL');
    process.exit(1);
}

// Gmail trata `foo+anything@gmail.com` como el mismo inbox, así que cuatro
// alias del mismo email llegan al mismo buzón sin chocar.
const [local, domain] = TARGET.split('@');
const emailMagic   = TARGET;
const emailRecover = TARGET;
const emailSignup  = `${local}+opynio-signup@${domain}`;
const emailInvite  = `${local}+opynio-invite@${domain}`;

// 1) Obtener anon key + service role via Management API (necesario para admin endpoints)
console.log('1/5 Fetching project API keys via Management API…');
const keysRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${PAT}` },
});
if (!keysRes.ok) {
    console.error(`  failed (${keysRes.status}):`, await keysRes.text());
    process.exit(1);
}
const keys = await keysRes.json();
const anon = keys.find((k) => k.name === 'anon')?.api_key;
const serviceRole = keys.find((k) => k.name === 'service_role')?.api_key;
if (!anon || !serviceRole) {
    console.error('  could not extract keys from response:', keys);
    process.exit(1);
}
console.log('  OK — anon + service_role obtained');

async function call(label, url, body, key, extraHeaders = {}) {
    const headers = {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...extraHeaders,
    };
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await res.text();
    const ok = res.ok || (res.status >= 200 && res.status < 300);
    console.log(`  ${ok ? 'OK ' : 'XX '} [${res.status}] ${label}`);
    if (!ok) console.log(`     ${text.slice(0, 200)}`);
    return ok;
}

// 2) Magic link → POST /auth/v1/otp con create_user=false (si user no existe, error)
console.log(`\n2/5 Magic link → ${emailMagic}`);
await call('magic link', `${SUPABASE_URL}/auth/v1/otp`, {
    email: emailMagic,
    create_user: true,           // permite crear el usuario si no existe (útil para tu caso real)
}, anon);

// 3) Reset password → POST /auth/v1/recover (manda recovery siempre, exista o no)
console.log(`\n3/5 Reset password → ${emailRecover}`);
await call('reset password', `${SUPABASE_URL}/auth/v1/recover`, {
    email: emailRecover,
}, anon);

// 4) Confirm signup → POST /auth/v1/signup con email +alias para que sea nuevo
console.log(`\n4/5 Confirm signup → ${emailSignup}`);
await call('confirm signup', `${SUPABASE_URL}/auth/v1/signup`, {
    email: emailSignup,
    password: `OpynioTest_${Date.now()}!`,    // password aleatoria, no se usa
}, anon);

// 5) Invite user → POST /auth/v1/invite con +alias diferente, requiere service_role
console.log(`\n5/5 Invite user → ${emailInvite}`);
await call('invite', `${SUPABASE_URL}/auth/v1/invite`, {
    email: emailInvite,
}, serviceRole);

console.log('\nDone.');
console.log('\nDeberías recibir 4 emails (todos al inbox principal de tu Gmail):');
console.log(`  • Magic link        → ${emailMagic}`);
console.log(`  • Reset password    → ${emailRecover}`);
console.log(`  • Confirm signup    → ${emailSignup}`);
console.log(`  • Invitation        → ${emailInvite}`);
console.log('\nPara los 2 restantes (Change email + Reauthentication) usa el dashboard:');
console.log('  https://supabase.com/dashboard/project/' + PROJECT_REF + '/auth/templates');
