import { STORES } from "./offers.ts";

export type HistoryRow = { product_id: number; price: number | null; scraped_at: string };
export type ChartPoint = { date: string } & Partial<Record<"winpy" | "pcexpress" | "spdigital", number>>;

export function buildChartData(
  rows: HistoryRow[],
  storeOfProduct: Map<number, number>,
): ChartPoint[] {
  const slugOf = new Map(STORES.map((s) => [s.id, s.slug as keyof Omit<ChartPoint, "date">]));
  // date -> slug -> { price, at }
  const days = new Map<string, Map<string, { price: number; at: string }>>();
  for (const r of rows) {
    if (r.price == null) continue;
    const storeId = storeOfProduct.get(r.product_id);
    const slug = storeId === undefined ? undefined : slugOf.get(storeId);
    if (!slug) continue;
    const date = r.scraped_at.slice(0, 10);
    let day = days.get(date);
    if (!day) days.set(date, (day = new Map()));
    const prev = day.get(slug);
    if (!prev || r.scraped_at >= prev.at) day.set(slug, { price: r.price, at: r.scraped_at });
  }
  return [...days.keys()].sort().map((date) => {
    const point: ChartPoint = { date };
    for (const [slug, v] of days.get(date)!) {
      point[slug as keyof Omit<ChartPoint, "date">] = v.price;
    }
    return point;
  });
}
