import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { REGIONES } from "./data/comunas";
import type { LatLng } from "./lib/geo";
import {
  findComuna,
  readSaved,
  requestPosition,
  writeSaved,
} from "./lib/user-location";

export type UserLocation =
  | { estado: "inicial" }
  | { estado: "buscando" }
  | { estado: "gps"; point: LatLng }
  | { estado: "comuna"; region: string; comuna: string; point: LatLng }
  | { estado: "elegir" };

type LocationValue = {
  location: UserLocation;
  start(): void;
  requestGps(): void;
  chooseComuna(region: string, comuna: string): void;
};

const LocationContext = createContext<LocationValue | null>(null);

function getStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<UserLocation>({ estado: "inicial" });
  const startedRef = useRef(false);
  // Evita que un GPS lento pise una comuna elegida después.
  const seqRef = useRef(0);

  const requestGps = useCallback(() => {
    const seq = ++seqRef.current;
    setLocation({ estado: "buscando" });
    const geo = typeof navigator === "undefined" ? undefined : navigator.geolocation;
    requestPosition(geo, 10000).then((point) => {
      if (seq !== seqRef.current) return;
      if (point) {
        writeSaved(getStorage(), { modo: "gps" });
        setLocation({ estado: "gps", point });
      } else {
        setLocation({ estado: "elegir" });
      }
    });
  }, []);

  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const saved = readSaved(getStorage(), REGIONES);
    if (saved?.modo === "comuna") {
      const point = findComuna(REGIONES, saved.region, saved.comuna);
      if (point) {
        setLocation({ estado: "comuna", region: saved.region, comuna: saved.comuna, point });
        return;
      }
    }
    requestGps();
  }, [requestGps]);

  const chooseComuna = useCallback((region: string, comuna: string) => {
    const point = findComuna(REGIONES, region, comuna);
    if (!point) return;
    seqRef.current++;
    writeSaved(getStorage(), { modo: "comuna", region, comuna });
    setLocation({ estado: "comuna", region, comuna, point });
  }, []);

  const value = useMemo(
    () => ({ location, start, requestGps, chooseComuna }),
    [location, start, requestGps, chooseComuna],
  );
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useUserLocation(): LocationValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useUserLocation debe usarse dentro de LocationProvider");
  return ctx;
}
