// Lectura y escritura de la decisión de consentimiento fuera de React: Supabase e i18n
// se inicializan al importar sus módulos, antes de que exista ningún componente.
import { CONSENT_KEY, keysToClear, parseConsent, serializeConsent, type Decision } from "./lib/consent.ts";

// Decisión tomada en esta visita: sirve aunque localStorage falle (modo privado).
let current: Decision | null = null;

export function readDecision(): Decision | null {
  if (current) return current;
  try {
    return parseConsent(localStorage.getItem(CONSENT_KEY));
  } catch {
    return null;
  }
}

export function writeDecision(d: Decision): void {
  current = d;
  try {
    localStorage.setItem(CONSENT_KEY, serializeConsent(d, new Date()));
  } catch {
    // Sin localStorage la decisión vale solo para esta visita; el aviso volverá a salir.
  }
}

export function storageAllowed(): boolean {
  return readDecision() === "aceptado";
}

/** Borra el idioma y la sesión de Supabase guardados en este navegador. */
export function clearStoredData(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null) keys.push(k);
    }
    for (const k of keysToClear(keys)) localStorage.removeItem(k);
  } catch {
    // Nada que borrar si localStorage no está disponible.
  }
}

// Almacenamiento para Supabase: localStorage solo con consentimiento; si no, memoria.
const memory = new Map<string, string>();

export const gatedStorage = {
  getItem(k: string): string | null {
    if (!storageAllowed()) return memory.get(k) ?? null;
    try {
      return localStorage.getItem(k);
    } catch {
      return memory.get(k) ?? null;
    }
  },
  setItem(k: string, v: string): void {
    if (storageAllowed()) {
      try {
        localStorage.setItem(k, v);
        return;
      } catch {
        // Cae a memoria.
      }
    }
    memory.set(k, v);
  },
  removeItem(k: string): void {
    memory.delete(k);
    if (!storageAllowed()) return;
    try {
      localStorage.removeItem(k);
    } catch {
      // Nada que borrar.
    }
  },
};
