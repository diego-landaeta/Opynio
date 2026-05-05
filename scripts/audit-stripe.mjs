// scripts/audit-stripe.mjs
//
// Auditoría exhaustiva del estado de Stripe + Supabase Auth + Webhook.
// NO imprime valores de secrets, solo nombres y estados.
//
// Uso:
//   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/audit-stripe.mjs

const PROJECT_REF = 'hvtrrhxeqrsnjxhngdsj';
const PAT = process.env.SUPABASE_ACCESS_TOKEN;
if (!PAT) { console.error('SUPABASE_ACCESS_TOKEN required'); process.exit(1); }

const log = (level, ...args) => {
    const prefix = level === 'OK' ? '\x1b[32m[OK]\x1b[0m' : level === 'WARN' ? '\x1b[33m[WARN]\x1b[0m' : level === 'FAIL' ? '\x1b[31m[FAIL]\x1b[0m' : '\x1b[36m[..]\x1b[0m';
    console.log(prefix, ...args);
};

async function mgmt(pathSeg) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}${pathSeg}`, {
        headers: { Authorization: `Bearer ${PAT}` },
    });
    if (!res.ok) throw new Error(`Mgmt API ${pathSeg} → ${res.status} ${await res.text()}`);
    return res.json();
}

// --- 1) Secrets configurados ---
console.log('\n=== 1. Edge Function secrets ===');
const secrets = await mgmt('/secrets');
const expected = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SIGNING_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const present = new Set(secrets.map((s) => s.name));
for (const name of expected) {
    if (present.has(name)) log('OK', name, 'configurado');
    else log('FAIL', name, 'NO configurado');
}
const stripeSecretObj = secrets.find((s) => s.name === 'STRIPE_SECRET_KEY');
const STRIPE_SECRET_KEY = stripeSecretObj?.value;
if (!STRIPE_SECRET_KEY) {
    log('FAIL', 'STRIPE_SECRET_KEY no disponible — abortando');
    process.exit(1);
}

const isLive = STRIPE_SECRET_KEY.startsWith('sk_live_');
const isTest = STRIPE_SECRET_KEY.startsWith('sk_test_');
log(isLive ? 'OK' : isTest ? 'WARN' : 'FAIL', `Modo: ${isLive ? 'LIVE' : isTest ? 'TEST' : 'desconocido'}`);

// --- 2) Stripe API calls ---
async function stripeApi(pathSeg) {
    const res = await fetch(`https://api.stripe.com/v1${pathSeg}`, {
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Stripe ${pathSeg} → ${res.status} ${text.slice(0, 300)}`);
    return JSON.parse(text);
}

// --- 3) Verificar products ---
console.log('\n=== 2. Productos en Stripe ===');
const expectedProductIds = [
    'prod_USjSKfUeGP823n', 'prod_USjTkEv3StpcD3', 'prod_USjUzmuZSHLZKt',
    'prod_USjVaTnJOjG33R', 'prod_USjVBCDee4m7AZ', 'prod_USjWpgHHEjtyfO',
    'prod_USjZXYdBTAToZB',
];
for (const pid of expectedProductIds) {
    try {
        const p = await stripeApi(`/products/${pid}`);
        log('OK', `${pid} · "${p.name}" · active=${p.active}`);
    } catch (err) {
        log('FAIL', `${pid} → ${err.message}`);
    }
}

// --- 4) Verificar prices ---
console.log('\n=== 3. Prices en Stripe ===');
const expectedPriceIds = [
    'price_1TTnzlGP3zN1neHAKltGEqOy', 'price_1TTo0DGP3zN1neHAoJoiJKhu',
    'price_1TTo17GP3zN1neHAXzBZ9dD0', 'price_1TTo2CGP3zN1neHAplpNdMDD',
    'price_1TTo2dGP3zN1neHAsg6PbzeJ', 'price_1TTo3gGP3zN1neHArXBCKxyq',
    'price_1TTo6JGP3zN1neHAXHFYpy1l',
];
for (const pid of expectedPriceIds) {
    try {
        const p = await stripeApi(`/prices/${pid}`);
        const amt = p.unit_amount ? `${(p.unit_amount/100).toFixed(2)} ${p.currency}` : 'free';
        const interval = p.recurring?.interval ?? 'one_time';
        log('OK', `${pid} · ${amt} · ${interval} · active=${p.active}`);
    } catch (err) {
        log('FAIL', `${pid} → ${err.message}`);
    }
}

// --- 5) Customers cross-account ---
console.log('\n=== 4. Customers (verifica si la cuenta es la misma) ===');
const customerIds = ['cus_TFs9vasLOLzYeW', 'cus_UQWcl9A2zon1A4', 'cus_TEjThxHNG8QNzC'];
for (const cid of customerIds) {
    try {
        const c = await stripeApi(`/customers/${cid}`);
        log('OK', `${cid} · ${c.email ?? '(no email)'} · created=${new Date(c.created*1000).toISOString().slice(0,10)}`);
    } catch (err) {
        log('FAIL', `${cid} → ${err.message.slice(0, 120)}`);
    }
}

// --- 6) Webhook endpoint en Stripe ---
console.log('\n=== 5. Webhook configurado en Stripe ===');
try {
    const list = await stripeApi('/webhook_endpoints');
    if (list.data.length === 0) {
        log('FAIL', 'No hay webhooks configurados en la cuenta Stripe');
    }
    for (const wh of list.data) {
        const isOurs = wh.url.includes('hvtrrhxeqrsnjxhngdsj.supabase.co/functions/v1/stripe-webhook');
        const status = wh.status === 'enabled' ? 'OK' : 'WARN';
        log(isOurs ? status : 'WARN', `${isOurs ? '★ NUESTRO →' : 'otro →'} ${wh.url}`);
        log('..', `   status=${wh.status} · ${wh.enabled_events.length === 1 && wh.enabled_events[0] === '*' ? 'TODOS los eventos' : wh.enabled_events.length+' eventos suscritos'}`);
        if (isOurs) {
            const required = [
                'checkout.session.completed',
                'customer.subscription.created',
                'customer.subscription.updated',
                'customer.subscription.deleted',
                'invoice.paid',
                'invoice.payment_failed',
                'checkout.session.async_payment_succeeded',
                'checkout.session.async_payment_failed',
            ];
            const subscribesAll = wh.enabled_events.length === 1 && wh.enabled_events[0] === '*';
            for (const ev of required) {
                const has = subscribesAll || wh.enabled_events.includes(ev);
                log(has ? 'OK' : 'WARN', `   ${has ? '✓' : '✗'} ${ev}`);
            }
        }
    }
} catch (err) {
    log('FAIL', `webhook_endpoints → ${err.message}`);
}

// --- 7) Edge Functions deployment ---
console.log('\n=== 6. Edge Functions ===');
const fns = await mgmt('/functions');
for (const slug of ['stripe-webhook', 'create-checkout-session', 'create-portal-session', 'repair-stripe-orphans']) {
    const fn = fns.find((f) => f.slug === slug);
    if (!fn) { log('FAIL', `${slug} NO desplegado`); continue; }
    log(fn.status === 'ACTIVE' ? 'OK' : 'FAIL',
        `${slug} · v${fn.version} · ${fn.status} · verify_jwt=${fn.verify_jwt}`);
}

// --- 8) Smoke test endpoint webhook ---
console.log('\n=== 7. Smoke test webhook endpoint ===');
const probe = await fetch(`https://${PROJECT_REF}.supabase.co/functions/v1/stripe-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
});
const probeText = await probe.text();
if (probe.status === 400 && /signature|invalid/i.test(probeText)) {
    log('OK', `webhook responde ${probe.status} "${probeText.slice(0,40)}" sin Stripe-Signature (correcto)`);
} else {
    log('WARN', `webhook respondió ${probe.status} "${probeText.slice(0,80)}"`);
}

console.log('\n=== Auditoría completada ===\n');
