/**
 * Inserta claves de traduccion nuevas en los 31 locales de una vez.
 * Guia: docs/playbooks/add-i18n-keys.md
 *
 *   node scripts/i18n-inyectar.mjs <traducciones.mjs> --bloque <bloque> --tras <clave> [--dry-run]
 *
 *   <traducciones.mjs>  modulo que exporta KEYS = { es: { clave: 'texto', ... }, en: {...}, ... }
 *                       con las MISMAS claves en todos los idiomas (uno por fichero de locales/).
 *   --bloque            bloque de primer nivel del locale donde van (common, editProfile, paths...).
 *   --tras              clave de ese bloque tras la que se insertan (el ancla; debe existir una vez).
 *   --dry-run           informa sin escribir.
 *
 * Idempotente: un locale que ya tiene la primera clave nueva en ese bloque se salta.
 * Aborta sin escribir nada si falta un idioma, sobran o faltan claves, o el ancla no esta.
 * Ejecutar con el lock si hay otros procesos tocando locales:
 *   until mkdir scripts/_i18n.lock 2>/dev/null; do sleep 1; done; node ...; rmdir scripts/_i18n.lock
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const fichero = args.find((a, i) => !a.startsWith('--') && !['--bloque', '--tras'].includes(args[i - 1]));
const bloque = opt('--bloque');
const ancla = opt('--tras');
const dry = args.includes('--dry-run');
if (!fichero || !bloque || !ancla) {
  console.error('Uso: node scripts/i18n-inyectar.mjs <traducciones.mjs> --bloque <bloque> --tras <clave> [--dry-run]');
  process.exit(1);
}

const { KEYS } = await import(pathToFileURL(path.resolve(fichero)).href);
const DIR = 'locales';
const locales = fs.readdirSync(DIR).filter(f => f.endsWith('.ts')).map(f => path.basename(f, '.ts'));
const claves = Object.keys(KEYS.es || {});
if (!claves.length) { console.error('KEYS.es vacio'); process.exit(1); }

// Todo se valida antes de escribir el primer fichero.
const q = v => (v.includes("'") ? JSON.stringify(v) : `'${v}'`);
const cambios = [];
let saltados = 0;
for (const code of locales) {
  const k = KEYS[code];
  if (!k) { console.error(`Sin traducciones para ${code}`); process.exit(1); }
  const faltan = claves.filter(c => typeof k[c] !== 'string' || !k[c]);
  const sobran = Object.keys(k).filter(c => !claves.includes(c));
  if (faltan.length || sobran.length) { console.error(`${code}: faltan [${faltan}] sobran [${sobran}]`); process.exit(1); }

  const p = path.join(DIR, `${code}.ts`);
  const s = fs.readFileSync(p, 'utf8');
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const ini = s.search(new RegExp(`^  ${bloque}: \\{`, 'm'));
  if (ini < 0) { console.error(`${code}: no encuentro el bloque «${bloque}»`); process.exit(1); }
  const fin = s.indexOf(`${eol}  },`, ini);
  const trozo = s.slice(ini, fin + eol.length);
  if (new RegExp(`${eol}\\s+${claves[0]}: `).test(trozo)) { saltados++; continue; }
  const re = new RegExp(`${eol}(\\s+)${ancla}: [^\\r\\n]*${eol}`, 'g');
  const m = [...trozo.matchAll(re)];
  if (m.length !== 1) { console.error(`${code}: ancla «${bloque}.${ancla}» encontrada ${m.length} veces`); process.exit(1); }
  const pos = ini + m[0].index + m[0][0].length;
  const ind = m[0][1];
  const texto = claves.map(c => `${ind}${c}: ${q(k[c])},${eol}`).join('');
  cambios.push([p, s.slice(0, pos) + texto + s.slice(pos)]);
}

if (!dry) for (const [p, s] of cambios) fs.writeFileSync(p, s);
console.log(`${dry ? '[dry-run] ' : ''}${bloque}: ${claves.length} claves en ${cambios.length} locales · ya estaban en ${saltados}`);
