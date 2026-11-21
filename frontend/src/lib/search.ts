// Búsqueda de texto del catálogo, sin distinguir mayúsculas ni tildes.

/** Minúsculas y sin diacríticos: NFD separa la tilde de la letra y luego se quitan las marcas combinantes (U+0300–U+036F). */
export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** true si cada palabra de la consulta aparece en el texto, en cualquier orden; consulta vacía → true. */
export function matchesQuery(text: string, query: string): boolean {
  const haystack = normalize(text);
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
