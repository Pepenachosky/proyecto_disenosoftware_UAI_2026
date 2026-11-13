import { assertEquals } from "jsr:@std/assert@1";
import { type OverpassResponse, parseRegion, toModule } from "./comunas.ts";

// Respuesta mínima de Overpass: la región con sus bounds, tres comunas y los nodos de sus miembros.
const fixture: OverpassResponse = {
  elements: [
    { type: "relation", id: 1, tags: { "ISO3166-2": "CL-XX", admin_level: "4" }, bounds: { minlat: -34, minlon: -72, maxlat: -33, maxlon: -70 } },
    // con admin_centre: debe ganar al center de la relación
    {
      type: "relation", id: 10, tags: { name: "Nogales", admin_level: "8" }, center: { lat: -33.5, lon: -71.5 },
      members: [{ type: "node", ref: 100, role: "admin_centre" }, { type: "node", ref: 101, role: "label" }],
    },
    // sin admin_centre, con label
    {
      type: "relation", id: 11, tags: { name: "Ñuñoa", admin_level: "8" }, center: { lat: -33.6, lon: -71.6 },
      members: [{ type: "node", ref: 102, role: "label" }],
    },
    // sin nodos: usa el center; además cae fuera de los bounds de la región
    { type: "relation", id: 12, tags: { name: "Álamo", admin_level: "8" }, center: { lat: -10, lon: -71.7 }, members: [] },
    { type: "node", id: 100, lat: -33.123456, lon: -71.123456 },
    { type: "node", id: 101, lat: -33.9, lon: -71.9 },
    { type: "node", id: 102, lat: -33.7, lon: -71.2 },
  ],
};

Deno.test("parseRegion usa el nodo admin_centre", () => {
  const { region } = parseRegion(fixture, "Región X");
  const c = region.comunas.find((c) => c.name === "Nogales")!;
  assertEquals(c, { name: "Nogales", lat: -33.12346, lng: -71.12346 });
});

Deno.test("parseRegion usa label si no hay admin_centre, y center si no hay ninguno", () => {
  const { region } = parseRegion(fixture, "Región X");
  assertEquals(region.comunas.find((c) => c.name === "Ñuñoa"), { name: "Ñuñoa", lat: -33.7, lng: -71.2 });
  assertEquals(region.comunas.find((c) => c.name === "Álamo"), { name: "Álamo", lat: -10, lng: -71.7 });
});

Deno.test("parseRegion marca como dudosa una comuna fuera de los bounds y la mantiene", () => {
  const { region, dudosas } = parseRegion(fixture, "Región X");
  assertEquals(dudosas, ["Álamo"]);
  assertEquals(region.comunas.length, 3);
});

Deno.test("parseRegion ordena alfabéticamente con tildes", () => {
  const { region } = parseRegion(fixture, "Región X");
  assertEquals(region.comunas.map((c) => c.name), ["Álamo", "Nogales", "Ñuñoa"]);
  assertEquals(region.name, "Región X");
});

Deno.test("toModule produce TypeScript válido con los mismos datos", () => {
  const regiones = [{ name: "Región X", comunas: [{ name: "Ñuñoa", lat: -33.7, lng: -71.2 }] }];
  const src = toModule(regiones, "2026-11-13");
  assertEquals(src.includes("export const REGIONES"), true);
  assertEquals(src.includes("2026-11-13"), true);
  const m = src.match(/JSON\.parse\(`([\s\S]*?)`\)/);
  assertEquals(JSON.parse(m![1]), regiones);
});
