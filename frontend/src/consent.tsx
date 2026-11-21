import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Decision } from "./lib/consent.ts";
import { clearStoredData, readDecision, writeDecision } from "./consent-storage.ts";
import { supabase } from "./supabase";

type ConsentValue = {
  decision: Decision | null;
  bannerOpen: boolean;
  accept(): void;
  reject(): Promise<void>;
  reopen(): void;
  close(): void;
  /** Avisa cada vez que el usuario decide en esta visita; devuelve la función para dejar de escuchar. */
  onDecision(cb: (d: Decision) => void): () => void;
};

const ConsentContext = createContext<ConsentValue | null>(null);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [decision, setDecision] = useState<Decision | null>(readDecision);
  const [reopened, setReopened] = useState(false);
  const decisionRef = useRef(decision);
  const listenersRef = useRef(new Set<(d: Decision) => void>());

  const onDecision = useCallback((cb: (d: Decision) => void) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  const accept = useCallback(() => {
    writeDecision("aceptado");
    decisionRef.current = "aceptado";
    setDecision("aceptado");
    setReopened(false);
    for (const cb of listenersRef.current) cb("aceptado");
  }, []);

  const reject = useCallback(async () => {
    const before = decisionRef.current;
    if (before === "aceptado") {
      // Antes de escribir el rechazo: después, Supabase ya no usa localStorage.
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch (e) {
        console.warn("No se pudo cerrar la sesión al rechazar:", e);
      }
    }
    clearStoredData();
    writeDecision("rechazado");
    decisionRef.current = "rechazado";
    if (before === "aceptado") {
      // Recargar descarga el script de Google, que ya estaba cargado.
      location.reload();
      return;
    }
    setDecision("rechazado");
    setReopened(false);
    for (const cb of listenersRef.current) cb("rechazado");
  }, []);

  const reopen = useCallback(() => setReopened(true), []);
  const close = useCallback(() => setReopened(false), []);

  const value = useMemo<ConsentValue>(
    () => ({ decision, bannerOpen: decision === null || reopened, accept, reject, reopen, close, onDecision }),
    [decision, reopened, accept, reject, reopen, close, onDecision],
  );
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent debe usarse dentro de ConsentProvider");
  return ctx;
}
