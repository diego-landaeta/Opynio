// scripts/create-user.mjs
//
// Crea un usuario en auth.users vía el Admin API de Supabase, saltando el
// flujo de email confirmation. Útil cuando se ha excedido el rate limit
// de emails de Supabase (4/hora por defecto en proyectos free).
//
// Uso (defaults a molinangel1012 / angelsp2006):
//   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/create-user.mjs
//
// Override email/password/nombre via env:
//   SUPABASE_ACCESS_TOKEN=sbp_xxx \
//   USER_EMAIL=foo@bar.com \
//   USER_PASSWORD=secret123 \
//   USER_NAME='Nombre Apellido' \
//   node scripts/create-user.mjs

const PROJECT_REF = 'hvtrrhxeqrsnjxhngdsj';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

const PAT = process.env.SUPABASE_ACCESS_TOKEN;
if (!PAT) {
    console.error('Required: SUPABASE_ACCESS_TOKEN (PAT con scope para Management API).');
    process.exit(1);
}

const email = process.env.USER_EMAIL || 'molinangel1012@gmail.com';
const password = process.env.USER_PASSWORD || 'angelsp2006';
const name = process.env.USER_NAME || 'Angel Molina';
const username = (process.env.USER_USERNAME || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_]/g, '');

// 1) Obtener service_role key vía Management API (mismo patrón que send-test-emails.mjs)
console.log('1/3 Fetching service_role key…');
const keysRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${PAT}` },
});
if (!keysRes.ok) {
    console.error(`  failed (${keysRes.status}):`, await keysRes.text());
    process.exit(1);
}
const keys = await keysRes.json();
const serviceRole = keys.find((k) => k.name === 'service_role')?.api_key;
if (!serviceRole) {
    console.error('  could not extract service_role:', keys);
    process.exit(1);
}
console.log('  OK');

// 2) Crear el usuario con email_confirm:true para que pueda hacer login sin verificar
console.log(`2/3 Creating user ${email}…`);
const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
    },
    body: JSON.stringify({
        email,
        password,
        email_confirm: true, // skip email verification
        user_metadata: {
            full_name: name,
            username,
        },
    }),
});
if (!createRes.ok) {
    const errText = await createRes.text();
    console.error(`  failed (${createRes.status}):`, errText);
    // Si el usuario ya existe Supabase devuelve 422 con error_code "email_exists"
    if (errText.includes('already been registered') || errText.includes('email_exists')) {
        console.error('  → El email ya existe. Bórralo primero o usa otro.');
    }
    process.exit(1);
}
const user = await createRes.json();
console.log(`  OK — user_id = ${user.id}`);

// 3) Confirmación final
console.log('3/3 Listo.');
console.log('');
console.log('   Email:    ', email);
console.log('   Password: ', password);
console.log('   User ID:  ', user.id);
console.log('   Username: ', username);
console.log('   Name:     ', name);
console.log('');
console.log('Puedes iniciar sesión directamente en /acceder con ese email/password.');
console.log('La confirmación de email se omitió (email_confirm:true).');
