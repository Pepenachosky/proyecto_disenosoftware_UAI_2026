import { assertEquals } from "jsr:@std/assert@1";
import {
  bestOffer,
  formatClp,
  groupOffers,
  isCurrent,
  offerStatus,
  priceSpread,
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

const dist = (o: Record<number, number>) => new Map(Object.entries(o).map(([k, v]) => [Number(k), v]));
const ids = (os: Offer[]) => os.map((o) => o.store_id);

Deno.test("sortOffers por distancia", () => {
  const input = [
    offer({ id: 1, store_id: 1, price: 300 }),
    offer({ id: 2, store_id: 2, price: 100 }),
    offer({ id: 3, store_id: 3, price: 200 }),
  ];
  assertEquals(ids(sortOffers(input, now, "distancia", dist({ 1: 2, 2: 9, 3: 5 }))), [1, 3, 2]);
});

Deno.test("sortOffers: sin distancia va al final", () => {
  const input = [
    offer({ id: 1, store_id: 1, price: 300 }),
    offer({ id: 2, store_id: 2, price: 100 }),
    offer({ id: 3, store_id: 3, price: 200 }),
  ];
  assertEquals(ids(sortOffers(input, now, "distancia", dist({ 1: 2, 2: 9 }))), [1, 2, 3]);
});

Deno.test("sortOffers: vigentes antes que atenuadas también por distancia", () => {
  const input = [
    offer({ id: 1, store_id: 1, price: 300, in_stock: false }),
    offer({ id: 2, store_id: 2, price: 100 }),
    offer({ id: 3, store_id: 3, price: 200 }),
  ];
  assertEquals(ids(sortOffers(input, now, "distancia", dist({ 1: 1, 2: 9, 3: 5 }))), [3, 2, 1]);
});

Deno.test("sortOffers: empate de distancia se resuelve por precio", () => {
  const input = [
    offer({ id: 1, store_id: 1, price: 300 }),
    offer({ id: 2, store_id: 2, price: 100 }),
  ];
  assertEquals(ids(sortOffers(input, now, "distancia", dist({ 1: 4, 2: 4 }))), [2, 1]);
});

Deno.test("sortOffers: por precio no cambia aunque haya distancias", () => {
  const input = [
    offer({ id: 1, store_id: 1, price: 300 }),
    offer({ id: 2, store_id: 2, price: 100 }),
  ];
  assertEquals(ids(sortOffers(input, now, "precio", dist({ 1: 1, 2: 9 }))), [2, 1]);
});

Deno.test("groupOffers descarta grupos sin ofertas", () => {
  const g2: Group = { ...group, id: 2, slug: "h" };
  const res = groupOffers([group, g2], [offer({ id: 1, group_id: 1 })]);
  assertEquals(res.length, 1);
  assertEquals(res[0].id, 1);
  assertEquals(res[0].offers.length, 1);
});

Deno.test("formatClp según el locale", () => {
  assertEquals(formatClp(89990, "es-CL"), "$89.990");
  assertEquals(formatClp(89990, "en-US").replace(/\s/g, " "), "CLP 89,990");
});

Deno.test("priceSpread: una sola oferta vigente → null", () => {
  const g: GroupWithOffers = { ...group, offers: [offer({ id: 1, store_id: 1, price: 329990 })] };
  assertEquals(priceSpread(g, now), null);
});

Deno.test("priceSpread: dos vigentes → min, max y ahorro", () => {
  const g: GroupWithOffers = {
    ...group,
    offers: [
      offer({ id: 1, store_id: 1, price: 359990 }),
      offer({ id: 2, store_id: 2, price: 329990 }),
    ],
  };
  assertEquals(priceSpread(g, now), { min: 329990, max: 359990, savings: 30000 });
});

Deno.test("priceSpread: mismo precio → null", () => {
  const g: GroupWithOffers = {
    ...group,
    offers: [
      offer({ id: 1, store_id: 1, price: 329990 }),
      offer({ id: 2, store_id: 2, price: 329990 }),
    ],
  };
  assertEquals(priceSpread(g, now), null);
});

Deno.test("priceSpread: agotada más cara no cuenta → null", () => {
  const g: GroupWithOffers = {
    ...group,
    offers: [
      offer({ id: 1, store_id: 1, price: 329990 }),
      offer({ id: 2, store_id: 2, price: 399990, in_stock: false }),
    ],
  };
  assertEquals(priceSpread(g, now), null);
});

Deno.test("priceSpread: dos ofertas de la misma tienda cuentan", () => {
  const g: GroupWithOffers = {
    ...group,
    offers: [
      offer({ id: 1, store_id: 1, price: 300000 }),
      offer({ id: 2, store_id: 1, price: 320000 }),
    ],
  };
  assertEquals(priceSpread(g, now), { min: 300000, max: 320000, savings: 20000 });
});

Deno.test("bestOffer", () => {
  const best = { bestPrice: 100, bestStoreId: 1 };
  const a = offer({ id: 1, store_id: 2, price: 100 });
  const b = offer({ id: 2, store_id: 1, price: 100 });
  const c = offer({ id: 3, store_id: 1, price: 100 });
  assertEquals(bestOffer([a, b, c], now, best)?.id, 2);
  assertEquals(bestOffer([a, b], now, { bestPrice: null, bestStoreId: null }), null);
  const old = offer({ id: 4, store_id: 1, price: 100, last_seen_at: "2026-11-01T12:00:00Z" });
  assertEquals(bestOffer([old], now, best), null);
  assertEquals(bestOffer([old, c, b], now, best)?.id, 3);
});
