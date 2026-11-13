import type { LatLng } from "./geo.ts";

// Forma estructural de las regiones (el archivo generado la cumple), para que lib no dependa de él.
export type RegionLike = { name: string; comunas: { name: string; lat: number; lng: number }[] };

// Lo único que se guarda en el navegador: el modo y, si corresponde, la comuna.
// Las coordenadas del GPS nunca se guardan.
export type SavedLocation = { modo: "gps" } | { modo: "comuna"; region: string; comuna: string };

export const STORAGE_KEY = "ubicacion";

export function findComuna(regiones: RegionLike[], region: string, comuna: string): LatLng | null {
  const c = regiones.find((r) => r.name === region)?.comunas.find((x) => x.name === comuna);
  return c ? { lat: c.lat, lng: c.lng } : null;
}

export function parseSaved(raw: string | null, regiones: RegionLike[]): SavedLocation | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v?.modo === "gps") return { modo: "gps" };
    if (
      v?.modo === "comuna" && typeof v.region === "string" && typeof v.comuna === "string" &&
      findComuna(regiones, v.region, v.comuna)
    ) {
      return { modo: "comuna", region: v.region, comuna: v.comuna };
    }
  } catch {
    // JSON inválido: se ignora
  }
  return null;
}

export function readSaved(
  storage: Pick<Storage, "getItem"> | null,
  regiones: RegionLike[],
): SavedLocation | null {
  try {
    return parseSaved(storage?.getItem(STORAGE_KEY) ?? null, regiones);
  } catch {
    return null;
  }
}

export function writeSaved(storage: Pick<Storage, "setItem"> | null, s: SavedLocation): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // almacenamiento no disponible: la preferencia solo dura la sesión
  }
}

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
        { enableHighAccuracy: false, maximumAge: 600000, timeout: timeoutMs },
      );
    } catch {
      fin(null);
    }
  });
}
