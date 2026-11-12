import { isCurrent, STORES, type Offer } from "./offers.ts";

export type HistoryRow = { product_id: number; price: number | null; scraped_at: string };
export type ChartPoint = { date: string; t?: number } & Partial<
  Record<"winpy" | "pcexpress" | "spdigital", number>
>;
export type CurrentPrice = { storeId: number; price: number; date: string };
type Slug = "winpy" | "pcexpress" | "spdigital";

const utcDay = (iso: string | Date) => new Date(iso).toISOString().slice(0, 10);

// price_history solo guarda filas cuando cambia el precio o el stock, así que
// la línea de cada tienda se alarga hasta su precio actual: hoy si la oferta
// está vigente, o el último día en que se vio si no.
export function currentPrices(offers: Offer[], now: Date): CurrentPrice[] {
  const out: CurrentPrice[] = [];
  for (const s of STORES) {
    const priced = offers.filter((o) => o.store_id === s.id && o.price != null);
    const current = priced.filter((o) => isCurrent(o, now)).sort((a, b) => a.price! - b.price!);
    if (current[0]) {
      out.push({ storeId: s.id, price: current[0].price!, date: utcDay(now) });
      continue;
    }
    const last = [...priced].sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))[0];
    if (last) out.push({ storeId: s.id, price: last.price!, date: utcDay(last.last_seen_at) });
  }
  return out;
}

export function buildChartData(
  rows: HistoryRow[],
  storeOfProduct: Map<number, number>,
  current?: CurrentPrice[],
): ChartPoint[] {
  const slugOf = new Map(STORES.map((s) => [s.id, s.slug as Slug]));
  // date -> slug -> { price, at }
  const days = new Map<string, Map<Slug, { price: number; at: string }>>();
  const put = (date: string, slug: Slug, price: number, at: string) => {
    let day = days.get(date);
    if (!day) days.set(date, (day = new Map()));
    const prev = day.get(slug);
    if (!prev || at >= prev.at) day.set(slug, { price, at });
  };
  for (const r of rows) {
    if (r.price == null) continue;
    const storeId = storeOfProduct.get(r.product_id);
    const slug = storeId === undefined ? undefined : slugOf.get(storeId);
    if (!slug) continue;
    put(r.scraped_at.slice(0, 10), slug, r.price, r.scraped_at);
  }
  // El precio actual es el último punto de su tienda (gana sobre el historial de ese día).
  for (const c of current ?? []) {
    const slug = slugOf.get(c.storeId);
    if (slug) put(c.date, slug, c.price, "￿");
  }
  return [...days.keys()].sort().map((date) => {
    const point: ChartPoint = { date };
    for (const [slug, v] of days.get(date)!) point[slug] = v.price;
    return point;
  });
}
