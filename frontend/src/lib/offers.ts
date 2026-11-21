// Modelo de ofertas del frontend y reglas de negocio: cuándo una oferta está
// vigente, mejor precio por grupo, disponibilidad y orden de la lista de tiendas.

export type Category = "cpu" | "gpu" | "ram";
/**
 * Una publicación de una tienda (fila de `products`). price e in_stock son null
 * cuando el scraper no los pudo leer; last_seen_at es la última vez que se vio.
 */
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
/** Producto canónico (fila de `product_groups`) que agrupa las ofertas de distintas tiendas. */
export type Group = {
  id: number;
  slug: string;
  name: string;
  category: Category;
  image_url: string | null;
};
export type GroupWithOffers = Group & { offers: Offer[] };

/** Tiendas conocidas; los id deben coincidir con los de la tabla `stores`. El orden fija el de las series del gráfico. */
export const STORES: { id: number; slug: string; name: string }[] = [
  { id: 1, slug: "winpy", name: "Winpy" },
  { id: 2, slug: "pcexpress", name: "PC Express" },
  { id: 3, slug: "spdigital", name: "SP Digital" },
];

/**
 * Una oferta no vista por el scraper en estos días se considera desactualizada
 * (la tienda pudo retirarla), aunque la fila siga en la base.
 */
export const CURRENT_DAYS = 3;

// Precio en pesos chilenos, sin decimales, con el formato del idioma activo.
export function formatClp(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

// Visto dentro de las últimas CURRENT_DAYS × 24 h (ventana móvil, no días calendario).
function isFresh(o: Offer, now: Date): boolean {
  const limit = now.getTime() - CURRENT_DAYS * 24 * 60 * 60 * 1000;
  return new Date(o.last_seen_at).getTime() >= limit;
}

/**
 * Vigente: vista hace poco, con precio y sin marcar agotada. Un in_stock null
 * (la tienda no lo informa) no la descarta: no se sabe si hay stock.
 */
export function isCurrent(o: Offer, now: Date): boolean {
  return isFresh(o, now) && o.in_stock !== false && o.price != null;
}

/**
 * Estado para mostrar en la fila de una oferta. "agotado" gana aunque sea
 * reciente; "sin-datos" cubre ofertas viejas o sin precio.
 */
export function offerStatus(o: Offer, now: Date): "vigente" | "agotado" | "sin-datos" {
  if (o.in_stock === false) return "agotado";
  return isCurrent(o, now) ? "vigente" : "sin-datos";
}

/**
 * Resumen de la tarjeta del catálogo usando solo ofertas vigentes: mejor precio,
 * tienda que lo ofrece y cuántas tiendas distintas lo venden. Sin vigentes →
 * bestPrice y bestStoreId null, storeCount 0.
 */
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
      // Empate de precio: gana el menor store_id para que el resultado sea estable.
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

// Disponibilidad para la tarjeta del catálogo: "si" solo si alguna oferta vigente
// informa stock; "sin-info" si hay vigentes pero ninguna lo informa; "no" si no hay vigentes.
export function stockState(g: GroupWithOffers, now: Date): "si" | "sin-info" | "no" {
  const current = g.offers.filter((o) => isCurrent(o, now));
  if (current.some((o) => o.in_stock === true)) return "si";
  return current.length > 0 ? "sin-info" : "no";
}

// La primera oferta, en el orden dado, que es vigente y coincide con la mejor tienda y precio.
// `best` es el resultado de summarize(); null si no hay mejor precio.
export function bestOffer(
  sorted: Offer[],
  now: Date,
  best: { bestPrice: number | null; bestStoreId: number | null },
): Offer | null {
  if (best.bestPrice == null) return null;
  return sorted.find((o) =>
    isCurrent(o, now) && o.store_id === best.bestStoreId && o.price === best.bestPrice
  ) ?? null;
}

// Rango de precios de las ofertas vigentes; null si no hay al menos dos precios distintos.
// savings es lo que se ahorra comprando en la más barata en vez de la más cara.
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

// Menor precio primero; las ofertas sin precio van al final.
function byPrice(a: Offer, b: Offer): number {
  if (a.price == null && b.price == null) return 0;
  if (a.price == null) return 1;
  if (b.price == null) return -1;
  return a.price - b.price;
}

/** Criterio de orden de la lista de tiendas en la página de producto. */
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
// distanceByStore: store_id → km a la sucursal de esa tienda (vacío sin ubicación).
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

/**
 * Asigna a cada grupo sus ofertas. Los grupos sin ninguna oferta se omiten
 * (no tienen nada que mostrar en el catálogo); se conserva el orden de `groups`.
 */
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
