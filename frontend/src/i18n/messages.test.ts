import { assert, assertEquals } from "jsr:@std/assert@1";
import { es } from "./es.ts";
import { en } from "./en.ts";

// Aplana { a: { b: "x" } } a { "a.b": "x" }.
function flatten(obj: object, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else Object.assign(out, flatten(v as object, key));
  }
  return out;
}

const placeholders = (s: string) =>
  [...s.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)].map((m) => m[1]).sort();

const fes = flatten(es);
const fen = flatten(en);

Deno.test("es y en tienen las mismas claves", () => {
  assertEquals(Object.keys(fes).sort(), Object.keys(fen).sort());
});

Deno.test("ningún texto está vacío", () => {
  for (const [k, v] of [...Object.entries(fes), ...Object.entries(fen)]) {
    assert(v.trim() !== "", `texto vacío en ${k}`);
  }
});

Deno.test("los placeholders coinciden en ambos idiomas", () => {
  for (const k of Object.keys(fes)) {
    assertEquals(placeholders(fes[k]), placeholders(fen[k]), `placeholders en ${k}`);
  }
});
