// scripts/diagnose-secret.mjs — solo imprime patrones, NO valores
const PROJECT_REF = 'hvtrrhxeqrsnjxhngdsj';
const PAT = process.env.SUPABASE_ACCESS_TOKEN;
if (!PAT) { console.error('SUPABASE_ACCESS_TOKEN required'); process.exit(1); }

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/secrets`, {
  headers: { Authorization: `Bearer ${PAT}` },
});
const secrets = await res.json();

const fmt = (v) => {
    if (!v) return '(empty)';
    const len = v.length;
    if (v.startsWith('sk_live_')) return `sk_live_xxx (len=${len})  ✓ Stripe LIVE secret`;
    if (v.startsWith('sk_test_')) return `sk_test_xxx (len=${len})  ✓ Stripe TEST secret`;
    if (v.startsWith('rk_live_')) return `rk_live_xxx (len=${len})  ⚠ Stripe restricted live`;
    if (v.startsWith('rk_test_')) return `rk_test_xxx (len=${len})  ⚠ Stripe restricted test`;
    if (v.startsWith('pk_live_')) return `pk_live_xxx (len=${len})  ✗ Stripe PUBLISHABLE (no sirve aquí)`;
    if (v.startsWith('pk_test_')) return `pk_test_xxx (len=${len})  ✗ Stripe PUBLISHABLE (no sirve aquí)`;
    if (v.startsWith('whsec_'))   return `whsec_xxx (len=${len})    ✗ Webhook signing secret (no es API key)`;
    if (v.startsWith('eyJ'))      return `JWT (len=${len})           ✗ Supabase JWT, no Stripe`;
    if (v.startsWith('https://')) return `URL (len=${len})            ✗ no es una clave`;
    if (/^[0-9a-f]{32,64}$/.test(v)) return `hex string (len=${len})    ✗ formato hex puro, no Stripe`;
    if (v.startsWith('sbp_'))     return `sbp_xxx (len=${len})        ✗ Supabase PAT, no Stripe`;
    return `desconocido (len=${len}, prefijo "${v.slice(0,4)}...")  ✗`;
};

console.log('--- Diagnóstico de secrets relacionados con Stripe ---\n');
const interesting = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SIGNING_SECRET', 'STRIPE_PUBLISHABLE_KEY'];
for (const name of interesting) {
    const s = secrets.find((x) => x.name === name);
    console.log(`${name}: ${s ? fmt(s.value) : '(no configurado)'}`);
}

console.log('\n--- Por si acaso: nombres similares por typo o duplicado ---');
const stripeRelated = secrets.filter((s) => /stripe/i.test(s.name) || s.value?.startsWith?.('sk_'));
for (const s of stripeRelated) {
    console.log(`  ${s.name}  →  ${fmt(s.value)}`);
}
