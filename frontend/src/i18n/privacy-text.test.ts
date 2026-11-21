import { assert } from "jsr:@std/assert@1";
import { es } from "./es.ts";
import { en } from "./en.ts";

// La política debe nombrar todo lo que de verdad se guarda (anti-objetivo del spec).
Deno.test("la política menciona la foto de perfil de Google", () => {
  assert(es.privacy.data.account.includes("foto"));
  assert(en.privacy.data.account.includes("photo"));
});

Deno.test("la política dice que Supabase registra IP y navegador de cada sesión", () => {
  assert(es.privacy.third.supabase.includes("IP"));
  assert(en.privacy.third.supabase.includes("IP"));
});

Deno.test("la política dice que las reseñas muestran la fecha", () => {
  assert(es.privacy.data.reviews.includes("fecha"));
  assert(en.privacy.data.reviews.includes("date"));
});

Deno.test("la recarga al rechazar se explica por haber aceptado antes", () => {
  assert(es.privacy.choice.hint.includes("habías aceptado"));
  assert(en.privacy.choice.hint.includes("previously accepted"));
});
