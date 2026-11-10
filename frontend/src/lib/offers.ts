export type Category = "cpu" | "gpu" | "ram";
export type Offer = {
  id: number;
  store_id: number;
  group_id: number;
  name: string;
  url: string | null;
  category: Category;
  price: number | null;
  in_stock: boolean | null;
  last_seen_at: string;
};
export type Group = {
  id: number;
  slug: string;
  name: string;
  category: Category;
  image_url: string | null;
};
export type GroupWithOffers = Group & { offers: Offer[] };

export const STORES: { id: number; slug: string; name: string }[] = [
  { id: 1, slug: "winpy", name: "Winpy" },
  { id: 2, slug: "pcexpress", name: "PC Express" },
  { id: 3, slug: "spdigital", name: "SP Digital" },
];

export const CURRENT_DAYS = 3;

export const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function isFresh(o: Offer, now: Date): boolean {
  const limit = now.getTime() - CURRENT_DAYS * 24 * 60 * 60 * 1000;
  return new Date(o.last_seen_at).getTime() >= limit;
}

export function isCurrent(o: Offer, now: Date): boolean {
  return isFresh(o, now) && o.in_stock !== false && o.price != null;
}

export function offerStatus(o: Offer, now: Date): "vigente" | "agotado" | "sin-datos" {
  if (o.in_stock === false) return "agotado";
  return isCurrent(o, now) ? "vigente" : "sin-datos";
}

export function summarize(
  g: GroupWithOffers,
  now: Date,
): { bestPrice: number | null; bestStoreId: number | null; storeCount: number } {
  const current = g.offers.filter((o) => isCurrent(o, now));
  let best: Offer | null = null;
  for (const o of current) {
    if (
      best === null ||
      o.price! < best.price! ||
      (o.price === best.price && o.store_id < best.store_id)
    ) {
      best = o;
    }
  }
  return {
    bestPrice: best?.price ?? null,
    bestStoreId: best?.store_id ?? null,
    storeCount: new Set(current.map((o) => o.store_id)).size,
  };
}

function byPrice(a: Offer, b: Offer): number {
  if (a.price == null && b.price == null) return 0;
  if (a.price == null) return 1;
  if (b.price == null) return -1;
  return a.price - b.price;
}

export function sortOffers(offers: Offer[], now: Date): Offer[] {
  const current = offers.filter((o) => isCurrent(o, now)).sort(byPrice);
  const rest = offers.filter((o) => !isCurrent(o, now)).sort(byPrice);
  return [...current, ...rest];
}

export function groupOffers(groups: Group[], offers: Offer[]): GroupWithOffers[] {
  const byGroup = new Map<number, Offer[]>();
  for (const o of offers) {
    const list = byGroup.get(o.group_id);
    if (list) list.push(o);
    else byGroup.set(o.group_id, [o]);
  }
  return groups
    .filter((g) => byGroup.has(g.id))
    .map((g) => ({ ...g, offers: byGroup.get(g.id)! }));
}
