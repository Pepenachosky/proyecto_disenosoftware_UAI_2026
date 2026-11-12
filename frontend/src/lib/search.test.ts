import { assertEquals } from "jsr:@std/assert@1";
import { matchesQuery, normalize } from "./search.ts";

Deno.test("normalize", () => {
  assertEquals(normalize("Núcleos"), "nucleos");
});

Deno.test("matchesQuery ignora tildes", () => {
  const t = "Procesador AMD Ryzen 5 (6 Núcleos)";
  assertEquals(matchesQuery(t, "nucleos ryzen"), true);
  assertEquals(matchesQuery(t, "ryzen 9"), false);
  assertEquals(matchesQuery(t, "  "), true);
});
