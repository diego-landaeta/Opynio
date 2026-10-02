#!/usr/bin/env node
/**
 * Guardián de la versión del widget.
 *
 * La versión vive en cuatro sitios y TIENEN que decir lo mismo:
 *
 *   1. La cabecera de `public/widget.js`             (lo que se sirve al cliente)
 *   2. La constante WIDGET_VERSION del mismo fichero (lo que el widget cree ser)
 *   3. EMBED_VERSION en `widgetShared.ts`            (lo que sale en el snippet)
 *   4. WIDGET_VERSION en `widget-proxy`              (lo que el servidor dice que toca)
 *
 * Si se desincronizan pasan cosas silenciosas: el generador entrega snippets con
 * un `?v=` que nadie más usa y se pierde el efecto de la caché compartida, o el
 * proxy anuncia una versión que no existe y los widgets se recargan para nada.
 *
 * Además comprueba lo que de verdad se olvida: **tocar widget.js sin subir la
 * versión**. Si el fichero cambió respecto a HEAD y la versión es la misma, falla.
 *
 *   npm run check:widget
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r) => readFileSync(resolve(RAIZ, r), 'utf8');

const WIDGET = 'public/widget.js';
const SHARED = 'components/pages/business/dashboard/widgets/widgetShared.ts';
const PROXY = 'supabase/functions/widget-proxy/index.ts';

const sacar = (texto, patron, donde) => {
  const m = texto.match(patron);
  if (!m) {
    console.error(`No se encontró la versión en ${donde}. ¿Cambió el formato?`);
    process.exit(1);
  }
  return m[1];
};

const widget = leer(WIDGET);
const versiones = {
  [`${WIDGET} (cabecera)`]: sacar(widget, /Opynio Widget Loader (v[\d.]+)/, WIDGET),
  [`${WIDGET} (WIDGET_VERSION)`]: sacar(widget, /var WIDGET_VERSION = '(v[\d.]+)'/, WIDGET),
  'widgetShared.ts (EMBED_VERSION)': sacar(leer(SHARED), /EMBED_VERSION = '(v[\d.]+)'/, SHARED),
  'widget-proxy (WIDGET_VERSION)': sacar(leer(PROXY), /WIDGET_VERSION = '(v[\d.]+)'/, PROXY),
};

const distintas = new Set(Object.values(versiones));
let fallo = false;

if (distintas.size > 1) {
  console.error('Las versiones del widget NO coinciden:\n');
  for (const [donde, v] of Object.entries(versiones)) console.error(`  ${v}   ${donde}`);
  console.error('\nPon la misma en los cuatro sitios.');
  fallo = true;
} else {
  console.log(`Versión del widget: ${[...distintas][0]} — coincide en los cuatro sitios.`);
}

// ¿Se tocó widget.js sin subir la versión?
try {
  const cambiado = execSync(`git diff --name-only HEAD -- ${WIDGET}`, { cwd: RAIZ, encoding: 'utf8' }).trim();
  if (cambiado) {
    const anterior = execSync(`git show HEAD:${WIDGET}`, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    const versionAnterior = (anterior.match(/Opynio Widget Loader (v[\d.]+)/) || [])[1];
    const versionActual = versiones[`${WIDGET} (cabecera)`];
    if (versionAnterior && versionAnterior === versionActual) {
      console.error(`\nwidget.js cambió pero sigue en ${versionActual}.`);
      console.error('Súbele la versión: los clientes comparten fichero y la versión es lo único');
      console.error('que distingue una entrega de otra. Ver docs/playbooks/bump-widget-version.md');
      fallo = true;
    } else if (versionAnterior) {
      console.log(`widget.js cambió y la versión subió: ${versionAnterior} → ${versionActual}.`);
    }
  }
} catch {
  // Sin git (o sin HEAD todavía): la comprobación de coincidencia ya se hizo.
}

process.exit(fallo ? 1 : 0);
