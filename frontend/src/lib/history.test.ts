import { assertEquals } from "jsr:@std/assert@1";
import { buildChartData, currentPrices } from "./history.ts";
import type { Offer } from "./offers.ts";

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

const offer = (o: Partial<Offer> & Pick<Offer, "id" | "store_id">): Offer => ({
  group_id: 1,
  name: "x",
  url: null,
  category: "cpu",
  price: 100,
  in_stock: true,
  last_seen_at: "2026-11-10T06:00:00Z",
  ...o,
});

Deno.test("una sola fila de historial: la línea llega hasta hoy", () => {
  const now = new Date("2026-11-10T15:00:00Z");
  const rows = [{ product_id: 1, price: 100, scraped_at: "2026-11-01T08:00:00Z" }];
  const current = currentPrices([offer({ id: 1, store_id: 1 })], now);
  assertEquals(current, [{ storeId: 1, price: 100, date: "2026-11-10" }]);
  assertEquals(buildChartData(rows, map, current), [
    { date: "2026-11-01", winpy: 100 },
    { date: "2026-11-10", winpy: 100 },
  ]);
});

Deno.test("oferta sin datos recientes: la línea termina en last_seen_at", () => {
  const now = new Date("2026-11-10T15:00:00Z");
  const rows = [
    { product_id: 1, price: 100, scraped_at: "2026-11-01T08:00:00Z" },
    { product_id: 2, price: 95, scraped_at: "2026-11-01T09:00:00Z" },
  ];
  const offers = [
    offer({ id: 1, store_id: 1 }),
    offer({ id: 2, store_id: 2, price: 95, last_seen_at: "2026-11-04T23:00:00Z" }),
  ];
  const current = currentPrices(offers, now);
  assertEquals(current, [
    { storeId: 1, price: 100, date: "2026-11-10" },
    { storeId: 2, price: 95, date: "2026-11-04" },
  ]);
  assertEquals(buildChartData(rows, map, current), [
    { date: "2026-11-01", winpy: 100, pcexpress: 95 },
    { date: "2026-11-04", pcexpress: 95 },
    { date: "2026-11-10", winpy: 100 },
  ]);
});

Deno.test("el precio actual reemplaza al del historial del mismo día", () => {
  const rows = [{ product_id: 1, price: 100, scraped_at: "2026-11-10T08:00:00Z" }];
  assertEquals(buildChartData(rows, map, [{ storeId: 1, price: 90, date: "2026-11-10" }]), [
    { date: "2026-11-10", winpy: 90 },
  ]);
});
