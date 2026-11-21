// Contexto de consentimiento de cookies: la decisión vive en localStorage (consent-storage.ts)
// y condiciona si se guardan sesión e idioma y si se carga el script de Google.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CONSENT_KEY, withTimeout, type Decision } from "./lib/consent.ts";
import { clearStoredData, readDecision, writeDecision } from "./consent-storage.ts";
import { supabase } from "./supabase";

// Cerrar sesión sin red puede tardar mucho (Supabase reintenta): el rechazo no lo espera más que esto.
const SIGN_OUT_LIMIT_MS = 3000;

type ConsentValue = {
  decision: Decision | null;
  bannerOpen: boolean;
  /** Hay un rechazo en curso: los botones de decisión se desactivan. */
  busy: boolean;
  /** Cambia cada vez que se pide volver al aviso, para llevarle el foco. */
  focusSignal: number;
  accept(): void;
  reject(): Promise<void>;
  reopen(): void;
  close(): void;
  /** Avisa cada vez que el usuario decide en esta visita; devuelve la función para dejar de escuchar. */
  onDecision(cb: (d: Decision) => void): () => void;
};

const ConsentContext = createContext<ConsentValue | null>(null);

/**
 * Guarda la decisión de cookies/almacenamiento (aceptado, rechazado o null si
 * aún no se decide) y controla el aviso. Expone accept/reject, reabrir/cerrar
 * el aviso y `onDecision` para que otros providers (idioma) reaccionen.
 */
export function ConsentProvider({ children }: { children: ReactNode }) {
  const [decision, setDecision] = useState<Decision | null>(readDecision);
  const [reopened, setReopened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  // Refs para que accept/reject sean estables (useCallback sin dependencias) y vean
  // el valor actual; busyRef además bloquea dobles clics antes de que llegue el re-render.
  const decisionRef = useRef(decision);
  const busyRef = useRef(false);
  const listenersRef = useRef(new Set<(d: Decision) => void>());

  // Si otra pestaña cambia la decisión, se recarga: así esta pestaña deja de guardar
  // datos (o los vuelve a guardar) y el script de Google se carga o se descarga.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // key === null: la otra pestaña vació todo el localStorage.
      if (e.key === CONSENT_KEY || e.key === null) location.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const onDecision = useCallback((cb: (d: Decision) => void) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  const accept = useCallback(() => {
    if (busyRef.current) return;
    writeDecision("aceptado");
    decisionRef.current = "aceptado";
    setDecision("aceptado");
    setReopened(false);
    for (const cb of listenersRef.current) cb("aceptado");
  }, []);

  const reject = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const before = decisionRef.current;
    if (before === "aceptado") {
      // Antes de escribir el rechazo: después, Supabase ya no usa localStorage.
      const result = await withTimeout(supabase.auth.signOut({ scope: "local" }), SIGN_OUT_LIMIT_MS);
      if (result === "timeout" || result === "error") {
        console.warn("No se pudo cerrar la sesión al rechazar (se borra igual):", result);
      }
    }
    // Se borra aunque el cierre de sesión haya fallado o vencido: rechazar no debe quedar a medias.
    clearStoredData();
    writeDecision("rechazado");
    decisionRef.current = "rechazado";
    if (before === "aceptado") {
      // Recargar descarga el script de Google, que ya estaba cargado.
      location.reload();
      return;
    }
    busyRef.current = false;
    setBusy(false);
    setDecision("rechazado");
    setReopened(false);
    for (const cb of listenersRef.current) cb("rechazado");
  }, []);

  // Reabrir el aviso (lo usa LoginButton cuando falta el consentimiento) no cambia la decisión vigente.
  const reopen = useCallback(() => {
    setReopened(true);
    setFocusSignal((n) => n + 1);
  }, []);
  const close = useCallback(() => setReopened(false), []);

  const value = useMemo<ConsentValue>(
    () => ({
      decision,
      // Sin decisión el aviso siempre está abierto; con decisión, solo si se reabrió.
      bannerOpen: decision === null || reopened,
      busy,
      focusSignal,
      accept,
      reject,
      reopen,
      close,
      onDecision,
    }),
    [decision, reopened, busy, focusSignal, accept, reject, reopen, close, onDecision],
  );
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

/** Acceso al contexto de consentimiento; lanza error si se usa fuera de ConsentProvider. */
export function useConsent(): ConsentValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent debe usarse dentro de ConsentProvider");
  return ctx;
}
