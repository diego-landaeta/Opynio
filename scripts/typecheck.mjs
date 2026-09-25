#!/usr/bin/env node
/**
 * Comprobacion de tipos con linea base.
 *
 * El proyecto arrastra errores de tipos antiguos y no tiene tsconfig.json (Vite
 * transpila sin comprobar). Exigir cero errores haria que este comando fallara
 * siempre y nadie lo ejecutaria. En vez de eso se congela la deuda: se compara
 * contra una linea base y solo se falla si aparecen errores NUEVOS.
 *
 *   npm run typecheck                 comprueba
 *   npm run typecheck -- --actualizar regenera la linea base (al arreglar deuda)
 *
 * La linea base no guarda numeros de linea, solo «fichero + codigo de error»:
 * asi no se invalida al mover codigo de sitio.
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = resolve(RAIZ, 'scripts/typecheck-baseline.txt');
const CONFIG = 'tsconfig.check.json';
const actualizar = process.argv.includes('--actualizar');

const ejecutarTsc = () => {
  try {
    // execSync con cadena: execFileSync con shell:true avisa de obsolescencia
    // en Node 22 porque no escapa los argumentos.
    execSync(`npx tsc -p ${CONFIG}`, { cwd: RAIZ, encoding: 'utf8' });
    return '';
  } catch (e) {
    // tsc sale con codigo != 0 cuando hay errores; su salida es lo que queremos.
    return `${e.stdout || ''}${e.stderr || ''}`;
  }
};

const normalizar = (salida) =>
  salida
    .split('\n')
    .map((l) => l.replace(/\r$/, ''))
    .filter((l) => /^[^\s].*\(\d+,\d+\): error TS\d+/.test(l))
    .map((l) => l.replace(/^(.+?)\(\d+,\d+\): error (TS\d+).*$/, '$1 $2'))
    .map((l) => l.replace(/\\/g, '/'))
    .sort();

const contar = (lista) => {
  const m = new Map();
  for (const l of lista) m.set(l, (m.get(l) || 0) + 1);
  return m;
};

const actuales = normalizar(ejecutarTsc());

if (actualizar || !existsSync(BASE)) {
  writeFileSync(BASE, actuales.join('\n') + '\n', 'utf8');
  console.log(`Línea base ${existsSync(BASE) ? 'actualizada' : 'creada'}: ${actuales.length} errores conocidos.`);
  process.exit(0);
}

const base = contar(readFileSync(BASE, 'utf8').split('\n').filter(Boolean));
const ahora = contar(actuales);

const nuevos = [];
for (const [clave, n] of ahora) {
  const conocidos = base.get(clave) || 0;
  if (n > conocidos) nuevos.push(`${clave}  (${n - conocidos} más que en la línea base)`);
}

const arreglados = [];
for (const [clave, n] of base) {
  const quedan = ahora.get(clave) || 0;
  if (quedan < n) arreglados.push(`${clave}  (${n - quedan} menos)`);
}

console.log(`Errores de tipos: ${actuales.length} (línea base: ${[...base.values()].reduce((a, b) => a + b, 0)})`);

if (arreglados.length) {
  console.log('\nDeuda arreglada — puedes fijarla con «npm run typecheck -- --actualizar»:');
  for (const l of arreglados) console.log('  ' + l);
}

if (nuevos.length) {
  console.error('\nERRORES DE TIPOS NUEVOS:');
  for (const l of nuevos) console.error('  ' + l);
  console.error('\nArréglalos, o justifica añadirlos a la línea base.');
  process.exit(1);
}

console.log('\nSin errores de tipos nuevos.');
