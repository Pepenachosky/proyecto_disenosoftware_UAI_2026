import { assertEquals } from "jsr:@std/assert@1";
import {
  groupOffers,
  isCurrent,
  offerStatus,
  sortOffers,
  summarize,
  type Group,
  type GroupWithOffers,
  type Offer,
} from "./offers.ts";

const now = new Date("2026-11-10T12:00:00Z");

function offer(p: Partial<Offer>): Offer {
  return {
    id: 1,
    store_id: 1,
    group_id: 1,
    name: "x",
    url: null,
    category: "cpu",
    price: 100,
    in_stock: null,
    last_seen_at: "2026-11-09T12:00:00Z",
    ...p,
  };
}

const group: Group = { id: 1, slug: "g", name: "G", category: "cpu", image_url: null };

Deno.test("isCurrent", () => {
  assertEquals(isCurrent(offer({}), now), true);
  assertEquals(isCurrent(offer({ last_seen_at: "2026-11-05T12:00:00Z" }), now), false);
  assertEquals(isCurrent(offer({ in_stock: false }), now), false);
  assertEquals(isCurrent(offer({ price: null }), now), false);
});

Deno.test("offerStatus: agotado gana sobre viejo", () => {
  assertEquals(offerStatus(offer({ in_stock: false, last_seen_at: "2026-10-01T00:00:00Z" }), now), "agotado");
  assertEquals(offerStatus(offer({ last_seen_at: "2026-10-01T00:00:00Z" }), now), "sin-datos");
  assertEquals(offerStatus(offer({ price: null }), now), "sin-datos");
  assertEquals(offerStatus(offer({}), now), "vigente");
});

Deno.test("summarize", () => {
  const g: GroupWithOffers = {
    ...group,
    offers: [
      offer({ id: 1, store_id: 1, price: 184900 }),
      offer({ id: 2, store_id: 2, price: 179990 }),
      offer({ id: 3, store_id: 3, price: 150000, last_seen_at: "2026-10-29T12:00:00Z" }),
    ],
  };
  assertEquals(summarize(g, now), { bestPrice: 179990, bestStoreId: 2, storeCount: 2 });
  assertEquals(summarize({ ...group, offers: [g.offers[2]] }, now), {
    bestPrice: null,
    bestStoreId: null,
    storeCount: 0,
  });
});

Deno.test("summarize: empate gana tienda menor y storeCount distintas", () => {
  const g: GroupWithOffers = {
    ...group,
    offers: [
      offer({ id: 1, store_id: 3, price: 100 }),
      offer({ id: 2, store_id: 2, price: 100 }),
      offer({ id: 3, store_id: 2, price: 120 }),
    ],
  };
  assertEquals(summarize(g, now), { bestPrice: 100, bestStoreId: 2, storeCount: 2 });
});

Deno.test("sortOffers", () => {
  const input = [
    offer({ id: 1, price: 150000, last_seen_at: "2026-10-29T12:00:00Z" }),
    offer({ id: 2, price: null, last_seen_at: "2026-10-29T12:00:00Z" }),
    offer({ id: 3, price: 200000 }),
    offer({ id: 4, price: 100000 }),
  ];
  const copy = [...input];
  assertEquals(sortOffers(input, now).map((o) => o.id), [4, 3, 1, 2]);
  assertEquals(input, copy);
});

Deno.test("groupOffers descarta grupos sin ofertas", () => {
  const g2: Group = { ...group, id: 2, slug: "h" };
  const res = groupOffers([group, g2], [offer({ id: 1, group_id: 1 })]);
  assertEquals(res.length, 1);
  assertEquals(res[0].id, 1);
  assertEquals(res[0].offers.length, 1);
});
