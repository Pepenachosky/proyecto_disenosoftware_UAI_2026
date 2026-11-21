// Filtros del catálogo: deslizador de precio máximo (sincronizado con el
// parámetro de URL `max`) y conteo de filtros activos.

// Paso del deslizador de precio en pesos chilenos.
export const PRICE_STEP = 10_000;

// Máximo del deslizador: mayor precio no nulo redondeado hacia arriba al paso.
// Sin precios (o todos muy bajos) devuelve un paso, para que el deslizador no quede en 0.
export function sliderMax(bestPrices: (number | null)[]): number {
  const prices = bestPrices.filter((p): p is number => p != null);
  if (prices.length === 0) return PRICE_STEP;
  const top = Math.max(...prices);
  return Math.max(PRICE_STEP, Math.ceil(top / PRICE_STEP) * PRICE_STEP);
}

// Lee el parámetro de URL `max`: entero no negativo o null.
// Solo dígitos: rechaza "", "-5", "1.5", "1e5" y espacios.
export function parseMaxPrice(param: string | null): number | null {
  if (param == null || !/^\d+$/.test(param)) return null;
  return Number(param);
}

// Posición del deslizador: el límite equivale a "sin filtro".
// Un `max` mayor que el límite (URL vieja o precios que bajaron) se muestra en el tope.
export function sliderValue(max: number | null, limit: number): number {
  if (max == null || max >= limit) return limit;
  return max;
}

// Parámetro de URL para la posición del deslizador (null = sin filtro).
export function maxParamFromSlider(value: number, limit: number): string | null {
  return value >= limit ? null : String(value);
}

// Cuenta los filtros que difieren de su valor por defecto.
export function activeFilterCount(f: {
  category: string;
  storeId: string;
  maxPrice: number | null;
  onlyInStock: boolean;
}): number {
  return [
    f.category !== "all",
    f.storeId !== "all",
    f.maxPrice != null,
    f.onlyInStock,
  ].filter(Boolean).length;
}
