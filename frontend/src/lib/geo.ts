// Distancia en línea recta entre dos puntos (no es la ruta por calle).
export type LatLng = { lat: number; lng: number };

const RADIO_TIERRA_KM = 6371;
const aRadianes = (grados: number) => (grados * Math.PI) / 180;

// Fórmula de Haversine.
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = aRadianes(b.lat - a.lat);
  const dLng = aRadianes(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(a.lat)) * Math.cos(aRadianes(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIO_TIERRA_KM * Math.asin(Math.sqrt(h));
}

// "3,1 km" (es-CL) o "3.1 km" (en-US); desde 100 km sin decimales: "457 km".
export function formatKm(km: number, locale: string): string {
  const digitos = km >= 100 ? 0 : 1;
  const texto = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digitos,
    maximumFractionDigits: digitos,
  }).format(km);
  return `${texto} km`;
}
