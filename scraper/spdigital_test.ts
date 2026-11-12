import { assertEquals } from "jsr:@std/assert@1";
import { parseListing } from "./spdigital.ts";

// Arma un JSON mínimo de categoría con un solo item (slug y nombre válidos).
function listing(extra: Record<string, unknown>): string {
  return JSON.stringify({
    result: {
      pageContext: {
        content: {
          items: [{ slug: "procesador-intel-13100f", name: "PROCESADOR INTEL 13100F", ...extra }],
        },
      },
    },
  });
}

const BASE_IMG = "https://media.spdigital.cl/thumbnails/products";

Deno.test("SP Digital: usa la imagen de 512 px del primer medio IMAGE", () => {
  const { products } = parseListing(listing({
    media: [{
      type: "IMAGE",
      url: `${BASE_IMG}/x_thumbnail_4096.jpg`,
      limitedUrl: `${BASE_IMG}/x_thumbnail_512.jpg`,
      thumbnailUrl: `${BASE_IMG}/x_thumbnail_256.jpg`,
    }],
    thumbnail: { url: `${BASE_IMG}/x_thumbnail_256.jpg` },
  }));
  assertEquals(products[0].imageUrl, `${BASE_IMG}/x_thumbnail_512.jpg`);
});

Deno.test("SP Digital: sin media usa thumbnail.url", () => {
  const { products } = parseListing(listing({
    media: [],
    thumbnail: { url: `${BASE_IMG}/y_thumbnail_256.jpg` },
  }));
  assertEquals(products[0].imageUrl, `${BASE_IMG}/y_thumbnail_256.jpg`);
});

Deno.test("SP Digital: ignora medios que no son IMAGE", () => {
  const { products } = parseListing(listing({
    media: [{ type: "VIDEO", limitedUrl: "https://media.spdigital.cl/v.mp4" }],
  }));
  assertEquals(products[0].imageUrl, null);
});

Deno.test("SP Digital: URL que no es https queda null", () => {
  const { products } = parseListing(listing({
    media: [{ type: "IMAGE", limitedUrl: "http://media.spdigital.cl/a.jpg" }],
  }));
  assertEquals(products[0].imageUrl, null);
});
