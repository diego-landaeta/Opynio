// Pruebas de _shared/invitacionExterna.ts. Sin Deno ni marco: se ejecutan con
//
//   node --test supabase/functions/_shared/invitacionExterna.test.ts
//
// La base se sustituye por una falsa que apunta qué le piden (Certifex#97).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clavesIguales, DIAS_REUTILIZAR, LIMITE_DIARIO, manejar, slugDeOpynioUrl, validarEntrada, type Db } from "./invitacionExterna.ts";

const CLAVE = "una-clave-larga-de-al-menos-24-caracteres";
const FICHA = "https://web.opynio.com/es/empresa/iseie_innovation_school";

function dbFalsa(over: Partial<Db> = {}) {
  const llamadas = { empresa: 0, vigente: 0, externas: 0, crear: [] as Array<[string, string]> };
  const db: Db = {
    async empresaPorSlug(slug) { llamadas.empresa++; return slug === "iseie_innovation_school" ? { id: "emp-1" } : null; },
    async invitacionVigente() { llamadas.vigente++; return null; },
    async externasDesde() { llamadas.externas++; return 0; },
    async crearInvitacion(b, e) { llamadas.crear.push([b, e]); return { id: "inv-1" }; },
    ...over,
  };
  return { db, llamadas };
}

const pedir = (cuerpo: unknown, cabeceras: Record<string, string> = { "x-registro-clave": CLAVE }, metodo = "POST") =>
  new Request("https://x.test/registrar-invitacion-externa", {
    method: metodo,
    headers: cabeceras,
    body: metodo === "GET" ? undefined : typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  });

describe("slugDeOpynioUrl", () => {
  it("saca el slug de la ficha, en cualquier idioma de la ruta", () => {
    assert.equal(slugDeOpynioUrl(FICHA), "iseie_innovation_school");
    assert.equal(slugDeOpynioUrl("https://web.opynio.com/it/azienda/jobsaicopilot"), "jobsaicopilot");
    assert.equal(slugDeOpynioUrl("https://web.opynio.com/es/empresa/chila/"), "chila");
  });
  it("rechaza lo que no es una ficha de Opynio", () => {
    for (const u of [
      "http://web.opynio.com/es/empresa/x",              // sin https
      "https://evil.com/es/empresa/x",                   // otro dominio
      "https://web.opynio.com.evil.com/es/empresa/x",    // dominio que solo empieza igual
      "https://web.opynio.com/es",                       // sin ficha
      "https://web.opynio.com/es/empresa/a%2Fb",         // barra codificada en el slug
      "https://web.opynio.com/es/empresa/" + "a".repeat(200),
      "https://web.opynio.com:8443/es/empresa/x",        // con puerto
      "https://evil@web.opynio.com/es/empresa/x",        // con usuario
      "https://usuario:clave@web.opynio.com/es/empresa/x",
      "no es una url", "",
    ]) assert.equal(slugDeOpynioUrl(u), null, u);
  });
});

describe("clavesIguales", () => {
  it("compara por contenido", () => {
    assert.equal(clavesIguales(CLAVE, CLAVE), true);
    assert.equal(clavesIguales(CLAVE, CLAVE + "x"), false);
    assert.equal(clavesIguales("", CLAVE), false);
  });
});

describe("validarEntrada", () => {
  it("normaliza el correo a minúsculas y sin espacios", () => {
    const r = validarEntrada({ opynioUrl: FICHA, email: "  Ana.Lopez@Correo.COM " });
    assert.deepEqual(r, { ok: true, slug: "iseie_innovation_school", email: "ana.lopez@correo.com" });
  });
  it("rechaza correo roto, ficha ajena y cuerpos que no son objeto", () => {
    assert.equal(validarEntrada({ opynioUrl: FICHA, email: "no-es-correo" }).ok, false);
    assert.equal(validarEntrada({ opynioUrl: "https://evil.com/es/empresa/x", email: "a@b.co" }).ok, false);
    assert.equal(validarEntrada({ opynioUrl: FICHA }).ok, false);
    assert.equal(validarEntrada(null).ok, false);
    assert.equal(validarEntrada("texto").ok, false);
  });
  it("rechaza correos con caracteres de control o con varios destinatarios", () => {
    for (const email of ["a@b.co\u0000", "a@b.co\u0001", "a\u007f@b.co", "a@b.co,x@y.co", "a@b.co;x@y.co", "a b@c.co"]) {
      assert.equal(validarEntrada({ opynioUrl: FICHA, email }).ok, false, JSON.stringify(email));
    }
  });
});

