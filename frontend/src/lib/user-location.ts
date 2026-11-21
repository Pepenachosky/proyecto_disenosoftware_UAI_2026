// Pide la ubicación del usuario una vez, con tiempo límite, para ordenar tiendas por distancia.
import type { LatLng } from "./geo.ts";

// Forma mínima de navigator.geolocation (Deno no trae los tipos del DOM).
export type GeoLike = {
  getCurrentPosition(
    ok: (pos: { coords: { latitude: number; longitude: number } }) => void,
    error: (err: unknown) => void,
    options: { enableHighAccuracy: boolean; maximumAge: number; timeout: number },
  ): void;
};

// null si no hay geolocalización, si falla o si pasa timeoutMs. Si el usuario
// acepta el permiso después del respaldo, onLate recibe la posición tardía.
export function requestPosition(
  geo: GeoLike | undefined,
  timeoutMs: number,
  onLate?: (p: LatLng) => void,
): Promise<LatLng | null> {
  if (!geo) return Promise.resolve(null);
  return new Promise((resolve) => {
    // Respaldo propio por si el navegador nunca responde.
    let vencido = false;
    const timer = setTimeout(() => {
      vencido = true;
      resolve(null);
    }, timeoutMs);
    const fin = (p: LatLng | null) => {
      clearTimeout(timer);
      if (vencido) {
        if (p) onLate?.(p);
        return;
      }
      resolve(p);
    };
    try {
      geo.getCurrentPosition(
        (pos) => fin({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => fin(null),
        // Precisión baja y una posición de hasta 10 min basta para comparar distancias a tiendas.
        { enableHighAccuracy: false, maximumAge: 600000, timeout: timeoutMs },
      );
    } catch {
      // Por si la implementación lanza en vez de llamar al callback de error: nunca rechaza.
      fin(null);
    }
  });
}
