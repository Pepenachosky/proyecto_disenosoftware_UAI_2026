import { assertEquals } from "jsr:@std/assert@1";
import type { RegionLike } from "./user-location.ts";
import { findComuna, parseSaved, readSaved, requestPosition, writeSaved } from "./user-location.ts";

const regiones: RegionLike[] = [
  { name: "Metropolitana", comunas: [{ name: "Santiago", lat: -33.45, lng: -70.66 }] },
  { name: "Valparaíso", comunas: [{ name: "Viña del Mar", lat: -33.02, lng: -71.55 }] },
];

Deno.test("parseSaved: casos válidos e inválidos", () => {
  assertEquals(parseSaved(null, regiones), null);
  assertEquals(parseSaved("{", regiones), null);
  assertEquals(parseSaved('{"modo":"gps"}', regiones), { modo: "gps" });
  const ok = { modo: "comuna" as const, region: "Metropolitana", comuna: "Santiago" };
  assertEquals(parseSaved(JSON.stringify(ok), regiones), ok);
  const mala = { modo: "comuna", region: "Metropolitana", comuna: "Viña del Mar" };
  assertEquals(parseSaved(JSON.stringify(mala), regiones), null);
  assertEquals(parseSaved('{"modo":"otro"}', regiones), null);
});

Deno.test("readSaved con storage que lanza o nulo", () => {
  const roto = { getItem: () => { throw new Error("x"); } };
  assertEquals(readSaved(roto, regiones), null);
  assertEquals(readSaved(null, regiones), null);
});

Deno.test("writeSaved con storage que lanza no lanza", () => {
  writeSaved({ setItem: () => { throw new Error("x"); } }, { modo: "gps" });
  writeSaved(null, { modo: "gps" });
});

Deno.test("findComuna", () => {
  assertEquals(findComuna(regiones, "Valparaíso", "Viña del Mar"), { lat: -33.02, lng: -71.55 });
  assertEquals(findComuna(regiones, "Valparaíso", "Santiago"), null);
});

Deno.test("requestPosition sin geolocation", async () => {
  assertEquals(await requestPosition(undefined, 20), null);
});

Deno.test("requestPosition con error", async () => {
  const geo = { getCurrentPosition: (_ok: unknown, err: (e: unknown) => void) => err({}) };
  assertEquals(await requestPosition(geo, 20), null);
});

Deno.test("requestPosition con timeout", async () => {
  const geo = { getCurrentPosition: () => {} };
  assertEquals(await requestPosition(geo, 20), null);
});

Deno.test("requestPosition con éxito", async () => {
  const geo = {
    getCurrentPosition: (ok: (p: { coords: { latitude: number; longitude: number } }) => void) =>
      ok({ coords: { latitude: -33.4, longitude: -70.6 } }),
  };
  assertEquals(await requestPosition(geo, 1000), { lat: -33.4, lng: -70.6 });
});

Deno.test("requestPosition: éxito después del timeout", async () => {
  let exito: ((p: { coords: { latitude: number; longitude: number } }) => void) | undefined;
  const geo = { getCurrentPosition: (ok: typeof exito) => { exito = ok; } };
  const tardios: unknown[] = [];
  assertEquals(await requestPosition(geo, 10, (p) => tardios.push(p)), null);
  assertEquals(tardios, []);
  exito!({ coords: { latitude: -33.4, longitude: -70.6 } });
  assertEquals(tardios, [{ lat: -33.4, lng: -70.6 }]);
});
