import { assertEquals } from "jsr:@std/assert@1";
import { fullImageUrl, parseListing } from "./winpy.ts";

Deno.test("Winpy: fullImageUrl quita tumb_ y resuelve contra el dominio", () => {
  assertEquals(
    fullImageUrl("/files/tumb_48719-6a623847ba314.jpg"),
    "https://www.winpy.cl/files/48719-6a623847ba314.jpg",
  );
});

Deno.test("Winpy: fullImageUrl deja igual la imagen grande", () => {
  assertEquals(
    fullImageUrl("/files/28724-6a7f4328c9322.jpg"),
    "https://www.winpy.cl/files/28724-6a7f4328c9322.jpg",
  );
});

Deno.test("Winpy: fullImageUrl sin src devuelve null", () => {
  assertEquals(fullImageUrl(undefined), null);
  assertEquals(fullImageUrl(""), null);
});

const article = (slug: string, img: string, name: string, price: string) => `
<article>
  <a href="/venta/${slug}/" title="..."><img src="${img}" width="140" height="140" alt="..."></a>
  <p><a href="/venta/${slug}/">AMD</a></p>
  <p class="model"><a href="/venta/${slug}/">${name}</a></p>
  <p class="valor">${price}</p>
  <div class="opciones"><button title="Despacho Express" class="btnExpress"><b>Despacho Express</b></button></div>
</article>`;

Deno.test("Winpy: parseListing lee la imagen de cada artículo", () => {
  const html = `<section id="productos">
${article("procesador-amd-ryzen-5-4500", "/files/tumb_48719-6a623847ba314.jpg", "Procesador AMD Ryzen 5 4500 (AM4, 6 Núcleos, 12 Hilos, 3.6/4.1GHz, 8MB de Caché L3)", "$ 94.240")}
${article("procesador-intel-core-i3-12100f", "/files/28724-6a7f4328c9322.jpg", "Procesador Intel Core i3 12100F", "$ 102.752")}
<article>
  <p class="model"><a href="/venta/sin-imagen/">Procesador sin imagen</a></p>
  <p class="valor">$ 50.000</p>
</article>
</section>`;
  const { products } = parseListing(html);
  assertEquals(products.map((p) => p.imageUrl), [
    "https://www.winpy.cl/files/48719-6a623847ba314.jpg",
    "https://www.winpy.cl/files/28724-6a7f4328c9322.jpg",
    null,
  ]);
  assertEquals(products[0].name, "Procesador AMD Ryzen 5 4500 (AM4, 6 Núcleos, 12 Hilos, 3.6/4.1GHz, 8MB de Caché L3)");
  assertEquals(products[0].price, 94240);
  assertEquals(products[2].price, 50000);
});
