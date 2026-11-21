import type { Category } from "./offers.ts";

// Orden de las tablas de comparación en Guardados.
export const CATEGORY_ORDER: readonly Category[] = ["cpu", "ram", "gpu"];

export type CategorySection<T> = { category: Category; items: T[] };

// Separa los productos por categoría (en CATEGORY_ORDER, sin las vacías) y los
// ordena por nombre dentro de cada una. No modifica el arreglo recibido.
export function groupByCategory<T extends { category: Category; name: string }>(
  items: T[],
  locale: string,
): CategorySection<T>[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    items: items
      .filter((x) => x.category === category)
      .sort((a, b) => a.name.localeCompare(b.name, locale)),
  })).filter((s) => s.items.length > 0);
}

// "Más barato" solo tiene sentido al comparar dos o más productos con precio.
export function cheapestOf(prices: (number | null)[]): number | null {
  const known = prices.filter((p): p is number => p != null);
  return known.length >= 2 ? Math.min(...known) : null;
}
