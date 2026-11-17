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

// Precio en pesos chilenos, sin decimales, con el formato del idioma activo.
export function formatClp(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

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

// Rango de precios de las ofertas vigentes; null si no hay al menos dos precios distintos.
export function priceSpread(
  g: GroupWithOffers,
  now: Date,
): { min: number; max: number; savings: number } | null {
  const prices = g.offers.filter((o) => isCurrent(o, now)).map((o) => o.price!);
  if (prices.length < 2) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (max === min) return null;
  return { min, max, savings: max - min };
}

function byPrice(a: Offer, b: Offer): number {
  if (a.price == null && b.price == null) return 0;
  if (a.price == null) return 1;
  if (b.price == null) return -1;
  return a.price - b.price;
}

export type SortBy = "precio" | "distancia";

// Menor distancia primero; sin distancia al final; empate → precio.
function byDistance(d: Map<number, number>) {
  return (a: Offer, b: Offer): number => {
    const da = d.get(a.store_id);
    const db = d.get(b.store_id);
    if (da != null && db != null && da !== db) return da - db;
    if (da == null && db != null) return 1;
    if (da != null && db == null) return -1;
    return byPrice(a, b);
  };
}

// Vigentes primero y atenuadas después; dentro de cada bloque, por precio o distancia.
export function sortOffers(
  offers: Offer[],
  now: Date,
  by: SortBy = "precio",
  distanceByStore: Map<number, number> = new Map(),
): Offer[] {
  const cmp = by === "distancia" ? byDistance(distanceByStore) : byPrice;
  const current = offers.filter((o) => isCurrent(o, now)).sort(cmp);
  const rest = offers.filter((o) => !isCurrent(o, now)).sort(cmp);
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
