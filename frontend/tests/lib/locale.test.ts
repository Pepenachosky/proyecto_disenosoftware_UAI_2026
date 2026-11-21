import { assertEquals } from "jsr:@std/assert@1";
import { detectLang, initialLang, intlLocale, onLogin, parseLang } from "../../src/lib/locale.ts";

Deno.test("parseLang acepta solo es y en exactos", () => {
  assertEquals(parseLang("es"), "es");
  assertEquals(parseLang("en"), "en");
  for (const v of ["EN", "fr", "", null, 3]) assertEquals(parseLang(v), null);
});

Deno.test("detectLang usa en si el navegador empieza con en", () => {
  assertEquals(detectLang("en-US"), "en");
  assertEquals(detectLang("EN-gb"), "en");
  assertEquals(detectLang("es-CL"), "es");
  assertEquals(detectLang("fr"), "es");
  assertEquals(detectLang(undefined), "es");
});

Deno.test("initialLang prioriza lo guardado", () => {
  assertEquals(initialLang("en", "es-CL"), "en");
  assertEquals(initialLang("fr", "en-US"), "en");
  assertEquals(initialLang(null, "es-CL"), "es");
});

Deno.test("intlLocale", () => {
  assertEquals(intlLocale("es"), "es-CL");
  assertEquals(intlLocale("en"), "en-US");
});

Deno.test("onLogin prioriza el idioma del perfil", () => {
  assertEquals(onLogin("en", "es"), { lang: "en", saveToProfile: false });
  assertEquals(onLogin(null, "en"), { lang: "en", saveToProfile: true });
  assertEquals(onLogin("fr", "es"), { lang: "es", saveToProfile: true });
});
