import { assertEquals } from "jsr:@std/assert@1";
import { buildChartData } from "./history.ts";

const map = new Map([[1, 1], [2, 2]]);

Deno.test("último precio del día por tienda", () => {
  const rows = [
    { product_id: 1, price: 100, scraped_at: "2026-11-09T08:00:00Z" },
    { product_id: 1, price: 90, scraped_at: "2026-11-09T20:00:00Z" },
  ];
  assertEquals(buildChartData(rows, map), [{ date: "2026-11-09", winpy: 90 }]);
});

Deno.test("dos tiendas el mismo día", () => {
  const rows = [
    { product_id: 1, price: 100, scraped_at: "2026-11-09T08:00:00Z" },
    { product_id: 2, price: 95, scraped_at: "2026-11-09T09:00:00Z" },
    { product_id: 2, price: null, scraped_at: "2026-11-08T09:00:00Z" },
    { product_id: 99, price: 5, scraped_at: "2026-11-07T09:00:00Z" },
  ];
  assertEquals(buildChartData(rows, map), [{ date: "2026-11-09", winpy: 100, pcexpress: 95 }]);
});

Deno.test("vacío", () => {
  assertEquals(buildChartData([], map), []);
});
