import { assertEquals } from "jsr:@std/assert@1";
import {
  activeFilterCount,
  maxParamFromSlider,
  parseMaxPrice,
  PRICE_STEP,
  sliderMax,
  sliderValue,
} from "../../src/lib/filters.ts";

Deno.test("PRICE_STEP es 10000", () => {
  assertEquals(PRICE_STEP, 10_000);
});

Deno.test("sliderMax redondea el mayor precio hacia arriba al paso", () => {
  assertEquals(sliderMax([189990, null, 649990]), 650000);
  assertEquals(sliderMax([650000]), 650000);
});

Deno.test("sliderMax usa el paso si no hay precios", () => {
  assertEquals(sliderMax([]), 10000);
  assertEquals(sliderMax([null]), 10000);
  assertEquals(sliderMax([0]), 10000);
});

Deno.test("parseMaxPrice acepta enteros no negativos", () => {
  assertEquals(parseMaxPrice("300000"), 300000);
  assertEquals(parseMaxPrice("5000000"), 5000000);
  assertEquals(parseMaxPrice("0"), 0);
});

Deno.test("parseMaxPrice devuelve null para valores inválidos", () => {
  assertEquals(parseMaxPrice("abc"), null);
  assertEquals(parseMaxPrice("-5"), null);
  assertEquals(parseMaxPrice(""), null);
  assertEquals(parseMaxPrice(null), null);
  assertEquals(parseMaxPrice("1e5"), null);
  assertEquals(parseMaxPrice("300000.5"), null);
  assertEquals(parseMaxPrice(" 300000 "), null);
});

Deno.test("sliderValue fija el valor en el límite cuando no hay filtro o excede", () => {
  assertEquals(sliderValue(null, 650000), 650000);
  assertEquals(sliderValue(5000000, 650000), 650000);
  assertEquals(sliderValue(300000, 650000), 300000);
});

Deno.test("maxParamFromSlider no filtra en el límite", () => {
  assertEquals(maxParamFromSlider(650000, 650000), null);
  assertEquals(maxParamFromSlider(300000, 650000), "300000");
});

Deno.test("activeFilterCount cuenta los filtros activos", () => {
  assertEquals(
    activeFilterCount({ category: "all", storeId: "all", maxPrice: null, onlyInStock: false }),
    0,
  );
  assertEquals(
    activeFilterCount({ category: "gpu", storeId: "2", maxPrice: 300000, onlyInStock: true }),
    4,
  );
});
