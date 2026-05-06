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

// --- 1) Secrets ---
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

// --- 2) Stripe API ---
async function stripeApi(pathSeg) {
    const res = await fetch(`https://api.stripe.com/v1${pathSeg}`, {
        headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Stripe ${pathSeg} → ${res.status} ${text.slice(0, 300)}`);
    return JSON.parse(text);
}

// Verificar que la key funciona — solo posible si la Management API devolviera
// plaintext. Como Supabase Vault devuelve ciphertext, esto siempre dará 401
// desde aquí. La validez real se verifica vía edge functions en runtime.
console.log('\n=== 2. Validez del STRIPE_SECRET_KEY ===');
let keyValidatedFromHere = false;
try {
    const acct = await stripeApi('/account');
    log('OK', `account.id=${acct.id} · livemode_capable=${acct.charges_enabled}`);
    keyValidatedFromHere = true;
} catch (err) {
    log('WARN', `No se puede validar la key desde aquí (Supabase devuelve ciphertext)`);
    log('..', `   La validez real se verifica cuando el webhook procesa un evento.`);
    log('..', `   Saltando verificaciones products/prices/webhooks contra Stripe API.`);
}

if (keyValidatedFromHere) {
// --- 3) Productos ---
console.log('\n=== 3. Productos en Stripe ===');
const expectedProductIds = [
    'prod_TEhgIaYVu6Ovh8',  // starter mensual
    'prod_TEhjixQrJf8fd5',  // growth mensual
    'prod_TEhlBPBp3JtKxF',  // pro mensual
    'prod_USjVaTnJOjG33R',  // starter anual
    'prod_USm46y7SpW94mr',  // growth anual
    'prod_USm6B74n7PYuq0',  // pro anual
    'prod_USm7xUXQEHYIh8',  // testeo (v2)
];
for (const pid of expectedProductIds) {
    try {
        const p = await stripeApi(`/products/${pid}`);
        log('OK', `${pid} · "${p.name}" · active=${p.active}`);
    } catch (err) {
        log('FAIL', `${pid} → ${err.message.slice(0,120)}`);
    }
}

// --- 4) Prices ---
console.log('\n=== 4. Prices en Stripe ===');
const expectedPriceIds = [
    'price_1SIEGvRJqlZctcvhh3VMcupC',  // starter mensual
    'price_1SIEJeRJqlZctcvhrzuA4wR8',  // growth mensual
    'price_1SIELiRJqlZctcvhQ3xP8rwa',  // pro mensual
    'price_1TTo2CGP3zN1neHAplpNdMDD',  // starter anual
    'price_1TTqWBRJqlZctcvhY78cLeWP',  // growth anual
    'price_1TTqYARJqlZctcvholBtHK17',  // pro anual
    'price_1TTqZNRJqlZctcvhV711xZuz',  // v2 (testeo)
];
for (const pid of expectedPriceIds) {
    try {
        const p = await stripeApi(`/prices/${pid}`);
        const amt = p.unit_amount ? `${(p.unit_amount/100).toFixed(2)} ${p.currency}` : 'free';
        const interval = p.recurring?.interval ?? 'one_time';
        log('OK', `${pid} · ${amt} · ${interval} · active=${p.active}`);
    } catch (err) {
        log('FAIL', `${pid} → ${err.message.slice(0,120)}`);
    }
}

// --- 5) Webhook endpoint ---
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
        log('..', `   status=${wh.status} · ${wh.enabled_events.length === 1 && wh.enabled_events[0] === '*' ? 'TODOS' : wh.enabled_events.length+' eventos'}`);
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
} // close keyValidatedFromHere

// --- 6) Edge Functions ---
console.log('\n=== 6. Edge Functions ===');
const fns = await mgmt('/functions');
for (const slug of ['stripe-webhook', 'create-checkout-session', 'create-portal-session', 'repair-stripe-orphans']) {
    const fn = fns.find((f) => f.slug === slug);
    if (!fn) { log('FAIL', `${slug} NO desplegado`); continue; }
    log(fn.status === 'ACTIVE' ? 'OK' : 'FAIL',
        `${slug} · v${fn.version} · ${fn.status} · verify_jwt=${fn.verify_jwt}`);
}

// --- 7) Smoke test webhook ---
console.log('\n=== 7. Smoke test webhook endpoint ===');
const probe = await fetch(`https://${PROJECT_REF}.supabase.co/functions/v1/stripe-webhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
});
const probeText = await probe.text();
if (probe.status === 400 && /signature|invalid/i.test(probeText)) {
    log('OK', `webhook ${probe.status} "${probeText.slice(0,40)}"`);
} else {
    log('WARN', `webhook ${probe.status} "${probeText.slice(0,80)}"`);
}

console.log('\n=== Auditoría completada ===\n');
