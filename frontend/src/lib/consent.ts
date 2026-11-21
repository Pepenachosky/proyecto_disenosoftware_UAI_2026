// Utilidades puras del consentimiento para guardar datos en el navegador (sin dependencias del navegador).
import { detectLang, initialLang, STORAGE_KEY, type Lang } from "./locale.ts";

/** Clave de localStorage donde se guarda la decisión (JSON con versión, decisión y fecha). */
export const CONSENT_KEY = "consentimiento";
/** Subirla vuelve a preguntar a todos (por ejemplo, si la política cambia de forma importante). */
export const CONSENT_VERSION = 1;

/** Lo que eligió el usuario en el aviso; null en el resto del código significa "aún no decide". */
export type Decision = "aceptado" | "rechazado";

/** Valor guardado → decisión; ilegible o de otra versión cuenta como sin decidir (null). */
export function parseConsent(raw: string | null): Decision | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const { version, decision } = v as { version?: unknown; decision?: unknown };
    if (version !== CONSENT_VERSION) return null;
    return decision === "aceptado" || decision === "rechazado" ? decision : null;
  } catch {
    return null;
  }
}

/** Decisión → valor para guardar; incluye la versión actual y la fecha como registro de cuándo se decidió. */
export function serializeConsent(decision: Decision, fecha: Date): string {
  return JSON.stringify({ version: CONSENT_VERSION, decision, fecha: fecha.toISOString() });
}

/** Aceptado: lo guardado o el navegador. Rechazado: español. Sin decidir: el navegador, sin leer lo guardado. */
export function startLang(
  decision: Decision | null,
  stored: string | null,
  navLang: string | undefined,
): Lang {
  if (decision === "aceptado") return initialLang(stored, navLang);
  if (decision === "rechazado") return "es";
  return detectLang(navLang);
}

/** Claves de Rigly que se borran al rechazar: el idioma y la sesión de Supabase (sb-*). */
export function keysToClear(keys: readonly string[]): string[] {
  return keys.filter((k) => k === STORAGE_KEY || k.startsWith("sb-"));
}

/** Manda lo guardado (puede venir de otra pestaña); la memoria solo cubre un localStorage que no guardó. */
export function resolveDecision(stored: Decision | null, memory: Decision | null): Decision | null {
  return stored ?? memory;
}

/** Espera la promesa como mucho `ms`; nunca lanza: devuelve "timeout" o "error" si no termina bien. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | "timeout" | "error"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // El finally limpia el temporizador para que no quede vivo si la promesa gana la carrera.
  const limit = new Promise<"timeout">((r) => {
    timer = setTimeout(() => r("timeout"), ms);
  });
  return Promise.race([p.catch(() => "error" as const), limit]).finally(() => clearTimeout(timer));
}
