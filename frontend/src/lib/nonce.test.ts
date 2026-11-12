import { assertEquals, assert } from "jsr:@std/assert@1";
import { createNonce, sha256Hex } from "./nonce.ts";

Deno.test("sha256Hex es el digest SHA-256 en hex minúsculas", async () => {
  assertEquals(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

Deno.test("createNonce: hashed es el SHA-256 de raw", async () => {
  const { raw, hashed } = await createNonce();
  assertEquals(hashed, await sha256Hex(raw));
  assert(raw.length >= 32);
  assert(/^[0-9a-f]{64}$/.test(hashed));
});

Deno.test("createNonce: dos llamadas dan raw distintos", async () => {
  const a = await createNonce();
  const b = await createNonce();
  assert(a.raw !== b.raw);
});
