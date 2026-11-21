import { assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import { distanceKm, formatKm } from "../../src/lib/geo.ts";

Deno.test("distanceKm entre Plaza de Armas y Plaza Ñuñoa ≈ 5,4 km", () => {
  const d = distanceKm(
    { lat: -33.4378, lng: -70.6505 },
    { lat: -33.4569, lng: -70.5974 },
  );
  assertAlmostEquals(d, 5.37, 0.1);
});

Deno.test("distanceKm de un punto a sí mismo es 0", () => {
  const p = { lat: -33.4378, lng: -70.6505 };
  assertEquals(distanceKm(p, p), 0);
});

Deno.test("formatKm usa el separador del idioma y sin decimales desde 100 km", () => {
  assertEquals(formatKm(0.42, "es-CL"), "0,4 km");
  assertEquals(formatKm(3.14, "es-CL"), "3,1 km");
  assertEquals(formatKm(12, "es-CL"), "12,0 km");
  assertEquals(formatKm(456.7, "es-CL"), "457 km");
  assertEquals(formatKm(3.14, "en-US"), "3.1 km");
  assertEquals(formatKm(456.7, "en-US"), "457 km");
});
