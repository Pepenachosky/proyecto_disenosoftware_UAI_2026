// Utilidades puras del consentimiento para guardar datos en el navegador (sin dependencias del navegador).
import { detectLang, initialLang, STORAGE_KEY, type Lang } from "./locale.ts";

export const CONSENT_KEY = "consentimiento";
/** Subirla vuelve a preguntar a todos (por ejemplo, si la política cambia de forma importante). */
export const CONSENT_VERSION = 1;

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
