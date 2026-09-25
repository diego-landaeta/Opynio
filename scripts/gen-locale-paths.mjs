/**
 * Genera contexts/localePaths.generated.ts con el bloque `paths` de cada locale.
 *
 * Por que existe: los textos de cada idioma se cargan bajo demanda (import()
 * en contexts/i18nContext.tsx), pero las RUTAS de todos los idiomas se
 * necesitan de forma sincrona desde el primer render (App.tsx registra las
 * rutas de los 31 idiomas, Header/Footer/Meta/isDashboardRoute las recorren).
 * Importar los 31 locales solo por sus `paths` arrastraria ~1 MB gzip de textos
 * a cada visita, asi que se copian aqui.
 *
 *   node scripts/gen-locale-paths.mjs           regenera el fichero
 *   node scripts/gen-locale-paths.mjs --check   falla si esta desincronizado
 *
 * El build (plugin check-locale-paths de vite.config.ts) y `npm run verify`
 * ejecutan la comprobacion: un locale con rutas cambiadas y sin regenerar no
 * llega a produccion.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SALIDA = resolve(RAIZ, 'contexts/localePaths.generated.ts');
const I18N = resolve(RAIZ, 'contexts/i18nContext.tsx');

// Los idiomas se leen del tipo `Language` de i18nContext (fuente de verdad del
// cableado), en su orden. `es` va primero: detectLanguageFromPath devuelve el
// primer idioma que casa y los segmentos compartidos deben resolverse a es.
export const leerIdiomas = () => {
  const fuente = readFileSync(I18N, 'utf8');
  const m = fuente.match(/export type Language\s*=\s*([^;]+);/);
  if (!m) throw new Error('No encuentro `export type Language` en contexts/i18nContext.tsx');
  return [...m[1].matchAll(/"([a-z]+)"/g)].map((x) => x[1]);
};

// Se empaqueta cada locale con esbuild (ya viene con vite) y se evalua en
// memoria: asi funciona tambien un locale que importa otro (opcion B de
// add-language.md: `export default { ...en, paths: {...} }`).
const cargarLocale = async (idioma) => {
  const { build } = await import('esbuild');
  const entrada = resolve(RAIZ, `locales/${idioma}.ts`);
  if (!existsSync(entrada)) throw new Error(`Falta locales/${idioma}.ts (esta en el tipo Language)`);
  const { outputFiles } = await build({
    entryPoints: [entrada], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent',
  });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
  const paths = mod.default?.paths;
  if (!paths || typeof paths !== 'object') throw new Error(`locales/${idioma}.ts no tiene bloque paths`);
  return paths;
};

export const generar = async () => {
  const idiomas = leerIdiomas();
  const bloques = [];
  for (const idioma of idiomas) {
    const paths = await cargarLocale(idioma);
    const lineas = Object.entries(paths).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
    bloques.push(`  ${idioma}: {\n${lineas.join('\n')}\n  },`);
  }
  return [
    '// GENERADO por scripts/gen-locale-paths.mjs a partir de locales/*.ts (bloque `paths`).',
    '// NO EDITAR A MANO: cambia el locale y ejecuta `node scripts/gen-locale-paths.mjs`.',
    '// El build falla si este fichero no coincide con los locales.',
    '/* eslint-disable */',
    'export const localePaths = {',
    ...bloques,
    '};',
    '',
  ].join('\n');
};

export const comprobar = async () => {
  const esperado = await generar();
  const actual = existsSync(SALIDA) ? readFileSync(SALIDA, 'utf8').replace(/\r\n/g, '\n') : '';
  return actual === esperado;
};

const esPrincipal = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (esPrincipal) {
  if (process.argv.includes('--check')) {
    if (!(await comprobar())) {
      console.error('contexts/localePaths.generated.ts no coincide con locales/*.ts. Ejecuta: node scripts/gen-locale-paths.mjs');
      process.exit(1);
    }
    console.log('Rutas de locales sincronizadas.');
  } else {
    writeFileSync(SALIDA, await generar(), 'utf8');
    console.log(`Escrito ${SALIDA.replace(RAIZ, '').replace(/\\/g, '/')}`);
  }
}
