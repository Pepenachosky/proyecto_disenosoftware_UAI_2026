// Contexto de ubicación: geolocalización del navegador bajo demanda, sin persistencia
// (solo GPS; sin permiso no se calculan distancias).
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LatLng } from "./lib/geo";
import { requestPosition } from "./lib/user-location";

// Solo se usa la ubicación del navegador; sin permiso no hay distancias.
// Nada se guarda: el navegador ya recuerda el permiso.
export type UserLocation =
  | { estado: "inicial" }
  | { estado: "buscando" }
  | { estado: "gps"; point: LatLng }
  | { estado: "sin-ubicacion" };

type LocationValue = {
  location: UserLocation;
  start(): void;
  requestGps(): void;
};

const LocationContext = createContext<LocationValue | null>(null);

/**
 * Ubicación del usuario para ordenar tiendas por distancia. Expone el estado,
 * `start` (pide el GPS una sola vez, al entrar a un producto con ofertas) y
 * `requestGps` (reintento manual desde LocationBar).
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<UserLocation>({ estado: "inicial" });
  // El permiso se pide solo una vez por visita aunque se abran varios productos.
  const startedRef = useRef(false);
  // Solo cuenta la última petición (por si se pulsa "Usar mi ubicación" varias veces).
  const seqRef = useRef(0);

  const requestGps = useCallback(() => {
    const seq = ++seqRef.current;
    setLocation({ estado: "buscando" });
    const geo = typeof navigator === "undefined" ? undefined : navigator.geolocation;
    const aceptar = (point: LatLng) => {
      if (seq === seqRef.current) setLocation({ estado: "gps", point });
    };
    // Si el usuario acepta el permiso después del respaldo, igual se usa.
    requestPosition(geo, 10000, aceptar).then((point) => {
      if (seq !== seqRef.current) return;
      if (point) aceptar(point);
      else setLocation({ estado: "sin-ubicacion" });
    });
  }, []);

  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    requestGps();
  }, [requestGps]);

  const value = useMemo(() => ({ location, start, requestGps }), [location, start, requestGps]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

/** Acceso al contexto de ubicación; lanza error si se usa fuera de LocationProvider. */
export function useUserLocation(): LocationValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useUserLocation debe usarse dentro de LocationProvider");
  return ctx;
}
