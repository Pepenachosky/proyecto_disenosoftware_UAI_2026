import { assertEquals } from "jsr:@std/assert@1";
import { pickGroupImage } from "./group.ts";

Deno.test("pickGroupImage: SP Digital antes que Winpy", () => {
  assertEquals(
    pickGroupImage([
      { storeSlug: "winpy", imageUrl: "https://w/a.jpg" },
      { storeSlug: "spdigital", imageUrl: "https://s/b.jpg" },
    ]),
    "https://s/b.jpg",
  );
});

Deno.test("pickGroupImage: SP Digital sin foto usa Winpy", () => {
  assertEquals(
    pickGroupImage([
      { storeSlug: "spdigital", imageUrl: null },
      { storeSlug: "winpy", imageUrl: "https://w/a.jpg" },
    ]),
    "https://w/a.jpg",
  );
});

Deno.test("pickGroupImage: solo PC Express queda null", () => {
  assertEquals(
    pickGroupImage([{ storeSlug: "pcexpress", imageUrl: "https://imagenes.pc-express.cl/x.jpg" }]),
    null,
  );
});

Deno.test("pickGroupImage: sin candidatos queda null", () => {
  assertEquals(pickGroupImage([]), null);
});

Deno.test("pickGroupImage: dos de la misma tienda, gana el primero", () => {
  assertEquals(
    pickGroupImage([
      { storeSlug: "spdigital", imageUrl: "https://s/1.jpg" },
      { storeSlug: "spdigital", imageUrl: "https://s/2.jpg" },
    ]),
    "https://s/1.jpg",
  );
});
