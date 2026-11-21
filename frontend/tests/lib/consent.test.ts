import { assertEquals } from "jsr:@std/assert@1";
import { keysToClear, parseConsent, resolveDecision, serializeConsent, startLang, withTimeout } from "../../src/lib/consent.ts";

Deno.test("serializeConsent y parseConsent hacen ida y vuelta", () => {
  const raw = serializeConsent("aceptado", new Date("2026-11-21T12:00:00Z"));
  assertEquals(JSON.parse(raw), { version: 1, decision: "aceptado", fecha: "2026-11-21T12:00:00.000Z" });
  assertEquals(parseConsent(raw), "aceptado");
  assertEquals(parseConsent(serializeConsent("rechazado", new Date())), "rechazado");
});

Deno.test("parseConsent trata lo ilegible o de otra versión como sin decidir", () => {
  for (const raw of [
    null,
    "",
    "si",
    "{}",
    '{"version":1',
    "null",
    "[]",
    JSON.stringify({ version: 0, decision: "aceptado" }),
    JSON.stringify({ version: "1", decision: "aceptado" }),
    JSON.stringify({ version: 1, decision: "ACEPTADO" }),
  ]) {
    assertEquals(parseConsent(raw), null, String(raw));
  }
});

Deno.test("startLang según la decisión", () => {
  assertEquals(startLang("aceptado", "en", "es-CL"), "en");
  assertEquals(startLang("aceptado", null, "en-US"), "en");
  assertEquals(startLang("rechazado", "en", "en-US"), "es");
  assertEquals(startLang(null, "en", "es-CL"), "es"); // lo guardado se ignora sin decidir
  assertEquals(startLang(null, null, "en-GB"), "en");
});

Deno.test("keysToClear elige idioma y sb-*, nada más", () => {
  assertEquals(
    keysToClear(["idioma", "sb-abc-auth-token", "consentimiento", "otra", "sbx", "sb-"]).sort(),
    ["idioma", "sb-", "sb-abc-auth-token"],
  );
  assertEquals(keysToClear([]), []);
});

Deno.test("resolveDecision: manda lo guardado; la memoria solo si no hay nada guardado", () => {
  assertEquals(resolveDecision("rechazado", "aceptado"), "rechazado"); // otra pestaña rechazó
  assertEquals(resolveDecision("aceptado", "rechazado"), "aceptado");
  assertEquals(resolveDecision(null, "aceptado"), "aceptado"); // localStorage no guardó (modo privado)
  assertEquals(resolveDecision(null, null), null);
});

Deno.test("withTimeout no espera más del límite", async () => {
  const lenta = new Promise<string>((r) => setTimeout(() => r("tarde"), 200));
  assertEquals(await withTimeout(lenta, 20), "timeout");
  assertEquals(await withTimeout(Promise.resolve("ok"), 20), "ok");
  await lenta; // no dejar temporizadores vivos
});

Deno.test("withTimeout convierte un rechazo en 'error'", async () => {
  assertEquals(await withTimeout(Promise.reject(new Error("red")), 20), "error");
});
