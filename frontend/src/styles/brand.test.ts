import { assert } from "jsr:@std/assert@1";

// Marca Rigly: favicon, placeholder liviano y logo en la barra.
const root = new URL("../../", import.meta.url);
const read = (path: string) => Deno.readTextFileSync(new URL(path, root));

Deno.test("index.html enlaza el favicon PNG", () => {
  const html = read("index.html");
  assert(html.includes('href="/favicon.png"'), "falta href=/favicon.png");
  assert(html.includes('type="image/png"'), "falta type=image/png");
  assert(!html.includes("favicon.svg"), "sigue apuntando a favicon.svg");
});

Deno.test("favicon.png es un PNG de verdad", () => {
  const bytes = Deno.readFileSync(new URL("public/favicon.png", root));
  assert([0x89, 0x50, 0x4e, 0x47].every((b, i) => bytes[i] === b), "no tiene firma PNG");
});

Deno.test("el placeholder pesa menos de 100 KB", () => {
  const { size } = Deno.statSync(new URL("public/placeholder.png", root));
  assert(size < 100_000, `pesa ${size} bytes`);
});

Deno.test("la barra usa el logo en vez del cuadrado degradado", () => {
  const css = read("src/styles/nav.css");
  assert(css.includes(".brand-logo"), "falta .brand-logo");
  assert(!css.includes(".brand-mark"), "sigue .brand-mark");
});
