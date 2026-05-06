// Renderiza los iconos SVG usados en docs/email-templates/*.html a PNG
// transparentes en public/email-icons/. Los emails referencian los PNG
// vía https://web.opynio.com/email-icons/<nombre>.png para que Gmail
// y otros clientes que filtran <svg> los muestren igualmente.
//
// Uso: node scripts/render-email-icons.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'email-icons');
const TMP_DIR = path.join(ROOT, 'scripts', 'email-icon-sources');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

// Cada icono lleva su SVG inline (el mismo que estaba en los templates),
// el tamaño final que tendrá en el email, y el factor 2x para retina.
// El círculo de fondo se queda en el HTML del email (es un <td>), aquí
// sólo rasterizamos el lineart con stroke verde brand.
const ICONS = [
  // === 01-confirm-signup ===
  {
    name: 'hero-confirm', display: 40, ratio: 2,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l9 6 9-6"/><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="18" cy="6" r="3.5" fill="#10b981" stroke="#ffffff" stroke-width="1.2"/><path d="M16.5 6l1.2 1.2L19.5 5.2" stroke="#ffffff" stroke-width="1.6"/></svg>`,
  },
  {
    name: 'feat-star', display: 16, ratio: 2,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.5 6.8H22l-6.5 4.7 2.5 6.8-6-4.5-6 4.5 2.5-6.8L2 8.8h7.5z"/></svg>`,
  },
  {
    name: 'feat-search', display: 16, ratio: 2,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  },
  {
    name: 'feat-home', display: 16, ratio: 2,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  },

  // === 02-magic-link ===
  {
    name: 'hero-bolt', display: 40, ratio: 2,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#10b981" stroke="#10b981" stroke-width="1.5" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  },
  {
    name: 'inline-lock', display: 22, ratio: 2,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
  },

  // === 03-reset-password ===
  {
    name: 'hero-key', display: 40, ratio: 2,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15L19 4"/><path d="M18 5l3 3"/><path d="M15 8l3 3"/></svg>`,
  },
  {
    name: 'inline-warn', display: 22, ratio: 2,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  },

  // === 04-change-email ===
  {
    name: 'hero-envelope', display: 40, ratio: 2,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 7l9 6 9-6"/><path d="M14 13l3 3 3-3" stroke="#10b981"/></svg>`,
  },
  {
    name: 'inline-arrow', display: 24, ratio: 2,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>`,
  },

  // === 05-invite-user ===
  {
    name: 'hero-user-plus', display: 40, ratio: 2,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`,
  },

  // === 06-reauthentication ===
  {
    name: 'hero-shield-check', display: 40, ratio: 2,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>`,
  },
];

async function ensureDirs() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(TMP_DIR, { recursive: true });
}

function buildHtml(icon) {
  // Tamaño físico del PNG = display * ratio (retina). El SVG se escala via
  // width/height del propio elemento — así la imagen rasterizada queda
  // nítida en pantallas de alta densidad.
  const px = icon.display * icon.ratio;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:transparent;width:${px}px;height:${px}px;overflow:hidden}
.box{width:${px}px;height:${px}px;display:flex;align-items:center;justify-content:center}
.box svg{width:${px}px;height:${px}px}
</style></head>
<body><div class="box">${icon.svg}</div></body></html>`;
}

async function renderIcon(icon) {
  const px = icon.display * icon.ratio;
  const htmlPath = path.join(TMP_DIR, `${icon.name}.html`);
  const pngPath = path.join(OUT_DIR, `${icon.name}.png`);
  const html = buildHtml(icon);
  await fs.writeFile(htmlPath, html, 'utf8');

  // Edge headless: --screenshot guarda el PNG visible. --window-size fija
  // viewport. --default-background-color=00000000 fuerza fondo transparente
  // en lugar de blanco. --hide-scrollbars evita barras dentro del frame.
  const cmd = `"${EDGE}" --headless --disable-gpu --hide-scrollbars --default-background-color=00000000 --screenshot="${pngPath}" --window-size=${px},${px} "file:///${htmlPath.replace(/\\/g, '/')}"`;
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 30_000 });
  } catch (e) {
    // Edge a veces sale con código != 0 aunque el PNG se haya escrito bien.
    // Verificamos por el archivo en lugar de por el exit code.
  }
  const stat = await fs.stat(pngPath).catch(() => null);
  if (!stat || stat.size === 0) {
    throw new Error(`No se generó ${icon.name}.png`);
  }
  console.log(`OK  ${icon.name}.png  (${px}x${px}, ${stat.size} bytes)`);
}

async function main() {
  await ensureDirs();
  for (const icon of ICONS) {
    await renderIcon(icon);
  }
  console.log(`\n${ICONS.length} iconos generados en ${OUT_DIR}`);
}

main().catch(err => {
  console.error('FAIL:', err);
  process.exit(1);
});