describe("manejar · acceso", () => {
  it("sin clave, con clave mala o sin clave configurada: 401, y no toca la base", async () => {
    const { db, llamadas } = dbFalsa();
    const buena = { opynioUrl: FICHA, email: "a@b.co" };
    assert.equal((await manejar(pedir(buena, {}), { claveEsperada: CLAVE, db })).status, 401);
    assert.equal((await manejar(pedir(buena, { "x-registro-clave": "otra" }), { claveEsperada: CLAVE, db })).status, 401);
    // Sin configurar contesta igual que con clave mala: no revela si la función está lista.
    assert.equal((await manejar(pedir(buena), { claveEsperada: undefined, db })).status, 401);
    assert.equal((await manejar(pedir(buena), { claveEsperada: "corta", db })).status, 401);
    assert.equal(llamadas.empresa + llamadas.vigente + llamadas.externas + llamadas.crear.length, 0);
  });
  it("solo acepta POST", async () => {
    const { db } = dbFalsa();
    assert.equal((await manejar(pedir("", { "x-registro-clave": CLAVE }, "GET"), { claveEsperada: CLAVE, db })).status, 405);
  });
});

describe("manejar · entrada", () => {
  it("400 con JSON roto o datos inválidos, 413 con un cuerpo enorme", async () => {
    const { db, llamadas } = dbFalsa();
    const deps = { claveEsperada: CLAVE, db };
    assert.equal((await manejar(pedir("{no es json"), deps)).status, 400);
    assert.equal((await manejar(pedir({ opynioUrl: FICHA, email: "mal" }), deps)).status, 400);
    assert.equal((await manejar(pedir({ opynioUrl: "https://evil.com/es/empresa/x", email: "a@b.co" }), deps)).status, 400);
    assert.equal((await manejar(pedir({ opynioUrl: FICHA, email: "a@b.co", relleno: "x".repeat(3000) }), deps)).status, 413);
    assert.equal(llamadas.crear.length, 0);
  });
  it("404 si la ficha no existe en Opynio", async () => {
    const { db, llamadas } = dbFalsa();
    const r = await manejar(pedir({ opynioUrl: "https://web.opynio.com/es/empresa/no_existe", email: "a@b.co" }), { claveEsperada: CLAVE, db });
    assert.equal(r.status, 404);
    assert.equal(llamadas.crear.length, 0);
  });
});

describe("manejar · registro", () => {
  it("crea la invitación con el correo normalizado y devuelve id y empresa", async () => {
    const { db, llamadas } = dbFalsa();
    const r = await manejar(pedir({ opynioUrl: FICHA, email: "Ana@Correo.com" }), { claveEsperada: CLAVE, db });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { id: "inv-1", businessId: "emp-1", reutilizada: false });
    assert.deepEqual(llamadas.crear, [["emp-1", "ana@correo.com"]]);
  });
  it("si ya hay una vigente de ese correo, la reutiliza y NO crea otra (un aviso reenviado no duplica)", async () => {
    let desdePedido: Date | undefined;
    const { db, llamadas } = dbFalsa({ async invitacionVigente(_b, _e, desde) { desdePedido = desde; return { id: "inv-previa" }; } });
    const ahora = Date.UTC(2026, 9, 27);
    const r = await manejar(pedir({ opynioUrl: FICHA, email: "a@b.co" }), { claveEsperada: CLAVE, db, ahora: () => ahora });
    assert.deepEqual(await r.json(), { id: "inv-previa", businessId: "emp-1", reutilizada: true });
    assert.equal(llamadas.crear.length, 0);
    assert.equal(desdePedido!.getTime(), ahora - DIAS_REUTILIZAR * 86_400_000);
  });
  it("429 al llegar al tope diario de la empresa, sin crear nada", async () => {
    const { db, llamadas } = dbFalsa({ async externasDesde() { return LIMITE_DIARIO; } });
    const r = await manejar(pedir({ opynioUrl: FICHA, email: "a@b.co" }), { claveEsperada: CLAVE, db });
    assert.equal(r.status, 429);
    assert.equal(llamadas.crear.length, 0);
  });
  it("un fallo de la base da 500 sin detalles ni el correo del alumno", async () => {
    const { db } = dbFalsa({ async crearInvitacion() { throw Object.assign(new Error("duplicate key value violates ... ana@correo.com"), { code: "23505" }); } });
    const r = await manejar(pedir({ opynioUrl: FICHA, email: "ana@correo.com" }), { claveEsperada: CLAVE, db });
    assert.equal(r.status, 500);
    const cuerpo = JSON.stringify(await r.json());
    assert.ok(!cuerpo.includes("ana@correo.com") && !cuerpo.includes("duplicate"), cuerpo);
  });
});
