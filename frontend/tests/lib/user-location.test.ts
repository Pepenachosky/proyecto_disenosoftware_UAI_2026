import { assertEquals } from "jsr:@std/assert@1";
import { requestPosition } from "../../src/lib/user-location.ts";

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
