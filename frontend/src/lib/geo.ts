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

const conDecimal = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const sinDecimal = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

// "3,1 km"; desde 100 km sin decimales: "457 km".
export function formatKm(km: number): string {
  return `${(km >= 100 ? sinDecimal : conDecimal).format(km)} km`;
}
