import { assertEquals } from "jsr:@std/assert@1";
import { CATEGORY_ORDER, cheapestOf, groupByCategory } from "../../src/lib/compare.ts";

const p = (name: string, category: "cpu" | "gpu" | "ram") => ({ name, category });

Deno.test("CATEGORY_ORDER es CPU, RAM, GPU", () => {
  assertEquals([...CATEGORY_ORDER], ["cpu", "ram", "gpu"]);
});

Deno.test("groupByCategory separa por categoría en orden CPU, RAM, GPU", () => {
  const out = groupByCategory(
    [p("RTX 4060", "gpu"), p("Ryzen 5", "cpu"), p("DDR5 32GB", "ram"), p("Core i5", "cpu")],
    "es",
  );
  assertEquals(out.map((s) => s.category), ["cpu", "ram", "gpu"]);
  assertEquals(out[0].items.map((x) => x.name), ["Core i5", "Ryzen 5"]);
  assertEquals(out[1].items.map((x) => x.name), ["DDR5 32GB"]);
  assertEquals(out[2].items.map((x) => x.name), ["RTX 4060"]);
});

Deno.test("groupByCategory omite las categorías vacías", () => {
  const out = groupByCategory([p("RTX 4060", "gpu"), p("Ryzen 5", "cpu")], "es");
  assertEquals(out.map((s) => s.category), ["cpu", "gpu"]);
  assertEquals(groupByCategory([], "es"), []);
});

Deno.test("groupByCategory no modifica el arreglo recibido", () => {
  const input = [p("B", "cpu"), p("A", "cpu")];
  groupByCategory(input, "es");
  assertEquals(input.map((x) => x.name), ["B", "A"]);
});

Deno.test("cheapestOf necesita dos o más precios", () => {
  assertEquals(cheapestOf([]), null);
  assertEquals(cheapestOf([100]), null);
  assertEquals(cheapestOf([null, 100]), null);
  assertEquals(cheapestOf([null, null]), null);
});

Deno.test("cheapestOf devuelve el mínimo, también con empates y nulos", () => {
  assertEquals(cheapestOf([300, 100, 200]), 100);
  assertEquals(cheapestOf([100, 100]), 100);
  assertEquals(cheapestOf([null, 250, 150]), 150);
});
