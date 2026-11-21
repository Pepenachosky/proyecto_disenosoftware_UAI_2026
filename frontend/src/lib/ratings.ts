// Orden por valoración con media ponderada (bayesiana):
//
//   puntuación = (C × m + suma de estrellas) / (C + n)
//
// n es la cantidad de reseñas del producto, m la media de todas las reseñas y
// C (PRIOR_WEIGHT) el peso de esa media, como si cada producto tuviera C
// reseñas "imaginarias" de nota m. Con pocas reseñas la puntuación se queda
// cerca de m; con muchas se acerca a la media real del producto. Así una sola
// reseña de 5★ no adelanta a un producto con muchas reseñas muy buenas.

export type RatingRow = { group_id: number; rating: number };
export type RatingStats = { count: number; sum: number };
export type Rated = { name: string; stats?: RatingStats };

export const PRIOR_WEIGHT = 5;

export function aggregateRatings(rows: RatingRow[]): Map<number, RatingStats> {
  const out = new Map<number, RatingStats>();
  for (const { group_id, rating } of rows) {
    const s = out.get(group_id);
    if (s) {
      s.count += 1;
      s.sum += rating;
    } else {
      out.set(group_id, { count: 1, sum: rating });
    }
  }
  return out;
}

// Media de todas las reseñas; 0 si no hay ninguna.
export function globalMean(stats: Iterable<RatingStats>): number {
  let count = 0;
  let sum = 0;
  for (const s of stats) {
    count += s.count;
    sum += s.sum;
  }
  return count === 0 ? 0 : sum / count;
}

export function averageRating(s: RatingStats): number {
  return s.sum / s.count;
}

export function weightedScore(s: RatingStats, mean: number, c = PRIOR_WEIGHT): number {
  return (c * mean + s.sum) / (c + s.count);
}

// Mejor puntuación primero; empate: más reseñas y luego nombre.
// Los productos sin reseñas van al final, por nombre.
export function compareByRating(a: Rated, b: Rated, mean: number, locale: string): number {
  const ra = a.stats && a.stats.count > 0 ? a.stats : null;
  const rb = b.stats && b.stats.count > 0 ? b.stats : null;
  if (ra && !rb) return -1;
  if (!ra && rb) return 1;
  if (ra && rb) {
    const diff = weightedScore(rb, mean) - weightedScore(ra, mean);
    if (diff !== 0) return diff;
    if (rb.count !== ra.count) return rb.count - ra.count;
  }
  return a.name.localeCompare(b.name, locale);
}

// Media con un decimal fijo y el formato del idioma (4,8 / 4.8).
export function formatRating(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}
