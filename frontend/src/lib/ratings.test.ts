import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import {
  aggregateRatings,
  averageRating,
  compareByRating,
  formatRating,
  globalMean,
  PRIOR_WEIGHT,
  type Rated,
  weightedScore,
} from "./ratings.ts";

Deno.test("PRIOR_WEIGHT es 5", () => {
  assertEquals(PRIOR_WEIGHT, 5);
});

Deno.test("aggregateRatings suma cantidad y estrellas por grupo", () => {
  const m = aggregateRatings([
    { group_id: 1, rating: 5 },
    { group_id: 2, rating: 3 },
    { group_id: 1, rating: 4 },
  ]);
  assertEquals(m.get(1), { count: 2, sum: 9 });
  assertEquals(m.get(2), { count: 1, sum: 3 });
  assertEquals(m.get(3), undefined);
});

Deno.test("globalMean es 0 sin reseñas y la media total con ellas", () => {
  assertEquals(globalMean([]), 0);
  assertEquals(globalMean([{ count: 1, sum: 5 }, { count: 3, sum: 7 }]), 3);
});

Deno.test("averageRating es la media real", () => {
  assertEquals(averageRating({ count: 40, sum: 192 }), 4.8);
});

Deno.test("weightedScore con los ejemplos del diseño (m = 4)", () => {
  assertAlmostEquals(weightedScore({ count: 1, sum: 5 }, 4), 25 / 6);
  assertAlmostEquals(weightedScore({ count: 40, sum: 192 }, 4), 212 / 45);
  assertAlmostEquals(weightedScore({ count: 30, sum: 63 }, 4), 83 / 35);
});

const sortNames = (items: Rated[], mean: number) =>
  [...items].sort((a, b) => compareByRating(a, b, mean, "es-CL")).map((i) => i.name);

Deno.test("muchas reseñas buenas ganan a una sola de 5; sin reseñas al final", () => {
  assertEquals(
    sortNames([
      { name: "A", stats: { count: 1, sum: 5 } },
      { name: "Sin", stats: undefined },
      { name: "C", stats: { count: 30, sum: 63 } },
      { name: "B", stats: { count: 40, sum: 192 } },
    ], 4),
    ["B", "A", "C", "Sin"],
  );
});

Deno.test("empate de puntuación: más reseñas primero, luego nombre", () => {
  assertEquals(
    sortNames([
      { name: "Uno", stats: { count: 1, sum: 4 } },
      { name: "Zeta", stats: { count: 2, sum: 8 } },
      { name: "Alfa", stats: { count: 2, sum: 8 } },
    ], 4),
    ["Alfa", "Zeta", "Uno"],
  );
});

Deno.test("sin reseñas ordena por nombre", () => {
  assertEquals(sortNames([{ name: "b" }, { name: "a" }, { name: "c" }], 0), ["a", "b", "c"]);
});

Deno.test("una fila con count 0 cuenta como sin reseñas", () => {
  assertEquals(
    sortNames([{ name: "a", stats: { count: 0, sum: 0 } }, { name: "b", stats: { count: 1, sum: 1 } }], 3),
    ["b", "a"],
  );
});

Deno.test("formatRating usa un decimal y el formato del idioma", () => {
  assertEquals(formatRating(4.75, "es-CL"), "4,8");
  assertEquals(formatRating(4.75, "en-US"), "4.8");
  assertEquals(formatRating(5, "es-CL"), "5,0");
});
